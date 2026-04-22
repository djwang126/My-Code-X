import type { SessionNotice } from '../../chat-runtime/public-types';
import type { SessionToastItem } from '../types';

export function selectSessionToastItems(notices: SessionNotice[]): SessionToastItem[] {
  return notices.map(notice => ({
    key: notice.id,
    tone: notice.level,
    title: notice.title,
    text: notice.text,
  }));
}
