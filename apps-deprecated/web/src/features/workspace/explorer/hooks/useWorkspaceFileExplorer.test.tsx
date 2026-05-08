import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { useWorkspaceFileExplorer } from './useWorkspaceFileExplorer';

let filePathListProbeCount = 0;
let outsideWorkspaceErrorCount = 0;

function WorkspaceFileExplorerHarness() {
  const explorer = useWorkspaceFileExplorer({
    workspace: 'D:/workspace/example-app',
    onError: message => {
      if (message === 'The selected file is outside the current workspace.') {
        outsideWorkspaceErrorCount += 1;
      }
      return false;
    },
  });

  return (
    <div>
      <button onClick={() => void explorer.handleWorkspaceExplorerOpen()} type="button">Open explorer</button>
      <button onClick={() => void explorer.handleWorkspaceExplorerClose()} type="button">Close explorer</button>
      <button onClick={() => void explorer.handleWorkspaceFileOpen('slow.json')} type="button">Open slow</button>
      <button onClick={() => void explorer.handleWorkspaceFileOpen('fast.json')} type="button">Open fast</button>
      <button onClick={() => void explorer.handleWorkspaceExplorerNavigate('docs')} type="button">Go docs</button>
      <button onClick={() => void explorer.handleWorkspaceFileLinkOpen('file:///D:/workspace/example-app/docs/guide.md')} type="button">
        Open guide link
      </button>
      <button onClick={() => void explorer.handleWorkspaceFileLinkOpen('docs/guide.md')} type="button">
        Open guide relative link
      </button>
      <button onClick={() => void explorer.handleWorkspaceFileOpen('big.txt')} type="button">Open large</button>
      <button onClick={() => void explorer.handleWorkspaceTextEditStart()} type="button">Load large full</button>
      <button onClick={() => void explorer.handleWorkspaceFileOpen('photo.png')} type="button">Open image</button>
      <button onClick={() => void explorer.handleWorkspaceFileOpen('archive.db')} type="button">Open binary</button>
      <button onClick={() => explorer.setWorkspaceFileDraft('changed\n')} type="button">Dirty draft</button>
      <button onClick={() => void explorer.handleWorkspaceFileLinkOpen('file:///D:/other-workspace/docs/guide.md')} type="button">
        Open outside link
      </button>
      <div aria-label="match file href">{String(explorer.isWorkspaceFileLink('file:///D:/workspace/example-app/docs/guide.md'))}</div>
      <div aria-label="match absolute path">{String(explorer.isWorkspaceFileLink('D:/workspace/example-app/docs/guide.md'))}</div>
      <div aria-label="match relative path">{String(explorer.isWorkspaceFileLink('docs/guide.md'))}</div>
      <div aria-label="match web href">{String(explorer.isWorkspaceFileLink('https://www.openai.com'))}</div>
      <div aria-label="explorer open">{String(explorer.workspaceExplorerOpen)}</div>
      <div aria-label="notice">{explorer.workspaceExplorerNotice || 'none'}</div>
      <div aria-label="error">{explorer.workspaceExplorerError || 'none'}</div>
      <div aria-label="path">{explorer.workspaceExplorerPath || '.'}</div>
      <div aria-label="active file">{explorer.workspaceFileDetail?.name ?? 'none'}</div>
      <div aria-label="active kind">{explorer.workspaceFileDetail?.kind ?? 'none'}</div>
      <textarea aria-label="draft" readOnly value={explorer.workspaceFileDraft} />
    </div>
  );
}

