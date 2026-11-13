import { readItemTags } from './item-tags.js';
import { isSupportedType } from "./cart-variants.js";
import { readPlayerPortalState } from "./dimensions.js";
import { Weather } from "./weather.js";
// Keep the runtime payload shared between local saves and imported exports.
// Each subsystem validates its own payload on launch. Identity and the validated
// world/player fields are built by the caller rather than copied from the file.
const RUNTIME_FIELDS = [
  "position", "drops", "entities", "farms", "experience", "xpOrbs", "falling",
  "weather", "worldRandom", "simulation", "projectiles", "thrownPotions", "fireballs", "eyes", "rockets", "arrows", "tnt", "fluidTicks", "fireTicks", "fallingTicks", "foreignTicks", "inhabited",
  "spawners", "pistons", "boats", "minecarts", "populatedColumns",
  "portalState", "worldSpawn",
  // Tile entities and hanging entities (each loader validates its records), villages, map items, generated-structure starts.
  "hanging", "signs", "skulls", "beacons", "commandBlocks", "musicTiles", "villages", "maps", "structureData",
  // The Java world's level.dat and stats/<uuid>.json (level-dat.js): game rules, the bed spawn, statistics and achievements,
  // and the WorldInfo flags the browser keeps for export only (MapFeatures, hardcore, the total world time).
  "gameRules", "bed", "stats", "achievements", "mapFeatures", "hardcore", "totalTime",
  // Player abilities.flying (Creative only), a forced spawn (/spawnpoint) and a bed to free after a saved Sleeping player wakes.
  "flying", "playerSpawn", "wakeFromBed",
  // Live redstone save (redstone-live.js): pending scheduled ticks, lit repeaters, comparator signals, moving pistons (sanitised below).
  "redstone",
];

