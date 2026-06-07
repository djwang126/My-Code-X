export function nextConversationCursor(currentCursor: string): string {
  const current = Number(currentCursor);

  if (!Number.isInteger(current) || current < 0) {
    throw new Error(`Invalid conversation cursor: ${currentCursor}`);
  }

  return String(current + 1);
}
