// Batch 69 mptabcomplete: GuiChat's tab completion while connected (the client half of C14PacketTabComplete / S3APacketTabComplete).
// Bytecode-read from the unchanged GuiChat (bct): func_146404_p_ (a()), func_146405_a (a(String, String)) and func_146406_a (a(String[])), see the track note.
//  * Tab with no completion running (field_146414_r false): the word start is the last space before the cursor + 1; the candidate list is cleared and C14 is sent with the text
//    BEFORE the cursor (only when it is at least 1 character; that sets the "waiting" flag field_146415_s). The list is still empty, so nothing else happens now.
//  * The reply (only taken while waiting): completing is switched off, the non-empty strings become the list, and StringUtils.getCommonPrefix of ALL replied strings is computed.
//    If it is non-empty and the text from the word start to the END of the text does not equal it (ignoring case), the word before the cursor is replaced by the prefix and
//    that is all (completing stays off: the next Tab asks again). Otherwise, with a non-empty list, completing is switched on and the Tab step below runs at once.
//  * Tab while completing: the word before the cursor is deleted; an index past the end wraps to 0; with more than one candidate they are all printed to chat joined by ", "
//    (chat line id 1); the candidate at the index is inserted and the index advances.
//  * Any other key resets completing (GuiChat.keyTyped); the caller calls reset().
export const wordStart = (text, cursor) => text.lastIndexOf(' ', cursor - 1) + 1; // GuiTextField.func_146197_a(-1, cursor, false)
/** org.apache.commons.lang3.StringUtils.getCommonPrefix. */
export function commonPrefix(strings) {
  if (!strings.length) return '';
  let prefix = strings[0];
  for (const s of strings) { let i = 0; while (i < prefix.length && i < s.length && prefix[i] === s[i]) i++; prefix = prefix.slice(0, i); if (!prefix) break; }
  return prefix;
}
export class RemoteTabCompletion {
  constructor() { this.reset(); this.waiting = false; }
  reset() { this.completing = false; this.list = []; this.index = 0; }
  // Tab. request(textBeforeCursor) sends C14. Returns { text, cursor } or null.
  press(text, cursor, request, print) {
    if (!this.completing) {
      this.list = []; this.index = 0;
      const before = text.slice(0, cursor);
      if (before.length >= 1) { request(before); this.waiting = true; }
      return null;
    }
    const start = wordStart(text, cursor);
    text = text.slice(0, start) + text.slice(cursor); cursor = start;
    if (this.index >= this.list.length) this.index = 0;
    if (this.list.length > 1) print(this.list.join(', '));
    const word = this.list[this.index++];
    return { text: text.slice(0, cursor) + word + text.slice(cursor), cursor: cursor + word.length };
  }
  // S3A with the current input text and cursor. Returns { text, cursor } or null.
  reply(options, text, cursor, print) {
    if (!this.waiting) return null;
    this.completing = false;
    this.list = options.filter((o) => o.length > 0);
    const start = wordStart(text, cursor), prefix = commonPrefix(options);
    if (prefix.length > 0 && text.slice(start).toLowerCase() !== prefix.toLowerCase()) {
      return { text: text.slice(0, start) + prefix + text.slice(cursor), cursor: start + prefix.length };
    }
    if (this.list.length > 0) { this.completing = true; return this.press(text, cursor, () => {}, print); }
    return null;
  }
}
