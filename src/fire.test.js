import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { JavaRandom, lightOpacity, lightEmission } from "./lighting.js";
import { LightningBolt, Weather, stopsPrecipitation, strikeRule } from "./weather.js";
import { World, FIRE, LAVA, WATER, BLOCKS, SIZE } from "./world.js";
import {
  FIRE_INFO, BURNS, encouragement, flammability, solidTop, blocksMovement, canCatchFire, canNeighborBurn, canPlace, updateTick, neighborChange, blockAdded,
  lavaTick, boltStart, boltRestrike, boundingBoxBurning, contract, fireContact, fireVertices, Fire, FIRE_TICKS,
} from "./fire.js";

const reference = JSON.parse(await readFile(new URL("../public/research/fire-reference.json", import.meta.url)));
const f = Math.fround;

// The probe's block ids are 1.7.10's; this build numbers its blocks differently.
const TO_BUILD = { 0: 0, 1: 3, 2: 1, 3: 2, 5: 7, 9: WATER, 10: LAVA, 11: LAVA, 12: 6, 13: 25, 17: 4, 18: 5, 20: 9, 31: 39, 35: 19, 37: 43, 38: 44, 45: 8, 47: 21, 50: 20, 51: FIRE, 54: 41, 58: 13 };
const build = (id) => {
  assert.ok(id in TO_BUILD, `unmapped probe block ${id}`);
  return TO_BUILD[id];
};

// A level over the probe's fixtures: a map of cells, a log of the edits in the probe's own
// format, and the probe World's canSeeSky / getPrecipitationHeight over its 24 layers.
function level(cells, { seed = 1, difficulty = 2, raining = false, fireTick = true, biome = 1 } = {}) {
  const map = new Map(), ops = [], key = (x, y, z) => `${x},${y},${z}`;
  for (let i = 0; i < cells.length; i += 5) {
    const id = build(cells[i + 3]);
    if (id === 0) map.delete(key(...cells.slice(i, i + 3)));
    else map.set(key(...cells.slice(i, i + 3)), [id, cells[i + 4]]);
  }
  const get = (x, y, z) => map.get(key(x, y, z))?.[0] ?? 0;
  const sees = (x, y, z) => {
    for (let yy = Math.max(y, 0); yy < 24; yy++) if (lightOpacity(get(x, yy, z)) !== 0) return false;
    return true;
  };
  const precipitation = (x, z) => {
    for (let yy = 23; yy >= 0; yy--) if (stopsPrecipitation(get(x, yy, z))) return yy + 1;
    return -1;
  };
  const L = {
    map, ops, rand: new JavaRandom(seed), difficulty, fireTick, get,
    meta: (x, y, z) => map.get(key(x, y, z))?.[1] ?? 0,
    setBlock(x, y, z, id, meta) {
      ops.push(`s,${x},${y},${z},${id === FIRE ? 51 : id},${meta}`);
      map.set(key(x, y, z), [id, meta]);
    },
    setAir(x, y, z) {
      ops.push(`a,${x},${y},${z}`);
      map.delete(key(x, y, z));
    },
    setMeta(x, y, z, meta) {
      ops.push(`m,${x},${y},${z},${meta}`);
      const c = map.get(key(x, y, z));
      if (c) c[1] = meta;
    },
    schedule: (x, y, z, delay) => ops.push(`t,${x},${y},${z},${delay}`),
    raining: () => raining,
    strike: (x, y, z) => strikeRule({ raining, sees: sees(x, y, z), precipitation: precipitation(x, z), y, temperature: 1 }),
    humid: () => biome === 21, // the jungle: rainfall above 0.85
    fires() {
      return [...map].filter(([, c]) => c[0] === FIRE).map(([k]) => k.split(",").map(Number)).sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
    },
  };
  return L;
}

test("the reference is the 1.7.10 client's fire classes", () => {
  assert.equal(reference.target, "Minecraft Java 1.7.10");
  assert.equal(reference.clientSha1, "e80d9b3bf5085002218d4be59e668bac718abbc6");
  for (const c of ["alb", "ant", "acw", "xh", "ahb", "aji", "awt", "sa", "blm", "bmh", "mt"]) assert.match(reference.classes[c].sha256, /^[0-9a-f]{64}$/);
  assert.equal(reference.classes.alb.name, "BlockFire");
});

