import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';

import {
  buildNodeRuntimeTarget,
  buildReleaseMetadata,
  normalizePlatform,
  parseReleaseArgs,
  portableEntryScriptPaths,
  releaseCopySpecs,
} from './build-release.mjs';

test('parseReleaseArgs understands build/install/archive toggles', () => {
  const parsed = parseReleaseArgs([
    '--skip-build',
    '--skip-install',
    '--no-archive',
    '--output-dir=custom-output',
  ]);

  assert.equal(parsed.buildFrontend, false);
  assert.equal(parsed.installProdDependencies, false);
  assert.equal(parsed.archive, false);
  assert.match(parsed.outputDir, /custom-output$/);
});

test('buildReleaseMetadata produces portable artifact names', () => {
  assert.deepEqual(
    buildReleaseMetadata({ version: '1.2.3', platform: 'win32', arch: 'x64' }),
    {
      version: '1.2.3',
      platform: 'win32',
      platformLabel: 'windows',
      arch: 'x64',
      releaseName: 'my-code-x-windows-x64',
      archiveFileName: 'my-code-x-windows-x64.zip',
    },
  );

  assert.deepEqual(
    buildReleaseMetadata({ version: '1.2.3', platform: 'linux', arch: 'arm64' }),
    {
      version: '1.2.3',
      platform: 'linux',
      platformLabel: 'linux',
      arch: 'arm64',
      releaseName: 'my-code-x-linux-arm64',
      archiveFileName: 'my-code-x-linux-arm64.tar.gz',
    },
  );
});

test('normalizePlatform and buildNodeRuntimeTarget map platform-specific values', () => {
  assert.equal(normalizePlatform('win32'), 'windows');
  assert.equal(normalizePlatform('darwin'), 'macos');
  assert.equal(normalizePlatform('linux'), 'linux');
  assert.equal(buildNodeRuntimeTarget('win32'), path.join('node', 'node.exe'));
  assert.equal(buildNodeRuntimeTarget('linux'), path.join('node', 'bin', 'node'));
});

test('release copy lists include runtime-critical files and root entry scripts', () => {
  assert.ok(releaseCopySpecs.includes('apps/server/dist'));
  assert.ok(releaseCopySpecs.includes('apps/web/dist'));
  assert.ok(releaseCopySpecs.includes('custom-harness'));
  assert.ok(releaseCopySpecs.includes('scripts/my-code-x-launcher.mjs'));
  assert.ok(releaseCopySpecs.includes('scripts/tailscale-serve.mjs'));
  assert.ok(releaseCopySpecs.includes('packages/utils/dist'));
  assert.ok(!releaseCopySpecs.includes('node_modules'));
  assert.deepEqual(portableEntryScriptPaths, [
    path.join('bin', 'start-my-code-x.cmd'),
    path.join('bin', 'start-my-code-x.sh'),
    path.join('bin', 'stop-my-code-x.cmd'),
    path.join('bin', 'stop-my-code-x.sh'),
  ]);
});
