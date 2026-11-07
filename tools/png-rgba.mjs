// Minimal PNG reader (8-bit RGBA or RGB, non-interlaced) for the build tools and tests; returns { width, height, data: RGBA bytes }.
import { inflateSync } from "node:zlib";
export function readPng(buf) {
  let p = 8, width = 0, height = 0, depth = 0, type = 0;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), name = buf.toString("latin1", p + 4, p + 8), body = buf.subarray(p + 8, p + 8 + len);
    if (name === "IHDR") { width = body.readUInt32BE(0); height = body.readUInt32BE(4); depth = body[8]; type = body[9]; if (body[12]) throw new Error("interlaced PNG"); }
    else if (name === "IDAT") idat.push(body);
    p += 12 + len;
  }
  if (depth !== 8 || (type !== 6 && type !== 2)) throw new Error(`unsupported PNG (depth ${depth}, type ${type})`);
  const bpp = type === 6 ? 4 : 3, stride = width * bpp, raw = inflateSync(Buffer.concat(idat)), out = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)], src = y * (stride + 1) + 1, dst = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[dst + x - bpp] : 0, b = y ? out[dst - stride + x] : 0, c = x >= bpp && y ? out[dst - stride + x - bpp] : 0;
      let v = raw[src + x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      out[dst + x] = v & 255;
    }
  }
  if (bpp === 4) return { width, height, data: out };
  const data = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) { data[i * 4] = out[i * 3]; data[i * 4 + 1] = out[i * 3 + 1]; data[i * 4 + 2] = out[i * 3 + 2]; data[i * 4 + 3] = 255; }
  return { width, height, data };
}
