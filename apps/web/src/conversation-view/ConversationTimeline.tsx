import type { TimelineItem } from "@my-code-x/app-types";
import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { CopyButton } from "./CopyButton";
import { DisplayDetailFields } from "./DisplayDetailFields";
import { MessageBody } from "./MessageBody";

interface ConversationTimelineProps {
  items: TimelineItem[];
}

type MessageTimelineItem = Extract<TimelineItem, { kind: "message" }>;
type TimelineStatus = TimelineItem["status"];
type UnknownTimelineItem = Extract<TimelineItem, { kind: "unknown" }>;
type WorkProgressTimelineItem = Extract<TimelineItem, { kind: "workProgress" }>;

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

  if (item.kind === "unknown") {
    return <UnknownTimelineEntry item={item} />;
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
  const hasDetailFields = workProgress.detail.fields.length > 0;
  const [isDetailExpanded, setIsDetailExpanded] = useState(hasDetailFields);
  const disclosureLabel = isDetailExpanded
    ? "收起工作痕迹详情"
    : "展开工作痕迹详情";

  return (
    <li className="transcript-row event-row">
      <span className="event-rule" aria-hidden="true" />
      <article className="event-content" aria-label="Work progress item">
        <div className="event-head">
          <p className="event-type">{workProgress.sourceType}</p>
          <span className={`status-chip ${statusChipClassName(item.status)}`}>
            {item.status}
          </span>
          <button
            className="disclosure"
            type="button"
            aria-label={disclosureLabel}
            onClick={() => setIsDetailExpanded((current) => !current)}
          >
            {isDetailExpanded ? (
              <ChevronUp size={16} aria-hidden="true" />
            ) : (
              <ChevronDown size={16} aria-hidden="true" />
            )}
          </button>
        </div>
        <p className="event-note">{workProgress.label}</p>
        {workProgress.summary === null ? null : (
          <p className="collapsed-hint">{workProgress.summary}</p>
        )}
        {isDetailExpanded ? (
          <DisplayDetailFields detail={workProgress.detail} />
        ) : null}
      </article>
    </li>
  );
}

function UnknownTimelineEntry({ item }: { item: UnknownTimelineItem }) {
  const unknown = item.unknown;
  const [isDetailExpanded, setIsDetailExpanded] = useState(false);
  const disclosureLabel = isDetailExpanded
    ? "收起未知条目详情"
    : "展开未知条目详情";
  const itemLabel = isDetailExpanded
    ? "Expanded unknown item"
    : "Collapsed unknown item";

  return (
    <li className="transcript-row event-row event-row--unknown">
      <span className="event-rule" aria-hidden="true" />
      <article className="event-content" aria-label={itemLabel}>
        <div className="event-head">
          <p className="event-type">{unknown.sourceType}</p>
          {unknown.statusLabel === null ? null : (
            <span className="status-chip status-chip--unknown">
              {unknown.statusLabel}
            </span>
          )}
          <button
            className="disclosure"
            type="button"
            aria-label={disclosureLabel}
            onClick={() => setIsDetailExpanded((current) => !current)}
          >
            {isDetailExpanded ? (
              <ChevronUp size={16} aria-hidden="true" />
            ) : (
              <ChevronDown size={16} aria-hidden="true" />
            )}
          </button>
        </div>
        {isDetailExpanded ? (
          <DisplayDetailFields detail={unknown.detail} />
        ) : null}
      </article>
    </li>
  );
}

function statusChipClassName(status: TimelineStatus): string {
  if (status === "failed") {
    return "status-chip--error";
  }

  if (status === "unknown") {
    return "status-chip--unknown";
  }

  return "status-chip--work";
}
