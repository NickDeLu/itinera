import express from "express";
import cors from "cors";
import { createServer } from "http";
import path from "path";

import { supabaseAdmin } from "./database";
import authRoutes from "./routes/auth";
import { VeniceService } from "./services/VeniceService";
import { StreamProcessor } from "./ai/StreamProcessor";
import { ToolChainExecutor } from "./ai/ToolChainExecutor";
import { ITINERA_SYSTEM_PROMPT } from "./prompts/systemPrompt";
import { authMiddleware, AuthenticatedRequest } from "./middleware/auth";

const PORT = process.env.PORT || 5000;

const app = express();

app.use(cors());
app.use(express.json());

// Serve static files from public directory
app.use(express.static(path.join(__dirname, "../public")));

// Register auth routes
app.use("/auth", authRoutes);

// Add /chat endpoint after auth routes
app.post("/chat", authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { message, history } = req.body;
    const userId = req.user!.id;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    // Build message history
    const messages: { role: string; content: string }[] = [];

    // Add system prompt
    messages.push({
      role: "system",
      content: ITINERA_SYSTEM_PROMPT(userId),
    });

    // Add previous history if provided
    if (history && Array.isArray(history)) {
      messages.push(...history);
    }

    // Add current user message
    messages.push({ role: "user", content: message });

    // Run the conversation loop (up to 5 turns to handle tool chains)
    let turnCount = 0;
    const maxTurns = 5;
    let lastText = "";

    while (turnCount < maxTurns) {
      turnCount++;

      // Call Venice AI
      const stream = await VeniceService.chat(messages);
      const response = await StreamProcessor.process(stream, 30000);

      // Store the text
      if (response.text) {
        lastText = response.text;
      }

      // Add AI response to history
      messages.push({
        role: "assistant",
        content: JSON.stringify({ tools: response.tools, text: response.text }),
      });

      // Execute tools if any
      if (response.tools && response.tools.length > 0) {
        const executor = new ToolChainExecutor(
          userId,
          () => {} // silent callback
        );

        const toolResults = await executor.executeTools(response.tools);

        // Add tool results to history
        const toolResultsContent = Object.entries(toolResults)
          .map(([tool, result]: [string, any]) => {
            return `### ${tool}\n${result.error ? `❌ Error: ${result.error}` : `✅ Success\n${JSON.stringify(result, null, 2)}`}`;
          })
          .join("\n\n");

        messages.push({
          role: "system",
          content: `Tool execution results:\n\n${toolResultsContent}\n\nNow continue with the next appropriate action based on these results.`,
        });
      } else {
        // No tools to execute — we're done
        break;
      }
    }

    // Return the AI response and updated history (excluding system prompt)
    const visibleHistory = messages.filter(m => m.role !== "system");

    return res.json({
      text: lastText,
      history: visibleHistory,
    });
  } catch (err: any) {
    console.error("Chat endpoint error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

const httpServer = createServer(app);

httpServer.listen(PORT, async () => {
  try {
    // Test database connection
    const { data, error } = await supabaseAdmin.from("users").select("id").limit(1);

    if (error) {
      console.error("Database connection test failed:", error);
    } else {
      console.log("✓ Database connection successful");
    }

    console.log(`✓ HTTP API running at http://localhost:${PORT}`);
    console.log(`✓ Test UI available at http://localhost:${PORT}/test.html`);
    console.log(`✓ Chat Test UI available at http://localhost:${PORT}/chat-test.html`);
  } catch (err) {
    console.error("Server startup error:", err);
  }
});
