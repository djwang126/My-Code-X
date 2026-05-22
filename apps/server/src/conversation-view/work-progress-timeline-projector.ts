import type { DisplayDetail, TimelineItem } from "@my-code-x/app-types";
import {
  isCodexRestoredWorkProgressType,
  type CodexRestoredThreadItem,
  type CodexRestoredWorkProgressItem
} from "./codex-conversation-history-gateway";
import {
  payloadDisplayDetail,
  timelineStatusFromCodexStatus
} from "./timeline-display";
import { codexThreadItemTimelineId } from "./timeline-id";

export interface WorkProgressTimelineItemInput {
  threadId: string;
  turnId: string;
  item: CodexRestoredWorkProgressItem;
}

export function isRestoredWorkProgressItem(
  item: CodexRestoredThreadItem
): item is CodexRestoredWorkProgressItem {
  return (
    typeof item.id === "string" &&
    isCodexRestoredWorkProgressType(item.type)
  );
}

export function createWorkProgressTimelineItem(
  input: WorkProgressTimelineItemInput
): TimelineItem {
  const detail = workProgressDetail(input.item);
  const summary = workProgressSummary(detail.fields);

  return {
    id: codexThreadItemTimelineId({
      threadId: input.threadId,
      turnId: input.turnId,
      itemId: input.item.id
    }),
    turnId: input.turnId,
    occurredAt: null,
    status: timelineStatusFromCodexStatus(input.item.status),
    kind: "workProgress",
    workProgress: {
      sourceType: input.item.type,
      label: input.item.type,
      summary,
      detail
    }
  };
}

function workProgressDetail(item: CodexRestoredWorkProgressItem): DisplayDetail {
  return payloadDisplayDetail({
    payload: item,
    excludedKeys: ["id", "type"]
  });
}

function workProgressSummary(
  fields: DisplayDetail["fields"]
): string | null {
  const firstField = fields[0];
  if (!firstField) {
    return null;
  }

  return `${firstField.label}: ${firstField.value}`;
}
