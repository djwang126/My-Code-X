import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  createConversationFieldKey,
  createConversationFieldValueView,
  expandConversationField,
} from './conversation-field-value.js';

describe('conversation field value view', () => {
  test('shows the first 30 lines and remaining count for a collapsed long field', () => {
    const value = createNumberedLines({ count: 31 });

    const view = createConversationFieldValueView({
      value,
      expanded: false,
    });

    assert.deepEqual(view, {
      text: createNumberedLines({ count: 30 }),
      remainingLineCount: 1,
      truncated: true,
    });
  });

  test('applies the 30 line rule to each field value independently', () => {
    const longField = createConversationFieldValueView({
      value: createNumberedLines({ count: 31 }),
      expanded: false,
    });
    const shortField = createConversationFieldValueView({
      value: 'first line\nsecond line',
      expanded: false,
    });

    assert.deepEqual(longField, {
      text: createNumberedLines({ count: 30 }),
      remainingLineCount: 1,
      truncated: true,
    });
    assert.deepEqual(shortField, {
      text: 'first line\nsecond line',
      remainingLineCount: 0,
      truncated: false,
    });
  });

  test('shows the complete long field after that field is expanded', () => {
    const value = createNumberedLines({ count: 31 });

    const view = createConversationFieldValueView({
      value,
      expanded: true,
    });

    assert.deepEqual(view, {
      text: value,
      remainingLineCount: 0,
      truncated: false,
    });
  });

  test('shows exactly 30 lines without a remaining-lines entry', () => {
    const value = createNumberedLines({ count: 30 });

    const view = createConversationFieldValueView({
      value,
      expanded: false,
    });

    assert.deepEqual(view, {
      text: value,
      remainingLineCount: 0,
      truncated: false,
    });
  });

  test('formats JSON values while leaving strings as their raw text', () => {
    assert.deepEqual(createConversationFieldValueView({
      value: 'plain text',
      expanded: false,
    }), {
      text: 'plain text',
      remainingLineCount: 0,
      truncated: false,
    });
    assert.deepEqual(createConversationFieldValueView({
      value: {
        nested: true,
        count: 2,
      },
      expanded: false,
    }), {
      text: [
        '{',
        '  "nested": true,',
        '  "count": 2',
        '}',
      ].join('\n'),
      remainingLineCount: 0,
      truncated: false,
    });
  });


  test('expands one field without expanding sibling fields', () => {
    const firstFieldKey = createConversationFieldKey({
      itemId: 'command-1',
      fieldName: 'stdout',
      index: 0,
    });
    const secondFieldKey = createConversationFieldKey({
      itemId: 'command-1',
      fieldName: 'stderr',
      index: 1,
    });

    const expandedFields = expandConversationField({
      expandedFields: new Set(),
      fieldKey: firstFieldKey,
    });

    assert.deepEqual([...expandedFields], [firstFieldKey]);
    assert.equal(expandedFields.has(firstFieldKey), true);
    assert.equal(expandedFields.has(secondFieldKey), false);
  });
});

interface CreateNumberedLinesInput {
  readonly count: number;
}

function createNumberedLines(input: CreateNumberedLinesInput): string {
  return Array.from({ length: input.count }, (_, index) => `line ${index + 1}`).join('\n');
}
