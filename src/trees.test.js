import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { World, SIZE, HEIGHT, SAPLING, BLOCKS, ticksRandomly, isPlant, opaqueCube } from "./world.js";
import { JavaRandom } from "./lighting.js";
import {
  Trees, generateTree, generateTreeAt, markLeaves, leafConnected, leafTick, leafDrops, shearedLeaves, placedLeavesMeta,
  boneMealWorks, saplingCanStay, canPlaceOn, canGrowInto, LEAF_CHECK, LEAF_NO_DECAY, SAPLING_MARKED,
} from "./trees.js";

const reference = JSON.parse(await readFile(new URL("../public/research/trees-reference.json", import.meta.url)));
const sha = (s) => createHash("sha256").update(s).digest("hex");

// This build's ids <-> the 1.7.10 ids of the reference (the fixtures only use these).
const MC = { 0: 0, 1: 2, 2: 3, 3: 1, 4: 17, 5: 18, 6: 12, 29: 60, 30: 60, 39: 31, [SAPLING]: 6 };
const JS = { 0: 0, 1: 3, 2: 1, 3: 2, 6: SAPLING, 12: 6, 17: 4, 18: 5, 31: 39, 60: 29 };
const APPLE_MC = 260;

// The probe's fake World: a flat fixture (stone below ground - 3, dirt to the surface, the top block at
// ground, air above) plus edits, with a sparse overlay of changes. Cells are [mc id, meta].
class MapWorld {
  constructor(fixture, base) {
    const g = fixture?.ground ?? 64, top = fixture?.top ?? 2;
    this.base = base || ((x, y, z) => (y < g - 3 ? [1, 0] : y < g ? [3, 0] : y === g ? [top, 0] : [0, 0]));
    this.fixed = new Map();
    for (const [x, y, z, id, meta] of fixture?.edits || []) this.fixed.set(MapWorld.key(x, y, z), [id, meta]);
    this.cells = new Map();
    this.onChange = null;
  }
  static key(x, y, z) { return ((x + 1000) * 100000 + (y + 1000)) * 100000 + (z + 1000); }
  original(x, y, z) { return this.fixed.get(MapWorld.key(x, y, z)) || this.base(x, y, z); }
  cell(x, y, z) {
    if (y < 0 || y > 255) return [0, 0];
    return this.cells.get(MapWorld.key(x, y, z)) || this.original(x, y, z);
  }
  get(x, y, z) { return JS[this.cell(x, y, z)[0]] ?? -1; }
  getMeta(x, y, z) { return this.cell(x, y, z)[1]; }
  put(x, y, z, b, meta = 0) {
    if (y < 0 || y > 255) return false;
    this.cells.set(MapWorld.key(x, y, z), [MC[b], meta]);
    return true;
  }
  set(x, y, z, b, track = true, meta = 0) {
    const old = this.get(x, y, z), oldMeta = this.getMeta(x, y, z);
    if (!this.put(x, y, z, b, meta)) return false;
    if (track && (old !== b || oldMeta !== meta)) this.onChange?.(x, y, z, old, b);
    return true;
  }
  // Probe: setBlock with a Chunk-like breakBlock is done by Trees.onChange; a raw cell write for fixtures.
  putMc(x, y, z, id, meta) { this.cells.set(MapWorld.key(x, y, z), [id, meta]); }
  rebase() { for (const [k, v] of this.cells) this.fixed.set(k, v); this.cells.clear(); }
  // Digest of every cell that differs from the fixture (air without metadata), sorted by x, y, z.
  state() {
    const lines = [];
    for (const [k, v] of [...this.cells].sort((a, b) => a[0] - b[0])) {
      const z = (k % 100000) - 1000, y = Math.floor(k / 100000) % 100000 - 1000, x = Math.floor(k / 10000000000) - 1000;
      const o = this.original(x, y, z), vm = v[0] === 0 ? 0 : v[1], om = o[0] === 0 ? 0 : o[1];
      if (v[0] !== o[0] || vm !== om) lines.push(`${x},${y},${z},${v[0]},${vm}`);
    }
    return sha(lines.join("\n"));
  }
}
const fixtureWorld = (i) => new MapWorld(reference.fixtures[i]);
// maxY 256: the reference world is 256 high (the game's own is 64, HEIGHT).
const trees = (world, random, opts = {}) => new Trees(world, { random, light: () => 15, maxY: 256, ...opts }).watch();

