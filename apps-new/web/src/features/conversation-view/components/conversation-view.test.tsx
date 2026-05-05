import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { URL } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';

import type { ClientConversationView } from '@my-code-x/contracts-new';
import { ConversationView } from './conversation-view.js';

describe('ConversationView message rendering', () => {
  test('renders confirmed user and assistant messages in timeline order with side-specific semantics', () => {
    const html = renderConversationView({
      status: 'ready',
      revision: 1,
      items: [
        {
          id: 'item-1',
          kind: 'message',
          role: 'user',
          text: 'hello',
        },
        {
          id: 'item-2',
          kind: 'message',
          role: 'assistant',
          text: 'world',
        },
      ],
    });

    assertIncludes(html, 'aria-label="Conversation timeline"');
    assertIncludes(html, 'aria-label="User message"');
    assertIncludes(html, 'aria-label="Assistant message"');
    assertIncludes(html, 'conversation-view__timeline-item--user');
    assertIncludes(html, 'conversation-view__timeline-item--assistant');
    assertIncludes(html, '<p>hello</p>');
    assertIncludes(html, '<p>world</p>');
    assertOrder({
      source: html,
      before: '<p>hello</p>',
      after: '<p>world</p>',
    });
    assert.equal(countOccurrences({ source: html, text: 'Copy message' }), 2);
  });

  test('renders message markdown safely with code-block copy and external link behavior', () => {
    const html = renderConversationView({
      status: 'ready',
      revision: 1,
      items: [
        {
          id: 'item-1',
          kind: 'message',
          role: 'assistant',
          text: [
            'Hello **Codex** [site](https://openai.com)',
            '',
            '<script>alert(1)</script>',
            '',
            '```ts',
            'const value = 1;',
            '```',
            '',
            '| Package | Command |',
            '| --- | --- |',
            '| web | npm run test |',
          ].join('\n'),
        },
      ],
    });

    assertIncludes(html, '<strong>Codex</strong>');
    assertIncludes(html, '<a href="https://openai.com" rel="noopener noreferrer" target="_blank">site</a>');
    assertIncludes(html, '&lt;script&gt;alert(1)&lt;/script&gt;');
    assertDoesNotInclude(html, '<script>alert(1)</script>');
    assertIncludes(html, '<pre><code>const value = 1;</code></pre>');
    assertIncludes(html, 'class="conversation-view__copy-code"');
    assertIncludes(html, 'data-code-block-id="code-1"');
    assertIncludes(html, 'class="conversation-markdown__table-scroll"');
    assertIncludes(html, '<table>');
    assertIncludes(html, '<td>npm run test</td>');
    assertIncludes(html, 'class="conversation-view__copy-message"');
  });

  test('renders each code copy button after its matching code block', () => {
    const html = renderConversationView({
      status: 'ready',
      revision: 1,
      items: [
        {
          id: 'item-1',
          kind: 'message',
          role: 'assistant',
          text: [
            '```ts',
            'const first = 1;',
            '```',
            '',
            'between',
            '',
            '```ts',
            'const second = 2;',
            '```',
          ].join('\n'),
        },
      ],
    });

    assertOrder({
      source: html,
      before: '<pre><code>const first = 1;</code></pre>',
      after: 'data-code-block-id="code-1"',
    });
    assertOrder({
      source: html,
      before: 'data-code-block-id="code-1"',
      after: '<p>between</p>',
    });
    assertOrder({
      source: html,
      before: '<pre><code>const second = 2;</code></pre>',
      after: 'data-code-block-id="code-2"',
    });
    assert.equal(countOccurrences({ source: html, text: 'Copy code' }), 2);
  });

  test('does not apply work trace line expansion controls to long messages', () => {
    const html = renderConversationView({
      status: 'ready',
      revision: 1,
      items: [
        {
          id: 'assistant-long',
          kind: 'message',
          role: 'assistant',
          text: createNumberedLines({ count: 50 }),
        },
      ],
    });

    assertIncludes(html, 'line 1');
    assertIncludes(html, 'line 50');
    assertDoesNotInclude(html, '展开剩余');
  });

  test('renders work trace items as default-collapsed Codex-side field cards', () => {
    const html = renderConversationView({
      status: 'ready',
      revision: 2,
      items: [
        {
          id: 'plan-1',
          kind: 'work-trace',
          codexType: 'plan',
          fields: [
            { name: 'type', value: 'plan' },
            { name: 'status', value: 'completed' },
            { name: 'plan', value: [{ step: 'Read docs', status: 'completed' }] },
          ],
        },
      ],
    });

    assertIncludes(html, 'conversation-view__timeline-item--trace');
    assertIncludes(html, '<summary>plan</summary>');
    assertIncludes(html, 'type');
    assertIncludes(html, 'completed');
    assertDoesNotInclude(html, '<details open');
    assertDoesNotInclude(html, 'conversation-view__timeline-item--user');
    assertDoesNotInclude(html, 'Copy message');
    assertDoesNotInclude(html, 'Copy code');
  });

  test('renders long work trace field with a per-field remaining-lines entry', () => {
    const html = renderConversationView({
      status: 'ready',
      revision: 3,
      items: [
        {
          id: 'command-1',
          kind: 'work-trace',
          codexType: 'commandExecution',
          fields: [
            {
              name: 'aggregatedOutput',
              value: createNumberedLines({ count: 50, prefix: 'trace line' }),
            },
          ],
        },
      ],
    });

    assertIncludes(html, 'trace line 1');
    assertIncludes(html, 'trace line 30');
    assertDoesNotInclude(html, 'trace line 31');
    assertDoesNotInclude(html, 'trace line 50');
    assertIncludes(html, '展开剩余 20 行');
  });

  test('renders arbitrary long work trace field values with per-field truncation', () => {
    const html = renderConversationView({
      status: 'ready',
      revision: 3,
      items: [
        {
          id: 'command-1',
          kind: 'work-trace',
          codexType: 'commandExecution',
          fields: [
            {
              name: 'runtimeDeltaText',
              value: createNumberedLines({ count: 35, prefix: 'runtime output' }),
            },
            {
              name: 'runtimeDeltaEvents',
              value: [
                {
                  deltaKind: 'command-output',
                  text: 'runtime output',
                  data: { delta: 'runtime output' },
                },
              ],
            },
          ],
        },
      ],
    });

    assertIncludes(html, 'runtimeDeltaText');
    assertIncludes(html, 'runtime output 30');
    assertDoesNotInclude(html, 'runtime output 31');
    assertIncludes(html, '展开剩余 5 行');
    assertIncludes(html, 'runtimeDeltaEvents');
    assertIncludes(html, '&quot;deltaKind&quot;: &quot;command-output&quot;');
  });

  test('does not truncate long messages while truncating long work trace fields', () => {
    const html = renderConversationView({
      status: 'ready',
      revision: 4,
      items: [
        {
          id: 'assistant-long',
          kind: 'message',
          role: 'assistant',
          text: createNumberedLines({ count: 50, prefix: 'message line' }),
        },
        {
          id: 'trace-1',
          kind: 'work-trace',
          codexType: 'commandExecution',
          fields: [
            {
              name: 'aggregatedOutput',
              value: createNumberedLines({ count: 50, prefix: 'trace line' }),
            },
          ],
        },
      ],
    });

    assertIncludes(html, 'message line 50');
    assertIncludes(html, 'trace line 30');
    assertDoesNotInclude(html, 'trace line 31');
    assertIncludes(html, '展开剩余 20 行');
  });

  test('renders unknown items as default-collapsed fallback field cards without pretending they are work traces', () => {
    const html = renderConversationView({
      status: 'ready',
      revision: 2,
      items: [
        {
          id: 'future-1',
          kind: 'unknown',
          codexType: 'futureCodexItem',
          fields: [
            { name: 'id', value: 'future-1' },
            { name: 'type', value: 'futureCodexItem' },
            { name: 'payload', value: { nested: true } },
          ],
        },
      ],
    });

    assertIncludes(html, 'conversation-view__trace-card--unknown');
    assertIncludes(html, '<summary>futureCodexItem</summary>');
    assertIncludes(html, 'payload');
    assertIncludes(html, '&quot;nested&quot;: true');
    assertDoesNotInclude(html, '<details open');
    assertDoesNotInclude(html, 'conversation-view__message--user');
    assertDoesNotInclude(html, 'Copy message');
    assertDoesNotInclude(html, 'Copy code');
  });

  test('renders conversation error items as timeline error cards', () => {
    const html = renderConversationView({
      status: 'ready',
      revision: 3,
      items: [
        {
          id: 'error:turn-1',
          kind: 'error',
          message: 'runtime failed',
        },
      ],
    });

    assertIncludes(html, 'aria-label="Conversation error"');
    assertIncludes(html, 'role="alert"');
    assertIncludes(html, 'conversation-view__error-message');
    assertIncludes(html, 'runtime failed');
    assertDoesNotInclude(html, 'aria-label="Assistant message"');
    assertDoesNotInclude(html, 'conversation-view__message--assistant');
    assertDoesNotInclude(html, 'Copy message');
    assertDoesNotInclude(html, 'Copy code');
  });

  test('renders conversation error messages as plain text without markdown or trusted html', () => {
    const html = renderConversationView({
      status: 'ready',
      revision: 3,
      items: [
        {
          id: 'error:turn-1',
          kind: 'error',
          message: '<strong>runtime</strong> **failed**',
        },
      ],
    });

    assertIncludes(html, '&lt;strong&gt;runtime&lt;/strong&gt; **failed**');
    assertDoesNotInclude(html, '<strong>runtime</strong>');
    assertDoesNotInclude(html, '<strong>failed</strong>');
    assertDoesNotInclude(html, 'conversation-view__markdown');
  });

  test('styles conversation error message text in red', () => {
    const css = readFileSync(new URL('./conversation-view.css', import.meta.url), 'utf8');

    assert.match(css, /\.conversation-view__error-message\s*\{[^}]*color:\s*#b91c1c;/s);
  });

  test('renders failed resource errors outside the conversation timeline', () => {
    const html = renderConversationView({
      status: 'failed',
      error: {
        message: 'restore failed',
      },
    });

    assertIncludes(html, 'role="alert"');
    assertIncludes(html, 'conversation-view__body--error');
    assertIncludes(html, 'restore failed');
    assertDoesNotInclude(html, 'aria-label="Conversation timeline"');
    assertDoesNotInclude(html, 'conversation-view__timeline-item--error');
    assertDoesNotInclude(html, 'conversation-view__error-card');
    assertDoesNotInclude(html, 'aria-label="Conversation error"');
  });
});

function renderConversationView(conversation: ClientConversationView): string {
  return renderToStaticMarkup(
    <ConversationView conversation={conversation} />,
  );
}

interface AssertOrderInput {
  readonly source: string;
  readonly before: string;
  readonly after: string;
}

interface CountOccurrencesInput {
  readonly source: string;
  readonly text: string;
}

function assertIncludes(source: string, expected: string): void {
  assert.equal(source.includes(expected), true, `Expected markup to include: ${expected}`);
}

function assertDoesNotInclude(source: string, expected: string): void {
  assert.equal(source.includes(expected), false, `Expected markup not to include: ${expected}`);
}

function assertOrder(input: AssertOrderInput): void {
  const beforeIndex = input.source.indexOf(input.before);
  const afterIndex = input.source.indexOf(input.after);

  assert.notEqual(beforeIndex, -1, `Expected markup to include: ${input.before}`);
  assert.notEqual(afterIndex, -1, `Expected markup to include: ${input.after}`);
  assert.equal(beforeIndex < afterIndex, true, `Expected "${input.before}" before "${input.after}"`);
}

function countOccurrences(input: CountOccurrencesInput): number {
  return input.source.split(input.text).length - 1;
}

interface CreateNumberedLinesInput {
  readonly count: number;
  readonly prefix?: string;
}

function createNumberedLines(input: CreateNumberedLinesInput): string {
  const prefix = input.prefix ?? 'line';
  return Array.from({ length: input.count }, (_, index) => `${prefix} ${index + 1}`).join('\n');
}