test("fire is block 45, hidden, with light 15 and no light opacity", () => {
  assert.equal(FIRE, 45);
  assert.equal(BLOCKS[FIRE].name, "Fire");
  assert.equal(BLOCKS[FIRE].hidden, true);
  assert.equal(BLOCKS.findIndex((b) => b.name === "Red flower"), FIRE - 1);
  assert.equal(lightEmission(FIRE), 15);
  assert.equal(lightOpacity(FIRE), 0);
  assert.equal(reference.table.find((r) => r[0] === 51)[8], 15);
});

// alb.e() (initFire) and the materials: encouragement, flammability, canBurn, movement
// blocking and the solid top surface for each block this build has.
test("the encouragement, flammability and material tables are the original's for this build's blocks", () => {
  const rows = new Map(reference.table.map((r) => [r[0], r]));
  for (const [vanilla, id] of Object.entries(TO_BUILD)) {
    if (Number(vanilla) === 0) continue;
    const [, enc, flam, burns, , moves, liquid, , , top] = rows.get(Number(vanilla));
    const name = `${vanilla} -> ${id}`;
    assert.equal(encouragement(id), enc, name);
    assert.equal(flammability(id), flam, name);
    assert.equal(BURNS.has(id), burns === 1, name);
    assert.equal(blocksMovement(id), moves === 1 && !liquid, name);
    assert.equal(solidTop(id), top === 1, name);
  }
  // every other table entry of the original that burns is a block this build lacks
  const have = new Set(Object.keys(TO_BUILD).map(Number));
  const lacking = reference.table.filter((r) => r[1] > 0 && !have.has(r[0])).map((r) => r[0]);
  assert.deepEqual(lacking, [46, 53, 85, 106, 125, 126, 134, 135, 136, 161, 162, 170, 171, 173, 175]);
  assert.deepEqual(Object.keys(FIRE_INFO).map(Number).sort((a, b) => a - b), [4, 5, 7, 19, 21, 39, 43, 44]);
});

test("canPlaceBlockAt, onNeighborBlockChange and onBlockAdded match alb", () => {
  assert.equal(reference.place.length, 160);
  let air = 0, kept = 0;
  for (const s of reference.place) {
    const L = level(s.cells, { seed: s.seed });
    assert.equal(canPlace(L, 4, 4, 4) ? 1 : 0, s.can, `seed ${s.seed}`);
    neighborChange(L, 4, 4, 4);
    assert.deepEqual(L.ops, s.neighbour, `neighbour ${s.seed}`);
    const A = level(s.cells, { seed: s.seed });
    blockAdded(A, 4, 4, 4);
    assert.deepEqual(A.ops, s.added, `added ${s.seed}`);
    assert.equal(A.rand.nextInt(1000000), s.next, `random after ${s.seed}`);
    if (s.added[0][0] === "a") air++;
    else kept++;
  }
  assert.ok(air > 20 && kept > 20, "both outcomes are exercised");
});

// BlockFire.updateTick over 56 fixtures (all four difficulties, raining or not, doFireTick
// on and off, a jungle): every setBlock, setBlockToAir, metadata write and scheduled tick the
// original makes, and the next draw of the shared Random.
test("updateTick replays alb.a: ages, burn-out, spread, rain and the quirks", () => {
  assert.equal(reference.ticks.length, 56);
  const total = { s: 0, a: 0, m: 0, t: 0 };
  for (const s of reference.ticks) {
    const L = level(s.cells, { seed: s.seed, difficulty: s.difficulty, raining: s.raining === 1, fireTick: s.doFireTick === 1, biome: s.biome });
    s.steps.forEach(([x, y, z, ops, next], i) => {
      assert.equal(L.get(x, y, z), FIRE, `scenario ${s.seed} step ${i}`);
      L.ops.length = 0;
      updateTick(L, x, y, z);
      assert.deepEqual(L.ops, ops, `scenario ${s.seed} step ${i}`);
      assert.equal(L.rand.nextInt(1000000), next, `scenario ${s.seed} step ${i} random`);
      for (const op of ops) total[op[0]]++;
    });
  }
  // the fixtures cover spreading, burning blocks away, ageing and rescheduling
  assert.ok(total.s > 100 && total.a > 100 && total.m > 100 && total.t > 100, JSON.stringify(total));
});

