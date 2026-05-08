import fs from 'node:fs/promises';
import path from 'node:path';
const contentTypes = new Map([
    ['.html', 'text/html; charset=utf-8'],
    ['.js', 'text/javascript; charset=utf-8'],
    ['.css', 'text/css; charset=utf-8'],
    ['.ico', 'image/x-icon'],
    ['.png', 'image/png'],
    ['.svg', 'image/svg+xml; charset=utf-8'],
    ['.webmanifest', 'application/manifest+json; charset=utf-8'],
]);
function resolveCacheControl(frontendDistDir, absolutePath) {
    const relative = path.relative(frontendDistDir, absolutePath).split(path.sep).join('/');
    const filename = path.basename(absolutePath).toLowerCase();
    const hasHashedFilename = /-[a-z0-9_-]{8,}\./i.test(filename);
    if (filename === 'index.html') {
        return 'no-cache';
    }
    if (filename === 'manifest.webmanifest') {
        return 'public, max-age=3600';
    }
    if (filename === 'sw.js' || filename === 'service-worker.js' || filename === 'registersw.js') {
        return 'no-cache';
    }
    if (relative.startsWith('assets/') || hasHashedFilename) {
        return 'public, max-age=31536000, immutable';
    }
    return 'public, max-age=3600';
}
export async function tryServeStaticApp(response, frontendDistDir, pathname) {
    const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const normalized = path.posix.normalize(relative);
    if (normalized.startsWith('..'))
        return false;
    const absolutePath = path.resolve(frontendDistDir, normalized.split('/').join(path.sep));
    const rootRelative = path.relative(frontendDistDir, absolutePath);
    if (rootRelative.startsWith('..') || path.isAbsolute(rootRelative))
        return false;
    try {
        const stat = await fs.stat(absolutePath);
        if (!stat.isFile())
            return false;
    }
    catch {
        return false;
    }
    const body = await fs.readFile(absolutePath);
    const ext = path.extname(absolutePath).toLowerCase();
    response.writeHead(200, {
        'Content-Type': contentTypes.get(ext) || 'application/octet-stream',
        'Cache-Control': resolveCacheControl(frontendDistDir, absolutePath),
    });
    response.end(body);
    return true;
}
//# sourceMappingURL=static-app.js.map