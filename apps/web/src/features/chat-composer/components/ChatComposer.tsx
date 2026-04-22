import { useLayoutEffect, useRef, type CSSProperties, type KeyboardEvent } from 'react';

import { IconChevronDown, IconChevronUp, IconCompress, IconPlus, IconRollback, IconSend, IconStop } from './ChatComposerIcons';
import { COMPOSER_MAX_HEIGHT_PX, COMPOSER_MIN_HEIGHT_PX } from '../lib/composer.constants';

type ComposerActionHandler = () => boolean | Promise<boolean>;

type ChatComposerProps = {
  bottomDrawerOpen: boolean;
  inputDisabled: boolean;
  interruptPending?: boolean;
  isTurnInterrupting?: boolean;
  isTurnInProgress?: boolean;
  draft: string;
  isRestarting: boolean;
  hasWorkspace: boolean;
  hasThread: boolean;
  workspaceSwitchReason: string;
  actionBlocked: boolean;
  sendButtonDisabled?: boolean;
  onDraftChange: (value: string) => void;
  onToggleBottomDrawer: () => void;
  onInterrupt?: ComposerActionHandler;
  onSubmit: () => void | Promise<void>;
  onNewThread?: ComposerActionHandler;
  onOpenImageAttachments?: ComposerActionHandler;
  onRollback?: ComposerActionHandler;
  onCompact?: ComposerActionHandler;
};

function resizeTextareaToContent(textarea: HTMLTextAreaElement, maxHeight: number) {
  textarea.style.height = 'auto';
  const nextHeight = Math.min(textarea.scrollHeight, maxHeight);
  textarea.style.height = `${nextHeight}px`;
  textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';
}

export function ChatComposer({
  bottomDrawerOpen,
  inputDisabled,
  interruptPending = false,
  isTurnInterrupting = false,
  isTurnInProgress = false,
  draft,
  isRestarting,
  hasWorkspace,
  hasThread,
  workspaceSwitchReason,
  actionBlocked,
  sendButtonDisabled = inputDisabled,
  onDraftChange,
  onToggleBottomDrawer,
  onInterrupt,
  onSubmit,
  onNewThread,
  onOpenImageAttachments,
  onRollback,
  onCompact,
}: ChatComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const textareaStyle = {
    '--composer-min-height': `${COMPOSER_MIN_HEIGHT_PX}px`,
    '--composer-max-height': `${COMPOSER_MAX_HEIGHT_PX}px`,
  } as CSSProperties;

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    resizeTextareaToContent(textarea, COMPOSER_MAX_HEIGHT_PX);
  }, [draft]);

  function handleTextareaKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void onSubmit();
    }
  }

  return (
    <footer className="bottombar">
      <div className={`bottom-drawer ${bottomDrawerOpen ? 'open' : ''}`}>
        <div className="bottom-drawer-content">
          <button
            className="bottom-tool-btn"
            disabled={isRestarting || !hasWorkspace || Boolean(workspaceSwitchReason)}
            onClick={() => void onNewThread?.()}
            type="button"
          >
            <IconPlus /> New Thread
          </button>
          <button
            className="bottom-tool-btn"
            disabled={!hasWorkspace || actionBlocked}
            onClick={() => void onOpenImageAttachments?.()}
            type="button"
          >
            <IconPlus /> Add images
          </button>
          <button
            className="bottom-tool-btn"
            disabled={!hasThread || actionBlocked}
            onClick={() => void onRollback?.()}
            type="button"
          >
            <IconRollback /> Rollback
          </button>
          <button
            className="bottom-tool-btn"
            disabled={!hasThread || actionBlocked}
            onClick={() => void onCompact?.()}
            type="button"
          >
            <IconCompress /> Compact
          </button>
        </div>
      </div>

      <form
        className="composer"
        aria-label="chat composer"
        onSubmit={event => {
          event.preventDefault();
          if (isTurnInterrupting) {
            return;
          }
          if (isTurnInProgress) {
            void onInterrupt?.();
            return;
          }

          void onSubmit();
        }}
      >
        <button
          aria-label="Thread tools"
          className={`composer-left-btn ${bottomDrawerOpen ? 'active' : ''}`}
          onClick={onToggleBottomDrawer}
          type="button"
        >
          {bottomDrawerOpen ? <IconChevronDown /> : <IconChevronUp />}
        </button>

        <div className="composer-input-wrap">
          <label>
            <span className="visually-hidden">chat input</span>
            <textarea
              ref={textareaRef}
              aria-label="chat input"
              className="composer-textarea"
              disabled={inputDisabled}
              onChange={event => onDraftChange(event.target.value)}
              onKeyDown={handleTextareaKeyDown}
              placeholder={inputDisabled ? 'Waiting…' : 'Send to Codex'}
              rows={1}
              style={textareaStyle}
              value={draft}
            />
          </label>
        </div>

        <button
          aria-label={isTurnInterrupting ? 'Stopping…' : isTurnInProgress ? 'Stop' : 'Send'}
          className={`composer-send-btn ${isTurnInProgress ? 'stop-mode' : 'send-mode'}`}
          disabled={sendButtonDisabled}
          type="submit"
        >
          {isTurnInProgress ? <IconStop spinning={interruptPending} /> : <IconSend />}
        </button>
      </form>
    </footer>
  );
}
