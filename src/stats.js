// StatList / StatBase / StatisticsFile of Minecraft Java 1.7.10 (pp, ph, pg). The tables in stats-data.js are generated from the
// unchanged client by tools/verify-stats.mjs (public/research/stats-reference.json); formats, the file shape and the offline UUID
// below are read from the same classes. Notes: public/research/stats.md.
import { STAT_DATA as D } from "./stats-data.js";

export const MAX_STAT = 2147483647;
export const GENERAL = Object.freeze(D.general.map(([id, format, local]) => Object.freeze({ id, format, local })));
export const EGGS = Object.freeze(D.eggs.map(([id, name, kills, killedBy]) => Object.freeze({ id, name, kills, killedBy })));
export const lang = (key) => D.lang[key] ?? key;

// StatList general stat ids by their field name in pp.
export const STAT = Object.freeze({
  leaveGame: "stat.leaveGame", playOneMinute: "stat.playOneMinute", walk: "stat.walkOneCm", swim: "stat.swimOneCm", fall: "stat.fallOneCm",
  climb: "stat.climbOneCm", fly: "stat.flyOneCm", dive: "stat.diveOneCm", minecart: "stat.minecartOneCm", boat: "stat.boatOneCm",
  pig: "stat.pigOneCm", horse: "stat.horseOneCm", jump: "stat.jump", drop: "stat.drop", damageDealt: "stat.damageDealt",
  damageTaken: "stat.damageTaken", deaths: "stat.deaths", mobKills: "stat.mobKills", animalsBred: "stat.animalsBred",
  playerKills: "stat.playerKills", fishCaught: "stat.fishCaught", junkFished: "stat.junkFished", treasureFished: "stat.treasureFished",
});

// IStatType formatters (pi, pj, pk, pl). DecimalFormat("########0.00") rounds half-even.
function fixed2(x) {
  const n = Math.abs(x) * 100, f = Math.floor(n), tie = n - f === 0.5;
  const r = tie ? (f % 2 === 0 ? f : f + 1) : Math.round(n);
  return (x < 0 && r !== 0 ? "-" : "") + String(Math.trunc(r / 100)) + "." + String(r % 100).padStart(2, "0");
}
const javaDouble = (v) => (Number.isInteger(v) ? v.toFixed(1) : String(v));
export const FORMATS = Object.freeze({
  simple: (v) => Math.trunc(v).toLocaleString("en-US"),
  time(ticks) {
    const s = ticks / 20, m = s / 60, h = m / 60, d = h / 24, y = d / 365;
    if (y > 0.5) return `${fixed2(y)} y`;
    if (d > 0.5) return `${fixed2(d)} d`;
    if (h > 0.5) return `${fixed2(h)} h`;
    if (m > 0.5) return `${fixed2(m)} m`;
    return `${javaDouble(s)} s`;
  },
  distance(cm) {
    const m = cm / 100, km = m / 1000;
    if (km > 0.5) return `${fixed2(km)} km`;
    if (m > 0.5) return `${fixed2(m)} m`;
    return `${Math.trunc(cm)} cm`;
  },
  decimal: (v) => fixed2(v * 0.1),
});
const FORMAT_OF = new Map(GENERAL.map((g) => [g.id, g.format]));
// StatBase.format(int): the stat's own formatter; every per-item and entity stat is simple.
export const formatStat = (id, value) => FORMATS[FORMAT_OF.get(id) ?? "simple"](value);

// Per-item arrays pp.C..F: original item id -> stat id (variant blocks share the merged stat), or null.
const maps = { mine: D.mine, craft: D.craft, use: D.use, break: D.break };
export const mineStat = (item) => maps.mine[item] ?? null;
export const craftStat = (item) => maps.craft[item] ?? null;
export const useStat = (item) => maps.use[item] ?? null;
export const breakStat = (item) => maps.break[item] ?? null;
export const BLOCK_LIST = Object.freeze([...D.blocks]); // pp.e: item ids with a mineBlock stat
export const ITEM_LIST = Object.freeze([...D.items]);   // pp.d: item ids with a useItem stat
const EGG_BY_NAME = new Map(EGGS.map((e) => [e.name, e]));

