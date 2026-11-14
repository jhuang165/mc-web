// Batch 72 mpsettings: the whole C15PacketClientSettings on the dedicated server.
// Bytecode-read (1.7.10 iu, mw, nh): C15 = language (string, max 7), view distance (byte), chat visibility (byte, EnumChatVisibility.getEnumChatVisibility
// = table[id % 3]), chat colours (boolean), difficulty (byte, EnumDifficulty table[id % 4]), show cape (boolean).
// EntityPlayerMP.func_147100_a stores language (bM, default "en_US"), chat visibility (bV) and chat colours (bW); the view distance is computed
// (256 >> value) and then discarded (an empty branch); difficulty is applied only when the player owns a single-player (integrated) server, never on a
// dedicated one; showCape sets the hide-cape flag (b71 cape-wire.js). Nothing on the server reads language or chat colours (no other reader in the
// whole jar), so colour stripping and translations are client-side only.
// Readers of chat visibility: NetHandlerPlayServer.sendPacket drops every S02PacketChat for HIDDEN, and for SYSTEM when the packet is player chat
// (the flag the 1-argument constructor sets true is a system line); NetHandlerPlayServer.processChatMessage answers HIDDEN with chat.cannotSend (red) before
// the command branch and before the spam counter, but that answer goes through the same sendPacket filter, so a HIDDEN player never sees it.
// Wire: client -> server `settingsClient {language, view, chat, colours, difficulty, cape}`.
import { setCapeShow } from './cape-wire.js';

export const CHAT_FULL = 0, CHAT_SYSTEM = 1, CHAT_HIDDEN = 2;

/** The client side: what C15 carries, from the saved options (language, render distance in chunks, chat visibility, chat colours, difficulty, show cape). */
export function clientSettingsMessage(options) {
  return {
    type: 'settingsClient', language: String(options.language || 'en_US').slice(0, 7), view: Math.max(0, Math.min(127, Math.trunc(options.distance) || 0)),
    chat: [0, 1, 2].includes(options.chatVisibility) ? options.chatVisibility : CHAT_FULL, colours: options.chatColors !== false,
    difficulty: Number.isInteger(options.difficulty) && options.difficulty >= 0 && options.difficulty <= 3 ? options.difficulty : 2, cape: options.showCape !== false,
  };
}

/** Server side: a malformed message is refused (native decoding throws on a negative id or an over-long language). */
export function applyClientSettings(player, m) {
  if (!player || !m || typeof m.language !== 'string' || m.language.length > 7 || typeof m.colours !== 'boolean' || typeof m.cape !== 'boolean') return false;
  for (const k of ['view', 'chat', 'difficulty']) if (!Number.isInteger(m[k]) || m[k] < 0 || m[k] > 127) return false;
  player.clientSettings = { language: m.language, viewDistance: m.view, chatVisibility: m.chat % 3, chatColours: m.colours, difficulty: m.difficulty % 4 }; // stored, view and difficulty unused natively
  return setCapeShow(player, m.cape);
}

export const chatVisibilityOf = (player) => player?.clientSettings?.chatVisibility ?? CHAT_FULL;

/** NetHandlerPlayServer.sendPacket: false when this S02 chat message must not reach that player. Player chat has a sender `name`; every other line is a system line. */
export function chatDelivered(player, message) {
  const vis = chatVisibilityOf(player);
  return vis === CHAT_FULL || (vis === CHAT_SYSTEM && !message.name);
}

/** processChatMessage: HIDDEN players cannot send chat or commands (the line is dropped before the spam counter). */
export const chatSendAllowed = (player) => chatVisibilityOf(player) !== CHAT_HIDDEN;
