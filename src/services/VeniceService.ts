import axios from "axios";

export class VeniceService {

  static async chat(messages: any[], retries: number = 3): Promise<any> {
    const maxRetries = retries;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.makeRequest(messages);
      } catch (err: any) {
        lastError = err;
        
        // Only retry on 5xx server errors (transient issues)
        const isServerError = err.message?.includes("HTTP 5") || 
                              err.message?.includes("EngineCore") ||
                              err.message?.includes("InternalServerError");
        
        if (isServerError && attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 8000); // Exponential backoff: 1s, 2s, 4s
          console.warn(`\n⚠️ Venice API server error (attempt ${attempt}/${maxRetries}). Retrying in ${delay}ms...\n`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        throw err; // Non-retryable or out of retries
      }
    }

    throw lastError || new Error("Venice API request failed after retries");
  }

  private static async makeRequest(messages: any[]) {

    const response = await axios.post(
      "https://api.venice.ai/api/v1/chat/completions",
      {
        model: process.env.VENICE_MODEL,
        messages,
        stream: true,
        response_format: {
            type: "json_object"
        }
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.VENICE_AUTH_KEY}`,
          "Content-Type": "application/json"
        },
        responseType: "stream",
        timeout: 60000,
        validateStatus: () => true, // Handle status ourselves for streaming error bodies
      }
    );

    // Check for non-2xx HTTP status
    if (response.status !== 200) {
      // Try to read the error body from the stream
      const errorBody = await new Promise<string>((resolve) => {
        const chunks: Buffer[] = [];
        response.data.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.data.on("end", () => resolve(Buffer.concat(chunks).toString()));
        setTimeout(() => resolve(chunks.length ? Buffer.concat(chunks).toString() : "(empty)"), 5000);
      });
      
      throw new Error(
        `HTTP ${response.status}: ${errorBody.substring(0, 500)}`
      );
    }

    return response.data;

  }

}