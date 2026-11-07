import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { World, selectionBounds, collisionBounds, collisionBoxes, normalCube, isCrop, isFlower, YELLOW_FLOWER, RED_FLOWER, LADDER, SNOW_LAYER, cropAge } from "./world.js";
import { fromOriginal } from "./block-registry.js";
import { ORIGINAL_ITEMS } from "./original-items.js";
import { isStemCake, popDrops } from "./stems-cake.js";
import { carpetNeighbourChange } from "./colored-blocks.js";
import { Rails } from "./rails.js";
import { Torches } from "./torches.js";
import { Doors, solidTopSurface } from "./doors-panes.js";
import { Beds } from "./bed.js";
import { NetherLive } from "./nether-portal-live.js";
import { RedstoneBlocks } from "./redstone-blocks.js";
import { Plants } from "./plants.js";
import { Trees } from "./trees.js";
import { PopulationBlocks } from "./population-blocks.js";
import { createRedstoneRuntime } from "./redstone-runtime.js";
import { flowerCanStay } from "./flowers.js";
import { ladderSupported } from "./ladders.js";
import { snowFalls, meltResult } from "./snow.js";
import { isSign, signShouldPop, signDrops } from "./signs.js";
import { farmNeighbourChange, Farming } from "./farming.js";
import { JavaRandom } from "./java-random.js";
import { Fire } from "./fire.js";

// Port replays of public/research/block-sweep-reference.json (tools/probes/BlockSweepProbe.java against the unchanged 1.7.10 jar): the box,
// neighbour-removal and tick columns for every registered block batch 16 did not cover. See public/research/block-behaviour-audit.md.
const ref = JSON.parse(readFileSync(new URL("../public/research/block-sweep-reference.json", import.meta.url)));
const of = (c) => ref.records.filter((r) => r.c === c);
const near = (a, b) => a && b && a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) < 1e-4);
const P = [40, 20, 40];
const world = new World("sweep");
function clear() { for (let dx = -4; dx <= 4; dx++) for (let dy = -4; dy <= 4; dy++) for (let dz = -4; dz <= 4; dz++) world.put(P[0] + dx, P[1] + dy, P[2] + dz, 0, 0, false); }
const sub = (b) => b && b.map((v, i) => (i % 3 === 1 ? v - 1 : v));
const sortBoxes = (l) => l.map((b) => b.map((v) => +v.toFixed(4))).sort((a, b) => (JSON.stringify(a) < JSON.stringify(b) ? -1 : 1));

// ---- boxes --------------------------------------------------------------------------------------------------------------
// Documented exemptions (block-behaviour-audit.md): native values that are not the in-game value or that the port carries differently.
//  sel: 29/33 metas 14-15 (invalid piston direction); torches 50/75/76 and buttons 77/143 (BlockTorch/BlockButton set their bounds in collisionRayTrace /
//  placement, so the idle native field is a stale full cube); 106 meta 0 (inverted native artefact); 117 brewing stand and 120 end portal frame (the bounds
//  field is history-dependent: the in-game box comes from the addCollisionBoxes calls the port reproduces).
//  cbb (the getCollisionBoundingBoxFromPool accessor, as opposed to the addCollisionBoxesToList list that the port replays): 34 piston head, 78 snow layer
//  meta 0 (a zero-height plane), 85 fence (1.0 accessor vs the 1.5 high list the port uses), 117 and 120 as above.
const SEL_EXEMPT = (id, m) => [50, 75, 76, 77, 117, 120, 143].includes(id) || ((id === 29 || id === 33) && m >= 14) || (id === 106 && m === 0);
const CBB_EXEMPT = (id) => [34, 78, 85, 117, 120].includes(id);

