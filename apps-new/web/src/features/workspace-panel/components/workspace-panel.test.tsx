import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import type { ClientWorkspaceActiveThreadResourceView, ClientWorkspaceListItemView } from '@my-code-x/contracts-new';

import { WorkspacePanel, type WorkspacePanelProps } from './workspace-panel.js';
import type { ReadyWorkspacePanelView } from '../model/workspace-panel-reducer.js';

describe('WorkspacePanel rendering and interactions', () => {
  test('renders loading state', () => {
    const root = renderWorkspacePanel(createPanelProps({ state: { status: 'loading' } }));

    assert.equal(textContent(root).includes('加载 Workspace'), true);
  });

  test('renders workspace name cwd and memory warning from a ready panel', () => {
    const root = renderWorkspacePanel(createPanelProps({ state: {
      status: 'ready',
      panel: createReadyPanel({
        persistence: 'memory',
        items: [
          createAvailableItem({
            workspaceId: 'D:\\workspaces\\demo',
            recordRef: 'workspace-record-1',
            name: 'Demo',
            cwd: 'D:\\workspaces\\demo',
            selected: true,
            operations: ['rename', 'edit-cwd'],
          }),
        ],
      }),
      modal: {
        status: 'none',
      },
      listError: null,
    } }));
    const text = textContent(root);

    assert.equal(text.includes('当前 Workspace 变更不会持久保存'), true);
    assert.equal(text.includes('Workspace 配置不可读'), true);
    assert.equal(text.includes('Demo'), true);
    assert.equal(text.includes('D:\\workspaces\\demo'), true);
    assert.equal(text.includes('进入'), true);
    assert.equal(text.includes('重命名'), true);
    assert.equal(text.includes('编辑 cwd'), true);
    assert.equal(text.includes('移除'), false);
  });

  test('renders empty workspace name as blank display instead of basename fallback', () => {
    const root = renderWorkspacePanel(createPanelProps({ state: {
      status: 'ready',
      panel: createReadyPanel({
        items: [
          createAvailableItem({
            workspaceId: 'D:\\workspaces\\demo',
            recordRef: 'workspace-record-1',
            name: '',
            cwd: 'D:\\workspaces\\demo',
          }),
        ],
      }),
      modal: {
        status: 'none',
      },
      listError: null,
    } }));

    assert.equal(readTextByLabel(root, 'Workspace name'), '');
    assert.equal(readTextByLabel(root, 'Workspace cwd'), 'D:\\workspaces\\demo');
  });

  test('renders unavailable marker and remove-only operation', () => {
    const root = renderWorkspacePanel(createPanelProps({ state: {
      status: 'ready',
      panel: createReadyPanel({
        items: [
          createUnavailableItem(),
        ],
      }),
      modal: {
        status: 'none',
      },
      listError: null,
    } }));
    const text = textContent(root);

    assert.equal(text.includes('不可用'), true);
    assert.equal(text.includes('路径不存在'), true);
    assert.equal(text.includes('移除'), true);
    assert.equal(text.includes('进入'), false);
    assert.equal(text.includes('重命名'), false);
    assert.equal(text.includes('编辑 cwd'), false);
  });

  test('renders add workspace entry in ready panel', () => {
    const root = renderWorkspacePanel(createPanelProps({ state: {
      status: 'ready',
      panel: createReadyPanel({ items: [] }),
      modal: {
        status: 'none',
      },
      listError: null,
    } }));

    assert.equal(textContent(root).includes('添加 Workspace'), true);
  });

  test('renders failed panel error', () => {
    const root = renderWorkspacePanel(createPanelProps({ state: {
      status: 'failed',
      message: 'Workspace 列表加载失败',
    } }));

    assert.equal(textContent(root).includes('Workspace 列表加载失败'), true);
  });

  test('clicking add workspace entry requests the add modal', () => {
    const calls = createCallRecorder();
    const root = renderWorkspacePanel(createPanelProps({
      state: createReadyState(),
      onAddClick: calls.recordAddClick,
    }));

    clickButton(root, '添加 Workspace');

    assert.deepEqual(calls.addClicks, ['add-clicked']);
  });

  test('submitting add form sends raw cwd and raw name', () => {
    const calls = createCallRecorder();
    const root = renderWorkspacePanel(createPanelProps({
      state: {
        ...createReadyState(),
        modal: {
          status: 'add',
          submit: {
            status: 'idle',
            error: null,
          },
        },
      },
      onAddSubmit: calls.recordAddSubmit,
    }));

    submitForm(root, '添加 Workspace 表单', {
      cwd: '  D:\\workspaces\\demo  ',
      name: '  Demo  ',
    });

    assert.deepEqual(calls.addSubmits, [
      {
        cwd: '  D:\\workspaces\\demo  ',
        name: '  Demo  ',
      },
    ]);
  });

  test('submitting rename form allows an empty raw name', () => {
    const item = createAvailableItem({ workspaceId: 'D:\\workspaces\\demo', recordRef: 'workspace-record-1', name: 'Demo', cwd: 'D:\\workspaces\\demo' });
    const calls = createCallRecorder();
    const root = renderWorkspacePanel(createPanelProps({
      state: {
        ...createReadyState(),
        modal: {
          status: 'rename',
          item,
          submit: {
            status: 'idle',
            error: null,
          },
        },
      },
      onRenameSubmit: calls.recordRenameSubmit,
    }));

    submitForm(root, '重命名 Workspace 表单', {
      name: '',
    });

    assert.deepEqual(calls.renameSubmits, [
      {
        item,
        name: '',
      },
    ]);
  });

  test('submitting edit cwd form sends raw cwd', () => {
    const item = createAvailableItem({ workspaceId: 'D:\\workspaces\\demo', recordRef: 'workspace-record-1', name: 'Demo', cwd: 'D:\\workspaces\\demo' });
    const calls = createCallRecorder();
    const root = renderWorkspacePanel(createPanelProps({
      state: {
        ...createReadyState(),
        modal: {
          status: 'edit-cwd',
          item,
          submit: {
            status: 'idle',
            error: null,
          },
        },
      },
      onEditCwdSubmit: calls.recordEditCwdSubmit,
    }));

    submitForm(root, '编辑 Workspace cwd 表单', {
      cwd: '  D:\\workspaces\\renamed  ',
    });

    assert.deepEqual(calls.editCwdSubmits, [
      {
        item,
        cwd: '  D:\\workspaces\\renamed  ',
      },
    ]);
  });

  test('clicking remove triggers remove without confirmation', () => {
    const item = createAvailableItem({ workspaceId: 'D:\\workspaces\\demo', recordRef: 'workspace-record-1', name: 'Demo', cwd: 'D:\\workspaces\\demo' });
    const calls = createCallRecorder();
    const root = renderWorkspacePanel(createPanelProps({
      state: createReadyState({ items: [item] }),
      onRemoveClick: calls.recordRemoveClick,
    }));

    clickButton(root, '移除');

    assert.deepEqual(calls.removeClicks, [item]);
    assert.deepEqual(readFormLabels(root), []);
  });

  test('clicking an available workspace requests opening its active threads', () => {
    const item = createAvailableItem({ workspaceId: 'D:\\workspaces\\demo', recordRef: 'workspace-record-1', name: 'Demo', cwd: 'D:\\workspaces\\demo' });
    const calls = createCallRecorder();
    const root = renderWorkspacePanel(createPanelProps({
      state: createReadyState({ items: [item] }),
      onOpenActiveThreadsClick: calls.recordOpenActiveThreads,
    }));

    clickButton(root, '进入');

    assert.deepEqual(calls.openActiveThreads, [item]);
  });


  test('submitting modal disables cancel and save buttons', () => {
    const root = renderWorkspacePanel(createPanelProps({
      state: {
        ...createReadyState(),
        modal: {
          status: 'add',
          submit: {
            status: 'submitting',
          },
        },
      },
    }));
    const form = findForm(root, '添加 Workspace 表单');

    assert.deepEqual(readButtonDisabledStates(form, ['取消', '保存']), {
      '取消': true,
      '保存': true,
    });
  });

  test('renders active thread page header and thread fields without fallback text', () => {
    const root = renderWorkspacePanel(createPanelProps({
      state: createActiveReadyState(),
    }));
    const text = textContent(root);

    assert.equal(readTextByLabel(root, 'Active workspace name'), 'Demo');
    assert.equal(readTextByLabel(root, 'Active workspace cwd'), 'D:\\workspaces\\demo');
    assert.equal(readTextByLabel(root, 'Thread name thread-2'), 'Second');
    assert.equal(readTextByLabel(root, 'Thread preview thread-2'), 'Second preview');
    assert.equal(readTextByLabel(root, 'Thread updated time thread-2'), '');
    assert.equal(text.includes('未命名对话'), false);
    assert.equal(text.includes('切换 Workspace'), true);
  });

  test('renders active thread loading state', () => {
    const root = renderWorkspacePanel(createPanelProps({
      state: createActiveStateWithResource({
        status: 'loading',
      }),
    }));

    assert.equal(textContent(root).includes('加载对话'), true);
    assert.equal(textContent(root).includes('切换 Workspace'), true);
  });

  test('renders active thread failed state', () => {
    const root = renderWorkspacePanel(createPanelProps({
      state: createActiveStateWithResource({
        status: 'failed',
        error: {
          code: 'thread-list-failed',
          message: 'Active threads 加载失败',
        },
      }),
    }));

    assert.equal(textContent(root).includes('Active threads 加载失败'), true);
    assert.equal(textContent(root).includes('切换 Workspace'), true);
  });

  test('renders active empty state without new thread entry', () => {
    const root = renderWorkspacePanel(createPanelProps({
      state: createActiveStateWithResource({
        status: 'ready',
        items: [],
        nextCursor: null,
        loadMore: {
          status: 'idle',
        },
      }),
    }));
    const text = textContent(root);

    assert.equal(text.includes('暂无对话'), true);
    assert.equal(text.includes('新建'), false);
  });

  test('renders load more button only when a cursor exists', () => {
    const calls = createCallRecorder();
    const withCursor = renderWorkspacePanel(createPanelProps({
      state: createActiveReadyState(),
      onLoadMoreActiveThreads: calls.recordLoadMoreActiveThreads,
    }));
    const withoutCursor = renderWorkspacePanel(createPanelProps({
      state: createActiveStateWithResource({
        status: 'ready',
        items: createActiveReadyItems(),
        nextCursor: null,
        loadMore: {
          status: 'idle',
        },
      }),
    }));

    clickButton(withCursor, '加载更多');

    assert.deepEqual(calls.loadMoreClicks, ['load-more']);
    assert.equal(textContent(withCursor).includes('加载更多'), true);
    assert.equal(textContent(withoutCursor).includes('加载更多'), false);
  });

  test('renders load more and card scoped errors without dropping active cards', () => {
    const root = renderWorkspacePanel(createPanelProps({
      state: createActiveStateWithResource({
        status: 'ready',
        items: [
          createThreadItem({ threadId: 'thread-1', name: 'Current', preview: '', current: true }),
          createThreadItem({
            threadId: 'thread-2',
            name: 'Second',
            preview: 'Second preview',
            cardError: {
              code: 'thread-resume-failed',
              message: 'Thread 恢复失败',
            },
          }),
        ],
        nextCursor: 'next-1',
        loadMore: {
          status: 'failed',
          error: {
            code: 'thread-list-failed',
            message: '加载更多失败',
          },
        },
      }),
    }));

    assert.equal(readTextByLabel(root, 'Thread name thread-2'), 'Second');
    assert.equal(readTextByLabel(root, 'Thread error thread-2'), 'Thread 恢复失败');
    assert.equal(readTextByLabel(root, 'Load more error'), '加载更多失败');
  });

  test('marks the current active thread with aria-current', () => {
    const root = renderWorkspacePanel(createPanelProps({
      state: createActiveReadyState(),
    }));

    assert.equal(readProps(findElementByLabel(root, 'Thread card thread-1'))['aria-current'], 'true');
  });

  test('does not dispatch resume for current active thread card', () => {
    const calls = createCallRecorder();
    const root = renderWorkspacePanel(createPanelProps({
      state: createActiveReadyState(),
      onResumeThread: calls.recordResumeThread,
    }));

    clickButton(root, 'Current');

    assert.deepEqual(calls.resumeThreads, []);
  });

  test('dispatches resume for non-current active thread card', () => {
    const calls = createCallRecorder();
    const root = renderWorkspacePanel(createPanelProps({
      state: createActiveReadyState(),
      onResumeThread: calls.recordResumeThread,
    }));

    clickButton(root, 'Second');

    assert.deepEqual(calls.resumeThreads, [
      {
        threadId: 'thread-2',
        current: false,
      },
    ]);
  });
});

