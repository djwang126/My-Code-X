import { useEffect, useMemo, useReducer, useRef } from 'react';

import type { ImageAttachmentDraftItem } from '../types';
import type { SessionSendContentItem } from '../../chat-runtime';
import {
  attachmentDraftReducer,
  buildAttachmentDraftContent,
  createInitialAttachmentDraftState,
  hasBlockingAttachmentDraftItems,
} from '../state/attachment-draft-machine';

type UploadImageAttachmentHandler = (file: File) => Promise<{ attachmentId: string }>;

type UseImageAttachmentDraftOptions = {
  maxAttachments?: number;
  onUploadAttachment: UploadImageAttachmentHandler;
};

type SelectImageFilesInput = {
  files: File[];
};

function createPreviewUrl(file: File) {
  if (typeof URL?.createObjectURL === 'function') {
    return URL.createObjectURL(file);
  }

  return '';
}

function revokePreviewUrl(previewUrl: string) {
  if (!previewUrl || typeof URL?.revokeObjectURL !== 'function') {
    return;
  }

  URL.revokeObjectURL(previewUrl);
}

function toDraftItem(file: File, index: number): ImageAttachmentDraftItem {
  const randomId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${index}`;

  return {
    type: 'imageAttachment',
    id: `draft-image-${randomId}`,
    label: file.name || `Selected image ${index + 1}`,
    fileName: file.name || `image-${index + 1}`,
    previewUrl: createPreviewUrl(file),
    status: 'processing',
  };
}

export function useImageAttachmentDraft({
  maxAttachments = 5,
  onUploadAttachment,
}: UseImageAttachmentDraftOptions) {
  const [state, dispatch] = useReducer(attachmentDraftReducer, undefined, createInitialAttachmentDraftState);
  const previousItemsRef = useRef<ImageAttachmentDraftItem[]>([]);

  useEffect(() => {
    const removedItems = previousItemsRef.current.filter(previousItem => !state.items.some(item => item.id === previousItem.id));
    removedItems.forEach(item => revokePreviewUrl(item.previewUrl));
    previousItemsRef.current = state.items;
  }, [state.items]);

  useEffect(
    () => () => {
      previousItemsRef.current.forEach(item => revokePreviewUrl(item.previewUrl));
    },
    [],
  );

  const hasBlockingItems = useMemo(() => hasBlockingAttachmentDraftItems(state), [state]);

  async function selectFiles({ files }: SelectImageFilesInput) {
    if (!Array.isArray(files) || !files.length) {
      return;
    }

    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    if (!imageFiles.length) {
      return;
    }

    const slotsRemaining = Math.max(0, maxAttachments - state.items.length);
    const acceptedFiles = imageFiles.slice(0, slotsRemaining);
    const limitMessage = imageFiles.length > acceptedFiles.length ? `Maximum ${maxAttachments} images per message` : '';

    if (!acceptedFiles.length) {
      return;
    }

    const draftItems = acceptedFiles.map((file, index) => toDraftItem(file, index));
    dispatch({ type: 'files/queued', items: draftItems, limitMessage });

    await Promise.all(
      draftItems.map(async (draftItem, index) => {
        try {
          const uploaded = await onUploadAttachment(acceptedFiles[index]);
          dispatch({
            type: 'file/ready',
            itemId: draftItem.id,
            attachmentId: uploaded.attachmentId,
          });
        } catch (error) {
          dispatch({
            type: 'file/failed',
            itemId: draftItem.id,
            errorMessage: error instanceof Error ? error.message : String(error),
          });
        }
      }),
    );
  }

  function removeItem(itemId: string) {
    dispatch({ type: 'item/removed', itemId });
  }

  function setDraftText(text: string) {
    dispatch({ type: 'draft/text-changed', text });
  }

  function buildSessionContent(): SessionSendContentItem[] {
    return buildAttachmentDraftContent(state);
  }

  function clearDraft() {
    dispatch({ type: 'draft/cleared' });
  }

  function beginSend() {
    dispatch({ type: 'send/started' });
  }

  function resetAfterSendFailure() {
    dispatch({ type: 'send/failed' });
  }

  return {
    draftText: state.draftText,
    items: state.items,
    limitMessage: state.limitMessage,
    hasBlockingItems,
    setDraftText,
    selectFiles,
    removeItem,
    buildSessionContent,
    clearDraft,
    beginSend,
    resetAfterSendFailure,
  };
}
