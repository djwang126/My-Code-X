import type { JsonValue } from '@my-code-x/contracts-new/json';

export interface CreateConversationFieldValueViewInput {
  readonly value: JsonValue;
  readonly expanded: boolean;
}

export interface ConversationFieldValueView {
  readonly text: string;
  readonly remainingLineCount: number;
  readonly truncated: boolean;
}

const initialVisibleLineCount = 30;

export function createConversationFieldValueView(input: CreateConversationFieldValueViewInput): ConversationFieldValueView {
  const text = formatConversationFieldValue({ value: input.value });
  const lines = text.split('\n');

  if (input.expanded || lines.length <= initialVisibleLineCount) {
    return {
      text,
      remainingLineCount: 0,
      truncated: false,
    };
  }

  return {
    text: lines.slice(0, initialVisibleLineCount).join('\n'),
    remainingLineCount: lines.length - initialVisibleLineCount,
    truncated: true,
  };
}

interface FormatConversationFieldValueInput {
  readonly value: JsonValue;
}

function formatConversationFieldValue(input: FormatConversationFieldValueInput): string {
  if (typeof input.value === 'string') {
    return input.value;
  }

  return JSON.stringify(input.value, null, 2);
}


export interface CreateConversationFieldKeyInput {
  readonly itemId: string;
  readonly fieldName: string;
  readonly index: number;
}

const conversationFieldKeySeparator = '\u0000';

export function createConversationFieldKey(input: CreateConversationFieldKeyInput): string {
  return [
    input.itemId,
    String(input.index),
    input.fieldName,
  ].join(conversationFieldKeySeparator);
}

export interface ExpandConversationFieldInput {
  readonly expandedFields: ReadonlySet<string>;
  readonly fieldKey: string;
}

export function expandConversationField(input: ExpandConversationFieldInput): ReadonlySet<string> {
  const next = new Set(input.expandedFields);
  next.add(input.fieldKey);
  return next;
}
