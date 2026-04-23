import type { SessionNotice } from '../public-types';
import type { ChatToastItem } from '../types/chat-toast-types';

export function selectChatToastItems(notices: SessionNotice[]): ChatToastItem[] {
  return notices.map(notice => ({
    key: notice.id,
    tone: notice.level,
    title: notice.title,
    text: notice.text,
  }));
}
