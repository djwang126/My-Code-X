import type { ClientWorkspaceListItemView } from '@my-code-x/contracts-new';
import type { FormEvent } from 'react';
import type { WorkspaceAddSubmitInput, WorkspaceEditCwdSubmitInput, WorkspaceRenameSubmitInput } from '../model/workspace-panel-inputs.js';
import type { WorkspacePanelModalState, WorkspacePanelState } from '../model/workspace-panel-reducer.js';

export interface WorkspacePanelProps {
  readonly state: WorkspacePanelState;
  onAddClick(): void;
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

interface WorkspaceListItemProps {
  readonly item: ClientWorkspaceListItemView;
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
