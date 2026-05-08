import fs from 'node:fs/promises';
import readline from 'node:readline';

const scenario = process.env.FAKE_CODEX_SCENARIO || 'streaming_happy';
const expectedWorkspaceCwd = process.env.FAKE_CODEX_EXPECTED_CWD || '';
const expectedClientName = process.env.FAKE_CODEX_EXPECTED_CLIENT_NAME || '';
const expectedClientTitle = process.env.FAKE_CODEX_EXPECTED_CLIENT_TITLE || '';
const requestLogPath = process.env.FAKE_CODEX_REQUEST_LOG_FILE || '';
const startLogPath = process.env.FAKE_CODEX_START_LOG_FILE || '';

const input = readline.createInterface({
  input: process.stdin,
  crlfDelay: Infinity,
});

function writeMessage(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function writeResponse(id, result) {
  writeMessage({ id, result });
}

function writeError(id, message) {
  writeMessage({
    id,
    error: {
      code: -32000,
      message,
    },
  });
}

function writeNotification(method, params) {
  writeMessage({ method, params });
}

async function appendRequestLog(entry) {
  if (!requestLogPath) {
    return;
  }

  await fs.appendFile(requestLogPath, `${JSON.stringify(entry)}\n`, 'utf8');
}

async function appendStartLog(entry) {
  if (!startLogPath) {
    return;
  }

  await fs.appendFile(startLogPath, `${JSON.stringify(entry)}\n`, 'utf8');
}

function toExtendedWindowsCwd(cwd) {
  if (!/^[A-Za-z]:\\/.test(cwd)) {
    return '';
  }

  return `\\\\?\\${cwd}`;
}

function buildAcceptedThreadListCwds(cwd) {
  if (!cwd) {
    return new Set();
  }

  const accepted = new Set([cwd]);

  if (!/^[A-Za-z]:\\/.test(cwd)) {
    return accepted;
  }

  accepted.add(toExtendedWindowsCwd(cwd));
  return accepted;
}

const threadListCallCountsByArchived = new Map();

appendStartLog({
  pid: process.pid,
  scenario,
  startedAt: new Date().toISOString(),
}).catch(() => {});

function createResumeThreadResult(threadId, cwd = 'D:/workspace/example-app') {
  return {
    thread: {
      id: threadId,
      preview: 'restored prompt',
      ephemeral: false,
      modelProvider: 'openai',
      createdAt: 1730910000,
      updatedAt: 1730910100,
      status: { type: 'idle' },
      path: `D:/fake/${threadId}.jsonl`,
      cwd,
      cliVersion: '0.0.0-test',
      source: 'codex_app_server',
      agentNickname: null,
      agentRole: null,
      gitInfo: null,
      name: null,
      turns: [
        {
          id: 'turn-restored',
          status: 'completed',
          error: null,
          items: [
            {
              type: 'userMessage',
              id: 'user:turn-restored',
              content: [{ type: 'text', text: 'restored prompt', text_elements: [] }],
            },
            {
              type: 'agentMessage',
              id: 'assistant:turn-restored',
              text: 'restored answer',
              phase: null,
              memoryCitation: null,
            },
          ],
        },
      ],
    },
    model: 'gpt-5.1-codex',
    modelProvider: 'openai',
    serviceTier: null,
    cwd,
    approvalPolicy: 'never',
    approvalsReviewer: 'user',
    sandbox: { type: 'dangerFullAccess' },
    reasoningEffort: null,
  };
}

function createStartedThreadResult(threadId, cwd = 'D:/workspace/example-app') {
  return {
    thread: {
      id: threadId,
      preview: '',
      ephemeral: false,
      modelProvider: 'openai',
      createdAt: 1730910000,
      updatedAt: 1730910000,
      status: { type: 'idle' },
      path: `D:/fake/${threadId}.jsonl`,
      cwd,
      cliVersion: '0.0.0-test',
      source: 'codex_app_server',
      agentNickname: null,
      agentRole: null,
      gitInfo: null,
      name: null,
      turns: [],
    },
    model: 'gpt-5.1-codex',
    modelProvider: 'openai',
    serviceTier: null,
    cwd,
    approvalPolicy: 'never',
    approvalsReviewer: 'user',
    sandbox: { type: 'dangerFullAccess' },
    reasoningEffort: null,
  };
}

function emitHappyTurnNotifications(threadId, turnId) {
  setTimeout(() => {
    writeNotification('turn/started', {
      threadId,
      turn: {
        id: turnId,
        items: [],
        status: 'inProgress',
        error: null,
      },
    });
  }, 5);

  setTimeout(() => {
    writeNotification('item/agentMessage/delta', {
      threadId,
      turnId,
      itemId: `assistant:${turnId}`,
      delta: 'Partial answer',
    });
  }, 10);

  setTimeout(() => {
    writeNotification('item/completed', {
      threadId,
      turnId,
      item: {
        type: 'agentMessage',
        id: `assistant:${turnId}`,
        text: 'Final answer',
        phase: null,
        memoryCitation: null,
      },
    });
  }, 15);

  setTimeout(() => {
    writeNotification('turn/completed', {
      threadId,
      turn: {
        id: turnId,
        items: [],
        status: 'completed',
        error: null,
      },
    });
  }, 20);
}

function createThreadListResult(cwd = 'D:/workspace/example-app') {
  return {
    data: [
      {
        id: 'thr-history',
        preview: 'History works',
        ephemeral: false,
        modelProvider: 'openai',
        createdAt: 1730910000,
        updatedAt: 1730910100,
        status: { type: 'idle' },
        path: 'D:/fake/thr-history.jsonl',
        cwd,
        cliVersion: '0.0.0-test',
        source: 'codex_app_server',
        agentNickname: null,
        agentRole: null,
        gitInfo: null,
        name: 'History thread',
        turns: [],
      },
    ],
    nextCursor: null,
  };
}

function createEmptyThreadListResult() {
  return {
    data: [],
    nextCursor: null,
  };
}

function nextThreadListCallCount(archived) {
  const currentCount = threadListCallCountsByArchived.get(Boolean(archived)) || 0;
  const nextCount = currentCount + 1;
  threadListCallCountsByArchived.set(Boolean(archived), nextCount);
  return nextCount;
}

input.on('line', line => {
  if (!line.trim()) return;

  const message = JSON.parse(line);

  if (message.method === 'initialize') {
    if (expectedClientName && message.params?.clientInfo?.name !== expectedClientName) {
      writeError(message.id, `initialize clientInfo.name mismatch: ${message.params?.clientInfo?.name || '<missing>'}`);
      return;
    }

    if (expectedClientTitle && message.params?.clientInfo?.title !== expectedClientTitle) {
      writeError(
        message.id,
        `initialize clientInfo.title mismatch: ${message.params?.clientInfo?.title || '<missing>'}`,
      );
      return;
    }

    if (scenario === 'initialize_error') {
      writeError(message.id, 'initialize exploded');
      return;
    }

    if (scenario === 'initialize_stderr_exit') {
      process.stderr.write('codex startup stderr exploded\n');
      process.exit(9);
      return;
    }

    writeResponse(message.id, {
      userAgent: 'fake-codex-app-server',
      codexHome: 'D:/fake/codex-home',
      platformFamily: 'windows',
      platformOs: 'windows',
    });
    return;
  }

  if (message.method === 'initialized') {
    return;
  }

  if (message.method === 'model/list') {
    writeResponse(message.id, {});
    return;
  }

  if (message.method === 'config/read') {
    writeResponse(message.id, null);
    return;
  }

  if (message.method === 'configRequirements/read') {
    writeResponse(message.id, null);
    return;
  }

  if (message.method === 'collaborationMode/list') {
    writeResponse(message.id, {});
    return;
  }

  if (message.method === 'thread/start') {
    appendRequestLog({
      method: 'thread/start',
      baseInstructions: message.params?.baseInstructions,
      cwd: message.params?.cwd,
      threadId: null,
    }).catch(() => {});

    if (scenario === 'workspace_cwd') {
      if (message.params?.cwd !== expectedWorkspaceCwd) {
        writeError(message.id, `thread/start cwd mismatch: ${message.params?.cwd || '<missing>'}`);
        return;
      }

      writeResponse(message.id, createStartedThreadResult('thr-stream', expectedWorkspaceCwd));
      return;
    }

    if (scenario === 'dynamic_tool_thread_start') {
      const dynamicTools = message.params?.dynamicTools;
      const expectedTool = dynamicTools?.[0];

      if (
        !Array.isArray(dynamicTools) ||
        dynamicTools.length !== 1 ||
        expectedTool?.name !== 'lookup_ticket' ||
        expectedTool?.description !== 'Fetch a ticket by id' ||
        expectedTool?.deferLoading !== true ||
        expectedTool?.inputSchema?.type !== 'object' ||
        expectedTool?.inputSchema?.properties?.id?.type !== 'string'
      ) {
        writeError(message.id, 'thread/start missing configured dynamic tools');
        return;
      }

      writeResponse(message.id, createStartedThreadResult('thr-dynamic-tools'));
      return;
    }

    writeResponse(message.id, createStartedThreadResult('thr-stream'));
    return;
  }

  if (message.method === 'thread/list') {
    if (scenario === 'workspace_cwd') {
      const acceptedThreadListCwds = buildAcceptedThreadListCwds(expectedWorkspaceCwd);
      if (!acceptedThreadListCwds.has(message.params?.cwd || '')) {
        writeError(message.id, `thread/list cwd mismatch: ${message.params?.cwd || '<missing>'}`);
        return;
      }

      writeResponse(message.id, createThreadListResult(expectedWorkspaceCwd));
      return;
    }

    if (scenario === 'workspace_cwd_query_fallback') {
      const threadListCallCount = nextThreadListCallCount(message.params?.archived);
      const extendedWorkspaceCwd = toExtendedWindowsCwd(expectedWorkspaceCwd);

      if (threadListCallCount === 1) {
        if (message.params?.cwd !== expectedWorkspaceCwd) {
          writeError(message.id, `thread/list expected plain cwd first: ${message.params?.cwd || '<missing>'}`);
          return;
        }

        writeResponse(message.id, createEmptyThreadListResult());
        return;
      }

      if (threadListCallCount === 2) {
        if (message.params?.cwd !== extendedWorkspaceCwd) {
          writeError(message.id, `thread/list expected extended cwd second: ${message.params?.cwd || '<missing>'}`);
          return;
        }

        writeResponse(message.id, createThreadListResult(expectedWorkspaceCwd));
        return;
      }

      writeError(message.id, `thread/list expected exactly two fallback queries, received ${threadListCallCount}`);
      return;
    }

    if (scenario === 'workspace_cwd_query_plain_hit') {
      const threadListCallCount = nextThreadListCallCount(message.params?.archived);

      if (threadListCallCount !== 1) {
        writeError(message.id, `thread/list expected a single plain-hit query, received ${threadListCallCount}`);
        return;
      }

      if (message.params?.cwd !== expectedWorkspaceCwd) {
        writeError(message.id, `thread/list expected plain cwd only: ${message.params?.cwd || '<missing>'}`);
        return;
      }

      writeResponse(message.id, createThreadListResult(expectedWorkspaceCwd));
      return;
    }

    if (scenario === 'workspace_cwd_query_plain_error') {
      const threadListCallCount = nextThreadListCallCount(message.params?.archived);

      if (threadListCallCount !== 1) {
        writeError(message.id, `thread/list should not retry after a plain-path error, received ${threadListCallCount}`);
        return;
      }

      if (message.params?.cwd !== expectedWorkspaceCwd) {
        writeError(message.id, `thread/list expected plain cwd before error: ${message.params?.cwd || '<missing>'}`);
        return;
      }

      writeError(message.id, 'thread/list plain query exploded');
      return;
    }

    if (scenario === 'workspace_cwd_query_empty') {
      const threadListCallCount = nextThreadListCallCount(message.params?.archived);
      const extendedWorkspaceCwd = toExtendedWindowsCwd(expectedWorkspaceCwd);

      if (threadListCallCount === 1) {
        if (message.params?.cwd !== expectedWorkspaceCwd) {
          writeError(message.id, `thread/list expected plain cwd first: ${message.params?.cwd || '<missing>'}`);
          return;
        }

        writeResponse(message.id, createEmptyThreadListResult());
        return;
      }

      if (threadListCallCount === 2) {
        if (message.params?.cwd !== extendedWorkspaceCwd) {
          writeError(message.id, `thread/list expected extended cwd second: ${message.params?.cwd || '<missing>'}`);
          return;
        }

        writeResponse(message.id, createEmptyThreadListResult());
        return;
      }

      writeError(message.id, `thread/list expected exactly two empty queries, received ${threadListCallCount}`);
      return;
    }

    if (scenario === 'workspace_cwd_history_query_fallback') {
      const archived = Boolean(message.params?.archived);
      const threadListCallCount = nextThreadListCallCount(archived);
      const extendedWorkspaceCwd = toExtendedWindowsCwd(expectedWorkspaceCwd);

      if (threadListCallCount === 1) {
        if (message.params?.cwd !== expectedWorkspaceCwd) {
          writeError(message.id, `thread/list expected plain cwd first: ${message.params?.cwd || '<missing>'}`);
          return;
        }

        writeResponse(message.id, createEmptyThreadListResult());
        return;
      }

      if (threadListCallCount === 2) {
        if (message.params?.cwd !== extendedWorkspaceCwd) {
          writeError(message.id, `thread/list expected extended cwd second: ${message.params?.cwd || '<missing>'}`);
          return;
        }

        writeResponse(message.id, archived ? createEmptyThreadListResult() : createThreadListResult(expectedWorkspaceCwd));
        return;
      }

      writeError(
        message.id,
        `thread/list expected exactly two fallback queries for archived=${archived}, received ${threadListCallCount}`,
      );
      return;
    }

    writeResponse(message.id, createThreadListResult());
    return;
  }

  if (message.method === 'thread/name/set') {
    writeResponse(message.id, {});
    return;
  }

  if (message.method === 'thread/resume') {
    appendRequestLog({
      method: 'thread/resume',
      baseInstructions: message.params?.baseInstructions,
      cwd: message.params?.cwd,
      threadId: message.params?.threadId || null,
    }).catch(() => {});

    if (scenario === 'workspace_cwd' && message.params?.cwd !== expectedWorkspaceCwd) {
      writeError(message.id, `thread/resume cwd mismatch: ${message.params?.cwd || '<missing>'}`);
      return;
    }

    writeResponse(
      message.id,
      createResumeThreadResult(message.params.threadId, scenario === 'workspace_cwd' ? expectedWorkspaceCwd : undefined),
    );
    return;
  }

  if (message.method === 'turn/start') {
    if (scenario === 'workspace_cwd' && message.params?.cwd !== expectedWorkspaceCwd) {
      writeError(message.id, `turn/start cwd mismatch: ${message.params?.cwd || '<missing>'}`);
      return;
    }

    if (scenario === 'stderr_on_turn_start') {
      process.stderr.write('codex turn stderr exploded\n');
      process.exit(7);
      return;
    }

    writeResponse(message.id, {
      turn: {
        id: 'turn-stream',
        items: [],
        status: 'inProgress',
        error: null,
      },
    });

    if (scenario === 'streaming_happy') {
      emitHappyTurnNotifications(message.params.threadId, 'turn-stream');
    }

    return;
  }

  if (message.method === 'thread/fork') {
    if (scenario === 'workspace_cwd' && message.params?.cwd !== expectedWorkspaceCwd) {
      writeError(message.id, `thread/fork cwd mismatch: ${message.params?.cwd || '<missing>'}`);
      return;
    }

    writeResponse(
      message.id,
      createResumeThreadResult(
        'thr-forked',
        scenario === 'workspace_cwd' ? expectedWorkspaceCwd : undefined,
      ),
    );
    return;
  }

  if (message.method === 'thread/rollback') {
    if (scenario === 'workspace_cwd' && message.params?.cwd !== expectedWorkspaceCwd) {
      writeError(message.id, `thread/rollback cwd mismatch: ${message.params?.cwd || '<missing>'}`);
      return;
    }

    writeResponse(
      message.id,
      createResumeThreadResult(
        message.params.threadId,
        scenario === 'workspace_cwd' ? expectedWorkspaceCwd : undefined,
      ),
    );
  }
});
