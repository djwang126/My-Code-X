export function handleHealthRoute(response, { authRequired, serverInstanceId }) {
    response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ ok: true, authRequired, target: 'next', serverInstanceId }));
}
//# sourceMappingURL=health.controller.js.map