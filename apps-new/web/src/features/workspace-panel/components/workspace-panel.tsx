import type {
  ClientWorkspaceActiveThreadResourceView,
  ClientWorkspaceListItemView,
  ClientWorkspaceThreadItemView,
} from '@my-code-x/contracts-new';
import type { FormEvent } from 'react';
import type {
  WorkspaceAddSubmitInput,
  WorkspaceEditCwdSubmitInput,
  WorkspaceRenameSubmitInput,
  WorkspaceResumeThreadInput,
} from '../model/workspace-panel-inputs.js';
import type { WorkspacePanelModalState, WorkspacePanelState } from '../model/workspace-panel-reducer.js';

export interface WorkspacePanelProps {
  readonly state: WorkspacePanelState;
  onAddClick(): void;
  onOpenActiveThreadsClick(item: ClientWorkspaceListItemView): void;
  onBackToWorkspaceList(): void;
  onLoadMoreActiveThreads(): void;
  onResumeThread(item: WorkspaceResumeThreadInput): void;
  onRenameClick(item: ClientWorkspaceListItemView): void;
  onEditCwdClick(item: ClientWorkspaceListItemView): void;
  onRemoveClick(item: ClientWorkspaceListItemView): void;
  onCloseRequest(): void;
  onAddSubmit(input: WorkspaceAddSubmitInput): void;
  onRenameSubmit(input: WorkspaceRenameSubmitInput): void;
  onEditCwdSubmit(input: WorkspaceEditCwdSubmitInput): void;
}

export function WorkspacePanel(input: WorkspacePanelProps) {
  if (input.state.status === 'loading') {
    return (
      <aside aria-label="Workspace panel">
        <button type="button" onClick={input.onCloseRequest}>关闭</button>
        加载 Workspace...
      </aside>
    );
  }

  if (input.state.status === 'failed') {
    return (
      <aside aria-label="Workspace panel">
        <button type="button" onClick={input.onCloseRequest}>关闭</button>
        {input.state.message}
      </aside>
    );
  }

  if (input.state.status === 'ready') {
    if (input.state.panel.page.kind === 'active-threads') {
      return (
        <aside aria-label="Workspace panel">
          <button type="button" onClick={input.onCloseRequest}>关闭</button>
          <WorkspaceActiveThreadsPage
            cwd={input.state.panel.page.cwd}
            name={input.state.panel.page.name}
            resource={input.state.panel.page.resource}
            onBackToWorkspaceList={input.onBackToWorkspaceList}
            onLoadMoreActiveThreads={input.onLoadMoreActiveThreads}
            onResumeThread={input.onResumeThread}
          />
          <WorkspaceModal
            modal={input.state.modal}
            onAddSubmit={input.onAddSubmit}
            onCloseRequest={input.onCloseRequest}
            onEditCwdSubmit={input.onEditCwdSubmit}
            onRenameSubmit={input.onRenameSubmit}
          />
        </aside>
      );
    }

    return (
      <aside aria-label="Workspace panel">
        <button type="button" onClick={input.onCloseRequest}>关闭</button>
        <button type="button" onClick={input.onAddClick}>添加 Workspace</button>
        {input.state.panel.list.persistence.status === 'memory' ? <p>{input.state.panel.list.persistence.warning}</p> : null}
        {input.state.panel.list.persistence.status === 'memory' ? <p>{input.state.panel.list.persistence.error.message}</p> : null}
        {input.state.listError ? <p>{input.state.listError}</p> : null}
        <ul>
          {input.state.panel.list.items.map(item => (
            <WorkspaceListItem
              key={item.recordRef}
              item={item}
              onEditCwdClick={input.onEditCwdClick}
              onOpenActiveThreadsClick={input.onOpenActiveThreadsClick}
              onRemoveClick={input.onRemoveClick}
              onRenameClick={input.onRenameClick}
            />
          ))}
        </ul>
        <WorkspaceModal
          modal={input.state.modal}
          onAddSubmit={input.onAddSubmit}
          onCloseRequest={input.onCloseRequest}
          onEditCwdSubmit={input.onEditCwdSubmit}
          onRenameSubmit={input.onRenameSubmit}
        />
      </aside>
    );
  }

  return null;
}

interface WorkspaceActiveThreadsPageProps {
  readonly name: string;
  readonly cwd: string;
  readonly resource: ClientWorkspaceActiveThreadResourceView;
  onBackToWorkspaceList(): void;
  onLoadMoreActiveThreads(): void;
  onResumeThread(item: WorkspaceResumeThreadInput): void;
}

