import { AppError } from "../app-error";
import { withCodexAppServerClient } from "../codex-app-server/client";
import type {
  CodexConversationHistoryGateway
} from "./codex-conversation-history-gateway";
import { parseThreadResumeResponse } from "./codex-thread-resume-parser";

export interface CreateCodexAppServerConversationHistoryGatewayInput {
  command?: string;
  requestTimeoutMs?: number;
}

export function createCodexAppServerConversationHistoryGateway(
  input: CreateCodexAppServerConversationHistoryGatewayInput = {}
): CodexConversationHistoryGateway {
  const command = input.command ?? "codex";
  const requestTimeoutMs = input.requestTimeoutMs ?? 15_000;

  return {
    async restoreThread(request) {
      try {
        const result = await withCodexAppServerClient({
          command,
          requestTimeoutMs,
          run: (client) =>
            client.request("thread/resume", {
              threadId: request.threadId,
              persistExtendedHistory: true
            })
        });

        return parseThreadResumeResponse(result);
      } catch (error) {
        if (isThreadResumeNotFound(error)) {
          return null;
        }

        throw error;
      }
    }
  };
}

function isThreadResumeNotFound(error: unknown): boolean {
  if (!(error instanceof AppError) || error.code !== "CODEX_REQUEST_REJECTED") {
    return false;
  }

  return (
    error.message.startsWith("thread not loaded:") ||
    error.message.startsWith("invalid thread id:") ||
    error.message.startsWith("no rollout found for thread id ") ||
    error.message.startsWith("thread not found:")
  );
}
