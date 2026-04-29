export type WorkspaceCommand = InspectWorkspaceCommand;

export interface InspectWorkspaceCommand {
  readonly kind: 'inspect-workspace';
  readonly workspace: string | null;
}

export interface WorkspaceSnapshot {
  readonly workspace: string | null;
  readonly available: boolean;
}

export interface WorkspaceService {
  inspect(input: WorkspaceCommand): Promise<WorkspaceSnapshot>;
}

export function createWorkspaceService(): WorkspaceService {
  return {
    async inspect(input: WorkspaceCommand): Promise<WorkspaceSnapshot> {
      return {
        workspace: input.workspace,
        available: Boolean(input.workspace),
      };
    },
  };
}
