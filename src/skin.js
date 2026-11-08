// Player skins for browser multiplayer accounts. 1.7.10 reads a 64 x 32 skin
// (ImageBufferDownload.parseUserSkin): the image is drawn into a 64 x 32 buffer,
// the base head and body/limb areas are forced opaque, and the hat area is kept
// only if it already has a transparent pixel; otherwise all of it is cleared.
// Modern 64 x 64 skins keep the same layout in their top half, so cropping them
// gives the skin 1.7.10 would draw (left limbs mirror the right ones).

export const SKIN_WIDTH = 64, SKIN_HEIGHT = 32;
export const MAX_SKIN_BYTES = 16384;
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

// Width and height from a PNG's IHDR, or null when the bytes are not a PNG.
export function pngSize(bytes) {
  if (!bytes || bytes.length < 33 || PNG_SIGNATURE.some((b, i) => bytes[i] !== b)) return null;
  const u32 = (o) => ((bytes[o] << 24) | (bytes[o + 1] << 16) | (bytes[o + 2] << 8) | bytes[o + 3]) >>> 0;
  if (u32(8) !== 13 || String.fromCharCode(...bytes.slice(12, 16)) !== "IHDR") return null;
  return { width: u32(16), height: u32(20) };
}
export const acceptedSkinSize = (width, height) => width === 64 && (height === 32 || height === 64);

// ImageBufferDownload.setAreaOpaque / setAreaTransparent on RGBA bytes, in place.
function opaque(px, x1, y1, x2, y2) {
  for (let y = y1; y < y2; y++) for (let x = x1; x < x2; x++) px[(y * SKIN_WIDTH + x) * 4 + 3] = 255;
}
function transparent(px, x1, y1, x2, y2) {
  for (let y = y1; y < y2; y++) for (let x = x1; x < x2; x++) if (px[(y * SKIN_WIDTH + x) * 4 + 3] < 128) return;
  for (let y = y1; y < y2; y++) for (let x = x1; x < x2; x++) px[(y * SKIN_WIDTH + x) * 4 + 3] = 0;
}
// `rgba`: 64 x height source pixels. Returns new 64 x 32 RGBA bytes.
export function normalizeSkinPixels(rgba, height) {
  if (!acceptedSkinSize(SKIN_WIDTH, height) || rgba.length !== SKIN_WIDTH * height * 4) throw new Error("A skin must be 64 × 32 or 64 × 64 pixels.");
  const px = new Uint8ClampedArray(rgba.subarray(0, SKIN_WIDTH * SKIN_HEIGHT * 4));
  opaque(px, 0, 0, 32, 16);
  transparent(px, 32, 0, 64, 32);
  opaque(px, 0, 16, 64, 32);
  return px;
}

// Front and back "paper doll" views, each 16 x 32 skin pixels, 4 apart:
// [source x, y, w, h, destination x, y, mirrored]. The left arm and leg reuse
// the right limb's region mirrored, as ModelBiped's mirror flag does.
export const PREVIEW_WIDTH = 36, PREVIEW_HEIGHT = 32;
export const PREVIEW_PARTS = [
  // front
  [8, 8, 8, 8, 4, 0], [20, 20, 8, 12, 4, 8], [44, 20, 4, 12, 0, 8], [44, 20, 4, 12, 12, 8, true],
  [4, 20, 4, 12, 4, 20], [4, 20, 4, 12, 8, 20, true], [40, 8, 8, 8, 4, 0],
  // back
  [24, 8, 8, 8, 24, 0], [32, 20, 8, 12, 24, 8], [52, 20, 4, 12, 32, 8], [52, 20, 4, 12, 20, 8, true],
  [12, 20, 4, 12, 28, 20], [12, 20, 4, 12, 24, 20, true], [56, 8, 8, 8, 24, 0],
];
export function drawSkinPreview(ctx, skin) {
  ctx.clearRect(0, 0, PREVIEW_WIDTH, PREVIEW_HEIGHT);
  ctx.imageSmoothingEnabled = false;
  for (const [sx, sy, w, h, dx, dy, mirror] of PREVIEW_PARTS) {
    if (!mirror) { ctx.drawImage(skin, sx, sy, w, h, dx, dy, w, h); continue; }
    ctx.save(); ctx.translate(dx + w, dy); ctx.scale(-1, 1);
    ctx.drawImage(skin, sx, sy, w, h, 0, 0, w, h);
    ctx.restore();
  }
}

// Browser only: decode an untrusted image file or PNG blob into a normalized
// 64 x 32 canvas. Rejects other sizes instead of guessing at a scale.
export async function skinCanvas(blob) {
  let bitmap;
  try { bitmap = await createImageBitmap(blob); }
  catch { throw new Error("That file is not a readable PNG image."); }
  try {
    if (!acceptedSkinSize(bitmap.width, bitmap.height)) throw new Error(`A skin must be 64 × 32 or 64 × 64 pixels (this is ${bitmap.width} × ${bitmap.height}).`);
    const source = document.createElement("canvas");
    source.width = bitmap.width; source.height = bitmap.height;
    const sc = source.getContext("2d", { willReadFrequently: true });
    sc.drawImage(bitmap, 0, 0);
    const px = normalizeSkinPixels(sc.getImageData(0, 0, bitmap.width, bitmap.height).data, bitmap.height);
    const out = document.createElement("canvas");
    out.width = SKIN_WIDTH; out.height = SKIN_HEIGHT;
    out.getContext("2d").putImageData(new ImageData(px, SKIN_WIDTH, SKIN_HEIGHT), 0, 0);
    return out;
  } finally { bitmap.close?.(); }
}
export const canvasPng = (canvas) => new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not encode the skin."))), "image/png"));
