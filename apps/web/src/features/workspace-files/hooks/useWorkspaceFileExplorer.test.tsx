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
      <button onClick={() => void explorer.handleWorkspaceExplorerOpen()} type="button">
        Open explorer
      </button>
      <button onClick={() => void explorer.handleWorkspaceExplorerClose()} type="button">
        Close explorer
      </button>
      <button onClick={() => void explorer.handleWorkspaceFileOpen('slow.json')} type="button">
        Open slow
      </button>
      <button onClick={() => void explorer.handleWorkspaceFileOpen('fast.json')} type="button">
        Open fast
      </button>
      <button onClick={() => void explorer.handleWorkspaceExplorerNavigate('docs')} type="button">
        Go docs
      </button>
      <button
        onClick={() => void explorer.handleWorkspaceFileLinkOpen('file:///D:/workspace/example-app/docs/guide.md')}
        type="button"
      >
        Open guide link
      </button>
      <button onClick={() => void explorer.handleWorkspaceFileLinkOpen('docs/guide.md')} type="button">
        Open guide relative link
      </button>
      <div aria-label="match file href">
        {String(explorer.isWorkspaceFileLink('file:///D:/workspace/example-app/docs/guide.md'))}
      </div>
      <div aria-label="match absolute path">{String(explorer.isWorkspaceFileLink('D:/workspace/example-app/docs/guide.md'))}</div>
      <div aria-label="match relative path">{String(explorer.isWorkspaceFileLink('docs/guide.md'))}</div>
      <div aria-label="match web href">{String(explorer.isWorkspaceFileLink('https://www.openai.com'))}</div>
      <button
        onClick={() => void explorer.handleWorkspaceFileLinkOpen('file:///D:/other-workspace/docs/guide.md')}
        type="button"
      >
        Open outside link
      </button>
      <button onClick={() => void explorer.handleWorkspaceFileOpen('big.txt')} type="button">
        Open large
      </button>
      <button onClick={() => void explorer.handleWorkspaceFileOpen('logo.svg')} type="button">
        Open read only
      </button>
      <button onClick={() => explorer.setWorkspaceFileDraft('changed\n')} type="button">
        Dirty draft
      </button>
      <div aria-label="explorer open">{String(explorer.workspaceExplorerOpen)}</div>
      <div aria-label="notice">{explorer.workspaceExplorerNotice || 'none'}</div>
      <div aria-label="error">{explorer.workspaceExplorerError || 'none'}</div>
      <div aria-label="path">{explorer.workspaceExplorerPath || '.'}</div>
      <div aria-label="active file">
        {explorer.workspaceFileDetail
          ? 'file' in explorer.workspaceFileDetail
            ? explorer.workspaceFileDetail.file.name
            : explorer.workspaceFileDetail.name
          : 'none'}
      </div>
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
            isTextEditable: true,
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
          isTextEditable: true,
        },
        {
          path: 'fast.json',
          name: 'fast.json',
          kind: 'file',
          size: 11,
          ext: '.json',
          isTextEditable: true,
        },
        {
          path: 'docs',
          name: 'docs',
          kind: 'directory',
          size: 0,
          ext: '',
          isTextEditable: false,
        },
        {
          path: 'big.txt',
          name: 'big.txt',
          kind: 'file',
          size: 300_000,
          ext: '.txt',
          isTextEditable: true,
        },
        {
          path: 'logo.svg',
          name: 'logo.svg',
          kind: 'file',
          size: 512,
          ext: '.svg',
          isTextEditable: false,
        },
      ],
    });
  }),
  http.get('/api/v2/workspace/file', async ({ request }) => {
    const url = new URL(request.url);
    const path = url.searchParams.get('path') || '';

    if (path === 'docs/guide.md') {
      return HttpResponse.json({
        path: 'docs/guide.md',
        name: 'guide.md',
        size: 12,
        encoding: 'utf-8',
        content: '# guide\n',
        isTextEditable: true,
        tooLarge: false,
      });
    }

    if (path === 'slow.json') {
      await new Promise(resolve => setTimeout(resolve, 80));
      return HttpResponse.json({
        path: 'slow.json',
        name: 'slow.json',
        size: 11,
        encoding: 'utf-8',
        content: '{"slow":1}\n',
        isTextEditable: true,
        tooLarge: false,
      });
    }

    if (path === 'fast.json') {
      return HttpResponse.json({
        path: 'fast.json',
        name: 'fast.json',
        size: 11,
        encoding: 'utf-8',
        content: '{"fast":1}\n',
        isTextEditable: true,
        tooLarge: false,
      });
    }

    if (path === 'big.txt') {
      return HttpResponse.json({
        path: 'big.txt',
        name: 'big.txt',
        size: 300_000,
        encoding: 'utf-8',
        content: '',
        isTextEditable: true,
        tooLarge: true,
      });
    }

    if (path === 'logo.svg') {
      return new HttpResponse('not_text_editable', { status: 415 });
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

    expect(screen.getByLabelText('draft')).toHaveValue('{"fast":1}\n');
    expect(screen.getByLabelText('active file')).toHaveTextContent('fast.json');
  });

  it('opens file:// links to files without first probing the file path as a directory listing', async () => {
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

  it('keeps too-large files as active detail state instead of dropping them back to folder-only state', async () => {
    render(<WorkspaceFileExplorerHarness />);

    fireEvent.click(screen.getByRole('button', { name: 'Open large' }));

    await waitFor(() => {
      expect(screen.getByLabelText('active file')).toHaveTextContent('big.txt');
    });

    expect(screen.getByLabelText('path')).toHaveTextContent('.');
    expect(screen.getByLabelText('notice')).toHaveTextContent('none');
    expect(screen.getByLabelText('draft')).toHaveValue('');
  });

  it('keeps read-only files as active detail state instead of dropping them back to folder-only state', async () => {
    render(<WorkspaceFileExplorerHarness />);

    fireEvent.click(screen.getByRole('button', { name: 'Open read only' }));

    await waitFor(() => {
      expect(screen.getByLabelText('active file')).toHaveTextContent('logo.svg');
    });

    expect(screen.getByLabelText('path')).toHaveTextContent('.');
    expect(screen.getByLabelText('notice')).toHaveTextContent('none');
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
    expect(screen.getByLabelText('active file')).toHaveTextContent('fast.json');
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
    expect(screen.getByLabelText('draft')).toHaveValue('changed\n');
  });

  it('blocks opening another file when the user refuses to discard unsaved changes', async () => {
    const confirmSpy = vi.fn(() => false);
    vi.stubGlobal('confirm', confirmSpy);

    render(<WorkspaceFileExplorerHarness />);

    fireEvent.click(screen.getByRole('button', { name: 'Open fast' }));

    await waitFor(() => {
      expect(screen.getByLabelText('active file')).toHaveTextContent('fast.json');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Dirty draft' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open slow' }));

    expect(confirmSpy).toHaveBeenCalledWith('You have unsaved file changes. Discard them?');
    expect(screen.getByLabelText('active file')).toHaveTextContent('fast.json');
    expect(screen.getByLabelText('draft')).toHaveValue('changed\n');
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
    expect(screen.getByLabelText('draft')).toHaveValue('# guide\n');
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
