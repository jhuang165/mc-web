// Book and Quill (original 386, ItemWritableBook `ael`) and Written Book (original 387, ItemEditableBook `aem`) of Java 1.7.10,
// plus the GuiScreenBook (`bfe`) state machine, the server-side MC|BEdit / MC|BSign handlers (NetHandlerPlayServer `nh`) and
// RecipeBookCloning (`aew`). Facts and tables come from tools/probes/BookProbe.java (public/research/book-reference.json);
// the GUI state machine is read from the bfe/bff/nh bytecode (public/research/books.md). No DOM here: book-ui.js draws it.
//
// Browser stack fields: `pages` (array of strings), `author`, `title` (strings). They ride on the stack object exactly like
// `fireworks`/`explosion` do (inventory.makeStack metadata); books-nbt.js maps them to the pages/author/title NBT tags.
import { getCharWidth } from './font-renderer.js';
import { hasItemTags } from './item-tags.js';

export const ITEM_WRITABLE_BOOK = 2110; // original 386
export const ITEM_WRITTEN_BOOK = 2111; // original 387
export const BOOK_ITEMS = Object.freeze({ 386: ITEM_WRITABLE_BOOK, 387: ITEM_WRITTEN_BOOK });
export const LIMITS = Object.freeze({ pageChars: 256, title: 16, pages: 50, wrapWidth: 116, heightLimit: 118, insertWrap: 118, gui: [192, 192] });
// en_US.lang strings used by GuiScreenBook and the items.
export const LANG = Object.freeze({
  'book.editTitle': 'Enter Book Title:', 'book.finalizeButton': 'Sign and Close', 'book.finalizeWarning': 'Note! When you sign the book, it will no longer be editable.',
  'book.pageIndicator': 'Page %1$d of %2$d', 'book.byAuthor': 'by %1$s', 'book.signButton': 'Sign', 'gui.done': 'Done', 'gui.cancel': 'Cancel',
  writable: 'Book and Quill', written: 'Written Book',
});
const fmt = (key, ...args) => LANG[key].replace(/%(\d)\$[sd]/g, (_, n) => String(args[n - 1]));
export const pageIndicator = (page, total) => fmt('book.pageIndicator', page, total);
export const byAuthor = (author) => fmt('book.byAuthor', author);

export function installBookItems(items) {
  // ItemWritableBook: maxStackSize 1, creative tab misc (index 4); ItemEditableBook: stack 16, no tab, hasEffect always true.
  items[ITEM_WRITABLE_BOOK] = { id: ITEM_WRITABLE_BOOK, name: LANG.writable, texture: 'book_writable', stack: 1, color: '#6b4a2a', glyph: 'B' };
  items[ITEM_WRITTEN_BOOK] = { id: ITEM_WRITTEN_BOOK, name: LANG.written, texture: 'book_written', stack: 16, color: '#8a5a2a', glyph: 'B', alwaysGlint: true, hiddenFromCreative: true };
}

// String.trim of Java: removes every character up to U+0020 (not the other Unicode spaces JavaScript's trim removes).
export const javaTrim = (s) => s.replace(/^[\u0000-\u0020]+|[\u0000-\u0020]+$/g, '');
// ItemStack.hasTagCompound over the tag fields a browser stack can carry (display name, enchantments, book fields, ...).
export const hasItemTag = (s) => !!s && (Array.isArray(s.pages) || typeof s.author === 'string' || typeof s.title === 'string' || typeof s.displayName === 'string'
  || Number.isFinite(s.repairCost) || Array.isArray(s.enchantments) || Array.isArray(s.storedEnchantments) || Array.isArray(s.stored) || typeof s.unbreakable === 'boolean'
  || Number.isInteger(s.color) || !!s.fireworks || !!s.explosion || hasItemTags(s));

// ChatAllowedCharacters.isAllowedCharacter (t.a): not the section sign, at least 32, not DEL.
export const isAllowedCharacter = (c) => typeof c === 'string' && c.length === 1 && c !== '§' && c.charCodeAt(0) >= 32 && c !== '\u007f';

// ---- validation (ItemWritableBook.validBookPageTagContents `ael.a`, ItemEditableBook.validBookTagContents `aem.a`) ----
// `tag` is { pages, author, title } (a stack or a plain object).
export function validPages(tag) {
  if (!tag || !Array.isArray(tag.pages)) return false;
  return tag.pages.every((p) => typeof p === 'string' && p.length <= LIMITS.pageChars);
}
export const validWritable = validPages;
export function validWritten(tag) {
  if (!validPages(tag)) return false;
  return typeof tag.title === 'string' && tag.title.length <= LIMITS.title && typeof tag.author === 'string';
}

