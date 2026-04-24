import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ChatPageLayout } from '..';
import { buildChatPageProps, renderChatPage } from './ChatPageLayout.test-helpers';

describe('ChatPageLayout transcript scroll follow', () => {
  it('does not force-scroll to the bottom while the user is reading older transcript history', () => {
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });

    const view = renderChatPage({
      messages: [
        {
          id: 'assistant-earlier',
          kind: 'message',
          itemType: 'agentMessage',
          role: 'assistant',
          text: 'Earlier message',
          state: 'complete',
          threadId: 'thread-1',
          turnId: 'turn-1',
        },
      ],
    });

    const transcriptSection = screen.getByLabelText('chat transcript section');

    Object.defineProperty(transcriptSection, 'clientHeight', { configurable: true, value: 400 });
    Object.defineProperty(transcriptSection, 'scrollHeight', { configurable: true, value: 1200 });
    Object.defineProperty(transcriptSection, 'scrollTop', { configurable: true, value: 0, writable: true });

    fireEvent.scroll(transcriptSection);
    scrollIntoView.mockClear();

    view.rerender(
      <ChatPageLayout
        {...buildChatPageProps({
          messages: [
            {
              id: 'assistant-earlier',
              kind: 'message',
              itemType: 'agentMessage',
              role: 'assistant',
              text: 'Earlier message',
              state: 'complete',
              threadId: 'thread-1',
              turnId: 'turn-1',
            },
            {
              id: 'assistant-latest',
              kind: 'message',
              itemType: 'agentMessage',
              role: 'assistant',
              text: 'Latest message',
              state: 'streaming',
              threadId: 'thread-1',
              turnId: 'turn-2',
            },
          ],
        })}
      />,
    );

    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it('auto-follows new transcript content while the user stays near the bottom', () => {
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });

    const view = renderChatPage({
      messages: [
        {
          id: 'assistant-earlier',
          kind: 'message',
          itemType: 'agentMessage',
          role: 'assistant',
          text: 'Earlier message',
          state: 'complete',
          threadId: 'thread-1',
          turnId: 'turn-1',
        },
      ],
    });

    const transcriptSection = screen.getByLabelText('chat transcript section');

    Object.defineProperty(transcriptSection, 'clientHeight', { configurable: true, value: 400 });
    Object.defineProperty(transcriptSection, 'scrollHeight', { configurable: true, value: 1200 });
    Object.defineProperty(transcriptSection, 'scrollTop', { configurable: true, value: 780, writable: true });

    fireEvent.scroll(transcriptSection);
    scrollIntoView.mockClear();

    view.rerender(
      <ChatPageLayout
        {...buildChatPageProps({
          messages: [
            {
              id: 'assistant-earlier',
              kind: 'message',
              itemType: 'agentMessage',
              role: 'assistant',
              text: 'Earlier message',
              state: 'complete',
              threadId: 'thread-1',
              turnId: 'turn-1',
            },
            {
              id: 'assistant-latest',
              kind: 'message',
              itemType: 'agentMessage',
              role: 'assistant',
              text: 'Latest message',
              state: 'streaming',
              threadId: 'thread-1',
              turnId: 'turn-2',
            },
          ],
        })}
      />,
    );

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView).toHaveBeenLastCalledWith({ behavior: 'smooth' });
  });

  it('resumes auto-follow after the user returns to the bottom from history browsing', () => {
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });

    const view = renderChatPage({
      messages: [
        {
          id: 'assistant-earlier',
          kind: 'message',
          itemType: 'agentMessage',
          role: 'assistant',
          text: 'Earlier message',
          state: 'complete',
          threadId: 'thread-1',
          turnId: 'turn-1',
        },
      ],
    });

    const transcriptSection = screen.getByLabelText('chat transcript section');

    Object.defineProperty(transcriptSection, 'clientHeight', { configurable: true, value: 400 });
    Object.defineProperty(transcriptSection, 'scrollHeight', { configurable: true, value: 1200 });
    Object.defineProperty(transcriptSection, 'scrollTop', { configurable: true, value: 0, writable: true });

    fireEvent.scroll(transcriptSection);
    scrollIntoView.mockClear();

    transcriptSection.scrollTop = 800;
    fireEvent.scroll(transcriptSection);
    scrollIntoView.mockClear();

    view.rerender(
      <ChatPageLayout
        {...buildChatPageProps({
          messages: [
            {
              id: 'assistant-earlier',
              kind: 'message',
              itemType: 'agentMessage',
              role: 'assistant',
              text: 'Earlier message',
              state: 'complete',
              threadId: 'thread-1',
              turnId: 'turn-1',
            },
            {
              id: 'assistant-latest',
              kind: 'message',
              itemType: 'agentMessage',
              role: 'assistant',
              text: 'Latest message',
              state: 'streaming',
              threadId: 'thread-1',
              turnId: 'turn-2',
            },
          ],
        })}
      />,
    );

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView).toHaveBeenLastCalledWith({ behavior: 'smooth' });
  });

  it('does not auto-follow same-length transcript updates while the user is reading history', () => {
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });

    const view = renderChatPage({
      latestTurn: {
        id: 'turn-1',
        status: 'inProgress',
        error: null,
        startedAt: null,
        completedAt: null,
        durationMs: null,
      },
      messages: [
        {
          id: 'assistant-live',
          kind: 'message',
          itemType: 'agentMessage',
          role: 'assistant',
          text: 'Partial answer',
          state: 'streaming',
          threadId: 'thread-1',
          turnId: 'turn-1',
        },
      ],
    });

    const transcriptSection = screen.getByLabelText('chat transcript section');

    Object.defineProperty(transcriptSection, 'clientHeight', { configurable: true, value: 400 });
    Object.defineProperty(transcriptSection, 'scrollHeight', { configurable: true, value: 1200 });
    Object.defineProperty(transcriptSection, 'scrollTop', { configurable: true, value: 0, writable: true });

    fireEvent.scroll(transcriptSection);
    scrollIntoView.mockClear();

    view.rerender(
      <ChatPageLayout
        {...buildChatPageProps({
          latestTurn: {
        id: 'turn-1',
        status: 'inProgress',
        error: null,
        startedAt: null,
        completedAt: null,
        durationMs: null,
      },
          messages: [
            {
              id: 'assistant-live',
              kind: 'message',
              itemType: 'agentMessage',
              role: 'assistant',
              text: 'Partial answer with more detail',
              state: 'streaming',
              threadId: 'thread-1',
              turnId: 'turn-1',
            },
          ],
        })}
      />,
    );

    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it('auto-follows same-length transcript updates while the user stays near the bottom', () => {
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });

    const view = renderChatPage({
      latestTurn: {
        id: 'turn-1',
        status: 'inProgress',
        error: null,
        startedAt: null,
        completedAt: null,
        durationMs: null,
      },
      messages: [
        {
          id: 'assistant-live',
          kind: 'message',
          itemType: 'agentMessage',
          role: 'assistant',
          text: 'Partial answer',
          state: 'streaming',
          threadId: 'thread-1',
          turnId: 'turn-1',
        },
      ],
    });

    const transcriptSection = screen.getByLabelText('chat transcript section');

    Object.defineProperty(transcriptSection, 'clientHeight', { configurable: true, value: 400 });
    Object.defineProperty(transcriptSection, 'scrollHeight', { configurable: true, value: 1200 });
    Object.defineProperty(transcriptSection, 'scrollTop', { configurable: true, value: 780, writable: true });

    fireEvent.scroll(transcriptSection);
    scrollIntoView.mockClear();

    view.rerender(
      <ChatPageLayout
        {...buildChatPageProps({
          latestTurn: {
        id: 'turn-1',
        status: 'inProgress',
        error: null,
        startedAt: null,
        completedAt: null,
        durationMs: null,
      },
          messages: [
            {
              id: 'assistant-live',
              kind: 'message',
              itemType: 'agentMessage',
              role: 'assistant',
              text: 'Partial answer with more detail',
              state: 'streaming',
              threadId: 'thread-1',
              turnId: 'turn-1',
            },
          ],
        })}
      />,
    );

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView).toHaveBeenLastCalledWith({ behavior: 'smooth' });
  });
});
