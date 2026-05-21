import { Router } from "express";
import { ok } from "../api-response";
import type { CodexThreadBrowser } from "./codex-thread-browser";
import { getCurrentConversation } from "./get-current-conversation";

export interface ConversationViewRoutesInput {
  codexThreadBrowser: CodexThreadBrowser;
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

  return router;
}
