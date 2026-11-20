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