function renderWorkspacePanel(props: WorkspacePanelProps): ReactElement {
  const rendered = WorkspacePanel(props);
  assert.equal(isValidElement(rendered), true);
  return rendered as ReactElement;
}

interface CreatePanelPropsInput {
  readonly state: WorkspacePanelProps['state'];
  onAddClick?(): void;
  onOpenActiveThreadsClick?(item: ClientWorkspaceListItemView): void;
  onBackToWorkspaceList?(): void;
  onLoadMoreActiveThreads?(): void;
  onResumeThread?: WorkspacePanelProps['onResumeThread'];
  onRenameClick?(item: ClientWorkspaceListItemView): void;
  onEditCwdClick?(item: ClientWorkspaceListItemView): void;
  onRemoveClick?(item: ClientWorkspaceListItemView): void;
  onCloseRequest?(): void;
  onAddSubmit?: WorkspacePanelProps['onAddSubmit'];
  onRenameSubmit?: WorkspacePanelProps['onRenameSubmit'];
  onEditCwdSubmit?: WorkspacePanelProps['onEditCwdSubmit'];
}

function createPanelProps(input: CreatePanelPropsInput): WorkspacePanelProps {
  return {
    state: input.state,
    onAddClick: input.onAddClick ?? (() => undefined),
    onAddSubmit: input.onAddSubmit ?? (() => undefined),
    onBackToWorkspaceList: input.onBackToWorkspaceList ?? (() => undefined),
    onCloseRequest: input.onCloseRequest ?? (() => undefined),
    onEditCwdClick: input.onEditCwdClick ?? (() => undefined),
    onEditCwdSubmit: input.onEditCwdSubmit ?? (() => undefined),
    onLoadMoreActiveThreads: input.onLoadMoreActiveThreads ?? (() => undefined),
    onOpenActiveThreadsClick: input.onOpenActiveThreadsClick ?? (() => undefined),
    onRemoveClick: input.onRemoveClick ?? (() => undefined),
    onRenameClick: input.onRenameClick ?? (() => undefined),
    onRenameSubmit: input.onRenameSubmit ?? (() => undefined),
    onResumeThread: input.onResumeThread ?? (() => undefined),
  };
}

