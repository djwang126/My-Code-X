import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  type AddWorkspaceRequest,
  type Workspace,
  workspaceListSchema
} from "@my-code-x/app-types";
import { AppError } from "../app-error";
import { resolveWorkspacePath } from "./workspace-path";

export interface WorkspaceStore {
  list(): Promise<Workspace[]>;
  add(input: AddWorkspaceRequest): Promise<Workspace>;
}

export interface CreateWorkspaceStoreInput {
  dataDir: string;
  now?: () => Date;
  createId?: () => string;
}

interface WorkspaceState {
  workspaces: Workspace[];
}

export function createWorkspaceStore(input: CreateWorkspaceStoreInput): WorkspaceStore {
  const stateFile = path.join(input.dataDir, "state.json");
  const now = input.now ?? (() => new Date());
  const createId = input.createId ?? (() => randomUUID());

  async function readState(): Promise<WorkspaceState> {
    try {
      const content = await readFile(stateFile, "utf8");
      const raw = JSON.parse(content) as unknown;
      const parsed = workspaceStateSchema(raw);
      return parsed;
    } catch (error) {
      if (isFileMissing(error)) {
        return { workspaces: [] };
      }

      throw new AppError({
        code: "STATE_READ_FAILED",
        message: "Failed to read My-Code-X state",
        status: 500,
        retryable: true
      });
    }
  }

  async function writeState(state: WorkspaceState): Promise<void> {
    try {
      await mkdir(input.dataDir, { recursive: true });
      const tempFile = `${stateFile}.${process.pid}.tmp`;
      const content = `${JSON.stringify(state, null, 2)}\n`;
      await writeFile(tempFile, content, "utf8");
      await rename(tempFile, stateFile);
    } catch {
      throw new AppError({
        code: "STATE_WRITE_FAILED",
        message: "Failed to write My-Code-X state",
        status: 500,
        retryable: true
      });
    }
  }

  return {
    async list() {
      const state = await readState();
      return state.workspaces;
    },

    async add(request) {
      const canonicalCwd = await resolveWorkspacePath({ cwd: request.cwd });
      const state = await readState();
      const duplicate = state.workspaces.find(
        (workspace) => workspace.canonicalCwd === canonicalCwd
      );

      if (duplicate) {
        throw new AppError({
          code: "DUPLICATE_WORKSPACE",
          message: "Workspace cwd already exists",
          status: 409,
          retryable: false,
          target: {
            field: "cwd"
          }
        });
      }

      const timestamp = now().toISOString();
      const workspace: Workspace = {
        id: createId(),
        name: displayNameForWorkspace({
          name: request.name,
          canonicalCwd
        }),
        canonicalCwd,
        createdAt: timestamp,
        updatedAt: timestamp
      };

      await writeState({
        workspaces: [...state.workspaces, workspace]
      });

      return workspace;
    }
  };
}

function workspaceStateSchema(raw: unknown): WorkspaceState {
  const result = workspaceListSchema.safeParse(
    typeof raw === "object" && raw !== null && "workspaces" in raw
      ? (raw as { workspaces: unknown }).workspaces
      : undefined
  );

  if (!result.success) {
    throw new Error("Invalid workspace state");
  }

  return {
    workspaces: result.data
  };
}

function displayNameForWorkspace(input: {
  name: string | undefined;
  canonicalCwd: string;
}): string {
  const name = input.name?.trim();
  if (name && name.length > 0) {
    return name;
  }

  return path.basename(input.canonicalCwd);
}

function isFileMissing(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}
