import type { ComponentProps } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkspaceFileExplorer } from './WorkspaceFileExplorer';

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  vi.restoreAllMocks();
});

function buildDirectoryEntry(overrides: Partial<{ path: string; name: string }> = {}) {
  return {
    path: 'docs',
    name: 'docs',
    kind: 'directory' as const,
    size: 0 as const,
    ext: '' as const,
    contentKind: null,
    isLarge: false as const,
    ...overrides,
  };
}

function buildFileEntry(
  overrides: Partial<{
    path: string;
    name: string;
    size: number;
    ext: string;
    contentKind: 'text' | 'image' | 'binary';
    isLarge: boolean;
  }> = {},
) {
  return {
    path: 'src/components/App.tsx',
    name: 'App.tsx',
    kind: 'file' as const,
    size: 1200,
    ext: '.tsx',
    contentKind: 'text' as const,
    isLarge: false,
    ...overrides,
  };
}

function buildTextDetail(
  overrides: Partial<{ path: string; name: string; size: number; content: string; truncated: boolean }> = {},
) {
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
      draft=""
      entries={[
        buildDirectoryEntry(),
        buildFileEntry({
          path: 'src/components/App.tsx',
          name: 'App.tsx',
          size: 1200,
          ext: '.tsx',
          contentKind: 'text',
          isLarge: false,
        }),
      ]}
      errorMessage=""
      fileDetail={null}
      loading={false}
      notice=""
      onClose={vi.fn()}
      onDraftChange={vi.fn()}
      onNavigate={vi.fn()}
      onOpenFile={vi.fn()}
      onSave={vi.fn()}
      onStartTextEdit={vi.fn(() => true)}
      open
      saving={false}
      {...overrides}
    />,
  );
}

describe('WorkspaceFileExplorer', () => {
  it('renders a single-column list with factual metadata', () => {
    renderExplorer({
      entries: [
        buildDirectoryEntry(),
        buildFileEntry({
          path: 'assets/photo.png',
          name: 'photo.png',
          size: 2048,
          ext: '.png',
          contentKind: 'image',
          isLarge: false,
        }),
        buildFileEntry({
          path: 'logs/big.log',
          name: 'big.log',
          size: 300_000,
          ext: '.log',
          contentKind: 'text',
          isLarge: true,
        }),
      ],
    });

    expect(screen.getByRole('navigation', { name: 'File path' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /photo\.png/i })).toBeInTheDocument();
    expect(screen.getByText('2.0 KB · Image')).toBeInTheDocument();
    expect(screen.getByText('293.0 KB · Text · Large')).toBeInTheDocument();
  });

  it('switches from list to text preview and back', () => {
    renderExplorer({
      draft: 'export function App() {}\n',
      fileDetail: buildTextDetail(),
    });

    expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByText('1.2 KB')).toBeInTheDocument();
    expect(screen.getByText('utf-8')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /back/i }));

    expect(screen.getByRole('button', { name: 'Close File Explorer' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /App\.tsx/i })).toBeInTheDocument();
  });

  it('renders markdown text through markdown preview and non-markdown text literally', () => {
    const { rerender } = renderExplorer({
      draft: '# Plan\n\n- first\n- second\n',
      fileDetail: buildTextDetail({
        path: 'docs/plan.md',
        name: 'plan.md',
        content: '# Plan\n\n- first\n- second\n',
      }),
    });

    expect(screen.getByRole('heading', { name: 'Plan' })).toBeInTheDocument();
    expect(screen.getByText('first', { selector: 'li' })).toBeInTheDocument();

    rerender(
      <WorkspaceFileExplorer
        currentPath="config"
        dirty={false}
        draft={'# not markdown heading\n{"ok": true}\n'}
        entries={[]}
        errorMessage=""
        fileDetail={buildTextDetail({
          path: 'config/settings.json',
          name: 'settings.json',
          content: '# not markdown heading\n{"ok": true}\n',
        })}
        loading={false}
        notice=""
        onClose={vi.fn()}
        onDraftChange={vi.fn()}
        onNavigate={vi.fn()}
        onOpenFile={vi.fn()}
        onSave={vi.fn()}
        onStartTextEdit={vi.fn(() => true)}
        open
        saving={false}
      />,
    );

    expect(
      screen.getByText(
        (_, element) =>
          element?.tagName === 'PRE' && element.textContent === '# not markdown heading\n{"ok": true}\n',
      ),
    ).toBeInTheDocument();
  });

  it('shows image detail with preview affordances', () => {
    renderExplorer({
      fileDetail: {
        kind: 'image',
        path: 'assets/photo.png',
        name: 'photo.png',
        size: 2048,
        contentType: 'image/png',
        url: '/api/v2/workspace/file/content?workspace=x&path=assets%2Fphoto.png',
      },
    });

    expect(screen.getByRole('button', { name: 'Open image preview' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'photo.png' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Open image preview' }));

    expect(screen.getByRole('dialog', { name: 'Workspace image preview' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Workspace image preview content' })).toHaveAttribute(
      'src',
      '/api/v2/workspace/file/content?workspace=x&path=assets%2Fphoto.png',
    );
  });

  it('shows sparse metadata for non-text non-image files', () => {
    renderExplorer({
      fileDetail: {
        kind: 'binary',
        path: 'bin/archive.db',
        name: 'archive.db',
        size: 4096,
        contentType: null,
      },
    });

    expect(screen.getByRole('heading', { name: 'archive.db' })).toBeInTheDocument();
    expect(screen.getByText('4.0 KB · Binary')).toBeInTheDocument();
  });

  it('separates preview and edit screens for text files', async () => {
    const onSave = vi.fn(() => true);
    const onStartTextEdit = vi.fn(() => true);

    renderExplorer({
      fileDetail: buildTextDetail(),
      draft: 'export function App() { return null; }\n',
      dirty: true,
      onSave,
      onStartTextEdit,
    });

    expect(screen.queryByRole('textbox', { name: 'File content' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));

    expect(onStartTextEdit).toHaveBeenCalledOnce();
    expect(await screen.findByRole('textbox', { name: 'File content' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSave).toHaveBeenCalledOnce();
  });

  it('confirms before discarding text edits', async () => {
    const onDraftChange = vi.fn();
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderExplorer({
      fileDetail: buildTextDetail(),
      draft: 'export function App() { return null; }\n',
      dirty: true,
      onDraftChange,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    await screen.findByRole('textbox', { name: 'File content' });
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));

    expect(window.confirm).toHaveBeenCalledWith('You have unsaved file changes. Discard them?');
    expect(onDraftChange).toHaveBeenCalledWith('export function App() {}\n');
  });
});
