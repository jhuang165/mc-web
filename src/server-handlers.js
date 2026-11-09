// NetHandlerPlayServer (nh) checks that a client cannot skip: spam counters, chat sanitising, held slot, sign text,
// placement/dig/use-entity distances. Replayed against public/research/server-handlers-reference.json (native nh run
// with test doubles by tools/probes/ServerHandlersProbe.java). Reach constants are bytecode-read from bje and blt.
import { isAllowedChar } from './signs.js';

export const SPAM = Object.freeze({
  chatCost: 20, chatKick: 200, // nh.a(ir): l += 20, kicked for "disconnect.spam" when l > 200 unless the profile is exempt (oi.g)
  dropCost: 20, dropLimit: 200, // nh.a(jm): a creative drop needs m < 200 and then m += 20
});
export const CHAT_MAX = 100;
export const KICK = Object.freeze({ spam: 'Kicked for spamming', illegal: 'Illegal characters in chat' });

// Both counters are decremented once per nh.a() tick while above zero. The port decays lazily by elapsed ticks.
export class SpamCounter {
  constructor() { this.value = 0; this.tick = null; }
  decay(now) {
    if (this.tick !== null && now < this.tick) this.value = 0; // a new world restarted the tick clock: a new connection
    if (this.tick !== null && now > this.tick) this.value = Math.max(0, this.value - (now - this.tick));
    this.tick = now;
    return this.value;
  }
  reset() { this.value = 0; this.tick = null; }
}

// Creative drop: the stack must be empty (null) or have damage >= 0 and 0 < size <= 64 (negative damage cannot arrive: et clamps it to 0).
export const creativeStackValid = (s) => s === null || s === undefined || (s.count > 0 && s.count <= 64 && !(s.damage < 0));
// True when the drop goes through. Refused drops leave the counter alone; an invalid stack never counts.
export function creativeDrop(counter, now, stack) {
  const value = counter.decay(now);
  if (!creativeStackValid(stack) || value >= SPAM.dropLimit) return false;
  counter.value = value + SPAM.dropCost;
  return true;
}

// java.lang.Character.isWhitespace (StringUtils.normalizeSpace collapses these runs and trims the ends).
const WS = /[\t\n\u000b\f\r\u001c-\u001f \u1680\u2000-\u2006\u2008-\u200a\u2028\u2029\u205f\u3000]+/g;
export const normalizeChat = (text) => String(text).slice(0, CHAT_MAX).replace(WS, ' ').replace(/^ | $/g, '');
// One processed chat packet: { deliver: text or null, kick: reason or null }. Illegal characters kick before delivery and leave the
// counter alone; otherwise the message is delivered, then l += 20 kicks above 200 unless exempt (op, owner with cheats, LAN cheats).
export function chatPacket(counter, now, text, exempt) {
  counter.decay(now);
  const s = normalizeChat(text);
  for (let i = 0; i < s.length; i++) if (!isAllowedChar(s.charCodeAt(i))) return { deliver: null, kick: KICK.illegal };
  counter.value += SPAM.chatCost;
  return { deliver: s, kick: counter.value > SPAM.chatKick && !exempt ? KICK.spam : null };
}

// nh.a(jl): a held slot outside 0..8 is ignored (the selection stays).
export const heldSlot = (sent, selected) => (Number.isInteger(sent) && sent >= 0 && sent <= 8 ? sent : selected);

const sq = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
// nh.a(jo): the clicked block centre within 8 blocks of the player's feet (squared < 64) and the player has moved; a click on y >= 255
// (top face) or y >= 256 (any face) is refused with a chat message instead. Face 255 is use-item and never places.
export function placementOutcome({ player, pos, face, hasMoved }) {
  if (face === 255) return 'useItem';
  if (pos[1] >= 255 && (face === 1 || pos[1] >= 256)) return 'tooHigh';
  return hasMoved && sq(player, [pos[0] + 0.5, pos[1] + 0.5, pos[2] + 0.5]) < 64 ? 'place' : 'refuse';
}
// nh.a(ji) statuses 0, 1, 2: block centre within 6 blocks of the eye (squared <= 36, eye = feet + 1.5) and below the build limit.
export function digAllowed({ player, pos }) {
  if (pos[1] >= 256) return false;
  const dx = player[0] - (pos[0] + 0.5), dy = player[1] - (pos[1] + 0.5) + 1.5, dz = player[2] - (pos[2] + 0.5);
  return dx * dx + dy * dy + dz * dz <= 36;
}
// nh.a(ja): feet-to-feet squared distance under 36 with line of sight, under 9 without.
export const useEntityAllowed = (player, entity, visible) => sq(player, entity) < (visible ? 36 : 9);
// PlayerControllerMP.getBlockReachDistance and EntityRenderer.getMouseOver: blocks 5 creative / 4.5 survival, entities 6 / 3.
export const blockReach = (creative) => (creative ? 5 : 4.5);
export const entityReach = (creative) => (creative ? 6 : 3);

// Block face index (C08 / C07) of the clicked cell: 0 -y, 1 +y, 2 -z, 3 +z, 4 -x, 5 +x. Null when the cells are not neighbours.
export function faceOf(block, adjacent) {
  if (!block || !adjacent) return null;
  const d = [adjacent[0] - block[0], adjacent[1] - block[1], adjacent[2] - block[2]];
  const f = d[1] === -1 ? 0 : d[1] === 1 ? 1 : d[2] === -1 ? 2 : d[2] === 1 ? 3 : d[0] === -1 ? 4 : d[0] === 1 ? 5 : null;
  return f !== null && d.reduce((n, v) => n + Math.abs(v), 0) === 1 ? f : null;
}
export const BUILD_HEIGHT_MESSAGE = 'Height limit for building is 256 blocks';
// What the integrated server does with one block click or entity click. The single-player owner has no spawn protection: the integrated
// server keeps MinecraftServer.isBlockProtected (always false, the probe's Srv double returns it unchanged). `player` is the feet [x, y, z].
// Returns { accept } plus `message` (chat line the server sends) when the click is refused for height; a refused click resends the block.
export function serverClick({ kind, player, pos, adjacent = null, entity = null, visible = true, hasMoved = true }) {
  if (kind === 'place') {
    const out = placementOutcome({ player, pos, face: faceOf(pos, adjacent) ?? 0, hasMoved });
    return out === 'place' ? { accept: true } : { accept: false, message: out === 'tooHigh' ? BUILD_HEIGHT_MESSAGE : null };
  }
  if (kind === 'dig') return { accept: digAllowed({ player, pos }) };
  if (kind === 'entity') return { accept: useEntityAllowed(player, entity, visible) };
  return { accept: true };
}
