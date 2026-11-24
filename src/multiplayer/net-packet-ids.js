// Batch 87 offline87: the native packet id of each WebSocket message kind, for /netstat (NetworkStatistics).
//
// Evidence (executed, tools/probes/Offline87Probe.java -> public/research/offline87-reference.json): EnumConnectionState (eo) of the unchanged 1.7.10 classes, its four states
// and both packet maps. The netty decoder (ez) and encoder (fa) record (id, frame bytes) in the server's one NetworkStatistics for every state (bytecode-read), so the
// handshake, status and login ids land in the same 100 slots as the play ids (a status ping counts under 0 and 1 with KeepAlive and Chat). An id the state does not
// register is never counted: ez throws "Bad packet id" before eu.a, and fa throws "Can't serialize unregistered packet" before eu.b.
//
// Port choices (port-read): a port message is one record, under the id of the native packet it stands for. Messages that bundle several native packets (the `tick`
// message: S03 time, S22/S23 cells, the players' poses, S2B weather) count once, under the id named below (b89 console89: now one record per native packet, writePackets). Bytes are the JSON text's UTF-8 length (natively: the packet
// id VarInt and payload). Port-only messages with no native packet (a client pickup claim, the client's own inventory copy, a server error line ...) return null:
// /netstat does not count them, as a native server never sends or reads them.
import { toOriginal } from '../block-registry.js';
import { watchState, stringExtra, watchDiff } from './net-watch-bytes.js'; // b91 console91: owner strings, name tags and the later watcher keys of a native mob
import { vehicleInfo } from './server-cart-track.js';
import { rowInfo } from './net-row-info.js'; // b92 console92: what a dispEnts row's S0E / S1C / S12 hold // b91 console91: the packets a cart or boat entry released
import { columnsDeflated, itemTagBytes } from './net-native-bytes.js'; // b89 console89: deflated chunk data, item tags (node:zlib: server-only)
import { profilePropertyBytes } from './profile-properties.js'; // b98 console98: the textures property of a spawning player's S0C
export const STATUS_IDS = { pingStatus: 0, pingProbe: 1, pingStatusReply: 0, pingProbeReply: 1 }; // STATUS: C00ServerQuery / C01Ping, S00ServerInfo / S01Pong

// Client to server (PLAY unless noted). Values are ids or (message) => id.
export const SERVERBOUND = {
  join: 0, // C00Handshake (HANDSHAKING 0) then C00PacketLoginStart (LOGIN 0): the port's one join message, counted once
  pingStatus: 0, pingProbe: 1,
  pingKeepAliveAck: 0, // C00PacketKeepAlive
  chat: 1, // C01PacketChatMessage
  attack: 2, attackPlayer: 2, animUse: 2, vehUse: 2, vehHit: 2, // C02PacketUseEntity
  input: 3, // C03PacketPlayer family (3-6): the port sends its controls and look each tick, the server moves the player
  dig: 7, achDrop: 7, // C07PacketPlayerDigging (status 0-2; 3/4 drop)
  edit: (m) => (m.place ? 8 : 7), // C08PacketPlayerBlockPlacement / C07 status 0
  use: (m) => (m.active ? 8 : 7), // C08 with direction 255 / C07 status 5 (release use item)
  sleepLeave: 11, horseJump: 11, horseInventory: 11, // C0BPacketEntityAction actions 3, 6, 7
  invClose: 13, closeWindow: 13, // C0DPacketCloseWindow
  invClick: 14, clickWindow: 14, beaconPayment: 14, // C0EPacketClickWindow
  invAck: 15, confirmTransaction: 15, // C0FPacketConfirmTransaction
  invCreative: 16, // C10PacketCreativeInventoryAction
  stationEnchant: 17, // C11PacketEnchantItem
  sign: 18, // C12PacketUpdateSign
  tabReq: 20, // C14PacketTabComplete
  settingsClient: 21, capeSettings: 21, // C15PacketClientSettings
  respawn: 22, requestStats: 22, openInventory: 22, // C16PacketClientStatus actions 0, 1, 2
  vehCmd: 23, blockCmd: 23, bookEdit: 23, bookSign: 23, beacon: 23, tradeSelect: 23, stationItemName: 23, // C17PacketCustomPayload (MC|AdvCdm, MC|BEdit, MC|BSign, MC|Beacon, MC|TrSel, MC|ItemName)
  // null: pickup (natively the server finds the items), windowInventory (the client's 36 slots after S2D, a port resync)
};

const firstOf = (list, ids, fallback) => { const k = Array.isArray(list) && list.length ? (list[0]?.type ?? list[0]?.k) : undefined; return ids[k] ?? fallback; };
const MOB_PACKET = { spawn: 15, destroy: 19, attach: 27, mobStatus: 26, state: 24 }; // S0F, S13, S1B, S19; `state` (a tracked mob's pose and flags) under S18
const SB_PACKET = { obj: 59, score: 60, display: 61, team: 62 }; // S3B-S3E

