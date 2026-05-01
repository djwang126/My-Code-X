import type { Stats } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { errorResponse, fileResponse } from '../http-responses.js';
import type { HttpResponse } from '../http-types.js';

export interface StaticFileConfig {
  readonly staticRoot: string;
}

export interface CreateStaticFileResponseInput {
  readonly config: StaticFileConfig;
  readonly path: string;
}

export async function createStaticFileResponse(input: CreateStaticFileResponseInput): Promise<HttpResponse> {
  const root = path.resolve(input.config.staticRoot);
  const target = resolveStaticTarget({ root, requestPath: input.path });

  if (target.status === 'invalid') {
    return errorResponse({
      statusCode: 400,
      body: 'Invalid request path',
    });
  }

  const fileResponseResult = await tryCreateFileResponse({
    absolutePath: target.absolutePath,
  });

  if (fileResponseResult.status === 'response') {
    return fileResponseResult.response;
  }

  if (fileResponseResult.status === 'failed') {
    return errorResponse({
      statusCode: 500,
      body: 'Static file unavailable',
    });
  }

  if (!shouldFallbackToIndex(input.path)) {
    return errorResponse({
      statusCode: 404,
      body: 'Not found',
    });
  }

  return createIndexFileResponse({ staticRoot: root });
}

interface ResolveStaticTargetInput {
  readonly root: string;
  readonly requestPath: string;
}

type ResolveStaticTargetResult =
  | StaticTarget
  | InvalidStaticTarget;

interface StaticTarget {
  readonly status: 'target';
  readonly absolutePath: string;
}

interface InvalidStaticTarget {
  readonly status: 'invalid';
}

function resolveStaticTarget(input: ResolveStaticTargetInput): ResolveStaticTargetResult {
  const relativePath = readRelativePath(input.requestPath);

  if (relativePath.status === 'invalid') {
    return relativePath;
  }

  const absolutePath = path.resolve(input.root, relativePath.value);

  if (!isInsideRoot({ root: input.root, absolutePath })) {
    return {
      status: 'invalid',
    };
  }

  return {
    status: 'target',
    absolutePath,
  };
}

type ReadRelativePathResult =
  | { readonly status: 'decoded'; readonly value: string }
  | { readonly status: 'invalid' };

function readRelativePath(requestPath: string): ReadRelativePathResult {
  if (requestPath === '/') {
    return {
      status: 'decoded',
      value: 'index.html',
    };
  }

  try {
    return {
      status: 'decoded',
      value: decodeURIComponent(requestPath).replace(/^\/+/, ''),
    };
  } catch {
    return {
      status: 'invalid',
    };
  }
}

interface IsInsideRootInput {
  readonly root: string;
  readonly absolutePath: string;
}

function isInsideRoot(input: IsInsideRootInput): boolean {
  const relative = path.relative(input.root, input.absolutePath);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

type TryCreateFileResponseResult =
  | { readonly status: 'response'; readonly response: HttpResponse }
  | { readonly status: 'missing' }
  | { readonly status: 'failed'; readonly error: unknown };

interface TryCreateFileResponseInput {
  readonly absolutePath: string;
}

async function tryCreateFileResponse(input: TryCreateFileResponseInput): Promise<TryCreateFileResponseResult> {
  const fileStat = await readFileStat(input.absolutePath);

  switch (fileStat.status) {
    case 'found':
      if (!fileStat.stat.isFile()) {
        return {
          status: 'missing',
        };
      }

      return {
        status: 'response',
        response: fileResponse({
          statusCode: 200,
          path: input.absolutePath,
          contentType: readContentType(input.absolutePath),
          headers: readCacheHeaders(input.absolutePath),
        }),
      };

    case 'missing':
      return {
        status: 'missing',
      };

    case 'failed':
      return fileStat;
  }
}

async function createIndexFileResponse(input: StaticFileConfig): Promise<HttpResponse> {
  const indexPath = path.join(input.staticRoot, 'index.html');
  const fileResponseResult = await tryCreateFileResponse({ absolutePath: indexPath });

  switch (fileResponseResult.status) {
    case 'response':
      return fileResponseResult.response;

    case 'missing':
      return errorResponse({
        statusCode: 404,
        body: 'Not found',
      });

    case 'failed':
      return errorResponse({
        statusCode: 500,
        body: 'Static file unavailable',
      });
  }
}

type FileStatResult =
  | { readonly status: 'found'; readonly stat: Stats }
  | { readonly status: 'missing' }
  | { readonly status: 'failed'; readonly error: unknown };

async function readFileStat(filePath: string): Promise<FileStatResult> {
  try {
    return {
      status: 'found',
      stat: await stat(filePath),
    };
  } catch (error) {
    if (isNodeFileMissingError(error)) {
      return {
        status: 'missing',
      };
    }

    return {
      status: 'failed',
      error,
    };
  }
}

function isNodeFileMissingError(error: unknown): boolean {
  return readNodeErrorCode(error) === 'ENOENT' || readNodeErrorCode(error) === 'ENOTDIR';
}

function readNodeErrorCode(error: unknown): unknown {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return null;
  }

  return error.code;
}

function shouldFallbackToIndex(requestPath: string): boolean {
  if (requestPath === '/') {
    return true;
  }

  if (isAssetPath(requestPath)) {
    return false;
  }

  return path.posix.extname(requestPath) === '';
}

function isAssetPath(requestPath: string): boolean {
  return requestPath === '/assets' || requestPath.startsWith('/assets/');
}

function readContentType(filePath: string): string {
  switch (path.extname(filePath).toLowerCase()) {
    case '.html':
      return 'text/html; charset=utf-8';
    case '.js':
      return 'text/javascript; charset=utf-8';
    case '.css':
      return 'text/css; charset=utf-8';
    case '.json':
      return 'application/json; charset=utf-8';
    case '.svg':
      return 'image/svg+xml';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.ico':
      return 'image/x-icon';
    default:
      return 'application/octet-stream';
  }
}

function readCacheHeaders(filePath: string): Record<string, string> {
  if (path.basename(filePath) === 'index.html') {
    return {
      'cache-control': 'no-cache',
    };
  }

  return {
    'cache-control': 'public, max-age=31536000, immutable',
  };
}

