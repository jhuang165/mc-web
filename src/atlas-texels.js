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

// ---- DOM icons from exact bytes ------------------------------------------------------------------------------------------------
// block-textures.js draws item and block icons on a 2D canvas, which stores premultiplied alpha: a translucent texel (ice, stained glass,
// slime) drawn there and read back by toDataURL drifts by a few units. rasterIcon composes the same picture in software from the exact
// straight-alpha tile bytes: each layer is a 16 px tile under the canvas matrix (a, b, c, d, e, f) that block-textures.js passes to
// setTransform, sampled nearest at the pixel centre (drawImage with smoothing off); a pixel whose centre is not covered but part of it is
// takes the first covered sample's texel with its alpha scaled by the covered fraction (4 x 4 samples, the canvas's edge anti-aliasing).
// `shade` is the black source-atop overlay (colour x (1 - shade), alpha unchanged); `drop` the rows cut off the top of the tile.
// Layers are painted in order with straight-alpha source-over, so a pixel covered by one layer is that texel's bytes exactly.
// A layer with `gl: true` is rasterised as the GL does a polygon: no anti-aliasing (the frame buffer has no multisampling), a pixel belongs to the
// face exactly when its centre is inside the face's parallelogram (the tile rectangle under the matrix), ties on an edge going to the top-left
// owner, the texel is the one under that centre (GL_NEAREST) and the alpha is the texel's, never scaled by a covered fraction. That is how
// renderItemIntoGUI's cube reaches the screen (icon-cube.js); layers without it keep the canvas 4 x 4 coverage the flat icons use.
export function rasterIcon(width, height, layers, size = 16) {
  const out = new Uint8Array(width * height * 4), SUB = 4;
  for (const { tile, matrix: [a, b, c, d, e, f0], shade = 0, drop = 0, gl = false } of layers) {
    const det = a * d - b * c, mul = 1 - shade;
    const local = (X, Y) => [((X - e) * d - (Y - f0) * c) / det, (a * (Y - f0) - b * (X - e)) / det];
    const texel = (lx, ly) => (lx >= 0 && lx < size && ly >= drop && ly < size ? Math.min(size - 1, Math.floor(ly - drop)) * size + Math.min(size - 1, Math.floor(lx)) : -1);
    const inside = gl ? glFace([a, b, c, d, e, f0], size, drop) : null;
    for (let py = 0; py < height; py++) for (let px = 0; px < width; px++) {
      const [cx, cy] = local(px + 0.5, py + 0.5);
      let first, covered = 0;
      if (gl) { if (!inside(px + 0.5, py + 0.5)) continue; first = texel(Math.min(cx, size - 1e-9), cy); covered = SUB * SUB; if (first < 0) first = texel(Math.max(0, Math.min(size - 1e-9, cx)), Math.max(drop, Math.min(size - 1e-9, cy))); }
      else {
        first = texel(cx, cy);
        for (let j = 0; j < SUB; j++) for (let i = 0; i < SUB; i++) {
          const [lx, ly] = local(px + (i + 0.5) / SUB, py + (j + 0.5) / SUB), t = texel(lx, ly);
          if (t >= 0) { covered++; if (first < 0) first = t; }
        }
      }
      if (first < 0) continue;
      const o = (py * width + px) * 4, s = first * 4, sa = (tile[s + 3] / 255) * (covered / (SUB * SUB));
      if (sa <= 0) continue;
      const da = out[o + 3] / 255, ra = sa + da * (1 - sa);
      for (let k = 0; k < 3; k++) {
        const sc = shade ? Math.round(f(tile[s + k] * f(mul))) : tile[s + k];
        out[o + k] = da === 0 ? sc : Math.round((sc * sa + out[o + k] * da * (1 - sa)) / ra);
      }
      out[o + 3] = Math.round(ra * 255);
    }
  }
  return out;
}

// The GL coverage test of one face: the tile rectangle (0, drop)-(size, size) under the canvas matrix is a convex quad; a point is inside when
// it is on the inner side of all four edges, and a point exactly on an edge counts only for a top or left edge (the usual top-left rule).
// y runs down the screen, as in the GUI projection, so an edge is "top" when it is horizontal and the interior lies below it, "left" when it
// goes up the screen with the interior to its right.
export function glFace([a, b, c, d, e, f0], size = 16, drop = 0) {
  const P = [[0, drop], [size, drop], [size, size], [0, size]].map(([u, v]) => [a * u + c * v + e, b * u + d * v + f0]);
  const area = P.reduce((s, p, i) => { const q = P[(i + 1) % 4]; return s + p[0] * q[1] - q[0] * p[1]; }, 0), sign = area < 0 ? -1 : 1;
  const edges = P.map((p, i) => { let q = P[(i + 1) % 4]; if (sign < 0) { q = p; p = P[(i + 1) % 4]; } // wind every quad the same way (positive area in y-down screen space)
    const dx = q[0] - p[0], dy = q[1] - p[1];
    return { p, dx, dy, owns: dy < 0 || (dy === 0 && dx > 0) }; });
  return (x, y) => edges.every(({ p, dx, dy, owns }) => { const w = dx * (y - p[1]) - dy * (x - p[0]); return w > 0 || (w === 0 && owns); });
}

const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (bytes) => { let c = 0xffffffff; for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
// A synchronous PNG writer for small RGBA images: filter 0 rows in stored (uncompressed) deflate blocks, so the bytes read back exactly.
export function encodePngStored(width, height, data) {
  const stride = width * 4, raw = new Uint8Array((stride + 1) * height);
  for (let y = 0; y < height; y++) raw.set(data.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  const blocks = Math.max(1, Math.ceil(raw.length / 65535)), z = new Uint8Array(2 + raw.length + blocks * 5 + 4);
  z[0] = 0x78; z[1] = 0x01;
  let at = 2;
  for (let i = 0; i < blocks; i++) {
    const n = Math.min(65535, raw.length - i * 65535);
    z[at++] = i === blocks - 1 ? 1 : 0; z[at++] = n & 255; z[at++] = n >> 8; z[at++] = ~n & 255; z[at++] = (~n >> 8) & 255;
    z.set(raw.subarray(i * 65535, i * 65535 + n), at); at += n;
  }
  let s1 = 1, s2 = 0;
  for (let i = 0; i < raw.length; i++) { s1 = (s1 + raw[i]) % 65521; s2 = (s2 + s1) % 65521; }
  new DataView(z.buffer).setUint32(at, ((s2 << 16) | s1) >>> 0);
  const chunk = (name, body) => {
    const out = new Uint8Array(12 + body.length), view = new DataView(out.buffer);
    view.setUint32(0, body.length);
    for (let i = 0; i < 4; i++) out[4 + i] = name.charCodeAt(i);
    out.set(body, 8);
    view.setUint32(8 + body.length, crc32(out.subarray(4, 8 + body.length)));
    return out;
  };
  const ihdr = new Uint8Array(13), hv = new DataView(ihdr.buffer);
  hv.setUint32(0, width); hv.setUint32(4, height); ihdr[8] = 8; ihdr[9] = 6;
  const parts = [Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10), chunk("IHDR", ihdr), chunk("IDAT", z), chunk("IEND", new Uint8Array(0))];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}
export const pngDataUrl = (bytes) => { let s = ""; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return "data:image/png;base64," + btoa(s); };
export const hasTranslucent = (data) => { for (let i = 3; i < data.length; i += 4) if (data[i] > 0 && data[i] < 255) return true; return false; };
