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

function buildEditableDetail(overrides: Partial<{ path: string; name: string; size: number; content: string }> = {}) {
  const path = overrides.path ?? 'src/components/App.tsx';
  return {
    kind: 'editable' as const,
    file: {
      path,
      name: overrides.name ?? path.split('/').pop() ?? 'App.tsx',
      size: overrides.size ?? 1200,
      encoding: 'utf-8',
      content: overrides.content ?? 'export function App() {}\n',
      isTextEditable: true as const,
      tooLarge: false as const,
    },
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
      fileDetail={buildEditableDetail()}
      loading={false}
      notice=""
      onClose={vi.fn()}
      onDraftChange={vi.fn()}
      onNavigate={vi.fn()}
      onOpenFile={vi.fn()}
      onSave={vi.fn(() => true)}
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
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSave).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.queryByRole('textbox', { name: 'File content' })).toBeNull());
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByText('Preview')).toBeInTheDocument();
  });

  it('confirms before leaving edit mode through Back and stays in edit mode when canceled', () => {
    const onDraftChange = vi.fn();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);

    renderExplorer({
      dirty: true,
      draft: 'export function App() { return null; }\n',
      onDraftChange,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.click(screen.getByRole('button', { name: /back/i }));

    expect(confirm).toHaveBeenCalledWith('You have unsaved file changes. Discard them?');
    expect(screen.getByRole('textbox', { name: 'File content' })).toBeInTheDocument();
    expect(onDraftChange).not.toHaveBeenCalled();
  });

  it('keeps the same reading position when switching between preview and edit for the same file', () => {
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
