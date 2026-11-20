// Batch 87 offline87: the native packet id of each WebSocket message kind, for /netstat (NetworkStatistics).
//
// Evidence (executed, tools/probes/Offline87Probe.java -> public/research/offline87-reference.json): EnumConnectionState (eo) of the unchanged 1.7.10 classes, its four states
// and both packet maps. The netty decoder (ez) and encoder (fa) record (id, frame bytes) in the server's one NetworkStatistics for every state (bytecode-read), so the
// handshake, status and login ids land in the same 100 slots as the play ids (a status ping counts under 0 and 1 with KeepAlive and Chat). An id the state does not
// register is never counted: ez throws "Bad packet id" before eu.a, and fa throws "Can't serialize unregistered packet" before eu.b.
//
// Port choices (port-read): a port message is one record, under the id of the native packet it stands for. Messages that bundle several native packets (the `tick`
// message: S03 time, S22/S23 cells, the players' poses, S2B weather) count once, under the id named below. Bytes are the JSON text's UTF-8 length (natively: the packet
// id VarInt and payload). Port-only messages with no native packet (a client pickup claim, the client's own inventory copy, a server error line ...) return null:
// /netstat does not count them, as a native server never sends or reads them.
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
  sleepIn: 10, // S0APacketUseBed
  sleepWake: 11, pfx73: 11, // S0BPacketAnimation (2 wake up, 4/5 critical hits)
  collect: 13, projCollect: 13, // S0DPacketCollectItem
  dispEnts: 14, fishHooks: 14, // S0EPacketSpawnObject
  mobs: (m) => firstOf(m.packets, MOB_PACKET, 20), // the entity tracker's S0F / S13 / S1B / S19 / poses, under its first packet
  vehicles: (m) => (m.set?.length ? 24 : 19), // S18 poses, or only S13 destroys
  tick: 24, // S18PacketEntityTeleport: each tick's absolute player poses (with the bundled S03, S22/S23 and weather)
  healthHurt: 26, useDone: 26, mobStatus: 26, // S19PacketEntityStatus (2 hurt, 3 dead, 9 item use finished)
  attach: 27, // S1BPacketEntityAttach
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
export const varIntSize = (n) => { n >>>= 0; let s = 1; while (n >= 0x80) { n >>>= 7; s++; } return s; };
const utf8Length = (s) => { let n = 0; for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); if (c < 0x80) n++; else if (c < 0x800) n += 2; else if (c >= 0xd800 && c < 0xdc00 && i + 1 < s.length) { n += 4; i++; } else n += 3; } return n; };
/** et.a(String): a VarInt length and the UTF-8 bytes. */
export const stringSize = (s) => { const n = utf8Length(String(s ?? '')); return varIntSize(n) + n; };
// IChatComponent.Serializer of a plain text component: a JSON string, with Gson's html-safe escapes (6 bytes each instead of 1).
const textJson = (t) => { const s = JSON.stringify(String(t ?? '')); let extra = 0; for (let i = 0; i < s.length; i++) if ('<>&=\'  '.includes(s[i])) extra += 5; return utf8Length(s) + extra; };
const jsonString = (len) => varIntSize(len) + len;
const list = (v) => (Array.isArray(v) ? v : []);
const itemSize = (s) => (s ? 7 : 2); // et.a(add): short -1 for an empty slot; else short id, byte count, short damage, short -1 (no tag)
const runsSize = (c) => { let n = 0; for (const v of list(c?.runs)) n += varIntSize(v); return n; }; // proxy for the deflated section data
/** Frame bytes of the native packets, by id (PLAY), with the payload's variable parts zero/empty: the executed "base" rows, except S23 (35): the base row's null block wrote a 5-byte VarInt -1, so 12 is the one-byte form. */
export const PLAY_FRAME = {
  serverbound: { 0: 5, 1: 2, 2: 6, 3: 2, 4: 34, 5: 10, 6: 42, 7: 12, 8: 16, 9: 3, 10: 6, 11: 10, 12: 11, 13: 2, 14: 10, 15: 5, 16: 5, 17: 3, 18: 15, 19: 10, 20: 2, 21: 7, 22: 2, 23: 4 },
  clientbound: { 0: 5, 1: 17, 2: 4, 3: 17, 4: 9, 5: 13, 6: 11, 7: 15, 8: 34, 9: 2, 10: 14, 11: 3, 12: 58, 13: 9, 14: 21, 15: 25, 16: 19, 17: 16, 18: 11, 19: 2, 20: 5, 21: 8, 22: 7, 23: 10, 24: 19,
    25: 6, 26: 6, 27: 10, 28: 6, 29: 9, 30: 6, 31: 9, 32: 9, 33: 18, 34: 15, 35: 12, 36: 15, 37: 15, 38: 8, 39: 33, 40: 19, 41: 19, 42: 34, 43: 6, 44: 15, 45: 6, 46: 2, 47: 6, 48: 4, 49: 6,
    50: 5, 51: 15, 52: 4, 53: 38, 54: 13, 55: 2, 56: 5, 57: 10, 58: 2, 59: 4, 60: 8, 61: 3, 62: 9, 63: 4, 64: 4 },
};
const C = PLAY_FRAME.clientbound, SV = PLAY_FRAME.serverbound;
const s02 = (jsonLength) => 1 + jsonString(jsonLength);
const s23 = (c) => 11 + varIntSize(Array.isArray(c) ? c[3] | 0 : 0); // int x, byte y, int z, VarInt block, byte meta
const cells = (changes) => { const n = list(changes).length; return n === 0 ? 0 : n === 1 ? s23(changes[0]) : C[34] + 4 * n; }; // S22: int, int, short count, int length, 4 bytes a record
const s21 = (c) => C[33] + runsSize(c); // S21: int x, int z, bool, short, short, int length, data
const s26 = (columns) => { const cs = list(columns); return cs.length ? C[38] + cs.reduce((n, c) => n + 12 + runsSize(c), 0) : 0; }; // S26: short, int, bool, data, then int x, int z, short, short a column
const UNLOAD_BIOMES = 12; // S21 for an unload (mask 0, full chunk): the 256 biome bytes deflated at Deflater(-1); 12 bytes when they are one biome (executed sample: 30 bytes)
const s13 = (n) => (n ? C[19] + 4 * n : 0); // byte count, int ids
const mobPackets = (packets) => { let n = 0, destroys = 0; for (const p of list(packets)) { const k = p?.type ?? p?.k; if (k === 'destroy') destroys++; else n += C[MOB_PACKET[k] ?? 24]; } return n + s13(destroys); };
const sbPacket = (p) => { let n = C[SB_PACKET[p?.type ?? p?.k] ?? 59]; for (const [k, v] of Object.entries(p ?? {})) if (k !== 'type' && k !== 'k') { if (typeof v === 'string') n += stringSize(v) - 1; else if (Array.isArray(v)) n += v.reduce((a, s) => a + stringSize(s), 0); } return n; };
const payload = (channel, data) => 1 + stringSize(channel) + 2 + data; // C17/S3F: string channel, short length, data
const CLIENT_BYTES = {
  pingKeepAlive: C[0], pingProbeReply: 9,
  pingStatusReply: (m) => 1 + jsonString(utf8Length(JSON.stringify({ description: m.description, players: m.players, version: m.version, ...(m.favicon ? { favicon: m.favicon } : {}) }))), // S00ServerInfo
  welcome: (m) => C[1] + s26(m.world?.columns) /* S01 with WorldType "default" (the base row's static instance) */,
  chat: (m) => s02(typeof m.json === 'string' ? utf8Length(m.json) : textJson(m.text)), sleepMsg: (m) => s02(utf8Length(JSON.stringify({ translate: `tile.bed.${m.key ?? ''}` }))),
  health: C[6], dimRespawn: (m) => C[7] + s26(m.world?.columns), sleepIn: C[10], sleepWake: C[11], pfx73: C[11],
  collect: C[13], projCollect: C[13], dispEnts: (m) => list(m.ents).length * C[14], fishHooks: (m) => list(m.hooks).length * (C[14] + 6), // S0E (a hook's data is its angler: three shorts follow)
  mobs: (m) => mobPackets(m.packets), vehicles: (m) => list(m.set).length * C[24] + s13(list(m.del).length),
  tick: (m) => C[3] + list(m.players).length * C[24] + cells(m.changes) + list(m.chunks).reduce((n, c) => n + s21(c), 0),
  healthHurt: C[26], useDone: C[26], mobStatus: C[26], attach: C[27], effect: C[29], healthEffect: C[29], healthEffectEnd: C[30], playerOp: C[31],
  chunkUnload: (m) => list(m.columns).length * (C[33] + UNLOAD_BIOMES), blocks: (m) => cells(m.changes), chunkBulk: (m) => s26(m.columns),
  pistonTiles: (m) => list(m.events).length * C[36], musicEvent: C[36], crack: (m) => list(m.cracks).length * C[37], aux: (m) => list(m.events).length * C[40],
  sound: (m) => list(m.sounds).reduce((n, s) => n + C[41] - 1 + stringSize(s?.name ?? s?.n ?? s?.sound ?? ''), 0), // S29: string name, int x, y, z, float volume, byte pitch
  dispFx: (m) => list(m.events).reduce((n, e) => n + C[42] - 1 + stringSize(e?.n ?? e?.name ?? ''), 0), fishFx: (m) => list(m.events).reduce((n, e) => n + C[42] - 1 + stringSize(e?.n ?? ''), 0), // S2A: string name, 7 floats, int
  dragonCredits: C[43], boltSpawn: C[44],
  openWindow: (m) => C[45] - 1 + stringSize(m.title ?? '') + (m.kind === 'horse' ? 4 : 0), beaconWindow: C[45] + 3 * C[49], // S2D: byte, byte, string title, byte, bool (int entity for a horse); the beacon's three S31
  windowClose: C[46],
  slot: (m) => list(m.slots).reduce((n, s) => n + C[47] - 2 + itemSize(Array.isArray(s) ? s[1] : s?.item ?? s?.stack), 0), setSlot: (m) => C[47] - 2 + itemSize(m.item), invSet: (m) => C[47] - 2 + itemSize(m.item ?? m.stack),
  windowItems: (m) => C[48] + list(m.slots).reduce((n, s) => n + itemSize(s), 0) + C[47] - 2 + itemSize(m.cursor), // S30, then the cursor's S2F (window -1)
  invItems: (m) => C[48] + [m.main, m.armor, m.grid].reduce((n, l) => n + list(l).reduce((a, s) => a + itemSize(s), 0), 0) + itemSize(m.result) + C[47] - 2 + itemSize(m.cursor),
  windowProperty: C[49], confirmTransaction: C[50], invConfirm: C[50],
  mapData: (m) => list(m.maps).reduce((n, x) => n + C[52] - 1 + varIntSize(x?.id | 0) + list(x?.b).length, 0), // S34: VarInt id, short length, bytes
  signEditor: C[54],
  stats: (m) => { const e = Object.entries(m.stats ?? {}); return 1 + varIntSize(e.length) + e.reduce((n, [k, v]) => n + stringSize(k) + varIntSize(v | 0), 0); }, // S37: VarInt count, (string, VarInt) each
  pingList: (m) => list(m.items).reduce((n, i) => n + C[56] - 1 + stringSize(i?.name ?? ''), 0), // S38: string, bool, short
  tabReply: (m) => { const o = list(m.options); return 1 + varIntSize(o.length) + o.reduce((n, s) => n + stringSize(s), 0); },
  sb: (m) => list(m.packets).reduce((n, p) => n + sbPacket(p), 0),
  tradeList: (m) => payload('MC|TrList', 4 + 1 + list(m.offers).reduce((n, o) => n + itemSize(o?.buy ?? o?.a) + itemSize(o?.sell ?? o?.c) + 1 + ((o?.buy2 ?? o?.b) ? itemSize(o.buy2 ?? o.b) : 0) + 1, 0)), // int window, byte count, offers
  error: (m) => 1 + jsonString(textJson(m.text)), // S40: the reason component
};
const SERVER_BYTES = {
  join: (m) => (5 + stringSize(m.host ?? '')) + (1 + stringSize(m.name ?? '')), // C00Handshake (VarInt protocol, string host, short port, VarInt state) and C00PacketLoginStart (string name)
  pingStatus: 1, pingProbe: 9, pingKeepAliveAck: SV[0],
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
const bytesOf = (table, ids, m) => { if (lookup(ids, m) === null) return null; const v = table[m.type]; return typeof v === 'function' ? v(m) : v; };
/** The native frame bytes (id VarInt + payload) of a message read from a client, or null when it is not counted. */
export const readPacketBytes = (m) => bytesOf(SERVER_BYTES, SERVERBOUND, m);
/** The native frame bytes of the packets a message sent to a client stands for, or null when it is not counted. */
export const writePacketBytes = (m) => bytesOf(CLIENT_BYTES, CLIENTBOUND, m);
