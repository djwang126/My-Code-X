export interface CodexThreadBrowser {
  listThreads(input: ListCodexThreadsInput): Promise<CodexThreadListItem[]>;
  readThread(input: ReadCodexThreadInput): Promise<CodexThreadListItem | null>;
}

export interface ListCodexThreadsInput {
  cwd: string;
  limit: number;
}

export interface ReadCodexThreadInput {
  threadId: string;
}

export interface CodexThreadListItem {
  id: string;
  name: string | null;
  preview: string;
  cwd: string | null;
  updatedAt: number | null;
  status: CodexThreadStatus;
}

export type CodexThreadStatus =
  | { type: "notLoaded" }
  | { type: "idle" }
  | { type: "systemError"; message?: string }
  | { type: "active"; activeFlags: string[] }
  | { type: "unknown" };

export function createUnavailableCodexThreadBrowser(): CodexThreadBrowser {
  return {
    async listThreads() {
      return [];
    },
    async readThread() {
      return null;
    }
  };
}
