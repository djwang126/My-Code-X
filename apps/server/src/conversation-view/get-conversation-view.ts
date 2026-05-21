import type { ConversationView } from "@my-code-x/app-types";
import { AppError } from "../app-error";
import type { CodexThreadBrowser } from "../codex-thread-browser/codex-thread-browser";
import { createEmptyConversationView } from "./conversation-view-projector";

export interface GetConversationViewInput {
  codexThreadBrowser: CodexThreadBrowser;
  threadId: string;
}

export async function getConversationView(
  input: GetConversationViewInput
): Promise<ConversationView> {
  const thread = await input.codexThreadBrowser.readThread({
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

  return createEmptyConversationView(thread);
}
