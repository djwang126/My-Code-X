import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import request from "supertest";
import type { ComposerAction, ThreadContext } from "@my-code-x/app-types";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { createApp } from "../create-app";
import type {
  CodexThreadBrowser,
  CodexThreadListItem,
  ListCodexThreadsInput,
  ReadCodexThreadInput
} from "../codex-thread-browser/codex-thread-browser";
import { createCodexAppServerThreadBrowser } from "../codex-thread-browser/codex-app-server-thread-browser";
import { createCodexAppServerConversationHistoryGateway } from "./codex-app-server-conversation-history-gateway";
import type {
  CodexConversationHistoryGateway,
  CodexRestoredThread,
  RestoreCodexThreadInput
} from "./codex-conversation-history-gateway";

let dataDir = "";
const defaultCodexCwd = "D:\\workspaces\\AI-Tools\\My-Code-X-C";

beforeEach(async () => {
  dataDir = await mkdtemp(path.join(tmpdir(), "my-code-x-data-"));
});

afterEach(async () => {
  await rm(dataDir, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 100
  });
});

describe("GET /api/conversation-view/current", () => {
  test("returns a no selected Thread state when the default Codex cwd scope has no Thread", async () => {
    const codexThreadBrowser = createTestCodexThreadBrowser([]);
    const app = createConversationTestApp(codexThreadBrowser);

    const response = await request(app).get("/api/conversation-view/current");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      data: {
        kind: "noConversationTarget"
      }
    });
    expect(codexThreadBrowser.requests).toEqual([
      {
        cwd: defaultCodexCwd,
        limit: 1
      }
    ]);
  });

  test("selects the first Thread from the default Codex cwd scope", async () => {
    const codexThreadBrowser = createTestCodexThreadBrowser([
      threadFixture({
        id: "thread-1",
        name: "Fix server tests",
        preview: "Fallback preview",
        cwd: "D:\\workspaces\\project-a",
        updatedAt: 1_779_364_800,
        status: { type: "idle" }
      }),
      threadFixture({
        id: "thread-2",
        name: "Other Thread",
        preview: "Other preview",
        cwd: "D:\\workspaces\\project-b",
        updatedAt: 1_779_328_700,
        status: { type: "notLoaded" }
      })
    ]);
    const app = createConversationTestApp(codexThreadBrowser);

    const response = await request(app).get("/api/conversation-view/current");

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.data.kind).toBe("conversationTargetSelected");
    expect(response.body.data.threadId).toBe("thread-1");
    expectEmptyConversationView({
      actual: response.body.data.conversation,
      thread: {
        threadId: "thread-1",
        title: "Fix server tests",
        cwd: "D:\\workspaces\\project-a",
        updatedAt: "2026-05-21T12:00:00.000Z",
        status: "idle"
      },
      action: {
        kind: "disabled",
        enabled: false,
        reason: "emptyDraft"
      }
    });
    expect(codexThreadBrowser.requests).toEqual([
      {
        cwd: defaultCodexCwd,
        limit: 1
      }
    ]);
  });

  test("returns Codex connection unavailable when the Codex app-server cannot start", async () => {
    const codexThreadBrowser = createCodexAppServerThreadBrowser({
      command: "my-code-x-missing-codex-command",
      requestTimeoutMs: 100
    });
    const app = createConversationTestApp(codexThreadBrowser);

    const response = await request(app).get("/api/conversation-view/current");

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      ok: false,
      error: {
        code: "CODEX_CONNECTION_UNAVAILABLE",
        message:
          "Codex app-server failed to start: spawn my-code-x-missing-codex-command ENOENT",
        retryable: true
      }
    });
  });
});

