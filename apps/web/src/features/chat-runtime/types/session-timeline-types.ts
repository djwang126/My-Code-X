export type SessionTimelineState = 'complete' | 'streaming' | 'error';

export type UserInputTextContentItem = {
  type: 'text';
  text?: string;
  text_elements?: unknown[];
};

export type UserInputImageAttachmentContentItem = {
  type: 'imageAttachment';
  attachmentId: string;
};

export type UserInputImageStatus = 'unavailable';

export type UserInputImageContentItem = {
  type: 'image';
  url?: string;
  attachmentId?: string;
  status?: UserInputImageStatus;
};

export type UserInputLocalImageContentItem = {
  type: 'localImage';
  path?: string;
  url?: string;
  attachmentId?: string;
  status?: UserInputImageStatus;
};

export type UserInputSkillContentItem = {
  type: 'skill';
  name?: string;
  path?: string;
};

export type UserInputMentionContentItem = {
  type: 'mention';
  name?: string;
  path?: string;
};

export type UserInputContentItem =
  | UserInputTextContentItem
  | UserInputImageAttachmentContentItem
  | UserInputImageContentItem
  | UserInputLocalImageContentItem
  | UserInputSkillContentItem
  | UserInputMentionContentItem;

export type SessionSendContentItem = UserInputTextContentItem | UserInputImageAttachmentContentItem;

export type SessionTimelineMessageItem = {
  id: string;
  kind: 'message';
  itemType: 'userMessage' | 'agentMessage';
  role: 'user' | 'assistant' | 'system';
  text: string;
  state: SessionTimelineState;
  threadId: string | null;
  turnId: string | null;
  content?: UserInputContentItem[];
  raw?: Record<string, unknown>;
};

export type AssistantTimelineMessageItem = SessionTimelineMessageItem & {
  itemType: 'agentMessage';
  role: 'assistant';
};

export type SessionTimelineSpecialItem = {
  id: string;
  kind: 'special';
  itemType: string;
  text: string;
  state: SessionTimelineState;
  threadId: string | null;
  turnId: string | null;
  status?: string;
  raw?: Record<string, unknown>;
};

export type SessionTimelineFallbackItem = {
  id: string;
  kind: 'fallback';
  itemType: string;
  text: string;
  state: SessionTimelineState;
  threadId: string | null;
  turnId: string | null;
  raw?: Record<string, unknown>;
};

export type SessionTimelineItem =
  | SessionTimelineMessageItem
  | SessionTimelineSpecialItem
  | SessionTimelineFallbackItem;

export type ChatMessage = SessionTimelineMessageItem;

export type SessionThreadHistoryItem = {
  id: string;
  name: string;
  preview: string;
  workspace: string;
  createdAt: number;
  updatedAt: number;
  statusText: string;
};

export type TimelineItemContentPayload = {
  itemId: string;
  itemType: 'commandExecution' | 'fileChange';
  detailRevision: string;
  raw: Record<string, unknown>;
};

export type ThreadHistoryPayload = {
  data: SessionThreadHistoryItem[];
};
