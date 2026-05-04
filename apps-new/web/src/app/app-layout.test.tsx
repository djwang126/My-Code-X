import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { isValidElement, type ReactElement, type ReactNode } from 'react';

import { AppLayout } from './app-layout.js';

describe('AppLayout', () => {
  test('clicking the workspace entry dispatches the workspace open request', () => {
    const calls: string[] = [];
    const root = renderAppLayout({
      onWorkspaceClick() {
        calls.push('workspace-clicked');
      },
    });

    clickButton(root, 'Workspace');

    assert.deepEqual(calls, ['workspace-clicked']);
  });
});

interface RenderAppLayoutInput {
  onWorkspaceClick(): void;
}

function renderAppLayout(input: RenderAppLayoutInput): ReactElement {
  const rendered = AppLayout({
    appName: 'My-Code-X',
    scopeLabel: 'slot slot-1',
    onWorkspaceClick: input.onWorkspaceClick,
    children: <main>conversation</main>,
  });
  assert.equal(isValidElement(rendered), true);
  return rendered;
}

interface TestElementProps {
  readonly children?: ReactNode;
  readonly onClick?: () => void;
}

function clickButton(root: ReactElement, label: string): void {
  const button = collectElements(root).find(element => element.type === 'button' && textContent(element) === label);
  assert.notEqual(button, undefined);
  readProps(button as ReactElement).onClick?.();
}

function collectElements(root: ReactNode): ReactElement[] {
  if (!isValidElement(root)) {
    return [];
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