test("block sweep boxes: selection box, collision box and collision list per metadata match the native classes", () => {
  const bad = [];
  let compared = 0;
  for (const r of of("sbox")) for (let m = 0; m < 16; m++) {
    const e = r.u[r.ix[m]], o = fromOriginal(r.id, m);
    if (!e || !o?.exact) continue;
    clear();
    world.put(...P, o.id, o.meta, false);
    const notes = [];
    if (Array.isArray(e.s) && !SEL_EXEMPT(r.id, m)) { const b = selectionBounds(world, ...P); if (!near(b, sub(e.s))) notes.push(`sel port ${b?.map((v) => +v.toFixed(3))} native ${sub(e.s).map((v) => +v.toFixed(3))}`); }
    if (!CBB_EXEMPT(r.id)) {
      const sol = world.solid(...P);
      if (Array.isArray(e.k)) { const c = sol ? collisionBounds(world, ...P) : null; if (!near(c, sub(e.k))) notes.push(`cbb port ${c?.map((v) => +v.toFixed(3))} native ${sub(e.k).map((v) => +v.toFixed(3))}`); }
      else if (e.k === null && sol) notes.push("cbb port solid, native null");
    }
    if (Array.isArray(e.l) && !((r.id === 29 || r.id === 33) && m >= 14) && !(r.id === 78 && (m & 7) === 0)) {
      const nat = sortBoxes(e.l.map(sub)), p = sortBoxes(collisionBoxes(world, ...P));
      if (JSON.stringify(p) !== JSON.stringify(nat)) notes.push(`col port ${JSON.stringify(p)} native ${JSON.stringify(nat)}`);
    }
    compared++;
    if (notes.length) bad.push(`${r.id}/${m}: ${notes.join(" | ")}`);
  }
  assert.ok(compared > 1000, `compared ${compared}`);
  assert.deepEqual(bad, []);
});

const D4 = [[0, -1], [0, 1], [-1, 0], [1, 0]];
function ctxCompare(e, label, out) {
  const notes = [];
  if (Array.isArray(e.s)) { const b = selectionBounds(world, ...P); if (!near(b, sub(e.s))) notes.push(`sel port ${b?.map((v) => +v.toFixed(3))} native ${sub(e.s).map((v) => +v.toFixed(3))}`); }
  if (Array.isArray(e.l)) { const nat = sortBoxes(e.l.map(sub)), p = sortBoxes(collisionBoxes(world, ...P)); if (JSON.stringify(p) !== JSON.stringify(nat)) notes.push(`col port ${JSON.stringify(p)} native ${JSON.stringify(nat)}`); }
  if (notes.length) out.push(`${label}: ${notes.join(" | ")}`);
}
test("block sweep boxes: fence, pane, wall and nether fence neighbour masks match", () => {
  const bad = [];
  let n = 0;
  for (const r of of("mask")) {
    const o = fromOriginal(r.id, r.meta), no = r.nid === 1 ? { id: 1, meta: 0 } : fromOriginal(r.nid, r.meta === 2 ? 2 : 0);
    if (!o?.exact) continue;
    for (let mask = 0; mask < 16; mask++) {
      clear(); world.put(...P, o.id, o.meta, false);
      for (let i = 0; i < 4; i++) if (mask & (1 << i)) world.put(P[0] + D4[i][0], P[1], P[2] + D4[i][1], no.id, no.meta, false);
      ctxCompare(r.u[r.ix[mask]], `mask ${r.id} n${r.nid} ${mask}`, bad); n++;
    }
  }
  assert.ok(n >= 80, `compared ${n}`);
  assert.deepEqual(bad, []);
});
test("block sweep boxes: every stair shape (12 stairs, meta 0-7, side, neighbour stair meta) matches", () => {
  const bad = [];
  let n = 0;
  for (const r of of("stair")) for (let side = 0; side < 4; side++) for (let nm = 0; nm < 8; nm++) {
    const o = fromOriginal(r.id, r.meta), no = fromOriginal(r.id, nm);
    if (!o?.exact || !no?.exact) continue;
    clear(); world.put(...P, o.id, o.meta, false); world.put(P[0] + D4[side][0], P[1], P[2] + D4[side][1], no.id, no.meta, false);
    ctxCompare(r.u[r.ix[side * 8 + nm]], `stair ${r.id}/${r.meta} side${side} n${nm}`, bad); n++;
  }
  assert.ok(n >= 700, `compared ${n}`);
  assert.deepEqual(bad, []);
});
test("block sweep boxes: door boxes per lower meta and upper hinge match", () => {
  const bad = [];
  let n = 0;
  for (const r of of("door")) {
    let i = 0;
    for (const upper of [8, 9]) for (let m = 0; m < 8; m++) {
      const lo = fromOriginal(r.id, m), up = fromOriginal(r.id, upper);
      clear(); world.put(...P, lo.id, lo.meta, false); world.put(P[0], P[1] + 1, P[2], up.id, up.meta, false);
      ctxCompare(r.atLower.u[r.atLower.ix[i]], `door ${r.id} lower m${m} up${upper}`, bad); i++; n++;
    }
  }
  assert.equal(n, 32);
  assert.deepEqual(bad, []);
});

