import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeResumeThreadResult } from './codex-gateway-protocol.js';

test('normalizeResumeThreadResult preserves typed special items, user content, and duplicate item ids', () => {
  const normalized = normalizeResumeThreadResult({
    thread: {
      id: 'thread-1',
      turns: [
        {
          id: 'turn-1',
          status: 'completed',
          items: [
            {
              type: 'userMessage',
              id: 'user-1',
              content: [
                { type: 'text', text: 'hello' },
                { type: 'skill', name: 'playwright', path: 'skill://playwright' },
              ],
            },
            {
              type: 'plan',
              id: 'plan-1',
              text: 'Inspect the failing tests',
            },
            {
              type: 'agentMessage',
              id: 'assistant-1',
              text: 'Initial answer',
            },
          ],
        },
        {
          id: 'turn-2',
          status: 'inProgress',
          items: [
            {
              type: 'agentMessage',
              id: 'assistant-1',
              text: 'Updated answer',
            },
            {
              type: 'commandExecution',
              id: 'cmd-1',
              command: 'npm test',
              cwd: 'D:/workspace/example-app',
              status: 'inProgress',
            },
            {
              type: 'totallyUnknownThing',
              id: 'unknown-1',
              payload: { nested: true },
            },
          ],
        },
      ],
    },
  });

  assert.equal(normalized.threadId, 'thread-1');
  assert.deepEqual(normalized.turnExecution, {
    activeTurnId: 'turn-2',
    turnLifecycle: 'running',
  });
  assert.deepEqual(normalized.messages, [
    {
      id: 'user:turn-1',
      kind: 'message',
      itemType: 'userMessage',
      role: 'user',
      text: 'hello\n\n[skill: playwright]',
      state: 'complete',
      threadId: 'thread-1',
      turnId: 'turn-1',
      content: [
        { type: 'text', text: 'hello' },
        { type: 'skill', name: 'playwright', path: 'skill://playwright' },
      ],
      raw: {
        type: 'userMessage',
        id: 'user-1',
        content: [
          { type: 'text', text: 'hello' },
          { type: 'skill', name: 'playwright', path: 'skill://playwright' },
        ],
      },
    },
    {
      id: 'plan-1',
      kind: 'special',
      itemType: 'plan',
      text: 'Inspect the failing tests',
      state: 'complete',
      threadId: 'thread-1',
      turnId: 'turn-1',
      raw: {
        type: 'plan',
        id: 'plan-1',
        text: 'Inspect the failing tests',
      },
    },
    {
      id: 'assistant-1',
      kind: 'message',
      itemType: 'agentMessage',
      role: 'assistant',
      text: 'Updated answer',
      state: 'streaming',
      threadId: 'thread-1',
      turnId: 'turn-2',
      raw: {
        type: 'agentMessage',
        id: 'assistant-1',
        text: 'Updated answer',
      },
    },
    {
      id: 'cmd-1',
      kind: 'special',
      itemType: 'commandExecution',
      text: 'npm test',
      state: 'streaming',
      threadId: 'thread-1',
      turnId: 'turn-2',
      status: 'inProgress',
      raw: {
        type: 'commandExecution',
        id: 'cmd-1',
        command: 'npm test',
        cwd: 'D:/workspace/example-app',
        status: 'inProgress',
      },
    },
    {
      id: 'unknown-1',
      kind: 'fallback',
      itemType: 'totallyUnknownThing',
      text: '[totallyUnknownThing]',
      state: 'streaming',
      threadId: 'thread-1',
      turnId: 'turn-2',
      raw: {
        type: 'totallyUnknownThing',
        id: 'unknown-1',
        payload: { nested: true },
      },
    },
  ]);
});

