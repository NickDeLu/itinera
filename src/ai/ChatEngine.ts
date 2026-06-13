import { VeniceService } from "../services/VeniceService";
import { StreamProcessor } from "./StreamProcessor";
import { ToolChainExecutor } from "./ToolChainExecutor";
import { ITINERA_SYSTEM_PROMPT } from "../prompts/systemPrompt";
import { Response } from "express";

interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ToolCall {
  tool: string;
  args: Record<string, any>;
}

interface ToolResults {
  [key: string]: any;
}

interface TurnResult {
  text: string;
  tools: ToolCall[];
  toolResults: { [tool: string]: any };
}

interface ChatResult {
  turns: TurnResult[];
  history: Message[];
}

// ──────────────────────────────────────────
// Non-streaming (used by CLI test script)
// ──────────────────────────────────────────

/**
 * Runs the full conversation loop and returns all turns at once.
 */
export async function runChatLoop(
  userId: string,
  message: string,
  history: Message[] = [],
  maxTurns: number = 5,
  onToolResult?: (toolName: string, result: any) => void
): Promise<ChatResult> {
  const messages = buildMessageHistory(userId, message, history);
  const turns: TurnResult[] = [];

  for (let turn = 0; turn < maxTurns; turn++) {
    const stream = await VeniceService.chat(messages);
    const response = await StreamProcessor.process(stream, 30000);

    const turnResult: TurnResult = {
      text: response.text || "",
      tools: response.tools || [],
      toolResults: {},
    };

    messages.push({
      role: "assistant",
      content: JSON.stringify({ tools: response.tools, text: response.text }),
    });

    if (response.tools?.length) {
      const executor = new ToolChainExecutor(userId, (toolName, result) => {
        onToolResult?.(toolName, result);
      });
      turnResult.toolResults = await executor.executeTools(response.tools);
      messages.push({
        role: "user",
        content: formatToolResults(response.tools, turnResult.toolResults),
      });
    }

    turns.push(turnResult);
    if (!response.tools?.length) break;
  }

  return { turns, history: messages.filter(m => m.role !== "system") };
}

// ──────────────────────────────────────────
// Streaming SSE (used by web UI)
// ──────────────────────────────────────────

/**
 * Runs the conversation loop and streams events to the HTTP response in real time.
 *
 * SSE Events sent:
 *   text_chunk  - a piece of the AI's response text
 *   turn_start  - a new AI response turn is beginning
 *   turn_done   - the AI's response for this turn is complete
 *   tool_call   - about to execute a tool { tool, args }
 *   tool_result - a tool completed { tool, result }
 *   error       - an error occurred
 *   done        - all turns complete
 */
export async function runStreamingChat(
  userId: string,
  message: string,
  history: Message[],
  res: Response,
  maxTurns: number = 5
): Promise<void> {
  const messages = buildMessageHistory(userId, message, history);

  // Set up SSE headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  let aborted = false;
  res.on("close", () => { aborted = true; });

  try {
    for (let turn = 0; turn < maxTurns && !aborted; turn++) {
      sendSSE(res, "turn_start", {});

      // Call Venice AI and stream chunks live
      const veniceStream = await VeniceService.chat(messages);
      const response = await StreamProcessor.processStreaming(
        veniceStream,
        (chunk: string) => sendSSE(res, "text_chunk", { text: chunk }),
        () => aborted
      );

      if (aborted) break;

      messages.push({
        role: "assistant",
        content: JSON.stringify({ tools: response.tools, text: response.text }),
      });

      sendSSE(res, "turn_done", { text: response.text, tools: response.tools });

      // Execute tools if any
      if (response.tools?.length) {
        const executor = new ToolChainExecutor(userId, () => {});
        const allResults: any = {};

        for (const toolCall of response.tools) {
          if (aborted) break;
          sendSSE(res, "tool_call", { tool: toolCall.tool, args: toolCall.args });

          const result = await executor.executeTools([toolCall]);
          allResults[toolCall.tool] = result[toolCall.tool];
          sendSSE(res, "tool_result", { tool: toolCall.tool, result: allResults[toolCall.tool] });
        }

        if (!aborted) {
          messages.push({
            role: "user",
            content: formatToolResults(response.tools, allResults),
          });
        }
      } else {
        // No tools — this is the last turn
        break;
      }
    }
  } catch (err: any) {
    console.error("Stream error:", err.message);
    sendSSE(res, "error", { error: err.message });
  }

  // Send final history
  const visibleHistory = messages.filter(m => m.role !== "system");
  sendSSE(res, "history", { history: visibleHistory });
  sendSSE(res, "done", {});
  res.end();
}

// ──────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────

function sendSSE(res: Response, event: string, data: any) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function buildMessageHistory(userId: string, message: string, history: Message[]): Message[] {
  const messages: Message[] = [
    { role: "system", content: ITINERA_SYSTEM_PROMPT(userId) },
  ];
  if (history.length) messages.push(...history);
  messages.push({ role: "user", content: message });
  return messages;
}

/**
 * Format tool execution results for the AI to understand context
 */
function formatToolResults(tools: ToolCall[], results: ToolResults): string {
  let message = "Tool execution results:\n\n";

  for (const toolCall of tools) {
    const toolName = toolCall.tool;
    const result = results[toolName];

    message += `### ${toolName}\n`;

    if (result.error) {
      message += `❌ Error: ${result.error}\n\n`;
      continue;
    }

    message += `✅ Success\n`;

    switch (toolName) {
      case "fetch_trips":
        if (result.trips?.length === 0) {
          message += `No existing trips found. You should now call create_trip with the user's details, then create_itinerary_item.\n\n`;
        } else if (result.trips) {
          message += `Found ${result.trips.length} existing trip(s):\n`;
          result.trips.forEach((trip: any) => {
            message += `  - ${trip.name} (ID: ${trip.id}, dates: ${trip.start_date || "N/A"} to ${trip.end_date || "N/A"}, destination: ${trip.destination || "N/A"})\n`;
          });
          message += `\n`;
        }
        break;

      case "create_trip":
        if (result.trip) {
          message += `Created trip "${result.trip.name}" with ID: ${result.trip.id}\n`;
          message += `Now you should call create_itinerary_item with this trip_id.\n\n`;
        }
        break;

      case "create_itinerary_item":
        if (result.item) {
          message += `Created itinerary item "${result.item.title}" (ID: ${result.item.id})\n\n`;
        }
        break;

      case "fetch_itinerary_items":
        if (result.items) {
          if (result.items.length === 0) {
            message += `No itinerary items found for trip "${result.trip_name}". You should suggest adding activities.\n\n`;
          } else {
            message += `Found ${result.items.length} itinerary item(s) for trip "${result.trip_name}":\n`;
            result.items.forEach((item: any) => {
              const start = item.start_timestamp ? new Date(item.start_timestamp).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : "TBD";
              const end = item.end_timestamp ? new Date(item.end_timestamp).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : "";
              const timeRange = end ? `${start} → ${end}` : start;
              message += `  - ${item.title} | ${timeRange} | ${item.location || "No location"} | ${item.description || "No description"} | ID: ${item.id} | status: ${item.status}\n`;
            });
            message += `\n`;
          }
        }
        break;

      default:
        message += `${JSON.stringify(result, null, 2)}\n\n`;
    }
  }

  message += "Now continue with the next appropriate action based on these results.";
  return message;
}