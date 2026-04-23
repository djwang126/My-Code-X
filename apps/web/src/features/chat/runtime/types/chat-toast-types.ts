export type ChatToastItem = {
  key: string;
  tone: 'warning' | 'info' | 'error';
  title?: string;
  text: string;
};