test('normalizeResumeThreadResult keeps user messages chronological when raw ids repeat across turns or within the same turn', () => {
  const normalized = normalizeResumeThreadResult({
    thread: {
      id: 'thread-user-ordering',
      turns: [
        {
          id: 'turn-1',
          status: 'completed',
          items: [
            {
              type: 'userMessage',
              id: 'dup-user',
              content: [{ type: 'text', text: 'older question' }],
            },
            {
              type: 'agentMessage',
              id: 'assistant-1',
              text: 'older answer',
            },
          ],
        },
        {
          id: 'turn-2',
          status: 'completed',
          items: [
            {
              type: 'userMessage',
              id: 'dup-user',
              content: [{ type: 'text', text: 'newest primary question' }],
            },
            {
              type: 'userMessage',
              id: 'dup-user',
              content: [{ type: 'text', text: 'same-turn steer' }],
            },
            {
              type: 'agentMessage',
              id: 'assistant-2',
              text: 'latest answer',
            },
          ],
        },
      ],
    },
  });

  assert.deepEqual(normalized.messages, [
    {
      id: 'user:turn-1',
      kind: 'message',
      itemType: 'userMessage',
      role: 'user',
      text: 'older question',
      state: 'complete',
      threadId: 'thread-user-ordering',
      turnId: 'turn-1',
      content: [{ type: 'text', text: 'older question' }],
      raw: {
        type: 'userMessage',
        id: 'dup-user',
        content: [{ type: 'text', text: 'older question' }],
      },
    },
    {
      id: 'assistant-1',
      kind: 'message',
      itemType: 'agentMessage',
      role: 'assistant',
      text: 'older answer',
      state: 'complete',
      threadId: 'thread-user-ordering',
      turnId: 'turn-1',
      raw: {
        type: 'agentMessage',
        id: 'assistant-1',
        text: 'older answer',
      },
    },
    {
      id: 'user:turn-2',
      kind: 'message',
      itemType: 'userMessage',
      role: 'user',
      text: 'newest primary question',
      state: 'complete',
      threadId: 'thread-user-ordering',
      turnId: 'turn-2',
      content: [{ type: 'text', text: 'newest primary question' }],
      raw: {
        type: 'userMessage',
        id: 'dup-user',
        content: [{ type: 'text', text: 'newest primary question' }],
      },
    },
    {
      id: 'user:turn-2:u2',
      kind: 'message',
      itemType: 'userMessage',
      role: 'user',
      text: 'same-turn steer',
      state: 'complete',
      threadId: 'thread-user-ordering',
      turnId: 'turn-2',
      content: [{ type: 'text', text: 'same-turn steer' }],
      raw: {
        type: 'userMessage',
        id: 'dup-user',
        content: [{ type: 'text', text: 'same-turn steer' }],
      },
    },
    {
      id: 'assistant-2',
      kind: 'message',
      itemType: 'agentMessage',
      role: 'assistant',
      text: 'latest answer',
      state: 'complete',
      threadId: 'thread-user-ordering',
      turnId: 'turn-2',
      raw: {
        type: 'agentMessage',
        id: 'assistant-2',
        text: 'latest answer',
      },
    },
  ]);
});

test('normalizeResumeThreadResult assigns distinct canonical ids for three same-turn user messages with the same raw id', () => {
  const normalized = normalizeResumeThreadResult({
    thread: {
      id: 'thread-same-turn-user-ordering',
      turns: [
        {
          id: 'turn-3',
          status: 'completed',
          items: [
            {
              type: 'userMessage',
              id: 'dup-user',
              content: [{ type: 'text', text: 'start' }],
            },
            {
              type: 'userMessage',
              id: 'dup-user',
              content: [{ type: 'text', text: 'steer' }],
            },
            {
              type: 'userMessage',
              id: 'dup-user',
              content: [{ type: 'text', text: 'clarify' }],
            },
          ],
        },
      ],
    },
  });

  assert.deepEqual(
    normalized.messages.map(message => ({ id: message.id, text: message.text })),
    [
      { id: 'user:turn-3', text: 'start' },
      { id: 'user:turn-3:u2', text: 'steer' },
      { id: 'user:turn-3:u3', text: 'clarify' },
    ],
  );
});

test('normalizeResumeThreadResult degrades non-text user inputs to readable placeholders', () => {
  const normalized = normalizeResumeThreadResult({
    thread: {
      id: 'thread-2',
      turns: [
        {
          id: 'turn-media',
          status: 'completed',
          items: [
            {
              type: 'userMessage',
              id: 'user-media',
              content: [
                { type: 'mention', name: 'repo', path: 'app://repo' },
                { type: 'image', image_url: 'https://example.com/demo.png' },
                { type: 'localImage', path: 'C:/tmp/demo.png' },
              ],
            },
          ],
        },
      ],
    },
  });

  assert.deepEqual(normalized.messages, [
    {
      id: 'user:turn-media',
      kind: 'message',
      itemType: 'userMessage',
      role: 'user',
      text: '[mention: repo]\n\n[image]\n\n[localImage]',
      state: 'complete',
      threadId: 'thread-2',
      turnId: 'turn-media',
      content: [
        { type: 'mention', name: 'repo', path: 'app://repo' },
        { type: 'image', image_url: 'https://example.com/demo.png' },
        { type: 'localImage', path: 'C:/tmp/demo.png' },
      ],
      raw: {
        type: 'userMessage',
        id: 'user-media',
        content: [
          { type: 'mention', name: 'repo', path: 'app://repo' },
          { type: 'image', image_url: 'https://example.com/demo.png' },
          { type: 'localImage', path: 'C:/tmp/demo.png' },
        ],
      },
    },
  ]);
});

