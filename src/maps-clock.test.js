import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { MAP_COLOR_RGB, mapByteRgb, blockMapColor, blockIsLiquid, blockLightOpacity } from "./map-colors.js";
import { MAP_BLOCKS } from "./map-colors-data.js";
import {
  MapStore, createMapData, createEmptyMapData, mapOnCreated, updateMapData, updateVisiblePlayers, mapCloneResult, mapExtendResult,
  ITEM_FILLED_MAP, ITEM_EMPTY_MAP, ITEM_PAPER,
} from "./maps.js";
import { celestialAngle, createClock, tickClock } from "./clock.js";

const ref = JSON.parse(await readFile(new URL("../public/research/maps-clock-reference.json", import.meta.url)));
const by = (c) => ref.records.filter((r) => r.case === c);

// ---- the probe's closed-form terrain (MapsClockProbe.column), integer maths only ----
const fm = (a, m) => ((a % m) + m) % m, floorDiv = (a, m) => Math.floor(a / m);
const tri = (n, p) => Math.abs(fm(n, 2 * p) - p);
const height = (x, z) => 56 + Math.floor(tri(x, 20) / 3) + Math.floor(tri(z, 26) / 4) + Math.floor(tri(x + z, 14) / 5);
const hash = (a, b) => { let h = Math.imul(a, 73856093) ^ Math.imul(b, 19349663); h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15; return h | 0; };
const kind = (x, z) => fm(hash(floorDiv(x, 8), floorDiv(z, 8)), 16);
const SURFACE = [2, 2, 2, 2, 2, 12, 1, 3, 35, 13, 82, 80, 24, 79, 87, 5];
const surfaceMeta = (k, x, z) => k === 8 ? fm(hash(floorDiv(x, 8), floorDiv(z, 8)) >> 4, 16) : k === 15 ? fm(floorDiv(x, 8) + floorDiv(z, 8), 4) : 0;
const treeCentre = (cx, cz) => fm(cx, 9) === 0 && fm(cz, 11) === 0 && height(cx, cz) >= 62 && kind(cx, cz) <= 4;
const columns = new Map();
function column(x, z) {
  const c = new Int32Array(256), h = height(x, z), k = kind(x, z);
  c[0] = 7 << 4;
  for (let y = 1; y < h - 3; y++) c[y] = 1 << 4;
  for (let y = Math.max(1, h - 3); y < h; y++) c[y] = (k === 5 || h < 62 ? 12 : k === 12 ? 24 : k === 6 ? 1 : 3) << 4;
  if (h < 62) {
    c[h] = (k % 2 === 0 ? 12 : k % 3 === 0 ? 82 : 13) << 4;
    for (let y = h + 1; y <= 62; y++) c[y] = 9 << 4;
  } else {
    c[h] = SURFACE[k] << 4 | surfaceMeta(k, x, z);
    if (k === 11) c[h + 1] = 78 << 4;
    if (k === 5 && fm(x, 7) === 0 && fm(z, 5) === 0) c[h + 1] = 81 << 4;
  }
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
    const cx = x + dx, cz = z + dz;
    if (!treeCentre(cx, cz)) continue;
    const hc = height(cx, cz), lm = fm(cx + cz, 4);
    if (dx === 0 && dz === 0) for (let y = hc + 1; y <= hc + 3; y++) c[y] = 17 << 4 | fm(cx, 4);
    if (!(dx === 0 && dz === 0)) c[hc + 3] = 18 << 4 | lm;
    c[hc + 4] = 18 << 4 | lm;
  }
  return c;
}
const col = (x, z) => { const key = `${x},${z}`; let c = columns.get(key); if (!c) columns.set(key, c = column(x, z)); return c; };
const terrain = (emptyColumn2) => ({
  blockAt: (x, y, z) => (y < 0 || y > 255 ? 0 : col(x, z)[y]),
  chunkEmpty: (x) => emptyColumn2 && Math.floor(x / 16) === 2,
});
const rle = (bytes) => { const out = []; for (let i = 0; i < bytes.length;) { let j = i; while (j < bytes.length && bytes[j] === bytes[i]) j++; out.push(bytes[i], j - i); i = j; } return out; };
const expand = (runs) => { const out = new Int8Array(16384); let at = 0; for (let i = 0; i < runs.length; i += 2) { out.fill(runs[i], at, at + runs[i + 1]); at += runs[i + 1]; } return out; };