const KNOWN = new Set([...GENERAL.map((g) => g.id), ...Object.values(maps).flatMap((m) => Object.values(m)), ...EGGS.flatMap((e) => [e.kills, e.killedBy])]);
export const isStat = (id) => KNOWN.has(id);

// The 1.7.10 EntityList name of a browser mob type (null for a type without egg info: no per-entity stats).
const ENTITY_NAMES = { pigman: "PigZombie", wither_skeleton: "Skeleton", cave_spider: "CaveSpider", magma_cube: "LavaSlime", mooshroom: "MushroomCow", ocelot: "Ozelot", horse: "EntityHorse" };
export function entityName(type) {
  const name = ENTITY_NAMES[type] ?? (typeof type === "string" && type ? type[0].toUpperCase() + type.slice(1) : null);
  return name && EGG_BY_NAME.has(name) ? name : null;
}

export class Stats {
  constructor(data) {
    this.values = new Map();
    if (data) this.load(data);
  }
  // StatFileWriter.writeStat (+ the independent stats are not synchronised to a server: nothing to do locally).
  increment(id, n = 1) {
    if (!KNOWN.has(id) || !(n > 0) || !Number.isFinite(n)) return;
    this.values.set(id, Math.min(MAX_STAT, (this.values.get(id) ?? 0) + Math.trunc(n)));
  }
  get(id) { return this.values.get(id) ?? 0; }
  has(id) { return this.values.has(id); }
  // Per-item hooks: `item` is the original (1.7.10) item or block id.
  mineBlock(item) { const s = mineStat(item); if (s) this.increment(s); }
  craft(item, amount = 1) { const s = craftStat(item); if (s) this.increment(s, amount); }
  use(item) { const s = useStat(item); if (s) this.increment(s); }
  breakItem(item) { const s = breakStat(item); if (s) this.increment(s); }
  // EntityPlayer.onKillEntity / EntityPlayerMP.onDeath: the entity egg info's kill and killedBy stats.
  kill(type) { const e = EGG_BY_NAME.get(entityName(type)); if (e) this.increment(e.kills); }
  killedBy(type) { const e = EGG_BY_NAME.get(entityName(type)); if (e) this.increment(e.killedBy); }
  // Rows of GuiStats (bek, ben): items with any non-zero stat, sorted by item id.
  blocks() { return BLOCK_LIST.filter((id) => this.get(mineStat(id)) > 0 || this.get(useStat(id) ?? "") > 0 || this.get(craftStat(id) ?? "") > 0); }
  items() { return ITEM_LIST.filter((id) => this.get(useStat(id)) > 0 || this.get(breakStat(id) ?? "") > 0 || this.get(craftStat(id) ?? "") > 0); }
  // bep: egg infos in EntityList order with a kill or killed-by count.
  mobs() { return EGGS.filter((e) => this.get(e.kills) > 0 || this.get(e.killedBy) > 0); }
  // World record shape: a flat { statId: int } object (the stat half of StatisticsFile).
  save() { return Object.fromEntries([...this.values].filter(([, v]) => v > 0)); }
  load(data) {
    this.values.clear();
    if (!data || typeof data !== "object") return;
    for (const [id, v] of Object.entries(data)) {
      const n = typeof v === "object" && v ? v.value : v;
      if (KNOWN.has(id) && Number.isFinite(n) && n > 0) this.values.set(id, Math.min(MAX_STAT, Math.trunc(n)));
    }
  }
}

// StatisticsFile.func_150880_a: one flat JSON object with the stat ints and the achievement ints (1 once unlocked). A stat with
// progress (only exploreAllBiomes: its JsonSerializableSet of visited biome names) is written as {"value": n, "progress": [...]},
// locked or not, whenever a biome has been visited.
export function statsFileJson(stats, unlockedAchievements = [], biomes = []) {
  const out = {};
  for (const [id, v] of stats.values) if (v > 0) out[id] = v;
  for (const id of unlockedAchievements) out[`achievement.${id}`] = 1;
  if (biomes.length) out["achievement.exploreAllBiomes"] = { value: unlockedAchievements.includes("exploreAllBiomes") ? 1 : 0, progress: [...biomes] };
  return JSON.stringify(out);
}
// StatisticsFile.func_150881_a: unknown keys are ignored; { value } objects are accepted as well as plain ints, and the
// exploreAllBiomes progress array becomes `biomes`.
export function parseStatsFile(text) {
  const stats = new Stats(), achievements = [], biomes = [];
  let json;
  try { json = JSON.parse(text); } catch { return { stats, achievements, biomes }; }
  if (!json || typeof json !== "object" || Array.isArray(json)) return { stats, achievements, biomes };
  const flat = {};
  for (const [id, v] of Object.entries(json)) {
    const n = typeof v === "object" && v ? v.value : v;
    if (id.startsWith("achievement.")) { if (n > 0) achievements.push(id.slice("achievement.".length)); } else flat[id] = n;
    if (id === "achievement.exploreAllBiomes" && Array.isArray(v?.progress)) for (const b of v.progress) if (typeof b === "string" && !biomes.includes(b)) biomes.push(b);
  }
  stats.load(flat);
  return { stats, achievements, biomes };
}

