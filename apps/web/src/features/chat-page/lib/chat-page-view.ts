import type { RuntimeOption } from '../../runtime-settings';
import { withSelectedOption } from '../../runtime-settings';
import type { ChatPageProps } from '../../chat-page/types';

type SessionToastItem = {
  key: string;
  tone: 'warning' | 'info' | 'error';
  title?: string;
  text: string;
};

export function getRuntimeSelectOptions(options: RuntimeOption[], selectedValue: string | null) {
  return withSelectedOption(options, selectedValue);
}

export function getStatusClass(status: string) {
  const normalizedStatus = status.toLowerCase();
  if (normalizedStatus.includes('connect')) return 'connected';
  if (normalizedStatus.includes('stream') || normalizedStatus.includes('think') || normalizedStatus.includes('work')) {
    return 'connecting';
  }
  if (normalizedStatus.includes('error') || normalizedStatus.includes('fail')) return 'disconnected';
  return 'idle';
}

export function buildSessionToastItems(notices: ChatPageProps['notices']): SessionToastItem[] {
  return (notices ?? []).map(notice => ({
      key: notice.id,
      tone: notice.level,
      title: notice.title,
      text: notice.text,
    }));
}
