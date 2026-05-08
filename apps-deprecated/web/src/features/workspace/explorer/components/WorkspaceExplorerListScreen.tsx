import { IconFile, IconFolder } from '../../../../shared/chat-ui/ChatIcons';
import type { WorkspaceFileEntry } from '..';
import { buildBreadcrumbs, formatEntryMeta, getParentPath } from './workspace-file-explorer-view';

interface WorkspaceExplorerListScreenProps {
  currentPath: string;
  entries: WorkspaceFileEntry[];
  loading: boolean;
  onNavigate?: (path: string) => void;
  onOpenFile?: (path: string) => void;
}

export function WorkspaceExplorerListScreen({
  currentPath,
  entries,
  loading,
  onNavigate,
  onOpenFile,
}: WorkspaceExplorerListScreenProps) {
  const breadcrumbs = buildBreadcrumbs(currentPath);

  return (
    <div className="workspace-explorer-screen">
      <div className="workspace-explorer-pathbar">
        {currentPath ? (
          <button className="workspace-action-btn" onClick={() => onNavigate?.(getParentPath(currentPath))} type="button">
            ↑ Up
          </button>
        ) : null}
        <nav aria-label="File path" className="workspace-explorer-breadcrumbs">
          <button className="workspace-explorer-breadcrumb root" onClick={() => onNavigate?.('')} type="button">
            root
          </button>
          {breadcrumbs.map(crumb => (
            <button key={crumb.path} className="workspace-explorer-breadcrumb" onClick={() => onNavigate?.(crumb.path)} type="button">
              {crumb.label}
            </button>
          ))}
        </nav>
      </div>

      {loading ? <p className="workspace-explorer-state">Loading folder…</p> : null}
      {!loading && entries.length === 0 ? <p className="workspace-explorer-state">This folder is empty.</p> : null}
      {!loading && entries.length ? (
        <div className="workspace-explorer-entry-list">
          {entries.map(entry => {
            const meta = formatEntryMeta(entry);

            return (
              <button
                aria-label={entry.name}
                key={entry.path}
                className={`workspace-explorer-entry ${entry.kind === 'directory' ? 'directory' : 'file'}`}
                onClick={() => (entry.kind === 'directory' ? onNavigate?.(entry.path) : onOpenFile?.(entry.path))}
                type="button"
              >
                <span className="workspace-explorer-entry-leading">
                  {entry.kind === 'directory' ? <IconFolder /> : <IconFile />}
                  <span className="workspace-explorer-entry-name">{entry.name}</span>
                </span>
                <span className="workspace-explorer-entry-trailing">
                  {meta ? <span className="workspace-explorer-entry-meta">{meta}</span> : null}
                  <span aria-hidden="true" className="workspace-explorer-entry-chevron">›</span>
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