test("the reference records the unchanged 1.7.10 classes", () => {
  assert.equal(reference.target, "Minecraft Java 1.7.10");
  assert.equal(reference.clientSha1, "e80d9b3bf5085002218d4be59e668bac718abbc6");
  for (const c of ["anj", "alt", "aml", "alx", "asq", "ard", "arc", "arn", "ajr", "acj"]) assert.match(reference.classes[c].sha256, /^[0-9a-f]{64}$/, c);
  assert.equal(reference.classes.anj.name, "BlockSapling");
  assert.equal(reference.classes.asq.name, "WorldGenTrees");
  assert.ok(/probe = executed original classes; bytecode = transcribed from javap only/.test(reference.method));
});

test("WorldGenTrees.generate: the original's result, setBlock calls and Random use for every fixture and seed", () => {
  let grown = 0, refused = 0;
  for (const [f, seed, notify, ok, count, digest, next] of reference.gen.rows) {
    const fx = reference.fixtures[f], world = fixtureWorld(f), random = new JavaRandom(seed), log = [];
    const access = {
      get: (x, y, z) => world.get(x, y, z),
      set: (x, y, z, b, meta, flags) => { log.push(`${x},${y},${z},${MC[b]},${meta},${flags}\n`); world.put(x, y, z, b, meta); },
    };
    const got = generateTree(access, random, 0, fx.ground + 1, 0, { notify: !!notify, maxY: 256 });
    const label = `${fx.name} seed ${seed} notify ${notify}`;
    assert.equal(got, !!ok, label);
    assert.equal(log.length, count, label);
    assert.equal(sha(log.join("")), digest, label);
    assert.equal(random.nextInt(1000000), next, label);
    if (got) grown++; else refused++;
  }
  assert.equal(grown, reference.gen.grown);
  assert.equal(refused, reference.gen.refused);
  assert.ok(grown > 100 && refused > 50);
});

test("an oak is a 4 to 6 log trunk with four leaf layers, corners left out on a coin flip", () => {
  const ex = reference.gen.example, world = fixtureWorld(0), random = new JavaRandom(13), log = [];
  generateTree({ get: (x, y, z) => world.get(x, y, z), set: (x, y, z, b, m, fl) => { log.push([x, y, z, MC[b], m, fl]); world.put(x, y, z, b, m); } }, random, 0, 65, 0, { maxY: 256 });
  assert.deepEqual(log, ex);
  assert.deepEqual(ex[0], [0, 64, 0, 3, 0, 2]); // the grass under the trunk becomes dirt first
  const logs = ex.filter((e) => e[3] === 17), leaves = ex.filter((e) => e[3] === 18);
  assert.ok(logs.length >= 4 && logs.length <= 6);
  assert.ok(logs.every((e) => e[0] === 0 && e[2] === 0 && e[4] === 0));
  assert.ok(leaves.every((e) => e[4] === 0)); // natural leaves have no flags
  assert.ok(leaves.length >= 40 && leaves.length <= 60);
});