describe("GET /api/conversation-view/threads/:threadId", () => {
  test("returns THREAD_NOT_FOUND when the Thread is not visible or does not exist", async () => {
    const codexThreadBrowser = createTestCodexThreadBrowser([]);
    const app = createConversationTestApp(codexThreadBrowser);

    const response = await request(app).get("/api/conversation-view/threads/missing-thread");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      ok: false,
      error: {
        code: "THREAD_NOT_FOUND",
        message: "Thread not found",
        retryable: false,
        target: {
          threadId: "missing-thread"
        }
      }
    });
    expect(codexThreadBrowser.requests).toEqual([
      {
        threadId: "missing-thread"
      }
    ]);
  });

  test("returns an empty Conversation View projection for a known Thread", async () => {
    const codexThreadBrowser = createTestCodexThreadBrowser([
      threadFixture({
        id: "thread-1",
        name: "New Thread",
        preview: "",
        cwd: "D:\\workspaces\\AI-Tools\\My-Code-X-C",
        updatedAt: null,
        status: { type: "idle" }
      })
    ]);
    const app = createConversationTestApp(codexThreadBrowser);

    const response = await request(app).get("/api/conversation-view/threads/thread-1");

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expectEmptyConversationView({
      actual: response.body.data,
      thread: {
        threadId: "thread-1",
        title: "New Thread",
        cwd: "D:\\workspaces\\AI-Tools\\My-Code-X-C",
        updatedAt: null,
        status: "idle"
      },
      action: {
        kind: "disabled",
        enabled: false,
        reason: "emptyDraft"
      }
    });
    expect(codexThreadBrowser.requests).toEqual([
      {
        threadId: "thread-1"
      }
    ]);
  });

  test("returns the same empty projection through current and thread-scoped reads", async () => {
    const codexThreadBrowser = createTestCodexThreadBrowser([
      threadFixture({
        id: "thread-1",
        name: "Consistent Thread",
        preview: "Fallback preview",
        cwd: "D:\\workspaces\\AI-Tools\\My-Code-X-C",
        updatedAt: 1_779_364_800,
        status: { type: "idle" }
      })
    ]);
    const app = createConversationTestApp(codexThreadBrowser);

    const currentResponse = await request(app).get("/api/conversation-view/current");
    const threadResponse = await request(app).get("/api/conversation-view/threads/thread-1");

    expect(currentResponse.status).toBe(200);
    expect(threadResponse.status).toBe(200);
    expect(currentResponse.body.ok).toBe(true);
    expect(threadResponse.body.ok).toBe(true);
    expect(currentResponse.body.data.kind).toBe("conversationTargetSelected");
    expect(currentResponse.body.data.threadId).toBe("thread-1");
    expect(currentResponse.body.data.conversation.thread.threadId).toBe("thread-1");
    expect(threadResponse.body.data.thread.threadId).toBe("thread-1");
    expect(currentResponse.body.data.conversation).toEqual(threadResponse.body.data);
    expect(codexThreadBrowser.requests).toEqual([
      {
        cwd: defaultCodexCwd,
        limit: 1
      },
      {
        threadId: "thread-1"
      }
    ]);
  });

  test("disables composer for an active Thread when no reliable active turn id is available", async () => {
    const codexThreadBrowser = createTestCodexThreadBrowser([
      threadFixture({
        id: "thread-1",
        name: null,
        preview: "Run tests",
        cwd: "D:\\workspaces\\AI-Tools\\My-Code-X-C",
        updatedAt: null,
        status: {
          type: "active",
          activeFlags: []
        }
      })
    ]);
    const app = createConversationTestApp(codexThreadBrowser);

    const response = await request(app).get("/api/conversation-view/threads/thread-1");

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expectEmptyConversationView({
      actual: response.body.data,
      thread: {
        threadId: "thread-1",
        title: "Run tests",
        cwd: "D:\\workspaces\\AI-Tools\\My-Code-X-C",
        updatedAt: null,
        status: "unknown"
      },
      action: {
        kind: "disabled",
        enabled: false,
        reason: "unreliableTurnTarget"
      }
    });
  });

  test("preserves unknown Thread status as unknown", async () => {
    const codexThreadBrowser = createTestCodexThreadBrowser([
      threadFixture({
        id: "thread-1",
        name: "Future status Thread",
        preview: "",
        cwd: "D:\\workspaces\\AI-Tools\\My-Code-X-C",
        updatedAt: null,
        status: { type: "futureStatus" } as unknown as CodexThreadListItem["status"]
      })
    ]);
    const app = createConversationTestApp(codexThreadBrowser);

    const response = await request(app).get("/api/conversation-view/threads/thread-1");

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expectEmptyConversationView({
      actual: response.body.data,
      thread: {
        threadId: "thread-1",
        title: "Future status Thread",
        cwd: "D:\\workspaces\\AI-Tools\\My-Code-X-C",
        updatedAt: null,
        status: "unknown"
      },
      action: {
        kind: "disabled",
        enabled: false,
        reason: "unknown"
      }
    });
  });

  test("preserves unknown Thread status returned by Codex app-server as unknown", async () => {
    await writeCodexAppServerStub({
      thread: {
        id: "thread-1",
        name: "Future status Thread",
        preview: "",
        cwd: "D:\\workspaces\\AI-Tools\\My-Code-X-C",
        updatedAt: null,
        status: {
          type: "futureStatus"
        }
      }
    });
    const originalCwd = process.cwd();
    process.chdir(dataDir);
    const codexThreadBrowser = createCodexAppServerThreadBrowser({
      command: process.execPath,
      requestTimeoutMs: 1_000
    });
    const app = createConversationTestApp(codexThreadBrowser);

    try {
      const response = await request(app).get("/api/conversation-view/threads/thread-1");

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expectEmptyConversationView({
        actual: response.body.data,
        thread: {
          threadId: "thread-1",
          title: "Future status Thread",
          cwd: "D:\\workspaces\\AI-Tools\\My-Code-X-C",
          updatedAt: null,
          status: "unknown"
        },
        action: {
          kind: "disabled",
          enabled: false,
          reason: "unknown"
        }
      });
    } finally {
      process.chdir(originalCwd);
    }
  });

  test("preserves active Thread status returned by Codex app-server as an unreliable turn target", async () => {
    await writeCodexAppServerStub({
      thread: {
        id: "thread-1",
        name: "Active Thread",
        preview: "",
        cwd: "D:\\workspaces\\AI-Tools\\My-Code-X-C",
        updatedAt: null,
        status: {
          type: "active",
          activeFlags: []
        }
      }
    });
    const originalCwd = process.cwd();
    process.chdir(dataDir);
    const codexThreadBrowser = createCodexAppServerThreadBrowser({
      command: process.execPath,
      requestTimeoutMs: 1_000
    });
    const app = createConversationTestApp(codexThreadBrowser);

    try {
      const response = await request(app).get("/api/conversation-view/threads/thread-1");

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expectEmptyConversationView({
        actual: response.body.data,
        thread: {
          threadId: "thread-1",
          title: "Active Thread",
          cwd: "D:\\workspaces\\AI-Tools\\My-Code-X-C",
          updatedAt: null,
          status: "unknown"
        },
        action: {
          kind: "disabled",
          enabled: false,
          reason: "unreliableTurnTarget"
        }
      });
    } finally {
      process.chdir(originalCwd);
    }
  });

  test("does not expose systemError Thread context without a message", async () => {
    const codexThreadBrowser = createTestCodexThreadBrowser([
      threadFixture({
        id: "thread-1",
        name: "System error without message",
        preview: "",
        cwd: "D:\\workspaces\\AI-Tools\\My-Code-X-C",
        updatedAt: null,
        status: { type: "systemError" }
      })
    ]);
    const app = createConversationTestApp(codexThreadBrowser);

    const response = await request(app).get("/api/conversation-view/threads/thread-1");

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expectEmptyConversationView({
      actual: response.body.data,
      thread: {
        threadId: "thread-1",
        title: "System error without message",
        cwd: "D:\\workspaces\\AI-Tools\\My-Code-X-C",
        updatedAt: null,
        status: "unknown"
      },
      action: {
        kind: "disabled",
        enabled: false,
        reason: "unknown"
      }
    });
  });
});

