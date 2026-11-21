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
import { replaceableCell } from "./sp-dispense76.js";
import { World, WorldChunk } from "./world.js";
import { Fluids } from "./fluids.js";
import { Fire } from "./fire.js";
import { FallingBlocks } from "./falling.js";
import { createRedstoneRuntime } from "./redstone-runtime.js";
import { DAYLIGHT_SENSOR } from "./redstone.js"; // b87 tiles87 (the 1.7.10 id; LiveRedstone.watchIds maps the world's ids to it)
import { Hoppers } from "./hopper.js";
import { cartInventoryAt } from "./cart-inventory.js"; // b71 mpreach71
import { Survival, burnTime } from "./survival.js";
import { brewingView, BREWING_STAND, maxStackOf } from "./brewing.js";
import { Weather, canLightningStrikeAt, canSeeSky } from "./weather.js";
import { makeStack, validRawDamage } from "./inventory.js";
import { FLOWER_POT, restorePots, serializePots } from "./stone-utility.js"; // b86 awaystore86: world.pots in the run
import { washStacks, burnStacks } from "./fluid-wash.js"; // b82 pots82
import { awayEntities } from "./away-entities.js";
import { dispenseFirework } from "./fireworks-live.js";
import { spawnEggMob } from "./spawn-egg-use.js";
import { WATER, LAVA, ENCHANTING_TABLE } from "./world.js";
import { ENDER_CHEST } from "./chest-blocks.js";
import { Skulls, installSkullBreak } from "./skull.js"; // b85 pickup85
import { Signs, isSign } from "./signs.js"; // b86 awaystore86
import { Beacons, BEACON, tickBeacon } from "./pyramid.js"; // b86 awaystore86
import { MobSpawners } from "./mob-spawner.js"; // b87 tiles87
import { watchSpawnerBlocks } from "./spawner-block.js"; // b87 tiles87
import { celestialAngle } from "./clock.js";
import { sensorSky as skyAt } from "./daylight-sensor-time.js"; // b87 tiles87 / b88 tiles88: the daylight sensors' sky (World.skylightSubtracted and the angle)
import { installTileSwaps, swapChestRecord } from "./container-tiles.js"; // b89 tiles89
import { watchSupportLoss } from "./multiplayer/server-support-loss.js"; // b86 awaystore86: BlockSign / BlockBush / ladder / carpet onNeighborBlockChange
import { setGameRuleSource, ruleOn } from "./game-rules.js";
import { JavaRandom } from "./java-random.js";
import { awayCommands } from "./away-commands.js";
import { AwayBlockLight } from "./away-light.js";
import { attachTickTree } from "./tile-ticks.js";
import { AWAY_ENTITY_TICKS, SPAWN_RADIUS, MAX_AWAY_TICKS, MAX_COLUMNS, WALL_BUDGET_MS, inSpawnArea, spawnOf, stateColumns, awayPlan } from "./away-plan.js";

export { AWAY_ENTITY_TICKS, SPAWN_RADIUS, MAX_AWAY_TICKS, MAX_COLUMNS, WALL_BUDGET_MS, inSpawnArea, spawnOf, stateColumns, awayPlan };
const key = (cx, cz) => `${cx},${cz}`;
const EDGE = 8; // blocks: how near an entity may come to a natively loaded column the run holds no copy of (see entityTicks)