// UUID.nameUUIDFromBytes("OfflinePlayer:<name>"): the player UUID of an offline-mode server (stats/<uuid>.json).
const MD5_S = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
const MD5_K = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) >>> 0);
export function md5(bytes) {
  const len = bytes.length, padded = new Uint8Array(((len + 8) >> 6 << 6) + 64);
  padded.set(bytes);
  padded[len] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, (len * 8) >>> 0, true);
  view.setUint32(padded.length - 4, Math.floor(len / 0x20000000), true);
  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
  for (let off = 0; off < padded.length; off += 64) {
    let a = a0, b = b0, c = c0, d = d0;
    for (let i = 0; i < 64; i++) {
      let f, g;
      if (i < 16) { f = (b & c) | (~b & d); g = i; }
      else if (i < 32) { f = (d & b) | (~d & c); g = (5 * i + 1) % 16; }
      else if (i < 48) { f = b ^ c ^ d; g = (3 * i + 5) % 16; }
      else { f = c ^ (b | ~d); g = (7 * i) % 16; }
      f = (f + a + MD5_K[i] + view.getUint32(off + g * 4, true)) | 0;
      a = d; d = c; c = b;
      const s = MD5_S[(i >> 4) * 4 + (i & 3)];
      b = (b + ((f << s) | (f >>> (32 - s)))) | 0;
    }
    a0 = (a0 + a) | 0; b0 = (b0 + b) | 0; c0 = (c0 + c) | 0; d0 = (d0 + d) | 0;
  }
  const out = new Uint8Array(16), o = new DataView(out.buffer);
  [a0, b0, c0, d0].forEach((v, i) => o.setUint32(i * 4, v >>> 0, true));
  return out;
}
export function offlineUuid(name) {
  const h = md5(new TextEncoder().encode(`OfflinePlayer:${name}`));
  h[6] = (h[6] & 0x0f) | 0x30; // version 3
  h[8] = (h[8] & 0x3f) | 0x80; // IETF variant
  const hex = [...h].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// GuiStats sorting (beq.h): click column c, then the comparator over the item ids' stat values.
export function nextSort(sort, column) {
  if (column !== sort.column) return { column, direction: -1 };
  if (sort.direction === -1) return { column, direction: 1 };
  return { column: -1, direction: 0 };
}
export function sortRows(rows, sort, valueOf) {
  const cmp = (a, b) => {
    if (sort.column >= 0) {
      const va = valueOf(a, sort.column), vb = valueOf(b, sort.column);
      if (va === null && vb !== null) return 1;
      if (vb === null && va !== null) return -1;
      if (va !== vb && va !== null) return (va - vb) * sort.direction;
    }
    return a - b;
  };
  return [...rows].sort(cmp);
}

// The stats/<uuid>.json entry of a Java export: [path, bytes]. The browser has one local player named "Player" (death-messages.js
// PLAYER_NAME), so the file uses that name's offline-mode UUID, which the integrated server of a Java client uses for it.
export function statsExportFile(record, name = "Player") {
  const unlocked = record?.achievements?.unlocked ?? [];
  const biomes = Array.isArray(record?.achievements?.biomes) ? record.achievements.biomes.filter((b) => typeof b === "string") : [];
  return [`stats/${offlineUuid(name)}.json`, new TextEncoder().encode(statsFileJson(new Stats(record?.stats), unlocked, biomes))];
}
