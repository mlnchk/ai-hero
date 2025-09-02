import type { StreamTextResult } from "ai";
import { runAgentLoop } from "~/run-agent-loop";

export async function streamFromDeepSearch(opts: {
  messages: any[];
  onFinish?: any;
  telemetry?: any;
}): Promise<StreamTextResult<{}, string>> {
  // Get the last user message
  const lastMessage = opts.messages[opts.messages.length - 1];
  if (!lastMessage || !lastMessage.content) {
    throw new Error("No valid message content found");
  }

  // Run the agent loop with the user's question
  return runAgentLoop(lastMessage.content);
}

export async function askDeepSearch(messages: any[]) {
  const result = await streamFromDeepSearch({
    messages,
    onFinish: () => {}, // just a stub
    telemetry: {
      isEnabled: false,
    },
  });

  // Consume the stream - without this,
  // the stream will never finish
  await result.consumeStream();

  return await result.text;
}
