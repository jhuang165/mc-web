// GuiNewChat / GuiChat of Minecraft Java 1.7.10 as a DOM-free model (chat-ui.js draws it). Constants and formulas come from the
// javap output asserted by tools/verify-commands.mjs into public/research/commands-reference.json: 100 stored lines, 100 sent
// messages, 9-pixel lines, fade over 200 ticks with alpha (10 * (1 - age / 200))^2 clamped to 0..1, chat width 40 + 280 * chatWidth
// (320), focused height 20 + 160 * chatHeightFocused (180 = 20 lines), unfocused 20 + 160 * 0.44366196 (90 = 10 lines), opacity
// 0.9 * chatOpacity + 0.1. Tab completion follows GuiChat.func_146404_p_ (cycle through the candidates, list them in chat).
import { splitLines, textWidth } from "./menu-screens.js";

export const CHAT = Object.freeze({
  maxLines: 100, maxSent: 100, lineHeight: 9, fadeTicks: 200, inputMaxLength: 100,
  defaults: Object.freeze({ chatScale: 1, chatWidth: 1, chatHeightFocused: 1, chatHeightUnfocused: 0.44366196, chatOpacity: 1 }),
});
const f = Math.fround;
// GuiNewChat.func_146233_a (width) and func_146243_b (height): MathHelper.floor_float(v * (max - min) + min).
export const chatWidth = (v) => Math.floor(f(f(v * 280) + 40));
export const chatHeight = (v) => Math.floor(f(f(v * 160) + 20));
// ChatAllowedCharacters.isAllowedCharacter: no section sign, control characters or DEL.
export const allowedText = (s) => String(s).replace(/[§\u0000-\u001f\u007f]/g, "");
// EnumChatFormatting codes, for carrying a colour over a wrapped line (FontRenderer.getFormatFromString).
export function formatFrom(s) {
  let fmt = "";
  for (let i = 0; i < s.length - 1; i++) {
    if (s[i] !== "§") continue;
    const c = s[++i].toLowerCase();
    if ("0123456789abcdef".includes(c)) fmt = "§" + c;
    else if (c === "r") fmt = "";
    else if ("klmno".includes(c)) fmt += "§" + c;
  }
  return fmt;
}

// EnumChatFormatting.getTextWithoutFormattingCodes: Pattern "(?i)\u00a7[0-9A-FK-OR]" removed from the text.
export const stripFormatting = (s) => String(s).replace(/§[0-9a-fk-or]/gi, "");
// EnumChatVisibility (zb): ordinal, name and the options.chat.visibility.* key (en_US: Shown, Commands Only, Hidden).
export const CHAT_VISIBILITY = Object.freeze([
  { name: "FULL", key: "options.chat.visibility.full" }, { name: "SYSTEM", key: "options.chat.visibility.system" }, { name: "HIDDEN", key: "options.chat.visibility.hidden" },
]);
// NetHandlerPlayServer.sendPacket (nh.a(ft)) drops an S02PacketChat when the player's visibility is HIDDEN, and under SYSTEM
// drops it unless gj.d() (the "system" flag: command feedback, death/achievement broadcasts and server notices) is set; player
// chat is sent with the flag false. Everything the server prints to this client goes through here, including the
// chat.cannotSend reply, which is itself a gj and so is dropped under HIDDEN.
export const chatDelivered = (visibility, system) => visibility === 0 || (visibility === 1 && !!system);
// Minecraft.runTick: key.chat / key.command only open GuiChat when chatVisibility != HIDDEN.
export const chatCanOpen = (visibility) => visibility !== 2;
// GuiChat.mouseClicked links: ClickEvent actions with a URL are limited to the Set GuiChat.field_152175_f (http, https).
export function linkUrlAllowed(url) {
  const m = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(String(url));
  return !!m && (m[1].toLowerCase() === "http" || m[1].toLowerCase() === "https");
}
// ScreenShotHelper.func_148259_a: the next free name for `date` under yyyy-MM-dd_HH.mm.ss, "_N.png" from N = 1 when taken.
export function screenshotName(date, taken = () => false) {
  const p = (n, w = 2) => String(n).padStart(w, "0");
  const base = `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}_${p(date.getHours())}.${p(date.getMinutes())}.${p(date.getSeconds())}`;
  for (let i = 1; ; i++) {
    const name = base + (i === 1 ? "" : "_" + i) + ".png";
    if (!taken(name)) return name;
  }
}

