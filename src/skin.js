// Player skins for browser multiplayer accounts. 1.7.10 reads a 64 x 32 skin
// (ImageBufferDownload.parseUserSkin): the image is drawn into a 64 x 32 buffer,
// the base head and body/limb areas are forced opaque, and the hat area is kept
// only if it already has a transparent pixel; otherwise all of it is cleared.
// Modern 64 x 64 skins keep the same layout in their top half, so cropping them
// gives the skin 1.7.10 would draw (left limbs mirror the right ones).

import { decodePng } from "./png-decode.js";

export const SKIN_WIDTH = 64, SKIN_HEIGHT = 32;
export const MAX_SKIN_BYTES = 16384;
// b71 mpcapes: an uploaded cape is a plain 64 x 32 PNG (the layout AbstractClientPlayer.locationCape is drawn from); the same size limit as skins.
export const CAPE_WIDTH = 64, CAPE_HEIGHT = 32, MAX_CAPE_BYTES = 16384;
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

// Width and height from a PNG's IHDR, or null when the bytes are not a PNG.
export function pngSize(bytes) {
  if (!bytes || bytes.length < 33 || PNG_SIGNATURE.some((b, i) => bytes[i] !== b)) return null;
  const u32 = (o) => ((bytes[o] << 24) | (bytes[o + 1] << 16) | (bytes[o + 2] << 8) | bytes[o + 3]) >>> 0;
  if (u32(8) !== 13 || String.fromCharCode(...bytes.slice(12, 16)) !== "IHDR") return null;
  return { width: u32(16), height: u32(20) };
}
// b72 spcapes: the one cape check, shared by the server (accounts.setCape) and the single-player store. Returns null when fine, else { status, message }.
export function capePngError(bytes) {
  if (!bytes || bytes.length > MAX_CAPE_BYTES) return { status: 413, message: 'Capes must be at most 16 KB.' };
  const size = pngSize(bytes);
  if (!size || size.width !== CAPE_WIDTH || size.height !== CAPE_HEIGHT) return { status: 400, message: 'Upload a 64 × 32 PNG cape.' };
  return null;
}
// b73 skins73: the check for a skin kept in single player (already cleaned up and cropped to 64 x 32 by skinCanvas + canvasPng). Null when fine, else { status, message }.
export function skinPngError(bytes) {
  if (!bytes || bytes.length > MAX_SKIN_BYTES) return { status: 413, message: 'Skins must be at most 16 KB.' };
  const size = pngSize(bytes);
  if (!size || size.width !== SKIN_WIDTH || size.height !== SKIN_HEIGHT) return { status: 400, message: 'Upload a 64 × 32 PNG skin.' };
  return null;
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
// Java2D's 8-bit alpha maths (AlphaMath.c, executed through the probe): a partly transparent pixel drawn onto the empty buffer is premultiplied
// and divided back, which moves its colour by a few steps (and by a lot at tiny alphas).
const mul8 = (a, b) => Math.floor((a * b * 0x10101 + 0x800000) / 0x1000000);
const div8 = (a, b) => (b >= a ? 255 : Math.floor((b * Math.floor((0xff000000 + (a >> 1)) / a) + 0x800000) / 0x1000000));
// b73 skins73: ImageBufferDownload.parseUserSkin (bmc.a, executed: skin-parse-reference.json). The source (any size, RGBA bytes, not premultiplied)
// is drawn at 0,0 into a transparent 64 x 32 ARGB buffer (clipped or padded), then the head base and the body/limb areas are forced opaque and the
// hat area is cleared unless it already holds a pixel below alpha 128. A fully transparent source pixel loses its colour in the draw, and partial alphas go through Java2D's
// premultiply and divide (see above). Returns new 64 x 32 RGBA bytes.
export function userSkinPixels(rgba, width, height) {
  const px = new Uint8ClampedArray(SKIN_WIDTH * SKIN_HEIGHT * 4);
  for (let y = 0; y < Math.min(height, SKIN_HEIGHT); y++) for (let x = 0; x < Math.min(width, SKIN_WIDTH); x++) {
    const s = (y * width + x) * 4, d = (y * SKIN_WIDTH + x) * 4;
    const a = rgba[s + 3];
    if (a === 0) continue;
    px[d + 3] = a;
    for (let k = 0; k < 3; k++) px[d + k] = a === 255 ? rgba[s + k] : div8(a, mul8(a, rgba[s + k]));
  }
  opaque(px, 0, 0, 32, 16);
  transparent(px, 32, 0, 64, 32);
  opaque(px, 0, 16, 64, 32);
  return px;
}
// `rgba`: 64 x height source pixels (the sizes the port accepts). Returns new 64 x 32 RGBA bytes.
export function normalizeSkinPixels(rgba, height) {
  if (!acceptedSkinSize(SKIN_WIDTH, height) || rgba.length !== SKIN_WIDTH * height * 4) throw new Error("A skin must be 64 × 32 or 64 × 64 pixels.");
  return userSkinPixels(rgba, SKIN_WIDTH, height);
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
  // b74 order74: PNG bytes decode here without premultiplying (png-decode.js), as ImageIO does; anything the decoder refuses falls back to the canvas path.
  let decoded = null;
  try { decoded = await decodePng(new Uint8Array(await blob.arrayBuffer())); } catch { decoded = null; }
  if (decoded) {
    if (!acceptedSkinSize(decoded.width, decoded.height)) throw new Error(`A skin must be 64 × 32 or 64 × 64 pixels (this is ${decoded.width} × ${decoded.height}).`);
    return pixelsCanvas(normalizeSkinPixels(decoded.data, decoded.height));
  }
  let bitmap;
  try { bitmap = await createImageBitmap(blob); }
  catch { throw new Error("That file is not a readable PNG image."); }
  try {
    if (!acceptedSkinSize(bitmap.width, bitmap.height)) throw new Error(`A skin must be 64 × 32 or 64 × 64 pixels (this is ${bitmap.width} × ${bitmap.height}).`);
    const source = document.createElement("canvas");
    source.width = bitmap.width; source.height = bitmap.height;
    const sc = source.getContext("2d", { willReadFrequently: true });
    sc.drawImage(bitmap, 0, 0);
    return pixelsCanvas(normalizeSkinPixels(sc.getImageData(0, 0, bitmap.width, bitmap.height).data, bitmap.height));
  } finally { bitmap.close?.(); }
}
function pixelsCanvas(px) {
  const out = document.createElement("canvas");
  out.width = SKIN_WIDTH; out.height = SKIN_HEIGHT;
  out.getContext("2d").putImageData(new ImageData(px, SKIN_WIDTH, SKIN_HEIGHT), 0, 0);
  return out;
}
export const canvasPng = (canvas) => new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not encode the skin."))), "image/png"));

// b71 mpcapes, browser only: decode a cape PNG into a 64 x 32 canvas. Cape pixels are kept as they are (no skin opacity rules); other sizes are rejected.
export async function capeCanvas(blob) {
  let bitmap;
  try { bitmap = await createImageBitmap(blob); }
  catch { throw new Error("That file is not a readable PNG image."); }
  try {
    if (bitmap.width !== CAPE_WIDTH || bitmap.height !== CAPE_HEIGHT) throw new Error(`A cape must be 64 × 32 pixels (this is ${bitmap.width} × ${bitmap.height}).`);
    const out = document.createElement("canvas");
    out.width = CAPE_WIDTH; out.height = CAPE_HEIGHT;
    out.getContext("2d").drawImage(bitmap, 0, 0);
    return out;
  } finally { bitmap.close?.(); }
}
