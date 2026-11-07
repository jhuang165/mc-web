// Java 1.7.10 level.dat, the singleplayer player and stats/<uuid>.json, read into the browser's record fields.
//
// level.dat is a gzip NBT document { Data: <WorldInfo> } (SaveHandler.saveWorldInfoWithPlayer). readLevelData follows
// WorldInfo(NBTTagCompound) (ays(dh)) key by key; public/research/level-dat-reference.json records what the unchanged
// classes keep, default and normalise (tools/probes/LevelDatProbe.java), and src/level-dat.test.js replays those cases.
// javaPlayerFromNbt follows EntityPlayer.readEntityFromNBT and its superclasses (Entity, EntityLivingBase) as far as
// the browser player carries the state, and lists what it does not keep. Level and player docs: level-dat.md.
import { decodeCompressedNbt } from './nbt-compression.js';
import { NBT } from './nbt.js';
import { nbtGet, hasNumber } from './nbt-get.js';
import { DEFAULT_RULES } from './game-rules.js';
import { itemStackFromNbt } from './region-import.js';
import { parseStatsFile } from './stats.js';
import { POTION_TYPES } from './potions.js';

const get = nbtGet;
const MAX_TIME = BigInt(Number.MAX_SAFE_INTEGER);
const longNumber = (v) => Number(v < 0n ? 0n : v > MAX_TIME ? MAX_TIME : v);
const list = (map, key, type) => {
  const l = get(map, key, NBT.LIST);
  return l && (l.elementType === type || !l.items.length) ? l.items : [];
};

// WorldType.worldTypes (ahm.a): id, name, generator version; DEFAULT is versioned (getWorldTypeForGeneratorVersion(0) is
// DEFAULT_1_1). parseWorldType matches the name ignoring case; an unknown or missing name is DEFAULT.
export const WORLD_TYPES = Object.freeze([
  { id: 0, name: 'default', version: 1, versioned: true },
  { id: 1, name: 'flat', version: 0 },
  { id: 2, name: 'largeBiomes', version: 0 },
  { id: 3, name: 'amplified', version: 0 },
  { id: 8, name: 'default_1_1', version: 0 },
]);
export const parseWorldType = (name) => WORLD_TYPES.find((t) => typeof name === 'string' && t.name.toLowerCase() === name.toLowerCase())?.name ?? null;
// GameType.getByID (ahk.a(int)): NOT_SET is -1; anything unknown is SURVIVAL.
export const GAME_MODES = Object.freeze({ 0: 'survival', 1: 'creative', 2: 'adventure' });
const gameTypeOf = (id) => (id === -1 || Object.hasOwn(GAME_MODES, id) ? id : 0);

