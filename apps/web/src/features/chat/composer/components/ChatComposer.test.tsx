import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';

import { ChatComposer } from './ChatComposer';
import { COMPOSER_MAX_HEIGHT_PX, COMPOSER_MIN_HEIGHT_PX } from '../lib/composer.constants';

function estimateScrollHeight(value: string) {
  if (!value) {
    return COMPOSER_MIN_HEIGHT_PX;
  }

  const visualLines = value.split('\n').reduce((count, line) => count + Math.max(1, Math.ceil(line.length / 24)), 0);
  return COMPOSER_MIN_HEIGHT_PX + Math.max(0, visualLines - 1) * 24;
}

function ComposerHarness({
  submitResult = true,
}: {
  submitResult?: boolean;
}) {
  const [draft, setDraft] = useState('');

  async function handleSubmit() {
    if (submitResult) {
      setDraft('');
    }
  }

  return (
    <ChatComposer
      actionBlocked={false}
      bottomDrawerOpen={false}
      draft={draft}
      hasThread
      hasWorkspace
      inputDisabled={false}
      isRestarting={false}
      onDraftChange={setDraft}
      onSubmit={handleSubmit}
      onToggleBottomDrawer={() => {}}
      workspaceSwitchReason=""
    />
  );
}

describe('ChatComposer adaptive textarea', () => {
  let scrollHeightGetter: ReturnType<typeof vi.spyOn> | null = null;

  beforeEach(() => {
    scrollHeightGetter = vi
      .spyOn(HTMLTextAreaElement.prototype, 'scrollHeight', 'get')
      .mockImplementation(function (this: HTMLTextAreaElement) {
        return estimateScrollHeight(this.value);
      });
  });

  afterEach(() => {
    cleanup();
    scrollHeightGetter?.mockRestore();
    scrollHeightGetter = null;
  });

  it('starts at the configured default composer height', () => {
    render(<ComposerHarness />);

    const input = screen.getByRole('textbox', { name: 'chat input' }) as HTMLTextAreaElement;

    expect(input).toHaveValue('');
    expect(input).toHaveStyle({ height: `${COMPOSER_MIN_HEIGHT_PX}px` });
    expect(input).toHaveStyle({ overflowY: 'hidden' });
  });

  it('grows as the draft gets taller', async () => {
    const user = userEvent.setup();
    render(<ComposerHarness />);

    const input = screen.getByRole('textbox', { name: 'chat input' }) as HTMLTextAreaElement;

    await user.type(input, 'This is a longer composer draft that should wrap onto multiple visual lines on mobile.');

    expect(input).toHaveStyle({ height: `${estimateScrollHeight(input.value)}px` });
    expect(input).toHaveStyle({ overflowY: 'hidden' });
  });

  it('shrinks again when the draft becomes shorter', async () => {
    render(<ComposerHarness />);

    const input = screen.getByRole('textbox', { name: 'chat input' }) as HTMLTextAreaElement;

    fireEvent.change(input, {
      target: {
        value: 'This is a longer composer draft that should wrap onto multiple visual lines on mobile.',
      },
    });
    expect(input).toHaveStyle({ height: `${estimateScrollHeight(input.value)}px` });

    fireEvent.change(input, {
      target: {
        value: 'short',
      },
    });

    expect(input).toHaveStyle({ height: `${COMPOSER_MIN_HEIGHT_PX}px` });
  });

  it('resets back to the configured default height after a successful submit clears the draft', async () => {
    const user = userEvent.setup();
    render(<ComposerHarness submitResult />);

    const input = screen.getByRole('textbox', { name: 'chat input' }) as HTMLTextAreaElement;

    await user.type(input, 'This is a longer composer draft that should wrap before submit.');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => expect(input).toHaveValue(''));
    await waitFor(() => expect(input).toHaveStyle({ height: `${COMPOSER_MIN_HEIGHT_PX}px` }));
  });

  it('keeps its taller height when submit does not clear the draft', async () => {
    const user = userEvent.setup();
    render(<ComposerHarness submitResult={false} />);

    const input = screen.getByRole('textbox', { name: 'chat input' }) as HTMLTextAreaElement;
    const tallDraft = 'This is a longer composer draft that should stay in place when submit fails.';

    await user.type(input, tallDraft);
    const expectedHeight = `${estimateScrollHeight(tallDraft)}px`;

    await user.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => expect(input).toHaveValue(tallDraft));
    expect(input).toHaveStyle({ height: expectedHeight });
  });

  it('caps the auto-grown height at the composer max height', async () => {
    render(<ComposerHarness />);

    const input = screen.getByRole('textbox', { name: 'chat input' }) as HTMLTextAreaElement;
    const veryLongDraft = Array.from({ length: 12 }, () => 'A long line that should force the textarea to grow.').join('\n');

    fireEvent.change(input, {
      target: {
        value: veryLongDraft,
      },
    });

    expect(estimateScrollHeight(veryLongDraft)).toBeGreaterThan(COMPOSER_MAX_HEIGHT_PX);
    expect(input).toHaveStyle({ height: `${COMPOSER_MAX_HEIGHT_PX}px` });
    expect(input).toHaveStyle({ overflowY: 'auto' });
  });
});