test("MapColor table and shades match awv", () => {
  const rows = by("mapColor");
  assert.equal(rows.length, 36);
  for (const r of rows) {
    assert.equal(MAP_COLOR_RGB[r.index], r.rgb);
    for (let shade = 0; shade < 4; shade++) {
      if (r.index === 0) continue;
      const [R, G, B, A] = mapByteRgb(r.index * 4 + shade), argb = (A << 24 | R << 16 | G << 8 | B) | 0;
      assert.equal(argb, r.shades[shade], `colour ${r.index} shade ${shade}`);
    }
  }
});

test("Block.getMapColor, liquid and light opacity match for every original block", () => {
  const rows = by("blockColor");
  assert.equal(rows.length, 171);
  for (const r of rows) {
    for (let meta = 0; meta < 16; meta++) assert.equal(blockMapColor(r.id, meta), r.colors[meta], `block ${r.id}:${meta}`);
    assert.equal(blockIsLiquid(r.id), r.liquid);
    assert.equal(blockLightOpacity(r.id), r.opacity);
  }
  assert.equal(Object.keys(MAP_BLOCKS).length, rows.length);
});

test("ItemEmptyMap creates a scale 0 map centred by Math.round(position / 128) * 128", () => {
  const store = new MapStore();
  for (const r of by("empty")) {
    const data = createEmptyMapData(store, { x: r.at[0], z: r.at[1], dimension: 0 });
    assert.equal(data.id, r.result[1]);
    assert.deepEqual({ id: `map_${data.id}`, scale: data.scale, xCenter: data.xCenter, zCenter: data.zCenter, dimension: data.dimension }, r.data);
  }
  const nether = createEmptyMapData(store, { x: 500, z: 500, dimension: -1 }), n = by("emptyDimension")[0].data;
  assert.deepEqual([nether.xCenter, nether.zCenter, nether.dimension], [n.xCenter, n.zCenter, n.dimension]);
});

test("ItemMap.getMapData creates a missing map at scale 3 with the 1.7.10 spawn rounding", () => {
  for (const r of by("autoCreate")) {
    const store = new MapStore(); store.counter = r.damageAfter; store.spawn = { x: r.spawn[0], z: r.spawn[1] };
    const stack = { id: ITEM_FILLED_MAP, count: 1, damage: 5 }, data = store.ensure(stack);
    assert.equal(stack.damage, r.damageAfter, "a new id");
    assert.deepEqual({ scale: data.scale, xCenter: data.xCenter, zCenter: data.zCenter, dimension: data.dimension }, { scale: r.data.scale, xCenter: r.data.xCenter, zCenter: r.data.zCenter, dimension: r.data.dimension });
  }
});

test("ItemMap.onCreated zooms out with a new id and stops at scale 4", () => {
  const store = new MapStore();
  const stack = { id: ITEM_FILLED_MAP, count: 1, damage: createEmptyMapData(store, { x: 300, z: -200, dimension: 0 }).id };
  for (const r of by("scaling")) {
    assert.equal(stack.damage, r.oldDamage);
    stack.mapScaling = true;
    mapOnCreated(store, stack);
    assert.equal(stack.damage, r.newDamage);
    assert.equal(stack.mapScaling, undefined);
    const data = store.get(stack.damage);
    assert.deepEqual({ scale: data.scale, xCenter: data.xCenter, zCenter: data.zCenter, dimension: data.dimension }, { scale: r.data.scale, xCenter: r.data.xCenter, zCenter: r.data.zCenter, dimension: r.data.dimension });
  }
  const plain = { id: ITEM_FILLED_MAP, count: 1, damage: 77 };
  mapOnCreated(store, plain);
  assert.equal(plain.damage, by("scalingPlain")[0].damage);
});