/** WorldInfo(NBTTagCompound) over the Data compound (a Map of tags). */
export function readLevelData(data) {
  if (!(data instanceof Map)) throw new TypeError('level.dat Data must be a compound');
  // generatorName through WorldType.parseWorldType; only DEFAULT is versioned, and its getWorldTypeForGeneratorVersion(0) is
  // DEFAULT_1_1 (a missing generatorVersion reads as 0). WorldInfo writes the type's own version back.
  let worldType = 'default';
  if (data.get('generatorName')?.type === NBT.STRING) {
    worldType = parseWorldType(data.get('generatorName').value) ?? 'default';
    if (worldType === 'default' && get(data, 'generatorVersion', NBT.INT, 0) === 0) worldType = 'default_1_1';
  }
  const generatorVersion = WORLD_TYPES.find((t) => t.name === worldType).version;
  const gameType = gameTypeOf(get(data, 'GameType', NBT.INT, 0));
  const time = longNumber(get(data, 'Time', NBT.LONG, 0n));
  const gameRules = { ...DEFAULT_RULES };
  // GameRules.readGameRulesFromNBT: every key of the compound, through getString ("" for a non-string tag).
  const rules = get(data, 'GameRules', NBT.COMPOUND);
  if (rules) for (const [k, t] of rules) gameRules[k] = t.type === NBT.STRING ? t.value : '';
  const player = get(data, 'Player', NBT.COMPOUND) ?? null;
  return {
    seed: get(data, 'RandomSeed', NBT.LONG, 0n).toString(),
    worldType, generatorVersion,
    generatorOptions: get(data, 'generatorOptions', NBT.STRING, ''),
    gameType,
    mode: GAME_MODES[gameType] ?? 'survival',
    mapFeatures: hasNumber(data, 'MapFeatures') ? get(data, 'MapFeatures', NBT.BYTE, 1) !== 0 : true,
    spawn: [get(data, 'SpawnX', NBT.INT, 0), get(data, 'SpawnY', NBT.INT, 0), get(data, 'SpawnZ', NBT.INT, 0)],
    time,
    dayTime: hasNumber(data, 'DayTime') ? longNumber(get(data, 'DayTime', NBT.LONG, 0n)) : time,
    lastPlayed: longNumber(get(data, 'LastPlayed', NBT.LONG, 0n)),
    sizeOnDisk: longNumber(get(data, 'SizeOnDisk', NBT.LONG, 0n)),
    levelName: get(data, 'LevelName', NBT.STRING, ''),
    version: get(data, 'version', NBT.INT, 0),
    rainTime: get(data, 'rainTime', NBT.INT, 0), raining: get(data, 'raining', NBT.BYTE, 0) !== 0,
    thunderTime: get(data, 'thunderTime', NBT.INT, 0), thundering: get(data, 'thundering', NBT.BYTE, 0) !== 0,
    hardcore: get(data, 'hardcore', NBT.BYTE, 0) !== 0,
    initialized: hasNumber(data, 'initialized') ? get(data, 'initialized', NBT.BYTE, 1) !== 0 : true,
    // Absent, cheats follow the game type (a world from before the flag: on in Creative).
    allowCommands: hasNumber(data, 'allowCommands') ? get(data, 'allowCommands', NBT.BYTE, 0) !== 0 : gameType === 1,
    gameRules,
    player,
    dimension: player ? get(player, 'Dimension', NBT.INT, 0) : 0,
    // Keys 1.7.10 does not read (Difficulty and DifficultyLocked are 1.8 additions).
    ignored: [...data.keys()].filter((k) => !LEVEL_KEYS.has(k)),
  };
}
const LEVEL_KEYS = new Set(['RandomSeed', 'generatorName', 'generatorVersion', 'generatorOptions', 'GameType', 'MapFeatures', 'SpawnX', 'SpawnY', 'SpawnZ',
  'Time', 'DayTime', 'LastPlayed', 'SizeOnDisk', 'LevelName', 'version', 'rainTime', 'raining', 'thunderTime', 'thundering', 'hardcore', 'initialized',
  'allowCommands', 'GameRules', 'Player']);

/** level.dat bytes (gzip NBT) -> readLevelData of its Data compound. */
export async function readLevelDat(bytes) {
  const root = (await decodeCompressedNbt(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes))).tag.value;
  const data = root.get('Data');
  if (data?.type !== NBT.COMPOUND) throw new Error('level.dat has no Data compound');
  return readLevelData(data.value);
}

// playerdata/<uuid>.dat (1.7.6+) and players/<name>.dat (older saves): SaveHandler writes the player compound as the
// gzip root. Only read when level.dat has no Data.Player (a dedicated-server world or a second player).
export async function readPlayerDat(bytes) {
  const root = (await decodeCompressedNbt(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes))).tag;
  if (root?.type !== NBT.COMPOUND) throw new Error('player file has no root compound');
  return root.value;
}

