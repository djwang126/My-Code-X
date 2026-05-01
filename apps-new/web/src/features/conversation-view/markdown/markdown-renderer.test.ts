import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { renderConversationMarkdown } from './markdown-renderer.js';

describe('conversation markdown renderer', () => {
  test('renders common markdown blocks without syntax highlighting', () => {
    assert.deepEqual(renderConversationMarkdown({
      text: [
        'Hello **Codex**.',
        '',
        '- one',
        '- two',
        '',
        '`inline` code',
        '',
        '```ts',
        'const value = 1;',
        '```',
      ].join('\n'),
    }), {
      blocks: [
        {
          kind: 'html',
          id: 'html-1',
          html: '<p>Hello <strong>Codex</strong>.</p>',
        },
        {
          kind: 'html',
          id: 'html-2',
          html: '<ul><li>one</li><li>two</li></ul>',
        },
        {
          kind: 'html',
          id: 'html-3',
          html: '<p><code>inline</code> code</p>',
        },
        {
          kind: 'code',
          id: 'code-1',
          html: '<pre><code>const value = 1;</code></pre>',
          text: 'const value = 1;',
        },
      ],
    });
  });

  test('escapes raw HTML instead of returning trusted page HTML', () => {
    assert.deepEqual(renderConversationMarkdown({
      text: '<img src=x onerror="alert(1)"> <script>alert(2)</script>',
    }), {
      blocks: [
        {
          kind: 'html',
          id: 'html-1',
          html: '<p>&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &lt;script&gt;alert(2)&lt;/script&gt;</p>',
        },
      ],
    });
  });

  test('wraps markdown tables in a horizontal overflow container', () => {
    assert.deepEqual(renderConversationMarkdown({
      text: [
        '| Package | Command |',
        '| --- | --- |',
        '| web | npm run test --workspace @my-code-x/web-new |',
      ].join('\n'),
    }), {
      blocks: [
        {
          kind: 'html',
          id: 'html-1',
          html: '<div class="conversation-markdown__table-scroll"><table><thead><tr><th>Package</th><th>Command</th></tr></thead><tbody><tr><td>web</td><td>npm run test --workspace @my-code-x/web-new</td></tr></tbody></table></div>',
        },
      ],
    });
  });

  test('renders external links with new-tab behavior', () => {
    assert.deepEqual(renderConversationMarkdown({
      text: '[OpenAI](https://openai.com)',
    }), {
      blocks: [
        {
          kind: 'html',
          id: 'html-1',
          html: '<p><a href="https://openai.com" target="_blank" rel="noopener noreferrer">OpenAI</a></p>',
        },
      ],
    });
  });
});
