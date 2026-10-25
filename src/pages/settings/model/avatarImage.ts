const acceptedTypes = new Set(['image/png', 'image/jpeg', 'image/webp']);
export async function avatarImage(file: File): Promise<string> {
  if (!acceptedTypes.has(file.type)) throw new Error('Выбери JPG, PNG или WebP');
  if (file.size > 5 * 1024 * 1024) throw new Error('Размер картинки должен быть не больше 5 МБ');
  const image = await decodeAvatar(file);
  try {
    if (image.width * image.height > 25000000)
      throw new Error('Выбери картинку не больше 25 мегапикселей');
    return renderAvatar(image);
  } finally {
    image.close();
  }
}
function renderAvatar(image: ImageBitmap): string {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Браузер не смог обработать картинку');
  const size = Math.min(image.width, image.height);
  context.scale(256 / size, 256 / size);
  context.drawImage(image, (size - image.width) / 2, (size - image.height) / 2);
  return encodeAvatar(canvas);
}
function encodeAvatar(canvas: HTMLCanvasElement): string {
  const result = canvas.toDataURL('image/webp', 0.85);
  if (!result.startsWith('data:image/webp;') || result.length > 200000)
    throw new Error('Не удалось подготовить аватар. Выбери другую картинку');
  return result;
}

async function decodeAvatar(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file);
  } catch {
    throw new Error('Не удалось прочитать картинку. Выбери другой файл');
  }
}