// The browser generator for a level: streamed (endless) with the same seed and WorldType, so chunks beyond the import
// generate as the source world would. Generation 16 has population, structures and the native mutated-biome rule; MapFeatures off has no exact
// equivalent (13 keeps population and mineshafts, without villages, strongholds and temples, and the earlier biome rule).
export function levelGenerator(level) {
  const flat = level.worldType === 'flat';
  return {
    seed: level.seed, biome: 'javaStreamed', worldType: level.worldType,
    generatorOptions: flat ? level.generatorOptions : '',
    generationVersion: flat || level.mapFeatures ? 16 : 13,
    approximate: level.mapFeatures ? [] : [flat ? 'MapFeatures off: the Superflat options still decide its structures' : 'MapFeatures off: generation 13 still makes mineshafts'],
  };
}

// Native yaw/pitch (degrees, EntityPlayer Rotation) <-> the browser camera (radians; region-export.js writes the inverse).
export const browserYaw = (rotationYaw) => { const y = Math.PI - (rotationYaw * Math.PI) / 180; return Math.atan2(Math.sin(y), Math.cos(y)); };
export const browserPitch = (rotationPitch) => (-rotationPitch * Math.PI) / 180;

const PLAYER_KEYS = new Set(['Pos', 'Riding', 'Motion', 'Rotation', 'FallDistance', 'Fire', 'Air', 'OnGround', 'Dimension', 'Invulnerable', 'PortalCooldown', 'UUIDMost', 'UUIDLeast',
  'HealF', 'Health', 'AbsorptionAmount', 'HurtTime', 'DeathTime', 'AttackTime', 'Attributes', 'ActiveEffects', 'Inventory', 'SelectedItemSlot', 'Sleeping', 'SleepTimer',
  'XpP', 'XpLevel', 'XpTotal', 'Score', 'SpawnX', 'SpawnY', 'SpawnZ', 'SpawnForced', 'foodLevel', 'foodTickTimer', 'foodSaturationLevel', 'foodExhaustionLevel',
  'abilities', 'EnderItems', 'playerGameType']);

/**
 * EntityPlayer.readEntityFromNBT for the browser: `player` holds the Survival fields, `position` the camera (local
 * coordinates: native + shiftX/shiftZ), `experience` the Experience record. convertItem(compound) maps a stack
 * (region-import.js itemStackFromNbt by default). `lost` lists what was read but not kept.
 */