// ---- display ----
// ItemEditableBook.getItemStackDisplayName: the title when non-empty (not trimmed), else the item name.
export const bookDisplayName = (stack) => (typeof stack?.title === 'string' && stack.title !== '' ? stack.title : LANG.written);
// ItemEditableBook.addInformation: GRAY "by <author>" when the author is non-empty.
export const bookInfoLines = (stack) => (stack?.id === ITEM_WRITTEN_BOOK && typeof stack.author === 'string' && stack.author !== '' ? ['§7' + byAuthor(stack.author)] : []);
export const isBook = (id) => id === ITEM_WRITABLE_BOOK || id === ITEM_WRITTEN_BOOK;

// ---- tag fields on a stack (merge identity, copy) ----
export function readBookTags(s) {
  const out = {};
  if (Array.isArray(s?.pages) && s.pages.every((p) => typeof p === 'string')) out.pages = [...s.pages];
  if (typeof s?.author === 'string') out.author = s.author;
  if (typeof s?.title === 'string') out.title = s.title;
  return out;
}
// ItemStack.areItemStackTagsEqual over the three book tags.
export const sameBookTag = (a, b) => JSON.stringify([a.pages ?? null, a.author ?? null, a.title ?? null]) === JSON.stringify([b.pages ?? null, b.author ?? null, b.title ?? null]);

// ---- FontRenderer text metrics (bbu): getCharWidth, getStringWidth, sizeStringToWidth, wrapFormattedStringToWidth ----
// getCharWidth is the font-renderer.js port of FontRenderer.getCharWidth: ascii.png widths for the 256-entry table and
// glyph_sizes.bin for the other characters (book-gui-reference.json wrapUnicode replays both unicode flags).
export const charWidth = (c) => getCharWidth(c);
export function stringWidth(s) {
  let w = 0, bold = false;
  for (let i = 0; i < s.length; i++) {
    let k = charWidth(s[i]);
    if (k < 0 && i < s.length - 1) {
      const c = s[++i];
      if (c === 'l' || c === 'L') bold = true; else if (c === 'r' || c === 'R') bold = false;
      k = 0;
    }
    w += k;
    if (bold && k > 0) w++;
  }
  return w;
}
const isFormatColor = (c) => /[0-9a-fA-F]/.test(c);
const isFormatSpecial = (c) => /[k-oK-O]/.test(c);
// FontRenderer.getFormatFromString: the active colour and style codes at the end of the string.
export function formatFromString(s) {
  let out = '', i = -1;
  while ((i = s.indexOf('§', i + 1)) !== -1) {
    if (i < s.length - 1) {
      const c = s[i + 1];
      if (isFormatColor(c)) out = '§' + c;
      else if (isFormatSpecial(c)) out += '§' + c;
    }
  }
  return out;
}
export function sizeStringToWidth(s, width) {
  const n = s.length;
  let w = 0, l = 0, space = -1, bold = false;
  for (; l < n; l++) {
    const c = s[l];
    if (c === '\n') { l--; } else {
      if (c === '§') {
        if (l < n - 1) {
          const f = s[++l];
          if (f !== 'l' && f !== 'L') { if (f === 'r' || f === 'R' || isFormatColor(f)) bold = false; } else bold = true;
        }
      } else {
        if (c === ' ') space = l;
        w += charWidth(c);
        if (bold) w++;
      }
    }
    if (c === '\n') { l++; space = l; break; }
    if (w > width) break;
  }
  return l !== n && space !== -1 && space < l ? space : l;
}
export function wrapFormatted(s, width) {
  const j = sizeStringToWidth(s, width);
  if (s.length <= j) return s;
  const head = s.slice(0, j), c = s[j], skip = c === ' ' || c === '\n';
  return head + '\n' + wrapFormatted(formatFromString(head) + s.slice(j + (skip ? 1 : 0)), width);
}
// FontRenderer.listFormattedStringToWidth (Java's String.split drops trailing empty strings).
export function listFormatted(s, width) {
  const parts = wrapFormatted(s, width).split('\n');
  while (parts.length > 1 && parts[parts.length - 1] === '') parts.pop();
  return parts;
}
// FontRenderer.splitStringWidth: 9 * line count.
export const splitStringHeight = (s, width) => 9 * listFormatted(s, width).length;

// ---- crafting ----
// RecipeBookCloning (aew): exactly one written book plus one or more writable books and nothing else. The result is a
// written book with count writables + 1 and a copy of the tag (and display name). A written book without a tag crashes the
// original (NPE in getRecipeOutput); here it just makes no result.
export function bookCloneResult(cells) {
  let written = null, writables = 0;
  for (const c of cells) {
    if (!c) continue;
    if (c.id === ITEM_WRITTEN_BOOK) { if (written) return null; written = c; } else if (c.id === ITEM_WRITABLE_BOOK) writables++; else return null;
  }
  if (!written || !writables || !(Array.isArray(written.pages) || typeof written.author === 'string' || typeof written.title === 'string')) return null;
  const out = { id: ITEM_WRITTEN_BOOK, count: writables + 1, damage: 0, ...readBookTags(written) };
  if (typeof written.displayName === 'string') out.displayName = written.displayName;
  return out;
}