const server = setupServer(
  http.get('/api/v2/workspace/files', ({ request }) => {
    const url = new URL(request.url);
    const path = url.searchParams.get('path') || '';

    if (path === 'docs/guide.md') {
      filePathListProbeCount += 1;
      return new HttpResponse('not_found', { status: 404 });
    }

    if (path === 'docs') {
      return HttpResponse.json({
        data: [
          {
            path: 'docs/guide.md',
            name: 'guide.md',
            kind: 'file',
            size: 12,
            ext: '.md',
            contentKind: 'text',
            isLarge: false,
          },
        ],
      });
    }

    if (path !== '') {
      return new HttpResponse('not_found', { status: 404 });
    }

    return HttpResponse.json({
      data: [
        {
          path: 'slow.json',
          name: 'slow.json',
          kind: 'file',
          size: 11,
          ext: '.json',
          contentKind: 'text',
          isLarge: false,
        },
        {
          path: 'fast.json',
          name: 'fast.json',
          kind: 'file',
          size: 11,
          ext: '.json',
          contentKind: 'text',
          isLarge: false,
        },
        {
          path: 'docs',
          name: 'docs',
          kind: 'directory',
          size: 0,
          ext: '',
          contentKind: null,
          isLarge: false,
        },
        {
          path: 'big.txt',
          name: 'big.txt',
          kind: 'file',
          size: 300_000,
          ext: '.txt',
          contentKind: 'text',
          isLarge: true,
        },
        {
          path: 'photo.png',
          name: 'photo.png',
          kind: 'file',
          size: 2048,
          ext: '.png',
          contentKind: 'image',
          isLarge: false,
        },
        {
          path: 'archive.db',
          name: 'archive.db',
          kind: 'file',
          size: 4096,
          ext: '.db',
          contentKind: 'binary',
          isLarge: false,
        },
      ],
    });
  }),
  http.get('/api/v2/workspace/file', async ({ request }) => {
    const url = new URL(request.url);
    const path = url.searchParams.get('path') || '';
    const full = url.searchParams.get('full') === '1';

    if (path === 'docs/guide.md') {
      return HttpResponse.json({
        kind: 'text',
        path: 'docs/guide.md',
        name: 'guide.md',
        size: 12,
        encoding: 'utf-8',
        content: '# guide\n',
        truncated: false,
      });
    }

    if (path === 'slow.json') {
      await new Promise(resolve => setTimeout(resolve, 80));
      return HttpResponse.json({
        kind: 'text',
        path: 'slow.json',
        name: 'slow.json',
        size: 11,
        encoding: 'utf-8',
        content: '{"slow":1}\n',
        truncated: false,
      });
    }

    if (path === 'fast.json') {
      return HttpResponse.json({
        kind: 'text',
        path: 'fast.json',
        name: 'fast.json',
        size: 11,
        encoding: 'utf-8',
        content: '{"fast":1}\n',
        truncated: false,
      });
    }

    if (path === 'big.txt') {
      return HttpResponse.json({
        kind: 'text',
        path: 'big.txt',
        name: 'big.txt',
        size: 300_000,
        encoding: 'utf-8',
        content: full ? 'full big file\n' : 'preview big file\n',
        truncated: !full,
      });
    }

    if (path === 'photo.png') {
      return HttpResponse.json({
        kind: 'image',
        path: 'photo.png',
        name: 'photo.png',
        size: 2048,
        contentType: 'image/png',
        url: '/api/v2/workspace/file/content?workspace=D%3A%2Fworkspace%2Fexample-app&path=photo.png',
      });
    }

    if (path === 'archive.db') {
      return HttpResponse.json({
        kind: 'binary',
        path: 'archive.db',
        name: 'archive.db',
        size: 4096,
        contentType: null,
      });
    }

    return new HttpResponse('not_found', { status: 404 });
  }),
);

beforeAll(() => server.listen());

afterEach(() => {
  cleanup();
  server.resetHandlers();
  filePathListProbeCount = 0;
  outsideWorkspaceErrorCount = 0;
  vi.unstubAllGlobals();
});

afterAll(() => server.close());

