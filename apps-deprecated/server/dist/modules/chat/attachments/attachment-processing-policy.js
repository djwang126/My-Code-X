export const ATTACHMENT_NORMALIZATION_MODE_CANONICAL = 'canonical';
export const ATTACHMENT_NORMALIZATION_MODE_PRESERVE_ORIGINAL = 'preserve_original';
export function getAttachmentNormalizationMode({ shouldNormalize }) {
    return shouldNormalize ? ATTACHMENT_NORMALIZATION_MODE_CANONICAL : ATTACHMENT_NORMALIZATION_MODE_PRESERVE_ORIGINAL;
}
export function getAttachmentEncodeQuality({ hasTransparency, stage }) {
    if (stage === 'retry') {
        return hasTransparency ? 88 : 80;
    }
    return hasTransparency ? 92 : 85;
}
//# sourceMappingURL=attachment-processing-policy.js.map