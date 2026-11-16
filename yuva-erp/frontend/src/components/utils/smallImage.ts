// A picture chosen by the person (a photo of a card, taken with a phone: several MB) is made small before it is sent: at most 1400 pixels on the long
// side, as a JPEG, made smaller until it is about 300 KB. Returns the picture as a data address.

const MAX_SIDE = 1400;
const MAX_CHARS = 420_000;

export async function smallImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') throw new Error('Please choose a picture (JPG, PNG or WebP).');
  if (file.size > 15 * 1024 * 1024) throw new Error('The picture is too big (more than 15 MB). Please choose a smaller one.');
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error('This picture could not be opened. Please choose another one.');
  });
  let scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  for (let attempt = 0; attempt < 6; attempt++) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('This picture could not be made smaller.');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const url = canvas.toDataURL('image/jpeg', attempt < 2 ? 0.82 : 0.65);
    if (url.length <= MAX_CHARS) return url;
    scale *= 0.75;
  }
  throw new Error('The picture is still too big. Please choose a smaller one.');
}
