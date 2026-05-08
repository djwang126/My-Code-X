import type { AppResponse } from '../../common/http/http-types.js';

export function handleHealthRoute(
  response: AppResponse,
  { authRequired, serverInstanceId }: { authRequired: boolean; serverInstanceId: string },
) {
  response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify({ ok: true, authRequired, target: 'next', serverInstanceId }));
}