// ---- neighbour removal ------------------------------------------------------------------------------------------------
// The watcher stack of main.js launch(), in its wrapping order, on the shared world: the inline watchFlowers closure (signs, stems, flowers, crops and
// farmland, ladders, snow), fire, trees, plants, population blocks, rails, torches, carpet, doors, beds, nether, redstone blocks and the live redstone runtime.
const inv = new Map();
for (const [k, v] of Object.entries(ORIGINAL_ITEMS)) { const [i, d = 0] = k.split(":").map(Number); if (!inv.has(v)) inv.set(v, [i, d]); }
const stackKey = (s) => { const o = inv.get(s.id) ?? [s.id, 0]; return `${o[0]}:${s.damage ?? o[1]}x${s.count}`; };
let drops = [];
const dropStacks = (stacks) => drops.push(...stacks.map(stackKey));
const dropBlock = (stacks) => dropStacks(stacks);
const apply = () => {};
const FLOWERS = { yellow: YELLOW_FLOWER, red: RED_FLOWER };
const SIDE6 = [[0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1], [-1, 0, 0], [1, 0, 0]];
{
  const next = world.onChange;
  world.onChange = (x, y, z, old, now) => {
    next?.(x, y, z, old, now);
    for (const [dx, dy, dz] of SIDE6) {
      const fx = x + dx, fy = y + dy, fz = z + dz, b = world.get(fx, fy, fz);
      if (isSign(b) && signShouldPop(world, fx, fy, fz)) { world.set(fx, fy, fz, 0); dropStacks(signDrops()); continue; }
      if (isStemCake(b)) { const pop = popDrops(world, fx, fy, fz); if (pop) { world.set(fx, fy, fz, 0); dropStacks(pop); } continue; }
      if (!isFlower(b) || flowerCanStay(world, FLOWERS, fx, fy, fz)) continue;
      const meta = world.getMeta(fx, fy, fz);
      world.set(fx, fy, fz, 0);
      dropStacks([{ id: b, count: 1, damage: b === RED_FLOWER ? meta : 0 }]);
    }
    for (const c of farmNeighbourChange(world, x, y, z)) if (c.drops.length) dropStacks(c.drops);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const lx = x + dx, lz = z + dz;
      if (world.get(lx, y, lz) !== LADDER || ladderSupported(world, lx, y, lz)) continue;
      world.set(lx, y, lz, 0); dropStacks([{ id: LADDER, count: 1 }]);
    }
    for (const [dx, dy, dz] of SIDE6) { const fx = x + dx, fy = y + dy, fz = z + dz; if (world.get(fx, fy, fz) === SNOW_LAYER && snowFalls(world, fx, fy, fz)) world.set(fx, fy, fz, 0); }
  };
}
const wrap = { drop: dropBlock, apply };
new Fire(world, { weather: () => null, stillLava: () => true, primeTnt: () => {} }).watch();
new Trees(world, { random: new JavaRandom(1), light: () => 15, apply, drop: dropBlock }).watch();
new Plants(world, { drop: dropBlock, broken: () => {}, apply }).watch();
new PopulationBlocks(world, { random: new JavaRandom(3), drop: dropBlock, apply }).watch();
new Rails(world, wrap).watch();
new Torches(world, wrap).watch();
{ const next = world.onChange; world.onChange = (x, y, z, old, now) => { next?.(x, y, z, old, now); for (const dy of [1, 0]) { const d = carpetNeighbourChange(world, x, y + dy, z); if (d) dropStacks([d]); } }; }
new Doors(world, wrap).watch();
new Beds(world, wrap).watch();
new NetherLive(world, { random: new JavaRandom(3), drop: dropBlock, apply, pigman: () => {}, difficulty: () => 2, mobSpawning: () => true, solidTop: (x, y, z) => solidTopSurface(world, x, y, z), normalCube }).watch();
world.redstoneBlocks = new RedstoneBlocks(world, { drop: dropBlock, apply, sound: () => {} }).watch();
const runtime = createRedstoneRuntime({ world, scene: { updateBlocks() {} }, game: { drop: (x, y, z, d) => dropStacks([d]), markUnsaved: () => {} } });
{ const rb = world.redstoneBlocks, supported = rb.neighbourChanged.bind(rb), live = runtime.redstone; rb.neighbourChanged = (x, y, z) => { if (!live.behaviours[live.getBlock(x, y, z)]) supported(x, y, z); }; }

