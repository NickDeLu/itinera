import { VeniceService } from "../services/VeniceService";
import { StreamProcessor } from "../ai/StreamProcessor";
import { ToolChainExecutor } from "../ai/ToolChainExecutor";
import { ITINERA_SYSTEM_PROMPT } from "../prompts/systemPrompt";
import dotenv from "dotenv";
import * as readline from "readline";

dotenv.config();

// Test user ID - real user in Supabase
const TEST_USER_ID = "9e5495af-0369-4a94-8b3c-1996aaf8072f";

interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

class ItineraTestAgent {
  private messages: Message[] = [];
  private conversationComplete = false;
  private userId: string = TEST_USER_ID;

  constructor() {
    // System prompt will be added after userId is set
  }

  async start() {
    console.log("\n🚀 Itinera Test Agent Started");
    console.log(
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
    );

    // Setup phase - establish user session
    await this.setupSession();

    // Initialize with system prompt (now with user_id)
    this.messages.push({
      role: "system",
      content: ITINERA_SYSTEM_PROMPT(this.userId),
    });

    // Get user input
    const userMessage = await this.getUserInput();
    this.messages.push({
      role: "user",
      content: userMessage,
    });

    console.log(`\n📝 User: ${userMessage}\n`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    // Start the conversation loop
    await this.conversationLoop();
  }

  private async setupSession() {
    console.log("🔐 User Session Setup\n");
    console.log(`Default User ID: ${TEST_USER_ID}`);
    console.log(
      "This ID will be automatically included in all tool calls.\n"
    );

    // In production, this would be after login
    // For now, use default test ID
    this.userId = TEST_USER_ID;
    console.log(`✅ Using User ID: ${this.userId}\n`);
  }

  private async conversationLoop() {
    let turnCount = 0;
    const maxTurns = 10; // Prevent infinite loops

    while (!this.conversationComplete && turnCount < maxTurns) {
      turnCount++;
      console.log(`\n📡 Turn ${turnCount}: Calling Venice AI...\n`);

      try {
        // Call Venice AI
        console.log("🔄 Calling Venice AI service...");
        const stream = await VeniceService.chat(this.messages);
        console.log("📡 Stream received, processing...");
        const response = await StreamProcessor.process(stream, 30000); // 30 second timeout

        console.log(`\n🤖 AI Response:\n${response.text || "(empty)"}\n`);

        // Add AI response to history
        this.messages.push({
          role: "assistant",
          content: JSON.stringify({ tools: response.tools, text: response.text }),
        });

        // Check if response is empty - this indicates a problem
        if (!response.text || response.text.trim() === "") {
          console.warn("⚠️ AI returned empty response - ending conversation");
          this.conversationComplete = true;
        }

        // Execute tools if any
        if (response.tools && response.tools.length > 0) {
          console.log(
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
          );
          console.log(`\n🔧 Found ${response.tools.length} tool(s) to execute\n`);

          const executor = new ToolChainExecutor(
            this.userId,
            (toolName: string, result: any) => {
              console.log(
                `   Result: ${JSON.stringify(result, null, 2).substring(0, 200)}...`
              );
            }
          );

          const toolResults = await executor.executeTools(response.tools);

          // Add tool results to message history for next turn with clear context
          const toolResultsMessage = {
            role: "system" as const,
            content: this.formatToolResults(response.tools, toolResults),
          };
          this.messages.push(toolResultsMessage);

          console.log(
            `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
          );

          // Continue conversation with tool results
          console.log(
            `\n📡 Turn ${turnCount + 1}: Continuing with tool results...\n`
          );
        } else if (this.containsQuestion(response.text)) {
          // AI is asking for more information, prompt user to provide it
          console.log(
            `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
          );
          const userFollowUp = await this.getUserFollowUpInput();
          this.messages.push({
            role: "user",
            content: userFollowUp,
          });

          console.log(`\n📝 User: ${userFollowUp}\n`);
          console.log(
            `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
          );
        } else {
          // AI has completed the task and has nothing more to ask or do
          console.log(
            "\n✅ Conversation complete - task accomplished\n"
          );
          this.conversationComplete = true;
        }
      } catch (err: any) {
        console.error("❌ Error during conversation:", err.message);
        if (err.code === "ECONNABORTED" || err.message.includes("timeout")) {
          console.error("⏱️ Request timeout - the Venice API took too long to respond");
        }
        this.conversationComplete = true;
      }
    }

    if (turnCount >= maxTurns) {
      console.log(
        "⚠️  Max turns reached, stopping conversation to prevent infinite loop"
      );
    }

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(
      "✅ Test session complete\n"
    );
  }

  private containsQuestion(text: string): boolean {
    // Check if the text contains questions or requests for input
    const questionPatterns = [
      /\?/,                          // Question mark
      /could you|can you|do you/i,   // Requests
      /please provide|need/i,        // Explicit requests
      /what is|which|tell me/i,      // Information requests
    ];

    return questionPatterns.some(pattern => pattern.test(text));
  }

  private formatToolResults(
    tools: any[],
    results: { [key: string]: any }
  ): string {
    // Format tool results in a way that helps AI understand the context
    let message = "Tool execution results:\n\n";

    for (const tool of tools) {
      const toolName = tool.tool;
      const result = results[toolName];

      message += `### ${toolName}\n`;

      if (result.error) {
        message += `❌ Error: ${result.error}\n\n`;
      } else {
        message += `✅ Success\n`;

        // Provide context for each tool result
        switch (toolName) {
          case "fetch_trips":
            if (result.trips && result.trips.length === 0) {
              message += `No existing trips found. You should now call create_trip with the user's details, then create_itinerary_item.\n\n`;
            } else if (result.trips) {
              message += `Found ${result.trips.length} existing trip(s):\n`;
              result.trips.forEach((trip: any) => {
                message += `  - ${trip.name} (ID: ${trip.id})\n`;
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
                  message += `  - ${item.title} (ID: ${item.id}, type: ${item.activity_type_id}, status: ${item.status})\n`;
                });
                message += `\n`;
              }
            }
            break;

          default:
            message += `${JSON.stringify(result, null, 2)}\n\n`;
        }
      }
    }

    message += "Now continue with the next appropriate action based on these results.";
    return message;
  }

  private getUserInput(): Promise<string> {
    // Check if initial message was provided as CLI argument
    const args = process.argv.slice(2);
    if (args.length > 0) {
      const message = args.join(" ");
      console.log(`📧 Using CLI argument as message: "${message}"\n`);
      return Promise.resolve(message);
    }

    return new Promise((resolve) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const questions = [
        "💡 Example initial scenarios:",
        "  - 'I have a flight to Paris next week departing June 15 at 10am'",
        "  - 'Add a hotel booking in NYC - The Plaza Hotel from June 20-22'",
        "  - 'Create a trip to Tokyo from July 1-10 and add a flight there'",
        "",
      ];

      questions.forEach(q => console.log(q));

      rl.question("📧 Describe your itinerary or booking: ", (input) => {
        rl.close();
        resolve(input || "I need to create a trip to Paris next week.");
      });
    });
  }

  private getUserFollowUpInput(): Promise<string> {
    return new Promise((resolve) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      rl.question("📝 Your response: ", (input) => {
        rl.close();
        resolve(input || "Please use my default user ID and create a new trip.");
      });
    });
  }
}

// Run the test agent
const agent = new ItineraTestAgent();
agent.start().catch((err) => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});