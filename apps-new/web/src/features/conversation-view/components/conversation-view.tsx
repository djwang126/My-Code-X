import type { ReactNode } from 'react';
import type { ClientConversationItem, ClientConversationMessageItem, ClientConversationView } from '@my-code-x/contracts-new';
import {
  createConversationViewModelFromSnapshot,
  type ConversationViewModel,
} from '../model/index.js';
import {
  renderConversationMarkdown,
  type ConversationMarkdownBlock,
  type ConversationMarkdownCodeBlock,
  type ConversationMarkdownInline,
} from '../markdown/index.js';
import { assertNever } from '../../../shared/lib/index.js';
import {
  copyCodeBlockText,
  copyMessageText,
  readBrowserClipboard,
  type ConversationClipboard,
} from './conversation-copy.js';

export interface ConversationViewProps {
  readonly conversation: ClientConversationView;
  readonly clipboard?: ConversationClipboard;
}

export function ConversationView(input: ConversationViewProps) {
  const model = createConversationViewModelFromSnapshot({ conversation: input.conversation });
  const clipboard = input.clipboard ?? readBrowserClipboard();

  return (
    <section className="conversation-view" aria-labelledby="conversation-view-title">
      <h2 className="conversation-view__title" id="conversation-view-title">
        Conversation View
      </h2>
      <ConversationViewBody clipboard={clipboard} model={model} />
    </section>
  );
}

interface ConversationViewBodyProps {
  readonly clipboard: ConversationClipboard;
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
            <ConversationTimelineItem clipboard={input.clipboard} item={item} key={item.id} />
          ))}
        </ol>
      );
  }
}

interface ConversationTimelineItemProps {
  readonly clipboard: ConversationClipboard;
  readonly item: ClientConversationItem;
}

function ConversationTimelineItem(input: ConversationTimelineItemProps) {
  const renderer = conversationTimelineItemRenderers[input.item.kind] as ConversationTimelineItemRenderer<
    typeof input.item
  >;

  return renderer(input);
}

interface ConversationTimelineItemRendererInput<TItem extends ClientConversationItem> {
  readonly clipboard: ConversationClipboard;
  readonly item: TItem;
}

type ConversationTimelineItemRenderer<TItem extends ClientConversationItem> = (
  input: ConversationTimelineItemRendererInput<TItem>,
) => ReactNode;

const conversationTimelineItemRenderers: {
  readonly [Kind in ClientConversationItem['kind']]: ConversationTimelineItemRenderer<
    Extract<ClientConversationItem, { readonly kind: Kind }>
  >;
} = {
  message: renderConversationMessageTimelineItem,
};

function renderConversationMessageTimelineItem(
  input: ConversationTimelineItemRendererInput<ClientConversationMessageItem>,
) {
  return (
    <li className={`conversation-view__timeline-item conversation-view__timeline-item--${input.item.role}`}>
      <ConversationMessage clipboard={input.clipboard} item={input.item} />
    </li>
  );
}

interface ConversationMessageProps {
  readonly clipboard: ConversationClipboard;
  readonly item: ClientConversationMessageItem;
}

function ConversationMessage(input: ConversationMessageProps) {
  const rendered = renderConversationMarkdown({ text: input.item.text });
  const label = input.item.role === 'user' ? 'User message' : 'Assistant message';

  return (
    <article className={`conversation-view__message conversation-view__message--${input.item.role}`} aria-label={label}>
      <div className="conversation-view__message-body">
        {rendered.blocks.map(block => (
          <ConversationMarkdownBlockView block={block} clipboard={input.clipboard} key={block.id} />
        ))}
      </div>
      <button
        className="conversation-view__copy-message"
        onClick={() => {
          void copyMessageText({
            clipboard: input.clipboard,
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

interface ConversationMarkdownBlockViewProps {
  readonly block: ConversationMarkdownBlock;
  readonly clipboard: ConversationClipboard;
}

function ConversationMarkdownBlockView(input: ConversationMarkdownBlockViewProps) {
  switch (input.block.kind) {
    case 'paragraph':
      return (
        <p>
          <ConversationMarkdownInlines inlines={input.block.inlines} />
        </p>
      );

    case 'list':
      return (
        <ul>
          {input.block.items.map((item, index) => (
            <li key={index}>
              <ConversationMarkdownInlines inlines={item} />
            </li>
          ))}
        </ul>
      );

    case 'code':
      return (
        <div className="conversation-view__code-block">
          <pre><code>{input.block.text}</code></pre>
          <CopyCodeBlockButton clipboard={input.clipboard} codeBlock={input.block} />
        </div>
      );

    case 'table':
      return (
        <div className="conversation-markdown__table-scroll">
          <table>
            <thead>
              <tr>
                {input.block.headers.map((header, index) => (
                  <th key={index}>
                    <ConversationMarkdownInlines inlines={header} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {input.block.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex}>
                      <ConversationMarkdownInlines inlines={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    default:
      return assertNever(input.block);
  }
}

interface ConversationMarkdownInlinesProps {
  readonly inlines: readonly ConversationMarkdownInline[];
}

function ConversationMarkdownInlines(input: ConversationMarkdownInlinesProps) {
  return (
    <>
      {input.inlines.map((inline, index) => (
        <ConversationMarkdownInlineView inline={inline} key={index} />
      ))}
    </>
  );
}

interface ConversationMarkdownInlineViewProps {
  readonly inline: ConversationMarkdownInline;
}

function ConversationMarkdownInlineView(input: ConversationMarkdownInlineViewProps) {
  switch (input.inline.kind) {
    case 'text':
      return input.inline.text;

    case 'strong':
      return (
        <strong>
          <ConversationMarkdownInlines inlines={input.inline.inlines} />
        </strong>
      );

    case 'code':
      return <code>{input.inline.text}</code>;

    case 'link':
      return (
        <a href={input.inline.href} rel="noopener noreferrer" target="_blank">
          <ConversationMarkdownInlines inlines={input.inline.inlines} />
        </a>
      );

    default:
      return assertNever(input.inline);
  }
}

interface CopyCodeBlockButtonProps {
  readonly clipboard: ConversationClipboard;
  readonly codeBlock: ConversationMarkdownCodeBlock;
}

function CopyCodeBlockButton(input: CopyCodeBlockButtonProps) {
  return (
    <button
      className="conversation-view__copy-code"
      data-code-block-id={input.codeBlock.id}
      onClick={() => {
        void copyCodeBlockText({
          clipboard: input.clipboard,
          text: input.codeBlock.text,
        });
      }}
      type="button"
    >
      Copy code
    </button>
  );
}