// Server to client (PLAY unless noted).
export const CLIENTBOUND = {
  pingKeepAlive: 0, // S00PacketKeepAlive
  pingStatusReply: 0, pingProbeReply: 1,
  welcome: 1, // S01PacketJoinGame (the port's welcome also carries the first chunks and players)
  chat: 2, sleepMsg: 2, // S02PacketChat
  health: 6, // S06PacketUpdateHealth
  dimRespawn: 7, // S07PacketRespawn
  abilities: 57, // S39PacketPlayerAbilities (b100 abilities100: join and respawn; the welcome / respawn message carries it)
  sleepIn: 10, // S0APacketUseBed
  sleepWake: 11, pfx73: 11, // S0BPacketAnimation (2 wake up, 4/5 critical hits)
  collect: 13, projCollect: 13, // S0DPacketCollectItem
  dispEnts: 14, fishHooks: 14, // S0EPacketSpawnObject
  mobs: (m) => firstOf(m.packets, MOB_PACKET, 20), // the entity tracker's S0F / S13 / S1B / S19 / poses, under its first packet
  vehicles: (m) => (m.set?.length ? 24 : 19), // S18 poses, or only S13 destroys
  tick: 24, // S18PacketEntityTeleport: each tick's absolute player poses (with the bundled S03, S22/S23 and weather)
  healthHurt: 26, useDone: 26, mobStatus: 26, // S19PacketEntityStatus (2 hurt, 3 dead, 9 item use finished)
  attach: 27, // S1BPacketEntityAttach
  dismount: 8, // b98 horse98: S08, S1B, S08 of EntityPlayerMP.mountEntity(null) (CLIENT_PACKETS)
  effect: 29, healthEffect: 29, // S1DPacketEntityEffect
  healthEffectEnd: 30, // S1EPacketRemoveEntityEffect
  playerOp: 31, // S1FPacketSetExperience (addExperience / addLevels)
  chunkUnload: 33, // S21PacketChunkData with no sections (the native unload)
  blocks: (m) => (Array.isArray(m.changes) && m.changes.length === 1 ? 35 : 34), // S23PacketBlockChange / S22PacketMultiBlockChange
  pistonTiles: 36, musicEvent: 36, // S24PacketBlockAction
  crack: 37, // S25PacketBlockBreakAnim
  chunkBulk: 38, // S26PacketMapChunkBulk
  aux: 40, // S28PacketEffect
  sound: 41, // S29PacketSoundEffect
  dispFx: 42, fishFx: 42, // S2APacketParticles
  dragonCredits: 43, // S2BPacketChangeGameState reason 4
  boltSpawn: 44, // S2CPacketSpawnGlobalEntity
  openWindow: 45, beaconWindow: 45, // S2DPacketOpenWindow
  windowClose: 46, // S2EPacketCloseWindow
  slot: 47, setSlot: 47, invSet: 47, // S2FPacketSetSlot
  windowItems: 48, invItems: 48, // S30PacketWindowItems
  windowProperty: 49, // S31PacketWindowProperty
  confirmTransaction: 50, invConfirm: 50, // S32PacketConfirmTransaction
  mapData: 52, // S34PacketMaps
  signEditor: 54, // S36PacketSignEditorOpen
  stats: 55, // S37PacketStatistics
  pingList: 56, // S38PacketPlayerListItem
  tabReply: 58, // S3APacketTabComplete
  sb: (m) => firstOf(m.packets, SB_PACKET, 59),
  tradeList: 63, // S3FPacketCustomPayload MC|TrList
  error: 64, // S40PacketDisconnect: the reason line sent before the close
  // null: invBroke (natively the client sees the break itself)
};

const lookup = (table, m) => { if (!m || typeof m.type !== 'string' || !Object.hasOwn(table, m.type)) return null; const v = table[m.type]; return typeof v === 'function' ? v(m) : v; };
/** The native id a message read from a client is counted under, or null (not counted). */
export const readPacketId = (m) => lookup(SERVERBOUND, m);
/** The native id a message sent to a client is counted under, or null (not counted). */
export const writePacketId = (m) => lookup(CLIENTBOUND, m);

