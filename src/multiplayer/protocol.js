// Browser protocol v2 (v2: account sessions replace the shared join key). A client that joins with `chunks: true` may get whole-chunk resends
// (`chunks`, see splitChanges); any other client gets those cells as plain `changes` (expandChunks), so older v2 clients keep working.
// The number stays 2: the guns branch uses 3 for its own wire format, and equal numbers must mean the same format.
// These are port-state messages, not Java Edition packets.
// See public/research/multiplayer.md for the deliberate wire-format decision.
export const PROTOCOL = 2;
export const DEFAULT_SERVER = 'wss://ledoge0.tail92abaf.ts.net/multiplayer';
export const IDLE_INPUT = Object.freeze({ forward: 0, strafe: 0, jump: false, sneak: false, sprint: false });
export const validName = name => typeof name === 'string' && /^[A-Za-z0-9_]{1,16}$/.test(name);
export function cleanInput(value) {
  if (!value || ![-1, 0, 1].includes(value.forward) || ![-1, 0, 1].includes(value.strafe) ||
      !['jump', 'sneak', 'sprint'].every(k => typeof value[k] === 'boolean')) return null;
  return Object.fromEntries(Object.keys(IDLE_INPUT).map(k => [k, value[k]]));
}
export function cleanLook(yaw, pitch) {
  if (![yaw, pitch].every(Number.isFinite)) return null;
  return { yaw: ((yaw % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI), pitch: Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch)) };
}
export function serverUrl(value, pageProtocol = globalThis.location?.protocol) {
  const url = new URL(value);
  if (!['ws:', 'wss:'].includes(url.protocol) || url.username || url.password || url.hash)
    throw new Error('Use a ws:// or wss:// server address.');
  if (pageProtocol === 'https:' && url.protocol !== 'wss:') throw new Error('This HTTPS page requires a wss:// server address.');
  return url.href;
}
// RLE pairs pack the port block byte and metadata nibble together. There is no
// terrain regeneration dependency: a join receives every authoritative cell.
export function encodeColumn(column) {
  const runs = [];
  let value = -1, count = 0;
  for (let i = 0; i < column.blocks.length; i++) {
    const next = column.blocks[i] | column.meta[i] << 8;
    if (next !== value && count) { runs.push(value, count); count = 0; }
    value = next; count++;
  }
  if (count) runs.push(value, count);
  return { x: column.x, z: column.z, runs };
}
export function decodeColumn(packet, column, blockCount = 256) {
  if (!Array.isArray(packet.runs) || packet.runs.length % 2) throw new Error('Invalid column runs');
  let offset = 0;
  for (let i = 0; i < packet.runs.length; i += 2) {
    const value = packet.runs[i], count = packet.runs[i + 1];
    if (!Number.isInteger(value) || value < 0 || value > 4095 || (value & 255) >= blockCount ||
        !Number.isInteger(count) || count < 1 || offset + count > column.blocks.length) throw new Error('Invalid column run');
    column.blocks.fill(value & 255, offset, offset + count);
    column.meta.fill(value >> 8, offset, offset + count);
    offset += count;
  }
  if (offset !== column.blocks.length) throw new Error('Incomplete column');
  column.tickCounts = null;
}
// The account API lives on the same host as the WebSocket endpoint.
export function apiBase(value) {
  const url = new URL(serverUrl(value));
  url.protocol = url.protocol === 'wss:' ? 'https:' : 'http:';
  url.pathname = '/api/'; url.search = '';
  return url.href;
}

// PlayerManager.PlayerInstance (mr, bytecode-read): flagChunkForUpdate(x, y, z) records each distinct changed cell of a chunk in a 64-entry
// list and ORs 1 << (y >> 4) into the section mask; the count stops at 64. sendChunkUpdate (mr.b) then sends S23 for one change, S22 for 2 to 63
// and, at 64, an S21 chunk packet (ground-up false, the changed section mask) with the tile entities of those sections. Here S23/S22 are cells in
// `changes` and S21 is a `chunks` entry `{ x, z, mask, runs }` (chunk coordinates, section mask, the column's run-length cells).
export const CHUNK_RESEND = 64;
// `changes` are distinct final cells [x, y, z, id, meta]; `columnOf(cx, cz)` returns the authoritative column for a whole-chunk resend.
export function splitChanges(changes, columnOf) {
  const byChunk = new Map();
  for (const change of changes) {
    const key = `${change[0] >> 4},${change[2] >> 4}`;
    let group = byChunk.get(key);
    if (!group) byChunk.set(key, group = { x: change[0] >> 4, z: change[2] >> 4, cells: new Set(), list: [], mask: 0 });
    const cell = `${change[0]},${change[1]},${change[2]}`;
    if (!group.cells.has(cell)) { group.cells.add(cell); group.list.push(change); }
    group.mask |= 1 << (change[1] >> 4);
  }
  const cells = [], chunks = [];
  for (const group of byChunk.values()) {
    if (group.list.length < CHUNK_RESEND) { cells.push(...group.list); continue; }
    chunks.push({ x: group.x, z: group.z, mask: group.mask, runs: encodeColumn(columnOf(group.x, group.z)).runs });
  }
  return { changes: cells, chunks };
}
// A chunk packet back to cells: every cell of the masked 16-high sections (the client applies them like S22 entries).
export function chunkPacketCells(packet) {
  if (!Array.isArray(packet.runs) || packet.runs.length % 2 || !Number.isInteger(packet.mask) || packet.mask < 0) throw new Error('Invalid chunk packet');
  let total = 0;
  for (let i = 1; i < packet.runs.length; i += 2) total += packet.runs[i];
  const height = total / 256;
  if (!Number.isInteger(height) || height % 16) throw new Error('Invalid chunk packet');
  const column = { blocks: new Uint8Array(total), meta: new Uint8Array(total) };
  decodeColumn(packet, column);
  const cells = [];
  for (let xi = 0; xi < 16; xi++) for (let zi = 0; zi < 16; zi++) for (let y = 0; y < height; y++) {
    if (!(packet.mask >> (y >> 4) & 1)) continue;
    const i = (xi * 16 + zi) * height + y;
    cells.push([packet.x * 16 + xi, y, packet.z * 16 + zi, column.blocks[i], column.meta[i]]);
  }
  return cells;
}
// A tick with `chunks` back to plain cells (for a client that did not ask for chunk resends, and inside the client that did).
export function expandChunks(message) {
  if (!message.chunks?.length) return message;
  return { ...message, changes: [...message.changes, ...message.chunks.flatMap(chunkPacketCells)], chunks: undefined };
}
