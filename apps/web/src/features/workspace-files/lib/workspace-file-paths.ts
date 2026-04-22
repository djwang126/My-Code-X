function normalizeForComparison(path: string) {
  const withSlashes = String(path || '')
    .replace(/^file:\/\//i, '')
    .replace(/^\/([A-Za-z]:)/, '$1')
    .replace(/\\/g, '/');
  const segments = withSlashes.split('/');
  const normalizedSegments: string[] = [];

  for (const segment of segments) {
    if (!segment || segment === '.') {
      continue;
    }

    if (segment === '..') {
      normalizedSegments.pop();
      continue;
    }

    normalizedSegments.push(segment);
  }

  const normalized = normalizedSegments.join('/');
  return /^[A-Za-z]:/.test(normalized) ? normalized[0].toUpperCase() + normalized.slice(1) : normalized;
}

function normalizeComparisonKey(path: string) {
  return /^[A-Za-z]:/.test(path) ? path.toLowerCase() : path;
}

function resolveRelativePathCandidate(path: string) {
  const withSlashes = String(path || '')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '');
  const segments = withSlashes.split('/');
  const normalizedSegments: string[] = [];

  for (const segment of segments) {
    if (!segment || segment === '.') {
      continue;
    }

    if (segment === '..') {
      if (normalizedSegments.length === 0) {
        return null;
      }

      normalizedSegments.pop();
      continue;
    }

    normalizedSegments.push(segment);
  }

  return normalizedSegments.join('/');
}

function isRelativePathCandidate(path: string) {
  if (!path) {
    return false;
  }

  if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(path)) {
    return false;
  }

  if (/^[A-Za-z]:/.test(path)) {
    return false;
  }

  if (/^[A-Za-z]:[\\/]/.test(path)) {
    return false;
  }

  if (/^file:/i.test(path)) {
    return false;
  }

  if (/^\/\//.test(path)) {
    return false;
  }

  return true;
}

function unwrapPathCandidate(rawValue: string) {
  let value = String(rawValue || '').trim();

  while (value.length >= 2) {
    if (
      (value.startsWith('<') && value.endsWith('>')) ||
      (value.startsWith('`') && value.endsWith('`')) ||
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1).trim();
      continue;
    }

    break;
  }

  return value.trim();
}

function buildTrailingTrimCandidates(value: string) {
  const trimmed = value.trim();
  const candidates = [trimmed];
  let current = trimmed;

  while (/[)\].,;:>"'`]+$/.test(current)) {
    current = current.replace(/[)\].,;:>"'`]+$/, '').trimEnd();
    if (!current) {
      break;
    }

    candidates.push(current);
  }

  return candidates;
}

function prioritizeTrailingTrimCandidates(candidates: string[]) {
  if (candidates.length <= 1) {
    return candidates;
  }

  const [original, ...trimmedVariants] = candidates;
  return /[)\].,;:>"'`]+$/.test(original) ? [...trimmedVariants, original] : candidates;
}

function decodePathCandidate(rawValue: string) {
  let value = rawValue;

  for (let index = 0; index < 3; index += 1) {
    try {
      const decoded = decodeURIComponent(value);
      if (decoded === value) {
        break;
      }

      value = decoded;
    } catch {
      break;
    }
  }

  return value;
}

function stripSourceLocationSuffix(path: string) {
  const normalizedPath = String(path || '');
  const lastSeparatorIndex = Math.max(normalizedPath.lastIndexOf('/'), normalizedPath.lastIndexOf('\\'));
  const head = lastSeparatorIndex >= 0 ? normalizedPath.slice(0, lastSeparatorIndex + 1) : '';
  const tail = lastSeparatorIndex >= 0 ? normalizedPath.slice(lastSeparatorIndex + 1) : normalizedPath;
  const strippedTail = tail.replace(/^(.*?):\d+(?::\d+)?$/, '$1');

  return strippedTail && strippedTail !== tail ? `${head}${strippedTail}` : normalizedPath;
}

function extractFileTargetPath(href: string) {
  const candidate = decodePathCandidate(unwrapPathCandidate(href));
  if (!candidate) {
    return null;
  }

  if (/^\/[A-Za-z]:[\\/]/.test(candidate)) {
    return candidate.slice(1);
  }

  if (/^[A-Za-z]:[\\/]/.test(candidate)) {
    return candidate;
  }

  if (/^file:\/\/[A-Za-z]:[\\/]/i.test(candidate)) {
    return candidate.replace(/^file:\/\//i, '');
  }

  if (!/^file:/i.test(candidate)) {
    return null;
  }

  try {
    const url = new URL(candidate);
    if (url.protocol.toLowerCase() !== 'file:') {
      return null;
    }

    const pathname = `${url.host || ''}${url.pathname || ''}`;
    return pathname || null;
  } catch {
    return candidate.replace(/^file:\/\//i, '');
  }
}

export function getParentRelativePath(path: string) {
  const normalized = normalizeRelativePath(path);
  if (!normalized) {
    return '';
  }

  const segments = normalized.split('/');
  segments.pop();
  return segments.join('/');
}

export function normalizeRelativePath(path: string) {
  return normalizeForComparison(path).replace(/^[A-Za-z]:\//, '').replace(/^\/+/, '');
}

export function resolveWorkspaceRelativePathFromFileHref({
  href,
  workspace,
}: {
  href: string;
  workspace: string;
}) {
  const normalizedWorkspace = normalizeForComparison(workspace);
  const workspaceComparisonKey = normalizeComparisonKey(normalizedWorkspace);
  const workspacePrefix = normalizedWorkspace.endsWith('/') ? normalizedWorkspace : `${normalizedWorkspace}/`;
  const workspaceComparisonPrefix = normalizeComparisonKey(workspacePrefix);
  const decodedCandidates = prioritizeTrailingTrimCandidates(
    buildTrailingTrimCandidates(decodePathCandidate(unwrapPathCandidate(href))),
  );

  for (const decodedCandidate of decodedCandidates) {
    const extractedTargetPath = extractFileTargetPath(decodedCandidate);

    if (!extractedTargetPath) {
      if (!isRelativePathCandidate(decodedCandidate)) {
        continue;
      }

      const normalizedRelativePath = resolveRelativePathCandidate(stripSourceLocationSuffix(decodedCandidate));
      if (normalizedRelativePath === null) {
        continue;
      }

      const resolvedWorkspacePath = normalizeForComparison(
        normalizedRelativePath ? `${normalizedWorkspace}/${normalizedRelativePath}` : normalizedWorkspace,
      );
      const resolvedWorkspaceComparisonKey = normalizeComparisonKey(resolvedWorkspacePath);

      if (resolvedWorkspaceComparisonKey === workspaceComparisonKey) {
        return '';
      }

      if (!resolvedWorkspaceComparisonKey.startsWith(workspaceComparisonPrefix)) {
        continue;
      }

      return normalizeRelativePath(resolvedWorkspacePath.slice(workspacePrefix.length));
    }

    const targetPath = normalizeForComparison(stripSourceLocationSuffix(decodePathCandidate(extractedTargetPath)));
    const targetComparisonKey = normalizeComparisonKey(targetPath);

    if (targetComparisonKey === workspaceComparisonKey) {
      return '';
    }

    if (!targetComparisonKey.startsWith(workspaceComparisonPrefix)) {
      continue;
    }

    return normalizeRelativePath(targetPath.slice(workspacePrefix.length));
  }

  return null;
}