const BED = [[0, 1], [-1, 0], [0, -1], [1, 0]];
// BlockSweepProbe.partner: the other half of a door, tall plant or bed.
function partner(id, meta) {
  if (id === 64 || id === 71 || id === 175) return meta < 8 ? [0, 1, 0, id, 8] : [0, -1, 0, id, 0];
  if (id === 26) { const o = BED[meta & 3]; return (meta & 8) === 0 ? [o[0], 0, o[1], 26, meta | 8] : [-o[0], 0, -o[1], 26, meta & 7]; }
  return null;
}
const putO = (dx, dy, dz, oid, om) => { const o = fromOriginal(oid, om); world.put(P[0] + dx, P[1] + dy, P[2] + dz, o.id, o.meta, false); return o; };
function portCase(id, meta, k, below) {
  clear(); drops = [];
  for (const d of SIDE6) putO(d[0], d[1], d[2], 1, 0);
  if (below !== 1) putO(0, -1, 0, below, below === 60 ? 7 : 0);
  const p = partner(id, meta);
  if (p) putO(p[0], p[1], p[2], p[3], p[4]);
  const o = putO(0, 0, 0, id, meta);
  world.set(P[0] + SIDE6[k][0], P[1] + SIDE6[k][1], P[2] + SIDE6[k][2], 0);
  const here = world.get(...P);
  return { res: here !== o.id ? "b" : world.getMeta(...P) === o.meta ? "s" : "m", drops: [...drops] };
}
const aggregate = (l) => { const t = {}; for (const e of l) { const [a, c] = e.split("x"); t[a] = (t[a] ?? 0) + +c; } return JSON.stringify(Object.entries(t).sort()); };
// Exempt (id): why the replay cannot judge it, all listed in block-behaviour-audit.md.
//  8-11 water and lava: the probe's neighbour call flows the liquid (Fluids owns that, fluids.test.js).
//  37/38 flowers and 39/40 mushrooms: BlockBush.canBlockStay reads the light the probe fixes at 15; the port's light model is the sky column (flowers.js
//  flowerCanStay) and mushrooms have no light rule in the port (remaining gap).
//  65 ladder metas 0, 1, 6, 7: no wall exists for them, never stored. 106 vines are replayed; metas never stored by the game are not.
//  54/36/149/150 and pistons: tile entities the probe cannot build. 140 flower pot: contents live in a TileEntity the probe lacks.
//  6/59/141/142/31/175/127: drops draw from the probe's seeded Random (the port draws Math.random); the state column is still compared.
//  64/71 upper half with the lower half removed: the native cascade drops the door through the partner call (door-cascade drops are the b18 doors track).
const NB_STATE_EXEMPT = (id, m) => [8, 9, 10, 11, 37, 38, 39, 40].includes(id) || (id === 65 && (m < 2 || m >= 6)) || (id === 6 && m >= 6) || (id === 106 && m === 0);
const NB_DROP_EXEMPT = (id, m) => [6, 31, 59, 140, 141, 142, 175].includes(id) || ((id === 64 || id === 71) && m >= 8);
test("block sweep neighbours: removing each of six supports leaves, changes or breaks every swept block exactly as the native class does", () => {
  const bad = [], dbad = [];
  let n = 0, nd = 0;
  for (const r of of("nb")) {
    const below = r.layout === "stone" ? 1 : r.layout === "grass" ? 2 : 60;
    const rows = r.codes.split("|");
    for (let m = 0; m < 16; m++) {
      const o = fromOriginal(r.id, m);
      if (!o?.exact || NB_STATE_EXEMPT(r.id, m)) continue;
      const row = rows[m].split(",");
      if (row.includes("x")) continue;
      for (let k = 0; k < 6; k++) {
        let pc;
        try { pc = portCase(r.id, m, k, below); } catch (e) { pc = { res: `EXC ${e.message}`, drops: [] }; }
        const nat = row[k].startsWith("m") ? "m" : row[k];
        n++;
        if (pc.res !== nat) { bad.push(`${r.id}/${r.layout} m${m} side ${k}: port ${pc.res} native ${row[k]}`); continue; }
        if (nat === "b" && !NB_DROP_EXEMPT(r.id, m)) {
          nd++;
          const want = aggregate(r.drops[`${m}.${k}`] ?? []), got = aggregate(pc.drops);
          if (want !== got) dbad.push(`${r.id}/${r.layout} m${m} side ${k}: port ${got} native ${want}`);
        }
      }
    }
  }
  assert.ok(n > 15000 && nd > 500, `compared ${n} states ${nd} drops`);
  assert.deepEqual(bad.slice(0, 30), []);
  assert.deepEqual(dbad.slice(0, 30), []);
});

