// Batch 65: the terrain atlas the chunk mesher samples is stitched at an HD pack's sprite sizes (terrain-layout.js, stitcher.js); with no pack it is the executed
// 512x256 / 349 sprite layout, unchanged. Executed evidence: hdCases / atlases.blocks of public/research/stitcher-reference.json (tools/verify-stitcher.mjs).
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { terrainLayout, vanillaTerrainLayout, nonVanillaSizes } from "./terrain-layout.js";
import { TILES, TILE_ORIGINS, TILE_SIZES, ATLAS_WIDTH, ATLAS_HEIGHT, tileRect, tileAtUv, setTerrainSizes, terrainLayoutState, terrainMipCap, tileByName, spriteUv } from "./block-textures.js";
import { NATIVE_BLOCK_SPRITES } from "./atlas-layout.js";

const ref = JSON.parse(await readFile(new URL("../public/research/stitcher-reference.json", import.meta.url))), F = Math.fround;

// The pre-batch-65 layout code of block-textures.js, kept here verbatim as the oracle for "byte-identical with no pack".
function oldLayout(tiles) {
  const busy = new Set(), mark = (x, y, w) => { for (let j = 0; j < w; j += 16) for (let i = 0; i < w; i += 16) busy.add((x + i) + "," + (y + j)); };
  for (const [x, y, w] of Object.values(NATIVE_BLOCK_SPRITES)) mark(x, y, w);
  let cx = 0, cy = 0;
  const origins = tiles.map((name) => { const n = NATIVE_BLOCK_SPRITES[name]; if (n) return [n[0], n[1]];
    while (busy.has(cx + "," + cy)) { cx += 16; if (cx >= 512) { cx = 0; cy += 16; } }
    const o = [cx, cy]; busy.add(cx + "," + cy); return o; });
  return { origins, height: Math.max(256 / 16, ...origins.map((o) => o[1] / 16 + 1)) * 16 };
}

test("no pack: the layout is the executed 512x256 atlas with 349 sprites, identical to the old code", () => {
  const a = ref.atlases.blocks;
  assert.deepEqual([a.width, a.height, a.sprites.length], [512, 256, 349]);
  assert.deepEqual([ATLAS_WIDTH, ATLAS_HEIGHT], [512, 256]);
  assert.equal(Object.keys(NATIVE_BLOCK_SPRITES).length, 349);
  const old = oldLayout(TILES);
  assert.deepEqual(TILE_ORIGINS, old.origins);
  assert.equal(ATLAS_HEIGHT, old.height);
  assert.ok(TILE_SIZES.every((s) => s === 16));
  for (const s of a.sprites) { const i = TILES.indexOf(s.name); if (i >= 0) assert.deepEqual(TILE_ORIGINS[i], [s.x, s.y], s.name); }
  // a pin of the whole layout: names, origins, atlas size
  const digest = createHash("sha256").update(JSON.stringify([ATLAS_WIDTH, ATLAS_HEIGHT, TILES.map((n, i) => [n, ...TILE_ORIGINS[i]])])).digest("hex");
  assert.equal(digest, createHash("sha256").update(JSON.stringify([512, old.height, TILES.map((n, i) => [n, ...old.origins[i]])])).digest("hex"));
  assert.deepEqual(terrainLayout(TILES, new Map(TILES.map((n) => [n, 16]))).origins, old.origins, "all tiles at 16 px is still the vanilla layout");
  assert.equal(terrainLayout(TILES).hd, false);
  assert.equal(terrainMipCap(), 4);
});

test("tileRect and tileAtUv on the vanilla layout are the native initSprite uv", () => {
  const s = ref.atlases.blocks.sprites.find((q) => q.name === "stone"), i = tileByName("stone"), r = tileRect(i);
  assert.equal(r.u0, F(s.minU)); assert.equal(r.u1, F(s.maxU));
  assert.equal(r.v1, 1 - F(s.minV)); assert.equal(r.v0, 1 - F(s.maxV));
  assert.equal(tileAtUv((r.u0 + r.u1) / 2, (r.v0 + r.v1) / 2), i);
});

test("HD sprite sets: native positions, atlas size and mip level equal the executed Stitcher runs", () => {
  const names = Object.keys(NATIVE_BLOCK_SPRITES); let checked = 0;
  for (const c of ref.hdCases.filter((c) => c.type === "blocks")) {
    const known = new Map(c.input.map(([name, size]) => [name, size])), l = terrainLayout(names, known, { mip: c.mip });
    assert.deepEqual([l.width, l.height], [c.width, c.height], c.rule);
    for (const [name, x, y, w] of c.sprites) { const i = names.indexOf(name); assert.deepEqual([...l.origins[i], l.sizes[i]], [x, y, w], `${c.rule} ${name}`); checked++; }
  }
  assert.ok(checked > 2000);
});

