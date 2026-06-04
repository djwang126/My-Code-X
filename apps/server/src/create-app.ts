import express from "express";
import type { ErrorRequestHandler } from "express";
import type { ServerConfig } from "./config";

export interface CreateAppInput {
  config: ServerConfig;
}

type ApiErrorCode = "malformed-request" | "internal-error";

interface ApiErrorResponse {
  error: {
    code: ApiErrorCode;
    message: string;
  };
}

function errorResponse(input: ApiErrorResponse["error"]): ApiErrorResponse {
  return {
    error: input
  };
}

function isMalformedJsonError(error: unknown): boolean {
  return (
    error instanceof SyntaxError &&
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    error.status === 400
  );
}

const apiErrorMiddleware: ErrorRequestHandler = (error, _req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (isMalformedJsonError(error)) {
    res.status(400).json(
      errorResponse({
        code: "malformed-request",
        message: "Malformed request"
      })
    );
    return;
  }

  res.status(500).json(
    errorResponse({
      code: "internal-error",
      message: "Internal server error"
    })
  );
};

export function createApp(_input: CreateAppInput) {
  const app = express();

  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/walking-skeleton/events", (_req, res) => {
    res.set({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive"
    });

    res.flushHeaders();
    res.write('event: walking-skeleton.ready\nid: 1\ndata: {"status":"ready"}\n\n');
  });

  app.use(apiErrorMiddleware);

  return app;
}