// Runs `plan.ticks` away ticks over `plan.chunks` (live column copies) and `plan.records` (the columns' stored edits, as readChunkColumns returns them).
// Resolves { columns, fluidTicks, fireTicks, fallingTicks, falling, redstone, pistons, tiles, drops, stats } or null when nothing ran.
export async function runAway(plan, options = {}) {
  // b86 awaystore86: every system the run drives reads the run's game rules (GameRules is per world and read on each call: doTileDrops in Block.dropBlockAsItem, doFireTick,
  // mobGriefing, doMobLoot), as /gamerule leaves them during the run; the worker has no other source. The body runs without an await, so nothing else reads the source meanwhile.
  const rules = { read: null }, was = setGameRuleSource((name) => (rules.read ? rules.read(name) : ruleOn({ gameRules: plan.gameRules }, name)));
  try { return runAwayTicks(plan, options, rules); } finally { setGameRuleSource(was); }
}
function runAwayTicks(plan, { now = () => performance.now(), budgetMs = WALL_BUDGET_MS, world: given = null, trace = null } = {}, rules) {
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
  // Batch 36 (public/research/dimensions.md "Batch 36"): the loaded set is the spawn area, and it only SHRINKS while the run lasts. ms.b (unloadChunksIfNotNearSpawn)
  // reads the world spawn when it is called: when the last watcher leaves a chunk and in WorldServer.saveAllChunks (mt.a), which MinecraftServer.tick runs every 900 ticks
  // (`tickCounter % 900 == 0`, bytecode-read). Nothing loads the chunks a moved spawn would newly cover, so after a /setworldspawn the next autosave unloads the chunks
  // outside the new area (the unload itself runs on the next tick) and the loaded set is the intersection of every spawn area it has been checked against.
  const areas = [plan.spawn], loadedChunk = (cx, cz) => areas.every((s) => inSpawnArea(s, cx, cz));
  const ticking = (x, z) => { const cx = Math.floor(x) >> 4, cz = Math.floor(z) >> 4; return wanted.has(key(cx, cz)) && loadedChunk(cx, cz); }; // entities pass fractional coordinates
  // World.updateEntityWithOptionalForce (ahb.a(sa, true) with checkChunksExist(x-32, 0, z-32, x+32, 0, z+32), bytecode-read): an entity only updates when every
  // chunk within 32 blocks of it exists, so entities near the edge of the loaded area do not tick (tile entities only need their own chunk: `ticking`).
  const entityTicks = (x, z) => {
    const bx = Math.floor(x), bz = Math.floor(z);
    if (!wanted.has(key(bx >> 4, bz >> 4))) return false;
    // Batch 45: a column inside the loaded area that the run did not copy is loaded natively (spawn chunks, the 128-block rule above) but the worker has no terrain for it, so
    // an entity walking into it would meet air. The port holds an entity that comes within EDGE blocks of such a column, as it holds one outside the copied set (the real rule
    // is 32 blocks from an unloaded chunk; the copied halo is one chunk, so the hold is nearer). Columns the area does not load are covered by the 32-block loop below.
    for (let cx = (bx - EDGE) >> 4; cx <= (bx + EDGE) >> 4; cx++) for (let cz = (bz - EDGE) >> 4; cz <= (bz + EDGE) >> 4; cz++) if (!wanted.has(key(cx, cz)) && loadedChunk(cx, cz)) return false;
    if (areas.every((s) => Math.abs(bx - s[0]) <= 80 && Math.abs(bz - s[2]) <= 80)) return true; // 32 blocks further still lie inside every loaded area: skip the chunk loop
    for (let cx = (bx - 32) >> 4; cx <= (bx + 32) >> 4; cx++) for (let cz = (bz - 32) >> 4; cz <= (bz + 32) >> 4; cz++) if (!loadedChunk(cx, cz)) return false;
    return true;
  };
  const spawn = plan.spawn;
  world.isTicking = ticking;
  const put = world.put.bind(world);
  const litFurnaces = () => Object.entries(plan.tiles.furnaces).filter(([, f]) => f.burn > 0).map(([k]) => k);
  const light = new AwayBlockLight(world, plan.chunks.map((c) => ({ x: c.x, z: c.z })), litFurnaces);
  world.put = (x, y, z, b, meta = 0) => {
    if (!ticking(x, z)) return false;
    const old = world.get(x, y, z), ok = put(x, y, z, b, meta, true);
    if (ok) light.touch(old, b);
    return ok;
  };

  const drops = [], tiles = plan.tiles, spill = (stack, x, y, z) => {
    const made = makeStack(stack.id, stack.count, stack.damage || 0, stack.tags, validRawDamage(stack.rawDamage) ? { rawDamage: stack.rawDamage } : undefined); // b85 pickup85: a skull keeps its SkullOwner tags; b83 plants83: a rawDamage plant keeps it (as main.js)
    if (ents) ents.spill(made, x, y, z); else drops.push({ stack: made, x, y, z, age: 0, delay: 10 });
  };
  let ents = null;
  // Block.dropBlockAsItem (aji.a(ahb,III,add), bytecode-read): nothing on a world whose doTileDrops is false (no random draws either), else one entity per item at
  // x/y/z + (rand * 0.7F + 0.15F) each, through the run's item random (main.js items.dropBlock).
  const tileDrops = () => (rules.read ? rules.read("doTileDrops") : ruleOn({ gameRules: plan.gameRules }, "doTileDrops"));
  const dropBlock = (stacks, x, y, z) => {
    if (!tileDrops()) return;
    const r = ents?.items?.random ?? Math.random, f = Math.fround, off = () => f(f(r() * 0.7) + f(0.15));
    for (const s of stacks) for (let n = 0; n < (s?.count ?? 0); n++) spill({ ...s, count: 1, ...(s.tags ? { tags: s.tags } : {}) }, x + off(), y + off(), z + off());
  };
  const rand = Number(BigInt.asUintN(32, BigInt(plan.editSequence | 0) * 2654435761n + BigInt(plan.ticks)));
  const fluids = new Fluids(world, {
    seed: rand,
    // b86 awaystore86: as main.js's Fluids hook: Block.dropBlockAsItem of what the block drops (fluid-wash.js: string for a cobweb, a crop's seeds, a pot and its plant), under
    // doTileDrops at the 0.7 spread. It spilled the washed block's own id at +0.5 / +0.25 before, with no gamerule.
    wash: (x, y, z, b) => { const d = washStacks(world, x, y, z, b); if (d.length) dropBlock(d, x, y, z); },
    burn: (x, y, z, b) => { const d = burnStacks(world, x, y, z, b); if (d.length) dropBlock(d, x, y, z); },
  });
  // World.func_147480_a(x, y, z, true) for /setblock destroy and a dispensed bucket's replaced block: the port still drops the block's own item at +0.5 / +0.25 (a pot: the pot
  // and its plant) as before batch 86, not its harvest drops (the dedicated server runs breakPlayerBlock); now under doTileDrops.
  const destroyBlock = (x, y, z) => {
    const b = world.get(x, y, z);
    if (!b || !tileDrops()) return;
    if (b === FLOWER_POT) for (const s of washStacks(world, x, y, z, b)) spill(s, x + 0.5, y + 0.25, z + 0.5); else spill({ id: b, count: 1, damage: 0 }, x + 0.5, y + 0.25, z + 0.5);
  };
  // b87 tiles87: BlockChest / BlockFurnace / BlockDispenser / BlockHopper / BlockBrewingStand.breakBlock under /setblock (command-host.js env.spillTile): each stack from a random
  // point 0.1-0.9 inside the cell in pieces of 10-30 (ItemEntities.spill, the run's item random and motion). No doTileDrops test: the spill spawns EntityItems directly.
  // Without the entity run the pieces are saved records at the same offsets (no motion).
  const spillTile = (stacks, x, y, z) => {
    if (ents?.items) { ents.items.spill(stacks.map((st) => ({ ...st, ...(st.tags ? { tags: structuredClone(st.tags) } : {}) })), x, y, z); return; }
    const r = Math.random, f = Math.fround;
    for (const st of stacks) {
      if (!st?.count) continue;
      const ox = f(f(r() * 0.8) + 0.1), oy = f(f(r() * 0.8) + 0.1), oz = f(f(r() * 0.8) + 0.1);
      for (let left = st.count; left > 0;) { const n = Math.min(left, Math.floor(r() * 21) + 10); left -= n; drops.push({ stack: { ...st, count: n }, x: x + ox, y: y + oy, z: z + oz, age: 0, delay: 0 }); }
    }
  };
  const weather = new Weather().restore(plan.weather);
  const fire = new Fire(world, { weather: () => weather, stillLava: (x, y, z) => !fluids.pending.has(fluids.key(x, y, z, 11)) });
  fire.watch(); fire.sharedRandomTicks = true;
  const falling = new FallingBlocks(world, { drop: (stack, x, y, z) => spill(stack, x, y, z), rain: (x, y, z) => canLightningStrikeAt(weather, world, x, y, z) /* b84 rain84: no sound here */ }, plan.falling ?? []);
  falling.watch();
  if (plan.fluidTicks) fluids.load(plan.fluidTicks);
  if (plan.fireTicks) fire.load(plan.fireTicks);
  if (plan.fallingTicks) falling.load(plan.fallingTicks);
  // b85 pickup85: the away world's skull tiles (from the saved chunk tile entities). World.setBlock -> BlockSkull.breakBlock drops the tile's item (installSkullBreak) at the native
  // 0.7 spread through the run's item random; a piston's crush reads the same store (game.skulls below), so it drops its own type instead of 0.
  const skullTiles = Skulls.fromJSON(plan.skulls);
  // b86 awaystore86: BlockSkull.breakBlock drops through Block.dropBlockAsItem (anl.a(ahb,III,aji,I) -> aji.a(ahb,III,add), bytecode-read), so doTileDrops gates it as in
  // main.js (items.dropBlock); the tile leaves the store either way.
  installSkullBreak(world, () => skullTiles, dropBlock);
  // b86 awaystore86: sign, beacon and flower pot tiles. BlockSign (ank) and BlockBeacon (ajg) are BlockContainers (ajc) without their own breakBlock: ajc.a(ahb,III,aji,I) is
  // super.breakBlock then World.removeTileEntity (bytecode-read), and Chunk.func_150807_a (apx.a(III,aji,I)) runs the old block's breakBlock on the server for any change of the
  // block OR its metadata, then makes a fresh tile (akw.a(ahb,I)) when the new block is a container and has none. So a sign or beacon replaced, blown up or popped loses its tile
  // and drops nothing from it (a sign's or beacon's own item comes from dropBlockAsItem, which explosions and the sign's support check call); a new sign starts empty, a new beacon
  // at Levels -1 (pyramid.js createBeacon).
  const signTiles = Signs.fromJSON(plan.signs), beaconTiles = new Beacons().fromJSON(plan.beacons);
  for (const [k, v] of world.edits) if ((v & 255) === BEACON) beaconTiles.ensure(...k.split(",").map(Number)); // as main.js's load: a beacon block always has its tile
  restorePots(world, plan.pots); // world.pots (stone-utility.js): World.put drops a replaced pot's record; washStacks / potBreakDrop read it
  { const next = world.onChange; world.onChange = (x, y, z, old, now) => {
    next?.(x, y, z, old, now);
    if (isSign(old)) signTiles.remove(x, y, z);
    if (isSign(now)) signTiles.create(x, y, z);
    if (old === BEACON) beaconTiles.remove(x, y, z);
    if (now === BEACON) beaconTiles.ensure(x, y, z);
    if (old !== now && old === ENCHANTING_TABLE && tiles.tableNames) delete tiles.tableNames[`${x},${y},${z}`]; // TileEntityEnchantmentTable's CustomName goes with it (main.js)
    if (old !== now && old === ENDER_CHEST && tiles.enderTiles) delete tiles.enderTiles[`${x},${y},${z}`];
  }; }
  // b89 tiles89: a chest <-> trapped chest swap by any edit spills the slots and starts the new block's tile (container-tiles.js swapTiles, as both live hosts);
  // the meta-only sign rewrite is the onChange line above (remove, then create, on any change of the block or its metadata).
  installTileSwaps(world, { signs: null, containers: { swapChest: (x, y, z) => swapChestRecord(world, (tiles.chests ??= {}), x, y, z, (stacks) => spillTile(stacks, x, y, z)) } });
  // b87 tiles87: the saved spawner tiles (root.spawners, only when the world has the list: structure-simulation.js reads a missing list as a fresh world). A spawner does nothing
  // here (MobSpawnerBaseLogic.updateSpawner needs a player within range, agq.f), but a spawner replaced in the run loses its tile (BlockContainer.breakBlock, World.removeTileEntity;
  // spawner-block.js, as main.js) and a /setblock spawner gets one (command-host.js env.spawners). The list comes back whole, in the live game's own save form (MobSpawners.toJSON).
  const spawnerTiles = Array.isArray(plan.spawners) ? MobSpawners.fromJSON(plan.spawners) : null;
  if (spawnerTiles) watchSpawnerBlocks(world, spawnerTiles);
  // BlockSign.onNeighborBlockChange (and the other support checks single player runs from main.js watchFlowers): the neighbour update of a setBlock runs with no player test.
  // The popped block's item goes through dropBlockAsItem, so doTileDrops applies; a refused write (a column outside the loaded area) drops nothing.
  watchSupportLoss(world, (stacks, x, y, z) => { if (ticking(x, z) && world.get(x, y, z) === 0) dropBlock(stacks, x, y, z); });
  // TileEntityBeacon.updateEntity (aoq.h, bytecode-read): the pyramid check (y) and the effects (x) when World.getTotalWorldTime() % 80 == 0. It runs in World.updateEntities, so only
  // while the gate is open and only for a tile in a loaded chunk; the effects go to the world's players, and the Overworld has none, so only Levels changes. Tick n of the run sees
  // the total time end - (ticks - n - 1) (WorldServer.tick adds 1 before the world ticks, as the command blocks' clock in away-commands.js).
  const totalAt = (n) => (Number.isSafeInteger(plan.totalTime) ? plan.totalTime : (plan.time ?? 0) + (cmds?.state.timeShift ?? 0)) - (plan.ticks - n - 1);
  const beaconTick = (n) => {
    const time = totalAt(n);
    if (!beaconTiles.tiles.size || time % 80 !== 0) return;
    const get = (x, y, z) => world.get(x, y, z), sky = (x, y, z) => canSeeSky(world, x, y, z);
    for (const [k, tile] of [...beaconTiles.tiles]) {
      if (!ticking(tile.x, tile.z)) continue;
      if (get(tile.x, tile.y, tile.z) !== BEACON) { beaconTiles.tiles.delete(k); continue; }
      tickBeacon(tile, { time, get, canSeeSky: sky, players: [] });
    }
  };
  // b87 tiles87: TileEntityDaylightDetector.updateEntity (apa.h, bytecode-read): when getTotalWorldTime() % 20 == 0, BlockDaylightDetector.func_149957_e (akg.e): the saved sky
  // light at the sensor (ahb.b(EnumSkyBlock.Sky)) less World.skylightSubtracted, and getCelestialAngleRadians(1.0F). The run never called LiveRedstone.endTick (the live loop's
  // sensor refresh), so a sensor kept the meta it left with. It is a tile entity: only while the gate is open, only in a ticking column. WorldServer.tick (mt.b) sets
  // skylightSubtracted from the world time before it adds 1 (then tickUpdates, then updateEntities), so the darkening reads the time one tick behind the angle's.
  // The world time at tick n is away-commands.js's clock (the saved time is the end of the trip); doDaylightCycle false holds it.
  const sensorSky = { angle: 0, subtracted: 0 };
  const cycling = () => (rules.read ? rules.read("doDaylightCycle") : ruleOn({ gameRules: plan.gameRules }, "doDaylightCycle"));
  const sensorTick = (n) => {
    if (totalAt(n) % 20 !== 0) return;
    let sensors = null;
    for (const p of live.watched.values()) if (p.orig === DAYLIGHT_SENSOR && ticking(p.x, p.z) && live.watchIds.get(world.get(p.x, p.y, p.z)) === DAYLIGHT_SENSOR) (sensors ??= []).push(p);
    if (!sensors) return;
    // b93 tiles93: the angle is read now (the world time after this tick's increment and any /time shift of the tick), the darkness is the one computed from the pre-step time
    // at the start of the tick (cmds.state.pre; a /time shift or /gamerule in the tick does not move it). Same two inputs as daylight-sensor-time.js sensorSky.
    const { step, pre } = cmds.state;
    Object.assign(sensorSky, { ...skyAt(pre + step, step === 1, weather.rainStrength(1), weather.weightedThunder(1)), angle: celestialAngle(cmds.now(), 1) }); // b88 tiles88: the shared helper (daylight-sensor-time.js, executed against Tiles88Probe), the tick's pre-step time
    for (const p of sensors) live.refreshSensor(p.x, p.y, p.z);
  };
  const sv = new Survival({}, "survival");
  const unsupported = { hit: false }; // a dispense the run cannot make (arrow, potion, fireball, firework): the stack is put back
  const dispRand = new JavaRandom(BigInt(rand) * 40503n + 7n);
  const rt = createRedstoneRuntime({ world, scene: null, game: {
    chests: () => tiles.chests, furnaces: () => tiles.furnaces, dispensers: () => tiles.dispensers, hoppers: () => tiles.hoppers, brewing: () => tiles.brewing, maxStack: (s) => maxStackOf(s.id ?? s),
    skulls: () => skullTiles, drop: (x, y, z, d) => spill(d, x, y, z), // b84 drops84: LiveRedstone's drop hook gets the EntityItem position (native offset included); the old +0.5 added a second offset
    sound() {}, markUnsaved() {}, player: () => null, mobs: () => null, commandHost: () => cmds.host, // b86 awaystore86: b84's comment above had swallowed these hooks
    subtracted: () => sensorSky.subtracted, angle: () => sensorSky.angle, skyLight: (x, y, z) => light.skyAt(x, y, z) ?? 15, // b87 tiles87: the daylight sensors (sensorTick below)
    transfer: () => hoppers.host, // b72 smallfixes72: droppers push into containers through the run's hopper host (main.js game.transfer; built below, read only while ticking)
    items: () => ents?.items.items ?? [], itemSystem: () => ents?.items, arrows: () => ents?.arrows.list ?? [], thrown: () => (ents ? [...ents.projectiles.balls, ...ents.mobs.potions.balls] : []), orbs: () => ents?.xp.orbs ?? [], orbSystem: () => ents?.xp, primed: () => ents?.primed ?? [],
    minecarts: () => ents?.minecarts, boats: () => ents?.boats.carts ?? [], boatSystem: () => ents?.boats, falling: () => falling.entities,
    primeTnt: (x, y, z) => ents?.prime(x + 0.5, y + 0.5, z + 0.5),
    dispense: {
      rng: () => (ents ? ents.arrows.rng() : dispRand),
      spawnItem: (stack, x, y, z, mx, my, mz) => { if (ents) ents.items.spawn(stack, x, y, z, { motion: [mx, my, mz] }); },
      cart: (type, x, y, z) => { if (!ents) return; if (type === 0) ents.minecarts.spawnEmpty({ x, y, z }); else ents.minecarts.spawnCart(type, { x, y, z, items: [] }); },
      spawnTnt: (x, y, z) => ents?.prime(x + 0.5, y + 0.5, z + 0.5),
      setLiquid: (x, y, z, id) => { const old = world.get(x, y, z); world.set(x, y, z, id === 10 ? LAVA : WATER, true, 0); rt.fluidChanges([[x, y, z, old, world.get(x, y, z)]]); },
      setAir: (x, y, z) => { const old = world.get(x, y, z); world.set(x, y, z, 0, true, 0); rt.fluidChanges([[x, y, z, old, 0]]); },
      setFire: (x, y, z) => { fire.ignite(x, y, z); },
      breakBlock: destroyBlock,
      boneMeal: () => false,
      boat: (x, y, z) => { if (ents) ents.boats.spawnBoat({ x, y, z }, { born: true }); else unsupported.hit = true; }, // BehaviorDispenseBoat (b76: the away run threw the boat as an item)
      isReplaceable: (id, w, x, y, z) => replaceableCell(world, x, y, z), nether: () => !!world.isHell, fizz() {}, // b76: tryPlaceContainedLiquid (sp-dispense76.js); the Nether's water only fizzes. b77: silent by design like every away sound (`sound() {}` above): World.playSoundEffect sends S29 to the world's own players and the only player is in another dimension; the event itself is the live path's `netherFizz`
      // Projectile dispenses create the live entities (as main.js does) when the entity run exists; without it the stack is put back.
      arrow: (e) => { if (ents) { const a = ents.arrows.make(e, e.rand, { shooter: null, pickup: 1 }); ents.arrows.list.push(a); ents.arrows.joined(a); } else unsupported.hit = true; },
      thrown: (kind, e) => {
        if (!ents) { unsupported.hit = true; return; }
        const ball = { x: e.x, y: e.y, z: e.z, mx: e.mx, my: e.my, mz: e.mz, yaw: e.yaw, pitch: e.pitch, kind, px: e.x, py: e.y, pz: e.z, prevYaw: e.yaw, prevPitch: e.pitch, ticks: 0, rand: e.rand, random: e.rand, dead: false, dispensed: true }; // b90 credit90: no thrower (as main.js, b89): causeThrownDamage(ball, null)
        if (kind === "potion" || kind === "expBottle") { const b = { ...ball, damage: e.damage ?? 0, ...(Array.isArray(e.custom) ? { custom: e.custom.map((x) => ({ ...x })) } : {}), owner: null }; ents.mobs.potions.projectiles.balls.push(b); ents.mobs.joined(b, "potion"); } // as main.js: potions and bottles walk as "potion"
        else { ents.projectiles.balls.push(ball); ents.projectiles.joined(ball); }
      },
      spawnEgg: (stack, at, roll) => { if (ents) spawnEggMob({ mobs: ents.mobs }, stack.damage, at, stack.displayName, roll); else unsupported.hit = true; }, // BehaviorDispenseSpawnEgg
      fireball: ({ x, y, z, ax, ay, az }) => { if (ents) ents.mobs.fireballs.launch({ large: false, owner: null, x, y, z, exact: [ax, ay, az] }); else unsupported.hit = true; },
      firework: (stack, x, y, z, fx, fz) => { if (ents) dispenseFirework(ents.rockets, x, y, z, fx, fz, stack); else unsupported.hit = true; },
    },
  } });
  rt.restore({ redstone: plan.redstone, pistons: plan.pistons, commandBlocks: plan.commandBlocks, musicTiles: plan.musicTiles }); // b86 awaystore86: musicTiles (note pitch / powered, jukebox record)
  const cmds = awayCommands({ plan, world, rt, weather, tiles, entities: () => ents, loadedChunk, wanted: (cx, cz) => wanted.has(key(cx, cz)), breakBlock: destroyBlock,
    stores: { signs: () => signTiles, skulls: () => skullTiles, beaconTile: (x, y, z) => beaconTiles.ensure(x, y, z), // b86 awaystore86: /setblock's tiles land in the run's stores
      spawners: () => spawnerTiles, spillTile }, // b87 tiles87: a /setblock spawner's tile; a replaced container's slots spill (command-host.js)
    // b83 plants83: /setblock's replaced pot drops its plant (command-host.js env.dropStacks) as ItemEntities.dropBlock does in single player: one entity per
    // item at x/y/z + (rand * 0.7 + 0.15) each, through the run's item random when the entity run is on.
    dropStacks: dropBlock }); // b86 awaystore86: under doTileDrops, as main.js's items.dropBlock
  rules.read = cmds.rule;
  const live = rt.redstone;
  // Dispensers and droppers fire through the entity systems above (items, TNT, carts, buckets, flint and steel). A dispense that
  // needs a projectile system the run does not have (only without the entity run) leaves the stack where it was. Command blocks run through away-commands.js.
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
  cmds.installBlock(live); // BlockCommandBlock.updateTick: a scheduled tick, no player test
  const hoppers = new Hoppers({
    world, chests: () => tiles.chests, furnaces: () => tiles.furnaces, dispensers: () => tiles.dispensers, hoppers: () => tiles.hoppers, brewing: () => tiles.brewing,
    maxStack: (s) => maxStackOf(s.id ?? s), burnTime, items: () => ents?.items.items ?? [], active: ticking, changed: (keys) => rt.containerClosed(keys),
    cartAt: (x, y, z) => cartInventoryAt(ents?.minecarts?.carts, x, y, z), // b71 mpreach71: block hoppers find chest and hopper carts
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

  ents = awayEntities(plan, { world, ticking, entityTicks, rt, fire, weather, tiles, transfer: hoppers.host, readStack: (st) => sv.inventory.read(st, true), light, cycling, runCommand: cmds.cartRun, maxStack: (st) => sv.inventory.maxStack(st) });
  if (ents) { ents.attachFalling(falling, plan.falling ?? []); falling.joined = (e) => ents.mobs.joined(e, "falling"); } // falling blocks tick in the one entity walk (away-entities.js)
  // (an entry held back in an unloaded column does nothing for the rest of the run, so it does not keep the run going)
  const work = (list) => { for (const e of list) if (ticking(e.x, e.z)) return true; return false; };
  const idle = () => !work(fluids.pending.values()) && !work(fire.queue.heap) && !work(falling.pending.values()) && !work(live.tree) && !live.thisTick.length
    && !live.deferred.length && !(live.torchToggles?.length) && !live.blockEvents.some((l) => l.length) && !live.pistonTiles().length;
  // The same tick tree the live game runs (tile-ticks.js attachTickTree, public/research/region-import.md Batch 33): fluids, fire, falling blocks and redstone
  // take their due entries together in (time, priority, creation) order under one 1000 cap. `trace(kind, entry)` sees each entry as it runs (tests).
  const tree = attachTickTree({ fluids, fire, falling, redstone: rt });
  // Batch 36: redstone hears each fluid write at once (World.setBlock notifies neighbours), as main.js does through fluids.writers; the renderer-side flush follows the run.
  fluids.writers.push((x, y, z, old, now) => rt.fluidChanges([[x, y, z, old, now]], true));
  if (trace) for (const src of tree.sources) { const run = src.run; src.run = (e) => { trace(src.name, e); return run(e); }; }
  // Batch 37: a scheduled tick in a column that is not loaded (never was, or the autosave unloaded it) is not run against refused writes. Natively the chunk's save
  // (AnvilChunkLoader, TileTicks with t = scheduledTime - worldTime) keeps it and a later load re-queues it with the same remaining delay. Fluids, fire and falling blocks
  // already hold such entries back (their pauseUnloadedTicks / beginTick put the time back each tick); the redstone list does the same here, so the entry is saved with
  // the delay it had when its column left the loaded set.
  const compare = (a, b) => a.time - b.time || a.priority - b.priority || a.serial - b.serial;
  const freezeUnloadedRedstone = () => {
    let moved = 0;
    for (const e of live.tree) if (!ticking(e.x, e.z)) { e.time++; moved++; }
    if (moved) { live.tree.sort(compare); cmds.stats.heldTicks = (cmds.stats.heldTicks ?? 0) + moved; }
  };
  let ran = 0, stopped = "done";
  for (; ran < plan.ticks; ran++) {
    const entities = ran < AWAY_ENTITY_TICKS;
    if (!entities) ents?.close(); // spills after the gate are saved records, not entities that would tick
    if (!entities && idle()) { stopped = "idle"; ran = plan.ticks; break; }
    if ((ran & 31) === 31 && now() - loopStart > budgetMs) { stopped = "budget"; break; }
    // World.tick order: WorldServer.tickUpdates (fluid, fire, falling and redstone entries from the one shared tree under one 1000 cap, then fire's
    // random ticks), then the block events and updateEntities (tile entities) while the gate is open.
    cmds.beginTick(ran); // b93 tiles93: the world time, the increment and the darkness of this tick, read before tickUpdates
    ents?.beginTick();
    if (ran % 10 === 0) light.refresh(ran);
    freezeUnloadedRedstone();
    tree.tick({ x: 0, z: 0 }, { fluids: () => rt.flush() });
    live.sendQueuedBlockEvents();
    if (entities) { if (ents) falling.tick({ entities: false }); else falling.tick(); }
    else { const kept = falling.entities; falling.entities = []; falling.tick(); falling.entities = [...kept, ...falling.entities]; } // frozen entities
    if (entities && ents) ents.tick();
    if (entities) { live.updateTileEntities(); rt.pistons.tick(); hoppers.tick(); brewing(); beaconTick(ran); sensorTick(ran); sv.tickFurnaces(); }
    // MinecraftServer.tick: after the worlds tick, `tickCounter % 900 == 0` saves them, and the save queues every unwatched chunk outside the CURRENT spawn area (see above).
    cmds.endTick(); ents?.endTick();
    if (((plan.tickBase | 0) + ran + 1) % 900 === 0) { const now = cmds.spawn(); if (now[0] !== areas[areas.length - 1][0] || now[2] !== areas[areas.length - 1][2]) { areas.push([...now]); cmds.stats.areaMoves = (cmds.stats.areaMoves ?? 0) + 1; } }
  }
  if (stopped === "budget") cmds.skipTicks(plan.ticks - ran); // b94 tiles94
  rt.flush();
  const entityLists = ents?.finish() ?? null;
  return {
    entities: entityLists,
    columns: world.takeDirtyColumns(), fluidTicks: fluids.save(), fireTicks: fire.save(), fallingTicks: falling.save(), falling: entityLists?.falling ?? falling.serialize(), // b58so: the stamped records when the entity run held them
    editSequence: world.nextEditOrder, skulls: skullTiles.toJSON(), signs: signTiles.toJSON(), beacons: beaconTiles.toJSON(), pots: serializePots(world), musicTiles: rt.music.save() /* b86 awaystore86 */, ...(spawnerTiles ? { spawners: spawnerTiles.toJSON() } : {}) /* b87 tiles87 */, redstone: rt.save(), pistons: rt.pistons.save(), tiles: Object.fromEntries(Object.entries(tiles).map(([k, v]) => [k, v])), drops: entityLists ? [] : drops,
    ...cmds.result(),
    stats: { requested: plan.ticks, ran, stopped, columns: plan.columns.length, ms: Math.round(now() - started), setupMs, ...(entityLists ? { entities: entityLists.counts } : {}), commands: cmds.stats, light: { emitters: light.emitters, floods: light.floods, floodMs: Math.round(light.floodMs) } },
  };
}