function WorkspaceActiveThreadsPage(input: WorkspaceActiveThreadsPageProps) {
  return (
    <section aria-label="Active threads">
      <header>
        <h2 aria-label="Active workspace name">{input.name}</h2>
        <p aria-label="Active workspace cwd">{input.cwd}</p>
        <button type="button" onClick={input.onBackToWorkspaceList}>切换 Workspace</button>
      </header>
      <WorkspaceActiveThreadsResource
        resource={input.resource}
        onLoadMoreActiveThreads={input.onLoadMoreActiveThreads}
        onResumeThread={input.onResumeThread}
      />
    </section>
  );
}

interface WorkspaceActiveThreadsResourceProps {
  readonly resource: WorkspaceActiveThreadsPageProps['resource'];
  onLoadMoreActiveThreads(): void;
  onResumeThread(item: WorkspaceResumeThreadInput): void;
}

function WorkspaceActiveThreadsResource(input: WorkspaceActiveThreadsResourceProps) {
  if (input.resource.status === 'loading') {
    return <p>加载对话...</p>;
  }

  if (input.resource.status === 'failed') {
    return <p>{input.resource.error.message}</p>;
  }

  if (input.resource.items.length === 0) {
    return <p>暂无对话</p>;
  }

  return (
    <>
      <ul>
        {input.resource.items.map(item => (
          <WorkspaceThreadCard key={item.threadId} item={item} onResumeThread={input.onResumeThread} />
        ))}
      </ul>
      {input.resource.loadMore.status === 'failed' ? <p aria-label="Load more error">{input.resource.loadMore.error.message}</p> : null}
      {input.resource.nextCursor !== null ? (
        <button
          type="button"
          disabled={input.resource.loadMore.status === 'loading'}
          onClick={input.onLoadMoreActiveThreads}
        >
          加载更多
        </button>
      ) : null}
    </>
  );
}

interface WorkspaceThreadCardProps {
  readonly item: ClientWorkspaceThreadItemView;
  onResumeThread(item: WorkspaceResumeThreadInput): void;
}

function WorkspaceThreadCard(input: WorkspaceThreadCardProps) {
  return (
    <li>
      <button
        type="button"
        aria-label={`Thread card ${input.item.threadId}`}
        aria-current={input.item.current ? 'true' : undefined}
        disabled={input.item.current || input.item.operation === 'resuming'}
        onClick={() => {
          if (!input.item.current) {
            input.onResumeThread({ threadId: input.item.threadId, current: input.item.current });
          }
        }}
      >
        <span aria-label={`Thread name ${input.item.threadId}`}>{input.item.name}</span>
      </button>
      <span aria-label={`Thread preview ${input.item.threadId}`}>{input.item.preview}</span>
      <span aria-label={`Thread updated time ${input.item.threadId}`}>{formatWorkspaceThreadTime(input.item.updatedAtIso)}</span>
      {input.item.cardError ? <p aria-label={`Thread error ${input.item.threadId}`}>{input.item.cardError.message}</p> : null}
    </li>
  );
}

interface WorkspaceListItemProps {
  readonly item: ClientWorkspaceListItemView;
  onOpenActiveThreadsClick(item: ClientWorkspaceListItemView): void;
  onRenameClick(item: ClientWorkspaceListItemView): void;
  onEditCwdClick(item: ClientWorkspaceListItemView): void;
  onRemoveClick(item: ClientWorkspaceListItemView): void;
}

function WorkspaceListItem(input: WorkspaceListItemProps) {
  return (
    <li>
      <div aria-label="Workspace name">{input.item.name}</div>
      <div aria-label="Workspace cwd">{input.item.cwd}</div>
      {input.item.availability.status === 'unavailable' ? <div>不可用：{input.item.availability.reason}</div> : null}
      {input.item.availability.status === 'available' ? (
        <button type="button" onClick={() => input.onOpenActiveThreadsClick(input.item)}>进入</button>
      ) : null}
      <div>
        {input.item.operations.map(operation => (
          <button key={operation} type="button" onClick={() => handleOperationClick({ operation, input })}>
            {readOperationLabel(operation)}
          </button>
        ))}
      </div>
    </li>
  );
}

interface HandleOperationClickInput {
  readonly operation: ClientWorkspaceListItemView['operations'][number];
  readonly input: WorkspaceListItemProps;
}

function handleOperationClick(input: HandleOperationClickInput): void {
  switch (input.operation) {
    case 'rename':
      input.input.onRenameClick(input.input.item);
      return;
    case 'edit-cwd':
      input.input.onEditCwdClick(input.input.item);
      return;
    case 'remove':
      input.input.onRemoveClick(input.input.item);
      return;
  }
}

