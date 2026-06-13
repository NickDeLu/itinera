/**
 * Parses Venice AI's JSON Schema streaming response
 * Venice returns a stream of SSE messages with JSON chunks
 */
export class ToolCallParser {
  private static buffer = "";
  private static depth = 0;
  private static started = false;

  static extract(chunk: string): { tools: any[]; text: string } | null {
    this.buffer += chunk;

    for (const char of chunk) {
      if (char === "{") {
        this.depth++;
        this.started = true;
      }

      if (char === "}") {
        this.depth--;
      }
    }

    // JSON object completed
    if (this.started && this.depth === 0 && this.buffer.includes("}")) {
      try {
        // Find the first complete JSON object
        const match = this.buffer.match(/^({.*})/s);
        if (!match) return null;

        const parsed = JSON.parse(match[1]);
        
        // Debug logging
        console.log(`\n📊 Venice AI Response (raw):`);
        console.log(JSON.stringify(parsed, null, 2));

        this.reset();

        return {
          tools: parsed.tools || [],
          text: parsed.text || "",
        };
      } catch (err) {
        // Keep accumulating buffer if JSON is incomplete
        return null;
      }
    }

    return null;
  }

  static reset() {
    this.buffer = "";
    this.depth = 0;
    this.started = false;
  }
}