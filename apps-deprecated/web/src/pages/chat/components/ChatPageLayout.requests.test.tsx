import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ChatPageLayout } from '..';
import { buildChatPageProps, renderChatPage } from './ChatPageLayout.test-helpers';

describe('ChatPageLayout pending requests', () => {
  function setTextboxValue(name: string, value: string) {
    fireEvent.change(screen.getByRole('textbox', { name }), {
      target: { value },
    });
  }

  function setTextboxByPlaceholder(placeholder: string, value: string) {
    fireEvent.change(screen.getByPlaceholderText(placeholder), {
      target: { value },
    });
  }

  it('renders approval requests and submits decision responses', async () => {
    const onRequestResponse = vi.fn(async () => true);
    const user = userEvent.setup();

    renderChatPage({
      pendingRequests: [
        {
          id: 'req-1',
          method: 'item/commandExecution/requestApproval',
          kind: 'command_approval',
          threadId: 'thread-1',
          turnId: 'turn-1',
          itemId: 'cmd-1',
          title: 'Approve command execution',
          prompt: '**Review** `npm test`',
          command: '# shell heading',
          cwd: 'D:/workspaces/sample',
          submitState: 'idle',
          raw: {},
        },
      ],
      onRequestResponse,
    });

    expect(screen.getByText('Approve command execution')).toBeInTheDocument();
    expect(screen.getByText('Review', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getAllByText('npm test').length).toBeGreaterThan(0);
    expect(screen.getByText('# shell heading')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'shell heading' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Approve' }));

    await waitFor(() =>
      expect(onRequestResponse).toHaveBeenCalledWith('req-1', {
        decision: 'accept',
      }),
    );
  });

  it('renders item-bound and turn-bound requests inline while keeping threadless requests in the fallback section', () => {
    renderChatPage({
      pendingRequests: [
        {
          id: 'req-item',
          method: 'item/commandExecution/requestApproval',
          kind: 'command_approval',
          threadId: 'thread-1',
          turnId: 'turn-1',
          itemId: 'cmd-1',
          title: 'Approve command execution',
          prompt: 'npm test',
          command: 'npm test',
          submitState: 'idle',
          raw: {},
        },
        {
          id: 'req-turn',
          method: 'item/tool/requestUserInput',
          kind: 'user_input',
          threadId: 'thread-1',
          turnId: 'turn-2',
          title: 'Answer 1 question',
          prompt: '',
          questions: [
            {
              id: 'environment',
              header: 'Env',
              question: 'Which environment should I use?',
              options: [{ label: 'Staging', description: 'Use staging' }],
            },
          ],
          submitState: 'idle',
          raw: {},
        },
        {
          id: 'req-auth',
          method: 'account/chatgptAuthTokens/refresh',
          kind: 'auth_refresh',
          threadId: '',
          turnId: null,
          title: 'Refresh ChatGPT authentication',
          prompt: 'Codex needs refreshed ChatGPT credentials.',
          submitState: 'idle',
          raw: {},
        },
      ],
      messages: [
        {
          id: 'assistant-1',
          kind: 'message',
          itemType: 'agentMessage',
          role: 'assistant',
          text: 'Reviewing the command now.',
          state: 'streaming',
          threadId: 'thread-1',
          turnId: 'turn-1',
        },
        {
          id: 'cmd-1',
          kind: 'special',
          itemType: 'commandExecution',
          text: 'npm test',
          state: 'streaming',
          threadId: 'thread-1',
          turnId: 'turn-1',
          raw: {
            type: 'commandExecution',
            id: 'cmd-1',
            command: 'npm test',
          },
        },
        {
          id: 'assistant-2',
          kind: 'message',
          itemType: 'agentMessage',
          role: 'assistant',
          text: 'Still waiting for your choice.',
          state: 'streaming',
          threadId: 'thread-1',
          turnId: 'turn-2',
        },
      ],
    });

    expect(
      within(screen.getByLabelText('pending requests for assistant-1')).getByText('Approve command execution'),
    ).toBeInTheDocument();
    expect(within(screen.getByLabelText('pending requests for assistant-2')).getByText('Answer 1 question')).toBeInTheDocument();

    const fallbackRequests = screen.getByRole('region', { name: 'pending requests' });
    expect(within(fallbackRequests).getByText('Refresh ChatGPT authentication')).toBeInTheDocument();
    expect(within(fallbackRequests).queryByText('Approve command execution')).not.toBeInTheDocument();
    expect(within(fallbackRequests).queryByText('Answer 1 question')).not.toBeInTheDocument();
  });

  it('keeps a request-user-input card attached to the original fallback message instead of the latest turn message', () => {
    const view = renderChatPage({
      pendingRequests: [
        {
          id: 'req-sticky',
          method: 'item/tool/requestUserInput',
          kind: 'user_input',
          threadId: 'thread-1',
          turnId: 'turn-2',
          itemId: 'ask-missing',
          title: 'Answer 1 question',
          prompt: '',
          questions: [
            {
              id: 'environment',
              header: 'Env',
              question: 'Which environment should I use?',
              options: [{ label: 'Staging', description: 'Use staging' }],
            },
          ],
          submitState: 'idle',
          raw: {},
        },
      ],
      messages: [
        {
          id: 'assistant-earlier',
          kind: 'message',
          itemType: 'agentMessage',
          role: 'assistant',
          text: 'First assistant message.',
          state: 'complete',
          threadId: 'thread-1',
          turnId: 'turn-2',
        },
      ],
    });

    expect(
      within(screen.getByLabelText('pending requests for assistant-earlier')).getByText('Answer 1 question'),
    ).toBeInTheDocument();

    view.rerender(
      <ChatPageLayout
        {...buildChatPageProps({
          pendingRequests: [
            {
              id: 'req-sticky',
              method: 'item/tool/requestUserInput',
              kind: 'user_input',
              threadId: 'thread-1',
              turnId: 'turn-2',
              itemId: 'ask-missing',
              title: 'Answer 1 question',
              prompt: '',
              questions: [
                {
                  id: 'environment',
                  header: 'Env',
                  question: 'Which environment should I use?',
                  options: [{ label: 'Staging', description: 'Use staging' }],
                },
              ],
              submitState: 'idle',
              raw: {},
            },
          ],
          messages: [
            {
              id: 'assistant-earlier',
              kind: 'message',
              itemType: 'agentMessage',
              role: 'assistant',
              text: 'First assistant message.',
              state: 'complete',
              threadId: 'thread-1',
              turnId: 'turn-2',
            },
            {
              id: 'assistant-later',
              kind: 'message',
              itemType: 'agentMessage',
              role: 'assistant',
              text: 'Later assistant message.',
              state: 'streaming',
              threadId: 'thread-1',
              turnId: 'turn-2',
            },
            {
              id: 'assistant-latest',
              kind: 'message',
              itemType: 'agentMessage',
              role: 'assistant',
              text: 'Even later assistant message.',
              state: 'streaming',
              threadId: 'thread-1',
              turnId: 'turn-2',
            },
          ],
        })}
      />,
    );

    expect(
      within(screen.getByLabelText('pending requests for assistant-earlier')).getByText('Answer 1 question'),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('pending requests for assistant-later')).toBeNull();
    expect(screen.queryByLabelText('pending requests for assistant-latest')).toBeNull();
  });

  it('keeps command approvals attached to the latest turn message when newer assistant messages arrive', () => {
    const view = renderChatPage({
      pendingRequests: [
        {
          id: 'req-turn-approval',
          method: 'item/commandExecution/requestApproval',
          kind: 'command_approval',
          threadId: 'thread-1',
          turnId: 'turn-3',
          itemId: 'cmd-missing',
          title: 'Approve command execution',
          prompt: 'Review command',
          command: 'npm test',
          submitState: 'idle',
          raw: {},
        },
      ],
      messages: [
        {
          id: 'assistant-first',
          kind: 'message',
          itemType: 'agentMessage',
          role: 'assistant',
          text: 'First message.',
          state: 'complete',
          threadId: 'thread-1',
          turnId: 'turn-3',
        },
      ],
    });

    expect(
      within(screen.getByLabelText('pending requests for assistant-first')).getByText('Approve command execution'),
    ).toBeInTheDocument();

    view.rerender(
      <ChatPageLayout
        {...buildChatPageProps({
          pendingRequests: [
            {
              id: 'req-turn-approval',
              method: 'item/commandExecution/requestApproval',
              kind: 'command_approval',
              threadId: 'thread-1',
              turnId: 'turn-3',
              itemId: 'cmd-missing',
              title: 'Approve command execution',
              prompt: 'Review command',
              command: 'npm test',
              submitState: 'idle',
              raw: {},
            },
          ],
          messages: [
            {
              id: 'assistant-first',
              kind: 'message',
              itemType: 'agentMessage',
              role: 'assistant',
              text: 'First message.',
              state: 'complete',
              threadId: 'thread-1',
              turnId: 'turn-3',
            },
            {
              id: 'assistant-second',
              kind: 'message',
              itemType: 'agentMessage',
              role: 'assistant',
              text: 'Second message.',
              state: 'streaming',
              threadId: 'thread-1',
              turnId: 'turn-3',
            },
          ],
        })}
      />,
    );

    expect(screen.queryByLabelText('pending requests for assistant-first')).toBeNull();
    expect(
      within(screen.getByLabelText('pending requests for assistant-second')).getByText('Approve command execution'),
    ).toBeInTheDocument();
  });

  it('honors server-provided approval decisions instead of only using the default button matrix', async () => {
    const onRequestResponse = vi.fn(async () => true);
    const user = userEvent.setup();

    renderChatPage({
      pendingRequests: [
        {
          id: 'req-choices',
          method: 'item/commandExecution/requestApproval',
          kind: 'command_approval',
          threadId: 'thread-1',
          turnId: 'turn-1',
          itemId: 'cmd-1',
          title: 'Approve command execution',
          prompt: 'Review network access',
          command: 'curl https://example.com',
          submitState: 'idle',
          availableDecisions: [
            'accept',
            {
              applyNetworkPolicyAmendment: {
                network_policy_amendment: {
                  host: 'example.com',
                  action: 'allow',
                },
              },
            },
            'decline',
          ],
          raw: {},
        },
      ],
      messages: [
        {
          id: 'cmd-1',
          kind: 'special',
          itemType: 'commandExecution',
          text: 'curl https://example.com',
          state: 'streaming',
          threadId: 'thread-1',
          turnId: 'turn-1',
          raw: {
            type: 'commandExecution',
            id: 'cmd-1',
            command: 'curl https://example.com',
          },
        },
      ],
      onRequestResponse,
    });

    expect(screen.queryByRole('button', { name: 'Approve for session' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Approve' })).toHaveClass('pending-request-action-primary');
    expect(screen.getByRole('button', { name: 'Apply network policy amendment' })).not.toHaveClass(
      'pending-request-action-primary',
    );

    await user.click(screen.getByRole('button', { name: 'Apply network policy amendment' }));

    await waitFor(() =>
      expect(onRequestResponse).toHaveBeenCalledWith('req-choices', {
        decision: {
          applyNetworkPolicyAmendment: {
            network_policy_amendment: {
              host: 'example.com',
              action: 'allow',
            },
          },
        },
      }),
    );
  });

  it(
    'renders interactive request cards for user input, MCP elicitation, dynamic tool calls, and auth refresh',
    async () => {
      const onRequestResponse = vi.fn(async () => true);
      const user = userEvent.setup();

    renderChatPage({
      pendingRequests: [
        {
          id: 'req-input',
          method: 'item/tool/requestUserInput',
          kind: 'user_input',
          threadId: 'thread-1',
          turnId: 'turn-1',
          itemId: 'ask-1',
          title: 'Answer **1** question',
          prompt: '',
          questions: [
            {
              id: 'environment',
              header: 'Env',
              question: 'Which environment should I use?',
              isOther: true,
              options: [
                { label: 'Staging', description: 'Use **staging**' },
                { label: 'Production', description: 'Use prod' },
              ],
            },
          ],
          submitState: 'idle',
          raw: {},
        },
        {
          id: 'req-mcp',
          method: 'mcpServer/elicitation/request',
          kind: 'mcp_elicitation',
          threadId: 'thread-1',
          turnId: 'turn-1',
          title: 'MCP server input',
          prompt: 'Which repository should I inspect?',
          serverName: 'filesystem',
          mode: 'form',
          requestedSchema: {
            type: 'object',
            properties: {
              repo: {
                type: 'string',
                title: 'Repository',
              },
            },
          },
          submitState: 'idle',
          raw: {},
        },
        {
          id: 'req-tool',
          method: 'item/tool/call',
          kind: 'tool_call',
          threadId: 'thread-1',
          turnId: 'turn-1',
          callId: 'call-1',
          title: 'Dynamic tool call',
          prompt: 'lookup_ticket',
          tool: 'lookup_ticket',
          arguments: { id: 'ABC-123' },
          submitState: 'idle',
          raw: {},
        },
        {
          id: 'req-auth',
          method: 'account/chatgptAuthTokens/refresh',
          kind: 'auth_refresh',
          threadId: '',
          turnId: null,
          title: 'Refresh ChatGPT authentication',
          prompt: 'Codex needs refreshed ChatGPT credentials.',
          previousAccountId: 'acct-9',
          reason: 'unauthorized',
          submitState: 'idle',
          raw: {},
        },
      ],
      onRequestResponse,
    });

    expect(screen.getByRole('heading', { name: 'Answer 1 question' })).toBeInTheDocument();
    expect(screen.getByText('1', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getByText('MCP server input')).toBeInTheDocument();
    expect(screen.getByText('Dynamic tool call')).toBeInTheDocument();
    expect(screen.getByText('Refresh ChatGPT authentication')).toBeInTheDocument();
    expect(screen.getByText('staging', { selector: 'strong' })).toBeInTheDocument();
    const otherInput = screen.getByPlaceholderText('Other');
    expect(screen.queryByText('Env', { selector: '.pending-request-input-group > span' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'Staging' }));
    expect(otherInput).toHaveValue('');
    await user.click(screen.getByRole('button', { name: 'Submit input' }));
    await waitFor(() =>
      expect(onRequestResponse).toHaveBeenCalledWith('req-input', {
        answers: {
          environment: {
            answers: ['Staging'],
          },
        },
      }),
    );

    setTextboxByPlaceholder('Other', '  Surprise me  ');
    await user.click(screen.getByRole('button', { name: 'Submit input' }));
    await waitFor(() =>
      expect(onRequestResponse).toHaveBeenCalledWith('req-input', {
        answers: {
          environment: {
            answers: ['  Surprise me  '],
          },
        },
      }),
    );

    setTextboxValue('Repository', 'My-Code-X');
    await user.click(screen.getByRole('button', { name: 'Submit form' }));
    await waitFor(() =>
      expect(onRequestResponse).toHaveBeenCalledWith('req-mcp', {
        action: 'accept',
        content: {
          repo: 'My-Code-X',
        },
      }),
    );

    setTextboxValue('Tool response', 'Ticket ABC-123 is open.');
    await user.click(screen.getByRole('button', { name: 'Send tool response' }));
    await waitFor(() =>
      expect(onRequestResponse).toHaveBeenCalledWith('req-tool', {
        success: true,
        contentItems: [
          {
            type: 'inputText',
            text: 'Ticket ABC-123 is open.',
          },
        ],
      }),
    );

    setTextboxValue('Access token', 'token-123');
    setTextboxValue('Account id', 'acct-9');
    setTextboxValue('Plan type', 'plus');
    await user.click(screen.getByRole('button', { name: 'Submit tokens' }));
    await waitFor(() =>
      expect(onRequestResponse).toHaveBeenCalledWith('req-auth', {
        accessToken: 'token-123',
        chatgptAccountId: 'acct-9',
        chatgptPlanType: 'plus',
      }),
    );
    },
    15000,
  );

  it('supports MCP URL-mode accept, decline, and cancel actions', async () => {
    const onRequestResponse = vi.fn(async () => true);
    const user = userEvent.setup();

    renderChatPage({
      pendingRequests: [
        {
          id: 'req-url',
          method: 'mcpServer/elicitation/request',
          kind: 'mcp_elicitation',
          threadId: 'thread-1',
          turnId: 'turn-1',
          title: 'Open browser authorization',
          prompt: 'Finish login in your browser.',
          serverName: 'filesystem',
          mode: 'url',
          url: 'https://example.com/auth',
          elicitationId: 'eli-1',
          submitState: 'idle',
          raw: {},
        },
      ],
      onRequestResponse,
    });

    expect(screen.getByRole('link', { name: 'Open URL' })).toHaveAttribute('href', 'https://example.com/auth');
    expect(screen.getByRole('link', { name: 'Open URL' })).toHaveClass('pending-request-action');
    expect(screen.getByRole('button', { name: 'Accept' })).toHaveClass('pending-request-action-primary');
    expect(screen.getByRole('link', { name: 'Open URL' })).not.toHaveClass('pending-request-action-primary');

    await user.click(screen.getByRole('button', { name: 'Accept' }));
    await waitFor(() =>
      expect(onRequestResponse).toHaveBeenCalledWith('req-url', {
        action: 'accept',
        content: null,
      }),
    );

    await user.click(screen.getByRole('button', { name: 'Decline' }));
    await waitFor(() =>
      expect(onRequestResponse).toHaveBeenCalledWith('req-url', {
        action: 'decline',
        content: null,
      }),
    );

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() =>
      expect(onRequestResponse).toHaveBeenCalledWith('req-url', {
        action: 'cancel',
        content: null,
      }),
    );
  });

  it('marks request-user-input cards from older turns as expired and disables submission', async () => {
    const onRequestResponse = vi.fn(async () => true);
    const user = userEvent.setup();

    renderChatPage({
      threadId: 'thread-1',
      turnExecution: {
        activeTurnId: 'turn-2',
        turnLifecycle: 'running',
      },
      pendingRequests: [
        {
          id: 'req-input-stale',
          method: 'item/tool/requestUserInput',
          kind: 'user_input',
          threadId: 'thread-1',
          turnId: 'turn-1',
          itemId: 'ask-1',
          title: 'Answer **1** question',
          prompt: '',
          questions: [
            {
              id: 'environment',
              header: 'Env',
              question: 'Which environment should I use?',
              options: [{ label: 'Staging', description: 'Use staging' }],
            },
          ],
          submitState: 'idle',
          raw: {},
        },
      ],
      onRequestResponse,
    });

    expect(screen.getByText('Expired')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Staging' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Submit input' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Submit input' }));
    expect(onRequestResponse).not.toHaveBeenCalled();
  });
});
