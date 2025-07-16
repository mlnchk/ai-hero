import type { Message } from "ai";
import { streamText, createDataStreamResponse } from "ai";
import { model } from "~/models";
import { auth } from "~/server/auth";
import { searchSerper } from "../../../serper";
import { z } from "zod";
import { db } from "~/server/db";
import { users, userRequests } from "~/server/db/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { checkAndRecordRateLimit } from "~/utils";

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

  const body = (await request.json()) as {
    messages: Array<Message>;
  };

  return createDataStreamResponse({
    execute: async (dataStream: any) => {
      const { messages } = body;

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
      });

      result.mergeIntoDataStream(dataStream);
    },
    onError: (e: any) => {
      console.error(e);
      return "Oops, an error occured!";
    },
  });
}
