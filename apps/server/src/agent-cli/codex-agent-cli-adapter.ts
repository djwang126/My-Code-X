import type { EntryBody, Turn } from "@my-code-x/app-types";
import type {
  AgentCliHistory,
  AgentCliHistorySource,
  ClassificationResult,
  ClassifyAgentInformationInput,
  ContentRestoreOutcome,
  InterpretTurnSignalInput,
  RestoreAgentContentInput,
  TurnCompletionOutcome,
  TurnSignalInterpretation
} from "./agent-cli-ports";

export interface CreateCodexAgentCliAdapterInput {
  historySource: AgentCliHistorySource;
}

interface CodexUserMessage {
  type: "userMessage";
  id: string;
  content: Array<{ type: string; text?: string }>;
}

interface CodexAgentMessage {
  type: "agentMessage";
  id: string;
  text: string;
  phase: string | null;
}

type CodexWorkProgressType =
  | "reasoning"
  | "commandExecution"
  | "fileChange"
  | "mcpToolCall"
  | "dynamicToolCall"
  | "webSearch"
  | "collabAgentToolCall"
  | "imageView"
  | "imageGeneration";

interface CodexWorkProgressItem extends Record<string, unknown> {
  type: CodexWorkProgressType;
  id: string;
  status?: string;
}

interface CodexErrorNotification extends Record<string, unknown> {
  error: {
    message?: unknown;
  };
  turnId: string;
}

interface CodexTurnNotification extends Record<string, unknown> {
  turn: {
    id: string;
    status: string;
    startedAt: number | null;
    completedAt: number | null;
  };
}

interface CodexRestoredTurn extends Record<string, unknown> {
  id: string;
  status: string;
  startedAt: number | null;
  completedAt: number | null;
  items: Array<{
    id: string;
    type: string;
  }>;
}

interface CodexItemNotification extends Record<string, unknown> {
  item: {
    type: string;
    id: string;
  };
  turnId: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isCodexUserMessage(value: unknown): value is CodexUserMessage {
  return (
    isRecord(value) &&
    value.type === "userMessage" &&
    typeof value.id === "string" &&
    Array.isArray(value.content)
  );
}

function isCodexAgentMessage(value: unknown): value is CodexAgentMessage {
  return (
    isRecord(value) &&
    value.type === "agentMessage" &&
    typeof value.id === "string" &&
    typeof value.text === "string"
  );
}

function isCodexWorkProgressItem(value: unknown): value is CodexWorkProgressItem {
  return (
    isRecord(value) &&
    (value.type === "reasoning" ||
      value.type === "commandExecution" ||
      value.type === "fileChange" ||
      value.type === "mcpToolCall" ||
      value.type === "dynamicToolCall" ||
      value.type === "webSearch" ||
      value.type === "collabAgentToolCall" ||
      value.type === "imageView" ||
      value.type === "imageGeneration") &&
    typeof value.id === "string"
  );
}

function isCodexErrorNotification(value: unknown): value is CodexErrorNotification {
  return (
    isRecord(value) &&
    isRecord(value.error) &&
    typeof value.turnId === "string"
  );
}

function hasStableItemId(value: unknown): value is Record<string, unknown> & { id: string } {
  return isRecord(value) && typeof value.id === "string";
}

function isCodexTurnNotification(value: unknown): value is CodexTurnNotification {
  return (
    isRecord(value) &&
    isRecord(value.turn) &&
    typeof value.turn.id === "string" &&
    typeof value.turn.status === "string"
  );
}

function isCodexRestoredTurn(value: unknown): value is CodexRestoredTurn {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.status === "string" &&
    Array.isArray(value.items)
  );
}

function isHistoryEnvelope(value: AgentCliHistory): value is { items: unknown[]; turns?: unknown[] } {
  return isRecord(value) && Array.isArray(value.items);
}

function isCodexItemNotification(value: unknown): value is CodexItemNotification {
  return (
    isRecord(value) &&
    isRecord(value.item) &&
    typeof value.item.type === "string" &&
    typeof value.item.id === "string" &&
    typeof value.turnId === "string"
  );
}

function codexItemFromRaw(raw: unknown): unknown {
  if (isCodexItemNotification(raw)) {
    return raw.item;
  }

  return raw;
}

