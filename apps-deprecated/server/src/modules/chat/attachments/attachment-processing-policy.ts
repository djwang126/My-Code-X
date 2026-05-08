export const ATTACHMENT_NORMALIZATION_MODE_CANONICAL = 'canonical';
export const ATTACHMENT_NORMALIZATION_MODE_PRESERVE_ORIGINAL = 'preserve_original';
export function getAttachmentNormalizationMode({ shouldNormalize }: any) {
    return shouldNormalize ? ATTACHMENT_NORMALIZATION_MODE_CANONICAL : ATTACHMENT_NORMALIZATION_MODE_PRESERVE_ORIGINAL;
}
export function getAttachmentEncodeQuality({ hasTransparency, stage }: any) {
    if (stage === 'retry') {
        return hasTransparency ? 88 : 80;
    }
    return hasTransparency ? 92 : 85;
}