interface CreateReadyStateInput {
  readonly items?: readonly ClientWorkspaceListItemView[];
}

function createReadyState(input: CreateReadyStateInput = {}): Extract<WorkspacePanelProps['state'], { readonly status: 'ready' }> {
  return {
    status: 'ready',
    panel: createReadyPanel({ items: input.items }),
    modal: {
      status: 'none',
    },
    listError: null,
  };
}

function createActiveReadyState(): Extract<WorkspacePanelProps['state'], { readonly status: 'ready' }> {
  return createActiveStateWithResource({
    status: 'ready',
    items: createActiveReadyItems(),
    nextCursor: 'next-1',
    loadMore: {
      status: 'idle',
    },
  });
}

function createActiveStateWithResource(resource: ClientWorkspaceActiveThreadResourceView): Extract<WorkspacePanelProps['state'], { readonly status: 'ready' }> {
  return {
    status: 'ready',
    panel: createReadyPanel({
      page: {
        kind: 'active-threads',
        workspaceId: 'D:\\workspaces\\demo',
        name: 'Demo',
        cwd: 'D:\\workspaces\\demo',
        resource,
      },
    }),
    modal: {
      status: 'none',
    },
    listError: null,
  };
}

function createActiveReadyItems() {
  return [
    createThreadItem({ threadId: 'thread-1', name: 'Current', preview: '', current: true }),
    createThreadItem({ threadId: 'thread-2', name: 'Second', preview: 'Second preview' }),
  ];
}

