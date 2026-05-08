export function readSessionStorageValue(key: string) {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export function persistSessionStorageValue(key: string, value: string) {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // Storage can be unavailable on some clients; continue with ephemeral state.
  }
}

export function clearSessionStorageValue(key: string) {
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Ignore sessionStorage failures and continue with in-memory state.
  }
}

export function readLocalStorageValue(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function persistLocalStorageValue(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore localStorage failures and continue with in-memory state.
  }
}

export function clearLocalStorageValue(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore localStorage failures and continue.
  }
}
