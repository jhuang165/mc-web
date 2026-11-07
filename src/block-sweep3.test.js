import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { World, YELLOW_FLOWER, RED_FLOWER, SAPLING } from "./world.js";
import { fromOriginal } from "./block-registry.js";
import { JavaRandom } from "./java-random.js";
import { flowerCanStay } from "./flowers.js";
import { populationPlantCanStay, PopulationBlocks } from "./population-blocks.js";
import { mushroomCanStay, mushroomSpread } from "./plant-light.js";
import { Trees, saplingCanStay } from "./trees.js";
import { Farming, farmNeighbourChange } from "./farming.js";
import { popDrops } from "./stems-cake.js";
import { harvestBlock } from "./enchantment-effects.js";
import { populationDrops } from "./population-content.js";
import { wartDropCount } from "./nether-wart.js";
import { movingCollisionBox, pushBoxOf, pushArgument } from "./piston-live.js";

// Port replays of public/research/block-sweep3-reference.json (tools/probes/BlockSweep3Probe.java, the unchanged 1.7.10 classes on the
// BlockSweepProbe World double with a light grid): light-dependent plant survival and ticks, seeded drop streams, tile-entity boxes.
// See public/research/block-behaviour-audit.md (batch 19).
const ref = JSON.parse(readFileSync(new URL("../public/research/block-sweep3-reference.json", import.meta.url)));
const of = (c) => ref.records.filter((r) => r.c === c);
const P = [40, 20, 40];
const world = new World("sweep3");
function clear() { for (let dx = -8; dx <= 8; dx++) for (let dy = -4; dy <= 4; dy++) for (let dz = -8; dz <= 8; dz++) world.put(P[0] + dx, P[1] + dy, P[2] + dz, 0, 0, false); }
const putO = (dx, dy, dz, oid, om) => { const o = fromOriginal(oid, om); world.put(P[0] + dx, P[1] + dy, P[2] + dz, o.id, o.meta, false); return o; };
const GROUND = { grass: [2, 0], dirt: [3, 0], podzol: [3, 2], mycelium: [110, 0], sand: [12, 0], farmland: [60, 7], soulsand: [88, 0], stone: [1, 0], water: [9, 0] };
const rleDecode = (s) => s.split(",").flatMap((t) => { const [c, n] = t.split(":"); return Array(+n).fill(+c); });
const SKYS = [...Array(16).keys()], BLKS = [0, 7, 8, 9, 12, 13, 15], SUBS = [0, 6, 11];
function* lightGrid() { for (const sky of SKYS) for (const blk of BLKS) for (const sub of SUBS) for (let see = 0; see < 2; see++) yield { sky, blk, sub, see: see === 1 }; }

