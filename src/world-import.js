import { isSupportedType } from "./cart-variants.js";
import { readPlayerPortalState } from "./dimensions.js";
// Keep the runtime payload shared between local saves and imported exports.
// Each subsystem validates its own payload on launch. Identity and the validated
// world/player fields are built by the caller rather than copied from the file.
const RUNTIME_FIELDS = [
  "position", "drops", "entities", "farms", "experience", "xpOrbs", "falling",
  "weather", "worldRandom", "projectiles", "thrownPotions", "fireballs", "eyes", "rockets", "arrows", "tnt", "fluidTicks", "fireTicks", "fallingTicks", "inhabited",
  "spawners", "pistons", "boats", "minecarts", "populatedColumns",
  "portalState", "worldSpawn",
  // Tile entities and hanging entities (each loader validates its records), villages, map items, generated-structure starts.
  "hanging", "signs", "skulls", "beacons", "commandBlocks", "musicTiles", "villages", "maps", "structureData",
  // The Java world's level.dat and stats/<uuid>.json (level-dat.js): game rules, the bed spawn, statistics and achievements,
  // and the WorldInfo flags the browser keeps for export only (MapFeatures, hardcore, the total world time).
  "gameRules", "bed", "stats", "achievements", "mapFeatures", "hardcore", "totalTime",
];

const int = Number.isInteger, finite = Number.isFinite;
const stored = (v) => v.filter((e) => int(e?.id) && int(e?.lvl)).slice(0, 64).map((e) => ({ id: e.id, lvl: e.lvl }));
const SPAWNER_NUMBERS = ["Delay", "MinSpawnDelay", "MaxSpawnDelay", "SpawnCount", "MaxNearbyEntities", "RequiredPlayerRange", "SpawnRange"];
// Generated-structure state (structure-simulation.js) is rebuilt field by field: a record that is
// not the expected shape is dropped, and an export without these fields gets the generation's
// spawners and full carts on its first launch, as an older save does.
// Column runtime arrays (chunk-runtime.js) are keyed by the record position, so x and z must be numbers.
const list = (v, max) => (Array.isArray(v) ? v.filter((e) => e && typeof e === "object" && finite(e.x) && finite(e.z)).slice(0, max) : undefined);
const triple = (v) => Array.isArray(v) && v.length === 3 && v.every(int);
const SANITIZE = {
  hanging: (v) => list(v, 4096), signs: (v) => list(v, 4096), skulls: (v) => list(v, 4096), beacons: (v) => list(v, 4096),
  commandBlocks: (v) => list(v, 4096), musicTiles: (v) => list(v, 4096),
  // VillageCollection.toJSON: Village.fromJSON spreads the centre and door rows, so malformed villages are dropped here.
  villages: (v) => v && typeof v === "object" && Array.isArray(v.villages)
    ? { tick: int(v.tick) ? v.tick : 0, villages: v.villages.filter((g) => g && triple(g.c) && triple(g.ac) && Array.isArray(g.doors)
      && g.doors.every((d) => Array.isArray(d) && d.length >= 6 && d.slice(0, 6).every(int))).slice(0, 1024) }
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
  totalTime: (v) => (Number.isSafeInteger(v) && v >= 0 ? v : undefined),
  portalState: readPlayerPortalState,
  worldSpawn: (v) => Array.isArray(v) && v.length === 3 && v.every(int) ? [...v] : undefined,
  // Streamed population (streaming-population.js): per-cell bitmask of columns whose generated
  // chests/animals/spawners were already handed to the live world. Bad entries just hand over again.
  populatedColumns: (v) => v && typeof v === "object" && v.version === 1 && v.cells && typeof v.cells === "object"
    ? { version: 1, cells: Object.fromEntries(Object.entries(v.cells)
      .filter(([k, hex]) => /^-?\d+,-?\d+$/.test(k) && typeof hex === "string" && /^[0-9a-f]{1,16}$/.test(hex)).slice(0, 262144)) }
    : undefined,
  // Moving piston tiles (piston-live.js save()): validated field by field; bad entries are dropped.
  pistons: (v) => Array.isArray(v)
    ? v.filter((t) => t && typeof t === "object" && [t.x, t.y, t.z, t.block, t.meta, t.facing].every(int) && t.facing >= 0 && t.facing <= 5 && finite(t.progress)).slice(0, 4096).map((t) => ({
      x: t.x, y: t.y, z: t.z, block: t.block, meta: t.meta, facing: t.facing, progress: Math.max(0, Math.min(1, t.progress)),
      ...(finite(t.lastProgress) ? { lastProgress: Math.max(0, Math.min(1, t.lastProgress)) } : {}),
      extending: t.extending === true, renderHead: t.renderHead === true,
    }))
    : undefined,
  // Boats (boats.js toJSON): position, motion, rotation, fall distance, fire, ground flag and the mounted player.
  boats: (v) => Array.isArray(v)
    ? v.filter((c) => c && typeof c === "object" && [c.x, c.y, c.z].every(finite)).slice(0, 1024).map((c) => ({
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
    ? v.filter((t) => t && typeof t === "object" && [t.x, t.y, t.z].every(int)).slice(0, 4096).map((t) => ({
      x: t.x, y: t.y, z: t.z,
      ...(typeof t.EntityId === "string" ? { EntityId: t.EntityId.slice(0, 64) } : {}),
      ...Object.fromEntries(SPAWNER_NUMBERS.filter((k) => int(t[k])).map((k) => [k, t[k]])),
    }))
    : undefined,
  minecarts: (v) => v && typeof v === "object" && Array.isArray(v.carts)
    ? { version: 1, carts: v.carts.filter((c) => c && typeof c === "object" && [c.x, c.y, c.z].every(finite)).slice(0, 1024).map((c) => ({
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
          ...(int(it.color) && it.color >= 0 && it.color <= 0xFFFFFF ? { color: it.color } : {}) })),
    })) }
    : undefined,
};

export function importedRuntime(data) {
  return Object.fromEntries(RUNTIME_FIELDS.filter((key) => Object.hasOwn(data, key))
    .map((key) => [key, SANITIZE[key] ? SANITIZE[key](data[key]) : data[key]])
    .filter(([, value]) => value !== undefined));
}
