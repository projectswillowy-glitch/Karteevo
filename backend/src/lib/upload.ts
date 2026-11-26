import cloudinary from './cloudinary.js';
import fs from 'fs';
import path from 'path';

const CLOUDINARY_FOLDER = process.env.CLOUDINARY_FOLDER || 'karteevo';

const getMimeType = (filename: string): string => {
    const ext = path.extname(filename).toLowerCase();
    switch (ext) {
        case '.png':
            return 'image/png';
        case '.webp':
            return 'image/webp';
        case '.gif':
            return 'image/gif';
        case '.svg':
            return 'image/svg+xml';
        case '.jpg':
        case '.jpeg':
        default:
            return 'image/jpeg';
    }
};

const hasCloudinaryCredentials = () => Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
);

// Cloudinary is the image CDN. Uploads go there whenever the account
// credentials are present; set ENABLE_CLOUDINARY=false to keep everything as
// inline data URLs (a bare local setup with no Cloudinary account).
export const isCloudinaryEnabled = () =>
    process.env.ENABLE_CLOUDINARY !== 'false' && hasCloudinaryCredentials();

export const uploadToCloudinary = async (fileBuffer: Buffer, originalName: string) => {
    const dataUri = `data:${getMimeType(originalName)};base64,${fileBuffer.toString('base64')}`;

    if (isCloudinaryEnabled()) {
        try {
            const uploadResult = await cloudinary.uploader.upload(dataUri, {
                folder: CLOUDINARY_FOLDER,
                resource_type: 'auto',
            });
            if (uploadResult?.secure_url) {
                return uploadResult.secure_url;
            }
        } catch (error: any) {
            console.warn('Cloudinary upload failed, falling back to a data URL:', error?.message || error);
        }
    }

    return dataUri;
};

/* ------------------------------------------------------------------ */
/* Cloudinary delivery helpers                                        */
/* ------------------------------------------------------------------ */

const TRANSFORM_KEY = /^(f|q|w|h|c|ar|dpr|g|e|b|r|o|z|x|y|a|fl|if|dn|du|dl|vc|ac|br|co|l)_/;

// A delivery segment such as "f_auto,q_auto,w_1200,c_limit".
const isTransformSegment = (segment: string) =>
    segment.length > 0 &&
    segment.split(',').every(part => TRANSFORM_KEY.test(part));

const splitCloudinaryPath = (url: string): { prefix: string; segments: string[] } | null => {
    const marker = '/image/upload/';
    const base = url.split('?')[0];
    const index = base.indexOf(marker);
    if (index === -1) return null;

    const segments = base.slice(index + marker.length).split('/').filter(Boolean);
    if (segments.length === 0) return null;

    return { prefix: base.slice(0, index + marker.length), segments };
};

// Adds Cloudinary's delivery transforms so the CDN serves WebP/AVIF at the
// requested width instead of the original upload. Non-Cloudinary URLs (data
// URLs, other hosts) are returned untouched.
export const optimizeImageUrl = (url: string | null | undefined, width = 1200): string | null | undefined => {
    if (!url) return url;

    const parsed = splitCloudinaryPath(url);
    if (!parsed || isTransformSegment(parsed.segments[0])) return url;

    return `${parsed.prefix}f_auto,q_auto,w_${width},c_limit/${parsed.segments.join('/')}`;
};

// Public id including the folder, so a delete hits the asset that was actually
// uploaded (uploads go to CLOUDINARY_FOLDER, not to a hard-coded folder).
export const cloudinaryPublicId = (url?: string | null): string | null => {
    if (!url) return null;

    const parsed = splitCloudinaryPath(url);
    if (!parsed) return null;

    const segments = parsed.segments.filter(
        segment => !isTransformSegment(segment) && !/^v\d+$/.test(segment)
    );
    const publicId = segments.join('/').replace(/\.[a-zA-Z0-9]+$/, '');

    return publicId || null;
};

export const deleteCloudinaryImage = async (url?: string | null) => {
    const publicId = cloudinaryPublicId(url);
    if (!publicId || !hasCloudinaryCredentials()) return;

    try {
        await cloudinary.uploader.destroy(publicId);
    } catch (error: any) {
        console.warn('Cloudinary delete failed (non-fatal):', error?.message || error);
    }
};

export const safeDeleteImage = async (imageUrl?: string | null) => {
    if (!imageUrl) return;
    try {
        if (imageUrl.startsWith('data:')) {
            return;
        }
        if (imageUrl.includes('/uploads/')) {
            const fileName = imageUrl.split('/uploads/').pop();
            if (fileName) {
                const filePath = path.join(process.cwd(), 'uploads', fileName);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }
        } else if (imageUrl.includes('res.cloudinary.com')) {
            await deleteCloudinaryImage(imageUrl);
        }
    } catch (err) {
        console.warn('safeDeleteImage non-fatal warning:', err);
    }
};