// ---- Batch 88 console88: the native size of each record (what fa passes to eu.b and ez to eu.a) ----
//
// Evidence (executed, tools/probes/Console88Probe.java -> public/research/console88-reference.json): every packet class written with ft.b(et) after the id VarInt, with
// empty fields and with chosen samples; bytecode-read: fa counts et.readableBytes() after the id VarInt and the payload (no length prefix: the prepender er runs after it;
// 1.7.10 has no compression), ez counts the frame the splitter eq cut (id VarInt and payload), and the field layouts of the packets below.
// A record's size is the id VarInt (1 byte: every 1.7.10 id is below 128) plus the payload. Strings are et.a(String): a VarInt of the UTF-8 length, then the bytes.
// Port choices (port-read): a port message is still one record under the id above. Its bytes are the native frames of the packets it stands for, summed (the `tick`
// bundle: S03, an S18 per pose, S22/S23 for the cells; a list of sounds: one S29 each ...), so the wire format (JSON) is unchanged and the count stays one per message.
// Estimates, not exact: ItemStack NBT tags are not counted (a stack is 7 bytes, an empty slot 2); a mob spawn's DataWatcher counts only its end byte; chunk data
// (S21/S26), which natively is a deflated section array, counts the port's block runs as VarInts, a proxy; S18 stands for the port's poses where the native tracker
// mostly sends S15-S17 moves; the input message counts as C06 (position and look).
// Batch 89 console89 corrections (see writePackets below): every native packet a message stands for is its own record (count and bytes); chunk data is the real
// Deflater(-1) length of the native section layout (net-native-bytes.js, executed byte for byte); ItemStack tags count their gzip bytes; kicks count as S40.
export const varIntSize = (n) => { n >>>= 0; let s = 1; while (n >= 0x80) { n >>>= 7; s++; } return s; };
const utf8Length = (s) => { let n = 0; for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); if (c < 0x80) n++; else if (c < 0x800) n += 2; else if (c >= 0xd800 && c < 0xdc00 && i + 1 < s.length) { n += 4; i++; } else n += 3; } return n; };
/** et.a(String): a VarInt length and the UTF-8 bytes. */
export const stringSize = (s) => { const n = utf8Length(String(s ?? '')); return varIntSize(n) + n; };
// IChatComponent.Serializer of a plain text component: a JSON string, with Gson's html-safe escapes (6 bytes each instead of 1).
const textJson = (t) => { const s = JSON.stringify(String(t ?? '')); let extra = 0; for (let i = 0; i < s.length; i++) if ('<>&=\'  '.includes(s[i])) extra += 5; return utf8Length(s) + extra; };
const jsonString = (len) => varIntSize(len) + len;
const list = (v) => (Array.isArray(v) ? v : []);
const itemSize = (s) => (s ? 5 + itemTagBytes(s) : 2); // et.a(add): short -1 for an empty slot; else short id, byte count, short damage, then the tag (short -1, or short length + gzip; b89 console89)
/** Frame bytes of the native packets, by id (PLAY), with the payload's variable parts zero/empty: the executed "base" rows, except S23 (35): the base row's null block wrote a 5-byte VarInt -1, so 12 is the one-byte form. */
export const PLAY_FRAME = {
  serverbound: { 0: 5, 1: 2, 2: 6, 3: 2, 4: 34, 5: 10, 6: 42, 7: 12, 8: 16, 9: 3, 10: 6, 11: 10, 12: 11, 13: 2, 14: 10, 15: 5, 16: 5, 17: 3, 18: 15, 19: 10, 20: 2, 21: 7, 22: 2, 23: 4 },
  clientbound: { 0: 5, 1: 17, 2: 4, 3: 17, 4: 9, 5: 13, 6: 11, 7: 15, 8: 34, 9: 2, 10: 14, 11: 3, 12: 58, 13: 9, 14: 21, 15: 25, 16: 19, 17: 16, 18: 11, 19: 2, 20: 5, 21: 8, 22: 7, 23: 10, 24: 19,
    25: 6, 26: 6, 27: 10, 28: 6, 29: 9, 30: 6, 31: 9, 32: 9, 33: 18, 34: 15, 35: 12, 36: 15, 37: 15, 38: 8, 39: 33, 40: 19, 41: 19, 42: 34, 43: 6, 44: 15, 45: 6, 46: 2, 47: 6, 48: 4, 49: 6,
    50: 5, 51: 15, 52: 4, 53: 38, 54: 13, 55: 2, 56: 5, 57: 10, 58: 2, 59: 4, 60: 8, 61: 3, 62: 9, 63: 4, 64: 4 },
};
const C = PLAY_FRAME.clientbound, SV = PLAY_FRAME.serverbound;
const s02 = (jsonLength) => 1 + jsonString(jsonLength);
const s23 = (c) => 11 + varIntSize(Array.isArray(c) ? toOriginal(c[3] | 0, 0)?.[0] ?? 0 : 0); // b90 console90: the native id's VarInt (the port's id differs); // int x, byte y, int z, VarInt block, byte meta
// b89 console89: PlayerInstance (mr.b) sends each chunk's changed cells on their own: S23 for one, S22 for 2 to 63 (64 and up became an S21 in `chunks`, splitChanges).
const cellRecords = (changes) => { const by = new Map(); for (const c of list(changes)) { const k = Array.isArray(c) ? `${c[0] >> 4},${c[2] >> 4}` : ''; const g = by.get(k); if (g) g.push(c); else by.set(k, [c]); } return [...by.values()].map((g) => (g.length === 1 ? [35, s23(g[0])] : [34, C[34] + 4 * g.length])); };
// b89 console89: chunk data is the Deflater(-1) length of the native layout (net-native-bytes.js). `ctx.chunks` is the receiving player's world ({ height, light, biomes,
// hasSky }); without it the light is estimated. A column (or S26 column list) keeps its length, so a message sent to several players deflates once.
const deflated = new WeakMap();
const memo = (o, key, f) => { if (!o || typeof o !== 'object') return f(); let m = deflated.get(o); if (!m) deflated.set(o, (m = new Map())); if (!m.has(key)) m.set(key, f()); return m.get(key); };
const s21 = (c, ctx, full, mask) => C[33] + memo(c, `${full}:${mask}`, () => columnsDeflated([c], ctx?.chunks, { full, mask })); // S21: int x, int z, bool, short, short, int length, data
const unload = (c, ctx) => s21({ x: Array.isArray(c) ? c[0] : c?.x, z: Array.isArray(c) ? c[1] : c?.z, runs: [] }, ctx, true, 0); // S21 (full, mask 0): only the 256 biome bytes
const s26 = (cs, ctx) => C[38] + 12 * cs.length + memo(cs, 'bulk', () => columnsDeflated(cs, ctx?.chunks, { full: true, mask: 0xffff })); // S26: short, int, bool, data (one deflate), then int x, int z, short, short a column
const bulks = (columns, ctx) => { const cs = list(columns); if (cs.length <= 5) return cs.length ? [[38, s26(cs, ctx)]] : []; const out = []; for (let i = 0; i < cs.length; i += 5) out.push([38, s26(cs.slice(i, i + 5), ctx)]); return out; }; // gz.c() = 5 columns a packet
const s13 = (n) => (n ? C[19] + 4 * n : 0); // byte count, int ids
/**
 * b94 console94: one S13 per connection and player tick. `ctx.destroyed = { n, next }` is the player's destroyedItemsNetCache: `n` are ids the port already held a tick (mobs, items, thrown
 * rows, a cart that left the 4-block re-check), due in this tick's drain; `next` are ids of an immediate removal (TNT, fireball and golem rows, a dead cart or boat), due one drain later.
 * Without a queue the ids count at once, one S13 per kind as before.
 */
