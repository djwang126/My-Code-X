export interface ConversationClipboard {
  writeText(text: string): Promise<void>;
}

export interface CopyConversationTextInput {
  readonly clipboard: ConversationClipboard;
  readonly text: string;
}

export async function copyMessageText(input: CopyConversationTextInput): Promise<void> {
  await input.clipboard.writeText(input.text);
}

export async function copyCodeBlockText(input: CopyConversationTextInput): Promise<void> {
  await input.clipboard.writeText(input.text);
}

export function readBrowserClipboard(): ConversationClipboard {
  return {
    async writeText(text: string): Promise<void> {
      await globalThis.navigator.clipboard.writeText(text);
    },
  };
}
