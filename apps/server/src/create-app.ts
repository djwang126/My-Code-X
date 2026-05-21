import express from "express";
import type { ServerConfig } from "./config";
import { ok } from "./api-response";
import { errorMiddleware } from "./error-middleware";
import { conversationViewRoutes } from "./conversation-view/conversation-view-routes";
import { createWorkspaceStore, type WorkspaceStore } from "./workspaces/workspace-store";
import { workspaceRoutes } from "./workspaces/workspace-routes";

export interface CreateAppInput {
  config: ServerConfig;
  workspaceStore?: WorkspaceStore;
}

export function createApp(input: CreateAppInput) {
  const app = express();
  const workspaceStore =
    input.workspaceStore ?? createWorkspaceStore({ dataDir: input.config.dataDir });

  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_req, res) => {
    res.json(ok({ status: "ok" as const }));
  });

  app.use("/api/conversation-view", conversationViewRoutes());
  app.use("/api/workspaces", workspaceRoutes({ workspaceStore }));
  app.use(errorMiddleware);

  return app;
}
