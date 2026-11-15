// Batch 74 order74: a small PNG decoder that keeps the colours as stored (not premultiplied). The browser's canvas getImageData premultiplies partly transparent pixels
// and divides them back, which is one colour step off what Java's ImageIO hands ImageBufferDownload.parseUserSkin (skin.js userSkinPixels). The deflate step uses the
// platform's DecompressionStream ("deflate" is the zlib wrapper PNG uses), present in browsers and node 18+; everything else is plain arithmetic.
// Handles colour types 0, 2, 3, 4, 6, bit depths 1 to 16 and Adam7 interlacing; tRNS gives gray/RGB/palette alpha. 16-bit samples keep their high byte.
// Gamma, sRGB and iCCP chunks are ignored (ImageIO's default reader does not apply them either). Returns { width, height, data: Uint8ClampedArray RGBA }.
const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
const ADAM7 = [[0, 0, 8, 8], [4, 0, 8, 8], [0, 4, 4, 8], [2, 0, 4, 4], [0, 2, 2, 4], [1, 0, 2, 2], [0, 1, 1, 2]]; // x0, y0, dx, dy

async function inflate(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function unfilter(raw, offset, rows, rowBytes, bpp) {
  const out = new Uint8Array(rows * rowBytes);
  for (let y = 0; y < rows; y++) {
    const type = raw[offset + y * (rowBytes + 1)], src = offset + y * (rowBytes + 1) + 1, row = y * rowBytes, prev = row - rowBytes;
    if (type > 4) throw new Error("bad PNG filter");
    for (let i = 0; i < rowBytes; i++) {
      const x = raw[src + i], a = i >= bpp ? out[row + i - bpp] : 0, b = y ? out[prev + i] : 0, c = y && i >= bpp ? out[prev + i - bpp] : 0;
      let v;
      if (type === 0) v = x;
      else if (type === 1) v = x + a;
      else if (type === 2) v = x + b;
      else if (type === 3) v = x + ((a + b) >> 1);
      else { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v = x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c); }
      out[row + i] = v & 255;
    }
  }
  return out;
}

export async function decodePng(bytes) {
  if (!bytes || bytes.length < 33 || SIGNATURE.some((v, i) => bytes[i] !== v)) throw new Error("not a PNG");
  const u32 = (o) => ((bytes[o] << 24) | (bytes[o + 1] << 16) | (bytes[o + 2] << 8) | bytes[o + 3]) >>> 0;
  let ihdr = null, palette = null, trns = null;
  const idat = [];
  for (let o = 8; o + 12 <= bytes.length;) {
    const len = u32(o), type = String.fromCharCode(bytes[o + 4], bytes[o + 5], bytes[o + 6], bytes[o + 7]), body = bytes.subarray(o + 8, o + 8 + len);
    if (o + 12 + len > bytes.length) throw new Error("truncated PNG");
    if (type === "IHDR") ihdr = body; else if (type === "PLTE") palette = body; else if (type === "tRNS") trns = body; else if (type === "IDAT") idat.push(body);
    else if (type === "IEND") break;
    o += 12 + len;
  }
  if (!ihdr || ihdr.length !== 13 || !idat.length) throw new Error("bad PNG");
  const width = u32(8 + 8), height = u32(8 + 12), depth = ihdr[8], ctype = ihdr[9], interlace = ihdr[12];
  const channels = CHANNELS[ctype];
  if (!channels || ![1, 2, 4, 8, 16].includes(depth) || !width || !height || width * height > 1 << 26 || ihdr[10] !== 0 || ihdr[11] !== 0 || interlace > 1) throw new Error("unsupported PNG");
  if (ctype === 3 && !palette) throw new Error("PNG palette missing");
  const total = idat.reduce((n, c) => n + c.length, 0), joined = new Uint8Array(total);
  let at = 0; for (const c of idat) { joined.set(c, at); at += c.length; }
  const raw = await inflate(joined);
  const bits = channels * depth, bpp = Math.max(1, bits >> 3), data = new Uint8ClampedArray(width * height * 4);
  const max = (1 << Math.min(depth, 8)) - 1;
  const sample = (row, x, k) => { // channel k of pixel x in an unfiltered row, 0..(2^depth - 1)
    if (depth === 8) return row[x * channels + k];
    if (depth === 16) return (row[(x * channels + k) * 2] << 8) | row[(x * channels + k) * 2 + 1];
    const bit = (x * channels + k) * depth;
    return (row[bit >> 3] >> (8 - depth - (bit & 7))) & max;
  };
  const to8 = (v) => (depth === 16 ? v >> 8 : depth === 8 ? v : Math.round((v * 255) / max));
  const trnsGray = trns && ctype === 0 && trns.length >= 2 ? (trns[0] << 8) | trns[1] : -1;
  const trnsRgb = trns && ctype === 2 && trns.length >= 6 ? [0, 2, 4].map((i) => (trns[i] << 8) | trns[i + 1]) : null;
  const put = (x, y, row, px) => {
    const d = (y * width + x) * 4;
    if (ctype === 0) { const g = sample(row, px, 0), v = to8(g); data[d] = data[d + 1] = data[d + 2] = v; data[d + 3] = g === trnsGray ? 0 : 255; }
    else if (ctype === 2) { const c = [sample(row, px, 0), sample(row, px, 1), sample(row, px, 2)]; data[d] = to8(c[0]); data[d + 1] = to8(c[1]); data[d + 2] = to8(c[2]); data[d + 3] = trnsRgb && c.every((v, i) => v === trnsRgb[i]) ? 0 : 255; }
    else if (ctype === 3) { const i = sample(row, px, 0); if (i * 3 + 2 >= palette.length) throw new Error("PNG palette index"); data[d] = palette[i * 3]; data[d + 1] = palette[i * 3 + 1]; data[d + 2] = palette[i * 3 + 2]; data[d + 3] = trns && i < trns.length ? trns[i] : 255; }
    else if (ctype === 4) { const v = to8(sample(row, px, 0)); data[d] = data[d + 1] = data[d + 2] = v; data[d + 3] = to8(sample(row, px, 1)); }
    else { data[d] = to8(sample(row, px, 0)); data[d + 1] = to8(sample(row, px, 1)); data[d + 2] = to8(sample(row, px, 2)); data[d + 3] = to8(sample(row, px, 3)); }
  };
  const passes = interlace ? ADAM7 : [[0, 0, 1, 1]];
  let offset = 0;
  for (const [x0, y0, dx, dy] of passes) {
    const pw = Math.ceil((width - x0) / dx), ph = Math.ceil((height - y0) / dy);
    if (pw <= 0 || ph <= 0) continue;
    const rowBytes = Math.ceil((pw * bits) / 8);
    if (offset + ph * (rowBytes + 1) > raw.length) throw new Error("truncated PNG data");
    const pixels = unfilter(raw, offset, ph, rowBytes, bpp);
    offset += ph * (rowBytes + 1);
    for (let y = 0; y < ph; y++) { const row = pixels.subarray(y * rowBytes, (y + 1) * rowBytes); for (let x = 0; x < pw; x++) put(x0 + x * dx, y0 + y * dy, row, x); }
  }
  return { width, height, data };
}
