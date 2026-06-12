import { ToolCallParser } from "./ToolCallParser";

export class StreamProcessor {
  static async process(
    stream: any,
    timeoutMs: number = 30000
  ): Promise<{ tools: any[]; text: string }> {
    let sseBuffer = "";
    let fullText = "";
    let toolsExtracted: any[] = [];
    let streamEnded = false;
    let totalData = ""; // Accumulate ALL data for fallback parsing
    let hasApiError = false; // Track if API returned an error

    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        if (!streamEnded) {
          console.warn("⚠️ Stream timeout - using accumulated data");
          // On timeout, try to parse whatever we accumulated
          if (hasApiError) {
            reject(new Error(`Venice API returned an error and then timed out`));
          } else {
            stream.destroy?.();
            resolve({
              tools: toolsExtracted,
              text: fullText,
            });
          }
        }
      }, timeoutMs);

      const cleanup = () => {
        clearTimeout(timeoutHandle);
        streamEnded = true;
      };

      stream.on("data", (chunk: Buffer) => {
        try {
          const text = chunk.toString();
          sseBuffer += text;
          totalData += text; // Keep full accumulated data for error detection

          // Split by SSE message boundaries (\n\n)
          let boundary = sseBuffer.indexOf("\n\n");

          while (boundary !== -1) {
            const message = sseBuffer.slice(0, boundary).trim();
            sseBuffer = sseBuffer.slice(boundary + 2);

            // Process SSE message
            if (message.startsWith("data: ")) {
              const jsonStr = message.replace(/^data: /, "");

              if (jsonStr === "[DONE]") {
                console.log("Stream finished.");
                cleanup();
                resolve({
                  tools: toolsExtracted,
                  text: fullText,
                });
                return;
              }

              try {
                const parsed = JSON.parse(jsonStr);

                // 🔴 DETECT API ERRORS
                if (parsed.error) {
                  hasApiError = true;
                  const errorMsg = parsed.error.message || JSON.stringify(parsed.error);
                  console.error(`\n❌ Venice API Error: ${errorMsg}`);
                  cleanup();
                  reject(new Error(`Venice API Error: ${errorMsg}`));
                  return;
                }

                const delta = parsed.choices?.[0]?.delta;

                if (delta?.content) {
                  // Try to extract tools from each individual chunk
                  const extracted = ToolCallParser.extract(delta.content);
                  if (extracted) {
                    toolsExtracted = extracted.tools;
                    fullText = extracted.text;
                  }
                }
              } catch (err) {
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

        // Fallback: if we got no tools/text but had data, try to parse the full accumulated content
        if (!fullText && !toolsExtracted.length && totalData.trim()) {
          // Check for error patterns in the raw accumulated data
          const errorMatch = totalData.match(/"error"\s*:\s*\{[^}]+"message"\s*:\s*"([^"]+)"/);
          if (errorMatch) {
            reject(new Error(`Venice API Error: ${errorMatch[1]}`));
            return;
          }
          
          // Try to find any useful content in the accumulated data
          const contentMatch = totalData.match(/"content"\s*:\s*"([^"]+)"/);
          if (contentMatch) {
            fullText = contentMatch[1];
          } else {
            // Log what we got for debugging
            console.warn("⚠️ Stream ended with no extractable content. Raw data sample:", 
              totalData.substring(0, 500));
          }
        }

        resolve({
          tools: toolsExtracted,
          text: fullText,
        });
      });

      stream.on("error", (err: any) => {
        cleanup();
        reject(new Error(`Stream error: ${err.message}`));
      });
    });
  }
}