// Batch 25 (natural-spawning.md "Round 7"): minecarts, boats, fireballs, wither skulls, portal travel, fluid ticks and redstone
// ticks in the headless ring. The replays tick the same setups in a ring-backed streamed world and in the same world with every
// chunk resident, where the native rules are applied directly (entities: the 5 x 5 chunks around them exist).
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { World, WorldChunk, WATER, LAVA, RAIL } from "./world.js";
import { EntityWorld } from "./entities.js";
import { JavaRandom } from "./java-random.js";
import { localDifficulty } from "./difficulty.js";
import { HeadlessColumns, attachRing } from "./headless-columns.js";
import { Survival } from "./survival.js";
import { Minecarts } from "./minecarts.js";
import { Boats } from "./boats.js";
import { Fluids } from "./fluids.js";
import { LiveRedstone } from "./redstone-live.js";
import { DimensionLive } from "./dimension-live.js";
import { ringEntityActive, ringBlockTickActive } from "./streaming-ticks.js";

const STONE = 3;
const PLATE_ID = (await import("./block-registry.js")).fromOriginal(70, 0).id;
const O_LEVER = 69, O_LAMP = 123, O_TORCH = 76, O_WIRE = 55, O_STONE = 1, O_PLATE = 70;
const silence = (w) => { w.blockLight = () => 0; return w; };
const world12 = () => silence(new World("17", "javaStreamed", 12));
const cache = new Map(); // generated columns are a pure function of the seed: both replays share them
const inWindow = (e) => e.x >= 0 && e.x < 128 && e.z >= 0 && e.z < 128;
function seeded(seed) { const r = new JavaRandom(seed); return () => r.nextDouble(); }

// A ring-backed world (ring held over chunks -6..14 around player chunk 4, 4) or the same area all resident.
function setup(withRing) {
  const world = world12();
  const column = (cx, cz) => { const k = `${cx},${cz}`; return cache.get(k) ?? (cache.set(k, world.chunkAt(cx, cz) ? { blocks: world.chunkAt(cx, cz).blocks, metadata: world.chunkAt(cx, cz).meta } : world.generateTerrainChunk(cx, cz)), cache.get(k)); };
  const ring = new HeadlessColumns(world, { generate: column, perTick: 1000, every: 1 });
  if (withRing) { ring.update(4, 4); attachRing(world, ring); } else {
    for (let cx = -6; cx <= 14; cx++) for (let cz = -6; cz <= 14; cz++) {
      if (world.chunkAt(cx, cz)) continue;
      const c = column(cx, cz), chunk = new WorldChunk(cx, cz, 256);
      chunk.blocks.set(c.blocks); chunk.meta.set(c.metadata);
      world.chunks.set(`${cx},${cz}`, chunk);
    }
    world.minX = -96; world.maxX = 240; world.minZ = -96; world.maxZ = 240;
    world.isTicking = (x, z) => { const cx = Math.floor(x) >> 4, cz = Math.floor(z) >> 4; for (let a = cx - 2; a <= cx + 2; a++) for (let b = cz - 2; b <= cz + 2; b++) if (!world.chunkAt(a, b)) return false; return true; };
  }
  return { world, ring };
}

