export type SessionToastItem = {
  key: string;
  tone: 'warning' | 'info' | 'error';
  title?: string;
  text: string;
};
