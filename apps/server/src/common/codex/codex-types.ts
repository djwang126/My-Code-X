export type LooseRecord = Record<string, any>;

export type TimerHandle = ReturnType<typeof setTimeout> | number;

export interface RuntimeOption {
  value: string;
  label: string;
  description: string;
  [key: string]: any;
}

export interface RuntimeReasoningEffortOption extends RuntimeOption {
  reasoningEffort?: string;
}

export interface RuntimeModelOption extends RuntimeOption {
  reasoningEfforts?: RuntimeReasoningEffortOption[];
  defaultReasoningEffort?: string | null;
}

export interface CollaborationModePreset {
  kind: string;
  label: string;
  model?: string | null;
  reasoningEffort?: string | null;
  [key: string]: any;
}

export interface RuntimePreferences {
  model?: string;
  reasoningEffort?: string | null;
  reasoningSummary?: string | null;
  approvalPolicy?: string;
  sandboxMode?: string;
  modelContextWindow?: number | null;
  modelAutoCompactTokenLimit?: number | null;
  [key: string]: any;
}

export interface RuntimeSettings extends RuntimePreferences {
  promptOverride?: string | null;
}

export interface RuntimeOptions {
  models?: RuntimeModelOption[];
  reasoningSummaryOptions?: RuntimeOption[];
  approvalPolicies?: RuntimeOption[];
  sandboxModes?: RuntimeOption[];
  collaborationModes?: CollaborationModePreset[];
  promptOverrides?: RuntimeOption[];
  [key: string]: any;
}

export interface PromptOverrideOption extends RuntimeOption {}

export interface PromptOverrideSnapshot {
  options: PromptOverrideOption[];
  instructionsByPromptOverride: Map<string, string>;
}

export interface PromptOverrideResolver {
  discoverPromptOverrideOptions?: () => Promise<PromptOverrideOption[]>;
  resolvePromptOverride: (promptOverride: string) => Promise<string>;
}

export interface StartThreadResult {
  threadId: string;
}

export interface StartTurnResult {
  turn: LooseRecord;
}

export interface ResumeThreadResult extends LooseRecord {
  threadId?: string;
  latestTurn?: LooseRecord | null;
  collaborationModeKind?: string;
  threadName?: string;
  threadStatus?: any;
  threadStatusText?: string;
  tokenUsageText?: string;
  messages?: LooseRecord[];
  notices?: LooseRecord[];
  pendingRequests?: LooseRecord[];
  lastError?: LooseRecord | null;
}

export interface CodexGatewayLike {
  close(): Promise<void>;
  setNotificationHandler(nextHandler: (event: LooseRecord) => void): void;
  getPreferences?(): RuntimePreferences | LooseRecord;
  getOptions?(): RuntimeOptions | LooseRecord;
  getGatewayGeneration?(): number;
  hasActiveGateway?(): boolean;
  initialize?(): Promise<void>;
  startThread?(input?: LooseRecord): Promise<StartThreadResult | LooseRecord>;
  resumeThread?(input?: LooseRecord): Promise<ResumeThreadResult | LooseRecord>;
  listThreads?(input?: LooseRecord): Promise<LooseRecord>;
  setThreadName?(input?: LooseRecord): Promise<LooseRecord>;
  startTurn?(input?: LooseRecord): Promise<StartTurnResult | LooseRecord>;
  interruptTurn?(input?: LooseRecord): Promise<LooseRecord>;
  compactThread?(input?: LooseRecord): Promise<LooseRecord>;
  forkThread?(input?: LooseRecord): Promise<LooseRecord>;
  rollbackThread?(input?: LooseRecord): Promise<LooseRecord>;
  startReview?(input?: LooseRecord): Promise<LooseRecord>;
  respondToRequest?(input?: LooseRecord): Promise<LooseRecord>;
}

export interface CodexJsonlTransport {
  setNotificationHandler(nextHandler: (method: string, params?: LooseRecord) => void): void;
  setServerRequestHandler(nextHandler: (requestId: string, method: string, params?: LooseRecord) => void): void;
  sendRequest(method: string, params?: LooseRecord): Promise<LooseRecord>;
  sendServerRequestResponse(requestId: string, result?: LooseRecord): Promise<void>;
  sendNotification(method: string, params?: LooseRecord): Promise<void>;
  close(): Promise<void>;
}

export interface GatewayBootstrapData {
  collaborationModePresets: CollaborationModePreset[];
  runtimeOptions: RuntimeOptions | null;
  runtimePreferences: RuntimePreferences | null;
}

export interface GatewayState {
  getCollaborationModePreset(kind?: string): CollaborationModePreset | undefined;
  getOptions(): RuntimeOptions;
  getPreferences(): RuntimePreferences;
  getRuntimePreferencesOrDefault(createDefaultRuntimePreferences: () => RuntimePreferences): RuntimePreferences;
  handleNotification(event: LooseRecord): void;
  setBootstrapData(nextData: GatewayBootstrapData): void;
  setNotificationHandler(nextHandler: (event: LooseRecord) => void): void;
}

export interface IdleShutdownConfig {
  kind: string;
  idleTimeoutMs?: number;
}
