// Batch 62 mpnether2: the dedicated server's Nether as a living world (the systems behind server-dimensions.js).
//
// Batch 61 gave the Nether terrain, portals and the world swap (`within` / `swap`). This module builds the rest of what DedicatedSimulation.tick runs for the Overworld, as a second
// set of the same classes over the Nether world, and ticks it inside `swap` (the context carries them as `sim.fluids`, `sim.fire`, ... so the existing code paths, which read `sim.*`,
// reach the Nether's copy while a Nether player acts or while the Nether ticks):
//   * Fluids with `nether: true, skyless: true` (BlockDynamicLiquid on WorldProvider.isHellWorld: lava level step 1, so it flows farther, and tick rate 10: fluids.js, executed in
//     dimension-ticks-reference.json), Fire (netherrack burns forever, fire.js), FallingBlocks, Farming, Trees, Plants, LiveRedstone, LightVolume (no sky), random ticks
//     (Weather.tickDimension: the Nether has no weather, WorldServer's chunk loop runs unchanged), beacons, hoppers, dispensers, furnaces and brewing stands (ServerContainers and
//     ContainerTicks, one instance per dimension), and the Nether's own dispensed entities (ServerDispense, `dim` -1).
//   * Mobs: a second ServerMobs over the Nether's EntityWorld (world.dimension -1: the zombie pigman, ghast and magma cube list, and the fortress list in a fortress's bounds, from
//     the same generator's bridge). Its views are the Nether players only; it has its own SharedMobTracker, so a mob is tracked only to players of its dimension.
//   * Persistence: the Nether's items, containers, beacons, spawners, scheduled ticks, crops, redstone and mobs are saved with the world (`saveField`).
// Fortress chests and the blaze spawner of the throne room come from the generator's population records (DimensionWorld.netherChunk keeps them per chunk).
// Not here: experience orbs (a mob kill or smelting in the Nether drops none), vehicles, the spawner's own spawning tick (the Overworld server has none either), the End.
import { Fluids } from '../fluids.js';
import { Fire } from '../fire.js';
import { Farming } from '../farming.js';
import { FallingBlocks } from '../falling.js';
import { Trees } from '../trees.js';
import { Plants } from '../plants.js';
import { Weather } from '../weather.js';
import { LiveRedstone } from '../redstone-live.js';
import { LightVolume, lightEmission } from '../lighting.js';
import { tickWorldSystems } from '../world-tick.js';
import { tickBeacons } from '../pyramid-live.js';
import { Survival, ITEMS } from '../survival.js';
import { PlayerInventory, makeStack } from '../inventory.js';
import { LAVA, PHYSICS, MOB_SPAWNER } from '../world.js';
import { newChest } from '../chest.js';
import { isChestBlock } from '../chest-blocks.js';
import { Beacons } from '../pyramid.js';
import { MobSpawners } from '../mob-spawner.js';
import { Signs } from '../signs.js';
import { Skulls } from '../skull.js';
import { NETHER_BRICK } from '../nether-blocks.js';
import { fortressMonsterSpawnList } from '../fortress.js';
import { itemFromOriginal } from '../region-import.js';
import { ServerContainers } from './server-containers.js';
import { ContainerTicks } from './server-container-ticks.js';
import { ServerDispense } from './server-dispense.js';
import { ServerMobs } from './server-mobs.js';

const NETHER = -1, noop = () => {};
const reader = new PlayerInventory(ITEMS);
// The tile stores a Survival keeps for the world (and saves); the player fields of its serialize() are not part of a dimension.
const TILE_SAVE = ['furnaces', 'chests', 'dispensers', 'brewing', 'hoppers'];
// What `sim.<key>` is while the Nether runs (the existing systems read these through `sim`).
export const NETHER_CONTEXT = ['world', 'items', 'changes', 'farming', 'trees', 'containers', 'redstone', 'tileEntities', 'dirtyTiles', 'tiles', 'fluids', 'fire', 'falling', 'light', 'dispense', 'mobs'];

