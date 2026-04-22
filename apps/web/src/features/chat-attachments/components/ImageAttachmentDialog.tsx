import { useRef, type ChangeEvent, type CSSProperties } from 'react';

import { OverlayDialog } from '../../../shared/components/overlay';
import type { ImageAttachmentDraftItem } from '../types';

type ImageAttachmentDialogProps = {
  items: ImageAttachmentDraftItem[];
  limitMessage: string;
  maxAttachments: number;
  open: boolean;
  onClose: () => void;
  onFilesSelected: (files: File[]) => void | Promise<void>;
  onRemoveItem: (itemId: string) => void;
};

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: '0.75rem',
};

const cardStyle: CSSProperties = {
  display: 'grid',
  gap: '0.35rem',
};

const imgStyle: CSSProperties = {
  width: '100%',
  aspectRatio: '4 / 3',
  objectFit: 'cover',
  borderRadius: '0.75rem',
  border: '1px solid rgba(148, 163, 184, 0.25)',
};

function statusLabel(status: ImageAttachmentDraftItem['status']) {
  if (status === 'processing') {
    return 'Processing';
  }

  if (status === 'failed') {
    return 'Failed';
  }

  if (status === 'sending') {
    return 'Sending';
  }

  return 'Ready';
}

export function ImageAttachmentDialog({
  items,
  limitMessage,
  maxAttachments,
  open,
  onClose,
  onFilesSelected,
  onRemoveItem,
}: ImageAttachmentDialogProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    void onFilesSelected(files);
    event.target.value = '';
  }

  return (
    <OverlayDialog
      ariaLabel="Add images"
      onClose={onClose}
      open={open}
      showBackdrop={false}
      showCloseButton={false}
      title="Add images"
      width="min(32rem, 100%)"
    >
      <p style={{ margin: 0 }}>{`Up to ${maxAttachments} images per message`}</p>
      {limitMessage ? <p style={{ margin: 0, color: '#fbbf24' }}>{limitMessage}</p> : null}

      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>{items.length ? `${items.length} selected` : 'No images selected yet'}</span>
        <button
          disabled={items.length >= maxAttachments}
          onClick={() => fileInputRef.current?.click()}
          type="button"
        >
          Choose images
        </button>
        <input
          accept="image/*"
          hidden
          multiple
          onChange={handleInputChange}
          ref={fileInputRef}
          type="file"
        />
      </div>

      {items.length ? (
        <div style={gridStyle}>
          {items.map((item, index) => (
            <div key={item.id} style={cardStyle}>
              <img alt={`Selected image ${index + 1}`} src={item.previewUrl} style={imgStyle} />
              <strong style={{ fontSize: '0.9rem' }}>{item.fileName}</strong>
              <span>{statusLabel(item.status)}</span>
              {item.errorMessage ? <span style={{ color: '#fca5a5' }}>{item.errorMessage}</span> : null}
              <button disabled={item.status === 'sending'} onClick={() => onRemoveItem(item.id)} type="button">
                Remove image
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </OverlayDialog>
  );
}