describe("POST /api/conversation-view/threads/:threadId/restore", () => {
  test("returns THREAD_NOT_FOUND when the Thread is not visible or does not exist", async () => {
    const codexThreadBrowser = createTestCodexThreadBrowser([]);
    const codexConversationHistoryGateway =
      createTestCodexConversationHistoryGateway([]);
    const app = createConversationTestApp(
      codexThreadBrowser,
      codexConversationHistoryGateway
    );

    const response = await request(app).post(
      "/api/conversation-view/threads/missing-thread/restore"
    );

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      ok: false,
      error: {
        code: "THREAD_NOT_FOUND",
        message: "Thread not found",
        retryable: false,
        target: {
          threadId: "missing-thread"
        }
      }
    });
  });

  test("returns an empty Conversation View when restore succeeds without message history", async () => {
    const restoredThread = restoredThreadFixture({
      id: "thread-1",
      name: "Restored Thread",
      preview: "",
      cwd: "D:\\workspaces\\AI-Tools\\My-Code-X-C",
      updatedAt: null,
      status: { type: "idle" },
      turns: []
    });
    const codexThreadBrowser = createTestCodexThreadBrowser([]);
    const codexConversationHistoryGateway =
      createTestCodexConversationHistoryGateway([restoredThread]);
    const app = createConversationTestApp(
      codexThreadBrowser,
      codexConversationHistoryGateway
    );

    const response = await request(app).post(
      "/api/conversation-view/threads/thread-1/restore"
    );

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expectEmptyConversationView({
      actual: response.body.data,
      thread: {
        threadId: "thread-1",
        title: "Restored Thread",
        cwd: "D:\\workspaces\\AI-Tools\\My-Code-X-C",
        updatedAt: null,
        status: "idle"
      },
      action: {
        kind: "disabled",
        enabled: false,
        reason: "emptyDraft"
      }
    });
  });

  test("restores a Thread through Codex thread/resume with deliberate params", async () => {
    await writeCodexResumeStub({
      thread: {
        id: "thread-1",
        name: "Resume Thread",
        preview: "",
        cwd: "D:\\workspaces\\AI-Tools\\My-Code-X-C",
        updatedAt: null,
        status: {
          type: "idle"
        },
        turns: []
      }
    });
    const originalCwd = process.cwd();
    process.chdir(dataDir);
    const codexThreadBrowser = createTestCodexThreadBrowser([]);
    const codexConversationHistoryGateway =
      createCodexAppServerConversationHistoryGateway({
        command: process.execPath,
        requestTimeoutMs: 1_000
      });
    const app = createConversationTestApp(
      codexThreadBrowser,
      codexConversationHistoryGateway
    );

    try {
      const response = await request(app).post(
        "/api/conversation-view/threads/thread-1/restore"
      );

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.data.thread).toEqual({
        threadId: "thread-1",
        title: "Resume Thread",
        cwd: "D:\\workspaces\\AI-Tools\\My-Code-X-C",
        updatedAt: null,
        status: "idle"
      });
    } finally {
      process.chdir(originalCwd);
    }
  });

  test("restores user text input as a message timeline item", async () => {
    const restoredThread = restoredThreadFixture({
      id: "thread-1",
      turns: [
        {
          id: "turn-1",
          items: [
            {
              type: "userMessage",
              id: "user-item-1",
              content: [
                {
                  type: "text",
                  text: "Run the server tests"
                },
                {
                  type: "image",
                  url: "ignored-for-now"
                }
              ]
            }
          ]
        }
      ]
    });
    const codexThreadBrowser = createTestCodexThreadBrowser([]);
    const codexConversationHistoryGateway =
      createTestCodexConversationHistoryGateway([restoredThread]);
    const app = createConversationTestApp(
      codexThreadBrowser,
      codexConversationHistoryGateway
    );

    const response = await request(app).post(
      "/api/conversation-view/threads/thread-1/restore"
    );

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.data.timeline).toEqual([
      {
        id: "codexThreadItem(thread-1,turn-1,user-item-1)",
        turnId: "turn-1",
        occurredAt: null,
        status: "completed",
        kind: "message",
        message: {
          role: "user",
          text: "Run the server tests",
          markdown: true,
          copyText: "Run the server tests"
        }
      }
    ]);
  });

  test("restores agent text as a message timeline item", async () => {
    const restoredThread = restoredThreadFixture({
      id: "thread-1",
      turns: [
        {
          id: "turn-1",
          items: [
            {
              type: "agentMessage",
              id: "agent-item-1",
              text: "Tests completed.\n\n```txt\n15 passed\n```"
            }
          ]
        }
      ]
    });
    const codexThreadBrowser = createTestCodexThreadBrowser([]);
    const codexConversationHistoryGateway =
      createTestCodexConversationHistoryGateway([restoredThread]);
    const app = createConversationTestApp(
      codexThreadBrowser,
      codexConversationHistoryGateway
    );

    const response = await request(app).post(
      "/api/conversation-view/threads/thread-1/restore"
    );

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.data.timeline).toEqual([
      {
        id: "codexThreadItem(thread-1,turn-1,agent-item-1)",
        turnId: "turn-1",
        occurredAt: null,
        status: "completed",
        kind: "message",
        message: {
          role: "agent",
          text: "Tests completed.\n\n```txt\n15 passed\n```",
          markdown: true,
          copyText: "Tests completed.\n\n```txt\n15 passed\n```"
        }
      }
    ]);
  });

  test("returns restored message timeline in Codex history order", async () => {
    const restoredThread = restoredThreadFixture({
      id: "thread-1",
      turns: [
        {
          id: "turn-1",
          items: [
            {
              type: "agentMessage",
              id: "agent-item-1",
              text: "First item from Codex history"
            },
            {
              type: "userMessage",
              id: "user-item-1",
              content: [{ type: "text", text: "Second item from Codex history" }]
            }
          ]
        },
        {
          id: "turn-2",
          items: [
            {
              type: "userMessage",
              id: "user-item-2",
              content: [{ type: "text", text: "Third item from Codex history" }]
            }
          ]
        }
      ]
    });
    const codexThreadBrowser = createTestCodexThreadBrowser([]);
    const codexConversationHistoryGateway =
      createTestCodexConversationHistoryGateway([restoredThread]);
    const app = createConversationTestApp(
      codexThreadBrowser,
      codexConversationHistoryGateway
    );

    const response = await request(app).post(
      "/api/conversation-view/threads/thread-1/restore"
    );

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.data.timeline.map((item: { id: string }) => item.id)).toEqual([
      "codexThreadItem(thread-1,turn-1,agent-item-1)",
      "codexThreadItem(thread-1,turn-1,user-item-1)",
      "codexThreadItem(thread-1,turn-2,user-item-2)"
    ]);
  });

  test("keeps Thread projection and composer policy when restored history has messages", async () => {
    const restoredThread = restoredThreadFixture({
      id: "thread-1",
      name: "Not Loaded Thread",
      preview: "",
      cwd: "D:\\workspaces\\AI-Tools\\My-Code-X-C",
      updatedAt: null,
      status: { type: "notLoaded" },
      turns: [
        {
          id: "turn-1",
          items: [
            {
              type: "agentMessage",
              id: "agent-item-1",
              text: "Historical reply"
            }
          ]
        }
      ]
    });
    const codexThreadBrowser = createTestCodexThreadBrowser([]);
    const codexConversationHistoryGateway =
      createTestCodexConversationHistoryGateway([restoredThread]);
    const app = createConversationTestApp(
      codexThreadBrowser,
      codexConversationHistoryGateway
    );

    const response = await request(app).post(
      "/api/conversation-view/threads/thread-1/restore"
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      data: {
        thread: {
          threadId: "thread-1",
          title: "Not Loaded Thread",
          cwd: "D:\\workspaces\\AI-Tools\\My-Code-X-C",
          updatedAt: null,
          status: "notLoaded"
        },
        pageState: {
          kind: "ready"
        },
        timeline: [
          {
            id: "codexThreadItem(thread-1,turn-1,agent-item-1)",
            turnId: "turn-1",
            occurredAt: null,
            status: "completed",
            kind: "message",
            message: {
              role: "agent",
              text: "Historical reply",
              markdown: true,
              copyText: "Historical reply"
            }
          }
        ],
        composer: {
          threadId: "thread-1",
          draft: "",
          action: {
            kind: "disabled",
            enabled: false,
            reason: "unreliableThreadTarget"
          }
        },
        notices: [],
        sync: {
          connection: "unknown",
          freshness: "unknown",
          lastSyncedAt: null
        }
      }
    });
  });

  test("returns CODEX_PROTOCOL_ERROR when thread/resume response has no thread", async () => {
    await writeCodexResumeResultStub({ result: {} });
    const originalCwd = process.cwd();
    process.chdir(dataDir);
    const codexConversationHistoryGateway =
      createCodexAppServerConversationHistoryGateway({
        command: process.execPath,
        requestTimeoutMs: 1_000
      });
    const app = createConversationTestApp(
      createTestCodexThreadBrowser([]),
      codexConversationHistoryGateway
    );

    try {
      const response = await request(app).post(
        "/api/conversation-view/threads/thread-1/restore"
      );

      expect(response.status).toBe(502);
      expect(response.body).toEqual({
        ok: false,
        error: {
          code: "CODEX_PROTOCOL_ERROR",
          message: "Invalid Codex thread/resume response",
          retryable: false
        }
      });
    } finally {
      process.chdir(originalCwd);
    }
  });

  test("returns THREAD_NOT_FOUND when Codex resume cannot find a rollout", async () => {
    await writeCodexResumeErrorStub("no rollout found for thread id thread-1");
    const originalCwd = process.cwd();
    process.chdir(dataDir);
    const codexConversationHistoryGateway =
      createCodexAppServerConversationHistoryGateway({
        command: process.execPath,
        requestTimeoutMs: 1_000
      });
    const app = createConversationTestApp(
      createTestCodexThreadBrowser([]),
      codexConversationHistoryGateway
    );

    try {
      const response = await request(app).post(
        "/api/conversation-view/threads/thread-1/restore"
      );

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        ok: false,
        error: {
          code: "THREAD_NOT_FOUND",
          message: "Thread not found",
          retryable: false,
          target: {
            threadId: "thread-1"
          }
        }
      });
    } finally {
      process.chdir(originalCwd);
    }
  });

  test("returns CODEX_PROTOCOL_ERROR when restored turns are not an array", async () => {
    await writeCodexResumeStub({
      thread: {
        id: "thread-1",
        name: "Malformed Thread",
        preview: "",
        cwd: "D:\\workspaces\\AI-Tools\\My-Code-X-C",
        updatedAt: null,
        status: {
          type: "idle"
        },
        turns: "not-array"
      }
    });
    const originalCwd = process.cwd();
    process.chdir(dataDir);
    const codexConversationHistoryGateway =
      createCodexAppServerConversationHistoryGateway({
        command: process.execPath,
        requestTimeoutMs: 1_000
      });
    const app = createConversationTestApp(
      createTestCodexThreadBrowser([]),
      codexConversationHistoryGateway
    );

    try {
      const response = await request(app).post(
        "/api/conversation-view/threads/thread-1/restore"
      );

      expect(response.status).toBe(502);
      expect(response.body).toEqual({
        ok: false,
        error: {
          code: "CODEX_PROTOCOL_ERROR",
          message: "Invalid Codex thread/resume response",
          retryable: false
        }
      });
    } finally {
      process.chdir(originalCwd);
    }
  });

  test("returns CODEX_PROTOCOL_ERROR when a restored agent message has no text", async () => {
    await writeCodexResumeStub({
      thread: {
        id: "thread-1",
        name: "Malformed Thread",
        preview: "",
        cwd: "D:\\workspaces\\AI-Tools\\My-Code-X-C",
        updatedAt: null,
        status: {
          type: "idle"
        },
        turns: [
          {
            id: "turn-1",
            items: [
              {
                type: "agentMessage",
                id: "agent-item-1"
              }
            ]
          }
        ]
      }
    });
    const originalCwd = process.cwd();
    process.chdir(dataDir);
    const codexConversationHistoryGateway =
      createCodexAppServerConversationHistoryGateway({
        command: process.execPath,
        requestTimeoutMs: 1_000
      });
    const app = createConversationTestApp(
      createTestCodexThreadBrowser([]),
      codexConversationHistoryGateway
    );

    try {
      const response = await request(app).post(
        "/api/conversation-view/threads/thread-1/restore"
      );

      expect(response.status).toBe(502);
      expect(response.body).toEqual({
        ok: false,
        error: {
          code: "CODEX_PROTOCOL_ERROR",
          message: "Invalid Codex thread/resume agentMessage field: text",
          retryable: false
        }
      });
    } finally {
      process.chdir(originalCwd);
    }
  });
});

