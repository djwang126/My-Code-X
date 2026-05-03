import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { renderConversationMarkdown } from './markdown-renderer.js';

describe('conversation markdown subset renderer', () => {
  test('renders common markdown blocks as structured markdown data', () => {
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
          kind: 'paragraph',
          id: 'block-1',
          inlines: [
            { kind: 'text', text: 'Hello ' },
            {
              kind: 'strong',
              inlines: [{ kind: 'text', text: 'Codex' }],
            },
            { kind: 'text', text: '.' },
          ],
        },
        {
          kind: 'list',
          id: 'block-2',
          items: [
            [{ kind: 'text', text: 'one' }],
            [{ kind: 'text', text: 'two' }],
          ],
        },
        {
          kind: 'paragraph',
          id: 'block-3',
          inlines: [
            { kind: 'code', text: 'inline' },
            { kind: 'text', text: ' code' },
          ],
        },
        {
          kind: 'code',
          id: 'code-1',
          text: 'const value = 1;',
        },
      ],
    });
  });

  test('keeps raw HTML as plain text inline data', () => {
    assert.deepEqual(renderConversationMarkdown({
      text: '<img src=x onerror="alert(1)"> <script>alert(2)</script>',
    }), {
      blocks: [
        {
          kind: 'paragraph',
          id: 'block-1',
          inlines: [
            {
              kind: 'text',
              text: '<img src=x onerror="alert(1)"> <script>alert(2)</script>',
            },
          ],
        },
      ],
    });
  });

  test('renders markdown tables as structured table blocks', () => {
    assert.deepEqual(renderConversationMarkdown({
      text: [
        '| Package | Command |',
        '| --- | --- |',
        '| web | npm run test --workspace @my-code-x/web-new |',
      ].join('\n'),
    }), {
      blocks: [
        {
          kind: 'table',
          id: 'block-1',
          headers: [
            [{ kind: 'text', text: 'Package' }],
            [{ kind: 'text', text: 'Command' }],
          ],
          rows: [
            [
              [{ kind: 'text', text: 'web' }],
              [{ kind: 'text', text: 'npm run test --workspace @my-code-x/web-new' }],
            ],
          ],
        },
      ],
    });
  });

  test('renders external links as link inline data', () => {
    assert.deepEqual(renderConversationMarkdown({
      text: '[OpenAI](https://openai.com)',
    }), {
      blocks: [
        {
          kind: 'paragraph',
          id: 'block-1',
          inlines: [
            {
              kind: 'link',
              href: 'https://openai.com',
              inlines: [{ kind: 'text', text: 'OpenAI' }],
            },
          ],
        },
      ],
    });
  });

  test('keeps non-http URLs as plain text', () => {
    assert.deepEqual(renderConversationMarkdown({
      text: [
        '[bad](javascript:alert(1))',
        '[file](file:///tmp/a.txt)',
        '[mail](mailto:hello@example.com)',
      ].join(' '),
    }), {
      blocks: [
        {
          kind: 'paragraph',
          id: 'block-1',
          inlines: [
            {
              kind: 'text',
              text: '[bad](javascript:alert(1)) [file](file:///tmp/a.txt) [mail](mailto:hello@example.com)',
            },
          ],
        },
      ],
    });
  });

  test('preserves raw code block text without inline markdown rendering', () => {
    assert.deepEqual(renderConversationMarkdown({
      text: [
        '```html',
        'const value = "<script>";',
        '',
        '**not strong**',
        '```',
      ].join('\n'),
    }), {
      blocks: [
        {
          kind: 'code',
          id: 'code-1',
          text: [
            'const value = "<script>";',
            '',
            '**not strong**',
          ].join('\n'),
        },
      ],
    });
  });

  test('renders inline markdown inside table cells', () => {
    assert.deepEqual(renderConversationMarkdown({
      text: [
        '| Name | Link |',
        '| --- | --- |',
        '| **Codex** | [OpenAI](https://openai.com) |',
      ].join('\n'),
    }), {
      blocks: [
        {
          kind: 'table',
          id: 'block-1',
          headers: [
            [{ kind: 'text', text: 'Name' }],
            [{ kind: 'text', text: 'Link' }],
          ],
          rows: [
            [
              [
                {
                  kind: 'strong',
                  inlines: [{ kind: 'text', text: 'Codex' }],
                },
              ],
              [
                {
                  kind: 'link',
                  href: 'https://openai.com',
                  inlines: [{ kind: 'text', text: 'OpenAI' }],
                },
              ],
            ],
          ],
        },
      ],
    });
  });

  test('handles unclosed code fences deterministically', () => {
    assert.deepEqual(renderConversationMarkdown({
      text: [
        '```ts',
        'const value = 1;',
      ].join('\n'),
    }), {
      blocks: [
        {
          kind: 'code',
          id: 'code-1',
          text: 'const value = 1;',
        },
      ],
    });
  });
});
