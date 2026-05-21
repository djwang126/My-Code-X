import type { ConversationHostView } from "@my-code-x/app-types";
import type { CodexThreadBrowser } from "./codex-thread-browser";
import { createEmptyConversationView } from "./empty-conversation-view";

export interface GetCurrentConversationInput {
  codexThreadBrowser: CodexThreadBrowser;
  defaultCodexCwd: string;
}

export async function getCurrentConversation(
  input: GetCurrentConversationInput
): Promise<ConversationHostView> {
  const threads = await input.codexThreadBrowser.listThreads({
    cwd: input.defaultCodexCwd,
    limit: 1
  });
  const firstThread = threads[0];

  if (firstThread) {
    return {
      kind: "conversationTargetSelected",
      threadId: firstThread.id,
      conversation: createEmptyConversationView(firstThread)
    };
  }

  return {
    kind: "noConversationTarget"
  };
}