test("static lava starts fires like ant.a", () => {
  assert.equal(reference.lava.length, 72);
  let placed = 0;
  for (const s of reference.lava) {
    const L = level(s.cells, { seed: s.seed });
    s.steps.forEach(([ops, next], i) => {
      L.ops.length = 0;
      lavaTick(L, 4, 4, 4);
      assert.deepEqual(L.ops, ops, `scenario ${s.seed} tick ${i}`);
      assert.equal(L.rand.nextInt(1000000), next, `scenario ${s.seed} tick ${i} random`);
      placed += ops.length;
    });
  }
  assert.ok(placed > 100);
});

test("lightning bolts place fire at the strike and again on each re-strike like xh", () => {
  assert.equal(reference.bolts.length, 96);
  let start = 0, again = 0;
  for (const s of reference.bolts) {
    const L = level(s.cells, { difficulty: s.difficulty, fireTick: s.doFireTick === 1 });
    const hook = { start: (b) => boltStart(L, b), restrike: (b) => boltRestrike(L, b) };
    const bolt = new LightningBolt(...s.pos, new JavaRandom(s.seed), hook);
    assert.equal(String(bolt.vertex), s.vertex, `bolt ${s.seed}`);
    assert.equal(bolt.living, s.living, `bolt ${s.seed}`);
    assert.deepEqual(L.ops, s.ctor, `bolt ${s.seed} constructor`);
    start += s.ctor.length;
    s.ticks.forEach((t, i) => {
      L.ops.length = 0;
      bolt.tick([]);
      assert.deepEqual([bolt.state, bolt.living, String(bolt.vertex), bolt.dead], [t.state, t.living, t.vertex, t.dead], `bolt ${s.seed} tick ${i}`);
      assert.deepEqual(L.ops, t.ops, `bolt ${s.seed} tick ${i} fire`);
      again += t.ops.length;
    });
  }
  assert.ok(start > 50 && again > 20, `${start} ${again}`);
});

test("a bolt without the hook only flashes, as before fire existed", () => {
  const bolt = new LightningBolt(5, 5, 5, new JavaRandom(3));
  for (let i = 0; i < 30; i++) bolt.tick([]);
  assert.equal(bolt.fire, null);
});

test("isBoundingBoxBurning is true for fire and lava only", () => {
  assert.equal(reference.burning.length, 6);
  let hits = 0, misses = 0;
  for (const s of reference.burning) {
    const L = level(s.cells);
    for (const [x0, y0, z0, x1, y1, z1, burning] of s.boxes) {
      assert.equal(boundingBoxBurning(L.get, contract([x0, y0, z0, x1, y1, z1])), burning === 1, `box ${x0},${y0},${z0}`);
      if (burning) hits++;
      else misses++;
    }
  }
  assert.ok(hits > 100 && misses > 100);
});

test("entities in fire take 1 damage a tick and burn unless wet", () => {
  assert.deepEqual(fireContact(true, false, 0), { damage: 1, fire: FIRE_TICKS });
  assert.deepEqual(fireContact(true, false, 7), { damage: 1, fire: 8 });
  assert.deepEqual(fireContact(true, true, 0), { damage: 1, fire: 0 });
  assert.deepEqual(fireContact(false, false, 5), { damage: 0, fire: 5 });
  assert.equal(FIRE_TICKS, 8 * 20);
});

