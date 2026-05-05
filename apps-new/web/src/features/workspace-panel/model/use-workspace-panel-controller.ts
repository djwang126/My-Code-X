import { useReducer } from 'react';
import type {
  ClientActionResult,
  ClientSnapshot,
  ClientWorkspaceErrorView,
  ClientWorkspaceListItemView,
  ClientWorkspacePanelView,
} from '@my-code-x/contracts-new';
import type { AppScope } from '../../../app/app-scope.js';
import { WorkspacePanelApiError, type WorkspacePanelApiBoundary } from '../api/workspace-panel-api.js';
import {
  createInitialWorkspacePanelState,
  reduceWorkspacePanelState,
  type WorkspacePanelState,
} from './workspace-panel-reducer.js';
import type {
  WorkspaceAddSubmitInput,
  WorkspaceEditCwdSubmitInput,
  WorkspaceRenameSubmitInput,
  WorkspaceResumeThreadInput,
} from './workspace-panel-inputs.js';

export interface UseWorkspacePanelControllerInput {
  readonly scope: AppScope;
  readonly api: WorkspacePanelApiBoundary;
  onResumeAccepted?(snapshot: ClientSnapshot): void;
}

export interface WorkspacePanelController {
  readonly state: WorkspacePanelState;
  open(): void;
  close(): void;
  openAddModal(): void;
  showWorkspaceList(): void;
  openActiveThreads(item: ClientWorkspaceListItemView): void;
  loadMoreActiveThreads(): void;
  resumeThread(item: WorkspaceResumeThreadInput): void;
  openRenameModal(item: ClientWorkspaceListItemView): void;
  openEditCwdModal(item: ClientWorkspaceListItemView): void;
  submitAdd(input: WorkspaceAddSubmitInput): void;
  submitRename(input: WorkspaceRenameSubmitInput): void;
  submitEditCwd(input: WorkspaceEditCwdSubmitInput): void;
  remove(item: ClientWorkspaceListItemView): void;
}

export interface WorkspacePanelControllerCommands {
  open(): Promise<void>;
  close(): void;
  openAddModal(): void;
  showWorkspaceList(): void;
  openActiveThreads(item: ClientWorkspaceListItemView): Promise<void>;
  loadMoreActiveThreads(): Promise<void>;
  resumeThread(item: WorkspaceResumeThreadInput): Promise<void>;
  openRenameModal(item: ClientWorkspaceListItemView): void;
  openEditCwdModal(item: ClientWorkspaceListItemView): void;
  submitAdd(input: WorkspaceAddSubmitInput): Promise<void>;
  submitRename(input: WorkspaceRenameSubmitInput): Promise<void>;
  submitEditCwd(input: WorkspaceEditCwdSubmitInput): Promise<void>;
  remove(item: ClientWorkspaceListItemView): Promise<void>;
}

export interface CreateWorkspacePanelControllerCommandsInput {
  readonly scope: AppScope;
  readonly api: WorkspacePanelApiBoundary;
  readState(): WorkspacePanelState;
  dispatch(action: Parameters<typeof reduceWorkspacePanelState>[1]): void;
  onResumeAccepted?(snapshot: ClientSnapshot): void;
}

export function useWorkspacePanelController(input: UseWorkspacePanelControllerInput): WorkspacePanelController {
  const [state, dispatch] = useReducer(reduceWorkspacePanelState, undefined, createInitialWorkspacePanelState);

  const commands = createWorkspacePanelControllerCommands({
    scope: input.scope,
    api: input.api,
    readState() {
      return state;
    },
    dispatch,
    onResumeAccepted: input.onResumeAccepted,
  });

  return {
    state,
    ...commands,
  };
}