// ---- server side: NetHandlerPlayServer MC|BEdit and MC|BSign ----
// `held` is the player's selected stack (mutated); returns true when it was changed. Invalid tags throw the original's
// IOException("Invalid book tag!").
export function applyBookEdit(held, packet) {
  if (!packet) return false;
  if (!validWritable(packet)) throw new Error('Invalid book tag!');
  if (!held) return false;
  if (packet.id === ITEM_WRITABLE_BOOK && held.id === ITEM_WRITABLE_BOOK) { held.pages = [...packet.pages]; return true; }
  return false;
}
export function applyBookSign(held, packet, playerName) {
  if (!packet) return false;
  if (!validWritten(packet)) throw new Error('Invalid book tag!');
  if (!held) return false;
  if (packet.id === ITEM_WRITTEN_BOOK && held.id === ITEM_WRITABLE_BOOK) {
    held.author = playerName; // the server substitutes the sender's name
    held.title = packet.title;
    held.pages = [...packet.pages];
    held.id = ITEM_WRITTEN_BOOK;
    return true;
  }
  return false;
}

// ---- GuiScreenBook (bfe) ----
export const BOOK_GUI = Object.freeze({
  width: 192, height: 192, top: 2, textX: 36, textWidth: 116, textY: 34, titleLabelY: 34, titleY: 50, authorY: 60, warningY: 82,
  buttonY: 196, nextX: 120, prevX: 38, pageButtonY: 154, indicatorRight: 44, indicatorY: 18, // y values are absolute GUI coordinates (top 2 + the offset in GuiScreenBook.drawScreen)
});
/**
 * state machine of GuiScreenBook: `item` is the held stack (mutated like the original mutates its stack copy), `send(channel, stack)`
 * receives the packets, `close()` is displayGuiScreen(null). Button ids are those of the original: 0 Done, 1 next, 2 previous, 3 Sign,
 * 4 Cancel, 5 Sign and Close.
 */