const int = Number.isInteger, finite = Number.isFinite;
const stored = (v) => v.filter((e) => int(e?.id) && int(e?.lvl)).slice(0, 64).map((e) => ({ id: e.id, lvl: e.lvl }));
const SPAWNER_NUMBERS = ["Delay", "MinSpawnDelay", "MaxSpawnDelay", "SpawnCount", "MaxNearbyEntities", "RequiredPlayerRange", "SpawnRange"];
// Generated-structure state (structure-simulation.js) is rebuilt field by field: a record that is
// not the expected shape is dropped, and an export without these fields gets the generation's
// spawners and full carts on its first launch, as an older save does.
// Column runtime arrays (chunk-runtime.js) are keyed by the record position, so x and z must be numbers.
const list = (v, max) => (Array.isArray(v) ? v.filter((e) => e && typeof e === "object" && finite(e.x) && finite(e.z)).slice(0, max) : undefined);
const ints = (a, n) => Array.isArray(a) && a.length >= n && a.slice(0, n).every(int);
const nums = (a, n) => Array.isArray(a) && a.length === n && a.every(finite);
// redstone-live.js save(): only the shapes restore() reads are kept; the engine's Random and block-event queue are not trusted from a file.
function sanitizeRedstone(v) {
  if (!v || typeof v !== "object" || v.version !== 1) return undefined;
  const ticks = (a) => (Array.isArray(a) ? a.filter((e) => ints(e, 7)).slice(0, LIST_CAP).map((e) => (int(e[7]) ? e.slice(0, 8) : e.slice(0, 7))) /* the 8th item is the shared creation id n (batch 34) */ : []);
  return {
    version: 1, clock: int(v.clock) ? v.clock : 0, time: int(v.time) ? v.time : 0, pending: ticks(v.pending), deferred: ticks(v.deferred),
    torches: (Array.isArray(v.torches) ? v.torches.filter((e) => ints(e, 4)) : []).slice(0, LIST_CAP).map((e) => e.slice(0, 4)),
    lit: (Array.isArray(v.lit) ? v.lit.filter((k) => typeof k === "string" && /^-?\d+,\d+,-?\d+$/.test(k)) : []).slice(0, LIST_CAP),
    comparators: (Array.isArray(v.comparators) ? v.comparators.filter((e) => Array.isArray(e) && typeof e[0] === "string" && int(e[1])) : []).slice(0, LIST_CAP).map((e) => [e[0], e[1]]),
    pistons: (Array.isArray(v.pistons) ? v.pistons.filter((e) => nums(e, 10)) : []).slice(0, LIST_CAP),
  };
}
const triple = (v) => Array.isArray(v) && v.length === 3 && v.every(int);
// Per-list bound of the merged runtime record (signs, hanging, spawners, minecarts, villages, boats, pistons, populated columns...).
// It used to be 4096 (1024 for carts, boats and villages); a whole save with more entries lost the rest at import. The record is
// split per column at the first persist (chunk-runtime.js splitRuntime), so only the import-time merge holds a list whole:
// roughly 150-400 bytes of heap per entry, 1 << 20 entries per list at most (a few hundred MB worst case, never reached by a
// real save; a save past it is truncated, not refused). Sanitising is linear in the entries.
export const LIST_CAP = 1 << 20;
// A saved World.rand/updateLCG stream (Weather.saveSimulation): kept only when Weather.restoreSimulation would accept it.
const simulationStream = (v) => (v && typeof v === "object" && JSON.stringify(new Weather().restoreSimulation(v).saveSimulation()) === JSON.stringify(v) ? v : undefined);
// tile-ticks.js foreignTicks: raw saved ticks the port does not run, {i, x, y, z, p} plus t (or air: true), aged against `time` on export.
function sanitizeForeignTicks(v) {
  if (!v || typeof v !== "object" || v.version !== 1 || !Array.isArray(v.entries)) return undefined;
  const entries = v.entries.filter((e) => e && [e.i, e.x, e.y, e.z].every(int) && (e.air === true || int(e.t))).slice(0, LIST_CAP)
    .map((e) => (e.air === true ? { i: 0, x: e.x, y: e.y, z: e.z, p: int(e.p) ? e.p : 0, air: true } : { i: e.i, x: e.x, y: e.y, z: e.z, t: e.t, p: int(e.p) ? e.p : 0 }));
  return entries.length ? { version: 1, time: int(v.time) && v.time >= 0 ? v.time : 0, entries } : undefined;
}
const SANITIZE = {
  foreignTicks: sanitizeForeignTicks,
  worldRandom: simulationStream, simulation: simulationStream,
  redstone: (v) => sanitizeRedstone(v),
  hanging: (v) => list(v, LIST_CAP), signs: (v) => list(v, LIST_CAP), skulls: (v) => list(v, LIST_CAP), beacons: (v) => list(v, LIST_CAP),
  commandBlocks: (v) => list(v, LIST_CAP), musicTiles: (v) => list(v, LIST_CAP),
  // VillageCollection.toJSON: Village.fromJSON spreads the centre and door rows, so malformed villages are dropped here.
  villages: (v) => v && typeof v === "object" && Array.isArray(v.villages)
    ? { tick: int(v.tick) ? v.tick : 0, villages: v.villages.filter((g) => g && triple(g.c) && triple(g.ac) && Array.isArray(g.doors)
      && g.doors.every((d) => Array.isArray(d) && d.length >= 6 && d.slice(0, 6).every(int))).slice(0, LIST_CAP) }
    : undefined,
  maps: (v) => (v && typeof v === "object" && Array.isArray(v.maps) ? v : undefined),
  // structure-data.js: {Name: base64 gzip of data/<Name>.dat}.
  structureData: (v) => v && typeof v === "object" && !Array.isArray(v)
    ? Object.fromEntries(Object.entries(v).filter(([k, b]) => /^\w{1,32}$/.test(k) && typeof b === "string" && /^[A-Za-z0-9+/=]*$/.test(b)).slice(0, 16))
    : undefined,
  // GameRules: rule name -> string value (game-rules.js reads "true" ignoring case), as GameRules.readGameRulesFromNBT keeps them.
  gameRules: (v) => v && typeof v === "object" && !Array.isArray(v)
    ? Object.fromEntries(Object.entries(v).filter(([k, s]) => typeof s === "string" && k.length <= 64 && s.length <= 256).slice(0, 64))
    : undefined,
  // BedSleep.save: only the spawn point is carried over (a saved sleep is not resumed from another file).
  bed: (v) => (triple(v?.spawn) ? { spawn: [...v.spawn] } : undefined),
  // Stats.save and Achievements.save; both loaders also drop unknown ids.
  stats: (v) => v && typeof v === "object" && !Array.isArray(v)
    ? Object.fromEntries(Object.entries(v).filter(([k, n]) => k.length <= 128 && int(n) && n > 0).slice(0, 8192))
    : undefined,
  achievements: (v) => v && typeof v === "object"
    ? { unlocked: (Array.isArray(v.unlocked) ? v.unlocked : []).filter((s) => typeof s === "string").slice(0, 256),
      biomes: (Array.isArray(v.biomes) ? v.biomes : []).filter((s) => typeof s === "string").slice(0, 256) }
    : undefined,
  mapFeatures: (v) => (typeof v === "boolean" ? v : undefined),
  hardcore: (v) => (typeof v === "boolean" ? v : undefined),
  flying: (v) => (v === true ? true : undefined),
  playerSpawn: (v) => (triple(v) ? [...v] : undefined),
  wakeFromBed: (v) => (triple(v) ? [...v] : undefined),
  totalTime: (v) => (Number.isSafeInteger(v) && v >= 0 ? v : undefined),
  portalState: readPlayerPortalState,
  worldSpawn: (v) => Array.isArray(v) && v.length === 3 && v.every(int) ? [...v] : undefined,
  // Streamed population (streaming-population.js): per-cell bitmask of columns whose generated
  // chests/animals/spawners were already handed to the live world. Bad entries just hand over again.
  populatedColumns: (v) => v && typeof v === "object" && v.version === 1 && v.cells && typeof v.cells === "object"
    ? { version: 1, cells: Object.fromEntries(Object.entries(v.cells)
      .filter(([k, hex]) => /^-?\d+,-?\d+$/.test(k) && typeof hex === "string" && /^[0-9a-f]{1,16}$/.test(hex)).slice(0, LIST_CAP)) }
    : undefined,
  // Moving piston tiles (piston-live.js save()): validated field by field; bad entries are dropped.
  pistons: (v) => Array.isArray(v)
    ? v.filter((t) => t && typeof t === "object" && [t.x, t.y, t.z, t.block, t.meta, t.facing].every(int) && t.facing >= 0 && t.facing <= 5 && finite(t.progress)).slice(0, LIST_CAP).map((t) => ({
      x: t.x, y: t.y, z: t.z, block: t.block, meta: t.meta, facing: t.facing, progress: Math.max(0, Math.min(1, t.progress)),
      ...(finite(t.lastProgress) ? { lastProgress: Math.max(0, Math.min(1, t.lastProgress)) } : {}),
      extending: t.extending === true, renderHead: t.renderHead === true,
    }))
    : undefined,
  // Boats (boats.js toJSON): position, motion, rotation, fall distance, fire, ground flag and the mounted player.
  boats: (v) => Array.isArray(v)
    ? v.filter((c) => c && typeof c === "object" && [c.x, c.y, c.z].every(finite)).slice(0, LIST_CAP).map((c) => ({
      ...(int(c.id) && c.id > 0 ? { id: c.id } : {}), // the id mobs saved riding this boat name
      x: c.x, y: c.y, z: c.z,
      ...(Array.isArray(c.motion) && c.motion.length === 3 && c.motion.every(finite) ? { motion: [...c.motion] } : {}),
      ...(Array.isArray(c.rotation) && c.rotation.length === 2 && c.rotation.every(finite) ? { rotation: [...c.rotation] } : {}),
      ...(finite(c.fallDistance) ? { fallDistance: c.fallDistance } : {}),
      ...(int(c.fire) ? { fire: c.fire } : {}),
      onGround: c.onGround === true,
      ...(c.rider === true ? { rider: true } : {}),
    }))
    : undefined,
  spawners: (v) => Array.isArray(v)
    ? v.filter((t) => t && typeof t === "object" && [t.x, t.y, t.z].every(int)).slice(0, LIST_CAP).map((t) => ({
      x: t.x, y: t.y, z: t.z,
      ...(typeof t.EntityId === "string" ? { EntityId: t.EntityId.slice(0, 64) } : {}),
      ...Object.fromEntries(SPAWNER_NUMBERS.filter((k) => int(t[k])).map((k) => [k, t[k]])),
    }))
    : undefined,
  minecarts: (v) => v && typeof v === "object" && Array.isArray(v.carts)
    ? { version: 1, carts: v.carts.filter((c) => c && typeof c === "object" && [c.x, c.y, c.z].every(finite)).slice(0, LIST_CAP).map((c) => ({
      ...(int(c.id) && c.id > 0 ? { id: c.id } : {}), // the id mobs saved riding this cart name
      x: c.x, y: c.y, z: c.z,
      ...(c.type === 0 ? { type: 0, rider: c.rider === true } : isSupportedType(c.type) ? { type: c.type } : {}),
      ...(c.type === 2 ? { fuel: int(c.fuel) && c.fuel >= 0 ? c.fuel : 0, ...(finite(c.pushX) ? { pushX: c.pushX } : {}), ...(finite(c.pushZ) ? { pushZ: c.pushZ } : {}) } : {}),
      ...(c.type === 3 && int(c.fuse) ? { fuse: c.fuse } : {}),
      ...(c.type === 5 && int(c.cooldown) ? { cooldown: c.cooldown } : {}),
      // EntityMinecartMobSpawner: the spawnerJSON form (mob-spawner.js readNBT validates it); EntityMinecartCommandBlock: CommandBlockLogic.
      ...(c.type === 4 && c.spawner && typeof c.spawner === "object" && !Array.isArray(c.spawner) ? { spawner: structuredClone(c.spawner) } : {}),
      ...(c.type === 6 && c.command && typeof c.command === "object" ? { command: {
        command: typeof c.command.command === "string" ? c.command.command.slice(0, 32767) : "",
        successCount: int(c.command.successCount) ? c.command.successCount : 0,
        ...(typeof c.command.customName === "string" ? { customName: c.command.customName.slice(0, 64) } : {}),
        ...(typeof c.command.trackOutput === "boolean" ? { trackOutput: c.command.trackOutput } : {}),
        ...(typeof c.command.lastOutput === "string" ? { lastOutput: c.command.lastOutput.slice(0, 32767) } : {}),
      } } : {}),
      ...(Array.isArray(c.motion) && c.motion.length === 3 && c.motion.every(finite) ? { motion: [...c.motion] } : {}),
      ...(Array.isArray(c.rotation) && c.rotation.length === 2 && c.rotation.every(finite) ? { rotation: [...c.rotation] } : {}),
      ...(finite(c.fallDistance) ? { fallDistance: c.fallDistance } : {}),
      ...(int(c.fire) ? { fire: c.fire } : {}),
      onGround: c.onGround === true,
      ...(typeof c.customName === "string" && c.customName ? { customName: c.customName.slice(0, 64) } : {}),
      items: (Array.isArray(c.items) ? c.items : [])
        .filter((it) => int(it?.slot) && it.slot >= 0 && it.slot < (c.type === 5 ? 5 : 27) && int(it.id) && int(it.count) && it.count > 0 && (it.damage === undefined || int(it.damage)))
        .map((it) => ({ slot: it.slot, id: it.id, damage: it.damage ?? 0, count: Math.min(64, it.count),
          ...(Array.isArray(it.stored) ? { stored: stored(it.stored) } : {}),
          ...(Array.isArray(it.enchantments) ? { enchantments: stored(it.enchantments) } : {}),
          ...(Array.isArray(it.storedEnchantments) ? { storedEnchantments: stored(it.storedEnchantments) } : {}),
          ...(Number.isInteger(it.repairCost) ? { repairCost: it.repairCost } : {}),
          ...(typeof it.displayName === 'string' ? { displayName: it.displayName.slice(0, 32767) } : {}),
          ...(typeof it.unbreakable === 'boolean' ? { unbreakable: it.unbreakable } : {}),
          ...(int(it.color) && it.color >= 0 && it.color <= 0xFFFFFF ? { color: it.color } : {}), ...readItemTags(it) })),
    })) }
    : undefined,
};

export function importedRuntime(data) {
  return Object.fromEntries(RUNTIME_FIELDS.filter((key) => Object.hasOwn(data, key))
    .map((key) => [key, SANITIZE[key] ? SANITIZE[key](data[key]) : data[key]])
    .filter(([, value]) => value !== undefined));
}

// The per-dimension record of a Blockworld export (`dimensions[d]` = { state, tiles }): the Nether/End `simulation` stream (the
// per-dimension World.rand/updateLCG, dimension-live.js DIM_KEYS) is checked like the Overworld's `worldRandom`; every other
// field passes through to the loaders, which validate their own payloads.
export function importedDimensionState(blob) {
  if (!blob || typeof blob !== "object" || !blob.state || typeof blob.state !== "object" || !Object.hasOwn(blob.state, "simulation")) return blob;
  const { simulation, ...rest } = blob.state, kept = simulationStream(simulation);
  return { ...blob, state: kept ? { ...rest, simulation: kept } : rest };
}
