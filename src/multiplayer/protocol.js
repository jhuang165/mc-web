// Browser protocol v3 (v2: account sessions replace the shared join key; v3: the gun server owns inventories and combat, and a
// join carries the gameplay build and weapon-rules fingerprint). These are port-state messages, not Java Edition packets.
// See public/research/multiplayer.md for the deliberate wire-format decision.
export const PROTOCOL = 3;
export const DEFAULT_SERVER = 'wss://ledoge0.tail92abaf.ts.net/multiplayer';
const ENV = import.meta.env ?? {};
// Multiplayer is paused (2026-11-07) and stays opt-in: VITE_MULTIPLAYER=1 shows the gun-server screen. A dev server joins the local
// gun server (server/guns-server.js, port 8091) unless VITE_MULTIPLAYER_URL names another.
export const MULTIPLAYER_ENABLED = ENV.VITE_MULTIPLAYER === '1';
export const MULTIPLAYER_URL = ENV.VITE_MULTIPLAYER_URL || (ENV.DEV ? 'ws://localhost:8091/multiplayer' : DEFAULT_SERVER);
// The gameplay build: the Git commit vite.config.js defines for the bundle ('dev' in Node and unbuilt tests).
// eslint-disable-next-line no-undef
export const BUILD_ID = typeof __MC_BUILD__ === 'string' && __MC_BUILD__ ? __MC_BUILD__ : 'dev';
// Gun-server actions (v3). `down` is the button state for held inputs; the others are one-shot key presses.
export const HELD_ACTIONS = new Set(['trigger', 'aim', 'melee-left', 'melee-right']);
export const KEY_ACTIONS = new Set(['reload', 'mode', 'inspect']);
// A gun-server action with the look it was taken at and the server tick the client was showing (lag compensation).
export function cleanAction(m) {
  const held = HELD_ACTIONS.has(m?.action);
  if (!held && !KEY_ACTIONS.has(m?.action)) return null;
  if (held && typeof m.down !== 'boolean') return null;
  const look = m.yaw === undefined && m.pitch === undefined ? null : cleanLook(m.yaw, m.pitch);
  if ((m.yaw !== undefined || m.pitch !== undefined) && !look) return null;
  if (m.view !== undefined && !Number.isInteger(m.view)) return null;
  return { action: m.action, down: held ? m.down : true, look, view: m.view ?? null };
}
// The hotbar slot a v3 input selects; the server never takes item stacks from a client.
export const cleanSlot = slot => Number.isInteger(slot) && slot >= 0 && slot <= 8 ? slot : null;
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
