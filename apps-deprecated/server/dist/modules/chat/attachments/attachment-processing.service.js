import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHttpError } from '../../../common/errors/http-error.js';
import { MAX_ATTACHMENT_BYTES, MAX_DECODED_PIXELS, MAX_LONGEST_EDGE } from './attachment-limits.js';
import { getAttachmentNormalizationMode } from './attachment-processing-policy.js';
function getNormalizedDimensions(metadata) {
    const width = Number(metadata?.width || 0);
    const height = Number(metadata?.height || 0);
    const orientation = Number(metadata?.orientation || 1);
    const rotated = orientation >= 5 && orientation <= 8;
    return rotated ? { width: height, height: width } : { width, height };
}
function scaleDimensions(dimensions) {
    const longestEdge = Math.max(dimensions.width, dimensions.height);
    if (!longestEdge) {
        return { width: dimensions.width, height: dimensions.height, longestEdge: 0 };
    }
    if (longestEdge <= MAX_LONGEST_EDGE) {
        return { ...dimensions, longestEdge };
    }
    const scale = MAX_LONGEST_EDGE / longestEdge;
    return {
        width: Math.max(1, Math.round(dimensions.width * scale)),
        height: Math.max(1, Math.round(dimensions.height * scale)),
        longestEdge: MAX_LONGEST_EDGE,
    };
}
function extensionFromContentType(contentType) {
    switch (contentType) {
        case 'image/jpeg':
            return '.jpg';
        case 'image/png':
            return '.png';
        case 'image/webp':
            return '.webp';
        case 'image/gif':
            return '.gif';
        default:
            return '.bin';
    }
}
function toInteger(value) {
    return Number.isFinite(Number(value)) ? Number(value) : 0;
}
function readPixelCount(metadata) {
    return toInteger(metadata?.width) * toInteger(metadata?.height);
}
function inspectImageError(error) {
    if (error?.statusCode) {
        return error;
    }
    return createHttpError('invalid_image_payload', 400, 'invalid_image_payload');
}
function processingError(error) {
    if (error?.statusCode) {
        return error;
    }
    return createHttpError('attachment_processing_failed', 422, 'attachment_processing_failed');
}
function resolveErrorReason(error) {
    if (typeof error?.code === 'string' && error.code.trim()) {
        return error.code;
    }
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return String(error);
}
async function inspectImageMetadata({ imageAdapter, sourcePath }) {
    try {
        return await imageAdapter.inspect(sourcePath);
    }
    catch (error) {
        throw inspectImageError(error);
    }
}
function assertImageWithinSafetyLimits(metadata) {
    const width = toInteger(metadata?.width);
    const height = toInteger(metadata?.height);
    if (!width || !height) {
        throw createHttpError('invalid_image_payload', 400, 'invalid_image_payload');
    }
    if (readPixelCount(metadata) > MAX_DECODED_PIXELS) {
        throw createHttpError('attachment_pixel_limit_exceeded', 413, 'attachment_pixel_limit_exceeded');
    }
}
export function createAttachmentProcessingService({ outputRoot, imageAdapter, logger, randomId = () => `att-${Date.now()}`, }) {
    async function processAttachment({ sourcePath, originalFilename, contentType }) {
        const attachmentId = randomId();
        let metadata;
        try {
            metadata = await inspectImageMetadata({ imageAdapter, sourcePath });
        }
        catch (error) {
            logger?.warn?.({
                event: 'attachment_processing_failed',
                stage: 'inspect',
                attachmentId,
                originalFilename,
                contentType,
                reason: resolveErrorReason(error),
            });
            throw error;
        }
        assertImageWithinSafetyLimits(metadata);
        const orientedDimensions = getNormalizedDimensions(metadata);
        const targetDimensions = scaleDimensions(orientedDimensions);
        const shouldNormalize = (metadata?.byteLength || 0) > MAX_ATTACHMENT_BYTES ||
            targetDimensions.longestEdge === MAX_LONGEST_EDGE ||
            Number(metadata?.orientation || 1) !== 1;
        const normalizationMode = getAttachmentNormalizationMode({ shouldNormalize });
        logger?.info?.({
            event: 'attachment_processing_decided',
            attachmentId,
            originalFilename,
            sourceContentType: contentType,
            byteLengthBefore: metadata?.byteLength || 0,
            widthBefore: orientedDimensions.width,
            heightBefore: orientedDimensions.height,
            targetWidth: targetDimensions.width,
            targetHeight: targetDimensions.height,
            hasTransparency: Boolean(metadata?.hasTransparency),
            shouldNormalize,
            normalizationMode,
        });
        let firstPass;
        try {
            firstPass = await imageAdapter.normalizeAndEncode({
                attachmentId,
                sourcePath,
                contentType,
                hasTransparency: Boolean(metadata?.hasTransparency),
                targetWidth: targetDimensions.width,
                targetHeight: targetDimensions.height,
                shouldNormalize,
                maxByteLength: MAX_ATTACHMENT_BYTES,
            });
        }
        catch (error) {
            logger?.warn?.({
                event: 'attachment_processing_failed',
                stage: 'normalize',
                attachmentId,
                originalFilename,
                contentType,
                reason: resolveErrorReason(error),
            });
            throw processingError(error);
        }
        let finalPass = firstPass;
        if (firstPass.byteLength > MAX_ATTACHMENT_BYTES) {
            try {
                finalPass = await imageAdapter.reencodeWithinLimit({
                    attachmentId,
                    sourcePath,
                    contentType: firstPass.contentType,
                    targetWidth: targetDimensions.width,
                    targetHeight: targetDimensions.height,
                    hasTransparency: Boolean(metadata?.hasTransparency),
                    maxByteLength: MAX_ATTACHMENT_BYTES,
                });
            }
            catch (error) {
                logger?.warn?.({
                    event: 'attachment_processing_failed',
                    stage: 'reencode',
                    attachmentId,
                    originalFilename,
                    contentType: firstPass.contentType,
                    reason: resolveErrorReason(error),
                });
                throw processingError(error);
            }
        }
        if (finalPass.byteLength > MAX_ATTACHMENT_BYTES) {
            throw createHttpError('attachment_too_large_after_compression', 413, 'attachment_too_large_after_compression');
        }
        await mkdir(outputRoot, { recursive: true });
        const savedPath = path.join(outputRoot, `${attachmentId}${extensionFromContentType(finalPass.contentType)}`);
        try {
            await writeFile(savedPath, finalPass.outputBuffer);
        }
        catch (error) {
            logger?.warn?.({
                event: 'attachment_processing_failed',
                stage: 'persist',
                attachmentId,
                originalFilename,
                contentType: finalPass.contentType,
                reason: resolveErrorReason(error),
            });
            throw error;
        }
        const result = {
            attachmentId,
            savedPath,
            contentType: finalPass.contentType,
            width: finalPass.width || targetDimensions.width,
            height: finalPass.height || targetDimensions.height,
            longestEdge: Math.max(finalPass.width || targetDimensions.width, finalPass.height || targetDimensions.height),
            byteLength: finalPass.byteLength,
            codec: finalPass.codec,
            quality: finalPass.quality,
            metadataStripped: finalPass.metadataStripped,
            normalizationMode,
        };
        logger?.info?.({
            event: 'attachment_processed',
            attachmentId,
            originalFilename,
            savedPath,
            contentType: result.contentType,
            width: result.width,
            height: result.height,
            longestEdge: result.longestEdge,
            byteLengthBefore: metadata?.byteLength || 0,
            byteLengthAfter: result.byteLength,
            codec: result.codec,
            quality: result.quality,
            metadataStripped: result.metadataStripped,
            normalizationMode: result.normalizationMode,
            savingsBytes: Math.max(0, (metadata?.byteLength || 0) - result.byteLength),
        });
        return result;
    }
    return {
        processAttachment,
    };
}
//# sourceMappingURL=attachment-processing.service.js.map