interface CreateThreadItemInput {
  readonly threadId: string;
  readonly name: string;
  readonly preview: string;
  readonly current?: boolean;
  readonly cardError?: { readonly code: string; readonly message: string } | null;
}

function createThreadItem(input: CreateThreadItemInput) {
  return {
    threadId: input.threadId,
    name: input.name,
    preview: input.preview,
    updatedAtIso: null,
    current: input.current ?? false,
    cardError: input.cardError ?? null,
    operation: 'idle' as const,
  };
}

interface CreateReadyPanelInput {
  readonly persistence?: 'persistent' | 'memory';
  readonly items?: readonly ClientWorkspaceListItemView[];
  readonly page?: ReadyWorkspacePanelView['page'];
}

function createReadyPanel(input: CreateReadyPanelInput = {}): ReadyWorkspacePanelView {
  return {
    status: 'ready' as const,
    list: {
      persistence: input.persistence === 'memory'
        ? {
            status: 'memory' as const,
            warning: '当前 Workspace 变更不会持久保存',
            error: { code: 'registry-unreadable', message: 'Workspace 配置不可读' },
          }
        : { status: 'persistent' as const },
      selectedWorkspaceId: null,
      items: input.items ?? [],
    },
    page: {
      kind: 'workspace-list',
    },
    ...(input.page === undefined ? {} : { page: input.page }),
  };
}

