import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { decodePng } from "./png-decode.js";
import { userSkinPixels } from "./skin.js";
import { ItemEntities } from "./item-entities.js";
import { Arrows } from "./bow.js";
import { ExperienceOrbs, newOrb } from "./experience.js";
import { Survival } from "./survival.js";
import { collectPickups } from "./pickup-order.js";
import { finishEntitySimulation } from "./entity-simulation.js";
import { stampEntity } from "./candidate-order.js";
import { EntityWorld } from "./entities.js";
import { Boats } from "./boats.js";
import { mountMobOnVehicle, passFall } from "./vehicle-riders.js";

// Batch 74 order74: (1) orbs in the one pickup pass, (2) a mob passenger takes its vehicle's fall at once, (3) skin PNGs decode without premultiplication.

// --- skin decode: the 13 executed ImageBufferDownload inputs (skin-parse-reference.json), written as PNGs and read back ---
const ref = JSON.parse(readFileSync(new URL("../public/research/skin-parse-reference.json", import.meta.url), "utf8"));
const argb = (b64) => { const b = Buffer.from(b64, "base64"), out = []; for (let i = 0; i < b.length; i += 4) out.push(b.readUInt32BE(i)); return out; };
const toRgba = (ints) => { const o = new Uint8ClampedArray(ints.length * 4); ints.forEach((v, i) => { o[i * 4] = v >>> 16 & 255; o[i * 4 + 1] = v >>> 8 & 255; o[i * 4 + 2] = v & 255; o[i * 4 + 3] = v >>> 24; }); return o; };
const toArgb = (rgba) => { const o = []; for (let i = 0; i < rgba.length; i += 4) o.push(((rgba[i + 3] << 24) | (rgba[i] << 16) | (rgba[i + 1] << 8) | rgba[i + 2]) >>> 0); return o; };
const CRC = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b) => { let c = 0xffffffff; for (const x of b) c = CRC[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => { const o = Buffer.alloc(12 + data.length); o.writeUInt32BE(data.length, 0); o.write(type, 4, "ascii"); Buffer.from(data).copy(o, 8); o.writeUInt32BE(crc(o.subarray(4, 8 + data.length)), 8 + data.length); return o; };
// rows: array of byte arrays (already packed); filter(y) picks the filter type per row.
function pngOf(width, height, depth, ctype, rows, { filter = () => 0, extra = [], interlace = 0, bpp = 1 } = {}) {
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = depth; ihdr[9] = ctype; ihdr[12] = interlace;
  const parts = rows.map((row, y) => {
    const t = filter(y), prev = y ? rows[y - 1] : null, out = Buffer.alloc(row.length + 1); out[0] = t;
    for (let i = 0; i < row.length; i++) {
      const a = i >= bpp ? row[i - bpp] : 0, b = prev ? prev[i] : 0, c = prev && i >= bpp ? prev[i - bpp] : 0;
      let p = 0;
      if (t === 1) p = a; else if (t === 2) p = b; else if (t === 3) p = (a + b) >> 1;
      else if (t === 4) { const q = a + b - c, pa = Math.abs(q - a), pb = Math.abs(q - b), pc = Math.abs(q - c); p = pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      out[i + 1] = (row[i] - p) & 255;
    }
    return out;
  });
  return new Uint8Array(Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), ...extra, chunk("IDAT", deflateSync(Buffer.concat(parts))), chunk("IEND", Buffer.alloc(0))]));
}
const rgbaRows = (rgba, w, h) => Array.from({ length: h }, (_, y) => Array.from(rgba.subarray(y * w * 4, (y + 1) * w * 4)));

for (const r of ref.records.filter((x) => x.output)) {
  test(`skin PNG decode keeps straight alpha, then equals native parseUserSkin: ${r.case}`, async () => {
    const rgba = toRgba(argb(r.input));
    const dec = await decodePng(pngOf(r.width, r.height, 8, 6, rgbaRows(rgba, r.width, r.height), { filter: (y) => y % 5, bpp: 4 }));
    assert.equal(dec.width, r.width); assert.equal(dec.height, r.height);
    assert.deepEqual(Array.from(dec.data), Array.from(rgba), "exact bytes, no premultiply round trip");
    assert.deepEqual(toArgb(userSkinPixels(dec.data, dec.width, dec.height)), argb(r.output));
  });
}