const REPLAY_STEPS = 320;
function replay(withRing) {
  const realRandom = Math.random;
  Math.random = seeded(4242);
  try {
    const { world, ring } = setup(withRing);
    const reads = (on) => { if (withRing) world.ringReads = on; };
    const rand = new JavaRandom(77);
    const mobs = new EntityWorld(world, [], () => rand.nextDouble());
    mobs.worldRandom = new JavaRandom(1234);
    mobs.entitySeed = (r) => r.seed;
    mobs.difficulty = 2;
    mobs.localDifficulty = () => localDifficulty(2, 18000, 0, true);
    mobs.currentDate = () => new Date(2014, 9, 31);
    mobs.lightAt = () => 0; mobs.thunderLightAt = () => 0; mobs.fullLightAt = () => 0; mobs.skyLightAt = () => 0;
    mobs.lightSubtracted = () => 11; mobs.isThundering = () => false; mobs.isDaytime = () => false;
    mobs.naturalSpawning = false;
    if (withRing) mobs.ring = ring;
    const ignites = [];
    mobs.ignite = (x, y, z) => ignites.push([x, y, z]);
    const fluids = new Fluids(world, { seed: 5 });
    const changes = [];
    const redstone = new LiveRedstone(world, { changed: (x, y, z, a, b) => changes.push([x, y, z, a ?? -1, b ?? -1]) });
    const carts = new Minecarts({ random: () => new JavaRandom(31) }), boats = new Boats({ random: () => new JavaRandom(32) });
    const read = (x, y, z) => (withRing ? ring.get(x, y, z) : world.get(x, y, z));
    const surface = (x, z) => { let y = 200; while (y > 0 && !read(x, y, z)) y--; return y + 1; };
    // Ring places in chunks 8 to 12 and -4..-1 (inside the ring's 5 x 5 test) and chunk 7 (resident, outside the ticking window).
    const spots = [[150, 40], [170, 90], [190, 60], [120, 120], [40, 170], [180, 180], [-40, 60], [200, 20], [125, 30], [60, -40], [-30, -30], [100, 190]];
    const levers = [], regions = [];
    reads(true);
    for (const [i, [x, z]] of spots.entries()) {
      const y0 = surface(x, z) + 3, kind = i % 4;
      regions.push([x - 3, y0 - 6, z - 3]);
      if (kind === 0) { // two carts on a straight track: they roll, meet and trade motion
        for (let dx = 0; dx < 14; dx++) { world.set(x + dx, y0 - 1, z, STONE, true, 0); world.set(x + dx, y0, z, RAIL, true, 1); }
        const a = carts.spawnEmpty({ x: x + 1.5, y: y0, z: z + 0.5 }, { seed: 100 + i }), b = carts.spawnEmpty({ x: x + 11.5, y: y0, z: z + 0.5 }, { seed: 200 + i });
        a.vx = 0.4; b.vx = -0.2;
      } else if (kind === 1) { // a boat in a walled pool of water sources
        for (let dx = -1; dx <= 5; dx++) for (let dz = -1; dz <= 5; dz++) {
          world.set(x + dx, y0 - 1, z + dz, STONE, true, 0);
          if (dx < 0 || dx > 4 || dz < 0 || dz > 4) world.set(x + dx, y0, z + dz, STONE, true, 0);
          else world.set(x + dx, y0, z + dz, WATER, true, 0);
        }
        boats.spawnBoat({ x: x + 2.5, y: y0 + 0.4, z: z + 2.5, vx: 0.15, vz: -0.05 }, { seed: 300 + i });
      } else if (kind === 2) { // water off a pillar, lava beside it: flow over ring terrain, hardening and fizz draws
        world.set(x, y0 - 1, z, STONE, true, 0); world.set(x, y0, z, WATER, true, 0);
        world.set(x + 3, y0 - 1, z + 2, STONE, true, 0); world.set(x + 3, y0, z + 2, LAVA, true, 0);
      } else { // lever -> lamp; lever -> stone under a torch -> wire; an idle stone plate (watched)
        for (let dx = -1; dx <= 3; dx++) for (let dz = -1; dz <= 2; dz++) world.set(x + dx, y0 - 1, z + dz, STONE, true, 0);
        redstone.setBlock(x, y0, z, O_STONE, 0, 3);
        redstone.setBlock(x + 1, y0, z, O_LEVER, 5, 3);
        redstone.setBlock(x + 2, y0, z, O_LAMP, 0, 3);
        redstone.setBlock(x, y0 + 1, z, O_TORCH, 5, 3);
        redstone.setBlock(x, y0, z + 1, O_STONE, 0, 3);
        redstone.setBlock(x, y0 + 1, z + 1, O_WIRE, 0, 3);
        redstone.setBlock(x + 2, y0, z + 2, O_PLATE, 0, 3);
        levers.push([x + 1, y0, z]);
      }
      // A small fireball down into the terrain, and at every third spot a large one and a wither skull (explosion events).
      mobs.fireballs.launch({ large: false, owner: null, x: x + 4.5, y: y0 + 8, z: z + 4.5, exact: [0.02, -0.1, 0.01] });
      if (i % 3 === 0) {
        mobs.fireballs.launch({ large: true, owner: null, x: x - 2.5, y: y0 + 10, z: z - 2.5, exact: [0, -0.1, 0.03] });
        mobs.skulls.launch({ owner: null, x: x + 6.5, y: y0 + 12, z: z + 1.5, dx: 0.3, dy: -1, dz: 0.2 });
      }
    }
    reads(false);
    const player = { x: 72.5, y: 80, z: 72.5, alive: true, width: 0.6, height: 1.8 }, survival = new Survival(), log = [];
    const counts = { cartTicks: 0, boatTicks: 0, fluidChanges: 0, redstoneChanges: 0, ballTicks: 0, explosions: 0 };
    for (let tick = 0; tick < REPLAY_STEPS; tick++) {
      reads(true);
      let fluid, events;
      const mark = changes.length;
      try {
        if (tick % 20 === 3) for (const [x, y, z] of levers) redstone.use(x, y, z);
        fluid = fluids.tick();
        redstone.tick();
        carts.tick(world, { entities: [] });
        boats.tick(world, { entities: [] });
        mobs.tick(player, survival);
        events = mobs.events.splice(0).filter((e) => e.explode).map((e) => [e.explode.x, e.explode.y, e.explode.z, e.explode.size]);
      } finally { reads(false); }
      const rs = changes.slice(mark);
      counts.cartTicks += carts.carts.filter((c) => !inWindow(c) && (c.vx || c.vz)).length;
      counts.boatTicks += boats.carts.filter((c) => !inWindow(c)).length;
      counts.fluidChanges += fluid.filter(([x, , z]) => !inWindow({ x, z })).length;
      counts.redstoneChanges += rs.filter(([x, , z]) => !inWindow({ x, z })).length;
      counts.ballTicks += [...mobs.fireballs.list, ...mobs.skulls.list].filter((b) => !b.dead && !inWindow(b)).length;
      counts.explosions += events.length;
      log.push({
        tick, fluid, rs, events, ignites: ignites.length,
        carts: carts.carts.map((c) => [c.id, c.x, c.posY, c.z, c.vx, c.vz]),
        boats: boats.carts.map((c) => [c.id, c.x, c.posY, c.z, c.vx, c.vz, c.dead]),
        balls: [...mobs.fireballs.list, ...mobs.skulls.list].map((b) => [b.id, b.x, b.y, b.z, b.dead]),
        rand: [fluids.random.seed, redstone.rand.seed].map(String),
      });
    }
    const blocks = regions.map(([x0, y0, z0]) => { const out = []; for (let x = x0; x < x0 + 18; x++) for (let y = y0; y < y0 + 16; y++) for (let z = z0; z < z0 + 8; z++) out.push(read(x, y, z), withRing ? ring.getMeta(x, y, z) : world.getMeta(x, y, z)); return out.join(","); });
    return { log, blocks, counts, ignites, world, ring };
  } finally { Math.random = realRandom; }
}