interface CreateAvailableItemInput {
  readonly workspaceId: string;
  readonly recordRef: string;
  readonly name: string;
  readonly cwd: string;
  readonly selected?: boolean;
  readonly operations?: readonly ('rename' | 'edit-cwd' | 'remove')[];
}

function createAvailableItem(input: CreateAvailableItemInput) {
  return {
    workspaceId: input.workspaceId,
    recordRef: input.recordRef,
    name: input.name,
    cwd: input.cwd,
    availability: {
      status: 'available' as const,
    },
    selected: input.selected ?? false,
    operations: input.operations ?? ['rename' as const, 'edit-cwd' as const, 'remove' as const],
  };
}

function createUnavailableItem(): ClientWorkspaceListItemView {
  return {
    workspaceId: 'D:\\workspaces\\missing',
    recordRef: 'workspace-record-1',
    name: 'Missing',
    cwd: 'D:\\workspaces\\missing',
    availability: {
      status: 'unavailable',
      reason: '路径不存在',
    },
    selected: false,
    operations: ['remove'],
  };
}

function createCallRecorder() {
  const addClicks: string[] = [];
  const addSubmits: Parameters<WorkspacePanelProps['onAddSubmit']>[0][] = [];
  const renameSubmits: Parameters<WorkspacePanelProps['onRenameSubmit']>[0][] = [];
  const editCwdSubmits: Parameters<WorkspacePanelProps['onEditCwdSubmit']>[0][] = [];
  const removeClicks: ClientWorkspaceListItemView[] = [];
  const openActiveThreads: ClientWorkspaceListItemView[] = [];
  const resumeThreads: Parameters<WorkspacePanelProps['onResumeThread']>[0][] = [];
  const loadMoreClicks: string[] = [];

  return {
    addClicks,
    addSubmits,
    renameSubmits,
    editCwdSubmits,
    removeClicks,
    openActiveThreads,
    resumeThreads,
    loadMoreClicks,
    recordAddClick() {
      addClicks.push('add-clicked');
    },
    recordAddSubmit(input: Parameters<WorkspacePanelProps['onAddSubmit']>[0]) {
      addSubmits.push(input);
    },
    recordRenameSubmit(input: Parameters<WorkspacePanelProps['onRenameSubmit']>[0]) {
      renameSubmits.push(input);
    },
    recordEditCwdSubmit(input: Parameters<WorkspacePanelProps['onEditCwdSubmit']>[0]) {
      editCwdSubmits.push(input);
    },
    recordRemoveClick(item: ClientWorkspaceListItemView) {
      removeClicks.push(item);
    },
    recordOpenActiveThreads(item: ClientWorkspaceListItemView) {
      openActiveThreads.push(item);
    },
    recordResumeThread(item: Parameters<WorkspacePanelProps['onResumeThread']>[0]) {
      resumeThreads.push(item);
    },
    recordLoadMoreActiveThreads() {
      loadMoreClicks.push('load-more');
    },
  };
}

