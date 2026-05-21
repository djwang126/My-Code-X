import type { TimelineItem } from "@my-code-x/app-types";
import { MarkdownMessage } from "./MarkdownMessage";

type MessageContent = Extract<TimelineItem, { kind: "message" }>["message"];

export interface MessageBodyProps {
  message: MessageContent;
}

export function MessageBody({ message }: MessageBodyProps) {
  if (!message.markdown) {
    return <p>{message.text}</p>;
  }

  return <MarkdownMessage text={message.text} />;
}
