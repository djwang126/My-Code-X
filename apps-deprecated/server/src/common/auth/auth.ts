import type { AppRequest } from '../http/http-types.js';

export function isAuthorized(request: AppRequest, authToken: string) {
  if (!authToken) return true;
  const header = String(request.headers.authorization || '');
  return header === `Bearer ${authToken}`;
}
