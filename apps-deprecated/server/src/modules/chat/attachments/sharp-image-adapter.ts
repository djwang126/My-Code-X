import sharp from 'sharp';
import { getAttachmentEncodeQuality } from './attachment-processing-policy.js';
function codecFromContentType(contentType: any) {
    switch (contentType) {
        case 'image/png':
            return 'png';
        case 'image/webp':
            return 'webp';
        case 'image/gif':
            return 'gif';
        case 'image/jpeg':
        default:
            return 'jpeg';
    }
}
function buildOriginalFormatPipeline({ pipeline, contentType }: any) {
    switch (contentType) {
        case 'image/png':
            return pipeline.png();
        case 'image/webp':
            return pipeline.webp({ quality: 100 });
        case 'image/gif':
            return pipeline.gif();
        case 'image/jpeg':
        default:
            return pipeline.jpeg({ quality: 100, mozjpeg: false });
    }
}
async function preserveOriginalImage({ sourcePath, contentType, targetWidth, targetHeight }: any) {
    let pipeline = sharp(sourcePath, { animated: false }).rotate();
    if (targetWidth > 0 && targetHeight > 0) {
        pipeline = pipeline.resize(targetWidth, targetHeight, {
            fit: 'inside',
            withoutEnlargement: true,
        });
    }
    const { data, info } = await buildOriginalFormatPipeline({ pipeline, contentType }).toBuffer({
        resolveWithObject: true,
    });
    return {
        outputBuffer: data,
        contentType,
        width: info.width || targetWidth,
        height: info.height || targetHeight,
        byteLength: info.size,
        codec: codecFromContentType(contentType),
        quality: null,
        metadataStripped: true,
    };
}
async function encodeWithSharp({ sourcePath, hasTransparency, targetWidth, targetHeight, quality }: any) {
    let pipeline = sharp(sourcePath, { animated: false }).rotate();
    if (targetWidth > 0 && targetHeight > 0) {
        pipeline = pipeline.resize(targetWidth, targetHeight, {
            fit: 'inside',
            withoutEnlargement: true,
        });
    }
    if (hasTransparency) {
        const { data, info } = await pipeline.webp({ quality }).toBuffer({ resolveWithObject: true });
        return {
            outputBuffer: data,
            contentType: 'image/webp',
            width: info.width,
            height: info.height,
            byteLength: info.size,
            codec: 'webp',
            quality,
            metadataStripped: true,
        };
    }
    const { data, info } = await pipeline.jpeg({ quality, mozjpeg: true }).toBuffer({ resolveWithObject: true });
    return {
        outputBuffer: data,
        contentType: 'image/jpeg',
        width: info.width,
        height: info.height,
        byteLength: info.size,
        codec: 'jpeg',
        quality,
        metadataStripped: true,
    };
}
export function createSharpImageAdapter() {
    return {
        async inspect(filePath: any) {
            const image = sharp(filePath, { animated: false });
            const metadata = await image.metadata();
            return {
                width: metadata.width || 0,
                height: metadata.height || 0,
                hasTransparency: Boolean(metadata.hasAlpha),
                orientation: metadata.orientation || 1,
                byteLength: metadata.size || 0,
            };
        },
        async normalizeAndEncode(input: any) {
            if (input.shouldNormalize === false) {
                return preserveOriginalImage({
                    sourcePath: input.sourcePath,
                    contentType: input.contentType,
                    targetWidth: input.targetWidth,
                    targetHeight: input.targetHeight,
                });
            }
            return encodeWithSharp({
                ...input,
                quality: getAttachmentEncodeQuality({ hasTransparency: input.hasTransparency, stage: 'initial' }),
            });
        },
        async reencodeWithinLimit(input: any) {
            return encodeWithSharp({
                ...input,
                quality: getAttachmentEncodeQuality({ hasTransparency: input.hasTransparency, stage: 'retry' }),
            });
        },
    };
}
