import { describe, expect, it } from 'vitest';

import {
  attachmentDraftReducer,
  buildAttachmentDraftContent,
  createInitialAttachmentDraftState,
  hasBlockingAttachmentDraftItems,
} from './attachment-draft-machine';

describe('attachment draft machine', () => {
  it('keeps file order, blocks send until every file is ready, and emits structured send content', () => {
    const queuedState = attachmentDraftReducer(createInitialAttachmentDraftState(), {
      type: 'files/queued',
      items: [
        {
          type: 'imageAttachment',
          id: 'draft-1',
          label: 'first.png',
          fileName: 'first.png',
          previewUrl: 'blob:first',
          status: 'processing',
        },
        {
          type: 'imageAttachment',
          id: 'draft-2',
          label: 'second.png',
          fileName: 'second.png',
          previewUrl: 'blob:second',
          status: 'processing',
        },
      ],
      limitMessage: '',
    });

    expect(hasBlockingAttachmentDraftItems(queuedState)).toBe(true);

    const readyState = attachmentDraftReducer(
      attachmentDraftReducer(queuedState, {
        type: 'file/ready',
        itemId: 'draft-1',
        attachmentId: 'att-1',
      }),
      {
        type: 'file/ready',
        itemId: 'draft-2',
        attachmentId: 'att-2',
      },
    );

    expect(hasBlockingAttachmentDraftItems(readyState)).toBe(false);
    expect(buildAttachmentDraftContent({ ...readyState, draftText: '按顺序看图' })).toEqual([
      { type: 'text', text: '按顺序看图' },
      { type: 'imageAttachment', attachmentId: 'att-1' },
      { type: 'imageAttachment', attachmentId: 'att-2' },
    ]);
  });

  it('keeps successful uploads after send failure and clears limit message when a failed item is removed', () => {
    const queuedState = attachmentDraftReducer(createInitialAttachmentDraftState(), {
      type: 'files/queued',
      items: [
        {
          type: 'imageAttachment',
          id: 'draft-ready',
          label: 'ready.png',
          fileName: 'ready.png',
          previewUrl: 'blob:ready',
          status: 'processing',
        },
        {
          type: 'imageAttachment',
          id: 'draft-failed',
          label: 'failed.png',
          fileName: 'failed.png',
          previewUrl: 'blob:failed',
          status: 'processing',
        },
      ],
      limitMessage: 'Maximum 5 images per message',
    });

    const stateWithFailure = attachmentDraftReducer(
      attachmentDraftReducer(queuedState, {
        type: 'file/ready',
        itemId: 'draft-ready',
        attachmentId: 'att-ready',
      }),
      {
        type: 'file/failed',
        itemId: 'draft-failed',
        errorMessage: 'upload failed',
      },
    );

    expect(hasBlockingAttachmentDraftItems(stateWithFailure)).toBe(true);

    const retryReadyState = attachmentDraftReducer(
      attachmentDraftReducer(stateWithFailure, { type: 'send/started' }),
      { type: 'send/failed' },
    );

    expect(retryReadyState.items[0]?.status).toBe('ready');

    const removedFailureState = attachmentDraftReducer(retryReadyState, {
      type: 'item/removed',
      itemId: 'draft-failed',
    });

    expect(removedFailureState.limitMessage).toBe('');
    expect(buildAttachmentDraftContent(removedFailureState)).toEqual([
      { type: 'imageAttachment', attachmentId: 'att-ready' },
    ]);
    expect(hasBlockingAttachmentDraftItems(removedFailureState)).toBe(false);
  });
});