function createConversationTestApp(
  codexThreadBrowser: CodexThreadBrowser,
  codexConversationHistoryGateway?: CodexConversationHistoryGateway
) {
  const input: Parameters<typeof createApp>[0] = {
    config: {
      host: "127.0.0.1",
      port: 0,
      dataDir,
      defaultCodexCwd
    },
    codexThreadBrowser
  };

  if (codexConversationHistoryGateway) {
    input.codexConversationHistoryGateway = codexConversationHistoryGateway;
  }

  return createApp(input);
}

function threadFixture(input: Partial<CodexThreadListItem> = {}): CodexThreadListItem {
  return {
    id: "thread-1",
    name: "Thread",
    preview: "",
    cwd: defaultCodexCwd,
    updatedAt: null,
    status: { type: "idle" },
    ...input
  };
}

function restoredThreadFixture(
  input: Partial<CodexRestoredThread> = {}
): CodexRestoredThread {
  return {
    id: "thread-1",
    name: "Thread",
    preview: "",
    cwd: defaultCodexCwd,
    updatedAt: null,
    status: { type: "idle" },
    turns: [],
    ...input
  };
}

function expectEmptyConversationView(input: {
  actual: unknown;
  thread: ThreadContext;
  action: ComposerAction;
}) {
  expect(input.actual).toEqual({
    thread: input.thread,
    pageState: {
      kind: "empty"
    },
    timeline: [],
    composer: {
      threadId: input.thread.threadId,
      draft: "",
      action: input.action
    },
    notices: [],
    sync: {
      connection: "unknown",
      freshness: "unknown",
      lastSyncedAt: null
    }
  });
}

