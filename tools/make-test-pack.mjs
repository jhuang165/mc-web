#!/usr/bin/env node
// Writes a small folder resource pack for browser checks of block-atlas animation and the compass/clock paths.
//   node tools/make-test-pack.mjs <outdir> [blockTiles=64] [blockFrames=8] [compassFrames=16] [clockFrames=12]
// Every frame i is filled with colour (r = 10 + 15 i, g = 220 - 8 i, b = 60) so a pixel read decodes the frame index; the compass
// and clock frames also carry a needle/hand pixel line at the angle of their own frame.
import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { join } from "node:path";

const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, body) => { const t = Buffer.from(type, "latin1"), out = Buffer.alloc(12 + body.length); out.writeUInt32BE(body.length, 0); t.copy(out, 4); body.copy(out, 8); out.writeUInt32BE(crc(Buffer.concat([t, body])), 8 + body.length); return out; };
export function encodePng(width, height, rgba) {
  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) { raw[y * (width * 4 + 1)] = 0; Buffer.from(rgba.buffer, rgba.byteOffset + y * width * 4, width * 4).copy(raw, y * (width * 4 + 1) + 1); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
export const frameColour = (i) => [(10 + 15 * i) & 255, (220 - 8 * i) & 255, 60];
function strip(frames, size, needle) {
  const px = new Uint8Array(size * size * frames * 4);
  for (let f = 0; f < frames; f++) {
    const [r, g, b] = frameColour(f);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { const o = ((f * size + y) * size + x) * 4; px[o] = r; px[o + 1] = g; px[o + 2] = b; px[o + 3] = 255; }
    if (needle) {
      const a = (f / frames) * Math.PI * 2, c = size / 2;
      for (let t = 0; t < size * 0.45; t += 0.25) {
        const x = Math.round(c + Math.sin(a) * t), y = Math.round(c - Math.cos(a) * t), o = ((f * size + y) * size + x) * 4;
        px[o] = 255; px[o + 1] = 255; px[o + 2] = 255;
      }
    }
  }
  return px;
}
export function writePack(dir, { blockTiles = 64, blockFrames = 8, compassFrames = 16, clockFrames = 12, blockNames = [] } = {}) {
  const put = (rel, buf) => { const p = join(dir, "assets/minecraft/textures", rel); mkdirSync(join(p, ".."), { recursive: true }); writeFileSync(p, buf); };
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "pack.mcmeta"), JSON.stringify({ pack: { pack_format: 1, description: "mc-web atlas2 test pack" } }));
  for (const name of blockNames.slice(0, blockTiles)) {
    put(`blocks/${name}.png`, encodePng(16, 16 * blockFrames, strip(blockFrames, 16, false)));
    put(`blocks/${name}.png.mcmeta`, Buffer.from('{"animation":{}}'));
  }
  put("items/compass.png", encodePng(16, 16 * compassFrames, strip(compassFrames, 16, true)));
  put("items/clock.png", encodePng(16, 16 * clockFrames, strip(clockFrames, 16, true)));
  return { blockNames: blockNames.slice(0, blockTiles), blockFrames, compassFrames, clockFrames };
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const [dir, bt, bf, cf, kf] = process.argv.slice(2);
  if (!dir) { console.error("usage: make-test-pack.mjs <outdir> [blockTiles] [blockFrames] [compassFrames] [clockFrames]"); process.exit(2); }
  const { TILES } = await import("../src/block-textures.js");
  const names = TILES.filter((n) => /^(dirt|stone|sand|planks|brick|cobble|bedrock|clay|gravel|obsidian|snow|wool_colored|.*_ore|.*_block)/.test(n) && !/^(chest|grass|leaves)/.test(n));
  console.log(JSON.stringify(writePack(dir, { blockTiles: +(bt ?? 64), blockFrames: +(bf ?? 8), compassFrames: +(cf ?? 16), clockFrames: +(kf ?? 12), blockNames: names })));
}