function unixSecondsToIso(seconds: number): string {
  return new Date(seconds * 1000).toISOString();
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

function codexUserMessageMarkdown(message: CodexUserMessage): string {
  return message.content
    .filter((item) => item.type === "text")
    .map((item) => item.text ?? "")
    .join("");
}

function codexAgentReplyStream(
  nativeMethod: string | undefined
): "InProgress" | "Completed" {
  // 0.2a finding: AgentReply stream state comes from the item lifecycle, not
  // agentMessage.phase. item/started -> still streaming; item/completed (and
  // the restore path, nativeMethod undefined) -> the reply is final.
  return nativeMethod === "item/started" ? "InProgress" : "Completed";
}

function codexTurnOutcome(status: string): TurnCompletionOutcome | null {
  if (status === "completed") {
    return "Completed";
  }

  if (status === "failed") {
    return "Failed";
  }

  if (status === "interrupted") {
    return "Interrupted";
  }

  return null;
}

function normalizeHistory(history: AgentCliHistory): { items: unknown[]; turns: unknown[] } {
  if (isHistoryEnvelope(history)) {
    return {
      items: history.items,
      turns: history.turns ?? []
    };
  }

  return {
    items: history,
    turns: []
  };
}

function firstItemIdByType(turn: CodexRestoredTurn, itemType: string): string | undefined {
  return turn.items.find((item) => item.type === itemType)?.id;
}

function lastItemIdByType(turn: CodexRestoredTurn, itemType: string): string | undefined {
  for (let index = turn.items.length - 1; index >= 0; index -= 1) {
    const item = turn.items[index];
    if (item === undefined) {
      continue;
    }

    if (item.type === itemType) {
      return item.id;
    }
  }

  return undefined;
}

function restoredCodexTurnToConversationTurn(rawTurn: unknown): Turn | null {
  if (!isCodexRestoredTurn(rawTurn) || typeof rawTurn.startedAt !== "number") {
    return null;
  }

  const firstUserInputRef = firstItemIdByType(rawTurn, "userMessage");
  if (firstUserInputRef === undefined) {
    return null;
  }

  if (rawTurn.status === "inProgress") {
    return {
      id: rawTurn.id,
      status: {
        kind: "InProgress",
        firstUserInputRef,
        userInputTime: unixSecondsToIso(rawTurn.startedAt)
      }
    };
  }

  if (typeof rawTurn.completedAt !== "number") {
    return null;
  }

  const lastAgentReplyRef = lastItemIdByType(rawTurn, "agentMessage") ?? null;

  if (rawTurn.status === "completed") {
    if (lastAgentReplyRef === null) {
      return null;
    }

    return {
      id: rawTurn.id,
      status: {
        kind: "Completed",
        firstUserInputRef,
        userInputTime: unixSecondsToIso(rawTurn.startedAt),
        lastAgentReplyRef,
        lastReplyCompletedTime: unixSecondsToIso(rawTurn.completedAt)
      }
    };
  }

  if (rawTurn.status === "failed") {
    return {
      id: rawTurn.id,
      status: {
        kind: "Failed",
        firstUserInputRef,
        userInputTime: unixSecondsToIso(rawTurn.startedAt),
        completedTime: unixSecondsToIso(rawTurn.completedAt),
        lastAgentReplyRef
      }
    };
  }

  if (rawTurn.status === "interrupted") {
    return {
      id: rawTurn.id,
      status: {
        kind: "Interrupted",
        firstUserInputRef,
        userInputTime: unixSecondsToIso(rawTurn.startedAt),
        completedTime: unixSecondsToIso(rawTurn.completedAt),
        lastAgentReplyRef
      }
    };
  }

  return null;
}

function codexTurnCompletedSignal(input: {
  turnId: string;
  outcome: TurnCompletionOutcome;
  completedAt: string;
  lastAgentReplyRef: string | null;
}): TurnSignalInterpretation {
  if (input.outcome === "Completed") {
    if (input.lastAgentReplyRef === null) {
      return { kind: "NoTurnSignal" };
    }

    return {
      kind: "TurnCompleted",
      turnId: input.turnId,
      outcome: "Completed",
      lastAgentReplyRef: input.lastAgentReplyRef,
      lastReplyCompletedTime: input.completedAt
    };
  }

  return {
    kind: "TurnCompleted",
    turnId: input.turnId,
    outcome: input.outcome,
    lastAgentReplyRef: input.lastAgentReplyRef,
    completedTime: input.completedAt
  };
}

export function createCodexAgentCliAdapter(input: CreateCodexAgentCliAdapterInput) {
  const pendingTurnStarts = new Map<string, { userInputTime: string }>();
  const pendingLastAgentReplies = new Map<string, { lastAgentReplyRef: string }>();
  const errorCountsByTurn = new Map<string, number>();

  return {
    classifyInformation(classifyInput: ClassifyAgentInformationInput): ClassificationResult {
      // Codex error notifications carry no item id; they always yield a Failure
      // entry regardless of routing key. Detected by shape on the params payload.
      if (isCodexErrorNotification(classifyInput.raw)) {
        const message =
          typeof classifyInput.raw.error.message === "string"
            ? classifyInput.raw.error.message
            : "Unknown error";

        const nextErrorCount = (errorCountsByTurn.get(classifyInput.raw.turnId) ?? 0) + 1;
        errorCountsByTurn.set(classifyInput.raw.turnId, nextErrorCount);

        return {
          entryId: `${classifyInput.raw.turnId}:error:${nextErrorCount}`,
          body: {
            kind: "Failure",
            message,
            detail: classifyInput.raw
          }
        };
      }

      // Live stream: only item lifecycle notifications can yield transcript
      // entries. turn/*, thread/*, *delta, tokenUsage, etc. are non-entry signals.
      // Restore path has no nativeMethod (raw is a bare item) and falls through.
      const method = classifyInput.nativeMethod;
      if (method !== undefined && method !== "item/started" && method !== "item/completed") {
        return null;
      }

      const rawItem = codexItemFromRaw(classifyInput.raw);

      if (isCodexUserMessage(rawItem)) {
        return {
          entryId: rawItem.id,
          body: {
            kind: "UserInput",
            markdown: codexUserMessageMarkdown(rawItem)
          }
        };
      }

      if (isCodexAgentMessage(rawItem)) {
        return {
          entryId: rawItem.id,
          body: {
            kind: "AgentReply",
            content: rawItem.text,
            stream: codexAgentReplyStream(method)
          }
        };
      }

      if (isCodexWorkProgressItem(rawItem)) {
        const body: EntryBody = {
          kind: "WorkProgress",
          nativeType: rawItem.type,
          detail: rawItem
        };

        if (typeof rawItem.status === "string") {
          body.nativeStatus = rawItem.status;
        }

        return {
          entryId: rawItem.id,
          body
        };
      }

      if (hasStableItemId(rawItem)) {
        const body: EntryBody = {
          kind: "Unrecognized",
          detail: rawItem
        };

        if (typeof rawItem.status === "string") {
          body.nativeStatus = rawItem.status;
        }

        return {
          entryId: rawItem.id,
          body
        };
      }

      // Not an entry and not content-like: a signal we do not surface.
      return null;
    },

    interpretTurnSignal(turnInput: InterpretTurnSignalInput): TurnSignalInterpretation {
      const method = turnInput.nativeMethod;

      // turn/started carries no user item reference (0.2a finding): stash the
      // start time and wait for the userMessage item to supply firstUserInputRef.
      if (
        (method === undefined || method === "turn/started") &&
        isCodexTurnNotification(turnInput.raw) &&
        turnInput.raw.turn.status === "inProgress" &&
        typeof turnInput.raw.turn.startedAt === "number"
      ) {
        pendingTurnStarts.set(turnInput.raw.turn.id, {
          userInputTime: unixSecondsToIso(turnInput.raw.turn.startedAt)
        });
        return { kind: "NoTurnSignal" };
      }

      if (
        (method === undefined || method === "turn/completed") &&
        isCodexTurnNotification(turnInput.raw) &&
        codexTurnOutcome(turnInput.raw.turn.status) !== null &&
        typeof turnInput.raw.turn.completedAt === "number"
      ) {
        const outcome = codexTurnOutcome(turnInput.raw.turn.status);
        if (outcome === null) {
          return { kind: "NoTurnSignal" };
        }

        const pending = pendingLastAgentReplies.get(turnInput.raw.turn.id);
        if (pending !== undefined) {
          pendingLastAgentReplies.delete(turnInput.raw.turn.id);
        }

        return codexTurnCompletedSignal({
          turnId: turnInput.raw.turn.id,
          outcome,
          completedAt: unixSecondsToIso(turnInput.raw.turn.completedAt),
          lastAgentReplyRef: pending?.lastAgentReplyRef ?? null
        });
      }

      // Item lifecycle: associate user/agent items with their turn. Use the
      // completed lifecycle point so the item is final (a started agentMessage
      // is empty and must not become lastAgentReplyRef).
      if (
        (method === undefined || method === "item/completed") &&
        isCodexItemNotification(turnInput.raw) &&
        turnInput.raw.item.type === "userMessage"
      ) {
        const pending = pendingTurnStarts.get(turnInput.raw.turnId);
        if (pending === undefined) {
          return { kind: "NoTurnSignal" };
        }

        pendingTurnStarts.delete(turnInput.raw.turnId);
        return {
          kind: "TurnStarted",
          turnId: turnInput.raw.turnId,
          firstUserInputRef: turnInput.raw.item.id,
          userInputTime: pending.userInputTime
        };
      }

      if (
        (method === undefined || method === "item/completed") &&
        isCodexItemNotification(turnInput.raw) &&
        turnInput.raw.item.type === "agentMessage"
      ) {
        pendingLastAgentReplies.set(turnInput.raw.turnId, {
          lastAgentReplyRef: turnInput.raw.item.id
        });
        return { kind: "NoTurnSignal" };
      }

      return { kind: "NoTurnSignal" };
    },

    async restoreContent(restoreInput: RestoreAgentContentInput): Promise<ContentRestoreOutcome> {
      let history: AgentCliHistory;
      try {
        history = await input.historySource.fetchHistory(restoreInput);
      } catch (error) {
        return {
          kind: "RestoreFailed",
          message: errorMessage(error)
        };
      }

      const { items, turns: rawTurns } = normalizeHistory(history);

      if (items.length === 0) {
        return { kind: "RestoredEmpty" };
      }

      const turns = rawTurns.flatMap((rawTurn) => {
        const turn = restoredCodexTurnToConversationTurn(rawTurn);
        return turn === null ? [] : [turn];
      });

      if (turns.length === 0) {
        return { kind: "Restored", items };
      }

      return { kind: "Restored", items, turns };
    }
  };
}
