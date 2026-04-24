import { useEffect, useState } from 'react';

import type { SessionTimelineItem } from '../../../runtime/public-types';
import type { TranscriptTimelineItemContentHandler } from '../../types';
import { formatStructuredValue } from '../../lib/structured-format';
import { LiteralMessage, MarkdownMessage } from '../../lib/message-markdown';
import { LabeledLiteralField } from '../LabeledLiteralField';
import { LargeTranscriptItemBody } from './LargeTranscriptItemBody';
import {
  getSpecialItemLabel,
  hasReasoningContent,
  isLargeTranscriptItem,
  shouldShowReasoningPlaceholder,
  shouldHideSpecialText,
  shouldRenderSpecialTextAsMarkdown,
} from './special-item-helpers';

type SpecialTimelineMessage = Exclude<SessionTimelineItem, { kind: 'message' }>;

type SpecialTimelineItemProps = {
  message: SpecialTimelineMessage;
  onFileHrefOpen?: (href: string) => void;
  isWorkspaceFileLink?: (href: string) => boolean;
  onTimelineItemContentLoad?: TranscriptTimelineItemContentHandler;
};

function renderLiteralField(
  label: string,
  value: unknown,
  key: string,
) {
  return (
    <LabeledLiteralField
      className="timeline-card-field"
      key={key}
      label={label}
      labelClassName="timeline-card-field-label"
      value={value}
      valueClassName="literal-content-compact timeline-card-field-value"
    />
  );
}

function renderSpecialMetadata(
  message: SpecialTimelineMessage,
) {
  if (message.kind === 'fallback') {
    return null;
  }

  const raw = message.raw ?? {};

  switch (message.itemType) {
    case 'mcpToolCall':
      return (
        <>
          {renderLiteralField(
            'Tool',
            [raw.server, raw.tool].filter(Boolean).map(formatStructuredValue).join('.'),
            `${message.id}-tool`,
          )}
          {renderLiteralField('Arguments', raw.arguments, `${message.id}-arguments`)}
          {renderLiteralField('Result', raw.result, `${message.id}-result`)}
          {renderLiteralField('Error', raw.error, `${message.id}-error`)}
        </>
      );
    case 'dynamicToolCall':
      return (
        <>
          {renderLiteralField('Tool', raw.tool, `${message.id}-tool`)}
          {renderLiteralField('Arguments', raw.arguments, `${message.id}-arguments`)}
          {renderLiteralField('Response', raw.contentItems, `${message.id}-response`)}
          {renderLiteralField('Success', raw.success, `${message.id}-success`)}
        </>
      );
    case 'collabAgentToolCall':
    case 'collabToolCall':
      return (
        <>
          {renderLiteralField('Tool', raw.tool, `${message.id}-tool`)}
          {renderLiteralField('Sender', raw.senderThreadId, `${message.id}-sender`)}
          {renderLiteralField('Receivers', raw.receiverThreadIds, `${message.id}-receivers`)}
        </>
      );
    case 'webSearch':
      return (
        <>
          {renderLiteralField('Query', raw.query, `${message.id}-query`)}
          {renderLiteralField('Action', raw.action, `${message.id}-action`)}
        </>
      );
    case 'reasoning':
      if (!hasReasoningContent(raw.content)) {
        return null;
      }
      return renderLiteralField('Raw', raw.content, `${message.id}-raw`);
    case 'hookPrompt':
      return renderLiteralField('Fragments', raw.fragments, `${message.id}-fragments`);
    case 'enteredReviewMode':
    case 'exitedReviewMode':
      return renderLiteralField('Review', raw.review, `${message.id}-review`);
    default:
      return null;
  }
}

function renderSpecialText(
  message: SpecialTimelineMessage,
  onFileHrefOpen?: (href: string) => void,
  isWorkspaceFileLink?: (href: string) => boolean,
) {
  if (shouldShowReasoningPlaceholder(message)) {
    return <LiteralMessage className="literal-content-compact" text="No available Reasoning text." />;
  }

  if (!message.text || shouldHideSpecialText(message)) {
    return null;
  }

  if (shouldRenderSpecialTextAsMarkdown(message)) {
    return (
      <MarkdownMessage
        className="markdown-content-compact"
        isWorkspaceFileLink={isWorkspaceFileLink}
        onFileHrefOpen={onFileHrefOpen}
        text={message.text}
      />
    );
  }

  return <LiteralMessage className="literal-content-compact" text={message.text} />;
}

export function SpecialTimelineItem({
  message,
  onFileHrefOpen,
  isWorkspaceFileLink,
  onTimelineItemContentLoad,
}: SpecialTimelineItemProps) {
  const shouldStartExpanded = !(
    message.kind !== 'fallback' &&
    (isLargeTranscriptItem(message) || message.itemType === 'hookPrompt' || message.itemType === 'reasoning')
  );
  const [expanded, setExpanded] = useState(shouldStartExpanded);
  const label = message.kind === 'fallback' ? message.itemType : getSpecialItemLabel(message.itemType);
  const status = 'status' in message && message.status ? ` · ${message.status}` : '';
  const metadata = renderSpecialMetadata(message);
  const largeItemBody = message.kind !== 'fallback' && isLargeTranscriptItem(message)
    ? <LargeTranscriptItemBody message={message} onTimelineItemContentLoad={onTimelineItemContentLoad} />
    : null;
  const hasBody = Boolean(
    message.text || metadata || largeItemBody || shouldShowReasoningPlaceholder(message),
  );

  useEffect(() => {
    setExpanded(shouldStartExpanded);
  }, [message.id, shouldStartExpanded]);

  return (
    <article key={message.id} aria-label={`${message.itemType} item`} className="timeline-card-panel special-item">
      <details onToggle={event => setExpanded(event.currentTarget.open)} open={expanded}>
        <summary>
          <strong>{label}</strong>
          {status}
        </summary>
        {expanded && hasBody ? (
          <div className="timeline-card-content special-item-body">
            {renderSpecialText(message, onFileHrefOpen, isWorkspaceFileLink)}
            {largeItemBody}
            {metadata}
          </div>
        ) : null}
      </details>
    </article>
  );
}
