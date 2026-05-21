export interface CodexThreadItemTimelineIdInput {
  threadId: string;
  turnId: string;
  itemId: string;
}

export function codexThreadItemTimelineId(
  input: CodexThreadItemTimelineIdInput
): string {
  return `codexThreadItem(${input.threadId},${input.turnId},${input.itemId})`;
}