describe('useWorkspaceFileExplorer', () => {
  it('keeps the last requested file when older requests resolve later', async () => {
    render(<WorkspaceFileExplorerHarness />);

    fireEvent.click(screen.getByRole('button', { name: 'Open slow' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open fast' }));

    await waitFor(() => {
      expect(screen.getByLabelText('draft')).toHaveValue('{"fast":1}\n');
    });

    await new Promise(resolve => setTimeout(resolve, 120));

    expect(screen.getByLabelText('active file')).toHaveTextContent('fast.json');
  });

  it('opens file links without first probing the file path as a directory', async () => {
    render(<WorkspaceFileExplorerHarness />);

    fireEvent.click(screen.getByRole('button', { name: 'Open guide link' }));

    await waitFor(() => {
      expect(screen.getByLabelText('draft')).toHaveValue('# guide\n');
    });

    expect(screen.getByLabelText('active file')).toHaveTextContent('guide.md');
    expect(filePathListProbeCount).toBe(0);
  });

  it('opens workspace-relative path references from AI output', async () => {
    render(<WorkspaceFileExplorerHarness />);

    fireEvent.click(screen.getByRole('button', { name: 'Open guide relative link' }));

    await waitFor(() => {
      expect(screen.getByLabelText('active file')).toHaveTextContent('guide.md');
    });

    expect(screen.getByLabelText('draft')).toHaveValue('# guide\n');
  });

  it('recognizes workspace file links before opening them', () => {
    render(<WorkspaceFileExplorerHarness />);

    expect(screen.getByLabelText('match file href')).toHaveTextContent('true');
    expect(screen.getByLabelText('match absolute path')).toHaveTextContent('true');
    expect(screen.getByLabelText('match relative path')).toHaveTextContent('true');
    expect(screen.getByLabelText('match web href')).toHaveTextContent('false');
  });

  it('keeps large text files as text detail state and can load the full content for edit', async () => {
    render(<WorkspaceFileExplorerHarness />);

    fireEvent.click(screen.getByRole('button', { name: 'Open large' }));

    await waitFor(() => {
      expect(screen.getByLabelText('active file')).toHaveTextContent('big.txt');
    });

    expect(screen.getByLabelText('active kind')).toHaveTextContent('text');
    expect(screen.getByLabelText('draft')).toHaveValue('preview big file\n');

    fireEvent.click(screen.getByRole('button', { name: 'Load large full' }));

    await waitFor(() => {
      expect(screen.getByLabelText('draft')).toHaveValue('full big file\n');
    });
    expect(screen.getByLabelText('notice')).toHaveTextContent('Loaded full big.txt');
  });

  it('opens image files as image detail state', async () => {
    render(<WorkspaceFileExplorerHarness />);

    fireEvent.click(screen.getByRole('button', { name: 'Open image' }));

    await waitFor(() => {
      expect(screen.getByLabelText('active file')).toHaveTextContent('photo.png');
    });

    expect(screen.getByLabelText('active kind')).toHaveTextContent('image');
    expect(screen.getByLabelText('draft')).toHaveValue('');
  });

  it('opens binary files as binary detail state', async () => {
    render(<WorkspaceFileExplorerHarness />);

    fireEvent.click(screen.getByRole('button', { name: 'Open binary' }));

    await waitFor(() => {
      expect(screen.getByLabelText('active file')).toHaveTextContent('archive.db');
    });

    expect(screen.getByLabelText('active kind')).toHaveTextContent('binary');
    expect(screen.getByLabelText('draft')).toHaveValue('');
  });

  it('keeps the explorer open and the current file intact when closing is canceled with unsaved changes', async () => {
    const confirmSpy = vi.fn(() => false);
    vi.stubGlobal('confirm', confirmSpy);

    render(<WorkspaceFileExplorerHarness />);

    fireEvent.click(screen.getByRole('button', { name: 'Open explorer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open fast' }));

    await waitFor(() => {
      expect(screen.getByLabelText('active file')).toHaveTextContent('fast.json');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Dirty draft' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close explorer' }));

    expect(confirmSpy).toHaveBeenCalledWith('You have unsaved file changes. Discard them?');
    expect(screen.getByLabelText('explorer open')).toHaveTextContent('true');
    expect(screen.getByLabelText('draft')).toHaveValue('changed\n');
  });

  it('blocks navigation to another folder when the user refuses to discard unsaved changes', async () => {
    const confirmSpy = vi.fn(() => false);
    vi.stubGlobal('confirm', confirmSpy);

    render(<WorkspaceFileExplorerHarness />);

    fireEvent.click(screen.getByRole('button', { name: 'Open fast' }));

    await waitFor(() => {
      expect(screen.getByLabelText('active file')).toHaveTextContent('fast.json');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Dirty draft' }));
    fireEvent.click(screen.getByRole('button', { name: 'Go docs' }));

    expect(confirmSpy).toHaveBeenCalledWith('You have unsaved file changes. Discard them?');
    expect(screen.getByLabelText('path')).toHaveTextContent('.');
    expect(screen.getByLabelText('active file')).toHaveTextContent('fast.json');
  });

  it('allows file-link navigation to continue after the user accepts discarding unsaved changes', async () => {
    const confirmSpy = vi.fn(() => true);
    vi.stubGlobal('confirm', confirmSpy);

    render(<WorkspaceFileExplorerHarness />);

    fireEvent.click(screen.getByRole('button', { name: 'Open fast' }));

    await waitFor(() => {
      expect(screen.getByLabelText('active file')).toHaveTextContent('fast.json');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Dirty draft' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open guide link' }));

    expect(confirmSpy).toHaveBeenCalledWith('You have unsaved file changes. Discard them?');
    await waitFor(() => {
      expect(screen.getByLabelText('active file')).toHaveTextContent('guide.md');
    });
  });

  it('rejects file links outside the active workspace without opening a file', async () => {
    render(<WorkspaceFileExplorerHarness />);

    fireEvent.click(screen.getByRole('button', { name: 'Open outside link' }));

    await waitFor(() => {
      expect(outsideWorkspaceErrorCount).toBe(1);
    });

    expect(screen.getByLabelText('active file')).toHaveTextContent('none');
    expect(screen.getByLabelText('explorer open')).toHaveTextContent('false');
  });
});
