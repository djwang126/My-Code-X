import {
  type ConversationHostView,
  conversationHostViewResponseSchema
} from "@my-code-x/app-types";

export async function getCurrentConversation(): Promise<ConversationHostView> {
  const response = await fetch("/api/conversation-view/current");
  const raw = (await response.json()) as unknown;
  const parsed = conversationHostViewResponseSchema.parse(raw);

  if (!response.ok || !parsed.ok) {
    const message = parsed.ok
      ? "Conversation View request failed"
      : parsed.error.message;
    throw new Error(message);
  }

  return parsed.data;
}
