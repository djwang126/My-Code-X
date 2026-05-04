import type { PathComparisonPort } from '../../ports/index.js';

export interface CreateNodePathComparisonInput {
  readonly platform: NodePathComparisonPlatform;
}

export type NodePathComparisonPlatform = 'aix' | 'android' | 'darwin' | 'freebsd' | 'haiku' | 'linux' | 'openbsd' | 'sunos' | 'win32' | 'cygwin' | 'netbsd';

export function createNodePathComparison(input: CreateNodePathComparisonInput): PathComparisonPort {
  return {
    samePath(pathInput) {
      if (input.platform === 'win32') {
        return pathInput.left.toLowerCase() === pathInput.right.toLowerCase();
      }

      return pathInput.left === pathInput.right;
    },
  };
}
