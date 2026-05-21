import type { ConversationView } from "@my-code-x/app-types";
import { AppError } from "../app-error";
import type { CodexConversationHistoryGateway } from "./codex-conversation-history-gateway";
import { createRestoredConversationView } from "./conversation-view-projector";

export interface RestoreConversationInput {
  codexConversationHistoryGateway: CodexConversationHistoryGateway;
  threadId: string;
}

export async function restoreConversation(
  input: RestoreConversationInput
): Promise<ConversationView> {
  const thread = await input.codexConversationHistoryGateway.restoreThread({
    threadId: input.threadId
  });

  if (!thread) {
    throw new AppError({
      code: "THREAD_NOT_FOUND",
      message: "Thread not found",
      status: 404,
      retryable: false,
      target: {
        threadId: input.threadId
      }
    });
  }

  return createRestoredConversationView(thread);
}