const queueDestroys = (ctx, n, late) => { if (!n) return []; const q = ctx?.destroyed; if (!q) return [[19, s13(n)]]; if (late) q.n = (q.n | 0) + n; else q.next = (q.next | 0) + n; return []; };
// b90 console90: the entity tracker's packets by their own native id. The fixed sizes are the executed "base" rows (S15 8, S16 7, S17 10, S18 19, S19 6, S12 11, S1D 9);
// S0F and the first S1C carry the mob class's whole DataWatcher (MOB_WATCHER: entry bytes plus the 127 end byte, executed per class by tools/probes/Console90Probe.java:
// S0F = 24 + that, S1C = 5 + that); a later S1C writes only the changed entries; S04 holds an ItemStack; S20 rows are bytecode-read (il.b: string, double, short, 25 per modifier).
const MOB_RECORD = { spawn: 15, destroy: 19, attach: 27, mobStatus: 26, state: 24, move: 21, look: 22, moveLook: 23, teleport: 24, head: 25, velocity: 18, meta: 28, equipment: 4, effect: 29, attributes: 32 };
/** The port's mob type -> the 1.7.10 entity id string of the class whose DataWatcher it carries. */
const NATIVE_MOB = { enderman: 'Enderman', pig: 'Pig', cow: 'Cow', mooshroom: 'MushroomCow', snow_golem: 'SnowMan', sheep: 'Sheep', chicken: 'Chicken', wolf: 'Wolf', ocelot: 'Ozelot', horse: 'EntityHorse', zombie: 'Zombie', skeleton: 'Skeleton', wither_skeleton: 'Skeleton', spider: 'Spider', cave_spider: 'CaveSpider', caveSpider: 'CaveSpider', creeper: 'Creeper', villager: 'Villager', silverfish: 'Silverfish', witch: 'Witch', slime: 'Slime', magma_cube: 'LavaSlime', pigman: 'PigZombie', iron_golem: 'VillagerGolem', squid: 'Squid', bat: 'Bat', blaze: 'Blaze', ghast: 'Ghast', wither: 'WitherBoss', ender_dragon: 'EnderDragon', giant: 'Giant' };
/** Executed (public/research/console90-reference.json): the bytes of each living class's DataWatcher entries plus the 127 end byte, as a fresh entity writes them. */
export const MOB_WATCHER = { Bat: 26, Blaze: 26, CaveSpider: 26, Chicken: 29, Cow: 29, Creeper: 30, EnderDragon: 24, Enderman: 30, EntityHorse: 48, Ghast: 26, Giant: 24, LavaSlime: 26, MushroomCow: 29, Ozelot: 35, Pig: 31, PigZombie: 30, Sheep: 31, Silverfish: 24, Skeleton: 26, Slime: 26, SnowMan: 24, Spider: 26, Squid: 24, Villager: 34, VillagerGolem: 26, Witch: 26, WitherBoss: 44, Wolf: 42, Zombie: 30 };
const watcherOf = (type) => MOB_WATCHER[NATIVE_MOB[type]];
// Watched entries one S1C change writes: header byte plus value (byte 1, short 2, int 4, float 4), by the port's meta key; the flags byte (invisible, burning) is one entry.
const META_ENTRY = { potion: 5, ambient: 2, air: 3, screaming: 2, invul: 5, health: 5, batHanging: 2, horseFlags: 5 };
const metaBytes = (p) => { let n = 1; for (const k of Object.keys(p ?? {})) if (k in META_ENTRY) n += META_ENTRY[k]; if (p && ('invisible' in p || 'burning' in p)) n += 2; return n; };
const attributesBytes = (p) => C[32] + list(p?.list).reduce((n, r) => n + stringSize(r?.name ?? '') + 10 + 25 * list(r?.mods).length, 0);
// b91 console91: `ctx.watch` ({ mob(i) -> the live mob, memory: Map i -> watchState }, per receiving player) lets the count see what the port's packets do not carry: the owner string and
// name tag in the S0F and the first S1C, and one S1C with the changed native keys (health, age, tame flags, colour, ...) when a message carries a packet of the mob (net-watch-bytes.js).
/**
 * b92 console92: EntityTrackerEntry.sendLocationToAllClients runs its S1C (func_111190_b's watcher branch) whenever the DataWatcher has changes, on any tick, not only when a position
 * packet goes out. `watch` is the receiving connection's ctx.watch; each remembered mob whose native entries differ from what was last counted is one S1C (id, int, the entries, end
 * byte). Called once a tick after the mobs message, so a mob that is standing still (or whose packets were all dropped) is counted on the native schedule.
 */
export const watchSweep = (watch) => {
  const out = [];
  if (!watch) return out;
  for (const [i, last] of watch.memory) {
    const live = watch.mob(i);
    if (!live) continue;
    const now = watch.state ? watch.state(i, live) : watchState(live), n = watchDiff(last, now);
    watch.memory.set(i, now);
    if (n) out.push([28, C[28] - 1 + 1 + n]);
  }
  return out;
};
const GATED = new Set(['move', 'look', 'moveLook', 'teleport', 'head', 'meta', 'velocity']);
const mobRecords = (packets, ctx) => {
  const out = [], watch = ctx?.watch; let destroys = 0, type = null, fresh = false, extra = 0;
  const diffed = new Set();
  for (const p of list(packets)) {
    const k = p?.type ?? p?.k;
    if (k === 'destroy') { destroys++; watch?.memory.delete(p.i); continue; }
    const id = MOB_RECORD[k] ?? 24;
    if (k !== 'spawn' && k !== 'meta') fresh = false;
    let bytes = C[id];
    if (k === 'spawn') {
      type = p?.mob; fresh = true; extra = 0;
      const live = watch?.mob(p.i);
      if (live) { const st = watchState(live); watch.memory.set(p.i, st); extra = stringExtra(st); }
      const w = watcherOf(type); if (w !== undefined) bytes = C[15] - 1 + w + extra;
    }
    else if (k === 'meta') { const w = fresh ? watcherOf(type) : undefined; bytes = w !== undefined ? C[28] - 1 + w + extra : C[28] - 1 + metaBytes(p); fresh = false; } // the S1C after a spawn is the whole DataWatcher
    else if (k === 'equipment') bytes = C[4] - 2 + itemSize(p?.item);
    else if (k === 'attributes') bytes = attributesBytes(p);
    out.push([id, bytes]);
    if (watch && GATED.has(k) && !diffed.has(p.i)) { // the changed native keys of this mob, one S1C (after its first packet of the message)
      diffed.add(p.i);
      const last = watch.memory.get(p.i), live = last && watch.mob(p.i);
      if (live) { const now = watchState(live), n = watchDiff(last, now); watch.memory.set(p.i, now); if (n) out.push([28, C[28] - 1 + 1 + n]); }
    }
  }
  out.push(...queueDestroys(ctx, destroys, true));
  return out;
}; // the tick's destroyed ids go in one S13

