import { ensureOk } from '../../../../shared/lib/app-api-client';

export type UploadedImageAttachment = {
  attachmentId: string;
  contentType: string;
  width: number;
  height: number;
  byteLength: number;
};

type UploadImageAttachmentInput = {
  file: File;
  slotId: string;
  threadId?: string;
};

export async function uploadImageAttachment({
  file,
  slotId,
  threadId,
}: UploadImageAttachmentInput): Promise<UploadedImageAttachment> {
  const body = new FormData();
  body.append('file', file);
  body.append('slotId', slotId);
  if (threadId) {
    body.append('threadId', threadId);
  }

  const response = await fetch('/api/v2/chat/attachments', {
    method: 'POST',
    body,
  });

  await ensureOk(response);
  return (await response.json()) as UploadedImageAttachment;
}