// DimensionWorld.netherChunk keeps the chests (with their loot) and spawners of each generated structure column; a fresh Nether takes them as tile entities.
export function applyPopulation(n, source) {
  const records = source.population?.records;
  if (!records) return;
  const w = n.world;
  for (const r of records.values()) {
    for (const t of r.chests ?? []) {
      if (!isChestBlock(w.get(t.x, t.y, t.z))) continue;
      const tile = newChest(t.facing);
      for (const s of t.items ?? []) { const m = itemFromOriginal(s.id, s.damage); if (m && s.slot >= 0 && s.slot < 27) tile.items[s.slot] = makeStack(m.id, s.count, m.damage, s.stored); }
      n.tiles.chests[`${t.x},${t.y},${t.z}`] = tile;
    }
    for (const t of r.spawners ?? []) if (w.get(t.x, t.y, t.z) === MOB_SPAWNER && !n.tileEntities.spawners.get(t.x, t.y, t.z)) n.tileEntities.spawners.add({ x: t.x, y: t.y, z: t.z, EntityId: t.entityId });
  }
}

// Builds every system of the Nether over `n.world` (n already holds world, items, changes, dirtyTiles, xp). `saved` is what saveField wrote.
export function buildNetherSystems(sim, n, source, saved = {}) {
  const w = n.world, drop = (...a) => sim.serverItems.stacksDrop(...a);
  n.weather = new Weather(); // no rain, snow or thunder here; it owns the random-tick stream (WorldServer.updateLCG of this dimension)
  n.tiles = new Survival(saved.tiles ?? {}, 'creative');
  const te = saved.tileEntities ?? {};
  n.tileEntities = { world: w, signs: Signs.fromJSON(saved.signs), skulls: Skulls.fromJSON(saved.skulls), beacons: new Beacons().fromJSON(te.beacons), spawners: MobSpawners.fromJSON(te.spawners), chests: n.tiles.chests, enders: n.tiles.enderTiles };
  w.fortressSpawns = (x, y, z) => fortressMonsterSpawnList(source.provider.bridge, (bx, by, bz) => (w.get(bx, by, bz) === NETHER_BRICK ? 112 : 0), x, y, z);
  n.redstone = new LiveRedstone(w, {
    entitiesIn: box => [...sim.players.values()].filter(p => p.dimension === NETHER && p.position.x + .3 > box[0] && p.position.x - .3 < box[3] && p.position.y + 1.8 > box[1] && p.position.y < box[4] && p.position.z + .3 > box[2] && p.position.z - .3 < box[5]).map(p => ({ ...p.position })),
    environment: () => ({ sky: 0, skylightSubtracted: 0, celestialAngle: 0, noSky: true }),
    skyLight: () => 0,
  });
  n.redstone.restore(saved.redstone);
  n.containers = new ServerContainers(sim); n.containers.dim = NETHER;
  n.light = new LightVolume(w, (x, y, z, b) => lightEmission(b, n.redstone.lit.has(`${x},${y},${z}`) || n.containers.litFurnaces.has(`${x},${y},${z}`)));
  w.blockLight = (x, y, z) => n.light.blockAt(x, y, z);
  w.fullLight = (x, y, z) => n.light.level(x, y, z, 0);
  n.fluids = new Fluids(w, { random: n.weather.random, nether: true, skyless: true });
  n.fluids.load(saved.fluidTicks);
  n.fire = new Fire(w, { weather: () => n.weather, stillLava: (x, y, z) => !n.fluids.pending.has(n.fluids.key(x, y, z, LAVA)) });
  n.fire.watch(); n.fire.sharedRandomTicks = true; n.fire.load(saved.fireTicks);
  n.trees = new Trees(w, { random: n.weather.random, apply: noop, drop, light: (x, y, z) => n.light.level(x, y, z, 0) }).watch();
  n.plants = new Plants(w, { drop, broken: noop, apply: noop }).watch();
  n.falling = new FallingBlocks(w, { drop: (...a) => sim.serverItems.fallingDrop(...a), apply: noop }, saved.falling).watch();
  n.falling.load(saved.fallingTicks);
  n.farming = new Farming(w, saved.farms);
  n.farming.lightLevel = (x, y, z) => n.light.level(x, y, z, 0);
  n.farming.rained = () => false;
  n.weather.blockTick = (x, y, z, b) => n.fire.randomTick(x, y, z, b) || n.trees.randomTick(x, y, z, b) || n.plants.randomTick(x, y, z, b);
}

