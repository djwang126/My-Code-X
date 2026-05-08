import type { ComponentProps } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkspaceFileExplorer } from './WorkspaceFileExplorer';

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  vi.restoreAllMocks();
});

function buildTextDetail(overrides: Partial<{ path: string; name: string; size: number; content: string; truncated: boolean }> = {}) {
  const path = overrides.path ?? 'src/components/App.tsx';
  return {
    kind: 'text' as const,
    path,
    name: overrides.name ?? path.split('/').pop() ?? 'App.tsx',
    size: overrides.size ?? 1200,
    encoding: 'utf-8' as const,
    content: overrides.content ?? 'export function App() {}\n',
    truncated: overrides.truncated ?? false,
  };
}

function renderExplorer(overrides: Partial<ComponentProps<typeof WorkspaceFileExplorer>> = {}) {
  return render(
    <WorkspaceFileExplorer
      currentPath="src/components"
      dirty={false}
      draft="export function App() {}\n"
      entries={[]}
      errorMessage=""
      fileDetail={buildTextDetail()}
      loading={false}
      notice=""
      onClose={vi.fn()}
      onDraftChange={vi.fn()}
      onNavigate={vi.fn()}
      onOpenFile={vi.fn()}
      onSave={vi.fn(() => true)}
      onStartTextEdit={vi.fn(() => true)}
      open
      saving={false}
      {...overrides}
    />,
  );
}

describe('WorkspaceFileExplorer edit flow', () => {
  it('returns to preview after a successful save', async () => {
    const onSave = vi.fn(() => true);

    renderExplorer({
      dirty: true,
      draft: 'export function App() { return null; }\n',
      onSave,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'File content' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSave).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.queryByRole('textbox', { name: 'File content' })).toBeNull());
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByText('Preview')).toBeInTheDocument();
  });

  it('confirms before leaving edit mode through Back and stays in edit mode when canceled', async () => {
    const onDraftChange = vi.fn();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);

    renderExplorer({
      dirty: true,
      draft: 'export function App() { return null; }\n',
      onDraftChange,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'File content' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /back/i }));

    expect(confirm).toHaveBeenCalledWith('You have unsaved file changes. Discard them?');
    expect(screen.getByRole('textbox', { name: 'File content' })).toBeInTheDocument();
    expect(onDraftChange).not.toHaveBeenCalled();
  });

  it('loads the full text file before entering edit when preview is truncated', async () => {
    const onStartTextEdit = vi.fn(() => true);

    renderExplorer({
      draft: 'preview only\n',
      fileDetail: buildTextDetail({
        path: 'logs/big.log',
        name: 'big.log',
        size: 300_000,
        content: 'preview only\n',
        truncated: true,
      }),
      onStartTextEdit,
    });

    expect(screen.getByText('Showing the preview first. Edit loads the full file.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));

    expect(onStartTextEdit).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'File content' })).toBeInTheDocument());
  });

  it('keeps the same reading position when switching between preview and edit for the same file', async () => {
    const scrollHeightDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollHeight');
    const clientHeightDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight');

    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
      configurable: true,
      get: () => 1000,
    });
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
      configurable: true,
      get: () => 200,
    });

    try {
      const { container } = renderExplorer();
      const preview = container.querySelector('.workspace-editor-preview-content') as HTMLDivElement;
      preview.scrollTop = 320;

      fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
      await waitFor(() => expect(screen.getByRole('textbox', { name: 'File content' })).toBeInTheDocument());

      const editor = screen.getByRole('textbox', { name: 'File content' }) as HTMLTextAreaElement;
      expect(editor.scrollTop).toBe(320);

      editor.scrollTop = 540;
      fireEvent.click(screen.getByRole('button', { name: /back/i }));

      const restoredPreview = container.querySelector('.workspace-editor-preview-content') as HTMLDivElement;
      expect(restoredPreview.scrollTop).toBe(540);
    } finally {
      if (scrollHeightDescriptor) {
        Object.defineProperty(HTMLElement.prototype, 'scrollHeight', scrollHeightDescriptor);
      }

      if (clientHeightDescriptor) {
        Object.defineProperty(HTMLElement.prototype, 'clientHeight', clientHeightDescriptor);
      }
    }
  });
});
