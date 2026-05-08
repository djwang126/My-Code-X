import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderChatTranscriptPage as renderChatPage } from '../../../../pages/chat/test/renderChatTranscriptPage';

describe('ChatTranscript timeline items integration', () => {
  it('renders special and fallback timeline rows without dropping unknown transcript items', () => {
    renderChatPage({
      messages: [
        {
          id: 'plan-1',
          kind: 'special',
          itemType: 'plan',
          text: '**Inspect** failing tests',
          state: 'complete',
          threadId: 'thread-1',
          turnId: 'turn-1',
          raw: {
            type: 'plan',
            id: 'plan-1',
            text: '**Inspect** failing tests',
          },
        },
        {
          id: 'fallback-1',
          kind: 'fallback',
          itemType: 'totallyUnknownThing',
          text: '[totallyUnknownThing]',
          state: 'complete',
          threadId: 'thread-1',
          turnId: 'turn-1',
          raw: {
            type: 'totallyUnknownThing',
            id: 'fallback-1',
          },
        },
      ],
    });

    expect(screen.getByText('Inspect', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getByText('[totallyUnknownThing]')).toBeInTheDocument();
  });

  it('renders structured user inputs as mobile-friendly inline chips', () => {
    renderChatPage({
      messages: [
        {
          id: 'user-structured',
          kind: 'message',
          itemType: 'userMessage',
          role: 'user',
          text: 'Use\n\n[skill: playwright]\n\n[mention: repo]\n\nsnippet',
          state: 'complete',
          threadId: 'thread-1',
          turnId: 'turn-1',
          content: [
            { type: 'text', text: 'Use' },
            { type: 'skill', name: 'playwright', path: 'skill://playwright' },
            { type: 'mention', name: 'repo', path: 'app://repo' },
            { type: 'text', text: 'snippet', text_elements: [{ placeholder: '<note>' }] },
          ],
          raw: {
            type: 'userMessage',
            id: 'user-structured',
          },
        },
      ],
    });

    expect(screen.getByLabelText('skill playwright')).toBeInTheDocument();
    expect(screen.getByLabelText('mention repo')).toBeInTheDocument();
    expect(screen.getByLabelText('1 text placeholder')).toBeInTheDocument();
  });

  it('keeps fallback media items visible when no dedicated renderer exists yet', () => {
    renderChatPage({
      messages: [
        {
          id: 'fallback-media',
          kind: 'fallback',
          itemType: 'imageView',
          text: '[imageView]',
          state: 'complete',
          threadId: 'thread-1',
          turnId: 'turn-1',
          raw: {
            type: 'imageView',
            id: 'fallback-media',
          },
        },
      ],
    });

    expect(screen.getByText('[imageView]')).toBeInTheDocument();
  });
});
