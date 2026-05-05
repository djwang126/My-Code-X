import type { ClientWorkspaceListItemView } from '@my-code-x/contracts-new';

export interface WorkspaceAddSubmitInput {
  readonly cwd: string;
  readonly name: string;
}

export interface WorkspaceRenameSubmitInput {
  readonly item: ClientWorkspaceListItemView;
  readonly name: string;
}

export interface WorkspaceEditCwdSubmitInput {
  readonly item: ClientWorkspaceListItemView;
  readonly cwd: string;
}

export interface WorkspaceResumeThreadInput {
  readonly threadId: string;
  readonly current: boolean;
}
