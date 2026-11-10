// Batch 37 (natural-spawning.md "Batch 37"): hopper blocks and hopper minecarts reach the containers and item entities of headless ring
// columns. Replayed in a ring-backed streamed world and in the same world with every chunk resident (native: TileEntityHopper updates in
// every loaded chunk, EntityMinecartHopper wherever its 32-block surroundings exist); the per-tick logs must match.
import test from "node:test";
import assert from "node:assert/strict";
import { World, WorldChunk, RAIL } from "./world.js";
import { HeadlessColumns, attachRing } from "./headless-columns.js";
import { Hoppers, HOPPER, hopperActive, newHopperTile } from "./hopper.js";
import { Minecarts } from "./minecarts.js";
import { JavaRandom } from "./java-random.js";
import { newChest } from "./chest.js";
import { makeStack } from "./inventory.js";
import { ITEMS, burnTime } from "./survival.js";

const STONE = 3, CHEST = 41, ITEM = 3;
const cache = new Map();
const maxStackOf = (s) => ITEMS[s.id]?.stack ?? 64;

function setup(withRing) {
  const world = new World("17", "javaStreamed", 12);
  world.blockLight = () => 0;
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

const stacks = (items) => items.map((s) => (s ? `${s.id}x${s.count}` : "-")).join(",");

function replay(withRing, spots, steps = 120, active = hopperActive) {
  const { world, ring } = setup(withRing);
  const stores = { chests: {}, furnaces: {}, dispensers: {}, hoppers: {}, brewing: {} }, entities = [];
  const read = (x, y, z) => (withRing ? ring.get(x, y, z) : world.get(x, y, z));
  const hoppers = new Hoppers({
    world, chests: () => stores.chests, furnaces: () => stores.furnaces, dispensers: () => stores.dispensers, hoppers: () => stores.hoppers, brewing: () => stores.brewing,
    maxStack: maxStackOf, burnTime, items: () => entities, active: (x, z) => active(world, x, z), changed() {},
  });
  const carts = new Minecarts({ random: () => new JavaRandom(31) });
  const chestAt = (x, y, z) => { world.set(x, y, z, CHEST, true, 0); return (stores.chests[`${x},${y},${z}`] ??= newChest()); };
  const fill = (chest, n) => { for (let i = 0; i < 9; i++) chest.items[i] = makeStack(ITEM, n); };
  const surface = (x, z) => { let y = 200; while (y > 0 && !read(x, y, z)) y--; return y + 1; };
  const watch = [];
  world.ringReads = withRing;
  for (const [x, z] of spots) {
    const y0 = surface(x, z) + 3;
    for (let dx = -1; dx < 12; dx++) for (let dz = -1; dz < 3; dz++) { world.set(x + dx, y0 - 2, z + dz, STONE, true, 0); for (let dy = -1; dy < 4; dy++) world.set(x + dx, y0 + dy, z + dz, 0, true, 0); world.set(x + dx, y0 - 2, z + dz, STONE, true, 0); }
    // A hopper (facing down) between a full chest and an empty one.
    const top = chestAt(x, y0 + 1, z), bottom = chestAt(x, y0 - 1, z);
    fill(top, 20);
    world.set(x, y0, z, HOPPER, true, 0);
    stores.hoppers[`${x},${y0},${z}`] = newHopperTile();
    // A hopper cart under a full chest, and one under dropped items.
    for (const dx of [4, 8]) { world.set(x + dx, y0 - 1, z, STONE, true, 0); world.set(x + dx, y0, z, RAIL, true, 0); }
    const cartChest = chestAt(x + 4, y0 + 1, z);
    fill(cartChest, 30);
    const a = carts.spawnCart(5, { x: x + 4.5, y: y0, z: z + 0.5, items: [] }, { seed: 7 }), b = carts.spawnCart(5, { x: x + 8.5, y: y0, z: z + 0.5, items: [] }, { seed: 8 });
    for (let k = 0; k < 3; k++) entities.push({ x: x + 8.5, y: y0 + 1.6, z: z + 0.5, stack: makeStack(ITEM, 5), dead: false });
    watch.push({ top, bottom, cartChest, a, b, hop: () => stores.hoppers[`${x},${y0},${z}`] });
  }
  world.ringReads = false;
  const log = [];
  for (let t = 0; t < steps; t++) {
    world.ringReads = withRing;
    try { hoppers.tick(); carts.tick(world, { entities: [], host: { transfer: hoppers.host, changed() {} } }); } finally { world.ringReads = false; }
    log.push(watch.map((w) => [stacks(w.top.items), stacks(w.bottom.items), stacks(w.cartChest.items), w.hop() ? stacks(w.hop().items) : "", stacks(w.a.slots), stacks(w.b.slots)].join("|")).join("/") + `#${entities.filter((e) => !e.dead).length}`);
  }
  return { log, watch, entities };
}

const spots = [[150, 40], [170, 90], [-40, 60], [125, 100]]; // ring chunks 9, 10, -3 and the resident halo (chunk 7)
test("hopper blocks and hopper carts in ring columns move items like the all-resident world", () => {
  const a = replay(true, spots), b = replay(false, spots);
  for (let i = 0; i < a.log.length; i++) assert.equal(a.log[i], b.log[i], `tick ${i}`);
  const w = b.watch[0];
  assert.ok(w.bottom.items.some(Boolean), "the hopper filled the chest below");
  assert.ok(w.a.slots.some(Boolean), "the cart took items from the chest above");
  assert.ok(w.b.slots.some(Boolean) && b.entities.some((e) => e.dead), "the cart picked up dropped items");
  assert.ok(a.watch.slice(0, 3).every((x) => x.bottom.items.some(Boolean) && x.a.slots.some(Boolean) && x.b.slots.some(Boolean)), "every ring spot worked");
});

test("with the old window-only rule a hopper in a ring column does not tick", () => {
  const a = replay(true, spots.slice(0, 1), 40, (world, x, z) => !world.streaming || world.isTicking(x, z));
  assert.equal(a.watch[0].bottom.items.some(Boolean), false);
  assert.ok(a.watch[0].a.slots.some(Boolean), "carts already had the chest above them (their world reads work in the ring)");
});

test("a hopper cart whose column takes no writes yet waits", () => {
  const { world, ring } = setup(true);
  ring.isHydrated = () => false; ring.touch();
  const carts = new Minecarts({ random: () => new JavaRandom(31) });
  world.ringReads = true;
  const x = 150, z = 40;
  let y = 200; while (y > 0 && !world.get(x, y, z)) y--; y += 3;
  const chests = {};
  world.set(x, y + 1, z, CHEST, true, 0);
  assert.equal(world.get(x, y + 1, z), 0, "an unhydrated column takes no writes");
  const cart = carts.spawnCart(5, { x: x + 0.5, y, z: z + 0.5, items: [] }, { seed: 7 });
  const entities = [{ x: x + 0.5, y: y + 1.6, z: z + 0.5, stack: makeStack(ITEM, 5), dead: false }];
  for (let i = 0; i < 20; i++) carts.tick(world, { entities: [], host: { transfer: { world, items: () => entities, maxStack: maxStackOf, chests: () => chests, changed() {} }, changed() {} } });
  world.ringReads = false;
  assert.equal(entities[0].dead, false);
  assert.equal(cart.slots.some(Boolean), false);
});
