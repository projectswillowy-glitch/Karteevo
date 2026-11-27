/**
 * Serverless hosts (Vercel) reject request bodies above ~4.5 MB with a 413
 * before the request reaches the API, so uploads must stay well below that.
 */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

/**
 * Compresses an image file on the client side before uploading.
 * @param file The original image file
 * @param maxWidth Maximum width of the compressed image
 * @param maxHeight Maximum height of the compressed image
 * @param quality Quality of the compression (0.0 to 1.0)
 * @returns A promise that resolves to the compressed File object
 */
export async function compressImage(
  file: File,
  maxWidth: number = 1200,
  maxHeight: number = 1200,
  quality: number = 0.7
): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Calculate new dimensions
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error('Failed to get canvas context'));
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              return reject(new Error('Canvas to Blob failed'));
            }
            // The blob is always JPEG, so the extension must match it: the
            // backend derives the upload mime type from the file name.
            const jpgName = `${file.name.replace(/\.[^./\\]+$/, '') || 'image'}.jpg`;
            const compressedFile = new File([blob], jpgName, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
}

/**
 * Shrinks an image until it fits within the host's request-body limit.
 * Throws a user-facing error when even the hardest compression is too big.
 */
export async function prepareUploadImage(
  file: File,
  maxWidth: number = 1920,
  maxHeight: number = 1920,
  quality: number = 0.82
): Promise<File> {
  const attempts: Array<[number, number, number]> = [
    [maxWidth, maxHeight, quality],
    [1600, 1600, 0.75],
    [1200, 1200, 0.65],
  ];

  let lastError: unknown = null;
  for (const [width, height, q] of attempts) {
    try {
      const compressed = await compressImage(file, width, height, q);
      if (compressed.size <= MAX_UPLOAD_BYTES) return compressed;
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) {
    throw new Error('Could not process this image. Please try a JPG or PNG file.');
  }
  throw new Error('Image is too large to upload. Please choose a smaller image.');
}
