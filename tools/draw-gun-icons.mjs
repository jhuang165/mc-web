// node tools/draw-gun-icons.mjs — writes the guns mod's 16x16 item icons (this project's own pixel art, not TaCZ assets) to
// public/media/mods/guns/. Each sprite is a character map; `.` is transparent.
import { writeFileSync, mkdirSync } from "node:fs";
import { deflateSync } from "node:zlib";
import path from "node:path";
import { fileURLToPath } from "node:url";

const out = path.join(path.dirname(fileURLToPath(import.meta.url)), "../public/media/mods/guns");
const PALETTE = {
  k: [24, 24, 26], g: [52, 54, 58], m: [84, 87, 92], l: [128, 132, 138], s: [170, 174, 180],
  d: [86, 50, 24], w: [124, 76, 38], h: [156, 102, 56],
  B: [128, 96, 30], b: [196, 158, 64], y: [232, 204, 110],
  R: [120, 24, 24], r: [176, 40, 36], p: [214, 82, 70],
};
const SPRITES = {
  p320: [
    "................",
    "................",
    "................",
    "................",
    "...kkkkkkkkkkkk.",
    "..kssllllllllllk",
    "..kmmmmmmmmmmmmk",
    "..kgggggggggggkk",
    "..kggkkgggkk....",
    "..kggk.kgk......",
    "..kgggkkk.......",
    ".kgggk..........",
    ".kgggk..........",
    ".kmggk..........",
    ".kkkkk..........",
    "................",
  ],
  akm: [
    "................",
    "................",
    "................",
    "................",
    "...........k....",
    "kk........kgk...",
    "khkkkkkkkkkkkkkk",
    "kwwkmmmmhhhhllsk",
    "kwwkgggghwwwkkkk",
    "kwwwkgggkkkkk...",
    ".kwwkkgggk......",
    "..kkk.kggk......",
    "......kggk......",
    ".......kggk.....",
    "........kkk.....",
    "................",
  ],
  m870: [
    "................",
    "................",
    "................",
    "................",
    "................",
    "kk..............",
    "khkk...........k",
    "kwwhkkkkkkkkkkkk",
    "kwwwwkgggggggllk",
    ".kwwwkmmmmmmmmkk",
    "..kkwwkgkhhhhhk.",
    "....kkkgkwwwwwk.",
    "......kkkkkkkk..",
    "................",
    "................",
    "................",
  ],
  ammo_45acp: [
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "...kk...kk......",
    "..kssk.kssk.....",
    "..klmk.klmk..kk.",
    "..kbyk.kbyk.kssk",
    "..kbyk.kbyk.klmk",
    "..kbyk.kbyk.kbyk",
    "..kbBk.kbBk.kbyk",
    "..kkkk.kkkk.kbBk",
    ".............kkk",
    "................",
  ],
  ammo_762x39: [
    "................",
    "................",
    "....k....k....k.",
    "...kmk..kmk..kmk",
    "...kmk..kmk..kmk",
    "...kbk..kbk..kbk",
    "..kbyk.kbyk.kbyk",
    "..kbyk.kbyk.kbyk",
    "..kbyk.kbyk.kbyk",
    "..kbyk.kbyk.kbyk",
    "..kbyk.kbyk.kbyk",
    "..kbBk.kbBk.kbBk",
    "..kkkk.kkkk.kkkk",
    "................",
    "................",
    "................",
  ],
  ammo_12g: [
    "................",
    "................",
    "................",
    "..kkkk..........",
    ".krppk..kkkk....",
    ".krrpk.krppk....",
    ".krrpk.krrpk....",
    ".krrpk.krrpk....",
    ".kRrpk.krrpk....",
    ".kbbyk.kRrpk....",
    ".kbbyk.kbbyk....",
    ".kBBBk.kbbyk....",
    ".kkkkk.kBBBk....",
    ".......kkkkk....",
    "................",
    "................",
  ],
  // The gun smith table: a workbench with a pistol and tools on its top.
  gun_smith_table: [
    "................",
    "................",
    "....kkkkk.......",
    "...kmmmmmk..kk..",
    "..kkkkkkgk.kssk.",
    "kkkkkkkkkkkkkkkk",
    "khhhhhhhhhhhhhhk",
    "kwwwwwwwwwwwwwwk",
    "kdkkkkkkkkkkkkdk",
    "kdkllllkkllllkdk",
    "kdkmmmmkkmmmmkdk",
    "kdkkkkkkkkkkkkdk",
    "kdk..........kdk",
    "kdk..........kdk",
    "kkk..........kkk",
    "................",
  ],
};

const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, body) {
  const head = Buffer.alloc(8); head.writeUInt32BE(body.length, 0); head.write(type, 4, "latin1");
  const tail = Buffer.alloc(4); tail.writeUInt32BE(crc(Buffer.concat([head.subarray(4), body])), 0);
  return Buffer.concat([head, body, tail]);
}
export function encodePng(rows) {
  const h = rows.length, w = rows[0].length, raw = Buffer.alloc(h * (w * 4 + 1));
  rows.forEach((row, y) => {
    if (row.length !== w) throw new Error(`row ${y} is ${row.length} wide, expected ${w}`);
    [...row].forEach((ch, x) => {
      const o = y * (w * 4 + 1) + 1 + x * 4, rgb = PALETTE[ch];
      if (ch !== "." && !rgb) throw new Error(`unknown colour ${ch}`);
      if (rgb) { raw[o] = rgb[0]; raw[o + 1] = rgb[1]; raw[o + 2] = rgb[2]; raw[o + 3] = 255; }
    });
  });
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

mkdirSync(out, { recursive: true });
for (const [name, rows] of Object.entries(SPRITES)) writeFileSync(path.join(out, name + ".png"), encodePng(rows));
console.log(`wrote ${Object.keys(SPRITES).length} icons to ${path.relative(process.cwd(), out)}`);