test("a partly transparent pixel survives the decode exactly where a premultiplied canvas would move it", async () => {
  const px = [200, 101, 33, 77];
  const dec = await decodePng(pngOf(1, 1, 8, 6, [px], { bpp: 4 }));
  assert.deepEqual(Array.from(dec.data), px);
  const premult = px.slice(0, 3).map((v) => Math.round(Math.round(v * 77 / 255) * 255 / 77)); // what getImageData hands back after a premultiplied store
  assert.notDeepEqual(premult, px.slice(0, 3));
});

test("other PNG layouts: gray 4-bit, palette with tRNS, 16-bit RGB, gray+alpha, Adam7", async () => {
  const g4 = await decodePng(pngOf(3, 1, 4, 0, [[0x0f, 0x80]], { bpp: 1 })); // samples 0, 15, 8
  assert.deepEqual(Array.from(g4.data), [0, 0, 0, 255, 255, 255, 255, 255, 136, 136, 136, 255]);
  const pal = await decodePng(pngOf(2, 1, 8, 3, [[1, 0]], { extra: [chunk("PLTE", [10, 20, 30, 40, 50, 60]), chunk("tRNS", [255, 9])] }));
  assert.deepEqual(Array.from(pal.data), [40, 50, 60, 9, 10, 20, 30, 255]);
  const rgb16 = await decodePng(pngOf(1, 1, 16, 2, [[0xab, 0xcd, 0x12, 0x34, 0xff, 0x00]], { bpp: 6 }));
  assert.deepEqual(Array.from(rgb16.data), [0xab, 0x12, 0xff, 255]);
  const ga = await decodePng(pngOf(2, 1, 8, 4, [[10, 20, 30, 40]], { filter: () => 1, bpp: 2 }));
  assert.deepEqual(Array.from(ga.data), [10, 10, 10, 20, 30, 30, 30, 40]);
  // Adam7 of a 3 x 3 gray image: pass 1 holds (0,0); pass 2 none (x0 4); pass 3 none; pass 4 (2,0); pass 5 (0,2),(2,2)?? computed from the pass table
  const W = 3, H = 3, img = (x, y) => y * 3 + x + 1, passes = [[0, 0, 8, 8], [4, 0, 8, 8], [0, 4, 4, 8], [2, 0, 4, 4], [0, 2, 2, 4], [1, 0, 2, 2], [0, 1, 1, 2]];
  const rows = [];
  for (const [x0, y0, dx, dy] of passes) for (let y = y0; y < H; y += dy) { const row = []; for (let x = x0; x < W; x += dx) row.push(img(x, y)); if (row.length) rows.push(row); }
  const adam = await decodePng(pngOf(W, H, 8, 0, rows, { interlace: 1 }));
  assert.deepEqual(Array.from({ length: 9 }, (_, i) => adam.data[i * 4]), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  await assert.rejects(decodePng(new Uint8Array(40)));
});

// --- orbs in the pickup pass ---
const STONE = 3;
function pickupScene(orbFirst) {
  const items = new ItemEntities(() => 0.5), orbs = new ExperienceOrbs([], () => 0.5), arrows = new Arrows(), survival = new Survival({}, "survival");
  const make = {
    item: () => { const e = items.spawn({ id: STONE, count: 1, damage: 0 }, 0.5, 0, 0.5, { motion: [0, 0, 0] }); stampEntity(e, 0.5, 0, 0.5); return e; },
    orb: () => { const e = newOrb(5, 0.5, 0, 0.5, () => 0); orbs.orbs.push(e); stampEntity(e, 0.5, 0, 0.5); return e; },
  };
  for (const k of orbFirst ? ["orb", "item"] : ["item", "orb"]) make[k]();
  return { items, orbs, arrows, survival };
}
for (const orbFirst of [true, false]) {
  test(`the orb's sound and its xp come in list order with the item's pop (${orbFirst ? "orb" : "item"} first)`, () => {
    const s = pickupScene(orbFirst), order = [];
    const half = Math.fround(0.6) / 2, feet = { x: 0.5, y: 0, z: 0.5 }, playerBox = [0.5 - half, 0, 0.5 - half, 0.5 + half, Math.fround(1.8), 0.5 + half];
    collectPickups({ ...s, feet, width: 0.6, height: 1.8, playerBox, add: (st) => s.survival.inventory.add(st) }, {
      itemPicked: () => order.push("item"), orbTaken: (v) => order.push(`orb${v}`),
    });
    assert.deepEqual(order, orbFirst ? ["orb5", "item"] : ["item", "orb5"]);
  });
}

test("finishEntitySimulation: random.orb is played between the pops, then the xp is added; the cooldown holds a second orb back", () => {
  const s = pickupScene(false), log = [];
  const o2 = newOrb(3, 0.5, 0, 0.5, () => 0); s.orbs.orbs.push(o2); stampEntity(o2, 0.5, 0, 0.5);
  const state = { ...s, xpOrbs: s.orbs, position: { x: 0.5, y: 0, z: 0.5 }, width: 0.6, height: 1.8, mobs: { walks: new Map([["item", 1]]) }, projectiles: { tickEffects() {}, drain: () => [] } };
  finishEntitySimulation(state, { itemPicked: () => log.push("pop"), orbSound: (e) => log.push(e.name), orbTaken: (v) => log.push(`xp${v}`) });
  assert.deepEqual(log, ["pop", "random.orb", "xp5"]);
  assert.equal(s.orbs.orbs.length, 1, "xpCooldown 2 leaves the second orb for a later tick");
  s.orbs.coolDown(); s.orbs.coolDown();
  assert.equal(s.orbs.collect({ x: 0.5, y: 0, z: 0.5 }), 3, "collect (the no-walk path) still works");
});

test("living-simulation leaves the orbs to the pickup pass when orbPass is set, main.js sets it", () => {
  const living = readFileSync(new URL("./living-simulation.js", import.meta.url), "utf8"), main = readFileSync(new URL("./main.js", import.meta.url), "utf8");
  assert.match(living, /state\.orbPass\) xpOrbs\.coolDown\(\)/);
  assert.match(main, /orbPass: isWalked\(mobs\) && !!entityTick/);
  assert.match(main, /orbTaken: \(amount\) =>/);
});

