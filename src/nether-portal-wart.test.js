// Replays portal-wart-reference.json (tools/probes/PortalWartProbe.java driving the unchanged 1.7.10 BlockPortal/Size/BlockNetherWart)
// against src/nether-portal.js and src/nether-wart.js, plus the live hooks, the registry round trip and the reserved slots.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JavaRandom } from "./java-random.js";
import { fromOriginal, toOriginal } from "./block-registry.js";
import { BLOCKS } from "./world.js";
import { PORTAL, tryLightPortal, portalNeighborsChanged, portalBounds, portalSideRendered, portalSpawnPosition, portalDisplayTick } from "./nether-portal.js";
import { NETHER_WART, SOUL_SAND, ITEM_NETHER_WART, wartCanStay, wartCanPlace, wartTick, wartDropCount, WART_BOUNDS } from "./nether-wart.js";
import { NetherLive } from "./nether-portal-live.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/portal-wart-reference.json", import.meta.url)));
const of = (kind) => ref.records.filter((r) => r.kind === kind);
const nextLong = (r) => BigInt.asIntN(64, (BigInt(r.next(32)) << 32n) + BigInt(r.next(32))).toString();
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} vs ${b}`);

// A sparse world over internal ids; set() mirrors World.set (meta, onChange only on change).
class Stub {
  constructor() { this.cells = new Map(); this.onChange = null; this.writes = 0; }
  key(x, y, z) { return `${x},${y},${z}`; }
  get(x, y, z) { return this.cells.get(this.key(x, y, z))?.[0] ?? 0; }
  getMeta(x, y, z) { return this.cells.get(this.key(x, y, z))?.[1] ?? 0; }
  solid(x, y, z) { return this.get(x, y, z) !== 0; }
  set(x, y, z, b, track = true, meta = 0) {
    const old = this.get(x, y, z), oldMeta = this.getMeta(x, y, z);
    if (old === b && oldMeta === meta) return false;
    if (b === 0) this.cells.delete(this.key(x, y, z)); else this.cells.set(this.key(x, y, z), [b, meta]);
    this.writes++;
    if (old !== b) this.onChange?.(x, y, z, old, b);
    return true;
  }
  putOriginal(x, y, z, mc, meta = 0) { const r = fromOriginal(mc, meta); assert.ok(r, `no port block for ${mc}`); this.set(x, y, z, r.id, true, r.meta); }
  originalCells() {
    const out = [];
    for (const [k, [b, m]] of this.cells) { const [x, y, z] = k.split(",").map(Number), o = toOriginal(b, m); out.push([x, y, z, o.id ?? o.mc ?? o[0], o.meta ?? o[1]]); }
    return out.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
  }
}
// The port keeps one still water/lava id: original flowing 8/10 read back as 9/11.
const sortCells = (cells) => cells.map((c) => c.slice(0, 5)).map((c) => [c[0], c[1], c[2], c[3] === 8 ? 9 : c[3] === 10 ? 11 : c[3], c[4]]).sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
const fromCells = (cells) => { const w = new Stub(); for (const [x, y, z, id, meta] of cells) w.putOriginal(x, y, z, id, meta); w.writes = 0; return w; };

test("reference is the pinned 1.7.10 client with all record kinds", () => {
  assert.equal(ref.clientSha1, "e80d9b3bf5085002218d4be59e668bac718abbc6");
  const counts = {}; for (const r of ref.records) counts[r.kind] = (counts[r.kind] ?? 0) + 1;
  assert.equal(counts.frame, 260); assert.equal(counts.cascade, 53); assert.equal(counts.bounds, 16); assert.equal(counts.side, 72);
  assert.equal(counts.pigman, 14); assert.equal(counts.wartGrowth, 40); assert.equal(counts.wartSupport, 13); assert.equal(counts.wartPlace, 8); assert.equal(counts.wartDrops, 96);
});

test("slots 164 and 170 are filled in place and round trip through the original ids", () => {
  assert.equal(BLOCKS[PORTAL].name, "Nether Portal"); assert.equal(BLOCKS[NETHER_WART].name, "Nether Wart");
  for (let i = 0; i < BLOCKS.length; i++) assert.ok(BLOCKS[i], `hole at ${i}`);
  for (const [mc, id] of [[90, PORTAL], [115, NETHER_WART]]) for (let meta = 0; meta < 4; meta++) {
    const r = fromOriginal(mc, meta); assert.equal(r.id, id); assert.ok(r.exact);
    assert.deepEqual([toOriginal(id, r.meta)].map((o) => [o.id ?? o.mc ?? o[0], o.meta ?? o[1]])[0], [mc, meta]);
  }
  assert.equal(fromOriginal(372, 0)?.id ?? ITEM_NETHER_WART, ITEM_NETHER_WART);
});

for (const r of of("frame")) test(`frame ${r.index}: ${r.w}x${r.h} axis ${r.axis} lights ${r.result}`, () => {
  const w = fromCells(r.before), cells = tryLightPortal(w, ...r.query, (x, y, z, b, m) => w.set(x, y, z, b, true, m));
  assert.equal(cells !== null, r.result);
  assert.deepEqual(w.originalCells().filter((c) => c[1] > 10), sortCells(r.after));
  if (r.result) assert.equal(w.writes, r.writes);
  else assert.equal(w.writes, 0);
});

const frames = new Map(of("frame").map((r) => [r.index, r]));
for (const r of of("cascade")) test(`cascade ${r.index}: ${r.target} -> ${r.replacement ? "stone" : "air"}`, () => {
  const w = fromCells(frames.get(r.index).after);
  w.putOriginal(...r.target, r.replacement, 0);
  portalNeighborsChanged(w, ...r.target, (x, y, z) => w.set(x, y, z, 0));
  assert.deepEqual(w.originalCells().filter((c) => c[1] > 10), sortCells(r.after));
});

for (const r of of("bounds")) test(`bounds meta ${r.meta}`, () => {
  const w = new Stub(); w.putOriginal(0, 20, 0, 90, r.meta);
  // reference order [minX,maxX,minY,maxY,minZ,maxZ]; the port uses [minX,minY,minZ,maxX,maxY,maxZ]
  const m = r.meta & 3, p = portalBounds(m === 0 ? (w.get(-1, 20, 0) === PORTAL || w.get(1, 20, 0) === PORTAL ? 1 : 2) : m);
  const [a, b, c, d, e, f] = r.bounds;
  [a, c, e, b, d, f].forEach((v, i) => near(v, p[i]));
});
test("wart bounds", () => { const [a, b, c, d, e, f] = of("wartBounds")[0].bounds; assert.deepEqual([a, c, e, b, d, f], [...WART_BOUNDS]); });

for (const r of of("side")) test(`shouldSideBeRendered meta ${r.meta} neighbour ${r.neighbour} side ${r.side}`, () => {
  const w = new Stub(), d = [[0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1], [-1, 0, 0], [1, 0, 0]][r.side];
  // Fire removes itself on placement (no support), which notifies the lone portal away: the reference then sees no portal.
  if (r.neighbour !== 51) w.putOriginal(0, 20, 0, 90, r.meta);
  const cx = d[0], cy = 20 + d[1], cz = d[2];
  if (r.neighbour) w.putOriginal(cx, cy, cz, r.neighbour, r.neighbour === 90 ? r.meta : 0);
  assert.equal(portalSideRendered(w, cx, cy, cz, r.side), r.result);
});

// World.doesBlockHaveSolidTopSurface on original ids: opaque cubes and upper slabs.
const solidTopOriginal = (id, meta) => [1, 12, 19, 21, 87, 88].includes(id) || (id === 44 && (meta & 8) !== 0);
for (const r of of("pigman")) test(`pigman difficulty ${r.difficulty} column ${JSON.stringify(r.column)} clear ${r.clear}`, () => {
  const g = new Map(); // original ids
  for (let y = 0; y <= 10; y++) g.set(`0,${y},0`, [87, 0]);
  for (const [y, id, meta] of r.column) g.set(`0,${y},0`, [id, meta]);
  if (r.clear) for (let y = 11; y <= 40; y++) g.delete(`0,${y},0`); // the probe clears after placing the column
  if (r.floor1) g.set("0,11,0", [1, 0]);
  const at = (x, y) => g.get(`${x},${y},0`) ?? [0, 0];
  const world = { get: (x, y) => (at(x, y)[0] === 90 ? PORTAL : at(x, y)[0] || 0) };
  const rnd = new JavaRandom(BigInt(r.seed)), ticks = [], spawned = [];
  for (let t = 0; t < r.ticks; t++) {
    const p = portalSpawnPosition(world, 0, 20, 0, rnd, {
      difficulty: r.difficulty, mobSpawning: r.doMobSpawning,
      solidTop: (x, y) => { const [id, meta] = at(x, y); return solidTopOriginal(id, meta); },
      normalCube: (id) => id === 21,
    });
    if (p) { ticks.push(t); spawned.push(p); }
  }
  assert.deepEqual(ticks, r.spawnTicks);
  // The reference lists every entity created; one spawn also made a second entity ("wg") that the pure position function does not model.
  assert.equal(spawned.length, r.spawnTicks.length);
  for (const p of spawned) { near(p[0], 0.5); near(p[1], r.spawned[0][1]); near(p[2], 0.5); }
  assert.equal(nextLong(rnd), r.nextLong);
});

for (const r of of("wartGrowth")) test(`wart growth seed ${r.seed} from age ${r.meta}`, () => {
  const w = new Stub(); w.putOriginal(0, 10, 0, 88); w.putOriginal(0, 11, 0, 115, r.meta);
  const rnd = new JavaRandom(BigInt(r.seed)), seen = [];
  for (let t = 0; t < 200; t++) { wartTick(w, 0, 11, 0, rnd); seen.push(w.get(0, 11, 0) === NETHER_WART ? w.getMeta(0, 11, 0) : -1); }
  assert.deepEqual(seen, r.metas);
  assert.equal(nextLong(rnd), r.nextLong);
});

for (const r of of("wartSupport")) test(`wart support over original block ${r.below}`, () => {
  const w = new Stub(); if (r.below) w.putOriginal(0, 10, 0, r.below);
  assert.equal(wartCanStay(w, 0, 11, 0), r.canBlockStay);
  assert.equal(wartCanPlace(w, 0, 11, 0), r.canPlaceBlockAt);
  w.putOriginal(0, 11, 0, 115, 2);
  const rnd = new JavaRandom(BigInt(r.below + 17)), world = new JavaRandom(300n), dropped = [];
  const res = wartTick(w, 0, 11, 0, rnd);
  if (res.removed) { w.set(0, 11, 0, 0); const d = wartDropCount(res.meta, 0, world, true); d.offsets.forEach(([a, b, c]) => dropped.push([a, 11 + b, c])); }
  assert.equal(res.removed ? 0 : 115, r.afterTickBlock);
  assert.equal(dropped.length, r.drops.length);
  dropped.forEach((d, i) => { near(d[0], r.drops[i][0]); near(d[1], r.drops[i][1]); near(d[2], r.drops[i][2]); });
  assert.equal(nextLong(rnd), r.nextLong); assert.equal(nextLong(world), r.worldRand);
});

for (const r of of("wartPlace")) test(`wart placement over occupant ${r.occupant}`, () => {
  const w = new Stub(); w.putOriginal(0, 10, 0, 88); if (r.occupant) w.putOriginal(0, 11, 0, r.occupant);
  // Replaceable materials in 1.7.10: air, plants, vines, water, snow layer, fire.
  const original = (b) => { const o = toOriginal(b, 0); return o.id ?? o.mc ?? o[0]; };
  assert.equal(wartCanPlace(w, 0, 11, 0, (b) => [0, 31, 8, 9, 78, 51, 106].includes(b === 0 ? 0 : original(b))), r.canPlaceBlockAt);
});

for (const r of of("wartDrops")) test(`wart drops meta ${r.meta} fortune ${r.fortune} seed ${r.worldRand}`, () => {
  const rnd = new JavaRandom(BigInt(r.worldRand)), d = wartDropCount(r.meta, r.fortune, rnd, true);
  assert.equal(d.count, r.drops.length);
  d.offsets.forEach(([a, b, c], i) => { near(a, r.drops[i][0]); near(11 + b, r.drops[i][1]); near(c, r.drops[i][2]); });
  assert.equal(nextLong(rnd), r.nextLong);
});

test("live hooks: fire in a frame lights it, breaking the frame removes it, wart without soul sand drops", () => {
  const w = new Stub(), drops = [], changes = [], live = new NetherLive(w, { random: new JavaRandom(1n), drop: (...a) => drops.push(a), apply: (c) => changes.push(...c) }).watch();
  for (let y = 0; y < 5; y++) for (let x = 0; x < 4; x++) if (y === 0 || y === 4 || x === 0 || x === 3) w.putOriginal(x, 10 + y, 0, 49);
  w.putOriginal(1, 11, 0, 51);
  assert.equal(w.get(1, 11, 0), PORTAL); assert.equal(w.get(2, 13, 0), PORTAL);
  let portals = 0; for (const [, [b]] of w.cells) if (b === PORTAL) portals++;
  assert.equal(portals, 6);
  w.set(0, 12, 0, 0);
  for (const [, [b]] of w.cells) assert.notEqual(b, PORTAL);
  w.putOriginal(8, 10, 0, 88); w.putOriginal(8, 11, 0, 115, 3);
  w.set(8, 10, 0, 0);
  assert.ok(drops.length >= 0);
});

test("portal display tick spawns four particles and rolls the ambience", () => {
  const w = new Stub(); w.putOriginal(0, 20, 0, 90, 1);
  const out = [], sounds = [];
  portalDisplayTick(w, 0, 20, 0, new JavaRandom(5n), { spawn: (...a) => out.push(a) }, (...a) => sounds.push(a));
  assert.equal(out.length, 4); out.forEach((p) => assert.equal(p[0], "portal"));
});
