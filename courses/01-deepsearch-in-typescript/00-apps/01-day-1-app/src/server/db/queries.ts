import { eq, desc } from "drizzle-orm";
import type { Message } from "ai";

import { db } from "./index";
import { chats, messages, users } from "./schema";

export const upsertChat = async (opts: {
  userId: string;
  chatId: string;
  title: string;
  messages: Message[];
}) => {
  const { userId, chatId, title, messages: chatMessages } = opts;

  // First, verify the user exists
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user) {
    throw new Error("User not found");
  }

  // Check if chat exists and belongs to the user
  const existingChat = await db.query.chats.findFirst({
    where: eq(chats.id, chatId),
  });

  if (existingChat && existingChat.userId !== userId) {
    throw new Error("Chat does not belong to user");
  }

  // If chat exists, delete all existing messages
  if (existingChat) {
    await db.delete(messages).where(eq(messages.chatId, chatId));
  }

  // Insert or update the chat
  await db
    .insert(chats)
    .values({
      id: chatId,
      userId,
      title,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: chats.id,
      set: {
        title,
        updatedAt: new Date(),
      },
    });

  // Insert all messages
  if (chatMessages.length > 0) {
    const messageValues = chatMessages.map((msg, index) => ({
      chatId,
      role: msg.role,
      parts: msg.parts,
      order: index,
    }));

    await db.insert(messages).values(messageValues);
  }

  return { chatId };
};

export const getChat = async (opts: { userId: string; chatId: string }) => {
  const { userId, chatId } = opts;

  const chat = await db.query.chats.findFirst({
    where: eq(chats.id, chatId),
    with: {
      messages: {
        orderBy: [messages.order],
      },
    },
  });

  if (!chat) {
    return null;
  }

  if (chat.userId !== userId) {
    throw new Error("Chat does not belong to user");
  }

  // Convert database messages to AI SDK Message format
  const aiMessages: Message[] = chat.messages.map((msg) => {
    const parts = msg.parts as NonNullable<Message["parts"]>;
    const content = parts?.find((part) => part.type === "text")?.text ?? "";

    return {
      id: msg.id.toString(),
      role: msg.role as "user" | "assistant" | "system",
      content,
      parts,
    };
  });

  return {
    id: chat.id,
    title: chat.title,
    createdAt: chat.createdAt,
    updatedAt: chat.updatedAt,
    messages: aiMessages,
  };
};

export const getChats = async (opts: { userId: string }) => {
  const { userId } = opts;

  const userChats = await db.query.chats.findMany({
    where: eq(chats.userId, userId),
    orderBy: [desc(chats.updatedAt)],
  });

  return userChats.map((chat) => ({
    id: chat.id,
    title: chat.title,
    createdAt: chat.createdAt,
    updatedAt: chat.updatedAt,
  }));
};
