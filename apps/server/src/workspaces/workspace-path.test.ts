import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { AppError } from "../app-error";
import { resolveWorkspacePath } from "./workspace-path";

let rootDir = "";

beforeEach(async () => {
  rootDir = await mkdtemp(path.join(tmpdir(), "my-code-x-workspace-"));
});

afterEach(async () => {
  await rm(rootDir, { recursive: true, force: true });
});

describe("resolveWorkspacePath", () => {
  test("returns a stable canonical cwd for an absolute directory", async () => {
    const canonicalCwd = await resolveWorkspacePath({
      cwd: `  ${path.join(rootDir, ".")}  `
    });

    expect(canonicalCwd).toBe(await resolveWorkspacePath({ cwd: rootDir }));
  });

  test("rejects a relative cwd", async () => {
    await expect(
      resolveWorkspacePath({ cwd: "relative/project" })
    ).rejects.toMatchObject({
      name: "AppError",
      code: "INVALID_WORKSPACE_PATH",
      status: 400,
      retryable: false,
      target: {
        field: "cwd"
      }
    });
  });

  test("rejects a file path", async () => {
    const filePath = path.join(rootDir, "notes.txt");
    await writeFile(filePath, "not a directory", "utf8");

    await expect(resolveWorkspacePath({ cwd: filePath })).rejects.toBeInstanceOf(
      AppError
    );
    await expect(resolveWorkspacePath({ cwd: filePath })).rejects.toMatchObject({
      code: "INVALID_WORKSPACE_PATH",
      status: 400,
      retryable: false,
      target: {
        field: "cwd"
      }
    });
  });
});
