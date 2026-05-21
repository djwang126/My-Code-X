import type { TimelineItem } from "@my-code-x/app-types";

interface ConversationTimelineProps {
  items: TimelineItem[];
}

type MessageTimelineItem = Extract<TimelineItem, { kind: "message" }>;

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
          <p>{item.message.text}</p>
        </div>
      </article>
    </li>
  );
}
