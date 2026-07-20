import { PhotoPayload } from './types';

const MAX_DIMENSION = 1024;
const JPEG_QUALITY = 0.8;

/**
 * Resizes an image file down to at most MAX_DIMENSION on its longest side
 * and re-encodes it as JPEG, returning base64 data (no data: URI prefix)
 * ready to send to a vision-capable model. Keeping this small matters:
 * image tokens cost far more than text, and a raw phone photo can be
 * several MB - resizing here bounds both payload size and API cost.
 */
export function resizeImageToPhotoPayload(file: File): Promise<PhotoPayload> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      try {
        let { width, height } = img;
        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          if (width >= height) {
            height = Math.round((height / width) * MAX_DIMENSION);
            width = MAX_DIMENSION;
          } else {
            width = Math.round((width / height) * MAX_DIMENSION);
            height = MAX_DIMENSION;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context for image resize.'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
        const base64 = dataUrl.split(',')[1] ?? '';
        resolve({ data: base64, mime_type: 'image/jpeg' });
      } catch (err) {
        reject(err);
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Could not load image for resizing.'));
    };

    img.src = objectUrl;
  });
}