// RenderBlocks.renderBlockFire's vertex stream, captured from the real Tessellator for 256
// fixtures with stub icons: fire on solid ground (four flame groups) and clinging to
// flammable neighbours and the block above.
test("renderBlockFire's vertices match blm.a", () => {
  const [a, b] = reference.render.icons.map(([u0, u1, v0, v1]) => ({ u0: f(u0), u1: f(u1), v0: f(v0), v1: f(v1) }));
  const counts = new Map();
  assert.equal(reference.render.fixtures.length, 256);
  for (const s of reference.render.fixtures) {
    const map = level(s.cells);
    const out = fireVertices(map.get, ...s.at, [a, b]);
    counts.set(out.length, (counts.get(out.length) ?? 0) + 1);
    assert.equal(out.length, s.vertices.length, `at ${s.at}`);
    s.vertices.forEach((v, i) => {
      assert.deepEqual(out[i].slice(0, 5), v.slice(0, 5).map(f), `at ${s.at} vertex ${i}`);
      // block light 15 at the cell: the stub world's 0x00a000b0 + (15 << 4)
      assert.equal(v[5], 0x00a001a0);
      const layer = out[i][3] === a.u0 || out[i][3] === a.u1 ? 0 : 1;
      assert.equal(out[i][5], layer, `layer at ${s.at} vertex ${i}`);
    });
  }
  for (const n of [8, 16, 24, 32, 40]) assert.ok(counts.has(n), `a fixture with ${n} vertices (${[...counts.keys()]})`);
});

// The pieces the original handles in WorldServer and the client, which the probe cannot run,
// are exercised on a real World.
const flat = () => {
  const w = new World("fire", "meadow");
  for (let x = 20; x < 40; x++) for (let z = 20; z < 40; z++) {
    for (let y = 1; y < 12; y++) w.set(x, y, z, y < 10 ? 3 : 0, false);
    w.set(x, 10, z, 3, false);
    for (let y = 11; y < 64; y++) w.set(x, y, z, 0, false);
  }
  return w;
};
const rig = (extra = {}) => {
  const world = flat(), weather = new Weather({ random: new JavaRandom(5), lcg: 77 });
  const fire = new Fire(world, { weather: () => weather, ...extra });
  fire.watch();
  return { world, weather, fire };
};

test("igniting air on stone adds a fire that burns out, and extinguish removes it", () => {
  const { world, fire } = rig();
  assert.equal(fire.ignite(30, 11, 30), true);
  assert.equal(world.get(30, 11, 30), FIRE);
  assert.equal(fire.ignite(30, 11, 30), false, "only air is ignited");
  assert.equal(fire.drain().length, 1);
  assert.equal(fire.queue.pending.size, 1, "onBlockAdded scheduled its first tick");
  let t = 0;
  while (world.get(30, 11, 30) === FIRE && t++ < 2000) fire.tick(30, 30);
  assert.equal(world.get(30, 11, 30), 0, "fire with nothing to burn goes out");
  assert.ok(t > 30 && t < 2000, `${t}`);
  fire.ignite(30, 11, 30);
  assert.equal(fire.extinguish(30, 11, 30), true);
  assert.equal(world.get(30, 11, 30), 0);
  assert.equal(fire.extinguish(30, 11, 30), false);
});

test("fire cannot hang in the air and is dropped when its support goes", () => {
  const { world, fire } = rig();
  world.set(30, 11, 30, FIRE, true);
  world.set(30, 15, 30, FIRE, true);
  assert.equal(world.get(30, 15, 30), 0, "onBlockAdded removes a fire with no support");
  assert.equal(world.get(30, 11, 30), FIRE);
  world.set(30, 10, 30, 0);
  assert.equal(world.get(30, 11, 30), 0, "onNeighborBlockChange removes it when the floor goes");
  assert.ok(fire.drain().length >= 0);
});

test("fire spreads through planks, burns them away and persists its age", () => {
  const { world, fire } = rig();
  for (let x = 28; x <= 32; x++) for (let z = 28; z <= 32; z++) world.set(x, 11, z, 7, true);
  fire.ignite(30, 12, 30);
  let ageSaved = false;
  for (let t = 0; t < 4000; t++) {
    fire.tick(30, 30);
    for (const [k, v] of world.edits) if ((v & 255) === FIRE && v >> 8 > 0) ageSaved = true;
  }
  assert.ok(ageSaved, "the age is saved as metadata");
  let planks = 0;
  for (let x = 28; x <= 32; x++) for (let z = 28; z <= 32; z++) if (world.get(x, 11, z) === 7) planks++;
  assert.ok(planks < 25, `${planks} planks left`);
});