test("ground rules: grass, dirt and farmland take a sapling, sand and stone do not; a tree grows into air, leaves, grass, dirt, logs and saplings", () => {
  for (const b of [1, 2, 29, 30]) assert.equal(canPlaceOn(b), true, String(b));
  for (const b of [0, 3, 6, 4, 5, 39, SAPLING]) assert.equal(canPlaceOn(b), false, String(b));
  for (const b of [0, 5, 1, 2, 4, SAPLING]) assert.equal(canGrowInto(b), true, String(b));
  for (const b of [3, 6, 39, 29, 9]) assert.equal(canGrowInto(b), false, String(b));
  const w = new MapWorld({ ground: 64, top: 2, edits: [] });
  assert.equal(saplingCanStay(w, 0, 65, 0), true);
  w.put(0, 64, 0, 6, 0);
  assert.equal(saplingCanStay(w, 0, 65, 0), false);
});

test("BlockSapling.updateTick: marks, grows, restores or drops exactly as the original, tick by tick", () => {
  const kinds = { m: 0, g: 0, f: 0, B: 0, d: 0 };
  for (const row of reference.sapling.rows) {
    const fx = reference.fixtures[row.fixture], world = fixtureWorld(row.fixture), random = new JavaRandom(row.seed), sy = fx.ground + 1, drops = [];
    world.putMc(0, sy, 0, 6, row.start);
    let tick = 0;
    const t = trees(world, random, { light: () => row.light, drop: (stacks) => { for (const s of stacks) drops.push([tick, MC[s.id], s.damage]); } });
    let events = "", big = false;
    for (tick = 0; tick < 80; tick++) {
      const r = t.tickSapling(0, sy, 0);
      const c = r === "marked" ? "m" : r === "grew" ? "g" : r === "failed" ? "f" : r === "big" ? "B" : r === true ? "d" : ".";
      events += c;
      if (c in kinds) kinds[c]++;
      if (c === "g" || c === "d" || c === "B") { big = c === "B"; break; }
    }
    const label = `${fx.name} light ${row.light} start ${row.start} seed ${row.seed}`;
    assert.equal(events, row.events, label);
    assert.deepEqual(drops, row.drops, label);
    if (!big) { // the big-tree draw is a documented gap: the tick grew an ordinary tree there
      assert.equal(world.state(), row.state, label);
      assert.equal(random.nextInt(1000000), row.next, label);
    }
  }
  assert.equal(kinds.m, reference.sapling.marks);
  assert.equal(kinds.g, reference.sapling.grows);
  assert.equal(kinds.f, reference.sapling.fails);
  assert.equal(kinds.B, reference.sapling.bigs);
  assert.equal(kinds.d, reference.sapling.lost);
  assert.ok(kinds.m > 50 && kinds.g > 50 && kinds.f > 20 && kinds.d > 10);
});

test("a sapling needs block light 9 above it: at 8 nothing ever happens", () => {
  const dark = reference.sapling.rows.filter((r) => r.light === 8 && r.fixture !== 3);
  assert.ok(dark.length > 3);
  for (const r of dark) assert.ok(/^\.+$/.test(r.events), r.events);
  const lit = reference.sapling.rows.filter((r) => r.light === 9 && r.fixture === 0 && r.start === 0);
  assert.ok(lit.some((r) => /m/.test(r.events)));
});

test("bone meal: the 0.45 roll over 200 seeds and the marked / grown sequence of the original", () => {
  for (let seed = 0; seed < 200; seed++) {
    const random = new JavaRandom(seed);
    let bits = "";
    for (let i = 0; i < 40; i++) bits += boneMealWorks(random) ? "1" : "0";
    assert.equal(bits, reference.bonemeal.bits[seed], `seed ${seed}`);
  }
  const ones = reference.bonemeal.bits.join("").split("1").length - 1;
  assert.ok(Math.abs(ones / 8000 - 0.45) < 0.03, String(ones / 8000));
  for (const row of reference.bonemeal.rows) {
    const fx = reference.fixtures[row.fixture], world = fixtureWorld(row.fixture), random = new JavaRandom(row.seed), sy = fx.ground + 1;
    world.putMc(0, sy, 0, 6, 0);
    const t = trees(world, random);
    let events = "", big = false;
    for (let i = 0; i < 30; i++) {
      const r = t.boneMeal(0, sy, 0);
      const c = r === "none" ? "x" : r === "marked" ? "m" : r === "grew" ? "g" : r === "failed" ? "f" : r === "big" ? "B" : "d";
      events += c;
      if (c === "g" || c === "B") { big = c === "B"; break; }
    }
    const label = `${fx.name} seed ${row.seed}`;
    assert.equal(events, row.events, label);
    if (!big) {
      assert.equal(world.state(), row.state, label);
      assert.equal(random.nextInt(1000000), row.next, label);
    }
  }
  // Bone meal on something that is not a sapling does nothing here.
  assert.equal(trees(fixtureWorld(0), new JavaRandom(1)).boneMeal(0, 65, 0), null);
});

