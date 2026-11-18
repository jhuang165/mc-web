// Batch 79 potspacks79: (1) flower pot Data round trip and the native icon clamp, (2) styled pack descriptions through getFormattedText,
// (3) the canvas fallbacks in block-textures.js are reached only when the PNG decoder refuses a file. Rows: pot-sweep-reference.json (Executed),
// pack-description-reference.json (Executed, PackDescProbe); the icon clamp is Bytecode-read (BlockFlower.getIcon, BlockSapling.getIcon).
import test from "node:test";
import assert from "node:assert/strict";
import zlib from "node:zlib";
import { readFileSync } from "node:fs";
import { potFromNbt, potNbtOf, potPlantOf, potDrawDamage, setPotContents, potContents, serializePots, restorePots, potDrops, potPick } from "./stone-utility.js";
import { descriptionText, parsePackMcmeta, INVALID_META } from "./resource-packs.js";
import { packRowDescription, packRowTexts, wrapFormatted } from "./resource-packs-ui.js";
import { decodePng } from "./png-decode.js";
import { frameTile } from "./atlas-texels.js";

const read = (f) => JSON.parse(readFileSync(new URL(`../public/research/${f}`, import.meta.url), "utf8"));
const NATIVE_TO_POT = { 37: 43, 38: 44, 6: 48, 39: 75, 40: 76, 81: 53, 32: 79 };

test("every native pot Item/Data the sweep recorded round-trips through import, save and export", () => {
  const rows = read("pot-sweep-reference.json").rows.filter((r) => r.kind === "potAccept" && !r.creative && NATIVE_TO_POT[r.id] !== undefined);
  assert.ok(rows.length > 100);
  const world = { pots: new Map(), getMeta: () => 0 };
  for (const r of rows) {
    const [item, data] = r.nbt, c = potFromNbt({ Item: item, Data: data });
    assert.ok(c, `${item}:${data}`);
    assert.equal(c.id, NATIVE_TO_POT[item]);
    assert.deepEqual(potNbtOf(c), { Item: item, Data: data }, `export ${item}:${data}`);
    setPotContents(world, 1, 2, 3, c);
    const saved = JSON.parse(JSON.stringify(serializePots(world)));
    world.pots = new Map(); restorePots(world, saved);
    assert.deepEqual(potNbtOf(potContents(world, 1, 2, 3)), { Item: item, Data: data }, `save ${item}:${data}`);
    assert.ok(potPlantOf(c.id, c.damage), "the drawn plant is one the port can hold");
  }
});