test("carts, boats, fireballs, skulls, fluids and redstone in ring chunks tick like the all-resident world over 320 ticks", () => {
  const a = replay(true), b = replay(false);
  for (let i = 0; i < a.log.length; i++) assert.deepEqual(a.log[i], b.log[i], `tick ${i}`);
  assert.deepEqual(a.blocks, b.blocks, "the ring cells end up the same");
  assert.deepEqual(a.ignites, b.ignites);
  const c = a.counts;
  assert.ok(c.cartTicks > 500 && c.boatTicks > 500 && c.fluidChanges > 100 && c.redstoneChanges > 20 && c.ballTicks > 50 && c.explosions > 0, JSON.stringify(c));
});

test("blockTicks: a ring entry runs when its column takes writes and the eight chunks around it are held", () => {
  const { world, ring } = setup(true);
  const z = 70;
  assert.equal(ring.blockTicks(13 * 16 + 4, z), true, "chunk 13: 12..14 held");
  assert.equal(ring.blockTicks(14 * 16 + 4, z), false, "chunk 14: 15 is not held");
  assert.equal(ringBlockTickActive(world, 14 * 16 + 4, z), false);
  assert.equal(ringBlockTickActive(world, 7 * 16 + 4, z), true, "the resident halo ticks once the ring holds its neighbours");
  ring.isHydrated = (cx) => cx !== 13;
  ring.touch();
  assert.equal(ring.blockTicks(13 * 16 + 4, z), false, "an unhydrated column takes no writes, so its entries wait");
  assert.equal(ring.writable(13 * 16 + 4, z), false);
  // Without a ring only the resident ticking window runs.
  const plain = world12();
  assert.equal(ringBlockTickActive(plain, 7 * 16 + 4, z), false);
  assert.equal(ringBlockTickActive(plain, 3 * 16, z), true);
});