test("BlockLeaves.updateTick: the log-distance search over a cube of leaves, leaf by leaf", () => {
  for (const c of reference.decay.cube) {
    const world = new MapWorld(null, (x, y, z) => (x === 0 && y === c.cy && z === 0 ? [17, 0] : Math.abs(x) <= 8 && Math.abs(y - c.cy) <= 8 && Math.abs(z) <= 8 ? [18, c.meta] : [0, 0]));
    const random = new JavaRandom(99), drops = [];
    const t = trees(world, random, { drop: (stacks) => { for (const s of stacks) drops.push([0, MC[s.id] ?? APPLE_MC, s.damage]); } });
    let row = "", decayed = 0, kept = 0, same = 0;
    for (let dx = -6; dx <= 6; dx++)
      for (let dy = -6; dy <= 6; dy++)
        for (let dz = -6; dz <= 6; dz++) {
          if (!dx && !dy && !dz) { row += "L"; continue; }
          world.cells.clear();
          t.tickLeaves(dx, c.cy + dy, dz);
          const b = world.get(dx, c.cy + dy, dz), m = world.getMeta(dx, c.cy + dy, dz);
          const ch = b === 0 ? "D" : m !== c.meta ? "k" : "n";
          if (ch === "D") decayed++; else if (ch === "k") kept++; else same++;
          row += ch;
        }
    assert.equal(row, c.cells, `meta ${c.meta}`);
    assert.deepEqual([decayed, kept, same], [c.decayed, c.kept, c.same], `meta ${c.meta}`);
    assert.deepEqual(drops.map((d) => [d[0], d[1] === 48 ? 6 : d[1], d[2]]), c.drops, `meta ${c.meta} drops`);
    assert.equal(random.nextInt(1000000), c.next, `meta ${c.meta}`);
  }
  // Player-placed leaves (bit 4) never decay, and unmarked natural leaves are left alone.
  const cube = reference.decay.cube;
  assert.equal(cube[1].meta, 12);
  assert.equal(cube[1].decayed + cube[1].kept, 0);
  // Within four steps of a log a leaf is kept: the 128 cells of the radius 4 diamond.
  assert.equal(cube[0].kept, 128);
});