// The spans of `links` inside one wrapped line, as raw character ranges (colour codes counted).
function linkSpans(part, links) {
  const out = [];
  for (const { text, click } of links || []) {
    if (!text) continue;
    const start = part.indexOf(text);
    if (start >= 0) out.push({ start, end: start + text.length, click: { ...click, text } });
  }
  return out;
}

export class ChatLog {
  constructor(settings = {}) {
    this.settings = { ...CHAT.defaults, chatColors: true, chatLinks: true, chatLinksPrompt: true, chatVisibility: 0, ...settings };
    this.history = []; // GuiNewChat.chatLines, newest first: { text, created, id, links }
    this.lines = []; // newest first: { text, created, id, links }
    this.sent = []; // GuiNewChat.sentMessages, oldest first
    this.scrollPos = 0;
    this.newSinceScroll = false;
    this.listeners = new Set();
  }
  // GameSettings chat options -> this model; the lines are rewrapped (GuiNewChat.func_146245_b) when width, scale or colours changed.
  applySettings(opts = {}) {
    const keys = ["chatVisibility", "chatColors", "chatLinks", "chatLinksPrompt", "chatOpacity", "chatScale", "chatWidth", "chatHeightFocused", "chatHeightUnfocused"];
    const before = keys.map((k) => this.settings[k]).join();
    for (const k of keys) if (opts[k] !== undefined) this.settings[k] = opts[k];
    if (keys.map((k) => this.settings[k]).join() !== before) { this.refresh(); this.scroll(0); }
  }
  get width() { return chatWidth(this.settings.chatWidth); }
  visibleLines(open) { return Math.floor(chatHeight(open ? this.settings.chatHeightFocused : this.settings.chatHeightUnfocused) / CHAT.lineHeight); }
  // GuiNewChat.func_146237_a: wrapped to floor(width / scale), the newest line first; a non-refresh print while scrolled
  // scrolls one line so the view stays put and flags new messages. `id` replaces the earlier lines of the same id.
  // `links` are { text, click: { action, value } } entries: where `text` appears the span is clickable (a ClickEvent).
  print(text, tick = 0, id = 0, links = []) {
    if (id) this.history = this.history.filter((l) => l.id !== id);
    this.history.unshift({ text: String(text), created: tick, id, links });
    while (this.history.length > CHAT.maxLines) this.history.pop();
    const parts = this.layout(String(text), tick, id, links, false);
    for (const fn of this.listeners) fn();
    return parts;
  }
  // GuiNewChat.func_146237_a: the colour codes go when chatColours is off (func_146235_b), then the wrapped lines are added.
  layout(text, tick, id, links, refresh) {
    if (id) this.lines = this.lines.filter((l) => l.id !== id);
    if (this.settings.chatColors === false) text = stripFormatting(text);
    const wrapped = splitLines(text, Math.floor(this.width / this.settings.chatScale));
    let carry = "";
    const parts = wrapped.map((line) => { const out = carry + line; carry = formatFrom(out); return out; });
    for (const part of parts) {
      if (!refresh && this.scrollPos > 0) { this.newSinceScroll = true; this.scroll(1); }
      this.lines.unshift({ text: part, created: tick, id, links: linkSpans(part, links) });
    }
    while (this.lines.length > CHAT.maxLines) this.lines.pop();
    return parts;
  }
  // GuiNewChat.func_146245_b (refreshChat): rebuild every drawn line from the stored messages after width, scale or colours change.
  refresh() {
    this.lines = [];
    for (let i = this.history.length - 1; i >= 0; i--) { const h = this.history[i]; this.layout(h.text, h.created, h.id, h.links, true); }
    for (const fn of this.listeners) fn();
  }
  // GuiNewChat.func_146236_a for the point (x, gy) in GUI pixels from the line area's bottom left: the ClickEvent under it.
  clickAt(x, gy) {
    if (gy < 0) return null;
    const row = Math.floor(gy / CHAT.lineHeight);
    if (row >= this.visibleLines(true)) return null;
    const line = this.lines[row + this.scrollPos];
    if (!line) return null;
    for (const l of line.links || []) if (x >= textWidth(line.text.slice(0, l.start)) && x < textWidth(line.text.slice(0, l.end))) return l.click;
    return null;
  }
  // GuiNewChat.func_146229_b: clamp to [0, size - visible]; reaching the bottom clears the new-message flag.
  scroll(n, open = true) {
    this.scrollPos = Math.max(0, Math.min(this.scrollPos + n, this.lines.length - this.visibleLines(open)));
    if (this.scrollPos <= 0) { this.scrollPos = 0; this.newSinceScroll = false; }
  }
  resetScroll() { this.scrollPos = 0; this.newSinceScroll = false; }
  clear() { this.lines = []; this.history = []; this.resetScroll(); for (const fn of this.listeners) fn(); }
  // GuiNewChat.addToSentMessages: the same message twice in a row is kept once; the list holds 100.
  addSent(text) {
    if (!this.sent.length || this.sent[this.sent.length - 1] !== text) this.sent.push(text);
    while (this.sent.length > CHAT.maxSent) this.sent.shift();
  }
  // GuiNewChat.drawChat for tick `tick`: the drawn lines from the bottom (index 0) up with their 0..255 alpha. The line rectangle
  // is alpha / 2 black and the text white at the full alpha; nothing is drawn at alpha <= 3.
  draw(tick, open) {
    const out = [], visible = this.visibleLines(open), count = Math.min(this.lines.length - this.scrollPos, visible);
    const opacity = f(f(this.settings.chatOpacity * 0.9) + 0.1);
    for (let i = 0; i < count; i++) {
      const line = this.lines[i + this.scrollPos], age = tick - line.created;
      if (!line || (age >= CHAT.fadeTicks && !open)) continue;
      let d = Math.min(Math.max((1 - age / 200) * 10, 0), 1);
      d *= d;
      let alpha = Math.trunc(255 * d);
      if (open) alpha = 255;
      alpha = Math.trunc(alpha * opacity);
      if (alpha > 3) out.push({ row: i, text: line.text, alpha });
    }
    return out;
  }
  // The scroll bar GuiNewChat draws while the chat is open and the lines overflow (0xCC3333 once new messages arrived while scrolled).
  scrollBar(open = true) {
    const visible = this.visibleLines(open), total = this.lines.length;
    if (total <= visible) return null;
    const height = visible * CHAT.lineHeight, bar = Math.max(1, Math.trunc((visible * height) / total));
    return { height: bar, offset: Math.trunc((this.scrollPos * height) / total), newMessages: this.newSinceScroll, alpha: this.scrollPos > 0 ? 170 : 96 };
  }
}