function createTestCodexThreadBrowser(threads: CodexThreadListItem[]) {
  const requests: Array<ListCodexThreadsInput | ReadCodexThreadInput> = [];

  const browser: CodexThreadBrowser & {
    requests: Array<ListCodexThreadsInput | ReadCodexThreadInput>;
  } = {
    requests,
    async listThreads(request) {
      requests.push(request);
      return threads;
    },
    async readThread(request) {
      requests.push(request);
      return threads.find((thread) => thread.id === request.threadId) ?? null;
    }
  };

  return browser;
}

function createTestCodexConversationHistoryGateway(
  threads: CodexRestoredThread[]
) {
  const requests: RestoreCodexThreadInput[] = [];

  const gateway: CodexConversationHistoryGateway & {
    requests: RestoreCodexThreadInput[];
  } = {
    requests,
    async restoreThread(request) {
      requests.push(request);
      return threads.find((thread) => thread.id === request.threadId) ?? null;
    }
  };

  return gateway;
}

async function writeCodexAppServerStub(input: { thread: unknown }) {
  const scriptPath = path.join(dataDir, "app-server");
  const script = `
const readline = require("node:readline");
const thread = ${JSON.stringify(input.thread)};
const rl = readline.createInterface({ input: process.stdin });

rl.on("line", (line) => {
  const message = JSON.parse(line);

  if (typeof message.id !== "number") {
    return;
  }

  if (message.method === "initialize") {
    console.log(JSON.stringify({ id: message.id, result: {} }));
    return;
  }

  if (message.method === "thread/read") {
    console.log(JSON.stringify({ id: message.id, result: { thread } }));
    return;
  }

  if (message.method === "thread/list") {
    console.log(JSON.stringify({ id: message.id, result: { data: [thread] } }));
    return;
  }

  console.log(JSON.stringify({ id: message.id, result: null }));
});
`;

  await writeFile(scriptPath, script);
}

