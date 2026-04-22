import type { SessionSendContentItem } from '../../chat-runtime';
import type { ImageAttachmentDraftItem } from '../types';

export type AttachmentDraftState = {
  draftText: string;
  items: ImageAttachmentDraftItem[];
  limitMessage: string;
};

export type AttachmentDraftAction =
  | { type: 'draft/text-changed'; text: string }
  | { type: 'draft/cleared' }
  | { type: 'files/queued'; items: ImageAttachmentDraftItem[]; limitMessage: string }
  | { type: 'file/ready'; itemId: string; attachmentId: string }
  | { type: 'file/failed'; itemId: string; errorMessage: string }
  | { type: 'item/removed'; itemId: string }
  | { type: 'send/started' }
  | { type: 'send/failed' };

function updateDraftItem(
  items: ImageAttachmentDraftItem[],
  itemId: string,
  updater: (item: ImageAttachmentDraftItem) => ImageAttachmentDraftItem,
) {
  return items.map(item => (item.id === itemId ? updater(item) : item));
}

export function createInitialAttachmentDraftState(): AttachmentDraftState {
  return {
    draftText: '',
    items: [],
    limitMessage: '',
  };
}

export function attachmentDraftReducer(state: AttachmentDraftState, action: AttachmentDraftAction): AttachmentDraftState {
  switch (action.type) {
    case 'draft/text-changed':
      return { ...state, draftText: action.text };
    case 'draft/cleared':
      return createInitialAttachmentDraftState();
    case 'files/queued':
      return {
        ...state,
        items: [...state.items, ...action.items],
        limitMessage: action.limitMessage,
      };
    case 'file/ready':
      return {
        ...state,
        items: updateDraftItem(state.items, action.itemId, item => ({
          ...item,
          status: 'ready',
          attachmentId: action.attachmentId,
          errorMessage: undefined,
        })),
      };
    case 'file/failed':
      return {
        ...state,
        items: updateDraftItem(state.items, action.itemId, item => ({
          ...item,
          status: 'failed',
          errorMessage: action.errorMessage,
        })),
      };
    case 'item/removed':
      return {
        ...state,
        items: state.items.filter(item => item.id !== action.itemId),
        limitMessage: '',
      };
    case 'send/started':
      return {
        ...state,
        items: state.items.map(item => (item.status === 'ready' ? { ...item, status: 'sending' } : item)),
      };
    case 'send/failed':
      return {
        ...state,
        items: state.items.map(item => (item.status === 'sending' ? { ...item, status: 'ready' } : item)),
      };
    default:
      return state;
  }
}

export function hasBlockingAttachmentDraftItems(state: AttachmentDraftState) {
  return state.items.some(item => item.status === 'processing' || item.status === 'failed' || item.status === 'sending');
}

export function buildAttachmentDraftContent(state: AttachmentDraftState): SessionSendContentItem[] {
  const content: SessionSendContentItem[] = [];
  const trimmedText = state.draftText.trim();

  if (trimmedText) {
    content.push({ type: 'text', text: trimmedText });
  }

  for (const item of state.items) {
    if (item.status === 'ready' && item.attachmentId) {
      content.push({ type: 'imageAttachment', attachmentId: item.attachmentId });
    }
  }

  return content;
}