export function createWorkspacePanelControllerCommands(input: CreateWorkspacePanelControllerCommandsInput): WorkspacePanelControllerCommands {
  function dispatchWorkspaceMutationSuccess(panel: ClientWorkspacePanelView): void {
    if (panel.status !== 'ready') {
      input.dispatch({ kind: 'submit-failed', message: 'Workspace 操作没有返回列表' });
      return;
    }

    input.dispatch({ kind: 'submit-succeeded', panel });
  }

  return {
    async open(): Promise<void> {
      input.dispatch({ kind: 'open-started' });
      try {
        const panel = await input.api.open({ scope: input.scope });
        if (panel.status !== 'ready') {
          input.dispatch({ kind: 'open-failed', message: 'Workspace 列表加载失败' });
          return;
        }

        input.dispatch({ kind: 'open-succeeded', panel });
      } catch (error) {
        input.dispatch({ kind: 'open-failed', message: readErrorMessage(error) });
      }
    },

    close(): void {
      input.dispatch({ kind: 'close-requested' });
    },

    openAddModal(): void {
      input.dispatch({ kind: 'open-add-modal' });
    },

    showWorkspaceList(): void {
      input.dispatch({ kind: 'show-workspace-list' });
    },

    async openActiveThreads(item: ClientWorkspaceListItemView): Promise<void> {
      input.dispatch({ kind: 'active-open-started', item });
      try {
        const panel = await input.api.openActiveThreads({
          scope: input.scope,
          workspaceId: item.workspaceId,
        });
        if (panel.status === 'ready') {
          input.dispatch({ kind: 'active-open-succeeded', panel });
          return;
        }

        input.dispatch({
          kind: 'active-open-failed',
          error: createWorkspaceError({
            code: 'thread-list-failed',
            message: 'Active threads 加载失败',
          }),
        });
      } catch (error) {
        input.dispatch({
          kind: 'active-open-failed',
          error: readWorkspaceError({
            error,
            fallbackCode: 'thread-list-failed',
            fallbackMessage: 'Active threads 加载失败',
          }),
        });
      }
    },

    async loadMoreActiveThreads(): Promise<void> {
      const state = input.readState();
      if (state.status !== 'ready' || state.panel.page.kind !== 'active-threads' || state.panel.page.resource.status !== 'ready') {
        return;
      }

      const cursor = state.panel.page.resource.nextCursor;
      if (cursor === null) {
        return;
      }

      input.dispatch({ kind: 'active-load-more-started' });
      try {
        const panel = await input.api.loadMoreActiveThreads({
          scope: createWorkspacePanelActionScope({ appScope: input.scope, state }),
          workspaceId: state.panel.page.workspaceId,
          cursor,
        });
        if (panel.status === 'ready') {
          input.dispatch({ kind: 'active-load-more-succeeded', panel });
          return;
        }

        input.dispatch({
          kind: 'active-load-more-failed',
          error: createWorkspaceError({
            code: 'thread-list-failed',
            message: '加载更多失败',
          }),
        });
      } catch (error) {
        input.dispatch({
          kind: 'active-load-more-failed',
          error: readWorkspaceError({
            error,
            fallbackCode: 'thread-list-failed',
            fallbackMessage: '加载更多失败',
          }),
        });
      }
    },

    async resumeThread(item: WorkspaceResumeThreadInput): Promise<void> {
      const state = input.readState();
      if (item.current || state.status !== 'ready' || state.panel.page.kind !== 'active-threads') {
        return;
      }

      input.dispatch({ kind: 'active-resume-started', threadId: item.threadId });
      try {
        const result = await input.api.resumeThread({
          scope: createWorkspacePanelActionScope({ appScope: input.scope, state }),
          workspaceId: state.panel.page.workspaceId,
          threadId: item.threadId,
        });
        const decision = readResumeActionDecision(result);
        if (decision.status === 'ready') {
          input.onResumeAccepted?.(decision.snapshot);
          input.dispatch({ kind: 'close-requested' });
          return;
        }

        input.dispatch({ kind: 'active-resume-failed', threadId: item.threadId, message: decision.message });
      } catch (error) {
        input.dispatch({ kind: 'active-resume-failed', threadId: item.threadId, message: readErrorMessage(error) });
      }
    },

    openRenameModal(item: ClientWorkspaceListItemView): void {
      input.dispatch({ kind: 'open-rename-modal', item });
    },

    openEditCwdModal(item: ClientWorkspaceListItemView): void {
      input.dispatch({ kind: 'open-edit-cwd-modal', item });
    },

    async submitAdd(submitInput: WorkspaceAddSubmitInput): Promise<void> {
      const state = input.readState();
      const actionScope = createWorkspacePanelActionScope({ appScope: input.scope, state });
      input.dispatch({ kind: 'submit-started' });
      try {
        const panel = await input.api.add({ scope: actionScope, cwd: submitInput.cwd, name: submitInput.name });
        dispatchWorkspaceMutationSuccess(panel);
      } catch (error) {
        input.dispatch({ kind: 'submit-failed', message: readErrorMessage(error) });
      }
    },

    async submitRename(submitInput: WorkspaceRenameSubmitInput): Promise<void> {
      const state = input.readState();
      const actionScope = createWorkspacePanelActionScope({ appScope: input.scope, state });
      input.dispatch({ kind: 'submit-started' });
      try {
        const panel = await input.api.rename({
          scope: actionScope,
          recordRef: submitInput.item.recordRef,
          currentWorkspaceId: submitInput.item.workspaceId,
          name: submitInput.name,
        });
        dispatchWorkspaceMutationSuccess(panel);
      } catch (error) {
        input.dispatch({ kind: 'submit-failed', message: readErrorMessage(error) });
      }
    },

    async submitEditCwd(submitInput: WorkspaceEditCwdSubmitInput): Promise<void> {
      const state = input.readState();
      const actionScope = createWorkspacePanelActionScope({ appScope: input.scope, state });
      input.dispatch({ kind: 'submit-started' });
      try {
        const panel = await input.api.editCwd({
          scope: actionScope,
          recordRef: submitInput.item.recordRef,
          currentWorkspaceId: submitInput.item.workspaceId,
          cwd: submitInput.cwd,
        });
        dispatchWorkspaceMutationSuccess(panel);
      } catch (error) {
        input.dispatch({ kind: 'submit-failed', message: readErrorMessage(error) });
      }
    },

    async remove(item: ClientWorkspaceListItemView): Promise<void> {
      const state = input.readState();
      const actionScope = createWorkspacePanelActionScope({ appScope: input.scope, state });
      try {
        const panel = await input.api.remove({
          scope: actionScope,
          recordRef: item.recordRef,
          currentWorkspaceId: item.workspaceId,
        });
        dispatchWorkspaceMutationSuccess(panel);
      } catch (error) {
        input.dispatch({ kind: 'list-action-failed', message: readErrorMessage(error) });
      }
    },
  };
}

