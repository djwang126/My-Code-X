import type { CollaborationModeOption } from '../../../shared/lib/collaboration-mode';

export interface RuntimeSettings extends Record<string, unknown> {
  model: string;
  reasoningEffort: string | null;
  reasoningSummary?: string | null;
  approvalPolicy: string;
  sandboxMode: string;
  collaborationModeKind?: string | null;
  promptOverride?: string | null;
  modelContextWindow?: number | null;
  modelAutoCompactTokenLimit?: number | null;
}

export interface RuntimeOption {
  value: string;
  label: string;
  description?: string;
  unavailable?: boolean;
}

export interface RuntimeModelOption extends RuntimeOption {
  reasoningEfforts: RuntimeOption[];
  defaultReasoningEffort?: string | null;
}

export interface RuntimeOptions {
  models: RuntimeModelOption[];
  reasoningSummaryOptions: RuntimeOption[];
  approvalPolicies: RuntimeOption[];
  sandboxModes: RuntimeOption[];
  collaborationModes: CollaborationModeOption[];
  promptOverrides: RuntimeOption[];
}

export const OFFICIAL_MODEL_CONTEXT_WINDOW_MAX: Record<string, number> = {
  'gpt-5': 400000,
  'gpt-5-codex': 400000,
  'gpt-5-codex-mini': 400000,
  'gpt-5.1': 400000,
  'gpt-5.1-codex': 400000,
  'gpt-5.1-codex-max': 400000,
  'gpt-5.1-codex-mini': 400000,
  'gpt-5.2': 400000,
  'gpt-5.2-codex': 400000,
  'gpt-5.3-codex': 400000,
  'gpt-5.4': 1050000,
  'gpt-5.4-mini': 400000,
  'gpt-5.4-nano': 400000,
  'gpt-5.4-pro': 1050000,
  'gpt-oss-20b': 131072,
  'gpt-oss-120b': 131072,
};
