import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CodexTurnLifecycleParseError,
  parseCodexTerminalTurnLifecycle,
  parseCodexTurnLifecycle,
  readCodexTurnLifecycle,
} from './derive-codex-turn-lifecycle.js';

test('readCodexTurnLifecycle maps supported Codex turn statuses', () => {
  assert.equal(readCodexTurnLifecycle('inProgress'), 'running');
  assert.equal(readCodexTurnLifecycle('in_progress'), 'running');
  assert.equal(readCodexTurnLifecycle('completed'), 'completed');
  assert.equal(readCodexTurnLifecycle('interrupted'), 'interrupted');
  assert.equal(readCodexTurnLifecycle('failed'), 'failed');
  assert.equal(readCodexTurnLifecycle(undefined), null);
});

test('parseCodexTurnLifecycle fails explicitly for unknown statuses', () => {
  assert.equal(parseCodexTurnLifecycle('completed'), 'completed');
  assert.throws(
    () => parseCodexTurnLifecycle('queued', { fieldName: 'resume thread latestTurn.status' }),
    error =>
      error instanceof CodexTurnLifecycleParseError &&
      error.message === 'resume thread latestTurn.status must be one of completed, interrupted, failed, in_progress, or inProgress.',
  );
});

test('parseCodexTerminalTurnLifecycle only accepts terminal Codex statuses', () => {
  assert.equal(parseCodexTerminalTurnLifecycle('completed'), 'completed');
  assert.equal(parseCodexTerminalTurnLifecycle('interrupted'), 'interrupted');
  assert.equal(parseCodexTerminalTurnLifecycle('failed'), 'failed');
  assert.throws(
    () => parseCodexTerminalTurnLifecycle('inProgress', { fieldName: 'turn completed event.turn.status' }),
    error =>
      error instanceof CodexTurnLifecycleParseError &&
      error.message ===
        'turn completed event.turn.status must resolve to a terminal lifecycle: completed, interrupted, or failed.',
  );
});
