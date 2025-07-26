import type { Message } from "ai";
import {
  streamText,
  createDataStreamResponse,
  appendResponseMessages,
} from "ai";
import { model } from "~/models";
import { auth } from "~/server/auth";
import { searchSerper } from "../../../serper";
import { z } from "zod";
import { db } from "~/server/db";
import { users } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { checkAndRecordRateLimit } from "~/utils";
import { upsertChat } from "~/server/db/queries";

export const maxDuration = 60;

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Fetch user from DB to check isAdmin
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.user.id));
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    await checkAndRecordRateLimit({
      db,
      userId: user.id,
      isAdmin: user.isAdmin,
    });
  } catch (err) {
    if (err instanceof Error && err.message === "RATE_LIMIT_EXCEEDED") {
      return new Response("Too Many Requests", { status: 429 });
    }
    throw err;
  }

  const { messages, chatId }: { messages: Message[]; chatId?: string } =
    await request.json();

  // Generate a chat ID if not provided
  const finalChatId = chatId ?? crypto.randomUUID();

  // Create a title from the first user message
  const firstUserMessage = messages.find((msg) => msg.role === "user");
  const title = firstUserMessage?.content?.slice(0, 100) ?? "New Chat";

  // Create the chat before starting the stream to protect against broken streams
  if (!chatId) {
    await upsertChat({
      userId: user.id,
      chatId: finalChatId,
      title,
      messages: messages,
    });
  }

  return createDataStreamResponse({
    execute: async (dataStream: any) => {
      // Send the new chat ID if this is a new chat
      if (!chatId) {
        dataStream.writeData({
          type: "NEW_CHAT_CREATED",
          chatId: finalChatId,
        });
      }

      const result = streamText({
        model,
        messages,
        system: `You are an AI assistant with access to a web search tool. Always use the searchWeb tool to answer questions. When citing sources, always format URLs as markdown links, e.g., [title](url). Always cite your sources with inline markdown links.`,
        tools: {
          searchWeb: {
            parameters: z.object({
              query: z.string().describe("The query to search the web for"),
            }),
            execute: async ({ query }, { abortSignal }) => {
              const results = await searchSerper(
                { q: query, num: 10 },
                abortSignal,
              );
              return results.organic.map((result) => ({
                title: result.title,
                link: result.link,
                snippet: result.snippet,
              }));
            },
          },
        },
        maxSteps: 10,
        onFinish({
          text: _text,
          finishReason: _finishReason,
          usage: _usage,
          response,
        }) {
          const responseMessages = response.messages;

          const updatedMessages = appendResponseMessages({
            messages, // from the POST body
            responseMessages,
          });

          // Save the updated messages to the database
          upsertChat({
            userId: user.id,
            chatId: finalChatId,
            title,
            messages: updatedMessages,
          }).catch((error) => {
            console.error("Failed to save chat:", error);
          });
        },
      });

      result.mergeIntoDataStream(dataStream);
    },
    onError: (e: any) => {
      console.error(e);
      return "Oops, an error occured!";
    },
  });
}