test("trees whose logs are removed: breakBlock marks within 4, then the scan rounds decay the leaves like the original", () => {
  for (const row of reference.decay.trees) {
    const world = fixtureWorld(0), random = new JavaRandom(row.seed), g = 64;
    const t = trees(world, random);
    generateTree({ get: (x, y, z) => world.get(x, y, z), set: (x, y, z, b, m) => t.edit(x, y, z, b, m, true) }, random, 0, g + 1, 0, { notify: true, maxY: 256 });
    world.rebase();
    let logs = 0, leaves = 0;
    for (let y = g + 1; y < g + 14; y++) for (let x = -4; x <= 4; x++) for (let z = -4; z <= 4; z++) { const b = world.get(x, y, z); if (b === 4) logs++; else if (b === 5) leaves++; }
    assert.equal(logs, row.logs, `seed ${row.seed}`);
    assert.equal(leaves, row.leaves, `seed ${row.seed}`);
    let removed = 0;
    for (let y = g + 1; y < g + 14; y++) if (world.get(0, y, 0) === 4 && y - (g + 1) >= row.keep) { world.set(0, y, 0, 0); removed++; }
    assert.equal(removed, row.removed);
    const drops = [];
    t.drop = (stacks) => { for (const s of stacks) drops.push([round, MC[s.id] ?? APPLE_MC, s.damage]); };
    const rounds = [];
    let round = 0;
    for (; round < 40; round++) {
      let changed = 0;
      for (let x = -4; x <= 4; x++) for (let y = g + 1; y < g + 14; y++) for (let z = -4; z <= 4; z++) {
        if (world.get(x, y, z) !== 5) continue;
        const m = world.getMeta(x, y, z);
        t.tickLeaves(x, y, z);
        if (world.get(x, y, z) !== 5 || world.getMeta(x, y, z) !== m) changed++;
      }
      rounds.push(changed);
      if (!changed) break;
    }
    let after = 0;
    for (let y = g + 1; y < g + 14; y++) for (let x = -4; x <= 4; x++) for (let z = -4; z <= 4; z++) if (world.get(x, y, z) === 5) after++;
    const label = `seed ${row.seed} keep ${row.keep}`;
    assert.equal(rounds.join(","), row.rounds, label);
    assert.equal(after, row.after, label);
    assert.deepEqual(drops.map((d) => [d[0], d[1] === 48 ? 6 : d[1], d[2]]), row.drops, label);
    assert.equal(world.state(), row.state, label);
    assert.equal(random.nextInt(1000000), row.next, label);
  }
  // Removing every log decays the whole crown; a log kept next to it holds only the leaves within reach.
  const all = reference.decay.trees.filter((r) => r.keep === 0), some = reference.decay.trees.filter((r) => r.keep === 3);
  assert.ok(all.every((r) => r.after === 0));
  assert.ok(some.some((r) => r.after > 0));
});

test("breakBlock marking: a leaf marks leaves within 1, a log within 4, with bit 8 whatever the rest of the metadata", () => {
  const cube = (centre) => (x, y, z, cy = 74) => (x === 0 && y === cy && z === 0 ? [centre, 0] : Math.abs(x) <= 7 && Math.abs(y - cy) <= 7 && Math.abs(z) <= 7 ? [18, ((x + y + z) & 3) === 0 ? 4 : (x * y + z) % 5 === 0 ? 1 : 0] : [0, 0]);
  for (const m of reference.decay.marks) {
    const world = new MapWorld(null, cube(m.kind === 1 ? 17 : 18));
    const t = trees(world, new JavaRandom(1));
    world.set(0, m.cy, 0, 0);
    assert.equal(world.state(), m.state, `kind ${m.kind}`);
  }
  // Direct use of the rule.
  const w = new MapWorld(null, cube(17));
  assert.equal(markLeaves(w, 0, 74, 0, 4) > 0, true);
  assert.equal(w.getMeta(1, 74, 0) & LEAF_CHECK, LEAF_CHECK);
  assert.equal(w.getMeta(5, 74, 0), w.original(5, 74, 0)[1]); // five away: untouched
});

test("leaf drops: one in 20 for a sapling, one in 200 for an apple (oak only), the Random advanced like the original", () => {
  for (const d of reference.drops) {
    const random = new JavaRandom(d.seed), lines = [], head = [];
    let saplings = 0, apples = 0;
    for (let i = 0; i < d.calls; i++)
      for (const s of leafDrops(random, d.meta)) {
        const id = s.id === 48 ? 6 : s.id === 200 ? APPLE_MC : s.id;
        lines.push(`${i},${id},${s.damage}\n`);
        if (head.length < 12) head.push([i, id, s.damage]);
        if (id === 6) saplings++; else apples++;
      }
    assert.equal(saplings, d.saplings, `meta ${d.meta}`);
    assert.equal(apples, d.apples, `meta ${d.meta}`);
    assert.equal(sha(lines.join("")), d.digest, `meta ${d.meta}`);
    assert.deepEqual(head, d.head, `meta ${d.meta}`);
    assert.equal(random.nextInt(1000000), d.next, `meta ${d.meta}`);
  }
  assert.equal(reference.drops.find((d) => d.meta === 1).apples, 0); // spruce and the others never drop apples
  assert.equal(reference.drops.find((d) => d.meta === 3).saplings, 118); // jungle: one in 40
});

