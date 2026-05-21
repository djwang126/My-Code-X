import {
  type ConversationView,
  type ConversationHostView,
  conversationHostViewResponseSchema,
  conversationViewResponseSchema
} from "@my-code-x/app-types";

export interface RestoreConversationInput {
  threadId: string;
  clientRequestId?: string;
}

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

export async function restoreConversation(
  input: RestoreConversationInput
): Promise<ConversationView> {
  const body =
    input.clientRequestId === undefined
      ? {}
      : { clientRequestId: input.clientRequestId };
  const response = await fetch(
    `/api/conversation-view/threads/${encodeURIComponent(input.threadId)}/restore`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }
  );
  const raw = (await response.json()) as unknown;
  const parsed = conversationViewResponseSchema.parse(raw);

  if (!response.ok || !parsed.ok) {
    const message = parsed.ok
      ? "Conversation restore request failed"
      : parsed.error.message;
    throw new Error(message);
  }

  return parsed.data;
}
