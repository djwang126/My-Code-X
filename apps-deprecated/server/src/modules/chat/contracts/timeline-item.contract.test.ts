import test from 'node:test';
import assert from 'node:assert/strict';

import { readTimelineItemContentPayload, serializeTimelineItemForPublic } from './timeline-item.contract.js';

test('serializeTimelineItemForPublic keeps command execution items title-only in the public transcript payload', () => {
  const item = {
    id: 'cmd-12-lines',
    kind: 'special',
    itemType: 'commandExecution',
    text: 'npm test',
    state: 'complete',
    threadId: 'thread-1',
    turnId: 'turn-1',
    raw: {
      type: 'commandExecution',
      id: 'cmd-12-lines',
      command: 'npm test',
      aggregatedOutput: `${Array.from({ length: 12 }, (_, index) => `command line ${index + 1}`).join('\n')}\n`,
    },
  };

  const serialized = serializeTimelineItemForPublic(item);

  assert.equal(serialized.text, '');
  assert.deepEqual(serialized.raw, {
    type: 'commandExecution',
    id: 'cmd-12-lines',
    detailRevision: serialized.raw.detailRevision,
    detailAvailable: true,
  });
});

test('serializeTimelineItemForPublic keeps file-change items title-only in the public transcript payload', () => {
  const item = {
    id: 'file-12-lines',
    kind: 'special',
    itemType: 'fileChange',
    text: 'src/app.tsx',
    state: 'complete',
    threadId: 'thread-1',
    turnId: 'turn-1',
    raw: {
      type: 'fileChange',
      id: 'file-12-lines',
      changes: [{ path: 'src/app.tsx', kind: 'update' }],
      output: `${Array.from({ length: 12 }, (_, index) => `file line ${index + 1}`).join('\n')}\n`,
    },
  };

  const serialized = serializeTimelineItemForPublic(item);

  assert.equal(serialized.text, '');
  assert.deepEqual(serialized.raw, {
    type: 'fileChange',
    id: 'file-12-lines',
    detailRevision: serialized.raw.detailRevision,
    detailAvailable: true,
  });
});

test('serializeTimelineItemForPublic changes the hidden detail revision when a hidden command output changes', () => {
  const createItem = aggregatedOutput => ({
    id: 'cmd-hidden-tail',
    kind: 'special',
    itemType: 'commandExecution',
    text: 'npm test',
    state: 'complete',
    threadId: 'thread-1',
    turnId: 'turn-1',
    raw: {
      type: 'commandExecution',
      id: 'cmd-hidden-tail',
      command: 'npm test',
      aggregatedOutput,
    },
  });

  const original = serializeTimelineItemForPublic(
    createItem(
      [
        ...Array.from({ length: 10 }, (_, index) => `command line ${index + 1}`),
        'command line 11',
        'command line 12',
      ].join('\n'),
    ),
  );
  const updated = serializeTimelineItemForPublic(
    createItem(
      [
        ...Array.from({ length: 10 }, (_, index) => `command line ${index + 1}`),
        'command line 11',
        'command line 12 (updated)',
      ].join('\n'),
    ),
  );

  assert.notEqual(original.raw.detailRevision, updated.raw.detailRevision);
});

test('readTimelineItemContentPayload returns full command execution details on demand', () => {
  const payload = readTimelineItemContentPayload({
    id: 'cmd-1',
    kind: 'special',
    itemType: 'commandExecution',
    text: '',
    state: 'complete',
    threadId: 'thread-1',
    turnId: 'turn-1',
    raw: {
      type: 'commandExecution',
      id: 'cmd-1',
      command: 'npm test',
      cwd: 'D:/workspace/example-app',
      aggregatedOutput: 'PASS 42 tests',
      exitCode: 0,
      durationMs: 123,
    },
  });

  assert.deepEqual(payload, {
    itemId: 'cmd-1',
    itemType: 'commandExecution',
    detailRevision: payload.detailRevision,
    raw: {
      type: 'commandExecution',
      id: 'cmd-1',
      command: 'npm test',
      cwd: 'D:/workspace/example-app',
      aggregatedOutput: 'PASS 42 tests',
      exitCode: 0,
      durationMs: 123,
    },
  });
});
