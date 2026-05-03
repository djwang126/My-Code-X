import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
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
