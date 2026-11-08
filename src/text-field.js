// GuiTextField (bcd) editing model, ported from the 1.7.10 bytecode (javap of the unchanged jar): textboxKeyTyped (a(char,int)), writeText
// (b(String)), deleteFromCursor (d(int)), deleteWords (a(int)), getNthWordFromPos (a(int,int)), setCursorPosition (e(int)), moveCursorBy
// (c? i(int) setSelectionPos) and the clipboard keys. `cursor` is cursorPosition (field_146224_t), `selectionEnd` is field_146223_s: shift
// moves selectionEnd while cursor stays, the selection is the span between them. Pure state: the anvil screen mirrors it into its
// <input> and draws it with container-widgets.js textFieldDraw.
const allowed = (s) => [...String(s)].filter((c) => c !== "§" && c.charCodeAt(0) >= 32 && c !== "\u007f").join(""); // ChatAllowedCharacters
export class GuiTextField {
  constructor({ maxLength = 32, text = "", enabled = true, focused = true } = {}) {
    Object.assign(this, { maxLength, text: "", cursor: 0, selectionEnd: 0, enabled, focused, scroll: 0 });
    this.setText(text);
  }
  setText(text) { this.text = String(text).slice(0, this.maxLength); this.setCursorPositionEnd(); }
  selectedText() { const a = Math.min(this.cursor, this.selectionEnd), b = Math.max(this.cursor, this.selectionEnd); return this.text.slice(a, b); }
  /** setSelectionPos: clamp to [0, length]. */
  setSelectionPos(p) { this.selectionEnd = Math.max(0, Math.min(p, this.text.length)); }
  /** setCursorPosition: both ends. */
  setCursorPosition(p) { this.cursor = Math.max(0, Math.min(p, this.text.length)); this.setSelectionPos(this.cursor); }
  moveCursorBy(n) { this.setCursorPosition(this.selectionEnd + n); }
  setCursorPositionZero() { this.setCursorPosition(0); }
  setCursorPositionEnd() { this.setCursorPosition(this.text.length); }
  /** writeText: replaces the selection, truncated to maxLength. */
  writeText(chars) {
    const filtered = allowed(chars), l = Math.min(this.cursor, this.selectionEnd), r = Math.max(this.cursor, this.selectionEnd);
    const room = this.maxLength - this.text.length - (l - r);
    const add = room < filtered.length ? filtered.slice(0, Math.max(0, room)) : filtered;
    this.text = this.text.slice(0, l) + add + this.text.slice(r);
    this.moveCursorBy(l - this.selectionEnd + add.length);
  }
  /** deleteFromCursor: a selection is replaced by "", else n characters (negative = backspace). */
  deleteFromCursor(n) {
    if (!this.text.length) return;
    if (this.selectionEnd !== this.cursor) return this.writeText("");
    const back = n < 0, a = back ? this.cursor + n : this.cursor, b = back ? this.cursor : this.cursor + n;
    this.text = (a >= 0 ? this.text.slice(0, a) : "") + (b < this.text.length ? this.text.slice(b) : "");
    if (back) this.moveCursorBy(n);
  }
  deleteWords(n) {
    if (!this.text.length) return;
    if (this.selectionEnd !== this.cursor) return this.writeText("");
    this.deleteFromCursor(this.getNthWordFromCursor(n) - this.cursor);
  }
  getNthWordFromCursor(n) { return this.getNthWordFromPos(n, this.cursor); }
  /** getNthWordFromPos(n, pos, true): words are runs between U+0020 spaces; spaces are skipped. */
  getNthWordFromPos(n, pos) {
    let j = pos;
    for (let k = 0; k < Math.abs(n); k++) {
      if (n < 0) { while (j > 0 && this.text[j - 1] === " ") j--; while (j > 0 && this.text[j - 1] !== " ") j--; }
      else { const len = this.text.length; j = this.text.indexOf(" ", j); if (j === -1) j = len; else while (j < len && this.text[j] === " ") j++; }
    }
    return j;
  }
  /**
   * textboxKeyTyped for a browser KeyboardEvent-like { key, ctrl, shift, meta }. The native char codes 1 / 3 / 22 / 24 (Ctrl+A/C/V/X) are
   * mapped from the letter keys. Word shortcuts: native bdw.q() is Command on a Mac and Control elsewhere; the browser port accepts either on every platform
   (a deliberate widening, so the shortcut works however the OS reports it; `mac` is accepted and ignored). `clipboard` is { read(): string,
   * write(s) } (GuiScreen.get/setClipboardString). Returns whether the key was consumed.
   */
  keyTyped({ key, ctrl = false, shift = false, meta = false }, { mac = false, clipboard = null } = {}) {
    if (!this.focused) return false;
    const word = ctrl || meta, letter = key.length === 1 && (ctrl || meta) ? key.toLowerCase() : "";
    if (letter === "a") { this.setCursorPositionEnd(); this.setSelectionPos(0); return true; }
    if (letter === "c") { clipboard?.write(this.selectedText()); return true; }
    if (letter === "v") { if (this.enabled && clipboard) this.writeText(clipboard.read()); return true; }
    if (letter === "x") { clipboard?.write(this.selectedText()); if (this.enabled) this.writeText(""); return true; }
    switch (key) {
      case "Backspace": if (this.enabled) (word ? this.deleteWords(-1) : this.deleteFromCursor(-1)); return true;
      case "Home": shift ? this.setSelectionPos(0) : this.setCursorPositionZero(); return true;
      case "ArrowLeft": case "ArrowRight": {
        const d = key === "ArrowLeft" ? -1 : 1;
        if (shift) this.setSelectionPos(word ? this.getNthWordFromPos(d, this.selectionEnd) : this.selectionEnd + d);
        else if (word) this.setCursorPosition(this.getNthWordFromCursor(d));
        else this.moveCursorBy(d);
        return true;
      }
      case "End": shift ? this.setSelectionPos(this.text.length) : this.setCursorPositionEnd(); return true;
      case "Delete": if (this.enabled) (word ? this.deleteWords(1) : this.deleteFromCursor(1)); return true;
      default:
        if (key.length === 1 && allowed(key) && !(ctrl || meta)) { if (this.enabled) this.writeText(key); return true; }
        return false;
    }
  }
}