// GuiChat.getSentHistory(dir): sentHistoryCursor walks the sent messages; one past the newest restores what was being typed.
export class SentHistory {
  constructor(log) { this.log = log; this.cursor = log.sent.length; this.buffer = ""; }
  reset() { this.cursor = this.log.sent.length; this.buffer = ""; }
  step(dir, text) {
    const size = this.log.sent.length, i = Math.max(0, Math.min(this.cursor + dir, size));
    if (i === this.cursor) return text;
    if (i === size) { this.cursor = size; return this.buffer; }
    if (this.cursor === size) this.buffer = text;
    this.cursor = i;
    return this.log.sent[i];
  }
}

// GuiChat.func_146404_p_ with the server's tab-complete reply: the word before the cursor is replaced by each candidate in turn;
// with several candidates they are printed to chat joined by ", " (replacing the previous list, id 1) on every Tab press.
export class TabCompletion {
  constructor() { this.reset(); }
  reset() { this.active = false; this.list = []; this.index = 0; this.start = 0; this.end = 0; }
  // complete(textBeforeCursor) -> candidate strings for the last word. Returns the new { text, cursor } or null.
  next(text, cursor, complete, print) {
    if (this.active) {
      if (this.index >= this.list.length) this.index = 0;
      text = text.slice(0, this.start) + text.slice(this.end);
      cursor = this.start;
    } else {
      this.start = text.lastIndexOf(" ", cursor - 1) + 1;
      const found = complete(text.slice(0, cursor)) || [];
      if (!found.length) return null;
      this.list = found;
      this.index = 0;
      this.active = true;
      text = text.slice(0, this.start) + text.slice(cursor);
      cursor = this.start;
    }
    if (this.list.length > 1) print(this.list.join(", "));
    const word = this.list[this.index++];
    this.end = this.start + word.length;
    return { text: text.slice(0, this.start) + word + text.slice(this.start), cursor: this.end };
  }
}
export { textWidth };