export function javaPlayerFromNbt(tag, { convertItem = (c) => itemStackFromNbt(c), shiftX = 0, shiftZ = 0 } = {}) {
  if (!(tag instanceof Map)) throw new TypeError('Player must be a compound');
  const lost = [];
  const pos = list(tag, 'Pos', NBT.DOUBLE), rot = list(tag, 'Rotation', NBT.FLOAT);
  const position = pos.length === 3 && pos.every(Number.isFinite)
    ? { x: pos[0] + shiftX, y: pos[1], z: pos[2] + shiftZ, yaw: rot.length === 2 ? browserYaw(rot[0]) : 0, pitch: rot.length === 2 ? browserPitch(rot[1]) : 0 }
    : null;
  // EntityLivingBase.readEntityFromNBT: HealF, else the legacy Health (float or short); setHealth caps at maxHealth.
  let health = 20;
  if (hasNumber(tag, 'HealF')) health = get(tag, 'HealF', NBT.FLOAT, 20);
  else if (tag.get('Health')?.type === NBT.FLOAT || tag.get('Health')?.type === NBT.SHORT) health = tag.get('Health').value;
  // setHealth clamps to 0..getMaxHealth (20 for a player; Health Boost raises it, and the browser applies that cap itself).
  health = Math.max(0, list(tag, 'ActiveEffects', NBT.COMPOUND).some((e) => get(e, 'Id', NBT.BYTE, 0) === 21) ? health : Math.min(20, health));
  // InventoryPlayer.readFromNBT: Slot & 255; 0-35 the main inventory, 100-103 the armour (boots first).
  const slots = Array(36).fill(null), armor = Array(4).fill(null);
  for (const entry of list(tag, 'Inventory', NBT.COMPOUND)) {
    const slot = get(entry, 'Slot', NBT.BYTE, 0) & 255;
    const target = slot < 36 ? [slots, slot] : slot >= 100 && slot < 104 ? [armor, slot - 100] : null;
    if (!target) { lost.push(`Inventory slot ${slot}`); continue; }
    const stack = convertItem(entry);
    if (stack) target[0][target[1]] = stack;
  }
  // InventoryEnderChest.loadInventoryFromNBT: Slot & 255, 0-26.
  const enderItems = Array(27).fill(null);
  for (const entry of list(tag, 'EnderItems', NBT.COMPOUND)) {
    const slot = get(entry, 'Slot', NBT.BYTE, 0) & 255;
    if (slot >= 27) { lost.push(`EnderItems slot ${slot}`); continue; }
    const stack = convertItem(entry);
    if (stack) enderItems[slot] = stack;
  }
  // PotionEffect.readCustomPotionEffectFromNBT: Id (a registered Potion, else the entry is skipped), Amplifier (signed byte),
  // Duration, Ambient; neither the amplifier nor the duration is checked. The browser keeps id, duration and amplifier.
  const effects = [];
  for (const e of list(tag, 'ActiveEffects', NBT.COMPOUND)) {
    const id = get(e, 'Id', NBT.BYTE, 0);
    if (!POTION_TYPES[id]) { lost.push(`ActiveEffects Id ${id}`); continue; }
    effects.push({ id, amplifier: get(e, 'Amplifier', NBT.BYTE, 0), duration: get(e, 'Duration', NBT.INT, 0), ambient: get(e, 'Ambient', NBT.BYTE, 0) !== 0 });
  }
  if (effects.some((e) => e.ambient)) lost.push('ActiveEffects.Ambient');
  // FoodStats.readNBT: all four only when foodLevel is present.
  const food = hasNumber(tag, 'foodLevel')
    ? { food: get(tag, 'foodLevel', NBT.INT, 20), timer: get(tag, 'foodTickTimer', NBT.INT, 0), saturation: get(tag, 'foodSaturationLevel', NBT.FLOAT, 5), exhaustion: get(tag, 'foodExhaustionLevel', NBT.FLOAT, 0) }
    : { food: 20, timer: 0, saturation: 5, exhaustion: 0 };
  const abilitiesTag = get(tag, 'abilities', NBT.COMPOUND);
  // PlayerCapabilities.readCapabilitiesFromNBT: only with an abilities compound; flySpeed/walkSpeed when flySpeed is present,
  // mayBuild when present. Otherwise the PlayerCapabilities defaults stand.
  const f32 = Math.fround, abilities = { invulnerable: false, flying: false, mayfly: false, instabuild: false, mayBuild: true, flySpeed: f32(0.05), walkSpeed: f32(0.1) };
  if (abilitiesTag) {
    for (const k of ['invulnerable', 'flying', 'mayfly', 'instabuild']) abilities[k] = get(abilitiesTag, k, NBT.BYTE, 0) !== 0;
    if (hasNumber(abilitiesTag, 'flySpeed')) { abilities.flySpeed = get(abilitiesTag, 'flySpeed', NBT.FLOAT, 0); abilities.walkSpeed = get(abilitiesTag, 'walkSpeed', NBT.FLOAT, 0); }
    if (hasNumber(abilitiesTag, 'mayBuild')) abilities.mayBuild = get(abilitiesTag, 'mayBuild', NBT.BYTE, 0) !== 0;
  }
  if (abilities.flySpeed !== f32(0.05) || abilities.walkSpeed !== f32(0.1)) lost.push('abilities.flySpeed/walkSpeed');
  // EntityPlayer: the bed spawn needs all three of SpawnX/Y/Z; SpawnForced (from /spawnpoint) is not kept.
  const bedSpawn = ['SpawnX', 'SpawnY', 'SpawnZ'].every((k) => hasNumber(tag, k))
    ? [get(tag, 'SpawnX', NBT.INT, 0) + shiftX, get(tag, 'SpawnY', NBT.INT, 0), get(tag, 'SpawnZ', NBT.INT, 0) + shiftZ] : null;
  // SpawnForced (a /spawnpoint) is kept as the browser's /spawnpoint (record.playerSpawn) by region-import.js.
  const spawnForced = Boolean(bedSpawn) && get(tag, 'SpawnForced', NBT.BYTE, 0) !== 0;
  // EntityPlayer.readEntityFromNBT (bytecode-read): Sleeping sets playerLocation to the floored Pos and calls
  // wakeUpPlayer(true, true, false) at once, so the player never resumes sleeping; the bed there is freed and the player
  // stands beside it. `sleepingAt` is that cell (local coordinates) for the launch to apply once the world is loaded.
  const sleeping = get(tag, 'Sleeping', NBT.BYTE, 0) !== 0;
  const sleepingAt = sleeping && position ? [Math.floor(position.x), Math.floor(position.y), Math.floor(position.z)] : null;
  const selected = get(tag, 'SelectedItemSlot', NBT.INT, 0);
  if (selected < 0 || selected > 8) lost.push(`SelectedItemSlot ${selected} (clamped to the hotbar)`);
  const motion = list(tag, 'Motion', NBT.DOUBLE);
  if (motion.length === 3 && motion.some((v) => v !== 0 && Math.abs(v) > 0.08)) lost.push('Motion');
  const playerGameType = hasNumber(tag, 'playerGameType') ? gameTypeOf(get(tag, 'playerGameType', NBT.INT, -1)) : -1;
  lost.push(...[...tag.keys()].filter((k) => !PLAYER_KEYS.has(k)));
  return {
    player: {
      health, ...food,
      air: get(tag, 'Air', NBT.SHORT, 300),
      fire: get(tag, 'Fire', NBT.SHORT, 0),
      effects: effects.map(({ id, amplifier, duration }) => ({ id, amplifier, duration })),
      absorption: get(tag, 'AbsorptionAmount', NBT.FLOAT, 0),
      slots, armor, current: Math.max(0, Math.min(8, selected)), enderItems,
    },
    position,
    // The native values the browser player clamps: SelectedItemSlot is kept unclamped by InventoryPlayer, effects keep Ambient.
    selectedItemSlot: selected, effects,
    fallDistance: get(tag, 'FallDistance', NBT.FLOAT, 0),
    experience: { total: get(tag, 'XpTotal', NBT.INT, 0), score: get(tag, 'Score', NBT.INT, 0), level: get(tag, 'XpLevel', NBT.INT, 0), progress: get(tag, 'XpP', NBT.FLOAT, 0) },
    dimension: get(tag, 'Dimension', NBT.INT, 0),
    portalCooldown: get(tag, 'PortalCooldown', NBT.INT, 0),
    abilities,
    flying: abilities.flying, spawnForced, sleeping, sleepingAt,
    // EntityPlayerMP.readEntityFromNBT: playerGameType (-1 when absent, then the world's GameType applies).
    playerGameType,
    bedSpawn,
    // Entity.writeToNBT's Riding: ServerConfigurationManager.initializeConnectionToPlayer creates it (sg.a, no nested chain) and mounts the player.
    riding: get(tag, 'Riding', NBT.COMPOUND) ?? null,
    lost,
  };
}

/**
 * stats/<uuid>.json (StatisticsFile.func_150881_a, stats.js parseStatsFile) -> the record's `stats` and `achievements` fields;
 * exploreAllBiomes keeps its progress (the visited biome names) even while it is locked.
 */
export function statsRecordFromJson(text) {
  const { stats, achievements, biomes } = parseStatsFile(text);
  return { stats: stats.save(), achievements: { unlocked: achievements, biomes } };
}
