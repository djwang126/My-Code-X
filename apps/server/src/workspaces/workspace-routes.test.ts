import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { createApp } from "../create-app";
import { createWorkspaceStore } from "./workspace-store";

const fixedTime = "2026-05-21T00:00:00.000Z";

let dataDir = "";
let workspaceDir = "";

beforeEach(async () => {
  dataDir = await mkdtemp(path.join(tmpdir(), "my-code-x-data-"));
  workspaceDir = await mkdtemp(path.join(tmpdir(), "my-code-x-project-"));
});

afterEach(async () => {
  await rm(dataDir, { recursive: true, force: true });
  await rm(workspaceDir, { recursive: true, force: true });
});

describe("workspace API", () => {
  test("adds a readable local directory and makes it retrievable", async () => {
    const app = createWorkspaceTestApp({ ids: ["workspace-1"] });

    const addResponse = await request(app)
      .post("/api/workspaces")
      .send({ cwd: workspaceDir, name: "" });

    expect(addResponse.status).toBe(201);
    expect(addResponse.body).toEqual({
      ok: true,
      data: {
        id: "workspace-1",
        name: path.basename(workspaceDir),
        canonicalCwd: workspaceDir,
        createdAt: fixedTime,
        updatedAt: fixedTime
      }
    });

    const listResponse = await request(app).get("/api/workspaces");

    expect(listResponse.status).toBe(200);
    expect(listResponse.body).toEqual({
      ok: true,
      data: [addResponse.body.data]
    });
  });

  test("rejects a missing workspace directory", async () => {
    const app = createWorkspaceTestApp({ ids: ["workspace-1"] });
    const missingDir = path.join(workspaceDir, "missing");

    const response = await request(app)
      .post("/api/workspaces")
      .send({ cwd: missingDir });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      ok: false,
      error: {
        code: "INVALID_WORKSPACE_PATH",
        message: "Workspace cwd does not exist",
        retryable: false,
        target: {
          field: "cwd"
        }
      }
    });
  });

  test("rejects the same canonical cwd twice", async () => {
    const app = createWorkspaceTestApp({
      ids: ["workspace-1", "workspace-2"]
    });

    const firstResponse = await request(app)
      .post("/api/workspaces")
      .send({ cwd: workspaceDir, name: "Project" });
    const duplicateResponse = await request(app)
      .post("/api/workspaces")
      .send({ cwd: path.join(workspaceDir, "."), name: "Project again" });

    expect(firstResponse.status).toBe(201);
    expect(duplicateResponse.status).toBe(409);
    expect(duplicateResponse.body).toEqual({
      ok: false,
      error: {
        code: "DUPLICATE_WORKSPACE",
        message: "Workspace cwd already exists",
        retryable: false,
        target: {
          field: "cwd"
        }
      }
    });
  });
});

function createWorkspaceTestApp(input: { ids: string[] }) {
  const ids = [...input.ids];
  const workspaceStore = createWorkspaceStore({
    dataDir,
    now: () => new Date(fixedTime),
    createId: () => {
      const id = ids.shift();
      if (!id) {
        throw new Error("Missing test workspace id");
      }
      return id;
    }
  });

  return createApp({
    config: {
      host: "127.0.0.1",
      port: 0,
      dataDir
    },
    workspaceStore
  });
}
