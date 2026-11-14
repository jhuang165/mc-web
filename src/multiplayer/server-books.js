// Batch 66 mpbooks: MC|BEdit and MC|BSign on the dedicated server (NetHandlerPlayServer.processVanilla250Packet, bytecode-read; src/books.js is the single-player copy and
// the probed rules). The client opens GuiScreenBook locally (right click with a book, ItemWritableBook / ItemEditableBook.onItemRightClick) and sends the finished book:
//   { type: 'bookEdit', packet }  MC|BEdit  (the packet is the stack the client built: id, pages)
//   { type: 'bookSign', packet }  MC|BSign  (id written book, pages, title; the author field is ignored and replaced by the sender's name)
// The server checks the tag (ItemWritableBook.func_150930_a: every page present and at most 256 chars; ItemEditableBook.func_77828_a adds title <= 16 chars and an author tag),
// then changes the stack the player HOLDS (never the one the client names). An invalid tag is an IOException("Invalid book tag!"), which ends the connection;
// a valid packet for the wrong held item is ignored silently. The changed stack goes back as the usual S2F slot correction (ServerItems.settle diffs the held slot).
import { applyBookEdit, applyBookSign } from '../books.js';

const TYPES = new Set(['bookEdit', 'bookSign']);
export const isBookMessage = m => !!m && TYPES.has(m.type);

/** Returns false when the packet is invalid (the caller closes the connection with "Invalid book tag!"), true otherwise. */
export function bookPacket(sim, id, m) {
  const p = sim.players.get(id);
  if (!p) return true;
  const packet = m?.packet;
  if (!packet || typeof packet !== 'object' || !Number.isInteger(packet.id)) return false;
  try {
    const held = p.survival.held;
    if (m.type === 'bookSign') applyBookSign(held, packet, p.name); else applyBookEdit(held, packet);
  } catch { return false; }
  return true;
}
