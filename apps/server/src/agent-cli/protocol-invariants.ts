import type {
  AuthoritativeSnapshot,
  Classification,
  CliKind
} from "@my-code-x/app-types";

export interface AgentCliProtocolViolationDetails {
  cliKind: CliKind;
  nativeType: string | null;
  reason: string;
}

export class AgentCliProtocolViolationError extends Error {
  public readonly cliKind: CliKind;
  public readonly nativeType: string | null;
  public readonly code = "AGENT_CLI_PROTOCOL_VIOLATION";

  public constructor(details: AgentCliProtocolViolationDetails) {
    super(details.reason);
    this.name = "AgentCliProtocolViolationError";
    this.cliKind = details.cliKind;
    this.nativeType = details.nativeType;
  }
}

export interface MessageOrderViolationDetails {
  stableKey: string;
  previousSequence: number | null;
  nextSequence: number;
}

export class MessageOrderViolationError extends Error {
  public readonly stableKey: string;
  public readonly previousSequence: number | null;
  public readonly nextSequence: number;
  public readonly code = "MESSAGE_ORDER_VIOLATION";

  public constructor(details: MessageOrderViolationDetails) {
    super(
      `message ${details.stableKey} sequence ${details.nextSequence} is not after ${details.previousSequence}`
    );
    this.name = "MessageOrderViolationError";
    this.stableKey = details.stableKey;
    this.previousSequence = details.previousSequence;
    this.nextSequence = details.nextSequence;
  }
}

export interface ResumeCursorGapDetails {
  expectedPreviousCursor: string | null;
  actualPreviousCursor: string | null;
  nextCursor: string;
}

export class ResumeCursorGapError extends Error {
  public readonly expectedPreviousCursor: string | null;
  public readonly actualPreviousCursor: string | null;
  public readonly nextCursor: string;
  public readonly code = "RESUME_CURSOR_GAP";

  public constructor(details: ResumeCursorGapDetails) {
    super(
      `resume cursor ${details.actualPreviousCursor} does not continue from ${details.expectedPreviousCursor}`
    );
    this.name = "ResumeCursorGapError";
    this.expectedPreviousCursor = details.expectedPreviousCursor;
    this.actualPreviousCursor = details.actualPreviousCursor;
    this.nextCursor = details.nextCursor;
  }
}

export interface RecoveredConversationStillRunningDetails {
  turnId: string;
}

export class RecoveredConversationStillRunningError extends Error {
  public readonly turnId: string;
  public readonly code = "RECOVERED_CONVERSATION_STILL_RUNNING";

  public constructor(details: RecoveredConversationStillRunningDetails) {
    super(`recovered history contains running turn ${details.turnId}`);
    this.name = "RecoveredConversationStillRunningError";
    this.turnId = details.turnId;
  }
}

export interface StableKeyCheckInput {
  cliKind: CliKind;
  nativeType: string | null;
  stableKey: string | null | undefined;
}

export function requireStableKey(input: StableKeyCheckInput): string {
  if (input.stableKey !== undefined && input.stableKey !== null && input.stableKey !== "") {
    return input.stableKey;
  }

  throw new AgentCliProtocolViolationError({
    cliKind: input.cliKind,
    nativeType: input.nativeType,
    reason: "agent cli message is missing stableKey"
  });
}

export interface SequenceAppendInput {
  stableKey: string;
  previousSequence: number | null;
  nextSequence: number;
}

export function assertSequenceCanAppend(input: SequenceAppendInput): void {
  if (input.previousSequence === null) {
    return;
  }

  if (input.nextSequence > input.previousSequence) {
    return;
  }

  throw new MessageOrderViolationError(input);
}

export interface ResumeCursorContinuationInput {
  expectedPreviousCursor: string | null;
  actualPreviousCursor: string | null;
  nextCursor: string;
}

export function assertResumeCursorContinues(input: ResumeCursorContinuationInput): void {
  if (input.expectedPreviousCursor === input.actualPreviousCursor) {
    return;
  }

  throw new ResumeCursorGapError(input);
}

export function assertRecoveredSnapshotHasNoRunningTurns(
  snapshot: AuthoritativeSnapshot
): void {
  for (const turn of snapshot.turns) {
    if (turn.state !== "Ended") {
      throw new RecoveredConversationStillRunningError({ turnId: turn.turnId });
    }
  }
}

export type ClassificationDecision =
  | { kind: "Ignored" }
  | { kind: "Display"; classification: Classification };

export function shouldProjectClassifiedMessage(
  decision: ClassificationDecision
): boolean {
  return decision.kind === "Display";
}
