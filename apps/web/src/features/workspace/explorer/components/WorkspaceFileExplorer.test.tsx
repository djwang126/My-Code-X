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

function buildEntry(
  overrides: Partial<{
    path: string;
    name: string;
    kind: 'directory' | 'file';
    size: number;
    ext: string;
    isTextEditable: boolean;
  }> = {},
) {
  return {
    path: 'docs',
    name: 'docs',
    kind: 'directory' as const,
    size: 0,
    ext: '',
    isTextEditable: false,
    ...overrides,
  };
}

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

function renderExplorer(
  overrides: Partial<ComponentProps<typeof WorkspaceFileExplorer>> = {},
) {
  return render(
    <WorkspaceFileExplorer
      currentPath="src/components"
      dirty={false}
      draft=""
      entries={[
        buildEntry(),
        buildEntry({
          path: 'src/components/App.tsx',
          name: 'App.tsx',
          kind: 'file',
          size: 1200,
          ext: '.tsx',
          isTextEditable: true,
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
      open
      saving={false}
      {...overrides}
    />,
  );
}

describe('WorkspaceFileExplorer mobile-first flow', () => {
  it('renders a single-column file list with breadcrumbs and compact one-line metadata', () => {
    renderExplorer({
      entries: [
        buildEntry(),
        buildEntry({
          path: 'src/components/logo.svg',
          name: 'logo.svg',
          kind: 'file',
          size: 512,
          ext: '.svg',
          isTextEditable: false,
        }),
      ],
    });

    expect(screen.getByRole('navigation', { name: 'File path' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'root' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'src' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'components' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /docs/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /logo\.svg/i })).toBeInTheDocument();
    expect(screen.getByText('512 B · RO')).toBeInTheDocument();
    expect(screen.queryByText(/read-only/i)).toBeNull();
  });

  it('uses close on the list screen and does not expose Up at the root level', () => {
    const onClose = vi.fn();

    renderExplorer({
      currentPath: '',
      entries: [buildEntry()],
      onClose,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Close File Explorer' }));

    expect(onClose).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: /up/i })).toBeNull();
  });

  it('switches from list to preview when a file detail is available, then returns to list with Back', () => {
    renderExplorer({
      fileDetail: buildEditableDetail(),
      draft: 'export function App() {}\n',
    });

    expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByText('1.2 KB')).toBeInTheDocument();
    expect(screen.getByText('utf-8')).toBeInTheDocument();
    expect(screen.getByText('Editable')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Close File Explorer' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /back/i }));

    expect(screen.getByRole('button', { name: 'Close File Explorer' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /App\.tsx/i })).toBeInTheDocument();
  });

  it('renders markdown files in preview mode and keeps non-markdown files literal', () => {
    const { rerender } = renderExplorer({
      fileDetail: buildEditableDetail({
        path: 'docs/plan.md',
        name: 'plan.md',
        content: '# Plan\n\n- first\n- second\n',
      }),
      draft: '# Plan\n\n- first\n- second\n',
    });

    expect(screen.getByRole('heading', { name: 'Plan' })).toBeInTheDocument();
    expect(screen.getByText('first', { selector: 'li' })).toBeInTheDocument();
    expect(screen.getByText('second', { selector: 'li' })).toBeInTheDocument();

    rerender(
      <WorkspaceFileExplorer
        currentPath="config"
        dirty={false}
        draft={'# not markdown heading\n{"ok": true}\n'}
        entries={[]}
        errorMessage=""
        fileDetail={buildEditableDetail({
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
    expect(screen.queryByRole('heading', { name: 'not markdown heading' })).toBeNull();
  });

  it('separates preview and edit screens, with save and discard in the editor action bar', () => {
    const onSave = vi.fn();

    renderExplorer({
      fileDetail: buildEditableDetail(),
      draft: 'export function App() { return null; }\n',
      dirty: true,
      onSave,
    });

    expect(screen.queryByRole('textbox', { name: 'File content' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));

    expect(screen.getByRole('textbox', { name: 'File content' })).toBeInTheDocument();
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save/i })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Preview' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(onSave).toHaveBeenCalledOnce();
  });

  it('confirms before discarding unsaved edits and restores the saved content on discard', () => {
    const onDraftChange = vi.fn();
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderExplorer({
      fileDetail: buildEditableDetail(),
      draft: 'export function App() { return null; }\n',
      dirty: true,
      onDraftChange,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));

    expect(window.confirm).toHaveBeenCalledWith('You have unsaved file changes. Discard them?');
    expect(onDraftChange).toHaveBeenCalledWith('export function App() {}\n');
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
  });

  it('shows dedicated read-only and too-large detail states with a route back to files', () => {
    const { rerender } = renderExplorer({
      currentPath: 'assets',
      fileDetail: {
        kind: 'readOnly',
        path: 'assets/logo.svg',
        name: 'logo.svg',
        size: 512,
      },
    });

    expect(screen.getByText('This file is view-only.')).toBeInTheDocument();
    expect(screen.getByText('512 B · RO')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /back to files/i }));
    expect(screen.getByRole('button', { name: 'Close File Explorer' })).toBeInTheDocument();

    rerender(
      <WorkspaceFileExplorer
        currentPath="logs"
        dirty={false}
        draft=""
        entries={[]}
        errorMessage=""
        fileDetail={{
          kind: 'tooLarge',
          file: {
            path: 'logs/big.log',
            name: 'big.log',
            size: 300_000,
            encoding: 'utf-8',
            content: '',
            isTextEditable: true,
            tooLarge: true,
          },
        }}
        loading={false}
        notice=""
        onClose={vi.fn()}
        onDraftChange={vi.fn()}
        onNavigate={vi.fn()}
        onOpenFile={vi.fn()}
        onSave={vi.fn()}
        open
        saving={false}
      />,
    );

    expect(screen.getByText('File too large for inline preview.')).toBeInTheDocument();
    expect(screen.getByText('293.0 KB · Large')).toBeInTheDocument();
    expect(screen.getByText('Limit: 256 KB')).toBeInTheDocument();
  });

  it('renders loading, empty-folder, and error states without collapsing the explorer shell', () => {
    const { rerender } = renderExplorer({
      loading: true,
      entries: [],
    });

    expect(screen.getByText('Loading folder…')).toBeInTheDocument();

    rerender(
      <WorkspaceFileExplorer
        currentPath="src/components"
        dirty={false}
        draft=""
        entries={[]}
        errorMessage=""
        fileDetail={null}
        loading={false}
        notice=""
        onClose={vi.fn()}
        onDraftChange={vi.fn()}
        onNavigate={vi.fn()}
        onOpenFile={vi.fn()}
        onSave={vi.fn()}
        open
        saving={false}
      />,
    );

    expect(screen.getByText('This folder is empty.')).toBeInTheDocument();

    rerender(
      <WorkspaceFileExplorer
        currentPath="src/components"
        dirty={false}
        draft=""
        entries={[]}
        errorMessage="workspace/list failed"
        fileDetail={null}
        loading={false}
        notice=""
        onClose={vi.fn()}
        onDraftChange={vi.fn()}
        onNavigate={vi.fn()}
        onOpenFile={vi.fn()}
        onSave={vi.fn()}
        open
        saving={false}
      />,
    );

    expect(screen.getByText('workspace/list failed')).toBeInTheDocument();
  });
});