// ---- light-dependent survival (BlockBush.canBlockStay / canPlaceBlockAt) ---------------------------------------------------
const FLOWERS = { yellow: YELLOW_FLOWER, red: RED_FLOWER };
// Port-side survival per original block; `light` = {sky, blk, sub, see}. Mushrooms read World.getFullBlockLightValue (sub 0).
const STAY = {
  6: (id) => saplingCanStay(world, ...P),
  31: (id) => populationPlantCanStay(world, ...P, id), 32: (id) => populationPlantCanStay(world, ...P, id),
  37: () => flowerCanStay(world, FLOWERS, ...P), 38: () => flowerCanStay(world, FLOWERS, ...P),
  39: () => mushroomCanStay(world, ...P, () => world.lightProbe.full), 40: () => mushroomCanStay(world, ...P, () => world.lightProbe.full),
  59: () => farmStays(), 141: () => farmStays(), 142: () => farmStays(),
  104: () => !popDrops(world, ...P), 105: () => !popDrops(world, ...P),
  175: (id) => populationPlantCanStay(world, ...P, id),
};
const farmStays = () => !farmNeighbourChange(world, ...P).some((c) => c.old !== 29 && c.old !== 30 && c.now === 0);
test("block sweep light: BlockBush-family survival over sky, block light, skylightSubtracted and sky view matches the native classes", () => {
  const bad = [];
  let n = 0;
  for (const r of of("lp")) {
    const codes = rleDecode(r.v), grid = [...lightGrid()];
    assert.equal(codes.length, grid.length);
    // canBlockStay (bit 0) and canPlaceBlockAt (bit 1): the same for the whole family except where noted (BlockBush.canPlaceBlockAt = air cell and canBlockStay).
    const stay = STAY[r.id];
    if (!stay) { // no light term at all: cocoa, wart, reeds, cactus, lily pad, stems on odd grounds are constant over the whole grid
      assert.ok(codes.every((c) => c === codes[0]), `${r.id} ${r.ground} varies with light`);
      continue;
    }
    codes.forEach((c, i) => {
      const g = grid[i];
      clear(); putO(0, -1, 0, ...GROUND[r.ground]);
      const o = putO(0, 0, 0, r.id, r.meta);
      if (r.id === 175) putO(0, 1, 0, 175, 8);
      world.lightProbe = { full: Math.max(g.sky, g.blk) };
      let got;
      try { got = stay(o.id); } catch (e) { got = `EXC ${e.message}`; }
      n++;
      if (got !== ((c & 1) === 1)) bad.push(`${r.id}/${r.meta} on ${r.ground} sky${g.sky} blk${g.blk} sub${g.sub} see${g.see}: port ${got} native ${(c & 1) === 1}`);
    });
  }
  assert.ok(n > 10000, `compared ${n}`);
  assert.deepEqual(bad.slice(0, 30), []);
});
test("block sweep light: the native light term exists only for mushrooms (full light < 13, no day/night term) and only off mycelium and podzol", () => {
  const lp = (id, g) => of("lp").find((r) => r.id === id && r.ground === g);
  const grid = [...lightGrid()];
  for (const id of [6, 31, 32, 37, 38, 59, 141, 142, 104, 105, 175]) for (const g of Object.keys(GROUND)) { const r = lp(id, g); assert.ok(r && rleDecode(r.v).every((c) => c === rleDecode(r.v)[0]), `${id} on ${g} must be light independent`); }
  for (const id of [39, 40]) {
    for (const g of ["mycelium", "podzol"]) assert.ok(rleDecode(lp(id, g).v).every((c) => c === 3), `${id} on ${g} survives every light`);
    for (const g of ["grass", "dirt", "sand", "stone", "soulsand"]) rleDecode(lp(id, g).v).forEach((c, i) => assert.equal(c & 1, Math.max(grid[i].sky, grid[i].blk) < 13 ? 1 : 0, `${id} on ${g} sky${grid[i].sky} blk${grid[i].blk}`));
    for (const g of ["farmland", "water"]) assert.ok(rleDecode(lp(id, g).v).every((c) => c === 0), `${id} on ${g}: not an opaque cube`);
  }
  // sub never matters for the mushroom (getFullBlockLightValue passes skylightSubtracted 0)
  rleDecode(lp(39, "grass").v).forEach((c, i) => { const g = grid[i]; if (g.sub) assert.equal(c, rleDecode(lp(39, "grass").v)[i - (g.sub === 6 ? 2 : 4)]); });
});

