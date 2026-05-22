import type { TimelineItem } from "@my-code-x/app-types";
import type { CodexRestoredUnknownThreadItem } from "./codex-conversation-history-gateway";
import {
  payloadDisplayDetail,
  timelineStatusFromCodexStatus
} from "./timeline-display";
import { codexThreadItemTimelineId } from "./timeline-id";

export interface UnknownTimelineItemInput {
  threadId: string;
  turnId: string;
  item: CodexRestoredUnknownThreadItem;
}

export function createUnknownTimelineItem(
  input: UnknownTimelineItemInput
): TimelineItem {
  return {
    id: codexThreadItemTimelineId({
      threadId: input.threadId,
      turnId: input.turnId,
      itemId: input.item.id
    }),
    turnId: input.turnId,
    occurredAt: null,
    status: timelineStatusFromCodexStatus(input.item.status),
    kind: "unknown",
    unknown: {
      sourceType: input.item.type,
      statusLabel: statusLabel(input.item.status),
      detail: unknownDetail(input.item)
    }
  };
}

function unknownDetail(item: CodexRestoredUnknownThreadItem) {
  return payloadDisplayDetail({
    payload: item,
    excludedKeys: ["id", "type"]
  });
}

function statusLabel(status: unknown): string | null {
  if (typeof status === "string") {
    return status;
  }

  return null;
}