// b91 console91: object tracker rows `{ i, k, p: [packets] }` (the `itrack` rows of the tick message: items and orbs; `trk` of dispEnts: falling blocks, arrows, thrown entities,
// hooks, rockets, eyes). The entry's own choice stays: a packet counts under the id of its kind (S0E / S11, S1C, S12, S15, S16, S17, S18, S13), not S18. The S0E carries three motion
// shorts (6 bytes) only when its data is above 0 (EntityTrackerEntry.func_151260_c: fw(sa, int, int), bytecode-read b84); an S1C row is its watcher list as te.a(List, et) writes it.
const POSITION = { move: [21, C[21]], look: [22, C[22]], moveLook: [23, C[23]], teleport: [24, C[24]], velocity: [18, C[18]] }; // S15, S16, S17, S18 and the S12, by their own ids
const ENTRY_BYTES = [2, 3, 5, 5, null, null, 13]; // DataWatcher value type -> header + value bytes (4 string and 5 ItemStack are variable)
const entryBytes = (e) => { const t = e?.[0] | 0; return t === 4 ? 1 + stringSize(e[2] ?? '') : t === 5 ? 1 + itemSize(e[2]) : ENTRY_BYTES[t] ?? 2; };
const objectPacket = (p) => {
  const k = p?.type ?? p?.k;
  if (k === 'spawn') return p.orb || p.k === 'orb' ? [17, C[17]] : [14, C[14] + (p.data > 0 ? 6 : 0)];
  if (k === 'meta') return [28, C[28] - 1 + 1 + list(p.list).reduce((n, e) => n + entryBytes(e), 0)];
  return POSITION[k] ?? null;
};
const objectRecords = (rows, ctx) => {
  const out = []; let destroys = 0;
  for (const r of list(rows)) for (const p of list(r?.p)) { if ((p?.type ?? p?.k) === 'destroy') { destroys++; continue; } const o = objectPacket(p); if (o) out.push(o); }
  out.push(...queueDestroys(ctx, destroys, true));
  return out;
};
// b91 console91: a cart or boat row of `vehicles`. server-cart-track.js records which packets the entry released for the row (vehicleInfo: position kinds, the S12, a join's S0E,
// the S0E's data); a row it knows nothing about keeps counting one S18.
const vehicleRecords = (row) => {
  const info = vehicleInfo(row);
  if (!info) return [[24, C[24]]];
  const out = [];
  if (info.join) { out.push([14, C[14] + (info.data > 0 ? 6 : 0)]); if (info.watch) out.push([28, info.watch]); /* b92: the S1C of the whole watcher (my.b(mw): after the S0E, before the S12) */ if (info.velocity) out.push([18, C[18]]); }
  if (info.strings) out.push([28, C[28] - 1 + 1 + info.strings]); // b93 console93: the command cart's changed watcher strings (23, 24)
  for (const k of info.kinds) if (POSITION[k]) out.push(POSITION[k]);
  if (!out.length) out.push([28, C[28] - 1 + 1 + 5]); // only a watched field changed (hit, damage, display, lit, fuse): one int entry
  return out;
};
/** b92 console92: the records of the tracker packet kinds an entry released (strings, or { type }); a 'meta' is an S1C of one byte entry (the burning flag); b93: { type: 'strings', bytes } an S1C of changed string entries. Used for carts a viewer holds whose row did not change. */
export const kindRecords = (kinds) => { const out = []; for (const p of list(kinds)) { const k = typeof p === 'string' ? p : p?.type; if (k === 'meta') out.push([28, C[28] - 1 + 1 + 2]); else if (k === 'strings') out.push([28, C[28] - 1 + 1 + (p.bytes | 0)]); else if (POSITION[k]) out.push(POSITION[k]); } return out; };
// b92 console92: the `ents` rows of dispEnts (primed TNT, fireballs, skulls, a golem's snowball) are the port's per-tick snapshot; natively each is ONE entity the tracker spawns once (S0E, then the
// whole-watcher S1C, then an S12 when the entry sends velocity) and moves with S15 / S16 / S17 / S18 / S12 / S1C packets at its own cadence (EntityTrackerEntry), and its S13 when it leaves.
// `ctx.objs` (per connection) remembers which rows the viewer holds; a row's info (net-row-info.js) names its S0E data, velocity flag and S1C size, and its tick's packet kinds come from the
// ball's own tracker packets (`t.p`, fireball-copy.js; an S17 is the row's 'move' carrying angle bytes) or the TNT's entry (info.kinds). Without ctx.objs a row counts one S0E per message.
const ballKinds = (t) => list(t?.p).map((p) => (p?.type === 'move' && p.yb !== undefined ? 'moveLook' : p?.type));
const dispEntRecords = (m, ctx) => {
  const rows = list(m.ents), mem = ctx?.objs;
  if (!mem) return rows.map(() => [14, C[14]]);
  const out = [], seen = new Set();
  let gone = 0;
  for (const r of rows) {
    const key = `${r?.k}:${r?.i}`, info = rowInfo(r) ?? {};
    seen.add(key);
    if (!mem.has(key)) { mem.set(key, true); out.push([14, C[14] + (info.data > 0 ? 6 : 0)], [28, info.watch ?? 11]); if (info.velocity) out.push([18, C[18]]); }
    out.push(...kindRecords(info.kinds ?? ballKinds(r?.t)));
  }
  for (const key of [...mem.keys()]) if (!seen.has(key)) { mem.delete(key); gone++; }
  out.push(...queueDestroys(ctx, gone, false)); // b93 console93: EntityPlayerMP.func_152339_d queues the id; the next onUpdate sends it
  return out;
};
/**
 * b95 console95: another player's entity is the one removal that is NOT queued. EntityPlayerMP.func_152339_d (mw.d) sends `new S13(id)` through the connection at once for a
 * player entity (instanceof EntityPlayer) and only adds other ids to destroyedItemsNetCache (executed, console95-reference.json: one packet of 6 bytes, nothing queued; the same
 * call for a pig queues the id and sends nothing). So a tracked player who leaves the viewer's tracked set (out of range, another dimension, disconnect) costs one 6 byte S13 each,
 * counted in the tick message that stops carrying his full row, never through `ctx.destroyed`. `ctx.peers` is the connection's set of tracked player ids; without it nothing is counted.
 * b96 console96: a player who ENTERS the set costs what EntityTrackerEntry.b(mw) sends (executed, console96-reference.json, tools/probes/Console96Probe.java): S0C (87 + the entity id
 * VarInt + the name string, with no profile properties; 32 of it the whole DataWatcher), the whole-watcher S1C (37), S20 (69, +25 for the sprint modifier), the S1B attach of a rider,
 * S04 for a held item (the armour S04s follow, from the row field `arm` (b97)), S0A for a sleeper and S1D for the invisibility effect, in that native order.
 */
