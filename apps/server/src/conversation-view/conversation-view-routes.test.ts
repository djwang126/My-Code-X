import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { createApp } from "../create-app";

let dataDir = "";

beforeEach(async () => {
  dataDir = await mkdtemp(path.join(tmpdir(), "my-code-x-data-"));
});

afterEach(async () => {
  await rm(dataDir, { recursive: true, force: true });
});

describe("GET /api/conversation-view/current", () => {
  test("returns a no selected Thread state", async () => {
    const app = createApp({
      config: {
        host: "127.0.0.1",
        port: 0,
        dataDir
      }
    });

    const response = await request(app).get("/api/conversation-view/current");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      data: {
        kind: "noConversationTarget"
      }
    });
  });
});