test("rain puts fire out where it can strike, and wake() reschedules saved fires", () => {
  const { world, weather, fire } = rig();
  world.set(30, 11, 30, FIRE, true, 3);
  fire.queue = new (fire.queue.constructor)();
  fire.wake();
  assert.equal(fire.queue.pending.size, 1);
  weather.raining = true;
  weather.rain = weather.prevRain = 1;
  for (let t = 0; t < 40 && world.get(30, 11, 30) === FIRE; t++) fire.tick(30, 30);
  assert.equal(world.get(30, 11, 30), 0, "an exposed fire in the rain goes out");
});

test("doFireTick off stops fire ticking", () => {
  const { world, fire } = rig({ fireTick: false });
  fire.ignite(30, 11, 30);
  for (let t = 0; t < 300; t++) fire.tick(30, 30);
  assert.equal(world.get(30, 11, 30), FIRE);
});

test("random block ticks reach still lava but not a lava cell with a fluid tick pending", () => {
  let asked = 0;
  const { world, fire } = rig({ stillLava: () => (asked++, true) });
  world.set(30, 11, 30, LAVA, false);
  for (let t = 0; t < 5000 && asked === 0; t++) fire.tick(30, 30);
  assert.ok(asked > 0, "the random tick picks the lava cell");
  const { world: w2, fire: f2 } = rig({ stillLava: () => false });
  w2.set(30, 11, 30, LAVA, false);
  w2.set(31, 11, 30, 7, false);
  for (let t = 0; t < 3000; t++) f2.tick(30, 30);
  for (let x = 25; x < 35; x++) for (let y = 11; y < 16; y++) for (let z = 25; z < 35; z++) assert.notEqual(w2.get(x, y, z), FIRE);
});

test("lava next to wood sets it alight", () => {
  const { world, fire } = rig();
  world.set(30, 11, 30, LAVA, false);
  world.set(31, 12, 30, 7, false);
  world.set(29, 12, 30, 7, false);
  world.set(30, 12, 31, 7, false);
  let lit = false;
  for (let t = 0; t < 20000 && !lit; t++) {
    fire.tick(30, 30);
    for (let x = 28; x < 33; x++) for (let y = 12; y < 15; y++) for (let z = 28; z < 33; z++) if (world.get(x, y, z) === FIRE) lit = true;
  }
  assert.ok(lit);
});

test("a bolt handed to the Weather places fire through the Fire hook", () => {
  const { world, weather, fire } = rig();
  weather.fire = fire.strikes;
  const bolt = new LightningBolt(30.5, 11, 30.5, new JavaRandom(9), weather.fire);
  assert.equal(world.get(30, 11, 30), FIRE, "Normal difficulty: fire at the strike point");
  assert.ok(bolt.dead === false);
});

test("the crackle samples cells near the viewer and plays fire.fire", () => {
  const { world, fire } = rig();
  world.set(30, 11, 30, FIRE, true);
  const heard = [];
  for (let i = 0; i < 400; i++) fire.ambient(30.5, 11.5, 30.5, (...a) => heard.push(a));
  assert.ok(heard.length > 0);
  for (const [x, y, z, vol, pitch] of heard) {
    assert.deepEqual([x, y, z], [30.5, 11.5, 30.5]);
    assert.ok(vol >= 1 && vol < 2 && pitch >= f(0.3) && pitch < 1.0001);
  }
});

test("canCatchFire and canNeighborBurn read the encouragement table", () => {
  const L = level([5, 5, 5, 17, 0, 6, 5, 5, 35, 0, 5, 4, 5, 1, 0], {});
  assert.equal(canCatchFire(L, 5, 5, 5), true);
  assert.equal(canCatchFire(L, 5, 4, 5), false);
  assert.equal(canNeighborBurn(L, 8, 8, 8), false);
  assert.equal(canNeighborBurn(L, 5, 5, 5), true, "the wool beside it");
  assert.equal(canNeighborBurn(L, 4, 5, 5), true);
  assert.equal(SIZE, 128);
});
