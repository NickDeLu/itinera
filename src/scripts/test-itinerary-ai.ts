import { runChatLoop } from "../ai/ChatEngine";
import dotenv from "dotenv";
import * as readline from "readline";

dotenv.config();

// Test user ID - real user in Supabase
const TEST_USER_ID = "9e5495af-0369-4a94-8b3c-1996aaf8072f";

type MessageRole = "system" | "user" | "assistant";

class ItineraTestAgent {
  private userId: string = TEST_USER_ID;
  private history: { role: MessageRole; content: string }[] = [];

  async start() {
    this.printHeader();

    // Setup phase
    await this.setupSession();

    // Get user input (CLI argument or interactive prompt)
    const userMessage = await this.getUserInput();

    console.log(`\n📝 User: ${userMessage}\n`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    // Start conversation loop
    await this.conversationLoop(userMessage);
  }

  private async conversationLoop(initialMessage: string) {
    let turnCount = 0;
    const maxTurns = 10;
    let currentMessage = initialMessage;

    while (turnCount < maxTurns) {
      turnCount++;
      console.log(`\n📡 Turn ${turnCount}: Calling Venice AI...\n`);

      try {
        const result = await runChatLoop(
          this.userId,
          currentMessage,
          this.history,
          5, // max tool turns per request
          (toolName, toolResult) => {
            console.log(`🔧 Executing tool: ${toolName}`);
            console.log(`   Result: ${JSON.stringify(toolResult).substring(0, 200)}...`);
          }
        );

        // Update conversation history
        this.history = result.history;

        // Render all turns from the loop
        for (const turn of result.turns) {
          console.log(`\n🤖 AI Response:\n${turn.text || "(empty)"}\n`);

          if (turn.tools && turn.tools.length > 0) {
            console.log(`🔧 Tools called: ${turn.tools.map(t => t.tool).join(", ")}`);
            for (const [toolName, toolResult] of Object.entries(turn.toolResults)) {
              const status = toolResult.error ? "❌" : "✅";
              console.log(`   ${status} ${toolName}: ${JSON.stringify(toolResult).substring(0, 150)}`);
            }
          }
        }

        const lastText = result.turns[result.turns.length - 1]?.text || "";

        // Check if response is empty
        if (!lastText || lastText.trim() === "") {
          console.warn("⚠️ AI returned empty response - ending conversation");
          break;
        }

        // Check if AI is asking a question (wants more input)
        if (this.containsQuestion(lastText)) {
          console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
          const followUp = await this.getUserFollowUpInput();
          console.log(`\n📝 User: ${followUp}\n`);
          currentMessage = followUp;
          continue;
        }

        // AI completed the task
        console.log("\n✅ Conversation complete - task accomplished\n");
        break;

      } catch (err: any) {
        console.error("❌ Error during conversation:", err.message);
        if (err.message.includes("timeout") || err.message.includes("429")) {
          console.error("⚠️ API rate limited or timed out. Please try again.");
        }
        break;
      }
    }

    if (turnCount >= maxTurns) {
      console.log("⚠️  Max turns reached, stopping conversation");
    }

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("✅ Test session complete\n");
  }

  private containsQuestion(text: string): boolean {
    return /\?/.test(text) || /could you|can you|do you/i.test(text) || /please provide|need/i.test(text) || /what is|which|tell me/i.test(text);
  }

  private printHeader() {
    console.log("\n🚀 Itinera Test Agent Started");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  }

  private async setupSession() {
    console.log("🔐 User Session Setup\n");
    console.log(`Default User ID: ${TEST_USER_ID}`);
    console.log("This ID will be automatically included in all tool calls.\n");
    console.log(`✅ Using User ID: ${this.userId}\n`);
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

      [
        "💡 Example initial scenarios:",
        "  - 'I have a flight to Paris next week departing June 15 at 10am'",
        "  - 'Add a hotel booking in NYC - The Plaza Hotel from June 20-22'",
        "  - 'Create a trip to Tokyo from July 1-10 and add a flight there'",
        "",
      ].forEach(q => console.log(q));

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
        resolve(input || "Please continue.");
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