interface CreateWorkspacePanelActionScopeInput {
  readonly appScope: AppScope;
  readonly state: WorkspacePanelState;
}

function createWorkspacePanelActionScope(input: CreateWorkspacePanelActionScopeInput): AppScope {
  if (input.state.status !== 'ready') {
    return input.appScope;
  }

  return {
    ...input.appScope,
    workspaceId: input.state.panel.list.selectedWorkspaceId,
  };
}

function readErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Workspace 操作失败';
}

interface ReadWorkspaceErrorInput {
  readonly error: unknown;
  readonly fallbackCode: string;
  readonly fallbackMessage: string;
}

function readWorkspaceError(input: ReadWorkspaceErrorInput): ClientWorkspaceErrorView {
  if (input.error instanceof WorkspacePanelApiError) {
    return createWorkspaceError({
      code: input.error.code,
      message: input.error.message,
    });
  }

  if (input.error instanceof Error) {
    return createWorkspaceError({
      code: input.fallbackCode,
      message: input.error.message,
    });
  }

  return createWorkspaceError({
    code: input.fallbackCode,
    message: input.fallbackMessage,
  });
}

function createWorkspaceError(input: ClientWorkspaceErrorView): ClientWorkspaceErrorView {
  return {
    code: input.code,
    message: input.message,
  };
}

export type ResumeActionDecision =
  | { readonly status: 'ready'; readonly snapshot: ClientSnapshot }
  | { readonly status: 'failed'; readonly message: string };

export function readResumeActionDecision(result: ClientActionResult): ResumeActionDecision {
  if (result.status === 'rejected') {
    return {
      status: 'failed',
      message: result.error.message,
    };
  }

  if (result.snapshot === null) {
    return {
      status: 'failed',
      message: 'Thread 恢复没有返回会话快照',
    };
  }

  return {
    status: 'ready',
    snapshot: result.snapshot,
  };
}