test("with the port-only tiles an HD atlas keeps every native position and places the chest faces in free cells without overlap", () => {
  const known = new Map(Object.keys(NATIVE_BLOCK_SPRITES).map((n) => [n, NATIVE_BLOCK_SPRITES[n][2] * 4]));
  for (const t of ["chest_front", "chest_side", "chest_top"]) known.set(t, 64);
  const l = terrainLayout(TILES, known), names = Object.keys(NATIVE_BLOCK_SPRITES);
  const plain = terrainLayout(names, known);
  assert.equal(l.hd, true); assert.deepEqual([l.width, l.height], [plain.width, plain.height]);
  TILES.forEach((n, i) => { const k = names.indexOf(n); if (k >= 0) assert.deepEqual(l.origins[i], plain.origins[k], n); });
  const boxes = TILES.map((n, i) => [...l.origins[i], l.sizes[i]]);
  for (const [x, y, s] of boxes) assert.ok(x + s <= l.width && y + s <= l.height);
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) { const [a, b, s] = boxes[i], [c, d, t] = boxes[j]; assert.ok(a + s <= c || c + t <= a || b + s <= d || d + t <= b, `${TILES[i]} overlaps ${TILES[j]}`); }
  assert.equal(TILE_SIZES.length, TILES.length);
});

test("mixed sizes, an 8 px sprite and the mip limit", () => {
  const known = new Map([["stone", 64], ["dirt", 8]]), l = terrainLayout(TILES, known, { mip: 4 });
  assert.equal(l.sizes[TILES.indexOf("stone")], 64); assert.equal(l.sizes[TILES.indexOf("dirt")], 8); assert.equal(l.sizes[TILES.indexOf("sand")], 16);
  assert.equal(l.mipCap, 3, "the smallest sprite (8 px) limits the mip chain");
  assert.equal(terrainLayout(TILES, new Map([["stone", 64]])).mipCap, 4);
});

test("a pack too large for GL_MAX_TEXTURE_SIZE falls back to smaller sprites instead of failing", () => {
  const known = new Map(Object.keys(NATIVE_BLOCK_SPRITES).map((n) => [n, 512]));
  const l = terrainLayout(TILES, known, { maxSize: 2048 });
  assert.ok(l.width <= 2048 && l.height <= 2048 && l.scaledDown);
  assert.ok(l.sizes.every((s) => s >= 16 && s < 512));
});

test("setTerrainSizes moves the live layout, uv and tile lookup, and vanilla sizes restore the executed one", () => {
  const stone = tileByName("stone"), sand = tileByName("sand"), vanilla = JSON.stringify(TILE_ORIGINS);
  const known = new Map(TILES.map((n) => [n, n === "stone" ? 256 : 16]));
  assert.equal(setTerrainSizes(known, { mip: 4 }), true);
  assert.equal(terrainLayoutState().version > 0, true);
  assert.deepEqual(terrainLayoutState().sizes, { stone: 256 });
  assert.notEqual(ATLAS_WIDTH * ATLAS_HEIGHT, 512 * 256);
  const r = tileRect(stone), [x, y] = TILE_ORIGINS[stone], s = spriteUv(x, y, 256, 256, ATLAS_WIDTH, ATLAS_HEIGHT);
  assert.equal(r.u0, s.minU); assert.equal(r.u1, s.maxU); assert.equal(r.v1, 1 - s.minV);
  assert.ok((r.u1 - r.u0) * ATLAS_WIDTH > 255.9, "the stone cell is 256 texels wide");
  assert.equal(tileAtUv((r.u0 + r.u1) / 2, (r.v0 + r.v1) / 2), stone);
  const q = tileRect(sand); assert.ok(Math.abs((q.u1 - q.u0) * ATLAS_WIDTH - 16) < 0.05);
  assert.equal(setTerrainSizes(new Map(), { mip: 4 }), true);
  assert.equal(JSON.stringify(TILE_ORIGINS), vanilla); assert.deepEqual([ATLAS_WIDTH, ATLAS_HEIGHT], [512, 256]);
  assert.deepEqual(nonVanillaSizes(new Map([["stone", 16], ["dirt", 32]])), { dirt: 32 });
});

test("the mesher's torch uv follows the tile size", async () => {
  const { ChunkMesher } = await import("./chunk-mesher.js");
  const calls = [];
  const mesher = Object.create(ChunkMesher.prototype, { world: { value: { getMeta: () => 5 } }, light: { value: { packed: () => 15 } } });
  mesher.torchAt = (m, x, y, z, meta, uv) => calls.push(uv(8, 8));
  const t = tileByName("torch_on");
  mesher.torch(null, 0, 0, 0, 20);
  const [x, y] = TILE_ORIGINS[t]; assert.deepEqual(calls[0], [(x + 8) / 512, 1 - (y + 8) / 256]);
  setTerrainSizes(new Map([["torch_on", 64]]), {});
  const [x2, y2] = TILE_ORIGINS[t]; mesher.torch(null, 0, 0, 0, 20);
  assert.deepEqual(calls[1], [(x2 + 32) / ATLAS_WIDTH, 1 - (y2 + 32) / ATLAS_HEIGHT]);
  setTerrainSizes(new Map(), {});
});
