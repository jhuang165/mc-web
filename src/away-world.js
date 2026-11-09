// The Overworld's spawn area while the only player is in the Nether or the End (batch 30, public/research/dimensions.md "Batch 30").
//
// Native rules this ports (bytecode-read, WorldServer mt, ChunkProviderServer ms, World ahb):
//   - ms.b (unloadChunksIfNotNearSpawn) never queues a chunk whose centre (16c + 8) is within 128 blocks of the world spawn, so those
//     chunks stay loaded with nobody in the Overworld; every other chunk unloads (and so stops ticking).
//   - MinecraftServer ticks every WorldServer. mt.b runs tickUpdates (scheduled block updates: water, lava, fire, falling blocks, redstone,
//     repeaters, torches, comparators) with no player test, so they keep running in the spawn area for as long as the player is away.
//   - mt.h (updateEntities) counts P++ >= 1200 while the world has no players and then returns before World.updateEntities: entities and
//     tile entities (furnaces, hoppers, brewing stands, pistons) update for exactly 1200 ticks (60 s) after the last player leaves, then freeze.
//   - Random ticks, natural spawning and village sieges all iterate the world's own players, so none of them run.
//
// The whole thing runs headlessly on a World whose columns are the spawn-area columns that hold work, plus a one-column halo, and
// returns the advanced runtime state and the edited columns. The browser runs it in away-worker.js.
import { World, WorldChunk } from "./world.js";
import { Fluids } from "./fluids.js";
import { Fire } from "./fire.js";
import { FallingBlocks } from "./falling.js";
import { createRedstoneRuntime } from "./redstone-runtime.js";
import { Hoppers } from "./hopper.js";
import { Survival, burnTime } from "./survival.js";
import { brewingView, BREWING_STAND, maxStackOf } from "./brewing.js";
import { Weather } from "./weather.js";
import { makeStack } from "./inventory.js";
import { awayEntities } from "./away-entities.js";
import { WATER, LAVA } from "./world.js";
import { JavaRandom } from "./java-random.js";
import { AWAY_ENTITY_TICKS, SPAWN_RADIUS, MAX_AWAY_TICKS, MAX_COLUMNS, WALL_BUDGET_MS, inSpawnArea, spawnOf, stateColumns, awayPlan } from "./away-plan.js";

export { AWAY_ENTITY_TICKS, SPAWN_RADIUS, MAX_AWAY_TICKS, MAX_COLUMNS, WALL_BUDGET_MS, inSpawnArea, spawnOf, stateColumns, awayPlan };
const key = (cx, cz) => `${cx},${cz}`;