// ---- ticks on the light grid -------------------------------------------------------------------------------------------------
const within = (hits, n, p) => Math.abs(hits - n * p) <= 4 * Math.sqrt(n * p * (1 - p)) + 1;
test("block sweep light: sapling growth (light >= 9 at y + 1 after skylightSubtracted, one in seven) matches seed for seed", () => {
  let n = 0;
  const bad = [];
  for (const r of of("ltick").filter((x) => x.name === "plant" && x.id === 6 && x.ground === "grass")) {
    const light = Math.max(r.sky - r.sub, r.blk);
    let grew = 0;
    for (let seed = 0; seed < r.seeds; seed++) {
      clear(); putO(0, -1, 0, 2, 0); putO(0, 0, 0, 6, 0);
      new Trees(world, { random: new JavaRandom(seed), light: () => light }).tickSapling(...P);
      if (world.getMeta(...P) === 8) grew++;
      n++;
    }
    // the native histogram counts the marked saplings (6:8) over the same seeds: the stream is identical, so the totals are exact
    const nat = Object.entries(r.o).filter(([k]) => k.includes("0,1,0=6:8")).reduce((a, [, v]) => a + v, 0);
    if (grew !== nat) bad.push(`sapling light ${r.sky}/${r.blk}/${r.sub}: port ${grew} native ${nat} of ${r.seeds}`);
  }
  assert.ok(n >= 300, `compared ${n}`);
  assert.deepEqual(bad, []);
});
test("block sweep light: crop growth needs getBlockLightValue(y + 1) >= 9 (sub applied) and then matches the native frequency", () => {
  const bad = [];
  let n = 0;
  for (const r of of("ltick").filter((x) => x.name === "crop")) {
    const o = fromOriginal(r.id, 0), light = Math.max(r.sky - r.sub, r.blk);
    let hits = 0;
    const jr = new JavaRandom(r.id * 31 + r.sky * 7 + r.blk + r.sub * 3);
    for (let i = 0; i < r.seeds; i++) {
      clear(); putO(0, -1, 0, 60, 7); putO(0, 0, 0, r.id, 0);
      const farming = new Farming(world);
      farming.lightLevel = () => light;
      farming.fields.set(`${P[0]},${P[1] - 1},${P[2]}`, 7);
      if (farming.grow(...P, 1, () => jr.nextDouble())) hits++;
    }
    const nat = Object.entries(r.o).filter(([k]) => !k.includes(`=${o.id === 0 ? 0 : 59}:0 `) && !k.includes(`1,0=${r.id}:0`) && !k.includes(`0,1,0=${r.id}:0 `)).reduce((a, [, v]) => a + v, 0);
    const natHits = r.seeds - (Object.entries(r.o).find(([k]) => k.includes(`0,1,0=${r.id}:0 `))?.[1] ?? 0);
    n++;
    if (light < 9) { if (hits !== 0 || natHits !== 0) bad.push(`${r.id} light ${light}: port ${hits} native ${natHits}`); }
    else if (!within(hits, r.seeds, natHits / r.seeds) && !(Math.abs(hits - natHits) <= 4 * Math.sqrt(r.seeds * 0.14 * 0.86) * 1.5 + 2)) bad.push(`${r.id} light ${light}: port ${hits}/${r.seeds} native ${natHits}`);
    void nat;
  }
  assert.ok(n >= 27);
  assert.deepEqual(bad, []);
});
test("block sweep light: flowers, tall grass, dead bush and mushrooms resolve a random tick identically at every light", () => {
  const seen = new Map();
  for (const r of of("ltick").filter((x) => x.name === "plant" && [31, 32, 37, 38, 39, 40].includes(x.id))) {
    const key = `${r.id}/${r.ground}`, o = JSON.stringify(r.o);
    if (seen.has(key)) assert.equal(o, seen.get(key), `${key} changes with light ${r.sky}/${r.blk}/${r.sub}/${r.see}`);
    else seen.set(key, o);
  }
  // valid ground keeps the plant (no light-based pop in updateTick), invalid ground pops it
  assert.ok(seen.get("37/grass").includes("0,1,0=37:0") && seen.get("37/mycelium").includes("0,1,0=0:0"));
  assert.ok(seen.get("32/sand").includes("0,1,0=32:0") && seen.get("32/grass").includes("0,1,0=0:0"));
  assert.ok(seen.get("39/grass").includes("0,1,0=39:0"));
});

// ---- mushroom spread (BlockMushroom.updateTick), seed for seed -----------------------------------------------------------------
test("block sweep light: mushroom spread (nextInt(25), five-neighbour cap, four-step walk, light and ground rules) replays seed for seed", () => {
  const bad = [];
  let spreads = 0, n = 0;
  for (const r of of("mspread")) {
    const full = Math.max(r.sky, r.blk);
    for (let seed = 0; seed < r.seeds; seed++) {
      clear();
      for (let x = -6; x <= 6; x++) for (let z = -6; z <= 6; z++) putO(x, -1, z, r.floor, r.floorMeta);
      const o = putO(0, 0, 0, r.id, 0);
      for (let i = 0; i < r.extra; i++) putO(-3 + i, 0, 3, r.id, 0);
      const to = mushroomSpread(world, ...P, new JavaRandom(seed), () => full);
      const got = [[0, 1, 0], ...Array.from({ length: r.extra }, (_, i) => [-3 + i, 1, 3]), ...(to ? [[to[0] - P[0], to[1] - P[1] + 1, to[2] - P[2]]] : [])].map((c) => c.join(",")).sort().join(" ");
      const base = ["0,1,0", ...Array.from({ length: r.extra }, (_, i) => `${-3 + i},1,3`)].sort().join(" "), nat = r.rows[seed]?.split(" ").sort().join(" ") ?? base;
      n++;
      if (to) spreads++;
      if (got !== nat) bad.push(`${r.id} floor ${r.floor}/${r.floorMeta} light ${r.sky}/${r.blk} extra${r.extra} seed ${seed}: port ${got} native ${nat}`);
      void o;
    }
  }
  assert.ok(n > 40000 && spreads > 500, `${n} seeds, ${spreads} spreads`);
  assert.deepEqual(bad.slice(0, 20), []);
});
test("block sweep light: PopulationBlocks.randomTick spreads a mushroom through the same rules and apply hook", () => {
  clear();
  for (let x = -6; x <= 6; x++) for (let z = -6; z <= 6; z++) putO(x, -1, z, 110, 0);
  const o = putO(0, 0, 0, 39, 0);
  const rand = new JavaRandom(0), applied = [];
  const pb = new PopulationBlocks(world, { random: rand, apply: (c) => applied.push(...c) });
  let tries = 0;
  while (!applied.length && tries++ < 5000) assert.equal(pb.randomTick(...P, o.id), true);
  assert.equal(applied.length, 1);
  const [x, y, z, old, now] = applied[0];
  assert.equal(old, 0); assert.equal(now, o.id);
  assert.equal(world.get(x, y, z), o.id);
  assert.ok(Math.abs(x - P[0]) <= 4 && Math.abs(z - P[2]) <= 4);
});

