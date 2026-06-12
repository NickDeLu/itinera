import express from "express";
import cors from "cors";
import { createServer } from "http";
import path from "path";

import { supabaseAdmin } from "./database";
import authRoutes from "./routes/auth";

const PORT = process.env.PORT || 5000;

const app = express();

app.use(cors());
app.use(express.json());

// Serve static files from public directory
app.use(express.static(path.join(__dirname, "../public")));

// Register auth routes
app.use("/auth", authRoutes);

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
  } catch (err) {
    console.error("Server startup error:", err);
  }
});
