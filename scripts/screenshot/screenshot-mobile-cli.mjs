import path from 'node:path';
import { isAbsoluteUserPath } from '@my-code-x/utils/my-code-x-user-env';

export function parseArgs(argv, { repoRoot, defaultOutputPath }) {
  const options = {
    url: 'http://127.0.0.1:4410',
    path: '/',
    output: defaultOutputPath,
    width: 390,
    height: 844,
    scale: 2,
    timeoutMs: 15_000,
    settleMs: 300,
    waitFor: [],
    clickLabels: [],
    clickSelectors: [],
    sessionStorageEntries: [],
    localStorageEntries: [],
    captureSelector: '',
    fullPage: false,
    headed: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const nextValue = argv[index + 1];

    if (arg === '--url' && nextValue) {
      options.url = nextValue;
      index += 1;
      continue;
    }

    if (arg === '--path' && nextValue) {
      options.path = nextValue;
      index += 1;
      continue;
    }

    if (arg === '--output' && nextValue) {
      options.output = isAbsoluteUserPath(nextValue) ? nextValue : path.join(repoRoot, nextValue);
      index += 1;
      continue;
    }

    if (arg === '--width' && nextValue) {
      options.width = Number.parseInt(nextValue, 10) || options.width;
      index += 1;
      continue;
    }

    if (arg === '--height' && nextValue) {
      options.height = Number.parseInt(nextValue, 10) || options.height;
      index += 1;
      continue;
    }

    if (arg === '--scale' && nextValue) {
      options.scale = Number.parseFloat(nextValue) || options.scale;
      index += 1;
      continue;
    }

    if (arg === '--timeout' && nextValue) {
      options.timeoutMs = Number.parseInt(nextValue, 10) || options.timeoutMs;
      index += 1;
      continue;
    }

    if (arg === '--settle-ms' && nextValue) {
      options.settleMs = Number.parseInt(nextValue, 10) || options.settleMs;
      index += 1;
      continue;
    }

    if (arg === '--wait-for' && nextValue) {
      options.waitFor.push(nextValue);
      index += 1;
      continue;
    }

    if (arg === '--click-label' && nextValue) {
      options.clickLabels.push(nextValue);
      index += 1;
      continue;
    }

    if (arg === '--click-selector' && nextValue) {
      options.clickSelectors.push(nextValue);
      index += 1;
      continue;
    }

    if (arg === '--session-storage' && nextValue) {
      options.sessionStorageEntries.push(parseStorageEntry(nextValue, 'sessionStorage'));
      index += 1;
      continue;
    }

    if (arg === '--local-storage' && nextValue) {
      options.localStorageEntries.push(parseStorageEntry(nextValue, 'localStorage'));
      index += 1;
      continue;
    }

    if (arg === '--capture-selector' && nextValue) {
      options.captureSelector = nextValue;
      index += 1;
      continue;
    }

    if (arg === '--full-page') {
      options.fullPage = true;
      continue;
    }

    if (arg === '--headed') {
      options.headed = true;
      continue;
    }

    throw new Error(`Unknown or incomplete argument: ${arg}`);
  }

  return options;
}

function parseStorageEntry(value, storageName) {
  const separatorIndex = String(value).indexOf('=');
  if (separatorIndex <= 0) {
    throw new Error(`Invalid ${storageName} entry: ${value}. Expected key=value.`);
  }

  return {
    key: value.slice(0, separatorIndex),
    value: value.slice(separatorIndex + 1),
  };
}

function ensureTrailingSlash(value) {
  return value.endsWith('/') ? value : `${value}/`;
}

export function getHealthUrl(baseUrl) {
  return new URL('/api/health', ensureTrailingSlash(baseUrl)).toString();
}

export function buildPageUrl(baseUrl, routePath) {
  return new URL(routePath.replace(/^\/*/, ''), ensureTrailingSlash(baseUrl)).toString();
}
