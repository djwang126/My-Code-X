import type { RuntimeOption } from '../../../features/chat/settings';
import { withSelectedOption } from '../../../features/chat/settings';

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
