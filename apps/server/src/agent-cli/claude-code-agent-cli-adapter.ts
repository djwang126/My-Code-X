import { getSessionMessages } from "@anthropic-ai/claude-agent-sdk";
import type { GetSessionMessagesOptions, SessionMessage } from "@anthropic-ai/claude-agent-sdk";
import type { EntryBody } from "@my-code-x/app-types";
import type {
  AgentCliHistory,
  AgentCliHistorySource,
  ClassificationResult,
  ClassifyAgentInformationInput,
  ContentRestoreOutcome,
  InterpretTurnSignalInput,
  RestoreAgentContentInput,
  TurnSignalInterpretation
} from "./agent-cli-ports";

export interface CreateClaudeCodeAgentCliAdapterInput {
  historySource: AgentCliHistorySource;
}

export interface ClaudeCodeSessionReader {
  getSessionMessages(
    sessionId: string,
    options?: GetSessionMessagesOptions
  ): Promise<SessionMessage[]>;
}

export interface CreateClaudeCodeSdkHistorySourceInput {
  projectDir?: string;
  sessionReader?: ClaudeCodeSessionReader;
}

interface ClaudeUserMessage extends Record<string, unknown> {
  type: "user";
  uuid: string;
  session_id?: string;
  timestamp?: string;
  message: {
    content: unknown;
  };
}

interface ClaudeAssistantMessage extends Record<string, unknown> {
  type: "assistant";
  uuid: string;
  session_id?: string;
  message: {
    content: unknown;
  };
}

interface ClaudeToolProgressMessage extends Record<string, unknown> {
  type: "tool_progress";
  uuid: string;
  tool_name: string;
}

interface ClaudeStreamEventMessage extends Record<string, unknown> {
  type: "stream_event";
  uuid: string;
  event: Record<string, unknown>;
}

interface ClaudeResultErrorMessage extends Record<string, unknown> {
  type: "result";
  subtype:
    | "error_during_execution"
    | "error_max_turns"
    | "error_max_budget_usd"
    | "error_max_structured_output_retries";
  uuid: string;
  errors: unknown[];
}

interface ClaudeResultMessage extends Record<string, unknown> {
  type: "result";
  subtype: string;
  uuid: string;
  session_id: string;
  duration_ms: number;
}

interface ClaudePermissionDeniedMessage extends Record<string, unknown> {
  type: "system";
  subtype: "permission_denied";
  uuid: string;
  message: string;
}

interface ClaudeLocalUserSubmittedSignal extends Record<string, unknown> {
  source: "my-code-x";
  type: "localUserSubmitted";
  entryId: string;
  submittedAt: string;
}

interface ActiveClaudeTurn {
  turnId: string;
  firstUserInputRef: string;
  userInputTime: string;
  lastAgentReplyRef?: string;
}

interface ClaudeAssistantWorkProgressDescriptor {
  nativeType: string;
  nativeStatus?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function historyItems(history: AgentCliHistory): unknown[] {
  if (Array.isArray(history)) {
    return history;
  }

  return history.items;
}

function isClaudeUserMessage(value: unknown): value is ClaudeUserMessage {
  return (
    isRecord(value) &&
    value.type === "user" &&
    typeof value.uuid === "string" &&
    isRecord(value.message)
  );
}

function isClaudeAssistantMessage(value: unknown): value is ClaudeAssistantMessage {
  return (
    isRecord(value) &&
    value.type === "assistant" &&
    typeof value.uuid === "string" &&
    isRecord(value.message)
  );
}

function isClaudeToolProgressMessage(value: unknown): value is ClaudeToolProgressMessage {
  return (
    isRecord(value) &&
    value.type === "tool_progress" &&
    typeof value.uuid === "string" &&
    typeof value.tool_name === "string"
  );
}

function isClaudeStreamEventMessage(value: unknown): value is ClaudeStreamEventMessage {
  return (
    isRecord(value) &&
    value.type === "stream_event" &&
    typeof value.uuid === "string" &&
    isRecord(value.event)
  );
}

function isClaudeResultErrorMessage(value: unknown): value is ClaudeResultErrorMessage {
  return (
    isRecord(value) &&
    value.type === "result" &&
    (value.subtype === "error_during_execution" ||
      value.subtype === "error_max_turns" ||
      value.subtype === "error_max_budget_usd" ||
      value.subtype === "error_max_structured_output_retries") &&
    typeof value.uuid === "string" &&
    Array.isArray(value.errors)
  );
}

function isClaudeResultMessage(value: unknown): value is ClaudeResultMessage {
  return (
    isRecord(value) &&
    value.type === "result" &&
    typeof value.subtype === "string" &&
    typeof value.uuid === "string" &&
    typeof value.session_id === "string" &&
    typeof value.duration_ms === "number"
  );
}

function isClaudePermissionDeniedMessage(
  value: unknown
): value is ClaudePermissionDeniedMessage {
  return (
    isRecord(value) &&
    value.type === "system" &&
    value.subtype === "permission_denied" &&
    typeof value.uuid === "string" &&
    typeof value.message === "string"
  );
}

function isClaudeLocalUserSubmittedSignal(
  value: unknown
): value is ClaudeLocalUserSubmittedSignal {
  return (
    isRecord(value) &&
    value.source === "my-code-x" &&
    value.type === "localUserSubmitted" &&
    typeof value.entryId === "string" &&
    typeof value.submittedAt === "string"
  );
}

function isClaudeSystemMessage(
  value: unknown
): value is Record<string, unknown> & { type: "system" } {
  return isRecord(value) && value.type === "system";
}

function hasStableUuid(value: unknown): value is Record<string, unknown> & { uuid: string } {
  return isRecord(value) && typeof value.uuid === "string";
}

function claudeTextContent(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }

