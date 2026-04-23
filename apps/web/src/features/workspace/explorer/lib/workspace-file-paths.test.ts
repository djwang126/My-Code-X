import { describe, expect, it } from 'vitest';

import { resolveWorkspaceRelativePathFromFileHref } from './workspace-file-paths';

describe('workspace file href path helpers', () => {
  it('matches Windows file:// paths case-insensitively within the current workspace', () => {
    expect(
      resolveWorkspaceRelativePathFromFileHref({
        href: 'file:///d:/work/repo/docs/README.md',
        workspace: 'D:/Work/Repo',
      }),
    ).toBe('docs/README.md');
  });

  it('returns an empty relative path when the href points to the workspace root itself', () => {
    expect(
      resolveWorkspaceRelativePathFromFileHref({
        href: 'file:///d:/work/repo',
        workspace: 'D:/Work/Repo',
      }),
    ).toBe('');
  });

  it('recovers a workspace-relative path from a raw Windows path without a file:// prefix', () => {
    expect(
      resolveWorkspaceRelativePathFromFileHref({
        href: 'D:\\Work\\Repo\\docs\\README.md',
        workspace: 'D:/Work/Repo',
      }),
    ).toBe('docs/README.md');
  });

  it('recovers a workspace-relative path from markdown hrefs that prefix Windows absolute paths with a slash', () => {
    expect(
      resolveWorkspaceRelativePathFromFileHref({
        href: '/D:/Work/Repo/docs/README.md',
        workspace: 'D:/Work/Repo',
      }),
    ).toBe('docs/README.md');
  });

  it('accepts plain workspace-relative AI path references', () => {
    expect(
      resolveWorkspaceRelativePathFromFileHref({
        href: 'docs/README.md',
        workspace: 'D:/Work/Repo',
      }),
    ).toBe('docs/README.md');
  });

  it('accepts dotted workspace-relative AI path references', () => {
    expect(
      resolveWorkspaceRelativePathFromFileHref({
        href: '.\\docs\\README.md',
        workspace: 'D:/Work/Repo',
      }),
    ).toBe('docs/README.md');
  });

  it('accepts workspace-relative AI path references with a leading forward slash', () => {
    expect(
      resolveWorkspaceRelativePathFromFileHref({
        href: '/docs/README.md',
        workspace: 'D:/Work/Repo',
      }),
    ).toBe('docs/README.md');
  });

  it('accepts workspace-relative AI path references with a leading backslash', () => {
    expect(
      resolveWorkspaceRelativePathFromFileHref({
        href: '\\docs\\README.md',
        workspace: 'D:/Work/Repo',
      }),
    ).toBe('docs/README.md');
  });

  it('decodes encoded spaces inside AI-generated file urls before resolving the relative path', () => {
    expect(
      resolveWorkspaceRelativePathFromFileHref({
        href: 'file:///D:/Work/Repo/docs/My%20File.md',
        workspace: 'D:/Work/Repo',
      }),
    ).toBe('docs/My File.md');
  });

  it('recovers a workspace-relative path from markdown-wrapped file urls', () => {
    expect(
      resolveWorkspaceRelativePathFromFileHref({
        href: '<file:///D:/Work/Repo/docs/README.md>',
        workspace: 'D:/Work/Repo',
      }),
    ).toBe('docs/README.md');
  });

  it('ignores trailing punctuation that often appears in AI-generated file links', () => {
    expect(
      resolveWorkspaceRelativePathFromFileHref({
        href: 'file:///D:/Work/Repo/docs/README.md).',
        workspace: 'D:/Work/Repo',
      }),
    ).toBe('docs/README.md');
  });

  it('strips trailing line numbers from absolute file references before resolving the relative path', () => {
    expect(
      resolveWorkspaceRelativePathFromFileHref({
        href: 'D:/Work/Repo/docs/README.md:24',
        workspace: 'D:/Work/Repo',
      }),
    ).toBe('docs/README.md');
  });

  it('strips trailing line and column numbers from file urls before resolving the relative path', () => {
    expect(
      resolveWorkspaceRelativePathFromFileHref({
        href: 'file:///D:/Work/Repo/docs/README.md:24:8',
        workspace: 'D:/Work/Repo',
      }),
    ).toBe('docs/README.md');
  });

  it('does not strip a trailing parenthesis when it is part of the actual filename', () => {
    expect(
      resolveWorkspaceRelativePathFromFileHref({
        href: 'file:///D:/Work/Repo/docs/query-builder).md',
        workspace: 'D:/Work/Repo',
      }),
    ).toBe('docs/query-builder).md');
  });

  it('does not strip a trailing bracket when it is part of the actual relative filename', () => {
    expect(
      resolveWorkspaceRelativePathFromFileHref({
        href: 'docs/notes].txt',
        workspace: 'D:/Work/Repo',
      }),
    ).toBe('docs/notes].txt');
  });

  it('handles nonstandard Windows file urls that use a drive path after file://', () => {
    expect(
      resolveWorkspaceRelativePathFromFileHref({
        href: 'file://D:\\Work\\Repo\\docs\\README.md',
        workspace: 'D:/Work/Repo',
      }),
    ).toBe('docs/README.md');
  });

  it('normalizes encoded backslashes that appear in AI-generated file urls', () => {
    expect(
      resolveWorkspaceRelativePathFromFileHref({
        href: 'file:///D:/Work/Repo/docs%5CREADME.md',
        workspace: 'D:/Work/Repo',
      }),
    ).toBe('docs/README.md');
  });

  it('unwraps simple code-formatted file references before resolving them', () => {
    expect(
      resolveWorkspaceRelativePathFromFileHref({
        href: '`file:///D:/Work/Repo/docs/README.md`',
        workspace: 'D:/Work/Repo',
      }),
    ).toBe('docs/README.md');
  });

  it('unwraps quoted AI-generated file targets before resolving them', () => {
    expect(
      resolveWorkspaceRelativePathFromFileHref({
        href: '"file:///D:/Work/Repo/docs/README.md"',
        workspace: 'D:/Work/Repo',
      }),
    ).toBe('docs/README.md');
  });

  it('tolerates uppercase FILE protocol variants', () => {
    expect(
      resolveWorkspaceRelativePathFromFileHref({
        href: 'FILE:///D:/Work/Repo/docs/README.md',
        workspace: 'D:/Work/Repo',
      }),
    ).toBe('docs/README.md');
  });

  it('resolves encoded backslash separators when the workspace path itself uses backslashes', () => {
    expect(
      resolveWorkspaceRelativePathFromFileHref({
        href: 'file:///D:/Work/Repo/docs%5CREADME.md',
        workspace: 'D:\\Work\\Repo',
      }),
    ).toBe('docs/README.md');
  });

  it('treats a trailing workspace slash as equivalent when matching the workspace root', () => {
    expect(
      resolveWorkspaceRelativePathFromFileHref({
        href: 'file:///D:/Work/Repo/',
        workspace: 'D:/Work/Repo',
      }),
    ).toBe('');
  });

  it('rejects wrapped paths that still resolve outside the active workspace after normalization', () => {
    expect(
      resolveWorkspaceRelativePathFromFileHref({
        href: '`file:///D:/Work/Repo/docs/../../secret.txt`',
        workspace: 'D:/Work/Repo',
      }),
    ).toBeNull();
  });

  it('rejects paths that only match by filename suffix but are outside the active workspace', () => {
    expect(
      resolveWorkspaceRelativePathFromFileHref({
        href: 'file:///D:/Other/docs/README.md',
        workspace: 'D:/Work/Repo',
      }),
    ).toBeNull();
  });

  it('rejects encoded parent traversal that escapes the active workspace', () => {
    expect(
      resolveWorkspaceRelativePathFromFileHref({
        href: 'file:///D:/Work/Repo/docs/%2E%2E/%2E%2E/secret.txt',
        workspace: 'D:/Work/Repo',
      }),
    ).toBeNull();
  });

  it('rejects relative parent traversal that escapes the active workspace', () => {
    expect(
      resolveWorkspaceRelativePathFromFileHref({
        href: '..\\..\\secret.txt',
        workspace: 'D:/Work/Repo',
      }),
    ).toBeNull();
  });

  it('rejects Windows drive-relative paths instead of treating them as workspace-relative candidates', () => {
    expect(
      resolveWorkspaceRelativePathFromFileHref({
        href: 'D:secret.txt',
        workspace: 'D:/Work/Repo',
      }),
    ).toBeNull();

    expect(
      resolveWorkspaceRelativePathFromFileHref({
        href: 'C:secret.txt',
        workspace: 'D:/Work/Repo',
      }),
    ).toBeNull();
  });

  it('rejects non-file urls instead of treating them as workspace-relative file paths', () => {
    expect(
      resolveWorkspaceRelativePathFromFileHref({
        href: 'https://example.com/docs/README.md',
        workspace: 'D:/Work/Repo',
      }),
    ).toBeNull();

    expect(
      resolveWorkspaceRelativePathFromFileHref({
        href: 'mailto:test@example.com',
        workspace: 'D:/Work/Repo',
      }),
    ).toBeNull();
  });

  it('rejects network-path style inputs instead of treating them as workspace-relative file paths', () => {
    expect(
      resolveWorkspaceRelativePathFromFileHref({
        href: '//server/share/docs/README.md',
        workspace: 'D:/Work/Repo',
      }),
    ).toBeNull();
  });
});