// ---- seeded drop streams -------------------------------------------------------------------------------------------------------
const parseDrop = (row) => {
  const m = row.match(/^\[(.*)\] n(\d+),(\d+)$/);
  const items = [...m[1].matchAll(/'(\w+):(\d+)x(\d+)'|'xp(\d+)'/g)].map((t) => (t[4] ? { xp: +t[4] } : { id: +t[1], damage: +t[2], count: +t[3] }));
  return { items: items.filter((i) => !i.xp), xp: items.filter((i) => i.xp).reduce((a, i) => a + i.xp, 0), tail: `${m[2]},${m[3]}` };
};
test("block sweep drops: harvestBlock replays every seeded stream (items, xp and the next two draws) for fortune 0-3", () => {
  const bad = [], covered = new Set();
  let n = 0;
  for (const r of of("drop")) {
    for (let seed = 0; seed < r.rows.length; seed++) {
      const nat = parseDrop(r.rows[seed]), rand = new JavaRandom(seed), h = harvestBlock(r.id, r.meta, { fortune: r.fortune, rand });
      if (!h) break;
      covered.add(r.id);
      const got = h.drops.map((d) => `${d.id}:${d.damage ?? 0}x${d.count}`).join(","), want = nat.items.map((d) => `${d.id}:${d.damage}x${d.count}`).join(",");
      const tail = `${rand.nextInt(1000)},${rand.nextInt(1000)}`;
      n++;
      if (got !== want || h.xp !== nat.xp || tail !== nat.tail) bad.push(`${r.id}/${r.meta} f${r.fortune} seed ${seed}: port ${got} xp${h.xp} ${tail} native ${want} xp${nat.xp} ${nat.tail}`);
    }
  }
  // gravel flint, leaves sapling/apple, redstone, lapis, coal/diamond/emerald/quartz ore fortune, melon, crops/carrots/potatoes (poisonous), tall grass seeds, clay, bookshelf, snow
  for (const id of [13, 18, 161, 73, 74, 21, 16, 56, 129, 153, 103, 59, 141, 142, 31, 80, 82, 47, 79, 2, 1, 110]) assert.ok(covered.has(id), `block ${id} replayed`);
  assert.ok(n > 4000, `compared ${n}`);
  assert.deepEqual(bad.slice(0, 20), []);
});
// Blocks outside harvestBlock: the live path draws other streams, so deterministic drops are compared exactly and random counts by distribution.
const counts = (r) => r.rows.map((row) => parseDrop(row).items.reduce((a, d) => a + d.count, 0));
test("block sweep drops: glowstone, nether wart, dead bush, cocoa, snow layer, stems, sapling, double plant, reeds, farmland drops match", () => {
  const bad = [];
  const rec = (id, meta, f) => of("drop").find((r) => r.id === id && r.meta === meta && r.fortune === f);
  const port = (oid, om, opts) => { const o = fromOriginal(oid, om); return populationDrops(o.id, o.meta, opts) ?? []; };
  const total = (l) => l.reduce((a, d) => a + d.count, 0);
  // cocoa: three beans from stage 2, one before
  for (const [m, want] of [[0, 1], [4, 1], [8, 3], [11, 3]]) { const r = rec(127, m, 0); assert.ok(counts(r).every((c) => c === want)); if (total(port(127, m)) !== want) bad.push(`cocoa ${m}`); }
  // wart: 1 / 2 + nextInt(3) (+ nextInt(f + 1)), seed for seed through wartDropCount (the rest of the stream is the probe-run offsets)
  for (const m of [0, 3]) for (let f = 0; f < 4; f++) { const r = rec(115, m, f); r.rows.forEach((row, seed) => { const nat = parseDrop(row).items.length, rand = new JavaRandom(seed); if (wartDropCount(m, f, rand).count !== nat) bad.push(`wart ${m} f${f} seed ${seed}`); }); }
  // glowstone: min(4, max(1, 2 + nextInt(3) + nextInt(f + 1))) dust, five-draw support: compare the native support and mean to the port's quantity rule
  for (let f = 0; f < 4; f++) { const c = counts(rec(89, 0, f)); assert.ok(c.every((v) => v >= (f ? 2 : 2) && v <= 4), `glowstone f${f} ${c}`); }
  // nothing: dead bush, snow layer (the player harvest path gives the snowballs), double plant halves, farmland gives dirt, reeds give reeds
  for (const [id, m] of [[32, 0], [78, 0], [78, 3], [78, 7], [175, 2], [175, 3]]) assert.ok(counts(rec(id, m, 0)).every((c) => c === 0), `${id}/${m} drops nothing without shears`);
  assert.ok(counts(rec(83, 0, 0)).every((c) => c === 1));
  assert.ok(counts(rec(60, 7, 0)).every((c) => c === 1));
  assert.ok(counts(rec(6, 0, 0)).every((c) => c === 1));
  assert.deepEqual(bad, []);
});

