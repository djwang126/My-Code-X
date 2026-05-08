export type ImageAttachmentDraftStatus = 'ready' | 'processing' | 'failed' | 'sending';

export type ImageAttachmentDraftItem = {
  type: 'imageAttachment';
  id: string;
  label: string;
  fileName: string;
  previewUrl: string;
  status: ImageAttachmentDraftStatus;
  attachmentId?: string;
  errorMessage?: string;
};