// Systems that need `sim.*` to be the Nether while they are built (ContainerTicks registers on sim.redstone, hoppers and dispensers read sim.tiles), and the mobs.
export function buildNetherInside(sim, n, saved = {}) {
  n.dispense = sim.dispense = new ServerDispense(sim); n.dispense.dim = NETHER; // hooks THIS world's redstone (TNT primed by flint and steel)
  n.containers.ticks = new ContainerTicks(sim); n.containers.ticks.dim = NETHER; // registers the hopper / dispenser / trapped chest behaviours on THIS redstone
  // The mobs: a ServerMobs whose host is `sim` with the Nether's world, light, items, weather and sound tag (dimension -1) laid over it.
  const host = Object.create(sim, {
    world: { value: n.world }, light: { value: n.light }, items: { value: n.items }, weather: { value: n.weather }, darkness: { value: 0 },
    serverItems: { value: Object.create(sim.serverItems, { xp: { value: n.xp } }) },
    soundsOut: { value: { push: s => sim.soundsOut.push({ ...s, dim: NETHER }) } },
  });
  n.mobs = new ServerMobs(host, Array.isArray(saved.mobs) ? saved.mobs : [], { naturalSpawning: n.overMobs.spawning });
  n.mobs.mobs.ignite = (x, y, z) => n.fire.ignite(x, y, z); // a fireball sets fire where it lands
  sim.mobs = n.mobs;
  if (saved.items) n.items.load(saved.items, s => reader.read(s), 0);
}

// What the Nether adds to the save (read back through `saveField`).
export function saveNether(n) {
  const tiles = n.tiles.serialize(), picked = {};
  for (const key of TILE_SAVE) picked[key] = tiles[key];
  return {
    tiles: picked, signs: n.tileEntities.signs.toJSON(), skulls: n.tileEntities.skulls.toJSON(),
    tileEntities: { beacons: n.tileEntities.beacons.toJSON(), spawners: n.tileEntities.spawners.toJSON() },
    items: n.items.serialize(), fluidTicks: n.fluids.save(), fireTicks: n.fire.save(), falling: n.falling.serialize(), fallingTicks: n.falling.save(),
    farms: n.farming.serialize(), redstone: n.redstone.save(), mobs: n.mobs ? n.mobs.save() : [],
  };
}

// One game tick of the Nether, run with the context swapped in (`sim.*` is the Nether). `players` are the Nether's. Mirrors DedicatedSimulation.tick's order for the world systems.
export function tickNether(sim, n, players) {
  const w = n.world, beforeLit = new Set(n.redstone.lit);
  n.containers.tick();
  if (n.items.items.length) {
    n.items.tick(w);
    if (n.items.items.length > 300) n.items.items.splice(0, n.items.items.length - 300);
  }
  n.items.sounds.length = 0;
  n.mobs.mobs.difficulty = n.overMobs.mobs.difficulty;
  n.mobs.mobs.cachedSpawnPoint ??= n.overMobs.mobs.cachedSpawnPoint; // SpawnerAnimals keeps 24 blocks from the OVERWORLD spawn in every dimension
  n.dispense.tick();
  n.mobs.tick();
  n.dispense.flush();
  n.weather.tickDimension(w, null); // the three random block ticks per section, over the whole finite world (as the Overworld's weather.tick(world))
  n.weather.drain();
  n.falling.tick();
  tickWorldSystems({ farming: n.farming, fluids: n.fluids, fire: n.fire, redstone: n.redstone, hoppers: n.containers.ticks.hoppers },
    { time: sim.time, daylight: 0, x: 64, z: 64 }, { farming: noop, fluids: noop, fire: noop });
  tickBeacons(n.tileEntities.beacons, { world: w, time: sim.time, apply: (pl, e) => {
    const p = pl.player;
    p.survival.effects.add(e);
    (p.effectsOut ??= []).push({ id: e.id, amplifier: e.amplifier, duration: e.duration, ambient: !!e.ambient });
  }, players: players.map(p => ({ x: p.position.x, y: p.position.y, z: p.position.z, width: PHYSICS.width, height: PHYSICS.height, player: p })) });
  for (const key of new Set([...beforeLit, ...n.redstone.lit])) if (beforeLit.has(key) !== n.redstone.lit.has(key)) {
    const [x, y, z] = key.split(',').map(Number);
    n.changes.set(key, [x, y, z, w.get(x, y, z), w.getMeta(x, y, z)]);
  }
  for (const [x, y, z] of n.changes.values()) n.light.update(x, y, z);
}