// ---- ticks ----------------------------------------------------------------------------------------------------------------
// Native histograms are over seeded java.util.Randoms; the port draws from other streams, so deterministic scenarios are compared exactly and random
// ones by outcome set and by the native frequency against the port's exact probability (4 sigma).
const cellOf = (key, dx, dy, dz) => key.split(" ").find((t) => t.startsWith(`${dx},${dy},${dz}=`))?.split("=")[1];
const within = (hits, n, p) => Math.abs(hits - n * p) <= 4 * Math.sqrt(n * p * (1 - p)) + 1;
test("block sweep ticks: farmland moisture, dirt reversion and crop growth rate match BlockFarmland/BlockCrops.updateTick", () => {
  const bad = [];
  let n = 0;
  for (const r of of("tick")) {
    if (r.name.startsWith("farm-")) {
      clear();
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) putO(dx, 0, dz, 1, 0);
      const farm = new Farming(world, []);
      putO(0, 0, 0, 60, r.meta); farm.observe(...P); farm.fields.set(P.join(","), r.meta);
      const [native] = Object.keys(r.o);
      if (r.name === "farm-water" || r.name === "farm-water-far") putO(r.name === "farm-water" ? 2 : 5, 0, 0, 9, 0);
      if (r.name === "farm-crop") putO(0, 1, 0, 59, 0);
      if (r.name === "farm-solid-above") putO(0, 1, 0, 1, 0);
      if (r.name === "farm-solid-above") { farm.soilTick(...P); } else farm.soilTick(...P);
      const b = world.get(...P), m = farm.fields.get(P.join(",")) ?? 0;
      const got = b === 2 ? "3:0" : `60:${m}`, want = cellOf(native, 0, 1, 0);
      n++;
      if (r.name === "farm-solid-above") { if (b !== 2 && b !== 29 && b !== 30) bad.push(`${r.name} m${r.meta} lost`); continue; }
      if (got !== want) bad.push(`${r.name} m${r.meta}: port ${got} native ${want}`);
    } else if (/^crop-(plain|dry|ring|rows)$/.test(r.name) && r.id === 59 && r.meta < 7 && r.sky === 15) {
      clear();
      const ring = r.name === "crop-ring" || r.name === "crop-rows";
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) if ((dx === 0 && dz === 0) || ring) putO(dx, 0, dz, 60, r.name === "crop-dry" ? 0 : 7);
      const farm = new Farming(world, []);
      for (const k of [...farm.fields.keys()]) farm.fields.delete(k);
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) if (world.get(P[0] + dx, P[1], P[2] + dz) === 30 || world.get(P[0] + dx, P[1], P[2] + dz) === 29) farm.fields.set(`${P[0] + dx},${P[1]},${P[2] + dz}`, r.name === "crop-dry" ? 0 : 7);
      if (r.name === "crop-rows") { putO(-1, 1, 0, 59, 7); putO(1, 1, 0, 59, 7); putO(0, 1, 1, 59, 7); }
      const o = putO(0, 1, 0, 59, r.meta);
      const p = 1 / (Math.floor(25 / farm.growthRate(P[0], P[1] + 1, P[2])) + 1);
      const hits = Object.entries(r.o).reduce((t, [key, c]) => (cellOf(key, 0, 1, 0) === `59:${r.meta + 1}` ? t + c : t), 0);
      n++;
      if (!within(hits, r.seeds, p)) bad.push(`${r.name} age ${r.meta}: native ${hits}/${r.seeds}, port p=${p.toFixed(4)}`);
      assert.equal(o.id !== 0, true);
    }
  }
  assert.ok(n > 20, `compared ${n}`);
  assert.deepEqual(bad, []);
});
test("block sweep ticks: cactus and sugar cane growth, age and column cap match (deterministic)", () => {
  const bad = [];
  let n = 0;
  for (const r of of("tick")) {
    if (!/^(cactus|reeds)(-h3)?$/.test(r.name)) continue;
    clear();
    putO(0, -1, 0, r.id === 81 ? 12 : 3, 0);
    if (r.id === 83) putO(1, -1, 0, 9, 0);
    const h = r.name.endsWith("h3") ? 3 : 1;
    for (let i = 0; i < h; i++) putO(0, i, 0, r.id, i === 0 ? r.meta : 0);
    const plants = new Plants(world, { drop: dropBlock, broken: () => {}, apply });
    plants.randomTick(...P);
    const [native] = Object.keys(r.o);
    const want = {}, got = {};
    for (const t of native.split(" ")) {
      const m = /^0,(\d+),0=(\d+):(\d+)$/.exec(t);
      if (m && +m[1] >= 1 && (+m[2] === 81 || +m[2] === 83)) want[+m[1] - 1] = `${m[2]}:${m[3]}`;
    }
    for (let y = 0; y < 5; y++) { const b = world.get(P[0], P[1] + y, P[2]); if (b) { const o = [81, 83].find((i) => fromOriginal(i, 0).id === b); if (o) got[y] = `${o}:${world.getMeta(P[0], P[1] + y, P[2])}`; } }
    n++;
    if (JSON.stringify(got) !== JSON.stringify(want)) bad.push(`${r.name} meta ${r.meta}: port ${JSON.stringify(got)} native ${JSON.stringify(want)}`);
  }
  assert.ok(n >= 16, `compared ${n}`);
  assert.deepEqual(bad, []);
});
test("block sweep ticks: ice, snow layer and snow block melt at the native block-light thresholds", () => {
  const bad = [];
  for (const r of of("tick")) {
    if (!["ice", "snowlayer", "snowblock"].includes(r.name)) continue;
    const id = r.id === 79 ? 47 : r.id === 78 ? 46 : 23;
    const melt = meltResult(id, r.blk);
    const [native] = Object.keys(r.o);
    const nat = cellOf(native, 0, 1, 0);
    const want = nat === undefined ? "gone" : nat.startsWith("9") ? "water" : "stays";
    const got = !melt ? "stays" : melt.block === 0 ? "gone" : "water";
    if (got !== want) bad.push(`${r.name} light ${r.blk}: port ${got} native ${want}`);
    if (want === "gone" && r.id === 80 && JSON.stringify(melt.drops) !== JSON.stringify([{ id: 312, count: 4 }])) bad.push("snow block drops");
  }
  assert.deepEqual(bad, []);
});
