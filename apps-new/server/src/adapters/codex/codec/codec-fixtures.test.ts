import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import type { RuntimeCommand } from '../../../ports/index.js';
import type { CodexRuntimeLogger } from '../diagnostics/codex-runtime-logger.js';
import { parseCodexIncomingMessage } from '../protocol/codex-message.js';
import type { CodexIncomingMessage } from '../protocol/codex-message.js';
import { parseJsonValue } from './reader/index.js';
import { decodeCodexMessageToRuntimeEvent } from './event/decode-codex-message.js';
import { decodeCodexResultToRuntimeResult } from './result/decode-codex-result.js';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const fixtureDir = path.resolve(currentDir, '..', 'fixtures');

const silentLogger: CodexRuntimeLogger = {
  warn() {},
};

interface RuntimeResultFixtureCase {
  readonly fixture: string;
  readonly command: RuntimeCommand;
  readonly expectedKind: string;
}

async function readFixture(name: string): Promise<string> {
  return readFile(path.join(fixtureDir, name), 'utf-8');
}

async function readIncomingFixture(name: string): Promise<CodexIncomingMessage> {
  return parseCodexIncomingMessage(await readFixture(name));
}

describe('codex codec fixtures', () => {
  test('decodes real-shaped notification fixtures into runtime facts', async () => {
    const cases = [
      ['notification-thread-started.json', 'runtime-thread-started'],
      ['notification-thread-status-changed.json', 'runtime-thread-status-changed'],
      ['notification-turn-started.json', 'runtime-turn-started'],
      ['notification-turn-completed.json', 'runtime-turn-completed'],
      ['notification-item-started-agent-message.json', 'runtime-item-started'],
      ['notification-item-completed-command.json', 'runtime-item-completed'],
      ['notification-agent-message-delta.json', 'runtime-item-delta'],
      ['notification-command-output-delta.json', 'runtime-item-delta'],
      ['notification-system-notice.json', 'runtime-system-notice'],
      ['notification-runtime-error.json', 'runtime-error'],
    ] as const;

    const kinds: Array<string | null> = [];

    for (const [fixture] of cases) {
      const message = await readIncomingFixture(fixture);
      const event = decodeCodexMessageToRuntimeEvent({ message, logger: silentLogger });
      kinds.push(event?.kind ?? null);
    }

    assert.deepEqual(kinds, cases.map(([_fixture, expectedKind]) => expectedKind));
  });

  test('decodes a host request fixture without modeling approval or UI semantics', async () => {
    const message = await readIncomingFixture('server-request-host-placeholder.json');
    const event = decodeCodexMessageToRuntimeEvent({ message, logger: silentLogger });

    assert.deepEqual(event, {
      kind: 'runtime-host-requested',
      requestId: 'host-request-fixture',
      threadId: 'thread-fixture',
      turnId: 'turn-fixture',
      itemId: 'item-fixture',
      data: {
        threadId: 'thread-fixture',
        turnId: 'turn-fixture',
        itemId: 'item-fixture',
        prompt: 'This stays raw and is not modeled as UI text.',
      },
    });

    assert.equal('inputKind' in (event ?? {}), false);
    assert.equal('responseKind' in (event ?? {}), false);
    assert.equal('title' in (event ?? {}), false);
    assert.equal('prompt' in (event ?? {}), false);
  });

  test('decodes real-shaped result fixtures into runtime results', async () => {
    const cases: readonly RuntimeResultFixtureCase[] = [
      {
        fixture: 'result-thread-start.json',
        command: {
          kind: 'start-thread',
          workspace: 'D:/workspace',
          runtimeSettings: null,
          baseInstructions: null,
        },
        expectedKind: 'thread-started',
      },
      {
        fixture: 'result-thread-resume.json',
        command: {
          kind: 'resume-thread',
          threadId: 'thread-fixture',
          workspace: 'D:/workspace',
          runtimeSettings: null,
          baseInstructions: null,
        },
        expectedKind: 'thread-resumed',
      },
      {
        fixture: 'result-thread-list.json',
        command: {
          kind: 'list-threads',
          workspace: 'D:/workspace',
          archived: false,
          limit: 20,
        },
        expectedKind: 'threads-listed',
      },
      {
        fixture: 'result-thread-read.json',
        command: {
          kind: 'read-thread',
          threadId: 'thread-fixture',
          includeTurns: true,
        },
        expectedKind: 'thread-read',
      },
      {
        fixture: 'result-turn-start.json',
        command: {
          kind: 'start-turn',
          threadId: 'thread-fixture',
          message: 'hello',
          content: [],
          runtimeSettings: null,
        },
        expectedKind: 'turn-started',
      },
      {
        fixture: 'result-turn-steer.json',
        command: {
          kind: 'steer-turn',
          threadId: 'thread-fixture',
          expectedTurnId: 'turn-fixture',
          message: 'hello',
          content: [],
        },
        expectedKind: 'turn-steered',
      },
    ];

    const kinds: string[] = [];

    for (const fixtureCase of cases) {
      const message = parseCodexIncomingMessage(await readFixture(fixtureCase.fixture));
      assert.equal(message.kind, 'response');

      if (message.kind !== 'response') {
        continue;
      }

      kinds.push(decodeCodexResultToRuntimeResult({
        command: fixtureCase.command,
        result: message.result,
      }).kind);
    }

    assert.deepEqual(kinds, cases.map(fixtureCase => fixtureCase.expectedKind));
  });

  test('parses a real-shaped RPC error response fixture as an external error response', async () => {
    const payload = parseJsonValue(await readFixture('response-rpc-error.json'));
    const message = parseCodexIncomingMessage(JSON.stringify(payload));

    assert.deepEqual(message, {
      kind: 'error-response',
      id: '7',
      error: {
        code: -32000,
        message: 'runtime rejected request',
      },
    });
  });
});
