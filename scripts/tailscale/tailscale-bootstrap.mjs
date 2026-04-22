import process from 'node:process';

const TAILSCALE_DOWNLOAD_URL = 'https://tailscale.com/download';
const TAILSCALE_WINDOWS_DOWNLOAD_URL = 'https://tailscale.com/download/windows';
const TAILSCALE_MAC_DOWNLOAD_URL = 'https://tailscale.com/download/mac';
const TAILSCALE_LINUX_INSTALL_URL = 'https://tailscale.com/docs/install/linux';
const TAILSCALE_IOS_DOWNLOAD_URL = 'https://tailscale.com/download/ios';
const TAILSCALE_ANDROID_DOWNLOAD_URL = 'https://tailscale.com/download/android';

export class TailscaleInstallRequiredError extends Error {
  constructor({ platform }) {
    super(buildTailscaleInstallHelp({ platform }));
    this.name = 'TailscaleInstallRequiredError';
    this.platform = platform;
  }
}

export function getTailscaleDesktopDownloadInfo({ platform = process.platform } = {}) {
  const normalizedPlatform = String(platform || '').trim().toLowerCase();

  if (normalizedPlatform === 'win32') {
    return {
      label: 'Desktop (Windows)',
      url: TAILSCALE_WINDOWS_DOWNLOAD_URL,
    };
  }

  if (normalizedPlatform === 'darwin') {
    return {
      label: 'Desktop (macOS)',
      url: TAILSCALE_MAC_DOWNLOAD_URL,
    };
  }

  if (normalizedPlatform === 'linux') {
    return {
      label: 'Desktop (Linux)',
      url: TAILSCALE_LINUX_INSTALL_URL,
    };
  }

  return {
    label: 'Desktop',
    url: TAILSCALE_DOWNLOAD_URL,
  };
}

export function buildTailscaleInstallHelp({ platform = process.platform } = {}) {
  const normalizedPlatform = String(platform || '').trim().toLowerCase();
  const sharedLines = [
    'Tailscale mode requested, but Tailscale is not installed.',
    '',
  ];

  if (normalizedPlatform === 'win32') {
    return [
      ...sharedLines,
      'Windows 安装：',
      TAILSCALE_WINDOWS_DOWNLOAD_URL,
      '',
      '安装完成并登录后，重新运行：',
      'npm start',
    ].join('\n');
  }

  if (normalizedPlatform === 'darwin') {
    return [
      ...sharedLines,
      'macOS 安装：',
      TAILSCALE_MAC_DOWNLOAD_URL,
      '',
      '安装完成并登录后，重新运行：',
      'npm start',
    ].join('\n');
  }

  if (normalizedPlatform === 'linux') {
    return [
      ...sharedLines,
      'Linux 安装文档：',
      TAILSCALE_LINUX_INSTALL_URL,
      '',
      '主流发行版可执行：',
      'curl -fsSL https://tailscale.com/install.sh | sh',
      'sudo tailscale up',
      '',
      '完成后重新运行：',
      'npm start',
    ].join('\n');
  }

  return [
    ...sharedLines,
    '请从官方下载页安装：',
    TAILSCALE_DOWNLOAD_URL,
    '',
    '安装完成并登录后，重新运行：',
    'npm start',
  ].join('\n');
}

export function buildTailscaleLanFallbackHelp({ platform = process.platform } = {}) {
  const desktopDownload = getTailscaleDesktopDownloadInfo({ platform });

  return [
    'Tailscale is not installed, so My-Code-X started in LAN mode instead.',
    '',
    'LAN mode only works for devices on the same local network (for example, the same Wi-Fi) as this computer.',
    'If you want to use My-Code-X away from the same local network, install Tailscale on both this computer and your phone.',
    'Install Tailscale, then restart My-Code-X to switch from LAN mode to Tailscale mode.',
    '',
    'Download Tailscale:',
    `${desktopDownload.label}: ${desktopDownload.url}`,
    `iPhone / iPad (iOS): ${TAILSCALE_IOS_DOWNLOAD_URL}`,
    `Android: ${TAILSCALE_ANDROID_DOWNLOAD_URL}`,
    `All downloads: ${TAILSCALE_DOWNLOAD_URL}`,
  ].join('\n');
}

export function isMissingTailscaleCommandError(error) {
  if (!error || typeof error !== 'object') {
    return false;
  }

  if (error.code === 'ENOENT') {
    return true;
  }

  const message = error instanceof Error ? error.message : String(error);
  return /not found|is not recognized|cannot find/i.test(message);
}

export async function ensureTailscaleInstalled({
  runTailscaleCommand,
  platform = process.platform,
} = {}) {
  try {
    await runTailscaleCommand(['status', '--json'], { captureOutput: true });
  } catch (error) {
    if (isMissingTailscaleCommandError(error)) {
      throw new TailscaleInstallRequiredError({ platform });
    }

    throw error;
  }
}
