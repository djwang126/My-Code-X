const AUTO_THREAD_NAME_WIDTH_LIMIT = 30;
function isFullWidthCodePoint(codePoint: any) {
    return ((codePoint >= 0x1100 && codePoint <= 0x115f) ||
        codePoint === 0x2329 ||
        codePoint === 0x232a ||
        (codePoint >= 0x2e80 && codePoint <= 0xa4cf && codePoint !== 0x303f) ||
        (codePoint >= 0xac00 && codePoint <= 0xd7a3) ||
        (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
        (codePoint >= 0xfe10 && codePoint <= 0xfe19) ||
        (codePoint >= 0xfe30 && codePoint <= 0xfe6f) ||
        (codePoint >= 0xff00 && codePoint <= 0xff60) ||
        (codePoint >= 0xffe0 && codePoint <= 0xffe6) ||
        (codePoint >= 0x1f300 && codePoint <= 0x1f64f) ||
        (codePoint >= 0x1f900 && codePoint <= 0x1f9ff) ||
        (codePoint >= 0x20000 && codePoint <= 0x3fffd));
}
export function createAutoThreadName(text: any) {
    const normalized = String(text || '').replace(/\s+/g, ' ').trim();
    if (!normalized) {
        return '';
    }
    let width = 0;
    let name = '';
    for (const symbol of normalized) {
        const codePoint = symbol.codePointAt(0);
        if (typeof codePoint !== 'number') {
            continue;
        }
        const symbolWidth = isFullWidthCodePoint(codePoint) ? 2 : 1;
        if (width + symbolWidth > AUTO_THREAD_NAME_WIDTH_LIMIT) {
            return `${name.trimEnd()}…`;
        }
        name += symbol;
        width += symbolWidth;
    }
    return name;
}