  if (!Array.isArray(content)) {
    return "";
  }

  return content
    .filter((block): block is { type: "text"; text: string } =>
      isRecord(block) && block.type === "text" && typeof block.text === "string"
    )
    .map((block) => block.text)
    .join("");
}

function hasClaudeTextBlock(content: unknown): boolean {
  if (typeof content === "string") {
    return content.length > 0;
  }

  return (
    Array.isArray(content) &&
    content.some(
      (block) => isRecord(block) && block.type === "text" && typeof block.text === "string"
    )
  );
}

function claudeToolResultStatus(content: unknown): string | undefined {
  if (!Array.isArray(content)) {
    return undefined;
  }

  const toolResultBlock = content.find(
    (block) => isRecord(block) && block.type === "tool_result"
  );
  if (!isRecord(toolResultBlock)) {
    return undefined;
  }

  return typeof toolResultBlock.tool_use_id === "string"
    ? toolResultBlock.tool_use_id
    : "tool_result";
}

function claudeAssistantWorkProgressDescriptor(
  content: unknown
): ClaudeAssistantWorkProgressDescriptor {
  if (!Array.isArray(content)) {
    return { nativeType: "assistant.non_text" };
  }

  const blocks = content.filter(isRecord);
  const firstNonThinkingBlock = blocks.find(
    (block) => block.type !== "thinking" && block.type !== "redacted_thinking"
  );

  if (firstNonThinkingBlock === undefined) {
    return { nativeType: "assistant.thinking" };
  }

  if (typeof firstNonThinkingBlock.type !== "string") {
    return { nativeType: "assistant.non_text" };
  }

  const nativeType = `assistant.${firstNonThinkingBlock.type}`;
  if (typeof firstNonThinkingBlock.name !== "string") {
    return { nativeType };
  }

  return {
    nativeType,
    nativeStatus: firstNonThinkingBlock.name
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

export function createClaudeCodeAgentCliAdapter(input: CreateClaudeCodeAgentCliAdapterInput) {
  const activeTurnsByConversation = new Map<string, ActiveClaudeTurn>();

  return {
    classifyInformation(classifyInput: ClassifyAgentInformationInput): ClassificationResult {
      if (isClaudeUserMessage(classifyInput.raw)) {
        const toolResultStatus = claudeToolResultStatus(classifyInput.raw.message.content);
        if (toolResultStatus !== undefined) {
          return {
            entryId: classifyInput.raw.uuid,
            body: {
              kind: "WorkProgress",
              nativeType: "user.tool_result",
              nativeStatus: toolResultStatus,
              detail: classifyInput.raw
            }
          };
        }

        return {
          entryId: classifyInput.raw.uuid,
          body: {
            kind: "UserInput",
            markdown: claudeTextContent(classifyInput.raw.message.content)
          }
        };
      }

      if (isClaudeAssistantMessage(classifyInput.raw)) {
        if (!hasClaudeTextBlock(classifyInput.raw.message.content)) {
          const descriptor = claudeAssistantWorkProgressDescriptor(
            classifyInput.raw.message.content
          );
          const body: EntryBody = {
            kind: "WorkProgress",
            nativeType: descriptor.nativeType,
            detail: classifyInput.raw
          };

          if (descriptor.nativeStatus !== undefined) {
            body.nativeStatus = descriptor.nativeStatus;
          }

          return {
            entryId: classifyInput.raw.uuid,
            body
          };
        }

        return {
          entryId: classifyInput.raw.uuid,
          body: {
            kind: "AgentReply",
            content: claudeTextContent(classifyInput.raw.message.content),
            stream: "Completed"
          }
        };
      }

      if (isClaudeToolProgressMessage(classifyInput.raw)) {
        return {
          entryId: classifyInput.raw.uuid,
          body: {
            kind: "WorkProgress",
            nativeType: classifyInput.raw.type,
            nativeStatus: classifyInput.raw.tool_name,
            detail: classifyInput.raw
          }
        };
      }

      if (isClaudeResultErrorMessage(classifyInput.raw)) {
        const [firstError] = classifyInput.raw.errors;
        return {
          entryId: classifyInput.raw.uuid,
          body: {
            kind: "Failure",
            message: typeof firstError === "string" ? firstError : "Unknown error",
            detail: classifyInput.raw
          }
        };
      }

      if (isClaudePermissionDeniedMessage(classifyInput.raw)) {
        return {
          entryId: classifyInput.raw.uuid,
          body: {
            kind: "Failure",
            message: classifyInput.raw.message,
            detail: classifyInput.raw
          }
        };
      }

      // Known non-entry signals must not reach the transcript (INV-4 keeps
      // Unrecognized for content-like messages only).
      // - stream_event: partial streaming deltas, superseded by the final message
      // - result (success): turn completion signal, consumed by interpretTurnSignal
      // - system (init/status/...): session lifecycle, not conversation content
      if (
        isClaudeStreamEventMessage(classifyInput.raw) ||
        isClaudeResultMessage(classifyInput.raw) ||
        isClaudeSystemMessage(classifyInput.raw)
      ) {
        return null;
      }

      if (hasStableUuid(classifyInput.raw)) {
        return {
          entryId: classifyInput.raw.uuid,
          body: {
            kind: "Unrecognized",
            detail: classifyInput.raw
          }
        };
      }

      // Not content and not a recognized signal: surface nothing.
      return null;
    },

    interpretTurnSignal(turnInput: InterpretTurnSignalInput): TurnSignalInterpretation {
      if (isClaudeLocalUserSubmittedSignal(turnInput.raw)) {
        const turnId = `${turnInput.conversationId}:turn:${turnInput.raw.entryId}`;
        activeTurnsByConversation.set(turnInput.conversationId, {
          turnId,
          firstUserInputRef: turnInput.raw.entryId,
          userInputTime: turnInput.raw.submittedAt
        });

        return {
          kind: "TurnStarted",
          turnId,
          firstUserInputRef: turnInput.raw.entryId,
          userInputTime: turnInput.raw.submittedAt
        };
      }

      if (
        isClaudeUserMessage(turnInput.raw) &&
        typeof turnInput.raw.timestamp === "string"
      ) {
        const turnId = `${turnInput.conversationId}:turn:${turnInput.raw.uuid}`;
        activeTurnsByConversation.set(turnInput.conversationId, {
          turnId,
          firstUserInputRef: turnInput.raw.uuid,
          userInputTime: turnInput.raw.timestamp
        });

        return {
          kind: "TurnStarted",
          turnId,
          firstUserInputRef: turnInput.raw.uuid,
          userInputTime: turnInput.raw.timestamp
        };
      }

      const activeTurn = activeTurnsByConversation.get(turnInput.conversationId);

      if (isClaudeAssistantMessage(turnInput.raw) && activeTurn !== undefined) {
        activeTurn.lastAgentReplyRef = turnInput.raw.uuid;
        return { kind: "NoTurnSignal" };
      }

      if (isClaudeResultMessage(turnInput.raw) && activeTurn !== undefined) {
        const completedTurn = activeTurn;
        activeTurnsByConversation.delete(turnInput.conversationId);
        const completedAt = new Date(
          new Date(completedTurn.userInputTime).getTime() + turnInput.raw.duration_ms
        ).toISOString();

        if (turnInput.raw.subtype === "success") {
          if (completedTurn.lastAgentReplyRef === undefined) {
            return { kind: "NoTurnSignal" };
          }

          return {
            kind: "TurnCompleted",
            turnId: completedTurn.turnId,
            outcome: "Completed",
            lastAgentReplyRef: completedTurn.lastAgentReplyRef,
            lastReplyCompletedTime: completedAt
          };
        }

        const completed: TurnSignalInterpretation = {
          kind: "TurnCompleted",
          turnId: completedTurn.turnId,
          outcome: "Failed",
          lastAgentReplyRef: completedTurn.lastAgentReplyRef ?? null,
          completedTime: completedAt
        };

        return completed;
      }

      return { kind: "NoTurnSignal" };
    },

    async restoreContent(restoreInput: RestoreAgentContentInput): Promise<ContentRestoreOutcome> {
      let items: unknown[];
      try {
        items = historyItems(await input.historySource.fetchHistory(restoreInput));
      } catch (error) {
        return {
          kind: "RestoreFailed",
          message: errorMessage(error)
        };
      }

      if (items.length === 0) {
        return { kind: "RestoredEmpty" };
      }

      return { kind: "Restored", items };
    }
  };
}

export function createClaudeCodeSdkHistorySource(
  input: CreateClaudeCodeSdkHistorySourceInput = {}
): AgentCliHistorySource {
  const sessionReader = input.sessionReader ?? { getSessionMessages };

  return {
    fetchHistory: async (restoreInput) =>
      sessionReader.getSessionMessages(restoreInput.conversationId, {
        ...(input.projectDir === undefined ? {} : { dir: input.projectDir })
      })
  };
}
