import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { clientConversationViewSchema } from './conversation-view.js';

describe('client conversation view contract', () => {
  test('accepts loading state without timeline data or error', () => {
    assert.deepEqual(clientConversationViewSchema.parse({
      status: 'loading',
      revision: 0,
    }), {
      status: 'loading',
      revision: 0,
    });
  });

  test('accepts ready state with revision and ordered confirmed message items', () => {
    assert.deepEqual(clientConversationViewSchema.parse({
      status: 'ready',
      revision: 2,
      items: [
        {
          id: 'item-1',
          kind: 'message',
          role: 'user',
          text: 'hello **Codex**',
        },
        {
          id: 'item-2',
          kind: 'message',
          role: 'assistant',
          text: 'world',
        },
      ],
    }), {
      status: 'ready',
      revision: 2,
      items: [
        {
          id: 'item-1',
          kind: 'message',
          role: 'user',
          text: 'hello **Codex**',
        },
        {
          id: 'item-2',
          kind: 'message',
          role: 'assistant',
          text: 'world',
        },
      ],
    });
  });

  test('accepts ready state with a conversation error item in the timeline', () => {
    assert.deepEqual(clientConversationViewSchema.parse({
      status: 'ready',
      revision: 3,
      items: [
        {
          id: 'error:turn-1',
          kind: 'error',
          message: 'runtime failed',
        },
      ],
    }), {
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
  });

  test('does not allow conversation error items to carry assistant message fields or controls', () => {
    const parsed = clientConversationViewSchema.safeParse({
      status: 'ready',
      revision: 3,
      items: [
        {
          id: 'error:turn-1',
          kind: 'error',
          message: 'runtime failed',
          role: 'assistant',
          text: 'runtime failed',
          timestamp: '2026-05-01T00:00:00.000Z',
          retry: true,
          copyable: true,
        },
      ],
    });

    assert.equal(parsed.success, false);
  });

  test('rejects conversation error items without an id', () => {
    assertRejectsReadyItem({
      kind: 'error',
      message: 'runtime failed',
    });
  });

  test('rejects conversation error items without a message', () => {
    assertRejectsReadyItem({
      id: 'error:turn-1',
      kind: 'error',
    });
  });

  const invalidConversationErrorItems = [
    {
      name: 'debug code',
      item: {
        id: 'error:turn-1',
        kind: 'error',
        message: 'runtime failed',
        code: 'RUNTIME_FAILED',
      },
    },
    {
      name: 'debug details',
      item: {
        id: 'error:turn-1',
        kind: 'error',
        message: 'runtime failed',
        details: 'raw upstream body',
      },
    },
    {
      name: 'reinterpretation explanation',
      item: {
        id: 'error:turn-1',
        kind: 'error',
        message: 'runtime failed',
        explanation: 'The provider returned an error.',
      },
    },
    {
      name: 'timestamp',
      item: {
        id: 'error:turn-1',
        kind: 'error',
        message: 'runtime failed',
        timestamp: '2026-05-01T00:00:00.000Z',
      },
    },
    {
      name: 'retry control',
      item: {
        id: 'error:turn-1',
        kind: 'error',
        message: 'runtime failed',
        retry: true,
      },
    },
    {
      name: 'copy control',
      item: {
        id: 'error:turn-1',
        kind: 'error',
        message: 'runtime failed',
        copyable: true,
      },
    },
  ] as const;

  for (const invalidCase of invalidConversationErrorItems) {
    test(`rejects conversation error items with ${invalidCase.name}`, () => {
      assertRejectsReadyItem(invalidCase.item);
    });
  }

  test('accepts ready state with ordered work trace fields from the Codex payload', () => {
    assert.deepEqual(clientConversationViewSchema.parse({
      status: 'ready',
      revision: 3,
      items: [
        {
          id: 'plan-1',
          kind: 'work-trace',
          codexType: 'plan',
          fields: [
            { name: 'type', value: 'plan' },
            { name: 'id', value: 'plan-1' },
            { name: 'status', value: 'completed' },
            { name: 'explanation', value: 'Plan' },
            { name: 'steps', value: [{ step: 'Read docs', done: true }] },
            { name: 'durationMs', value: 42 },
            { name: 'error', value: null },
          ],
        },
      ],
    }), {
      status: 'ready',
      revision: 3,
      items: [
        {
          id: 'plan-1',
          kind: 'work-trace',
          codexType: 'plan',
          fields: [
            { name: 'type', value: 'plan' },
            { name: 'id', value: 'plan-1' },
            { name: 'status', value: 'completed' },
            { name: 'explanation', value: 'Plan' },
            { name: 'steps', value: [{ step: 'Read docs', done: true }] },
            { name: 'durationMs', value: 42 },
            { name: 'error', value: null },
          ],
        },
      ],
    });
  });

  test('accepts unknown item fallback without reinterpreting the Codex payload', () => {
    assert.deepEqual(clientConversationViewSchema.parse({
      status: 'ready',
      revision: 4,
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
    }), {
      status: 'ready',
      revision: 4,
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
  });

  test('rejects legacy bare text timeline items', () => {
    const parsed = clientConversationViewSchema.safeParse({
      status: 'ready',
      revision: 1,
      items: [
        {
          id: 'item-1',
          text: 'hello',
        },
      ],
    });

    assert.equal(parsed.success, false);
  });

  test('rejects message items without a confirmed user or assistant role', () => {
    const parsed = clientConversationViewSchema.safeParse({
      status: 'ready',
      revision: 1,
      items: [
        {
          id: 'item-1',
          kind: 'message',
          role: 'system',
          text: 'hidden instruction',
        },
      ],
    });

    assert.equal(parsed.success, false);
  });

  test('rejects message items that carry rendered or trusted HTML', () => {
    const parsed = clientConversationViewSchema.safeParse({
      status: 'ready',
      revision: 1,
      items: [
        {
          id: 'item-1',
          kind: 'message',
          role: 'assistant',
          text: '<strong>hello</strong>',
          renderedHtml: '<strong>hello</strong>',
          trustedHtml: true,
        },
      ],
    });

    assert.equal(parsed.success, false);
  });

  test('rejects optimistic or pending message markers', () => {
    const parsed = clientConversationViewSchema.safeParse({
      status: 'ready',
      revision: 1,
      items: [
        {
          id: 'item-1',
          kind: 'message',
          role: 'user',
          text: 'not confirmed yet',
          optimistic: true,
          pending: true,
        },
      ],
    });

    assert.equal(parsed.success, false);
  });

  const invalidWorkTraceItems = [
    {
      name: 'display expansion state',
      item: {
        id: 'trace-1',
        kind: 'work-trace',
        codexType: 'commandExecution',
        fields: [],
        expanded: true,
        lineLimit: 30,
      },
    },
    {
      name: 'summaries and previews',
      item: {
        id: 'trace-1',
        kind: 'work-trace',
        codexType: 'commandExecution',
        fields: [],
        preview: 'npm test',
        summary: 'Command completed',
      },
    },
    {
      name: 'controls and copying state',
      item: {
        id: 'trace-1',
        kind: 'work-trace',
        codexType: 'commandExecution',
        fields: [],
        copyable: true,
        controls: {
          retry: true,
        },
      },
    },
    {
      name: 'timestamps',
      item: {
        id: 'trace-1',
        kind: 'work-trace',
        codexType: 'commandExecution',
        fields: [],
        timestamp: '2026-05-01T00:00:00.000Z',
      },
    },
    {
      name: 'without codex type',
      item: {
        id: 'trace-1',
        kind: 'work-trace',
        fields: [],
      },
    },
    {
      name: 'without fields',
      item: {
        id: 'trace-1',
        kind: 'work-trace',
        codexType: 'commandExecution',
      },
    },
  ] as const;

  for (const invalidCase of invalidWorkTraceItems) {
    test(`rejects work trace ${invalidCase.name}`, () => {
      assertRejectsReadyItem(invalidCase.item);
    });
  }

  const invalidUnknownItems = [
    {
      name: 'summaries and previews',
      item: {
        id: 'future-1',
        kind: 'unknown',
        codexType: 'futureCodexItem',
        fields: [],
        preview: 'Future item',
        summary: 'Reinterpreted future item',
      },
    },
    {
      name: 'reinterpretation fields',
      item: {
        id: 'future-1',
        kind: 'unknown',
        codexType: 'futureCodexItem',
        fields: [],
        knownAs: 'plan',
      },
    },
    {
      name: 'work trace marker',
      item: {
        id: 'future-1',
        kind: 'unknown',
        codexType: 'futureCodexItem',
        fields: [],
        workTrace: true,
      },
    },
    {
      name: 'without codex type',
      item: {
        id: 'future-1',
        kind: 'unknown',
        fields: [],
      },
    },
    {
      name: 'without fields',
      item: {
        id: 'future-1',
        kind: 'unknown',
        codexType: 'futureCodexItem',
      },
    },
  ] as const;

  for (const invalidCase of invalidUnknownItems) {
    test(`rejects unknown ${invalidCase.name}`, () => {
      assertRejectsReadyItem(invalidCase.item);
    });
  }

  test('represents empty conversation as ready with zero items', () => {
    assert.deepEqual(clientConversationViewSchema.parse({
      status: 'ready',
      revision: 0,
      items: [],
    }), {
      status: 'ready',
      revision: 0,
      items: [],
    });
  });

  test('requires failed state to carry a non-conversation error message', () => {
    assert.deepEqual(clientConversationViewSchema.parse({
      status: 'failed',
      revision: 2,
      error: {
        message: 'Unable to load conversation',
      },
    }), {
      status: 'failed',
      revision: 2,
      error: {
        message: 'Unable to load conversation',
      },
    });
  });

  test('does not allow restoring as a conversation view state', () => {
    const parsed = clientConversationViewSchema.safeParse({
      status: 'restoring',
    });

    assert.equal(parsed.success, false);
  });



  test('does not allow loading state to carry timeline items', () => {
    const parsed = clientConversationViewSchema.safeParse({
      status: 'loading',
      items: [],
    });

    assert.equal(parsed.success, false);
  });

  test('does not allow ready state to carry a non-conversation error', () => {
    const parsed = clientConversationViewSchema.safeParse({
      status: 'ready',
      revision: 0,
      items: [],
      error: {
        message: 'Unable to load conversation',
      },
    });

    assert.equal(parsed.success, false);
  });

  test('does not allow failed state to carry timeline items', () => {
    const parsed = clientConversationViewSchema.safeParse({
      status: 'failed',
      error: {
        message: 'Unable to load conversation',
      },
      items: [],
    });

    assert.equal(parsed.success, false);
  });

  test('does not allow out-of-scope conversation controls or timestamps', () => {
    const parsed = clientConversationViewSchema.safeParse({
      status: 'ready',
      revision: 0,
      items: [],
      timestamp: '2026-04-30T00:00:00.000Z',
      done: true,
      controls: {
        send: true,
        retry: true,
        approval: true,
      },
    });

    assert.equal(parsed.success, false);
  });

  test('does not allow message item timestamps or controls', () => {
    const parsed = clientConversationViewSchema.safeParse({
      status: 'ready',
      revision: 1,
      items: [
        {
          id: 'item-1',
          kind: 'message',
          role: 'assistant',
          text: 'done',
          timestamp: '2026-05-01T00:00:00.000Z',
          done: true,
          controls: {
            retry: true,
          },
        },
      ],
    });

    assert.equal(parsed.success, false);
  });

  test('does not allow failed state without an error message', () => {
    const parsed = clientConversationViewSchema.safeParse({
      status: 'failed',
    });

    assert.equal(parsed.success, false);
  });
});

interface AssertRejectsReadyItemInput {
  readonly [key: string]: unknown;
}

function assertRejectsReadyItem(item: AssertRejectsReadyItemInput): void {
  const parsed = clientConversationViewSchema.safeParse({
    status: 'ready',
    revision: 1,
    items: [item],
  });

  assert.equal(parsed.success, false);
}