test("ItemMap.updateMapData reproduces the colours and dirty columns of the original", () => {
  const scenarios = by("update");
  assert.equal(scenarios.length, 8);
  for (const r of scenarios) {
    const data = createMapData(0, { scale: r.scale, xCenter: r.xCenter, zCenter: r.zCenter, dimension: r.dimension });
    const ties = new Set(), ctx = { ...terrain(r.emptyChunkColumn2), dimension: r.dimension, noSky: r.noSky, onTie: (x, z) => ties.add(x + z * 128) };
    const player = { name: "Steve", x: r.player[0], z: r.player[1] };
    const snapshots = new Map();
    for (let call = 1; call <= 32; call++) {
      data.dirtyColumns = new Map();
      updateMapData(data, ctx, player);
      snapshots.set(call, { colors: Int8Array.from(data.colors), dirty: [...data.dirtyColumns].map(([x, [lo, hi]]) => [x, lo, hi]).sort((a, b) => a[0] - b[0]) });
    }
    for (const s of r.snapshots) {
      const expected = expand(s.rle), got = snapshots.get(s.call);
      let compared = 0;
      for (let i = 0; i < 16384; i++) {
        if (ties.has(i)) continue; // HashMultiset ties are ordered by identity hash in the original
        compared++;
        assert.equal(got.colors[i], expected[i], `${r.name} call ${s.call} cell ${i % 128},${Math.floor(i / 128)}`);
      }
      assert.ok(compared > 16384 * 0.9 || r.scale >= 3, `${r.name}: most cells compared`);
      if (ties.size === 0) assert.deepEqual(got.dirty, s.dirty, `${r.name} call ${s.call} dirty`);
      else assert.deepEqual(got.dirty.map((d) => d[0]), s.dirty.map((d) => d[0]), `${r.name} call ${s.call} dirty columns`);
    }
  }
});

test("MapData.updateVisiblePlayers decorations match the original", () => {
  for (const r of by("decor")) {
    const data = createMapData(1, { scale: r.scale, dimension: r.mapDimension });
    updateVisiblePlayers(data, { name: "Steve", x: r.player[0], z: r.player[1], yaw: r.player[2], dimension: r.playerDimension }, r.holds, r.time);
    assert.deepEqual([...data.decorations].map(([k, v]) => [k, ...v]), r.decorations, JSON.stringify(r));
  }
});

test("map cloning and zoom recipes match RecipesMapCloning and RecipesMapExtending", () => {
  const store = new MapStore();
  const cell = { P: { id: ITEM_PAPER, count: 1, damage: 0 }, E: { id: ITEM_EMPTY_MAP, count: 1, damage: 0 } };
  for (const r of by("recipe")) {
    const named = r.map.includes("name"), damage = r.map.startsWith("M=1:0") ? 0 : 7;
    store.maps.clear();
    const seed = createMapData(7, { scale: r.map.includes("scale4") ? 4 : 0 }), zero = createMapData(0, { scale: 0 });
    store.set(seed); store.set(zero);
    const cells = r.grid.split(" ").map((c) => c === "." ? null : c === "M" ? { id: ITEM_FILLED_MAP, count: 1, damage, ...(named ? { displayName: "Atlas" } : {}) } : { ...cell[c] });
    const clone = mapCloneResult(cells), extend = mapExtendResult(cells, r.size, store);
    assert.equal(!!clone, r.clone.matches, `clone ${r.grid}`);
    assert.equal(!!extend, r.extend.matches, `extend ${r.grid} ${r.map}`);
    if (clone) assert.deepEqual([clone.count, clone.damage, clone.displayName ?? null], [r.clone.result.count, r.clone.result.damage, r.clone.result.name]);
    if (extend) assert.deepEqual([extend.count, extend.damage, !!extend.mapScaling], [r.extend.result.count, r.extend.result.damage, r.extend.result.scaling]);
  }
});

test("TextureClock frames follow the original for settled and continuous time", () => {
  for (const r of by("clockSettle")) {
    assert.equal(celestialAngle(r.time), r.angle, `angle at ${r.time}`);
    const clock = createClock(), samples = new Map(r.samples.map((s) => [s[0], s]));
    for (let i = 0; i < 400; i++) {
      tickClock(clock, celestialAngle(r.time));
      const s = samples.get(i);
      if (s) { assert.equal(clock.frame, s[1], `${r.time} tick ${i}`); assert.equal(clock.angle, s[2]); assert.equal(clock.velocity, s[3]); }
    }
  }
  const clock = createClock(), samples = new Map(by("clockDay")[0].samples.map((s) => [s[0], s]));
  for (let t = 0; t < 27000; t++) {
    tickClock(clock, celestialAngle(t % 24000));
    const s = samples.get(t);
    if (s) { assert.equal(clock.frame, s[2], `day tick ${t}`); assert.equal(clock.angle, s[3]); }
  }
});