test("leaf items: shears give the leaves block, a placed leaf block carries bit 4", () => {
  assert.deepEqual(shearedLeaves(8 | 1), { id: 5, damage: 1 });
  assert.equal(placedLeavesMeta(), LEAF_NO_DECAY);
  assert.equal(placedLeavesMeta(2), 6);
  assert.equal(LEAF_NO_DECAY, 4);
  assert.equal(LEAF_CHECK, 8);
  assert.equal(SAPLING_MARKED, 8);
  const w = new MapWorld(null, () => [18, 4 | 8]);
  assert.equal(leafTick(w, 0, 70, 0), null);
  const natural = new MapWorld(null, () => [18, 0]);
  assert.equal(leafTick(natural, 0, 70, 0), null); // unmarked leaves are not checked
});

test("leafTick: marked leaves next to a log keep (check bit cleared), far ones decay", () => {
  const w = new MapWorld(null, (x, y, z) => (x === 0 && y === 70 && z === 0 ? [17, 0] : y === 70 && z === 0 && x > 0 && x < 8 ? [18, 8] : [0, 0]));
  for (let x = 1; x <= 4; x++) assert.deepEqual(leafTick(w, x, 70, 0), { meta: 0 }, `x ${x}`);
  for (let x = 5; x <= 7; x++) assert.deepEqual(leafTick(w, x, 70, 0), { decay: true, meta: 8 }, `x ${x}`);
  assert.equal(leafConnected(w, 4, 70, 0), true);
  assert.equal(leafConnected(w, 5, 70, 0), false);
});

test("the oak sapling is block 48: a crossed plant that ticks randomly and blocks nothing", () => {
  assert.equal(SAPLING, 48);
  assert.equal(BLOCKS[SAPLING].name, "Oak sapling");
  assert.equal(isPlant(SAPLING), true);
  assert.equal(ticksRandomly(SAPLING), true);
  assert.equal(ticksRandomly(5), true); // leaves
  assert.equal(opaqueCube(SAPLING), false);
  const w = new World("sap", "meadow");
  assert.equal(w.solid(10, 40, 10), false);
});

const ALLOWED = [0, 1, 2, 4, 5, 39, 43, 44];
test("generation version 7 only regrows trees; versions up to 6 are untouched", () => {
  assert.equal(new World("x").generationVersion, 7);
  for (const seed of ["Minecraft", "Overworld", "trees"]) {
    const a = new World(seed, "meadow", 6), b = new World(seed, "meadow", 7), b2 = new World(seed, "meadow", 7);
    assert.deepEqual(b.data, b2.data);
    assert.deepEqual(b.meta, b2.meta);
    assert.equal(b.edits.size, 0);
    let diff = 0, logs = 0, leaves = 0;
    for (let i = 0; i < a.data.length; i++) {
      if (b.data[i] === 4) logs++;
      if (b.data[i] === 5) leaves++;
      if (a.data[i] === b.data[i]) continue;
      diff++;
      // Trees (air, leaves, logs, the dirt under a trunk, grass) and the flowers and tall grass whose light and ground depend on the crowns.
      assert.ok(ALLOWED.includes(a.data[i]) && ALLOWED.includes(b.data[i]), `${a.data[i]} -> ${b.data[i]}`);
    }
    assert.ok(diff > 20 && logs > 8 && leaves > 100, `${seed}: ${diff} ${logs} ${leaves}`);
    assert.ok(b.meta.every((m, i) => m === 0 || ![4, 5].includes(b.data[i]))); // generated trees carry no metadata
  }
  // Every v7 trunk stands on dirt (the grass under a trunk becomes dirt) and carries a crown.
  const w = new World("Minecraft", "meadow", 7);
  let trunks = 0;
  for (let x = 2; x < SIZE - 2; x++)
    for (let z = 2; z < SIZE - 2; z++)
      for (let y = 2; y < HEIGHT - 8; y++)
        if (w.get(x, y, z) === 4 && w.get(x, y - 1, z) !== 4) {
          trunks++;
          assert.equal(w.get(x, y - 1, z), 2, `${x},${y},${z}`);
          assert.equal(w.get(x, y + 3, z) === 4 || w.get(x, y + 3, z) === 5, true);
        }
  assert.ok(trunks > 5);
  // The generator draws like the original: same call for the same hashes.
  const m1 = new MapWorld(null), m2 = new MapWorld(null);
  m1.get = m2.get = (x, y, z) => (y <= 20 ? 1 : 0);
  assert.equal(typeof generateTreeAt, "function");
});

