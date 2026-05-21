import { Router } from "express";
import { ok } from "../api-response";
import type { CodexThreadBrowser } from "../codex-thread-browser/codex-thread-browser";
import type { CodexConversationHistoryGateway } from "./codex-conversation-history-gateway";
import { getConversationView } from "./get-conversation-view";
import { getCurrentConversation } from "./get-current-conversation";
import { restoreConversation } from "./restore-conversation";

export interface ConversationViewRoutesInput {
  codexThreadBrowser: CodexThreadBrowser;
  codexConversationHistoryGateway: CodexConversationHistoryGateway;
  defaultCodexCwd: string;
}

export function conversationViewRoutes(input: ConversationViewRoutesInput) {
  const router = Router();

  router.get("/current", async (_req, res) => {
    const current = await getCurrentConversation({
      codexThreadBrowser: input.codexThreadBrowser,
      defaultCodexCwd: input.defaultCodexCwd
    });
    res.json(ok(current));
  });

  router.get("/threads/:threadId", async (req, res) => {
    const conversation = await getConversationView({
      codexThreadBrowser: input.codexThreadBrowser,
      threadId: req.params.threadId
    });
    res.json(ok(conversation));
  });

  router.post("/threads/:threadId/restore", async (req, res) => {
    const conversation = await restoreConversation({
      codexConversationHistoryGateway: input.codexConversationHistoryGateway,
      threadId: req.params.threadId
    });
    res.json(ok(conversation));
  });

  return router;
}
