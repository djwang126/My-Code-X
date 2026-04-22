import type { SessionSendContentItem } from './session-timeline-types';

export type SessionSendInput = {
  text?: string;
  content?: SessionSendContentItem[];
};