async function writeCodexResumeErrorStub(message: string) {
  const scriptPath = path.join(dataDir, "app-server");
  const script = `
const readline = require("node:readline");
const errorMessage = ${JSON.stringify(message)};
const rl = readline.createInterface({ input: process.stdin });

function hasOnlyDeliberateResumeParams(params) {
  if (!params || typeof params !== "object") {
    return false;
  }

  const keys = Object.keys(params).sort();
  return JSON.stringify(keys) === JSON.stringify(["persistExtendedHistory", "threadId"]) &&
    params.threadId === "thread-1" &&
    params.persistExtendedHistory === true;
}

rl.on("line", (line) => {
  const message = JSON.parse(line);

  if (typeof message.id !== "number") {
    return;
  }

  if (message.method === "initialize") {
    console.log(JSON.stringify({ id: message.id, result: {} }));
    return;
  }

  if (message.method === "thread/resume") {
    if (!hasOnlyDeliberateResumeParams(message.params)) {
      console.log(JSON.stringify({
        id: message.id,
        error: { message: "unexpected resume params: " + JSON.stringify(message.params) }
      }));
      return;
    }

    console.log(JSON.stringify({ id: message.id, error: { message: errorMessage } }));
    return;
  }

  console.log(JSON.stringify({
    id: message.id,
    error: { message: "unexpected method: " + message.method }
  }));
});
`;

  await writeFile(scriptPath, script);
}

