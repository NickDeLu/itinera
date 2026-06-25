import express from "express";
import cors from "cors";
import { createServer } from "http";
import path from "path";

import { supabaseAdmin } from "./database";
import authRoutes from "./routes/auth";
import mailgunRoutes from "./routes/mailgun";
import userEmailsRoutes from "./routes/userEmails";
import { runChatLoop, runStreamingChat } from "./ai/ChatEngine";
import { authMiddleware, AuthenticatedRequest } from "./middleware/auth";

const PORT = process.env.PORT || 5000;

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, "../public")));

// Register auth routes
app.use("/auth", authRoutes);

// Register Mailgun webhook routes
app.use("/webhooks/mailgun", mailgunRoutes);

// Register user email management routes
app.use("/user/emails", userEmailsRoutes);

// Chat endpoint — delegates to the shared ChatEngine
app.post("/chat", authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { message, history } = req.body;
    const userId = req.user!.id;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    const { turns, history: newHistory } = await runChatLoop(userId, message, history || []);
    return res.json({ turns, history: newHistory });
  } catch (err: any) {
    console.error("Chat endpoint error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// Streaming chat endpoint (SSE)
app.post("/chat/stream", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const { message, history } = req.body;
  const userId = req.user!.id;

  if (!message) {
    return res.status(400).json({ error: "Message is required" });
  }

  await runStreamingChat(userId, message, history || [], res);
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
