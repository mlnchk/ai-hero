import { generateText } from "ai";
import { model } from "~/model";
import { SystemContext } from "~/system-context";

interface AnswerOptions {
  isFinal?: boolean;
}

export async function answerQuestion(
  ctx: SystemContext,
  options: AnswerOptions = {},
): Promise<string> {
  const { isFinal = false } = options;

  const systemPrompt = `You are a helpful AI assistant with access to real-time web search capabilities. The current date and time is ${new Date().toLocaleString()}.

Your job is to answer the user's question based on the information you have gathered from web searches and URL scraping.

${isFinal ? "IMPORTANT: We may not have all the information needed to answer the question completely, but you must make your best effort to provide a comprehensive answer based on what we have gathered. Be transparent about any limitations in the information available." : "Use the information gathered to provide a thorough and accurate answer."}

When answering:
1. Always format URLs as markdown links using the format [title](url)
2. Be thorough but concise in your responses
3. If you're unsure about something, acknowledge the uncertainty
4. When providing information, always include the source where you found it using markdown links
5. Never include raw URLs - always use markdown link format
6. Use the current date to provide context about how recent the information is

Here is the current context with all the information we have gathered:

${ctx.getQueryHistory()}

${ctx.getScrapeHistory()}

User's question: ${ctx.getInitialQuestion()}

Please provide a comprehensive answer based on the information above.`;

  const result = await generateText({
    model,
    prompt: systemPrompt,
  });

  return result.text;
}
