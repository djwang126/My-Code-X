import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { createApp } from "../create-app";
import type {
  CodexThreadBrowser,
  CodexThreadListItem,
  ListCodexThreadsInput
} from "./codex-thread-browser";

let dataDir = "";
const defaultCodexCwd = "D:\\workspaces\\AI-Tools\\My-Code-X-C";

beforeEach(async () => {
  dataDir = await mkdtemp(path.join(tmpdir(), "my-code-x-data-"));
});

afterEach(async () => {
  await rm(dataDir, { recursive: true, force: true });
});

describe("GET /api/conversation-view/current", () => {
  test("returns a no selected Thread state when the default Codex cwd scope has no Thread", async () => {
    const codexThreadBrowser = createTestCodexThreadBrowser([]);
    const app = createApp({
      config: {
        host: "127.0.0.1",
        port: 0,
        dataDir,
        defaultCodexCwd
      },
      codexThreadBrowser
    });

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
      {
        id: "thread-1",
        name: "Fix server tests",
        preview: "Fallback preview",
        cwd: "D:\\workspaces\\project-a",
        updatedAt: 1_779_364_800,
        status: { type: "idle" }
      },
      {
        id: "thread-2",
        name: "Other Thread",
        preview: "Other preview",
        cwd: "D:\\workspaces\\project-b",
        updatedAt: 1_779_328_700,
        status: { type: "notLoaded" }
      }
    ]);
    const app = createApp({
      config: {
        host: "127.0.0.1",
        port: 0,
        dataDir,
        defaultCodexCwd
      },
      codexThreadBrowser
    });

    const response = await request(app).get("/api/conversation-view/current");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      data: {
        kind: "conversationTargetSelected",
        threadId: "thread-1",
        conversation: {
          thread: {
            threadId: "thread-1",
            title: "Fix server tests",
            cwd: "D:\\workspaces\\project-a",
            updatedAt: "2026-05-21T12:00:00.000Z",
            status: "idle"
          },
          pageState: {
            kind: "empty"
          },
          timeline: [],
          composer: {
            threadId: "thread-1",
            draft: "",
            action: {
              kind: "disabled",
              enabled: false,
              reason: "emptyDraft"
            }
          },
          notices: [],
          sync: {
            connection: "unknown",
            freshness: "unknown",
            lastSyncedAt: null
          }
        }
      }
    });
    expect(codexThreadBrowser.requests).toEqual([
      {
        cwd: defaultCodexCwd,
        limit: 1
      }
    ]);
  });
});

function createTestCodexThreadBrowser(threads: CodexThreadListItem[]) {
  const requests: ListCodexThreadsInput[] = [];

  const browser: CodexThreadBrowser & { requests: ListCodexThreadsInput[] } = {
    requests,
    async listThreads(request) {
      requests.push(request);
      return threads;
    }
  };

  return browser;
}
