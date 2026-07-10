import { ToolCallParser } from "./ToolCallParser";

export class StreamProcessor {
  /**
   * Process a Venice SSE stream fully, returns the complete parsed result.
   */
  static async process(
    stream: any,
    timeoutMs: number = 120000
  ): Promise<{ tools: any[]; text: string }> {
    ToolCallParser.reset();
    const result = await this.processRawStream(stream, timeoutMs, () => {}, () => false);
    return { tools: result.tools, text: result.text };
  }

  /**
   * Process a Venice SSE stream, calling onChunk with each delta content chunk as it arrives.
   * Used by the streaming SSE endpoint to forward text in real time.
   */
  static async processStreaming(
    stream: any,
    onChunk: (text: string) => void,
    isAborted: () => boolean,
    timeoutMs: number = 120000
  ): Promise<{ tools: any[]; text: string }> {
    ToolCallParser.reset();
    return this.processRawStream(stream, timeoutMs, onChunk, isAborted);
  }

  /**
   * Core stream processing logic shared by process() and processStreaming()
   */
  private static async processRawStream(
    stream: any,
    timeoutMs: number,
    onChunk: (text: string) => void,
    isAborted: () => boolean
  ): Promise<{ tools: any[]; text: string }> {
    let sseBuffer = "";
    let fullText = "";
    let toolsExtracted: any[] = [];
    let streamEnded = false;
    let totalData = "";
    let hasApiError = false;

    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        if (!streamEnded) {
          console.warn("⚠️ Stream timeout - using accumulated data");
          if (hasApiError) {
            reject(new Error("Venice API returned an error and then timed out"));
          } else {
            stream.destroy?.();
            resolve({ tools: toolsExtracted, text: fullText });
          }
        }
      }, timeoutMs);

      const cleanup = () => {
        clearTimeout(timeoutHandle);
        streamEnded = true;
      };

      stream.on("data", (chunk: Buffer) => {
        if (isAborted()) {
          cleanup();
          stream.destroy?.();
          resolve({ tools: toolsExtracted, text: fullText });
          return;
        }

        try {
          const text = chunk.toString();
          sseBuffer += text;
          totalData += text;

          let boundary = sseBuffer.indexOf("\n\n");
          while (boundary !== -1) {
            const message = sseBuffer.slice(0, boundary).trim();
            sseBuffer = sseBuffer.slice(boundary + 2);

            if (message.startsWith("data: ")) {
              const jsonStr = message.replace(/^data: /, "");

              if (jsonStr === "[DONE]") {
                cleanup();
                resolve({ tools: toolsExtracted, text: fullText });
                return;
              }

              try {
                const parsed = JSON.parse(jsonStr);
                if (parsed.error) {
                  hasApiError = true;
                  cleanup();
                  reject(new Error(`Venice API Error: ${parsed.error.message || JSON.stringify(parsed.error)}`));
                  return;
                }

                const delta = parsed.choices?.[0]?.delta;
                if (delta?.content) {
                  const extracted = ToolCallParser.extract(delta.content);
                  if (extracted) {
                    toolsExtracted = extracted.tools;
                    fullText = extracted.text;
                  }
                  // Forward every chunk — turn_done will set the final clean text
                  onChunk(delta.content);
                }
              } catch {
                // Ignore parse errors for individual messages
              }
            }
            boundary = sseBuffer.indexOf("\n\n");
          }
        } catch (err: any) {
          console.error("Error processing stream chunk:", err.message);
        }
      });

      stream.on("end", () => {
        cleanup();
        if (!fullText && !toolsExtracted.length && totalData.trim()) {
          const errorMatch = totalData.match(/"error"\s*:\s*\{[^}]+"message"\s*:\s*"([^"]+)"/);
          if (errorMatch) {
            reject(new Error(`Venice API Error: ${errorMatch[1]}`));
            return;
          }
          const contentMatch = totalData.match(/"content"\s*:\s*"([^"]+)"/);
          if (contentMatch) fullText = contentMatch[1];
        }
        resolve({ tools: toolsExtracted, text: fullText });
      });

      stream.on("error", (err: any) => {
        cleanup();
        reject(new Error(`Stream error: ${err.message}`));
      });
    });
  }
}