// A real World made flat around (50, 22, 50) for the integration tests.
function flat(version = 7) {
  const w = new World("flat", "meadow", version);
  for (let x = 30; x <= 70; x++)
    for (let z = 30; z <= 70; z++) {
      for (let y = 1; y < HEIGHT; y++) w.put(x, y, z, y < 20 ? 3 : y === 20 ? 1 : 0, 0, false);
    }
  return w;
}

test("in a real world a sapling grows into a tree, edits are saved with their metadata and restored", () => {
  const w = flat();
  const changes = [], drops = [];
  const t = new Trees(w, { random: new JavaRandom(7), light: () => 15, apply: (c) => changes.push(...c), drop: (s, x, y, z) => drops.push([s, x, y, z]) }).watch();
  assert.equal(w.set(50, 21, 50, SAPLING, true, 0), true);
  let result = "";
  for (let i = 0; i < 200 && w.get(50, 21, 50) === SAPLING; i++) {
    const r = t.tickSapling(50, 21, 50);
    if (r === "marked") assert.equal(w.getMeta(50, 21, 50), SAPLING_MARKED);
    if (r) result = r;
  }
  assert.match(result, /^grew/);
  assert.equal(w.get(50, 21, 50), 4);
  assert.equal(w.get(50, 20, 50), 2); // dirt under the trunk
  assert.ok(changes.length > 30);
  assert.ok(changes.some(([x, y, z, old, now]) => x === 50 && y === 21 && z === 50 && now === 4));
  // Placing leaves like the player: bit 4 and it survives save/restore.
  w.set(60, 25, 60, 5, true, placedLeavesMeta());
  const saved = [...w.edits].filter(([k]) => k === "60,25,60");
  assert.deepEqual(saved, [["60,25,60", 5 | (4 << 8)]]);
  const copy = flat();
  copy.restore([...w.edits]);
  assert.equal(copy.get(60, 25, 60), 5);
  assert.equal(copy.getMeta(60, 25, 60), 4);
  assert.equal(copy.get(50, 22, 50), 4);
  // Leaves of the grown tree that were marked by an overlapping break keep their bit 8 through a save.
  w.set(50, 21, 50, 0);
  const marked = [...w.edits].filter(([, v]) => (v & 255) === 5 && (v >> 8) & 8);
  assert.ok(marked.length > 0);
  const again = flat();
  again.restore([...w.edits]);
  for (const [k, v] of marked) { const [x, y, z] = k.split(",").map(Number); assert.equal(again.getMeta(x, y, z), v >> 8); }
});

