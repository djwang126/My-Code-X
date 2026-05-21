import express from "express";
import type { ServerConfig } from "./config";
import { ok } from "./api-response";
import { errorMiddleware } from "./error-middleware";
import { conversationViewRoutes } from "./conversation-view/conversation-view-routes";
import { createCodexAppServerThreadBrowser } from "./codex-thread-browser/codex-app-server-thread-browser";
import type { CodexThreadBrowser } from "./codex-thread-browser/codex-thread-browser";
import { createWorkspaceStore, type WorkspaceStore } from "./workspaces/workspace-store";
import { workspaceRoutes } from "./workspaces/workspace-routes";

export interface CreateAppInput {
  config: ServerConfig;
  workspaceStore?: WorkspaceStore;
  codexThreadBrowser?: CodexThreadBrowser;
}

export function createApp(input: CreateAppInput) {
  const app = express();
  const workspaceStore =
    input.workspaceStore ?? createWorkspaceStore({ dataDir: input.config.dataDir });
  const codexThreadBrowser =
    input.codexThreadBrowser ?? createCodexAppServerThreadBrowser();

  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_req, res) => {
    res.json(ok({ status: "ok" as const }));
  });

  app.use(
    "/api/conversation-view",
    conversationViewRoutes({
      codexThreadBrowser,
      defaultCodexCwd: input.config.defaultCodexCwd ?? process.cwd()
    })
  );
  app.use("/api/workspaces", workspaceRoutes({ workspaceStore }));
  app.use(errorMiddleware);

  return app;
}