// Runs `plan.ticks` away ticks over `plan.chunks` (live column copies) and `plan.records` (the columns' stored edits, as readChunkColumns returns them).
// Resolves { columns, fluidTicks, fireTicks, fallingTicks, falling, redstone, pistons, tiles, drops, stats } or null when nothing ran.
export async function runAway(plan, { now = () => performance.now(), budgetMs = WALL_BUDGET_MS, world: given = null } = {}) {
  const started = now();
  if (!plan.ticks || plan.biome !== "javaStreamed") return null;
  // The away World is a Superflat shell (no terrain generation): its columns are the live blocks the main thread copied at departure
  // (plan.chunks: { x, z, blocks, meta }), so the run sees exactly what the player left. A column without a copy is not loaded.
  const world = given ?? new World(plan.seed, "javaStreamed", 15, "flat", "");
  const wanted = new Set((plan.chunks ?? []).map((c) => key(c.x, c.z)));
  if (!wanted.size) return null;
  world.chunks = new Map(); world.lastChunk = null;
  for (const c of plan.chunks) {
    const chunk = new WorldChunk(c.x, c.z, world.height);
    chunk.blocks.set(c.blocks); chunk.meta.set(c.meta);
    world.chunks.set(key(c.x, c.z), chunk);
  }
  const setupMs = Math.round(now() - started), loopStart = now();
  world.restoreColumns((plan.records ?? []).filter((r) => wanted.has(key(r.x, r.z))));
  world.nextEditOrder = Math.max(world.nextEditOrder, plan.editSequence | 0);
  world.dirtyColumns.clear();
  // Only the spawn area is loaded: a write outside it, or into a column the run did not load, is refused. Every write is an edit.
  const spawn = plan.spawn, ticking = (x, z) => { const cx = Math.floor(x) >> 4, cz = Math.floor(z) >> 4; return wanted.has(key(cx, cz)) && inSpawnArea(spawn, cx, cz); }; // entities pass fractional coordinates
  world.isTicking = ticking;
  const put = world.put.bind(world);
  world.put = (x, y, z, b, meta = 0) => ticking(x, z) && put(x, y, z, b, meta, true);

  const drops = [], tiles = plan.tiles, spill = (stack, x, y, z) => {
    const made = makeStack(stack.id, stack.count, stack.damage || 0);
    if (ents) ents.spill(made, x, y, z); else drops.push({ stack: made, x, y, z, age: 0, delay: 10 });
  };
  let ents = null;
  const rand = Number(BigInt.asUintN(32, BigInt(plan.editSequence | 0) * 2654435761n + BigInt(plan.ticks)));
  const fluids = new Fluids(world, {
    seed: rand,
    wash: (x, y, z, b) => spill({ id: b, count: 1, damage: 0 }, x + 0.5, y + 0.25, z + 0.5),
  });
  const weather = new Weather().restore(plan.weather);
  const fire = new Fire(world, { weather: () => weather, stillLava: (x, y, z) => !fluids.pending.has(fluids.key(x, y, z, 11)) });
  fire.watch(); fire.sharedRandomTicks = true;
  const falling = new FallingBlocks(world, { drop: (stack, x, y, z) => spill(stack, x, y, z) }, plan.falling ?? []);
  falling.watch();
  if (plan.fluidTicks) fluids.load(plan.fluidTicks);
  if (plan.fireTicks) fire.load(plan.fireTicks);
  if (plan.fallingTicks) falling.load(plan.fallingTicks);
  const sv = new Survival({}, "survival");
  const unsupported = { hit: false }; // a dispense the run cannot make (arrow, potion, fireball, firework): the stack is put back
  const dispRand = new JavaRandom(BigInt(rand) * 40503n + 7n);
  const rt = createRedstoneRuntime({ world, scene: null, game: {
    chests: () => tiles.chests, furnaces: () => tiles.furnaces, dispensers: () => tiles.dispensers, hoppers: () => tiles.hoppers, brewing: () => tiles.brewing, maxStack: (s) => maxStackOf(s.id ?? s),
    drop: (x, y, z, d) => spill(d, x + 0.5, y + 0.5, z + 0.5), sound() {}, markUnsaved() {}, player: () => null, mobs: () => null, commandHost: () => null,
    items: () => ents?.items.items ?? [], itemSystem: () => ents?.items, arrows: () => [], orbs: () => ents?.xp.orbs ?? [], orbSystem: () => ents?.xp, primed: () => ents?.primed ?? [],
    minecarts: () => ents?.minecarts, boats: () => ents?.boats.carts ?? [], boatSystem: () => ents?.boats, falling: () => falling.entities,
    primeTnt: (x, y, z) => ents?.prime(x + 0.5, y + 0.5, z + 0.5),
    dispense: {
      rng: () => dispRand,
      spawnItem: (stack, x, y, z, mx, my, mz) => { if (ents) ents.items.spawn(stack, x, y, z, { motion: [mx, my, mz] }); },
      cart: (type, x, y, z) => { if (!ents) return; if (type === 0) ents.minecarts.spawnEmpty({ x, y, z }); else ents.minecarts.spawnCart(type, { x, y, z, items: [] }); },
      spawnTnt: (x, y, z) => ents?.prime(x + 0.5, y + 0.5, z + 0.5),
      setLiquid: (x, y, z, id) => { const old = world.get(x, y, z); world.set(x, y, z, id === 10 ? LAVA : WATER, true, 0); rt.fluidChanges([[x, y, z, old, world.get(x, y, z)]]); },
      setAir: (x, y, z) => { const old = world.get(x, y, z); world.set(x, y, z, 0, true, 0); rt.fluidChanges([[x, y, z, old, 0]]); },
      setFire: (x, y, z) => { fire.ignite(x, y, z); },
      breakBlock: (x, y, z) => { const b = world.get(x, y, z); if (b) fluids.wash(x, y, z, b); },
      boneMeal: () => false,
      arrow: () => { unsupported.hit = true; }, thrown: () => { unsupported.hit = true; }, fireball: () => { unsupported.hit = true; }, firework: () => { unsupported.hit = true; },
    },
  } });
  rt.restore({ redstone: plan.redstone, pistons: plan.pistons });
  const live = rt.redstone;
  // Dispensers and droppers fire through the entity systems above (items, TNT, carts, buckets, flint and steel). A dispense that
  // needs a projectile system the run does not have (arrows, eggs, snowballs, potions, fire charges, fireworks) leaves the
  // stack where it was. Command blocks need the command interpreter and are skipped (dimensions.md "Batch 31").
  for (const id of [23, 158]) {
    const b = live.behaviours[id];
    if (!b) continue;
    live.behaviours[id] = { ...b, updateTick(w, x, y, z) {
      const k = `${x},${y},${z}`, before = structuredClone(tiles.dispensers[k]);
      unsupported.hit = false;
      try { b.updateTick(w, x, y, z); } catch { unsupported.hit = true; }
      if (unsupported.hit) { if (before) tiles.dispensers[k] = before; else delete tiles.dispensers[k]; }
    } };
  }
  if (live.behaviours[137]) live.behaviours[137] = { ...live.behaviours[137], updateTick() {} };
  const hoppers = new Hoppers({
    world, chests: () => tiles.chests, furnaces: () => tiles.furnaces, dispensers: () => tiles.dispensers, hoppers: () => tiles.hoppers, brewing: () => tiles.brewing,
    maxStack: (s) => maxStackOf(s.id ?? s), burnTime, items: () => ents?.items.items ?? [], active: ticking, changed: (keys) => rt.containerClosed(keys),
  });
  sv.furnaces = tiles.furnaces; // the run mutates the plan's own maps
  sv.furnaceActive = (k) => { const [x, , z] = k.split(",").map(Number); return ticking(x, z); };
  sv.furnaceChanged = (k) => rt.containerClosed([k]);
  const brewing = () => {
    for (const [k, data] of Object.entries(tiles.brewing)) {
      const [x, y, z] = k.split(",").map(Number);
      if (!ticking(x, z)) continue;
      if (world.get(x, y, z) !== BREWING_STAND) { delete tiles.brewing[k]; continue; }
      const view = brewingView(data), before = data.brewTime | 0, bits = view.tick();
      if (bits !== null || world.getMeta(x, y, z) !== view.bottleBits()) world.set(x, y, z, BREWING_STAND, true, view.bottleBits());
      if (bits !== null || (before > 0 && !(data.brewTime | 0))) rt.containerClosed([k]);
    }
  };

  ents = awayEntities(plan, { world, ticking, rt, fire, weather, tiles, readStack: (st) => sv.inventory.read(st, true), maxStack: (st) => sv.inventory.maxStack(st) });
  if (ents) ents.falling = falling;
  const idle = () => !fluids.pending.size && !fire.queue.heap.length && !falling.pending.size && !live.tree.length && !live.thisTick.length
    && !live.deferred.length && !(live.torchToggles?.length) && !live.blockEvents.some((l) => l.length) && !live.pistonTiles().length;
  let ran = 0, stopped = "done";
  for (; ran < plan.ticks; ran++) {
    const entities = ran < AWAY_ENTITY_TICKS;
    if (!entities) ents?.close(); // spills after the gate are saved records, not entities that would tick
    if (!entities && idle()) { stopped = "idle"; ran = plan.ticks; break; }
    if ((ran & 31) === 31 && now() - loopStart > budgetMs) { stopped = "budget"; break; }
    // World.tick order: scheduled updates, then updateEntities (tile entities) while the gate is open.
    rt.fluidChanges(fluids.tick());
    fire.tick();
    if (entities) falling.tick();
    else { const kept = falling.entities; falling.entities = []; falling.tick(); falling.entities = [...kept, ...falling.entities]; } // frozen entities
    live.clock++; live.time++;
    live.tickUpdates(); live.sendQueuedBlockEvents();
    if (entities && ents) ents.tick();
    if (entities) { live.updateTileEntities(); rt.pistons.tick(); hoppers.tick(); brewing(); sv.tickFurnaces(); }
  }
  rt.flush();
  const entityLists = ents?.finish() ?? null;
  return {
    entities: entityLists,
    columns: world.takeDirtyColumns(), fluidTicks: fluids.save(), fireTicks: fire.save(), fallingTicks: falling.save(), falling: falling.serialize(),
    editSequence: world.nextEditOrder, redstone: rt.save(), pistons: rt.pistons.save(), tiles: Object.fromEntries(Object.entries(tiles).map(([k, v]) => [k, v])), drops: entityLists ? [] : drops,
    stats: { requested: plan.ticks, ran, stopped, columns: plan.columns.length, ms: Math.round(now() - started), setupMs, ...(entityLists ? { entities: entityLists.counts } : {}) },
  };
}
