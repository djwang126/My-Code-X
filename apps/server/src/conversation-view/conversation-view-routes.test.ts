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
} from "./codex-thread-browser";
import { createCodexAppServerThreadBrowser } from "./codex-thread-browser";

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

function createConversationTestApp(codexThreadBrowser: CodexThreadBrowser) {
  return createApp({
    config: {
      host: "127.0.0.1",
      port: 0,
      dataDir,
      defaultCodexCwd
    },
    codexThreadBrowser
  });
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
