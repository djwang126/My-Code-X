export type RuntimeSandboxMode = 'read-only' | 'workspace-write' | 'danger-full-access';

export interface RuntimeSettings {
  readonly model: string | null;
  readonly reasoningEffort: string | null;
  readonly approvalPolicy: string | null;
  readonly sandboxMode: RuntimeSandboxMode | null;
  readonly promptOverride: string | null;
}
