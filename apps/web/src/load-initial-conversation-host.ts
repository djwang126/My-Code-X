import type { ConversationHostView, ConversationView } from "@my-code-x/app-types";
import type { RestoreConversationInput } from "./api-client";

export interface InitialConversationHostClient {
  getCurrentConversation: () => Promise<ConversationHostView>;
  restoreConversation: (
    input: RestoreConversationInput
  ) => Promise<ConversationView>;
}

export async function loadInitialConversationHost(
  client: InitialConversationHostClient
): Promise<ConversationHostView> {
  const conversationHost = await client.getCurrentConversation();

  if (conversationHost.kind === "noConversationTarget") {
    return conversationHost;
  }

  try {
    const conversation = await client.restoreConversation({
      threadId: conversationHost.threadId
    });

    return {
      ...conversationHost,
      conversation
    };
  } catch (error: unknown) {
    return {
      ...conversationHost,
      conversation: {
        ...conversationHost.conversation,
        pageState: {
          kind: "restoreFailed",
          message: errorMessage(error)
        }
      }
    };
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "内容恢复失败";
}
