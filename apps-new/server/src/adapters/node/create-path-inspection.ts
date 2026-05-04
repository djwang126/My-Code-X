import { constants } from 'node:fs';
import { access as fsAccess, realpath as fsRealpath, stat as fsStat } from 'node:fs/promises';
import path from 'node:path';
import type { PathInspectionPort, PathInspectionResult } from '../../ports/index.js';

export interface NodePathInspectionDependencies {
  stat(path: string): Promise<NodePathInfo>;
  access(path: string, mode: number): Promise<void>;
  realpath(path: string): Promise<string>;
}

export interface NodePathInfo {
  isDirectory(): boolean;
}

export function createNodePathInspection(dependencies: NodePathInspectionDependencies = createDefaultNodePathInspectionDependencies()): PathInspectionPort {
  return {
    async inspect(input): Promise<PathInspectionResult> {
      const candidate = input.path;
      if (candidate === '') {
        return {
          status: 'invalid',
          reason: 'empty',
          message: 'cwd 必填',
        };
      }

      if (!path.isAbsolute(candidate)) {
        return {
          status: 'invalid',
          reason: 'relative',
          message: '路径必须是绝对路径',
        };
      }

      let info;
      try {
        info = await dependencies.stat(candidate);
      } catch (error) {
        if (isNodeErrorCode(error, 'EACCES') || isNodeErrorCode(error, 'EPERM')) {
          return {
            status: 'invalid',
            reason: 'inaccessible',
            message: '路径不可访问',
          };
        }

        if (!isNodeErrorCode(error, 'ENOENT')) {
          return {
            status: 'invalid',
            reason: 'inaccessible',
            message: '路径不可访问',
          };
        }

        return {
          status: 'invalid',
          reason: 'missing',
          message: '路径不存在',
        };
      }

      if (!info.isDirectory()) {
        return {
          status: 'invalid',
          reason: 'not-directory',
          message: '路径不是目录',
        };
      }

      try {
        await dependencies.access(candidate, constants.R_OK | constants.X_OK);
      } catch {
        return {
          status: 'invalid',
          reason: 'inaccessible',
          message: '路径不可访问',
        };
      }

      let canonicalPath: string;
      try {
        canonicalPath = await dependencies.realpath(candidate);
      } catch {
        return {
          status: 'invalid',
          reason: 'canonicalization-failed',
          message: '路径不可解析',
        };
      }

      return {
        status: 'available',
        canonicalPath,
        basename: path.basename(canonicalPath),
      };
    },
  };
}

function createDefaultNodePathInspectionDependencies(): NodePathInspectionDependencies {
  return {
    stat: fsStat,
    access: fsAccess,
    realpath: fsRealpath,
  };
}

function isNodeErrorCode(error: unknown, code: string): boolean {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && (error as { readonly code?: unknown }).code === code;
}
