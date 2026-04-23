import { useState, type CSSProperties } from 'react';

import type {
  SessionTimelineMessageItem,
  UserInputImageContentItem,
  UserInputLocalImageContentItem,
} from '../../../runtime/public-types';
import type { TranscriptImagePreviewOpenHandler } from '../../types';
import { MarkdownMessage } from '../../lib/message-markdown';
import { pillStyle, structuredContentStyle } from './styles';

const imageStyle: CSSProperties = {
  width: '8rem',
  maxWidth: '100%',
  borderRadius: '0.75rem',
  border: '1px solid rgba(148, 163, 184, 0.3)',
};

const imageButtonStyle: CSSProperties = {
  background: 'transparent',
  border: 0,
  padding: 0,
};

function renderTextElementChip(textElements: unknown[] | undefined) {
  const count = textElements?.length ?? 0;
  if (!count) {
    return null;
  }

  return (
    <span aria-label={`${count} text placeholder${count === 1 ? '' : 's'}`} style={pillStyle}>
      {count} placeholder{count === 1 ? '' : 's'}
    </span>
  );
}

function StructuredTextContentItem({
  text,
  textElements,
  onFileHrefOpen,
  isWorkspaceFileLink,
}: {
  text: string;
  textElements: unknown[] | undefined;
  onFileHrefOpen?: (href: string) => void;
  isWorkspaceFileLink?: (href: string) => boolean;
}) {
  return (
    <div style={structuredContentStyle}>
      {text ? (
        <MarkdownMessage
          isWorkspaceFileLink={isWorkspaceFileLink}
          onFileHrefOpen={onFileHrefOpen}
          text={text}
        />
      ) : null}
      {renderTextElementChip(textElements)}
    </div>
  );
}

function ImageContentItem({
  item,
  imageNumber,
  onImagePreviewOpen,
}: {
  item: UserInputImageContentItem | UserInputLocalImageContentItem;
  imageNumber: number;
  onImagePreviewOpen?: TranscriptImagePreviewOpenHandler;
}) {
  const [imageLoadFailed, setImageLoadFailed] = useState(false);

  if (item.status === 'unavailable' || imageLoadFailed) {
    return <span>Attachment unavailable</span>;
  }

  const src = typeof item.url === 'string' ? item.url : '';
  if (!src) {
    return null;
  }

  return (
    <button
      onClick={() => onImagePreviewOpen?.({ src })}
      style={imageButtonStyle}
      type="button"
    >
      <img alt={`Attached image ${imageNumber}`} onError={() => setImageLoadFailed(true)} src={src} style={imageStyle} />
    </button>
  );
}

function renderStructuredUserContent({
  message,
  onFileHrefOpen,
  onImagePreviewOpen,
  isWorkspaceFileLink,
}: {
  message: SessionTimelineMessageItem;
  onFileHrefOpen?: (href: string) => void;
  onImagePreviewOpen?: TranscriptImagePreviewOpenHandler;
  isWorkspaceFileLink?: (href: string) => boolean;
}) {
  let imageNumber = 0;
  return message.content?.map((item, index) => {
    switch (item.type) {
      case 'text':
        return (
          <StructuredTextContentItem
            isWorkspaceFileLink={isWorkspaceFileLink}
            key={`text-${index}`}
            onFileHrefOpen={onFileHrefOpen}
            text={item.text || ''}
            textElements={item.text_elements}
          />
        );
      case 'image':
      case 'localImage':
        imageNumber += 1;
        return (
          <ImageContentItem
            imageNumber={imageNumber}
            item={item}
            key={`${item.type}-${index}`}
            onImagePreviewOpen={onImagePreviewOpen}
          />
        );
      case 'skill': {
        const name = item.name || item.path || 'unknown';
        return (
          <span key={`skill-${index}`} aria-label={`skill ${name}`} style={pillStyle}>
            {name}
          </span>
        );
      }
      case 'mention': {
        const name = item.name || item.path || 'unknown';
        return (
          <span key={`mention-${index}`} aria-label={`mention ${name}`} style={pillStyle}>
            @{name}
          </span>
        );
      }
      case 'imageAttachment':
        return (
          <span key={`image-attachment-${index}`} aria-label="image attachment placeholder" style={pillStyle}>
            [imageAttachment]
          </span>
        );
      default:
        return null;
    }
  });
}

export function MessageTimelineItem({
  message,
  onFileHrefOpen,
  onImagePreviewOpen,
  isWorkspaceFileLink,
}: {
  message: SessionTimelineMessageItem;
  onFileHrefOpen?: (href: string) => void;
  onImagePreviewOpen?: TranscriptImagePreviewOpenHandler;
  isWorkspaceFileLink?: (href: string) => boolean;
}) {
  return (
    <article key={message.id} aria-label={`${message.role} message`}>
      {message.itemType === 'userMessage' && message.content?.length ? (
        <div style={structuredContentStyle}>
          {renderStructuredUserContent({ message, onFileHrefOpen, onImagePreviewOpen, isWorkspaceFileLink })}
        </div>
      ) : (
        <MarkdownMessage isWorkspaceFileLink={isWorkspaceFileLink} onFileHrefOpen={onFileHrefOpen} text={message.text} />
      )}
    </article>
  );
}