const S0C_FIXED = 87, S1C_WHOLE = 37, S20_PLAYER = 69, S20_SPRINT = 25; // executed: S0C = 87 + VarInt(id) + stringSize(name) for id 0 / name "A" = 90
const spawnRecords = (p) => [[12, S0C_FIXED + varIntSize(p.id | 0) + stringSize(p.name ?? '') + profilePropertyBytes(p)], [28, S1C_WHOLE], [32, S20_PLAYER + S20_SPRINT * (p.am ?? (p.sprinting ? 1 : 0))],
  ...(p.riding !== undefined && p.riding !== null ? [[27, C[27]]] : []), ...(p.held?.id ? [[4, C[4] - 2 + itemSize(p.held)]] : []), ...list(p.arm).map((a) => [4, C[4] - 2 + itemSize(a)]), ...(p.sleep ? [[10, C[10]]] : []),
  ...(p.fxn !== undefined ? Array.from({ length: p.fxn }, () => [29, C[29]]) : p.invisible ? [[29, C[29]]] : [])]; // b97: armour S04s after the held one; one S1D per active effect
const peerRemovals = (m, ctx) => {
  const mem = ctx?.peers; if (!mem || !Array.isArray(m.players)) return [];
  const rows = m.players.filter((p) => p && p.id !== ctx.self && !p.far), now = new Set(rows.map((p) => p.id)), out = [];
  for (const id of [...mem]) if (!now.has(id)) { mem.delete(id); out.push([19, s13(1)]); }
  for (const p of rows) if (!mem.has(p.id)) { mem.add(p.id); out.push(...spawnRecords(p)); }
  return out;
};
/**
 * b96 console96: what a tracked player's entry sends each tick. EntityTrackerEntry.a(List) (sendLocationToAllClients) sends nothing on an off beat tick (frequency 2, unless
 * airborne or the watcher changed) and else one position packet (S15 / S16 / S17, S18 on a 400 tick resync or a delta past a byte), an S19 head packet, an S1B on the 60th tick of a ride.
 * ServerPlayerTracker keeps the shared entry's packets of the tick and the viewers' rows carry the kinds as `pk`; a tracked row counts those. A row without `pk` (a caller that
 * bypasses the tracker) keeps the old one S18 per tick.
 */
const PLAYER_KIND = { move: 21, look: 22, moveLook: 23, teleport: 24, head: 25, attach: 27, velocity: 18 };
const playerPackets = (p) => [...(p.swing === 6 ? [[11, 2 + varIntSize(p.id | 0)]] : []), ...(!Array.isArray(p.pk) ? [[24, C[24]]] : p.pk.filter((k) => PLAYER_KIND[k] !== undefined).map((k) => [PLAYER_KIND[k], C[PLAYER_KIND[k]]])), ...list(p.pw), ...(p.vel || p.velSent ? [[18, C[18]]] : [])]; // b100 console100: first the S0B(0) of EntityLivingBase.swingItem (sv.ba: mn.a(entity, S0B) to every tracker but the swinger, in packet handling before the tracker pass; the port's `swing` is 6 on the tick a swing was accepted, 5 and down after);
// b97: then the S1C / S20 of EntityTrackerEntry.b(); b100 console100: then the S12 of Entity.velocityChanged (my.a(List) ends with it, my.b(ft) sends it to every tracker, 11 bytes executed)
/**
 * b93 console93: the S13s a connection queued (`ctx.destroyed = { n }`, the player's destroyedItemsNetCache) go out in the player's next onUpdate (mw.h): the ids in packets of at most 127
 * (`Math.min(size, 127)`, the loop repeats until the list is empty), bytecode-read. Returns the records and empties the queue.
 */
