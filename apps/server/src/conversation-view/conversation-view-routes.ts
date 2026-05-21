import { Router } from "express";
import { ok } from "../api-response";
import { getCurrentConversation } from "./get-current-conversation";

export function conversationViewRoutes() {
  const router = Router();

  router.get("/current", (_req, res) => {
    res.json(ok(getCurrentConversation()));
  });

  return router;
}