export class BookScreen {
  // `playerName` is the profile name (EntityPlayer.getCommandSenderName); this build has one fixed local player, "Player"
  // (death-messages.js PLAYER_NAME). `clipboard()` is the text ctrl+V reads (GuiScreen.getClipboardString).
  constructor({ item, editable, playerName = 'Player', send = () => {}, close = () => {}, clipboard = () => '' }) {
    this.item = item; this.editable = !!editable; this.playerName = playerName; this.sendPacket = send; this.close = close; this.clipboard = clipboard;
    this.modified = false; this.signing = false; this.page = 0; this.title = ''; this.ticks = 0;
    // GuiScreenBook(): a tagged stack reads NBTTagCompound.getTagList("pages"), which is an empty list when the tag has no pages
    // (typing then changes nothing until pages exist); an untagged editable stack starts with one empty page.
    this.pages = Array.isArray(item?.pages) ? item.pages.map(String) : hasItemTag(item) ? [] : null;
    this.total = 1;
    if (this.pages) this.total = Math.max(1, this.pages.length);
    if (!this.pages && this.editable) { this.pages = ['']; this.total = 1; }
  }
  tick() { this.ticks++; }
  get blinkOn() { return Math.floor(this.ticks / 6) % 2 === 0; }
  // Which buttons are shown / enabled (updateButtons `f`).
  buttons() {
    const b = {
      next: { visible: !this.signing && (this.page < this.total - 1 || this.editable) },
      prev: { visible: !this.signing && this.page > 0 },
      done: { visible: !this.editable || !this.signing },
    };
    if (this.editable) {
      b.sign = { visible: !this.signing };
      b.cancel = { visible: this.signing };
      b.finalize = { visible: this.signing, enabled: javaTrim(this.title).length > 0 };
    }
    return b;
  }
  current() { return this.pages && this.page >= 0 && this.page < this.pages.length ? this.pages[this.page] : ''; }
  setCurrent(text) { if (this.pages && this.page >= 0 && this.page < this.pages.length) { this.pages[this.page] = text; this.modified = true; } }
  // pageInsertIntoCurrent: the text must still wrap into 118 pixels of height (with the cursor character) and stay under 256 characters.
  insert(text) {
    const s = this.current() + text;
    if (splitStringHeight(s + '§0_', LIMITS.insertWrap) <= LIMITS.heightLimit && s.length < LIMITS.pageChars) this.setCurrent(s);
  }
  addPage() {
    if (!this.pages || this.pages.length >= LIMITS.pages) return;
    this.pages.push(''); this.total++; this.modified = true;
  }
  // sendBookToServer (a(boolean)): only a modified editable book is sent; trailing empty pages (past the first) are dropped.
  sendBook(sign) {
    if (!this.editable || !this.modified) return;
    if (this.pages) {
      while (this.pages.length > 1 && this.pages[this.pages.length - 1].length === 0) this.pages.pop();
      this.item.pages = [...this.pages];
      const packet = { ...readBookTags(this.item), id: sign ? ITEM_WRITTEN_BOOK : ITEM_WRITABLE_BOOK, count: this.item.count ?? 1, damage: 0 };
      if (sign) { packet.author = this.playerName; packet.title = javaTrim(this.title); }
      this.sendPacket(sign ? 'MC|BSign' : 'MC|BEdit', packet);
    }
  }
  // actionPerformed (a(bcb)); `button` is the id.
  click(id) {
    const b = this.buttons(), name = { 0: 'done', 1: 'next', 2: 'prev', 3: 'sign', 4: 'cancel', 5: 'finalize' }[id];
    if (!name || !b[name] || !b[name].visible || b[name].enabled === false) return;
    if (id === 0) { this.close(); this.sendBook(false); } else if (id === 3 && this.editable) this.signing = true;
    else if (id === 1) {
      if (this.page < this.total - 1) this.page++;
      else if (this.editable) { this.addPage(); if (this.page < this.total - 1) this.page++; }
    } else if (id === 2) { if (this.page > 0) this.page--; } else if (id === 5 && this.signing) { this.sendBook(true); this.close(); } else if (id === 4 && this.signing) this.signing = false;
  }
  // keyTyped (a(char,int)): `code` is the LWJGL key code (Escape 1, Backspace 14, Enter 28, keypad Enter 156); Escape closes without sending.
  keyTyped(ch, code) {
    if (code === 1) { this.close(); return; }
    if (!this.editable) return;
    if (ch === '\u0016' && !this.signing) { this.insert(this.clipboard() ?? ''); return; } // ctrl+V (a char below 32, so never typed in the title)
    if (this.signing) {
      if (code === 14) { if (this.title.length) this.title = this.title.slice(0, -1); } else if (code === 28 || code === 156) {
        if (this.title.length) { this.sendBook(true); this.close(); }
      } else if (this.title.length < LIMITS.title && isAllowedCharacter(ch)) { this.title += ch; this.modified = true; }
    } else if (code === 14) { const s = this.current(); if (s.length) this.setCurrent(s.slice(0, -1)); } else if (code === 28 || code === 156) this.insert('\n');
    else if (isAllowedCharacter(ch)) this.insert(ch);
  }
  paste(text) { if (this.editable && !this.signing) this.insert(text); }
  // The text drawGuiScreen draws: the page with the cursor (black "_", gray in the off phase) while editing.
  pageText() {
    const s = this.current();
    if (!this.editable) return s;
    return s + (this.blinkOn ? '§0_' : '§7_');
  }
  titleText() { return this.title + (this.blinkOn ? '§0_' : '§7_'); }
}

/**
 * What GuiScreenBook.drawScreen draws (verified by book-gui-reference.json): `[kind, text, x, y, wrapWidth]` where kind is
 * 'string' (drawString, no shadow, colour 0) or 'split' (drawSplitString at wrapWidth). `width` is the GUI width in GUI units.
 * Signing: label and title centred in the 116 px text column (the title carries the blinking cursor), the DARK_GRAY
 * "by <player name>" line and the finalize warning. Otherwise: "Page x of y" ending 44 px from the page's right edge, and the page.
 */
export function bookDrawList(screen, playerName = screen.playerName, width = 320) {
  const x = Math.trunc((width - BOOK_GUI.width) / 2), G = BOOK_GUI, centre = (s) => x + G.textX + Math.trunc((G.textWidth - stringWidth(s)) / 2);
  if (screen.signing) {
    const label = LANG['book.editTitle'], title = screen.titleText(), by = byAuthor(playerName);
    return [['string', label, centre(label), G.titleLabelY], ['string', title, centre(title), G.titleY], ['string', '§8' + by, centre(by), G.authorY],
      ['split', LANG['book.finalizeWarning'], x + G.textX, G.warningY, G.textWidth]];
  }
  const indicator = pageIndicator(screen.page + 1, screen.total);
  return [['string', indicator, x - stringWidth(indicator) + G.width - G.indicatorRight, G.indicatorY], ['split', screen.pageText(), x + G.textX, G.textY, G.textWidth]];
}
