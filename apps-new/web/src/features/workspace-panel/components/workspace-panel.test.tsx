import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import type { ClientWorkspaceListItemView } from '@my-code-x/contracts-new';

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
    assert.equal(text.includes('进入'), false);
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
});

function renderWorkspacePanel(props: WorkspacePanelProps): ReactElement {
  const rendered = WorkspacePanel(props);
  assert.equal(isValidElement(rendered), true);
  return rendered as ReactElement;
}

interface CreatePanelPropsInput {
  readonly state: WorkspacePanelProps['state'];
  onAddClick?(): void;
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
    onCloseRequest: input.onCloseRequest ?? (() => undefined),
    onEditCwdClick: input.onEditCwdClick ?? (() => undefined),
    onEditCwdSubmit: input.onEditCwdSubmit ?? (() => undefined),
    onRemoveClick: input.onRemoveClick ?? (() => undefined),
    onRenameClick: input.onRenameClick ?? (() => undefined),
    onRenameSubmit: input.onRenameSubmit ?? (() => undefined),
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

interface CreateReadyPanelInput {
  readonly persistence?: 'persistent' | 'memory';
    readonly items?: readonly ClientWorkspaceListItemView[];
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

  return {
    addClicks,
    addSubmits,
    renameSubmits,
    editCwdSubmits,
    removeClicks,
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
  };
}

interface TestElementProps {
  readonly children?: ReactNode;
  readonly onClick?: () => void;
  readonly onSubmit?: (event: TestSubmitEvent) => void;
  readonly disabled?: boolean;
  readonly 'aria-label'?: string;
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
  const element = collectElements(root).find(candidate => readProps(candidate)['aria-label'] === label);
  assert.notEqual(element, undefined);
  return textContent(element);
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
