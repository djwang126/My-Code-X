import type { ClientConversationItem, ClientConversationMessageItem, ClientConversationView } from '@my-code-x/contracts-new';
import {
  createConversationViewModelFromSnapshot,
  type ConversationViewModel,
} from '../model/index.js';
import { renderConversationMarkdown, type RenderedCodeBlock, type RenderedMarkdownBlock } from '../markdown/index.js';
import { assertNever } from '../../../shared/lib/index.js';
import { copyCodeBlockText, copyMessageText, readBrowserClipboard } from './conversation-copy.js';

export interface ConversationViewProps {
  readonly conversation: ClientConversationView;
}

export function ConversationView(input: ConversationViewProps) {
  const model = createConversationViewModelFromSnapshot({ conversation: input.conversation });

  return (
    <section className="conversation-view" aria-labelledby="conversation-view-title">
      <h2 className="conversation-view__title" id="conversation-view-title">
        Conversation View
      </h2>
      <ConversationViewBody model={model} />
    </section>
  );
}

interface ConversationViewBodyProps {
  readonly model: ConversationViewModel;
}

function ConversationViewBody(input: ConversationViewBodyProps) {
  switch (input.model.status) {
    case 'loading':
      return (
        <div className="conversation-view__placeholder" role="status">
          <p className="conversation-view__body">Loading conversation…</p>
        </div>
      );

    case 'empty':
      return (
        <div className="conversation-view__placeholder">
          <p className="conversation-view__body">No conversation yet.</p>
        </div>
      );

    case 'failed':
      return (
        <div className="conversation-view__placeholder" role="alert">
          <p className="conversation-view__body conversation-view__body--error">
            {input.model.error.message}
          </p>
        </div>
      );

    case 'timeline':
      return (
        <ol className="conversation-view__timeline" aria-label="Conversation timeline">
          {input.model.items.map(item => (
            <ConversationTimelineItem item={item} key={item.id} />
          ))}
        </ol>
      );
  }
}

interface ConversationTimelineItemProps {
  readonly item: ClientConversationItem;
}

function ConversationTimelineItem(input: ConversationTimelineItemProps) {
  switch (input.item.kind) {
    case 'message':
      return (
        <li className={`conversation-view__timeline-item conversation-view__timeline-item--${input.item.role}`}>
          <ConversationMessage item={input.item} />
        </li>
      );
  }
}

interface ConversationMessageProps {
  readonly item: ClientConversationMessageItem;
}

function ConversationMessage(input: ConversationMessageProps) {
  const rendered = renderConversationMarkdown({ text: input.item.text });
  const label = input.item.role === 'user' ? 'User message' : 'Assistant message';

  return (
    <article className={`conversation-view__message conversation-view__message--${input.item.role}`} aria-label={label}>
      <div className="conversation-view__message-body">
        {rendered.blocks.map(block => (
          <ConversationMarkdownBlock block={block} key={block.id} />
        ))}
      </div>
      <button
        className="conversation-view__copy-message"
        onClick={() => {
          void copyMessageText({
            clipboard: readBrowserClipboard(),
            text: input.item.text,
          });
        }}
        type="button"
      >
        Copy message
      </button>
    </article>
  );
}

interface ConversationMarkdownBlockProps {
  readonly block: RenderedMarkdownBlock;
}

function ConversationMarkdownBlock(input: ConversationMarkdownBlockProps) {
  switch (input.block.kind) {
    case 'html':
      return <div dangerouslySetInnerHTML={{ __html: input.block.html }} />;

    case 'code':
      return (
        <div className="conversation-view__code-block">
          <div dangerouslySetInnerHTML={{ __html: input.block.html }} />
          <CopyCodeBlockButton codeBlock={input.block} />
        </div>
      );

    default:
      return assertNever(input.block);
  }
}

interface CopyCodeBlockButtonProps {
  readonly codeBlock: RenderedCodeBlock;
}

function CopyCodeBlockButton(input: CopyCodeBlockButtonProps) {
  return (
    <button
      className="conversation-view__copy-code"
      data-code-block-id={input.codeBlock.id}
      onClick={() => {
        void copyCodeBlockText({
          clipboard: readBrowserClipboard(),
          text: input.codeBlock.text,
        });
      }}
      type="button"
    >
      Copy code
    </button>
  );
}