test("a fluid entry at the ring rim waits; it runs once the ring holds the chunks around it", () => {
  const { world, ring } = setup(true);
  const fluids = new Fluids(world, { seed: 1 });
  const x = 14 * 16 + 13, z = 72; // 13 + 5 reaches into chunk 15, which is not held (a fluid's 5-block reach, batch 26)
  world.ringReads = true;
  let y = 200; while (y > 0 && !world.get(x, y, z)) y--;
  world.set(x, y + 3, z, STONE, true, 0);
  world.set(x, y + 4, z, WATER, true, 0);
  for (let i = 0; i < 20; i++) fluids.tick();
  assert.equal(world.get(x + 1, y + 4, z), 0, "no flow: chunk 15 is not held");
  assert.equal(fluids.heap.length > 0, true, "the entry is kept");
  const cols = new Map(ring.cols);
  ring.cx = 6; ring.radius = 10; ring.keep = 12; ring.dirty = true; ring.update(6, 4); // the ring now reaches chunk 16
  for (const [k, c] of cols) if (!ring.cols.has(k)) ring.cols.set(k, c);
  for (let i = 0; i < 20; i++) fluids.tick();
  world.ringReads = false;
  assert.equal(ring.get(x + 1, y + 4, z), WATER, "the water spread in the ring column");
});

test("redstone offers ring cells only during the simulation tick, and finds plates in ring columns", () => {
  const { world, ring } = setup(true);
  const redstone = new LiveRedstone(world);
  const x = 150, z = 40;
  assert.equal(redstone.loaded(x, 80, z), false, "outside the tick ring reads answer air");
  world.ringReads = true;
  assert.equal(redstone.loaded(x, 80, z), true);
  assert.equal(redstone.tickable(x, 80, z), true);
  assert.equal(redstone.tickable(14 * 16 + 2, 80, z), false, "rim chunk");
  // A plate written into a ring column by something other than the redstone engine is found by the scan.
  ring.putOutside(x, 119, z, STONE, 0, true);
  ring.putOutside(x, 120, z, PLATE_ID, 0, true); // a stone pressure plate
  redstone.watched.clear();
  redstone.scan();
  world.ringReads = false;
  assert.ok([...redstone.watched.values()].some((p) => p.x === x && p.y === 120 && p.z === z), "ring plate watched");
});