test("the pot draws what BlockFlower / BlockSapling.getIcon(0, Data) pick", () => {
  // red flower: icons[Data] for 0-8, icons[0] (poppy) at 9 and above; dandelion: its single icon; sapling: clamp(Data & 7, 0, 5).
  assert.deepEqual([...Array(16).keys()].map((d) => potDrawDamage(38, d)), [0, 1, 2, 3, 4, 5, 6, 7, 8, 0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual([...Array(16).keys()].map((d) => potDrawDamage(6, d)), [0, 1, 2, 3, 4, 5, 5, 5, 0, 1, 2, 3, 4, 5, 5, 5]);
  for (const item of [37, 39, 40, 81, 32]) for (let d = 0; d < 16; d++) assert.equal(potDrawDamage(item, d), 0);
  assert.equal(potDrawDamage(38, -1), null); // the client throws on a negative index
  assert.equal(potFromNbt({ Item: 38, Data: -1 }), null);
  assert.deepEqual(potFromNbt({ Item: 38, Data: 12 }), { id: 44, damage: 0, data: 12 });
  assert.deepEqual(potFromNbt({ Item: 6, Data: 9 }), { id: 48, damage: 1, data: 9 });
  assert.deepEqual(potFromNbt({ Item: 6, Data: 3 }), { id: 48, damage: 3 });
  assert.deepEqual(potFromNbt({ Item: 37, Data: 0 }), { id: 43, damage: 0 });
});

test("breaking or picking a pot with a native-only damage yields the drawn plant the port can hold", () => {
  const world = { pots: new Map(), getMeta: () => 0 };
  setPotContents(world, 0, 0, 0, potFromNbt({ Item: 38, Data: 12 }));
  assert.deepEqual(potDrops(world, 0, 0, 0)[0], { id: 44, count: 1, damage: 0 });
  assert.deepEqual(potPick(world, 0, 0, 0), { id: 44, damage: 0 });
});

test("pack descriptions replay getFormattedText for styled chat components", () => {
  const rows = read("pack-description-reference.json").rows;
  assert.ok(rows.length >= 20);
  for (const [json, formatted] of rows) {
    // b80: the translate row failed only because PackDescProbe had no lang table; pack-meta-reference.json (potspacks80-b80.test.js) replays translations.
    if (json.includes('"translate"')) continue;
    let ours = null;
    try { ours = descriptionText(JSON.parse(json)).formatted; } catch { /* native refused too */ }
    assert.equal(ours, formatted, json);
  }
});

test("parsePackMcmeta keeps the formatted text and the pack row draws it with the b78 rules", () => {
  const mc = (d) => JSON.stringify({ pack: { pack_format: 1, description: d } });
  const styled = parsePackMcmeta(mc({ text: "Root", color: "gold", extra: [{ text: " bold", bold: true }, " tail"] }));
  assert.equal(styled.valid, true);
  assert.equal(styled.description, "Root bold tail");
  assert.equal(styled.formatted, "§6Root§r§6§l bold§r§6 tail§r");
  assert.equal(packRowDescription(styled), styled.formatted);
  assert.equal(packRowDescription(parsePackMcmeta(mc("plain"))), "plain§r");
  // b80: a description the serializer refuses makes the whole load throw, so the native repository does not list the pack (pack-meta-reference.json).
  assert.equal(parsePackMcmeta(mc({ color: "red" })).listed, false);
  assert.equal(parsePackMcmeta(mc({ text: "x", extra: [] })).valid, false);
  assert.equal(packRowDescription(parsePackMcmeta("{}")), "§c" + INVALID_META);
  const texts = packRowTexts({ name: "P", ...styled }, 0, 0);
  assert.deepEqual(texts.slice(1).map((t) => t.text), wrapFormatted(styled.formatted, 157).slice(0, 2));
});

// A PNG writer for the decoder checks (the fallbacks below are only reached when decodePng refuses a texture).
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, body) => { const t = Buffer.from(type), o = Buffer.alloc(12 + body.length); o.writeUInt32BE(body.length, 0); t.copy(o, 4); Buffer.from(body).copy(o, 8); o.writeUInt32BE(crc(Buffer.concat([t, Buffer.from(body)])), 8 + body.length); return o; };
function png(w, h, depth, ctype, rows, extra = []) {
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = depth; ihdr[9] = ctype;
  const raw = Buffer.concat(rows.map((r) => Buffer.concat([Buffer.from([0]), Buffer.from(r)])));
  return new Uint8Array(Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), ...extra, chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", [])]));
}

test("the formats the old fallback comment named decode exactly, so the canvas path is not reached for them", async () => {
  const p16 = await decodePng(png(1, 1, 16, 6, [[0x12, 0x34, 0x56, 0x78, 0x9a, 0xbc, 0x00, 0x80]]));
  assert.deepEqual([...p16.data], [0x12, 0x56, 0x9a, 0x00]); // 16-bit keeps the high byte, alpha 0 stays 0 (no premultiply)
  const key = await decodePng(png(2, 1, 8, 2, [[1, 2, 3, 9, 9, 9]], [chunk("tRNS", [0, 1, 0, 2, 0, 3])]));
  assert.deepEqual([...key.data], [1, 2, 3, 0, 9, 9, 9, 255]); // colour key
  const pal = await decodePng(png(2, 1, 8, 3, [[0, 1]], [chunk("PLTE", [10, 20, 30, 40, 50, 60]), chunk("tRNS", [3])]));
  assert.deepEqual([...pal.data], [10, 20, 30, 3, 40, 50, 60, 255]); // palette alpha 3 survives
});

test("odd-sized and animated block sheets cut straight from decoded bytes (what exactLevels does)", async () => {
  // 3 x 9: three frames of 3 x 3 (odd size, strip), semi-transparent texels
  const rows = Array.from({ length: 9 }, (_, y) => Array.from({ length: 12 }, (_, i) => (i % 4 === 3 ? 3 + y : (y * 7 + i) & 255)));
  const sheet = await decodePng(png(3, 9, 8, 6, rows));
  for (let f = 0; f < 3; f++) {
    const t = frameTile(sheet, f, 3);
    for (let y = 0; y < 3; y++) assert.deepEqual([...t.subarray(y * 12, y * 12 + 12)], rows[f * 3 + y], `frame ${f} row ${y}`);
  }
  // a frame sampled to a larger tile keeps alpha as stored (nearest, no canvas rounding)
  assert.ok(new Set(frameTile(sheet, 1, 6).filter((_, i) => i % 4 === 3)).size > 1);
});

test("block-textures.js reaches canvasLevels only through exactLevels failing, and icons use softIcon / rasterIcon first", () => {
  const src = readFileSync(new URL("./block-textures.js", import.meta.url), "utf8");
  assert.equal(src.match(/canvasLevels\(/g).length, 2); // the definition and tileLevels
  assert.match(src, /const tileLevels=\(terrainMode,name,x,y,n\)=>exactLevels\(terrainMode,name,n\)\?\?canvasLevels\(/);
  assert.match(src, /async function exactPng\(name\)\{[^}]*decodePng/);
});