async function writeCodexResumeStub(input: { thread: unknown }) {
  await writeCodexResumeResultStub({
    result: {
      thread: input.thread
    }
  });
}

async function writeCodexResumeResultStub(input: { result: unknown }) {
  const scriptPath = path.join(dataDir, "app-server");
  const script = `
const readline = require("node:readline");
const result = ${JSON.stringify(input.result)};
const rl = readline.createInterface({ input: process.stdin });

function hasOnlyDeliberateResumeParams(params) {
  if (!params || typeof params !== "object") {
    return false;
  }

  const keys = Object.keys(params).sort();
  return JSON.stringify(keys) === JSON.stringify(["persistExtendedHistory", "threadId"]) &&
    params.threadId === "thread-1" &&
    params.persistExtendedHistory === true;
}

rl.on("line", (line) => {
  const message = JSON.parse(line);

  if (typeof message.id !== "number") {
    return;
  }

  if (message.method === "initialize") {
    console.log(JSON.stringify({ id: message.id, result: {} }));
    return;
  }

  if (message.method === "thread/resume") {
    if (!hasOnlyDeliberateResumeParams(message.params)) {
      console.log(JSON.stringify({
        id: message.id,
        error: { message: "unexpected resume params: " + JSON.stringify(message.params) }
      }));
      return;
    }

    console.log(JSON.stringify({ id: message.id, result }));
    return;
  }

  console.log(JSON.stringify({
    id: message.id,
    error: { message: "unexpected method: " + message.method }
  }));
});
`;

  await writeFile(scriptPath, script);
}
