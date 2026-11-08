// Minimal PNG reader/writer used to convert GUI textures byte-exactly (gui-anaglyph.js). Canvas getImageData/putImageData would
// round-trip through premultiplied alpha and change the colour of translucent pixels, which TextureUtil.anaglyphColor
// (ImageIO.getRGB, straight alpha) does not. Reads 8-bit, non-interlaced greyscale, RGB, palette, grey+alpha and RGBA; anything else
// (16-bit, interlaced, colour-keyed tRNS) returns null so the caller can fall back. Uses (De)CompressionStream "deflate" (zlib).
const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

async function pipe(bytes, stream) {
  const writer = stream.writable.getWriter();
  writer.write(bytes).catch(() => {});
  writer.close().catch(() => {});
  const chunks = [];
  const reader = stream.readable.getReader();
  for (let r = await reader.read(); !r.done; r = await reader.read()) chunks.push(r.value);
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let at = 0;
  for (const c of chunks) { out.set(c, at); at += c.length; }
  return out;
}

export async function decodePng(bytes) {
  if (bytes.length < 33 || SIGNATURE.some((b, i) => bytes[i] !== b)) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let width = 0, height = 0, depth = 0, type = 0, interlace = 0, palette = null, alpha = null, keyed = false;
  const idat = [];
  for (let at = 8; at + 8 <= bytes.length;) {
    const length = view.getUint32(at), name = String.fromCharCode(bytes[at + 4], bytes[at + 5], bytes[at + 6], bytes[at + 7]), body = at + 8;
    if (body + length > bytes.length) return null;
    if (name === "IHDR") { width = view.getUint32(body); height = view.getUint32(body + 4); depth = bytes[body + 8]; type = bytes[body + 9]; interlace = bytes[body + 12]; }
    else if (name === "PLTE") palette = bytes.subarray(body, body + length);
    else if (name === "tRNS") { if (type === 3) alpha = bytes.subarray(body, body + length); else keyed = true; }
    else if (name === "IDAT") idat.push(bytes.subarray(body, body + length));
    else if (name === "IEND") break;
    at = body + length + 4;
  }
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type];
  if (!width || !height || depth !== 8 || interlace || !channels || keyed || (type === 3 && !palette)) return null;
  const joined = new Uint8Array(idat.reduce((n, c) => n + c.length, 0));
  let o = 0;
  for (const c of idat) { joined.set(c, o); o += c.length; }
  let raw;
  try { raw = await pipe(joined, new DecompressionStream("deflate")); } catch { return null; }
  const stride = width * channels;
  if (raw.length < (stride + 1) * height) return null;
  const rows = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)], src = y * (stride + 1) + 1, dst = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? rows[dst + x - channels] : 0, b = y ? rows[dst - stride + x] : 0, c = x >= channels && y ? rows[dst - stride + x - channels] : 0;
      let predict = 0;
      if (filter === 1) predict = a; else if (filter === 2) predict = b; else if (filter === 3) predict = (a + b) >> 1;
      else if (filter === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); predict = pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      else if (filter !== 0) return null;
      rows[dst + x] = (raw[src + x] + predict) & 255;
    }
  }
  const data = new Uint8Array(width * height * 4);
  for (let i = 0, n = width * height; i < n; i++) {
    const s = i * channels, d = i * 4;
    if (type === 6) { data[d] = rows[s]; data[d + 1] = rows[s + 1]; data[d + 2] = rows[s + 2]; data[d + 3] = rows[s + 3]; }
    else if (type === 2) { data[d] = rows[s]; data[d + 1] = rows[s + 1]; data[d + 2] = rows[s + 2]; data[d + 3] = 255; }
    else if (type === 3) { const p = rows[s] * 3; data[d] = palette[p] ?? 0; data[d + 1] = palette[p + 1] ?? 0; data[d + 2] = palette[p + 2] ?? 0; data[d + 3] = alpha?.[rows[s]] ?? 255; }
    else { data[d] = data[d + 1] = data[d + 2] = rows[s]; data[d + 3] = type === 4 ? rows[s + 1] : 255; }
  }
  return { width, height, data };
}

const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (bytes) => { let c = 0xffffffff; for (let i = 0; i < bytes.length; i++) c = CRC[(c ^ bytes[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };

export async function encodePng(width, height, data) {
  const stride = width * 4, raw = new Uint8Array((stride + 1) * height);
  for (let y = 0; y < height; y++) raw.set(data.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1); // filter 0 on every row
  const idat = await pipe(raw, new CompressionStream("deflate"));
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
  const parts = [Uint8Array.from(SIGNATURE), chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", new Uint8Array(0))];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}