interface WorkspaceModalProps {
  readonly modal: WorkspacePanelModalState;
  onCloseRequest(): void;
  onAddSubmit(input: WorkspaceAddSubmitInput): void;
  onRenameSubmit(input: WorkspaceRenameSubmitInput): void;
  onEditCwdSubmit(input: WorkspaceEditCwdSubmitInput): void;
}

function WorkspaceModal(input: WorkspaceModalProps) {
  if (input.modal.status === 'none') {
    return null;
  }

  if (input.modal.status === 'add') {
    const submitting = input.modal.submit.status === 'submitting';
    const error = input.modal.submit.status === 'idle' ? input.modal.submit.error : null;
    return (
      <form aria-label="添加 Workspace 表单" onSubmit={event => submitAddForm({ event, input })}>
        <label>
          cwd
          <input name="cwd" disabled={submitting} />
        </label>
        <label>
          name
          <input name="name" disabled={submitting} />
        </label>
        {error ? <p>{error}</p> : null}
        <button type="button" disabled={submitting} onClick={input.onCloseRequest}>取消</button>
        <button type="submit" disabled={submitting}>保存</button>
      </form>
    );
  }

  if (input.modal.status === 'rename') {
    const modal = input.modal;
    const submitting = modal.submit.status === 'submitting';
    const error = modal.submit.status === 'idle' ? modal.submit.error : null;
    return (
      <form aria-label="重命名 Workspace 表单" onSubmit={event => submitRenameForm({ event, input, item: modal.item })}>
        <label>
          name
          <input name="name" defaultValue={modal.item.name} disabled={submitting} />
        </label>
        {error ? <p>{error}</p> : null}
        <button type="button" disabled={submitting} onClick={input.onCloseRequest}>取消</button>
        <button type="submit" disabled={submitting}>保存</button>
      </form>
    );
  }

  const modal = input.modal;
  const submitting = modal.submit.status === 'submitting';
  const error = modal.submit.status === 'idle' ? modal.submit.error : null;
  return (
    <form aria-label="编辑 Workspace cwd 表单" onSubmit={event => submitEditCwdForm({ event, input, item: modal.item })}>
      <label>
        cwd
        <input name="cwd" defaultValue={modal.item.cwd} disabled={submitting} />
      </label>
      {error ? <p>{error}</p> : null}
      <button type="button" disabled={submitting} onClick={input.onCloseRequest}>取消</button>
      <button type="submit" disabled={submitting}>保存</button>
    </form>
  );
}

interface SubmitFormInput {
  readonly event: FormEvent<WorkspaceFormTarget>;
  readonly input: WorkspaceModalProps;
}

interface WorkspaceFormTarget {
  readonly elements: {
    namedItem(name: string): unknown;
  };
}

function submitAddForm(input: SubmitFormInput): void {
  input.event.preventDefault();
  input.input.onAddSubmit({
    cwd: readFormString({ form: input.event.currentTarget, name: 'cwd' }),
    name: readFormString({ form: input.event.currentTarget, name: 'name' }),
  });
}

interface SubmitItemFormInput extends SubmitFormInput {
  readonly item: ClientWorkspaceListItemView;
}

function submitRenameForm(input: SubmitItemFormInput): void {
  input.event.preventDefault();
  input.input.onRenameSubmit({
    item: input.item,
    name: readFormString({ form: input.event.currentTarget, name: 'name' }),
  });
}

function submitEditCwdForm(input: SubmitItemFormInput): void {
  input.event.preventDefault();
  input.input.onEditCwdSubmit({
    item: input.item,
    cwd: readFormString({ form: input.event.currentTarget, name: 'cwd' }),
  });
}

function readFormString(input: { readonly form: WorkspaceFormTarget; readonly name: string }): string {
  const field = input.form.elements.namedItem(input.name);
  if (!hasStringValue(field)) {
    return '';
  }

  return field.value;
}

function hasStringValue(value: unknown): value is { readonly value: string } {
  return typeof value === 'object'
    && value !== null
    && 'value' in value
    && typeof value.value === 'string';
}

function formatWorkspaceThreadTime(updatedAtIso: string | null): string {
  if (updatedAtIso === null) {
    return '';
  }

  const date = new Date(updatedAtIso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function readOperationLabel(operation: ClientWorkspaceListItemView['operations'][number]): string {
  switch (operation) {
    case 'rename':
      return '重命名';
    case 'edit-cwd':
      return '编辑 cwd';
    case 'remove':
      return '移除';
  }
}