test("fireballs and wither skulls freeze where their 32-block surroundings are missing and die outside 0 <= y < 256", () => {
  const { world, ring } = setup(true);
  const mobs = new EntityWorld(world, [], seeded(3));
  mobs.ring = ring;
  const frozen = mobs.fireballs.launch({ large: false, owner: null, x: 13 * 16 + 4, y: 120, z: 70, exact: [0.1, 0, 0] });
  const flying = mobs.fireballs.launch({ large: false, owner: null, x: 12 * 16 + 4, y: 200, z: 70, exact: [0, 0, 0.1] });
  const high = mobs.fireballs.launch({ large: true, owner: null, x: 60, y: 255.5, z: 60, exact: [0, 0.1, 0] });
  const skull = mobs.skulls.launch({ owner: null, x: 13 * 16 + 8, y: 150, z: 80, dx: 1, dy: 0, dz: 0 });
  for (let i = 0; i < 5; i++) mobs.tick({ x: 72, y: 80, z: 72, alive: true, width: 0.6, height: 1.8 }, new Survival());
  assert.deepEqual([frozen.x, frozen.ticks], [13 * 16 + 4, 0], "chunk 13 fails the 5 x 5 test: no update");
  assert.equal(skull.ticks, 0);
  assert.ok(flying.ticks === 5 && flying.z > 70, "chunk 12 updates");
  assert.equal(high.dead, true, "blockExists is false at y 256");
  assert.equal(mobs.events.some((e) => e.explode), false, "a ball removed by blockExists does not explode");
});

test("carts with a ring roll past the resident window; without one they keep the window clamp", () => {
  const { world } = setup(true);
  const carts = new Minecarts({ random: () => new JavaRandom(1) });
  world.ringReads = true;
  const x = 124, z = 40;
  let y = 200; while (y > 0 && !world.get(x, y, z)) y--;
  y += 3;
  for (let dx = 0; dx < 20; dx++) { world.set(x + dx, y - 1, z, STONE, true, 0); world.set(x + dx, y, z, RAIL, true, 1); }
  const cart = carts.spawnEmpty({ x: x + 0.5, y, z: z + 0.5 }, { seed: 1 });
  cart.vx = 0.4;
  for (let i = 0; i < 40; i++) carts.tick(world);
  world.ringReads = false;
  assert.ok(cart.x > 130, `the cart left the resident window (${cart.x})`);
  assert.equal(ringEntityActive(world, cart), true);
  // No ring: the old guard keeps the cart inside the window.
  const plain = world12(), c2 = new Minecarts({ random: () => new JavaRandom(1) });
  const p = c2.spawnEmpty({ x: 127, y: 100, z: 40 }, { seed: 1 });
  p.vx = 0.4; plain.isTicking = () => true;
  c2.tick(plain);
  assert.ok(p.x <= 128 - 0.49, "clamped");
});

test("portal travel steps ring entities that update, not frozen ones", () => {
  const { world } = setup(true);
  const stepped = [];
  const self = { busy: false, host: { active: () => ({}) }, rootRecord: () => ({ id: 1 }), portals: { step: (e) => { stepped.push(e.id); return null; } }, depart() {} };
  const items = { items: [{ id: "in-ring", x: 150, y: 80, z: 40 }, { id: "rim", x: 13 * 16 + 4, y: 80, z: 40 }, { id: "window", x: 60, y: 80, z: 60 }] };
  DimensionLive.prototype.tickEntities.call(self, world, { items });
  assert.deepEqual(stepped, ["in-ring", "window"]);
});

test("the ring's vehicle, fireball and block-tick rules are the bytecode-read ones (ring-ticks-reference.json)", async () => {
  const ref = JSON.parse(await readFile(new URL("../public/research/ring-ticks-reference.json", import.meta.url), "utf8")).facts;
  assert.deepEqual([ref.vehicleChunkTests, ref.portalChunkTests, ref.scheduleRange, ref.tickUpdatesRange, ref.blockExistsHeight], [0, 0, 0, 0, 256]);
  assert.equal(ref.fireballBlockExists, true);
  assert.deepEqual(ref.fireballSubclassesKeepOnUpdate, { zg: true, zi: true, zp: true });
});
