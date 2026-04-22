export type SessionPendingRequestQuestion = {
  id: string;
  header: string;
  question: string;
  options?: Array<{ label: string; description: string }>;
  isOther?: boolean;
  isSecret?: boolean;
};

export type SessionPendingRequestApprovalDecision =
  | 'accept'
  | 'acceptForSession'
  | 'decline'
  | 'cancel'
  | 'approved'
  | 'approved_for_session'
  | 'denied'
  | 'abort'
  | Record<string, unknown>;

export type SessionPendingRequest = {
  id: string;
  method: string;
  kind:
    | 'command_approval'
    | 'file_change_approval'
    | 'permissions_approval'
    | 'legacy_patch_approval'
    | 'legacy_command_approval'
    | 'user_input'
    | 'mcp_elicitation'
    | 'tool_call'
    | 'auth_refresh';
  threadId: string;
  turnId: string | null;
  itemId?: string;
  callId?: string;
  approvalId?: string;
  title: string;
  prompt: string;
  submitState: 'idle' | 'submitting';
  command?: string;
  cwd?: string;
  reason?: string | null;
  grantRoot?: string | null;
  commandActions?: unknown[];
  availableDecisions?: SessionPendingRequestApprovalDecision[];
  networkApprovalContext?: Record<string, unknown>;
  permissions?: Record<string, unknown>;
  fileChanges?: Record<string, unknown>;
  questions?: SessionPendingRequestQuestion[];
  serverName?: string;
  mode?: string;
  requestedSchema?: Record<string, unknown>;
  url?: string;
  elicitationId?: string;
  tool?: string;
  arguments?: unknown;
  previousAccountId?: string | null;
  raw?: Record<string, unknown>;
};