// --- mob passenger fall at once ---
test("a mob passenger takes the vehicle's fall inside passFall once it has had a turn; before that it is queued", () => {
  const flat = { numericSeed: 1, solid: (x, y, z) => y < 1, get: (x, y, z) => (y < 1 ? 1 : 0), getMeta: () => 0, surface: () => 1, spawn: () => ({ x: 64.5, y: 1, z: 64.5 }) };
  const w = new EntityWorld(flat, [{ id: "mob-1", type: "zombie", x: 64.5, y: 1, z: 64.5, health: 20 }]);
  const boats = new Boats(), boat = boats.spawnBoat({ x: 64.5, y: 1.2, z: 64.5 }, { seed: 7 }), [zombie] = w.entities;
  assert.ok(mountMobOnVehicle(boat, zombie, (m) => w.size(m)[1]));
  passFall(boat, 8); // no turn yet: queued, nothing happens
  assert.equal(zombie.health, 20);
  const night = { health: 20, creative: false, time: 18000, damage() {}, scaledDamage() {}, count: () => 0 };
  w.tick({ x: 0.5, y: 1, z: 0.5, onGround: true, health: 20, creative: false }, night);
  assert.equal(typeof zombie.vehicleFall, "function", "installed at its first turn aboard");
  assert.equal(zombie.health, 15, "the queued fall: ceil(8 - 3) = 5");
  const hurt = zombie.health;
  zombie.hurt = 0;
  passFall(boat, 5); // 2 points
  assert.ok(zombie.health < hurt, "taken inside passFall, not at the next turn");
});
