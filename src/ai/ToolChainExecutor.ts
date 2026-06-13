import { CommandFactory } from "../commands/CommandFactory";

export class ToolChainExecutor {
  private userId: string;
  private onResult: (toolName: string, result: any) => void;

  constructor(
    userId: string,
    onResult: (toolName: string, result: any) => void
  ) {
    this.userId = userId;
    this.onResult = onResult;
  }

  async executeTools(
    tools: { tool: string; args: Record<string, any> }[],
  ): Promise<{ [key: string]: any }> {
    const results: { [key: string]: any } = {};

    for (const toolCall of tools) {
      const { tool, args } = toolCall;

      console.log(`\n🔧 Executing tool: ${tool}`);
      console.log(`   Args: ${JSON.stringify(args)}`);

      try {
        // Inject user_id into args if not present
        const enrichedArgs = { ...args };
        if (!enrichedArgs.user_id) {
          enrichedArgs.user_id = this.userId;
        }

        const command = CommandFactory.create({ tool, args: enrichedArgs });
        const result = await command.execute();
        
        this.onResult(tool, result);
        results[tool] = result;
      } catch (err: any) {
        console.error(`\n❌ Tool ${tool} failed:`, err.message);
        results[tool] = { error: err.message };
      }
    }

    return results;
  }
}