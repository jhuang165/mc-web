// Batch 78 packs78: sprite frames and baked tint icons as straight-alpha PNGs. A 2D canvas stores premultiplied alpha, so cutting a pack's
// animation frame with drawImage + toDataURL (item-animation.js, the clock strip) or tinting a spawn egg with multiply + destination-in
// (spawn-eggs.js) re-rounds every partly transparent texel. These helpers work on decoded bytes (png-decode.js keeps the colours as stored),
// cut and tint in software and write the result with encodePngStored (filter 0, stored deflate), so the PNG reads back to the same bytes.
// Pure functions, no DOM; the callers keep the canvas path as the fallback for a PNG the decoder refuses.
import { decodePng } from "./png-decode.js";
import { frameTile, multiplyTile, overTile, encodePngStored, pngDataUrl } from "./atlas-texels.js";

// Fetches and decodes a sprite sheet; null when the request or the decoder fails (the caller falls back to the Image path).
export async function fetchDecoded(url) {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const png = await decodePng(new Uint8Array(await r.arrayBuffer()));
    return { width: png.width, height: png.height, data: new Uint8Array(png.data.buffer, png.data.byteOffset, png.data.byteLength) };
  } catch { return null; }
}
// Frame `frame` of a strip of square cells as RGBA bytes (cell size = the strip width, as the old canvas cut used).
export const frameRgba = (png, frame) => frameTile(png, frame, png.width);
// The same frame as a PNG data url whose pixels equal frameRgba.
export const frameUrl = (png, frame) => pngDataUrl(encodePngStored(png.width, png.width, frameRgba(png, frame)));
// ItemSpawnEgg layer colour: the texel colour times the tint (float multiply), alpha unchanged.
export const tintRgba = (data, color) => multiplyTile(data, [((color >> 16) & 255) / 255, ((color >> 8) & 255) / 255, (color & 255) / 255]);
// Spawn egg icon: the base tinted by `primary`, the overlay (sampled to the base size) tinted by `secondary`, composed source-over.
export function eggRgba(base, overlay, primary, secondary) {
  const size = base.width, a = tintRgba(frameTile(base, 0, size), primary), b = tintRgba(frameTile(overlay, 0, size), secondary);
  return { size, data: overTile(a, b) };
}
export function eggUrl(base, overlay, primary, secondary) {
  const { size, data } = eggRgba(base, overlay, primary, secondary);
  return pngDataUrl(encodePngStored(size, size, data));
}
