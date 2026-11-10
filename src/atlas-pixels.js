// Exact atlas pixels. The 1.7.10 TextureMap reads each sprite with ImageIO.getRGB (straight alpha ARGB), builds its mip chain from
// those ints (TextureUtil.generateMipmapData, render-settings.js mipChain) and uploads every level (converted by anaglyphColor when 3D
// Anaglyph is on). A 2D canvas stores premultiplied alpha, so drawing a translucent pixel and reading it back can change it by one.
// These helpers work on decoded PNG bytes (png-codec.js decodePng) so no step rounds through a canvas. Tints multiply in float32 like
// the Tessellator colour does (round(c * m / 255 in float), clamped), and the Anaglyph conversion is the integer bqi.a(int[]) formula.
import { mipChain } from "./render-settings.js";
import { anaglyphRgba } from "./anaglyph.js";

const f = Math.fround;

// One TILE x TILE cell from frame `frame` of a decoded strip ({ width, height, data }, square frames of min(width, height)). A frame of a
// different size is sampled nearest (canvas drawImage with smoothing off); a frame past the end is clamped to the last whole one.
export function frameTile(png, frame = 0, size = 16) {
  const fs = Math.max(1, Math.min(png.width, png.height)), frames = Math.max(1, Math.floor(png.height / fs));
  const top = Math.min(Math.max(0, frame), frames - 1) * fs, out = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    const sy = top + Math.min(fs - 1, Math.floor(((y + 0.5) * fs) / size));
    for (let x = 0; x < size; x++) {
      const sx = Math.min(fs - 1, Math.floor(((x + 0.5) * fs) / size)), s = (sy * png.width + sx) * 4, d = (y * size + x) * 4;
      out[d] = png.data[s]; out[d + 1] = png.data[s + 1]; out[d + 2] = png.data[s + 2]; out[d + 3] = png.data[s + 3];
    }
  }
  return out;
}

// Copies the source rectangle (sx, sy, sw, sh in source pixels, may be fractional for scaled packs) into dst (a size x size tile) at
// (dx, dy, w, h), nearest sampled. Straight copy, no blending: the chest faces are painted on cleared cells.
export function blit(dst, size, png, sx, sy, sw, sh, dx, dy, w, h) {
  for (let y = 0; y < h; y++) {
    const py = Math.min(png.height - 1, Math.floor(sy + ((y + 0.5) * sh) / h));
    for (let x = 0; x < w; x++) {
      const px = Math.min(png.width - 1, Math.floor(sx + ((x + 0.5) * sw) / w)), s = (py * png.width + px) * 4, d = ((dy + y) * size + dx + x) * 4;
      dst[d] = png.data[s]; dst[d + 1] = png.data[s + 1]; dst[d + 2] = png.data[s + 2]; dst[d + 3] = png.data[s + 3];
    }
  }
  return dst;
}

// rgb x float multiplier triple (0..1 floats, e.g. anaglyphMultiplier), alpha unchanged: round(float32(c * m)), clamped.
export function multiplyTile(data, mult) {
  const out = new Uint8Array(data.length), m = [f(mult[0]), f(mult[1]), f(mult[2])];
  for (let i = 0; i + 3 < data.length; i += 4) {
    for (let c = 0; c < 3; c++) out[i + c] = Math.min(255, Math.max(0, Math.round(f(data[i + c] * m[c]))));
    out[i + 3] = data[i + 3];
  }
  return out;
}

// bqi.a(int[]) on a copy (the item atlas converts per level before the tint multiplies in).
export const convertTile = (data) => anaglyphRgba(Uint8Array.from(data));

// Straight-alpha source-over of `over` onto `base` (the grass side overlay drawn on the side texture).
export function overTile(base, over) {
  const out = new Uint8Array(base.length);
  for (let i = 0; i + 3 < base.length; i += 4) {
    const ao = over[i + 3] / 255, ab = base[i + 3] / 255, a = ao + ab * (1 - ao);
    if (a <= 0) continue;
    for (let c = 0; c < 3; c++) out[i + c] = Math.round((over[i + c] * ao + base[i + c] * ab * (1 - ao)) / a);
    out[i + 3] = Math.round(a * 255);
  }
  return out;
}

// The sprite's mip chain 0..levels as Uint8Arrays (TextureUtil.generateMipmapData per sprite; level n of a 16 px tile is 16 >> n wide).
export function spriteLevels(data, levels, size = 16) {
  return mipChain(data, size, size, levels).map((l) => (l.data instanceof Uint8Array ? l.data : new Uint8Array(l.data.buffer, l.data.byteOffset, l.data.length)));
}

// Writes one tile's level arrays into the atlas level arrays at tile origin (x, y), level n at (x >> n, y >> n).
export function putTile(atlasLevels, atlasWidth, levels, x, y, size = 16) {
  for (let l = 0; l < levels.length && l < atlasLevels.length; l++) {
    const w = Math.max(1, size >> l), aw = atlasWidth >> l, src = levels[l], dst = atlasLevels[l];
    for (let row = 0; row < w; row++) dst.set(src.subarray(row * w * 4, (row + 1) * w * 4), (((y >> l) + row) * aw + (x >> l)) * 4);
  }
}
