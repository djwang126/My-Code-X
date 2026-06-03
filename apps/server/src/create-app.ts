import express from "express";
import type { ServerConfig } from "./config";
import { ok } from "./api-response";
import { errorMiddleware } from "./error-middleware";

export interface CreateAppInput {
  config: ServerConfig;
}

export function createApp(_input: CreateAppInput) {
  const app = express();

  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_req, res) => {
    res.json(ok({ status: "ok" as const }));
  });

  app.use(errorMiddleware);

  return app;
}
