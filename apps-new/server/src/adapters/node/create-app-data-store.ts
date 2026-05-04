import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { AppDataStoreError, type AppDataStorePort } from '../../ports/index.js';

export interface CreateNodeAppDataStoreInput {
  readonly homeDirectory: string;
}

export function createNodeAppDataStore(input: CreateNodeAppDataStoreInput): AppDataStorePort {
  const appDataDirectory = path.resolve(input.homeDirectory, '.my-code-x');

  return {
    async readDocument(documentInput) {
      const documentPath = resolveDocumentPath({ appDataDirectory, name: documentInput.name });

      try {
        await mkdir(appDataDirectory, { recursive: true });
        return await readFile(documentPath, 'utf-8');
      } catch (error) {
        if (isNodeErrorCode(error, 'ENOENT')) {
          return null;
        }

        throw new AppDataStoreError('read-failed', 'App data document read failed');
      }
    },

    async writeDocumentAtomically(documentInput) {
      const documentPath = resolveDocumentPath({ appDataDirectory, name: documentInput.name });
      const tempPath = `${documentPath}.${process.pid}.${Date.now()}.tmp`;

      try {
        await mkdir(appDataDirectory, { recursive: true });
        await writeFile(tempPath, documentInput.content, 'utf-8');
        await rename(tempPath, documentPath);
      } catch {
        await rm(tempPath, { force: true }).catch(() => undefined);
        throw new AppDataStoreError('write-failed', 'App data document write failed');
      }
    },
  };
}

interface ResolveDocumentPathInput {
  readonly appDataDirectory: string;
  readonly name: string;
}

function resolveDocumentPath(input: ResolveDocumentPathInput): string {
  if (input.name.includes('/') || input.name.includes('\\') || input.name === '..' || input.name.includes('..')) {
    throw new AppDataStoreError('invalid-document-name', 'App data document name is invalid');
  }

  const documentPath = path.resolve(input.appDataDirectory, input.name);
  const relative = path.relative(input.appDataDirectory, documentPath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new AppDataStoreError('invalid-document-name', 'App data document name is invalid');
  }

  return documentPath;
}

function isNodeErrorCode(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { readonly code?: unknown }).code === code;
}