test('normalizeResumeThreadResult degrades out-of-scope media timeline items to fallback rows', () => {
  const normalized = normalizeResumeThreadResult({
    thread: {
      id: 'thread-media-fallback',
      turns: [
        {
          id: 'turn-media-fallback',
          status: 'inProgress',
          items: [
            {
              type: 'imageGeneration',
              id: 'image-generation-1',
              status: 'inProgress',
              prompt: 'Generate a UI mockup',
            },
            {
              type: 'imageView',
              id: 'image-view-1',
              status: 'completed',
              imageUrl: 'https://example.com/demo.png',
            },
          ],
        },
      ],
    },
  });

  assert.deepEqual(normalized.messages, [
    {
      id: 'image-generation-1',
      kind: 'fallback',
      itemType: 'imageGeneration',
      text: '[imageGeneration]',
      state: 'streaming',
      threadId: 'thread-media-fallback',
      turnId: 'turn-media-fallback',
      raw: {
        type: 'imageGeneration',
        id: 'image-generation-1',
        status: 'inProgress',
        prompt: 'Generate a UI mockup',
      },
    },
    {
      id: 'image-view-1',
      kind: 'fallback',
      itemType: 'imageView',
      text: '[imageView]',
      state: 'streaming',
      threadId: 'thread-media-fallback',
      turnId: 'turn-media-fallback',
      raw: {
        type: 'imageView',
        id: 'image-view-1',
        status: 'completed',
        imageUrl: 'https://example.com/demo.png',
      },
    },
  ]);
});

test('normalizeResumeThreadResult formats structured thread status metadata from resume payloads', () => {
  const normalized = normalizeResumeThreadResult({
    thread: {
      id: 'thread-meta',
      name: 'Issue 14 thread',
      collaborationModeKind: 'plan',
      status: {
        type: 'active',
        activeFlags: ['waitingOnUserInput'],
      },
      turns: [],
    },
  });

  assert.equal(normalized.threadName, 'Issue 14 thread');
  assert.equal(normalized.collaborationModeKind, 'plan');
  assert.equal(normalized.threadStatusText, 'active (waitingOnUserInput)');
  assert.equal(normalized.tokenUsageText, '');
});

test('normalizeResumeThreadResult keeps empty reasoning items as visible transcript rows', () => {
  const normalized = normalizeResumeThreadResult({
    thread: {
      id: 'thread-empty-reasoning',
      turns: [
        {
          id: 'turn-empty-reasoning',
          status: 'completed',
          items: [
            {
              type: 'reasoning',
              id: 'reasoning-empty',
              summary: [],
              content: [],
            },
            {
              type: 'agentMessage',
              id: 'assistant-after-reasoning',
              text: 'Visible answer',
            },
          ],
        },
      ],
    },
  });

  assert.deepEqual(normalized.messages, [
    {
      id: 'reasoning-empty',
      kind: 'special',
      itemType: 'reasoning',
      text: '',
      state: 'complete',
      threadId: 'thread-empty-reasoning',
      turnId: 'turn-empty-reasoning',
      raw: {
        type: 'reasoning',
        id: 'reasoning-empty',
        summary: [],
        content: [],
      },
    },
    {
      id: 'assistant-after-reasoning',
      kind: 'message',
      itemType: 'agentMessage',
      role: 'assistant',
      text: 'Visible answer',
      state: 'complete',
      threadId: 'thread-empty-reasoning',
      turnId: 'turn-empty-reasoning',
      raw: {
        type: 'agentMessage',
        id: 'assistant-after-reasoning',
        text: 'Visible answer',
      },
    },
  ]);
});

test('normalizeResumeThreadResult fails explicitly when the latest turn status is unknown', () => {
  assert.throws(
    () =>
      normalizeResumeThreadResult({
        thread: {
          id: 'thread-invalid-status',
          turns: [
            {
              id: 'turn-invalid',
              status: 'queued',
              items: [],
            },
          ],
        },
      }),
    error =>
      error instanceof Error &&
      error.message ===
        'resume thread latestTurn.status must be one of completed, interrupted, failed, in_progress, or inProgress.',
  );
});

test('normalizeResumeThreadResult marks the latest turn error as conversation-scoped transcript content', () => {
  const normalized = normalizeResumeThreadResult({
    thread: {
      id: 'thread-1',
      turns: [
        {
          id: 'turn-1',
          status: 'failed',
          error: {
            message: 'skill not found',
            codexErrorInfo: null,
            additionalDetails: null,
          },
          items: [],
        },
      ],
    },
  });

  assert.deepEqual(normalized.lastError, {
    message: 'skill not found',
    codexErrorInfo: null,
    additionalDetails: null,
    httpStatusCode: null,
    willRetry: null,
    threadId: 'thread-1',
    turnId: 'turn-1',
    presentationScope: 'conversation',
    source: 'thread_resume',
    raw: {
      message: 'skill not found',
      codexErrorInfo: null,
      additionalDetails: null,
    },
  });
});
