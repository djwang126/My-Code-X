import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { renderChatPage } from './ChatPageLayout.test-helpers';

const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

beforeAll(() => {
  URL.createObjectURL = vi.fn(file => `blob:preview/${file instanceof File ? file.name : 'attachment'}`);
  URL.revokeObjectURL = vi.fn();
});

afterAll(() => {
  URL.createObjectURL = originalCreateObjectURL;
  URL.revokeObjectURL = originalRevokeObjectURL;
});

function createImageFile(name: string) {
  return new File([`${name}-content`], name, { type: 'image/png' });
}

function getAttachmentDialog() {
  return screen.getByRole('dialog', { name: 'Add images' });
}

function getAttachmentInput() {
  const dialog = getAttachmentDialog();
  const input = dialog.querySelector('input[type="file"]');
  if (!(input instanceof HTMLInputElement)) {
    throw new Error('attachment file input not found');
  }

  return input;
}

async function openAttachmentDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Add images' }));
  expect(getAttachmentDialog()).toBeInTheDocument();
}

async function uploadImages(user: ReturnType<typeof userEvent.setup>, files: File[]) {
  await user.upload(getAttachmentInput(), files);
}

describe('ChatPageLayout image attachments', () => {
  it('shows an Add images action in the conversation action column and opens a dedicated picker dialog', async () => {
    const user = userEvent.setup();

    renderChatPage();

    expect(screen.getByRole('button', { name: 'New Thread' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rollback' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add images' }));

    expect(screen.getByRole('dialog', { name: 'Add images' })).toBeInTheDocument();
    expect(screen.getByText('Up to 5 images per message')).toBeInTheDocument();
  });

  it('shows selected images in send order and blocks adding a sixth image with a clear limit message', async () => {
    const user = userEvent.setup();
    const uploadedFileNames: string[] = [];

    renderChatPage({
      onUploadAttachment: async (file: File) => {
        uploadedFileNames.push(file.name);
        return { attachmentId: `att-${file.name}` };
      },
    });

    await openAttachmentDialog(user);
    await uploadImages(user, [
      createImageFile('image-1.png'),
      createImageFile('image-2.png'),
      createImageFile('image-3.png'),
      createImageFile('image-4.png'),
      createImageFile('image-5.png'),
      createImageFile('image-6.png'),
    ]);

    expect(uploadedFileNames).toEqual([
      'image-1.png',
      'image-2.png',
      'image-3.png',
      'image-4.png',
      'image-5.png',
    ]);
    expect(screen.getByRole('img', { name: 'Selected image 1' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Selected image 5' })).toBeInTheDocument();
    expect(screen.getByText('Maximum 5 images per message')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'Selected image 6' })).toBeNull();
  });

  it('renders attached user images as thumbnails instead of [image] placeholders', () => {
    renderChatPage({
      messages: [
        {
          id: 'user-image-1',
          kind: 'message',
          itemType: 'userMessage',
          role: 'user',
          text: '看看这个错误',
          state: 'complete',
          threadId: 'thread-1',
          turnId: 'turn-1',
          content: [
            { type: 'text', text: '看看这个错误' },
            { type: 'image', url: '/api/v2/chat/attachments/att-1/content' },
          ],
          raw: {
            type: 'userMessage',
            id: 'user-image-1',
            content: [
              { type: 'text', text: '看看这个错误' },
              { type: 'image', url: '/api/v2/chat/attachments/att-1/content' },
            ],
          },
        },
      ],
    });

    expect(screen.getByRole('img', { name: 'Attached image 1' })).toHaveAttribute(
      'src',
      '/api/v2/chat/attachments/att-1/content',
    );
    expect(screen.queryByText('[image]')).toBeNull();
  });

  it('renders structured text items with markdown formatting alongside attached images', () => {
    renderChatPage({
      messages: [
        {
          id: 'user-image-markdown-1',
          kind: 'message',
          itemType: 'userMessage',
          role: 'user',
          text: '**加粗** `代码`',
          state: 'complete',
          threadId: 'thread-1',
          turnId: 'turn-markdown-1',
          content: [
            { type: 'text', text: '**加粗** before image' },
            { type: 'image', url: '/api/v2/chat/attachments/att-md-1/content' },
            { type: 'text', text: '`代码` after image' },
          ],
          raw: {
            type: 'userMessage',
            id: 'user-image-markdown-1',
            content: [
              { type: 'text', text: '**加粗** before image' },
              { type: 'image', url: '/api/v2/chat/attachments/att-md-1/content' },
              { type: 'text', text: '`代码` after image' },
            ],
          },
        },
      ],
    });

    expect(screen.getByText('加粗', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getByText('代码', { selector: 'code' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Attached image 1' })).toHaveAttribute(
      'src',
      '/api/v2/chat/attachments/att-md-1/content',
    );
  });

  it('opens a larger preview when the user taps an attached image thumbnail', async () => {
    const user = userEvent.setup();

    renderChatPage({
      messages: [
        {
          id: 'user-image-1',
          kind: 'message',
          itemType: 'userMessage',
          role: 'user',
          text: '放大看一下',
          state: 'complete',
          threadId: 'thread-1',
          turnId: 'turn-1',
          content: [
            { type: 'text', text: '放大看一下' },
            { type: 'image', url: '/api/v2/chat/attachments/att-1/content' },
          ],
          raw: {
            type: 'userMessage',
            id: 'user-image-1',
            content: [
              { type: 'text', text: '放大看一下' },
              { type: 'image', url: '/api/v2/chat/attachments/att-1/content' },
            ],
          },
        },
      ],
    });

    await user.click(screen.getByRole('img', { name: 'Attached image 1' }));

    expect(screen.getByRole('dialog', { name: 'Attached image preview' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Attached image preview content' })).toHaveAttribute(
      'src',
      '/api/v2/chat/attachments/att-1/content',
    );
  });

  it('keeps send disabled until every selected image finishes uploading', async () => {
    const user = userEvent.setup();
    let resolveSecondUpload!: (value: { attachmentId: string }) => void;

    renderChatPage({
      onUploadAttachment: async (file: File) => {
        if (file.name === 'slow.png') {
          return new Promise(resolve => {
            resolveSecondUpload = resolve;
          });
        }

        return { attachmentId: `att-${file.name}` };
      },
    });

    await openAttachmentDialog(user);
    await uploadImages(user, [createImageFile('fast.png'), createImageFile('slow.png')]);

    expect(screen.getByText('Processing')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();

    resolveSecondUpload({ attachmentId: 'att-slow.png' });

    await waitFor(() => expect(screen.queryByText('Processing')).toBeNull());
    expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled();
  });

  it('lets the user remove a failed attachment so the remaining ready images can be sent', async () => {
    const user = userEvent.setup();

    renderChatPage({
      onUploadAttachment: async (file: File) => {
        if (file.name === 'failed.png') {
          throw new Error('upload failed');
        }

        return { attachmentId: `att-${file.name}` };
      },
    });

    await openAttachmentDialog(user);
    await uploadImages(user, [createImageFile('ready.png'), createImageFile('failed.png')]);

    await screen.findByText('Failed');
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();

    const failedItemName = screen.getByText('failed.png');
    const failedItemCard = failedItemName.parentElement;
    if (!(failedItemCard instanceof HTMLElement)) {
      throw new Error('failed attachment card not found');
    }
    await user.click(within(failedItemCard).getByRole('button', { name: 'Remove image' }));

    expect(screen.queryByText('Failed')).toBeNull();
    expect(screen.getByText('Ready')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled();
  });

  it('shows an unavailable state for expired attachments without breaking the rest of the message', () => {
    renderChatPage({
      messages: [
        {
          id: 'user-image-expired',
          kind: 'message',
          itemType: 'userMessage',
          role: 'user',
          text: '旧图片失效了',
          state: 'complete',
          threadId: 'thread-1',
          turnId: 'turn-3',
          content: [
            { type: 'text', text: '旧图片失效了' },
            { type: 'image', url: '/api/v2/chat/attachments/att-missing/content', status: 'unavailable' },
          ],
          raw: {
            type: 'userMessage',
            id: 'user-image-expired',
            content: [
              { type: 'text', text: '旧图片失效了' },
              { type: 'image', url: '/api/v2/chat/attachments/att-missing/content', status: 'unavailable' },
            ],
          },
        },
      ],
    });

    expect(screen.getByText('旧图片失效了')).toBeInTheDocument();
    expect(screen.getByText('Attachment unavailable')).toBeInTheDocument();
  });

  it('falls back to an unavailable attachment state when the image URL fails to load', () => {
    renderChatPage({
      messages: [
        {
          id: 'user-image-broken',
          kind: 'message',
          itemType: 'userMessage',
          role: 'user',
          text: '这张图加载失败了',
          state: 'complete',
          threadId: 'thread-1',
          turnId: 'turn-4',
          content: [
            { type: 'text', text: '这张图加载失败了' },
            { type: 'image', url: '/api/v2/chat/attachments/att-broken/content' },
          ],
          raw: {
            type: 'userMessage',
            id: 'user-image-broken',
            content: [
              { type: 'text', text: '这张图加载失败了' },
              { type: 'image', url: '/api/v2/chat/attachments/att-broken/content' },
            ],
          },
        },
      ],
    });

    fireEvent.error(screen.getByRole('img', { name: 'Attached image 1' }));

    expect(screen.getByText('这张图加载失败了')).toBeInTheDocument();
    expect(screen.getByText('Attachment unavailable')).toBeInTheDocument();
  });
});
