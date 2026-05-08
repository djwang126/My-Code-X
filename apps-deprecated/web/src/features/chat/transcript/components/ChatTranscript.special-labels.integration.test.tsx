import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderChatTranscriptPage as renderChatPage } from '../../../../pages/chat/test/renderChatTranscriptPage';

describe('ChatTranscript special labels integration', () => {
  it('renders collapsed hook prompts and reasoning rows with stable labels', () => {
    renderChatPage({
      messages: [
        {
          id: 'hook-1',
          kind: 'special',
          itemType: 'hookPrompt',
          text: 'System safety hook',
          state: 'complete',
          threadId: 'thread-1',
          turnId: 'turn-1',
          raw: {
            type: 'hookPrompt',
            id: 'hook-1',
            fragments: [{ text: 'System safety hook' }],
          },
        },
        {
          id: 'reason-1',
          kind: 'special',
          itemType: 'reasoning',
          text: 'Inspect tests before patching',
          state: 'complete',
          threadId: 'thread-1',
          turnId: 'turn-1',
          raw: {
            type: 'reasoning',
            id: 'reason-1',
            summary: [{ text: 'Inspect tests before patching' }],
            content: [{ text: 'raw reasoning block' }],
          },
        },
      ],
    });

    const hookPromptRow = screen.getByText('Hook prompt').closest('details');
    const reasoningRow = screen.getByText('Reasoning').closest('details');
    expect(hookPromptRow).not.toBeNull();
    expect(hookPromptRow).not.toHaveAttribute('open');
    expect(reasoningRow).not.toBeNull();
    expect(reasoningRow).not.toHaveAttribute('open');
    expect(screen.getByText('Reasoning')).toBeInTheDocument();
  });

  it('renders execution-oriented transcript items with human-readable labels', () => {
    renderChatPage({
      messages: [
        {
          id: 'cmd-1',
          kind: 'special',
          itemType: 'commandExecution',
          text: 'npm test',
          state: 'error',
          threadId: 'thread-1',
          turnId: 'turn-1',
          status: 'failed',
          raw: {
            type: 'commandExecution',
            id: 'cmd-1',
            command: 'npm test',
            cwd: 'D:/workspaces/sample',
            status: 'failed',
            aggregatedOutput: '1 failed',
            exitCode: 1,
            durationMs: 1234,
          },
        },
        {
          id: 'file-1',
          kind: 'special',
          itemType: 'fileChange',
          text: 'src/app.tsx',
          state: 'complete',
          threadId: 'thread-1',
          turnId: 'turn-1',
          status: 'completed',
          raw: {
            type: 'fileChange',
            id: 'file-1',
            status: 'completed',
            changes: [{ path: 'src/app.tsx', kind: 'update' }],
          },
        },
        {
          id: 'mcp-1',
          kind: 'special',
          itemType: 'mcpToolCall',
          text: 'filesystem.read_file',
          state: 'complete',
          threadId: 'thread-1',
          turnId: 'turn-1',
          status: 'completed',
          raw: {
            type: 'mcpToolCall',
            id: 'mcp-1',
            server: 'filesystem',
            tool: 'read_file',
            status: 'completed',
            arguments: { path: 'README.md' },
            result: 'ok',
          },
        },
        {
          id: 'dyn-1',
          kind: 'special',
          itemType: 'dynamicToolCall',
          text: 'request_user_input',
          state: 'complete',
          threadId: 'thread-1',
          turnId: 'turn-1',
          status: 'completed',
          raw: {
            type: 'dynamicToolCall',
            id: 'dyn-1',
            tool: 'request_user_input',
            status: 'completed',
            arguments: { prompt: 'Continue?' },
            contentItems: [{ type: 'text', text: 'Yes' }],
          },
        },
        {
          id: 'collab-1',
          kind: 'special',
          itemType: 'collabAgentToolCall',
          text: 'spawn_agent',
          state: 'streaming',
          threadId: 'thread-1',
          turnId: 'turn-1',
          status: 'inProgress',
          raw: {
            type: 'collabAgentToolCall',
            id: 'collab-1',
            tool: 'spawn_agent',
            status: 'inProgress',
            senderThreadId: 'thread-1',
            receiverThreadIds: ['thread-2'],
          },
        },
        {
          id: 'search-1',
          kind: 'special',
          itemType: 'webSearch',
          text: 'playwright test retry',
          state: 'complete',
          threadId: 'thread-1',
          turnId: 'turn-1',
          raw: {
            type: 'webSearch',
            id: 'search-1',
            query: 'playwright test retry',
            action: { type: 'search' },
          },
        },
      ],
    });

    expect(screen.getByText('Command execution')).toBeInTheDocument();
    expect(screen.getByText('File change')).toBeInTheDocument();
    expect(screen.getByText('MCP tool call')).toBeInTheDocument();
    expect(screen.getByText('Dynamic tool call')).toBeInTheDocument();
    expect(screen.getByText('Collab agent')).toBeInTheDocument();
    expect(screen.getByText('Web search')).toBeInTheDocument();
  });

  it('renders review mode and compaction transcript items with stable labels', () => {
    renderChatPage({
      messages: [
        {
          id: 'review-start-1',
          kind: 'special',
          itemType: 'enteredReviewMode',
          text: 'current changes',
          state: 'complete',
          threadId: 'thread-1',
          turnId: 'turn-1',
          raw: {
            type: 'enteredReviewMode',
            id: 'review-start-1',
            review: 'current changes',
          },
        },
        {
          id: 'review-end-1',
          kind: 'special',
          itemType: 'exitedReviewMode',
          text: 'Looks good overall',
          state: 'complete',
          threadId: 'thread-1',
          turnId: 'turn-1',
          raw: {
            type: 'exitedReviewMode',
            id: 'review-end-1',
            review: 'Looks good overall',
          },
        },
        {
          id: 'compact-1',
          kind: 'special',
          itemType: 'contextCompaction',
          text: 'Context compacted',
          state: 'complete',
          threadId: 'thread-1',
          turnId: 'turn-1',
          raw: {
            type: 'contextCompaction',
            id: 'compact-1',
          },
        },
      ],
    });

    expect(screen.getByText('Entered review mode')).toBeInTheDocument();
    expect(screen.getByText('Exited review mode')).toBeInTheDocument();
    expect(screen.getAllByText('Context compacted').length).toBeGreaterThan(0);
  });
});