interface TestElementProps {
  readonly children?: ReactNode;
  readonly onClick?: () => void;
  readonly onSubmit?: (event: TestSubmitEvent) => void;
  readonly disabled?: boolean;
  readonly 'aria-label'?: string;
  readonly 'aria-current'?: string;
}

interface TestSubmitEvent {
  preventDefault(): void;
  readonly currentTarget: {
    readonly elements: {
      namedItem(name: string): unknown;
    };
  };
}

function clickButton(root: ReactElement, label: string): void {
  const button = findButton(root, label);
  readProps(button).onClick?.();
}

function submitForm(root: ReactElement, label: string, values: Record<string, string>): void {
  const form = findForm(root, label);
  let prevented = false;
  readProps(form).onSubmit?.({
    preventDefault() {
      prevented = true;
    },
    currentTarget: {
      elements: {
        namedItem(name: string) {
          return {
            value: values[name] ?? '',
          };
        },
      },
    },
  });

  assert.equal(prevented, true);
}

function findButton(root: ReactElement, label: string): ReactElement {
  const button = collectElements(root).find(element => element.type === 'button' && textContent(element) === label);
  assert.notEqual(button, undefined);
  return button as ReactElement;
}

function findForm(root: ReactElement, label: string): ReactElement {
  const form = collectElements(root).find(element => element.type === 'form' && readProps(element)['aria-label'] === label);
  assert.notEqual(form, undefined);
  return form as ReactElement;
}

function readTextByLabel(root: ReactElement, label: string): string {
  return textContent(findElementByLabel(root, label));
}

function findElementByLabel(root: ReactElement, label: string): ReactElement {
  const element = collectElements(root).find(candidate => readProps(candidate)['aria-label'] === label);
  assert.notEqual(element, undefined);
  return element as ReactElement;
}

function readFormLabels(root: ReactElement): string[] {
  return collectElements(root)
    .filter(element => element.type === 'form')
    .map(element => readProps(element)['aria-label'] ?? '');
}

function readButtonDisabledStates(root: ReactElement, labels: readonly string[]): Record<string, boolean> {
  const states: Record<string, boolean> = {};
  for (const label of labels) {
    states[label] = readProps(findButton(root, label)).disabled === true;
  }

  return states;
}

function collectElements(root: ReactNode): ReactElement[] {
  if (!isValidElement(root)) {
    return [];
  }

  if (isFunctionComponentElement(root)) {
    return collectElements(renderFunctionComponent(root));
  }

  const children = readChildren(root);
  return [root, ...children.flatMap(child => collectElements(child))];
}

function textContent(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(child => textContent(child)).join('');
  }

  if (!isValidElement(node)) {
    return '';
  }

  if (isFunctionComponentElement(node)) {
    return textContent(renderFunctionComponent(node));
  }

  return readChildren(node).map(child => textContent(child)).join('');
}

function readChildren(element: ReactElement): ReactNode[] {
  const children = readProps(element).children;
  if (children === undefined || children === null) {
    return [];
  }

  return Array.isArray(children) ? children : [children];
}

function readProps(element: ReactElement): TestElementProps {
  return element.props as TestElementProps;
}

type TestFunctionComponent = (props: unknown) => ReactNode;

function isFunctionComponentElement(element: ReactElement): boolean {
  return typeof element.type === 'function';
}

function renderFunctionComponent(element: ReactElement): ReactNode {
  return (element.type as TestFunctionComponent)(element.props);
}
