import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildTailscaleLanFallbackHelp,
  buildTailscaleInstallHelp,
  ensureTailscaleInstalled,
  getTailscaleDesktopDownloadInfo,
  TailscaleInstallRequiredError,
} from './tailscale/tailscale-bootstrap.mjs';

test('buildTailscaleInstallHelp returns the Windows download page for win32', () => {
  const message = buildTailscaleInstallHelp({ platform: 'win32' });

  assert.match(message, /Windows 安装：/);
  assert.match(message, /https:\/\/tailscale\.com\/download\/windows/);
  assert.match(message, /npm start/);
});

test('buildTailscaleInstallHelp returns the macOS download page for darwin', () => {
  const message = buildTailscaleInstallHelp({ platform: 'darwin' });

  assert.match(message, /macOS 安装：/);
  assert.match(message, /https:\/\/tailscale\.com\/download\/mac/);
  assert.match(message, /npm start/);
});

test('buildTailscaleInstallHelp returns Linux docs and commands for linux', () => {
  const message = buildTailscaleInstallHelp({ platform: 'linux' });

  assert.match(message, /Linux 安装文档：/);
  assert.match(message, /https:\/\/tailscale\.com\/docs\/install\/linux/);
  assert.match(message, /curl -fsSL https:\/\/tailscale\.com\/install\.sh \| sh/);
  assert.match(message, /sudo tailscale up/);
});

test('getTailscaleDesktopDownloadInfo returns the platform-specific desktop link', () => {
  assert.deepEqual(getTailscaleDesktopDownloadInfo({ platform: 'win32' }), {
    label: 'Desktop (Windows)',
    url: 'https://tailscale.com/download/windows',
  });

  assert.deepEqual(getTailscaleDesktopDownloadInfo({ platform: 'darwin' }), {
    label: 'Desktop (macOS)',
    url: 'https://tailscale.com/download/mac',
  });
});

test('buildTailscaleLanFallbackHelp explains the LAN-only limitation and official downloads in English', () => {
  const message = buildTailscaleLanFallbackHelp({ platform: 'win32' });

  assert.match(message, /started in LAN mode instead/i);
  assert.match(message, /same local network/i);
  assert.match(message, /install Tailscale on both this computer and your phone/i);
  assert.match(message, /Desktop \(Windows\): https:\/\/tailscale\.com\/download\/windows/);
  assert.match(message, /iPhone \/ iPad \(iOS\): https:\/\/tailscale\.com\/download\/ios/);
  assert.match(message, /Android: https:\/\/tailscale\.com\/download\/android/);
  assert.match(message, /All downloads: https:\/\/tailscale\.com\/download/);
});

test('ensureTailscaleInstalled throws an install guide when the tailscale command is missing', async () => {
  const runTailscaleCommand = async () => {
    const error = new Error('spawn tailscale ENOENT');
    error.code = 'ENOENT';
    throw error;
  };

  await assert.rejects(
    () => ensureTailscaleInstalled({ runTailscaleCommand, platform: 'win32' }),
    error =>
      error instanceof TailscaleInstallRequiredError &&
      /https:\/\/tailscale\.com\/download\/windows/.test(error.message),
  );
});
