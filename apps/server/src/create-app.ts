import express from "express";
import type { ErrorRequestHandler, Response } from "express";
import type { ConversationStreamEvent } from "@my-code-x/app-types";
import {
  createDefaultConversationViewRuntime,
  type ConversationViewRuntime
} from "./conversation-view/conversation-view-runtime";
import type { ServerConfig } from "./config";

export interface CreateAppInput {
  config: ServerConfig;
  conversationView?: ConversationViewRuntime;
}

type ApiErrorCode =
  | "conversation-not-found"
  | "empty-input"
  | "validation-failed"
  | "malformed-request"
  | "internal-error";

interface ApiErrorResponse {
  error: {
    code: ApiErrorCode;
    message: string;
  };
}

interface SendApiErrorInput {
  status: number;
  code: ApiErrorCode;
  message: string;
}

function errorResponse(input: ApiErrorResponse["error"]): ApiErrorResponse {
  return {
    error: input
  };
}

function sendApiError(res: Response, input: SendApiErrorInput): void {
  res.status(input.status).json(
    errorResponse({
      code: input.code,
      message: input.message
    })
  );
}

function sendConversationNotFound(res: Response): void {
  sendApiError(res, {
    status: 404,
    code: "conversation-not-found",
    message: "Conversation not found"
  });
}

function sendValidationFailed(res: Response, message: string): void {
  sendApiError(res, {
    status: 422,
    code: "validation-failed",
    message
  });
}

function sendEmptyInput(res: Response): void {
  sendApiError(res, {
    status: 422,
    code: "empty-input",
    message: "Input must not be empty"
  });
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

function formatSseEvent(event: ConversationStreamEvent): string {
  return `event: ${event.type}\nid: ${event.id}\ndata: ${JSON.stringify(event.data)}\n\n`;
}

function firstHeaderValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function firstQueryValue(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0];
  }

  return undefined;
}

type MarkdownSourceParseResult =
  | { kind: "Valid"; markdownSource: string }
  | { kind: "Missing" }
  | { kind: "NotString" };

function parseMarkdownSource(body: unknown): MarkdownSourceParseResult {
  if (typeof body !== "object" || body === null || !("markdownSource" in body)) {
    return { kind: "Missing" };
  }

  const markdownSource = (body as Record<string, unknown>).markdownSource;
  if (typeof markdownSource !== "string") {
    return { kind: "NotString" };
  }

  return {
    kind: "Valid",
    markdownSource
  };
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

export function createApp(input: CreateAppInput) {
  const app = express();
  const conversationView = input.conversationView ?? createDefaultConversationViewRuntime();

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

  app.get("/api/conversations/:conversationId/snapshot", (req, res) => {
    const result = conversationView.getSnapshot(req.params.conversationId);

    if (result.kind === "ConversationNotFound") {
      sendConversationNotFound(res);
      return;
    }

    res.json(result.snapshot);
  });

  app.get("/api/conversations/:conversationId/events", (req, res) => {
    const lastEventId = firstHeaderValue(req.headers["last-event-id"]);
    const queryCursor = firstQueryValue(req.query.after);
    const afterCursor = lastEventId ?? queryCursor;
    const result = conversationView.subscribeToEvents({
      conversationId: req.params.conversationId,
      ...(afterCursor === undefined ? {} : { afterCursor }),
      subscriber: {
        publish(event) {
          res.write(formatSseEvent(event));
        }
      }
    });

    if (result.kind === "ConversationNotFound") {
      sendConversationNotFound(res);
      return;
    }

    res.set({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive"
    });

    res.flushHeaders();

    req.on("close", () => {
      result.subscription.close();
    });
  });

  app.post("/api/conversations/:conversationId/inputs", async (req, res) => {
    const markdownSourceResult = parseMarkdownSource(req.body);

    if (markdownSourceResult.kind === "Missing") {
      sendValidationFailed(res, "markdownSource is required");
      return;
    }

    if (markdownSourceResult.kind === "NotString") {
      sendValidationFailed(res, "markdownSource must be a string");
      return;
    }

    const result = await conversationView.submitInput({
      conversationId: req.params.conversationId,
      markdownSource: markdownSourceResult.markdownSource
    });

    if (result.kind === "ConversationNotFound") {
      sendConversationNotFound(res);
      return;
    }

    if (result.kind === "EmptyInput") {
      sendEmptyInput(res);
      return;
    }

    res.json({
      outcome: "Accepted"
    });
  });

  app.use(apiErrorMiddleware);

  return app;
}
