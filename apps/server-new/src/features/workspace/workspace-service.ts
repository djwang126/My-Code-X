export type WorkspaceCommand = unknown;
export type WorkspaceSnapshot = unknown;

export interface WorkspaceService {
  inspect(input: WorkspaceCommand): Promise<WorkspaceSnapshot>;
}

export function createWorkspaceService(): WorkspaceService {
  return {
    async inspect(input: WorkspaceCommand): Promise<WorkspaceSnapshot> {
      return input;
    },
  };
}