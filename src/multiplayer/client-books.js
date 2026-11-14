// Batch 66 mpbooks: the client half of books over a connection.
// ItemWritableBook / ItemEditableBook.onItemRightClick opens GuiScreenBook on the client (the stack is the client's own, its tags came with S2F); nothing is sent for the click.
// A finished edit or signature leaves the screen as MC|BEdit / MC|BSign, here `bookEdit` / `bookSign` (see server-books.js); the server answers with the slot correction.
import { isBook } from '../books.js';
import { STATIONS } from '../player-edit-simulation.js';

const NOTE_BLOCK = 177, JUKEBOX = 178; // internal ids (note-jukebox-content.js): both activate before the book would open

/** True when a right click opens the book screen: a book in hand and no block (or entity) that takes the click first (sneaking with the item skips block activation). */
export function bookOpensOnUse({ held, sneaking = false, targetBlock = 0, aimedEntity = false }) {
  if (!held || !isBook(held.id)) return false;
  if (aimedEntity) return false;
  const activates = !sneaking;
  return !(activates && targetBlock && (STATIONS.has(targetBlock) || targetBlock === NOTE_BLOCK || targetBlock === JUKEBOX));
}
/** The wire message for a screen's `send(channel, packet)`. */
export const bookMessage = (channel, packet) => ({ type: channel === 'MC|BSign' ? 'bookSign' : 'bookEdit', packet });