test("a sapling whose ground is removed drops itself as an item and never grows without light", () => {
  const w = flat();
  const drops = [];
  const t = new Trees(w, { random: new JavaRandom(3), light: () => 8, drop: (s, x, y, z) => drops.push([s, x, y, z]) }).watch();
  w.set(50, 21, 50, SAPLING, true, 0);
  for (let i = 0; i < 500; i++) t.tickSapling(50, 21, 50);
  assert.equal(w.get(50, 21, 50), SAPLING);
  assert.equal(w.getMeta(50, 21, 50), 0); // light 8: no roll at all
  w.set(50, 20, 50, 0); // the grass goes: onChange drops the sapling
  assert.equal(w.get(50, 21, 50), 0);
  assert.deepEqual(drops, [[[{ id: SAPLING, count: 1, damage: 0 }], 50, 21, 50]]);
  // Sand does not hold one either.
  w.set(52, 20, 50, 6, true, 0);
  w.put(52, 21, 50, SAPLING, 0, true);
  assert.equal(t.tickSapling(52, 21, 50), true);
  assert.equal(drops.length, 2);
});

test("breaking a log of a grown tree marks leaves; the random tick driver decays them and drops saplings and apples", () => {
  const w = flat();
  const items = [];
  const t = new Trees(w, { random: new JavaRandom(11), lcg: 12345, light: () => 15, drop: (s) => items.push(...s) }).watch();
  assert.ok(generateTreeAt(w, 50, 21, 50, 0.123, 0.456) || generateTreeAt(w, 50, 21, 50, 0.77, 0.31) || generateTreeAt(w, 50, 21, 50, 0.5, 0.5));
  let leaves = 0, logs = [];
  for (let y = 21; y < 32; y++) for (let x = 44; x <= 56; x++) for (let z = 44; z <= 56; z++) { const b = w.get(x, y, z); if (b === 5) leaves++; else if (b === 4) logs.push([x, y, z]); }
  assert.ok(leaves > 20 && logs.length >= 4);
  assert.equal(w.edits.size, 0); // worldgen does not save its blocks
  for (const [x, y, z] of logs) w.set(x, y, z, 0);
  const marked = () => { let n = 0; for (let y = 21; y < 32; y++) for (let x = 44; x <= 56; x++) for (let z = 44; z <= 56; z++) if (w.get(x, y, z) === 5 && w.getMeta(x, y, z) & 8) n++; return n; };
  assert.equal(marked(), leaves);
  // Random ticks, three per section: the chunk of (50, 50) is (3, 3).
  for (let i = 0; i < 20000 && [...w.edits].length >= 0; i++) {
    t.tickChunk(3, 3);
    t.tickChunk(2, 2);
    t.tickChunk(3, 2);
    t.tickChunk(2, 3);
  }
  let left = 0;
  for (let y = 21; y < 32; y++) for (let x = 44; x <= 56; x++) for (let z = 44; z <= 56; z++) if (w.get(x, y, z) === 5) left++;
  assert.equal(left, 0);
  assert.ok(items.length === 0 || items.every((s) => s.id === SAPLING || s.id === 200));
});

test("Trees.tickChunk picks the original's cells: updateLCG = lcg * 3 + 1013904223, x, z, y from j = lcg >> 2", () => {
  const seen = [];
  const world = { get: (x, y, z) => { seen.push([x, y, z]); return 0; }, getMeta: () => 0, sectionTickCount: (cx, cz, s) => (s < 2 ? 1 : 0), put() {}, set() {} };
  const t = new Trees(world, { lcg: 987654321 });
  t.tickChunk(2, 5);
  let lcg = 987654321;
  const expect = [];
  for (let s = 0; s < 2; s++)
    for (let n = 0; n < 3; n++) {
      lcg = (Math.imul(lcg, 3) + 1013904223) | 0;
      const j = lcg >> 2;
      expect.push([2 * 16 + (j & 15), s * 16 + ((j >> 16) & 15), 5 * 16 + ((j >> 8) & 15)]);
    }
  assert.deepEqual(seen, expect);
  assert.equal(seen.length, 6); // sections without a randomly ticking block are skipped
});
