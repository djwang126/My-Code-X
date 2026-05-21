import { access, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { constants } from "node:fs";
import { AppError } from "../app-error";

export interface ResolveWorkspacePathInput {
  cwd: string;
}

export async function resolveWorkspacePath(
  input: ResolveWorkspacePathInput
): Promise<string> {
  const cwd = input.cwd.trim();

  if (cwd.length === 0) {
    throw invalidWorkspacePath("Workspace cwd is required");
  }

  if (!path.isAbsolute(cwd)) {
    throw invalidWorkspacePath("Workspace cwd must be an absolute path");
  }

  let canonicalCwd: string;
  try {
    canonicalCwd = await realpath(cwd);
  } catch {
    throw invalidWorkspacePath("Workspace cwd does not exist");
  }

  const stats = await stat(canonicalCwd);
  if (!stats.isDirectory()) {
    throw invalidWorkspacePath("Workspace cwd must be a directory");
  }

  try {
    await access(canonicalCwd, constants.R_OK);
  } catch {
    throw invalidWorkspacePath("Workspace cwd is not readable");
  }

  return canonicalCwd;
}

function invalidWorkspacePath(message: string): AppError {
  return new AppError({
    code: "INVALID_WORKSPACE_PATH",
    message,
    status: 400,
    retryable: false,
    target: {
      field: "cwd"
    }
  });
}