export const drainDestroyed = (q) => {
  const out = [];
  while (q && q.n > 0) { const k = Math.min(q.n, 127); out.push([19, s13(k)]); q.n -= k; }
  if (q) { q.n = q.next | 0; q.next = 0; } // b94 console94: what the tick's immediate removals queued is due at the next drain
  return out;
};
const sbPacket = (p) => { let n = C[SB_PACKET[p?.type ?? p?.k] ?? 59]; for (const [k, v] of Object.entries(p ?? {})) if (k !== 'type' && k !== 'k') { if (typeof v === 'string') n += stringSize(v) - 1; else if (Array.isArray(v)) n += v.reduce((a, s) => a + stringSize(s), 0); } return n; };
const payload = (channel, data) => 1 + stringSize(channel) + 2 + data; // C17/S3F: string channel, short length, data
const CLIENT_BYTES = {
  pingKeepAlive: C[0], pingProbeReply: 9, abilities: C[57],
  pingStatusReply: (m) => 1 + jsonString(utf8Length(JSON.stringify({ description: m.description, players: m.players, version: m.version, ...(m.favicon ? { favicon: m.favicon } : {}) }))), // S00ServerInfo
  chat: (m) => s02(typeof m.json === 'string' ? utf8Length(m.json) : textJson(m.text)), sleepMsg: (m) => s02(utf8Length(JSON.stringify({ translate: `tile.bed.${m.key ?? ''}` }))),
  health: C[6], sleepIn: C[10],
  // b100 console100: S0B writes the entity id as a VarInt then one byte (executed, console100-reference.json: 3 / 4 / 5 for ids 1 / 200 / 70000); the wake-up is the player's own id, a crit's target is a player id (`pl`) or a mob (flat, the port's mob ids are not the native ones)
  sleepWake: (m, ctx) => 2 + varIntSize(ctx?.self | 0), pfx73: (m) => 2 + varIntSize(list(m.events)[0]?.pl | 0),
  collect: C[13], projCollect: C[13],
  healthHurt: C[26], useDone: C[26], mobStatus: C[26], attach: C[27], effect: C[29], healthEffect: C[29], healthEffectEnd: C[30], playerOp: C[31],
  musicEvent: C[36],
  dragonCredits: C[43], boltSpawn: C[44],
  openWindow: (m) => C[45] - 1 + stringSize(m.title ?? '') + (m.kind === 'horse' ? 4 : 0), // S2D: byte, byte, string title, byte, bool (int entity for a horse)
  windowClose: C[46],
  setSlot: (m) => C[47] - 2 + itemSize(m.item), invSet: (m) => C[47] - 2 + itemSize(m.item ?? m.stack),
  windowProperty: C[49], confirmTransaction: C[50], invConfirm: C[50],
  mapData: (m) => list(m.maps).reduce((n, x) => n + C[52] - 1 + varIntSize(x?.id | 0) + list(x?.b).length, 0), // S34: VarInt id, short length, bytes
  signEditor: C[54],
  stats: (m) => { const e = Object.entries(m.stats ?? {}); return 1 + varIntSize(e.length) + e.reduce((n, [k, v]) => n + stringSize(k) + varIntSize(v | 0), 0); }, // S37: VarInt count, (string, VarInt) each
  tabReply: (m) => { const o = list(m.options); return 1 + varIntSize(o.length) + o.reduce((n, s) => n + stringSize(s), 0); },
  tradeList: (m) => payload('MC|TrList', 4 + 1 + list(m.offers).reduce((n, o) => n + itemSize(o?.buy ?? o?.a) + itemSize(o?.sell ?? o?.c) + 1 + ((o?.buy2 ?? o?.b) ? itemSize(o.buy2 ?? o.b) : 0) + 1, 0)), // int window, byte count, offers
  error: (m) => 1 + jsonString(textJson(m.text)), // S40: the reason component
};
const SERVER_BYTES = {
  pingProbe: 9, pingKeepAliveAck: SV[0],
  chat: (m) => 1 + stringSize(m.text ?? ''), input: SV[6],
  attack: SV[2], attackPlayer: SV[2], animUse: SV[2], vehUse: SV[2], vehHit: SV[2], dig: SV[7], achDrop: SV[7],
  edit: (m) => (m.place ? SV[8] : SV[7]), use: (m) => (m.active ? SV[8] : SV[7]),
  sleepLeave: SV[11], horseJump: SV[11], horseInventory: SV[11], invClose: SV[13], closeWindow: SV[13],
  invClick: (m) => SV[14] - 2 + itemSize(m.item), clickWindow: (m) => SV[14] - 2 + itemSize(m.item), beaconPayment: SV[14],
  invAck: SV[15], confirmTransaction: SV[15], invCreative: (m) => SV[16] - 2 + itemSize(m.item), stationEnchant: SV[17],
  sign: (m) => { const t = Array.isArray(m.text) ? m.text : String(m.text ?? '').split('\n'); return 1 + 10 + [0, 1, 2, 3].reduce((n, i) => n + stringSize(t[i] ?? ''), 0); }, // C12: int, short, int, four strings
  tabReq: (m) => 1 + stringSize(m.text ?? ''), settingsClient: (m) => SV[21] - 1 + stringSize(m.language ?? 'en_US'), capeSettings: (m) => SV[21] - 1 + stringSize(m.language ?? 'en_US'),
  respawn: SV[22], requestStats: SV[22], openInventory: SV[22],
  vehCmd: (m) => payload('MC|AdvCdm', 1 + 4 + stringSize(m.command ?? '')), blockCmd: (m) => payload('MC|AdvCdm', 1 + 12 + stringSize(m.command ?? '')), // byte mode, then int x, y, z or int entity, string command
  bookEdit: (m) => payload('MC|BEdit', itemSize(true)), bookSign: (m) => payload('MC|BSign', itemSize(true)), beacon: payload('MC|Beacon', 8), tradeSelect: payload('MC|TrSel', 4),
  stationItemName: (m) => payload('MC|ItemName', utf8Length(String(m.name ?? ''))),
};
// b89 console89: the messages that stand for several native packets, as one record per packet ([id, bytes]); every other counted message is one record.
const each = (id, xs, f) => list(xs).map((x) => [id, f(x)]);
const s30 = (slots) => C[48] + slots.reduce((n, s) => n + itemSize(s), 0), cursor = (s) => [47, C[47] - 2 + itemSize(s)]; // S30, then the cursor's S2F (window -1)
const CLIENT_PACKETS = {
  welcome: (m, ctx) => [[1, C[1]] /* S01 with WorldType "default" (the base row's static instance) */, [57, C[57]] /* b100 abilities100: S39 after S05, from initializeConnectionToPlayer */, ...bulks(m.world?.columns, ctx)],
  dimRespawn: (m, ctx) => [[7, C[7]], ...bulks(m.world?.columns, ctx)],
  // S03 every 20 ticks (MinecraftServer.v: tickCounter % 20; `ctx.tick` is the server's counter, from 0 at launch, else the world's tick count); an S18 per pose of another
  // player (the tracker sends nobody their own); the cells; the S21 resends (partial, the changed sections)
  tick: (m, ctx) => { const t = ctx?.tick ?? m.tick; return [...(Number.isInteger(t) && t % 20 === 0 ? [[3, C[3]]] : []), ...peerRemovals(m, ctx), ...list(m.players).filter((p) => !p?.far && (ctx?.self === undefined || p?.id !== ctx.self)).flatMap(playerPackets), ...list(m.players).filter((p) => ctx?.self !== undefined && p?.id === ctx.self).flatMap((p) => [...list(p.pw), ...(p.vel ? [[18, C[18]]] : [])]), // b100: the player's own S12 (my.b(ft) sends to the entity's own connection too)
    ...cellRecords(m.changes), ...objectRecords(m.itrack, ctx), ...list(m.chunks).map((c) => [33, s21(c, ctx, false, Number.isInteger(c?.mask) ? c.mask : 0xffff)])]; },
  dismount: () => [[8, C[8]], [27, C[27]], [8, C[8]]], // b98 horse98: yz.a(sa)'s S08 (setPlayerLocation), hx's S1B(0, player, -1), then mw.a(sa)'s own S08
  blocks: (m) => cellRecords(m.changes),
  chunkUnload: (m, ctx) => list(m.columns).map((c) => [33, unload(c, ctx)]),
  chunkBulk: (m, ctx) => bulks(m.columns, ctx),
  mobs: (m, ctx) => mobRecords(m.packets, ctx),
  vehicles: (m, ctx) => [...list(m.set).flatMap(vehicleRecords), ...queueDestroys(ctx, list(m.del).length - (m.delLate | 0), false), ...queueDestroys(ctx, m.delLate | 0, true)], // b94 console94: `delLate` ids of `del` had waited a tick already
  dispEnts: (m, ctx) => [...dispEntRecords(m, ctx), ...objectRecords(m.trk, ctx)], fishHooks: (m) => each(14, m.hooks, () => C[14] + 6), // S0E (a hook's data is its angler: three shorts follow)
  pistonTiles: (m) => each(36, m.events, () => C[36]), crack: (m) => each(37, m.cracks, () => C[37]), aux: (m) => each(40, m.events, () => C[40]),
  sound: (m) => each(41, m.sounds, (s) => C[41] - 1 + stringSize(s?.name ?? s?.n ?? s?.sound ?? '')), // S29: string name, int x, y, z, float volume, byte pitch
  dispFx: (m) => each(42, m.events, (e) => C[42] - 1 + stringSize(e?.n ?? e?.name ?? '')), fishFx: (m) => each(42, m.events, (e) => C[42] - 1 + stringSize(e?.n ?? '')), // S2A: string name, 7 floats, int
  slot: (m) => each(47, m.slots, (s) => C[47] - 2 + itemSize(Array.isArray(s) ? s[1] : s?.item ?? s?.stack)),
  windowItems: (m) => [[48, s30(list(m.slots))], cursor(m.cursor)],
  invItems: (m) => [[48, s30([...list(m.main), ...list(m.armor), ...list(m.grid)]) + itemSize(m.result)], cursor(m.cursor)],
  beaconWindow: () => [[45, C[45]], [49, C[49]], [49, C[49]], [49, C[49]]], // S2D, then the beacon's three S31
  pingList: (m) => each(56, m.items, (i) => C[56] - 1 + stringSize(i?.name ?? '')), // S38: string, bool, short
  sb: (m) => list(m.packets).map((p) => [SB_PACKET[p?.type ?? p?.k] ?? 59, sbPacket(p)]),
};
const SERVER_PACKETS = {
  join: (m) => [[0, 5 + stringSize(m.host ?? '')], [0, 1 + stringSize(m.name ?? '')]], // C00Handshake (VarInt protocol, string host, short port, VarInt state), C00PacketLoginStart (string name)
  pingStatus: (m) => [[0, 5 + stringSize(m.host ?? '')], [0, 1]], // the status connection's C00Handshake (next state 1), then C00PacketServerQuery
};
const recordsOf = (bundles, table, ids, m, ctx) => {
  const id = lookup(ids, m); if (id === null) return null;
  if (Object.hasOwn(bundles, m.type)) return bundles[m.type](m, ctx);
  const v = table[m.type]; return [[id, typeof v === 'function' ? v(m, ctx) : v]];
};
const sum = (records) => (records === null ? null : records.reduce((n, r) => n + r[1], 0));
/** The native packets a message read from a client stands for, as [id, bytes] records (what ez passes to eu.a for each), or null when it is not counted. */
export const readPackets = (m, ctx) => recordsOf(SERVER_PACKETS, SERVER_BYTES, SERVERBOUND, m, ctx);
/** The native packets a message sent to a client stands for, as [id, bytes] records (what fa passes to eu.b for each), or null when it is not counted. `ctx`: { self, chunks }. */
export const writePackets = (m, ctx) => recordsOf(CLIENT_PACKETS, CLIENT_BYTES, CLIENTBOUND, m, ctx);
/** The S40 a kick sends (NetHandlerPlayServer.c(String): new S40PacketDisconnect(new ChatComponentText(reason))). */
export const kickPacket = (reason) => [64, 1 + jsonString(textJson(reason))];
/** The native frame bytes (id VarInt + payload) of a message read from a client, summed over its packets, or null when it is not counted. */
export const readPacketBytes = (m, ctx) => sum(readPackets(m, ctx));
/** The native frame bytes of the packets a message sent to a client stands for, summed, or null when it is not counted. */
export const writePacketBytes = (m, ctx) => sum(writePackets(m, ctx));
