export type WorkspaceThreadEntry = {
  id: string;
  name: string;
  preview: string;
  workspace: string;
  createdAt: number;
  updatedAt: number;
  statusText: string;
};

export type WorkspaceThreadsPayload = {
  data: WorkspaceThreadEntry[];
};
