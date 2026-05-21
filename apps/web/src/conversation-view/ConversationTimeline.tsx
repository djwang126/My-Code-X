import type { TimelineItem } from "@my-code-x/app-types";
import { CopyButton } from "./CopyButton";
import { DisplayDetailFields } from "./DisplayDetailFields";
import { MessageBody } from "./MessageBody";

interface ConversationTimelineProps {
  items: TimelineItem[];
}

type MessageTimelineItem = Extract<TimelineItem, { kind: "message" }>;
type TimelineStatus = TimelineItem["status"];
type WorkProgressTimelineItem = Extract<TimelineItem, { kind: "workProgress" }>;

const timelineStatusLabels: Record<TimelineStatus, string> = {
  inProgress: "进行中",
  completed: "完成",
  failed: "失败",
  declined: "已拒绝",
  unknown: "状态未知"
};

export function ConversationTimeline({ items }: ConversationTimelineProps) {
  return (
    <div className="conversation-timeline" aria-label="Timeline">
      <ol className="timeline-list">
        {items.map((item) => (
          <TimelineEntry item={item} key={item.id} />
        ))}
      </ol>
    </div>
  );
}

function TimelineEntry({ item }: { item: TimelineItem }) {
  if (item.kind === "message") {
    return <MessageTimelineEntry item={item} />;
  }

  if (item.kind === "workProgress") {
    return <WorkProgressTimelineEntry item={item} />;
  }

  return null;
}

function MessageTimelineEntry({ item }: { item: MessageTimelineItem }) {
  const isUserMessage = item.message.role === "user";
  const rowClassName = isUserMessage
    ? "transcript-row message-row user-message-row"
    : "transcript-row message-row";
  const textClassName = isUserMessage
    ? "message-text message-text--user"
    : "message-text";
  const roleLabel = isUserMessage ? "用户消息" : "Codex 消息";

  return (
    <li className={rowClassName}>
      <article aria-label={roleLabel}>
        <div className={textClassName}>
          <MessageBody message={item.message} />
        </div>
      </article>
      <div
        className={`toolbar-row ${isUserMessage ? "user-toolbar-row" : ""}`}
        aria-label={
          isUserMessage ? "User message toolbar" : "Codex message toolbar"
        }
      >
        <div className={`copy-wrap ${isUserMessage ? "copy-wrap--user" : ""}`}>
          <CopyButton
            className="copy-inline"
            ariaLabel={isUserMessage ? "复制用户消息" : "复制 Codex 消息"}
            copyText={item.message.copyText}
          />
        </div>
      </div>
    </li>
  );
}

function WorkProgressTimelineEntry({
  item
}: {
  item: WorkProgressTimelineItem;
}) {
  const workProgress = item.workProgress;

  return (
    <li className="transcript-row work-progress-row">
      <article aria-label="Work progress item">
        <div className="work-progress-card">
          <div className="work-progress-meta">
            <span>{workProgress.sourceType}</span>
            <span>{timelineStatusLabel(item.status)}</span>
          </div>
          <div className="work-progress-label">{workProgress.label}</div>
          {workProgress.summary === null ? null : (
            <p className="work-progress-summary">{workProgress.summary}</p>
          )}
          <DisplayDetailFields detail={workProgress.detail} />
        </div>
      </article>
    </li>
  );
}

function timelineStatusLabel(status: TimelineStatus): string {
  return timelineStatusLabels[status];
}
