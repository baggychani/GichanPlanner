const MAX_IMAGE_EDGE = 1600;
const IMAGE_QUALITY = 0.84;

export async function compressImage(file: File): Promise<Blob> {
  const image = await createImageBitmap(file);
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')?.drawImage(image, 0, 0, width, height);
  image.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('이미지를 압축하지 못했습니다.')), 'image/webp', IMAGE_QUALITY);
  });
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl);
  return response.blob();
}

export function attachmentBlob(task: { image_blob?: Blob | null; image_data?: string | null }) {
  return task.image_blob ?? null;
}

export async function migrateLegacyTaskImages() {
  const legacyTasks = (await db.tasks.toArray()).filter(task => !task.image_blob && task.image_data);
  if (legacyTasks.length === 0) return;
  const now = new Date().toISOString();
  await db.tasks.bulkPut(await Promise.all(legacyTasks.map(async task => ({
    ...task,
    image_blob: await dataUrlToBlob(task.image_data!),
    image_data: null,
    updated_at: now,
    version: task.version + 1,
  }))));
}
import { db } from './db';