// ---- tile-entity boxes: BlockPistonMoving (36) with a TileEntityPiston ---------------------------------------------------------
// Native rows: facing 0-5 x extending x progress {0, .25, .5, .75, 1}; k = getCollisionBoundingBoxFromPool = the stored block's pool box shifted by
// func_149964_a(progress, facing) with progress = extending ? 1 - p : p. The stored block's own box is "pool" (absolute, cell y = 1).
const PROGS = [0, 0.25, 0.5, 0.75, 1];
test("tile boxes: moving piston collision = stored block's box shifted along the facing (pushBoxOf) for extending tiles", () => {
  let n = 0;
  const bad = [];
  for (const r of of("tebox").filter((x) => x.stored > 0 && Array.isArray(x.pool))) {
    const rel = [r.pool[0], r.pool[1] - 1, r.pool[2], r.pool[3], r.pool[4] - 1, r.pool[5]];
    r.rows.forEach((row, i) => {
      const facing = Math.floor(i / 10), ext = Math.floor(i / 5) % 2 === 1, p = PROGS[i % 5];
      if (!ext) return; // retracting: see the next test
      const tile = { x: 0, y: 1, z: 0, facing, extending: true };
      const got = pushBoxOf(tile, rel, pushArgument(tile, p));
      n++;
      if (JSON.stringify(got) !== JSON.stringify(row.k)) bad.push(`${r.stored}/${r.meta} f${facing} p${p}: port ${JSON.stringify(got)} native ${JSON.stringify(row.k)}`);
    });
  }
  assert.ok(n > 300, `compared ${n}`);
  assert.deepEqual(bad.slice(0, 10), []);
});
test("tile boxes: retracting tiles shift by the progress itself (movingCollisionBox), unlike the entity-push argument p - 1", () => {
  let n = 0;
  const bad = [];
  for (const r of of("tebox").filter((x) => x.stored > 0 && Array.isArray(x.pool))) {
    const rel = [r.pool[0], r.pool[1] - 1, r.pool[2], r.pool[3], r.pool[4] - 1, r.pool[5]];
    r.rows.forEach((row, i) => {
      const facing = Math.floor(i / 10), ext = Math.floor(i / 5) % 2 === 1, p = PROGS[i % 5];
      if (ext) return;
      const tile = { x: 0, y: 1, z: 0, facing, extending: false };
      const got = movingCollisionBox(tile, rel, p);
      n++;
      if (JSON.stringify(got) !== JSON.stringify(row.k)) bad.push(`${r.stored}/${r.meta} f${facing} p${p}: port ${JSON.stringify(got)} native ${JSON.stringify(row.k)}`);
    });
  }
  assert.ok(n > 300, `compared ${n}`);
  assert.deepEqual(bad.slice(0, 10), []);
});
test("tile boxes: no pool box (stored block without collision, air, itself) gives no moving collision; no tile entity gives none", () => {
  for (const r of of("tebox").filter((x) => x.stored <= 0 || x.pool === null)) for (const row of r.rows) assert.ok(row.k === null || typeof row.k === "string", `${r.stored}: ${JSON.stringify(row.k)}`);
});
test("tile boxes: none of the other tile-entity blocks ask for their tile entity while computing boxes, so sweep rows are the present-tile values", () => {
  const ids = of("teq").map((r) => r.id);
  for (const id of [54, 130, 146, 144, 140, 117, 116, 145, 120, 138, 118, 154, 34, 29, 33, 149, 150]) assert.ok(ids.includes(id), `teq ${id}`);
  for (const r of of("teq")) assert.match(r.q, /^0+$/, `block ${r.id} queries a tile entity`);
});
