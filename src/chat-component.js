// IChatComponent of Minecraft Java 1.7.10 (ChatComponentText fq, ChatComponentTranslation fr, ChatStyle fn, ClickEvent fh,
// HoverEvent fl) with IChatComponent.Serializer (fk) / ChatStyle.Serializer (fp) over the Gson 2.2.4 port in json-lenient.js, the
// FontRenderer width rules (bold adds one pixel per glyph) and GuiNewChat.func_146237_a, which wraps a component part by part.
// The /tellraw outcomes, wraps, widths and achievement components are replayed from public/research/commands-b13-reference.json
// (tools/probes/CommandsProbe.java) by chat-component.test.js.
import { fromJson, asString, asBoolean, cast, JsonError, JsonArray, JsonObject, JsonPrimitive, JsonNull } from "./json-lenient.js";
import { charWidth } from "./menu-screens.js";
import { LANG } from "./command-data.js";
import { lang } from "./lang.js";

// ---- StatCollector.translateToLocal over the full en_US.lang (lazily imported; the command strings are there at once) ----
let fullLang = null;
export const langReady = import("./lang-en-us.js").then((m) => { fullLang = m.EN_US; }, () => {});
// StringTranslate turns each numeric conversion ("%[n$][digits.]d|f") of the file into "%[n$]s" while loading it.
const asStrings = (v) => v.replace(/%(\d+\$)?[\d.]*[df]/g, "%$1s");
export const translateKey = (key) => { const v = lang.table?.[key] ?? fullLang?.[key] ?? LANG[key]; return v == null ? key : asStrings(v); };

// EnumChatFormatting (a): names, codes; the qf enum adapter maps the lower-case names, so "bold" or "reset" are "colours" too.
export const FORMATTING = Object.freeze({
  black: "0", dark_blue: "1", dark_green: "2", dark_aqua: "3", dark_red: "4", dark_purple: "5", gold: "6", gray: "7", dark_gray: "8", blue: "9",
  green: "a", aqua: "b", red: "c", light_purple: "d", yellow: "e", white: "f", obfuscated: "k", bold: "l", strikethrough: "m", underline: "n", italic: "o", reset: "r",
});
// ClickEvent.Action / HoverEvent.Action canonical names and their allowedInChat flag.
export const CLICK_ACTIONS = Object.freeze({ open_url: true, open_file: false, run_command: true, twitch_user_info: false, suggest_command: true });
export const HOVER_ACTIONS = Object.freeze({ show_text: true, show_achievement: true, show_item: true });

const FLAGS = ["bold", "italic", "underlined", "strikethrough", "obfuscated"];
// ChatStyle: null fields inherit from the parent style (the root style is all false / null).
export class Style {
  constructor(fields = {}) {
    this.color = null; this.bold = null; this.italic = null; this.underlined = null; this.strikethrough = null; this.obfuscated = null;
    this.click = null; this.hover = null; this.parent = null;
    Object.assign(this, fields);
  }
  get(k) {
    for (let s = this; s; s = s.parent) if (s[k] != null) return s[k];
    return FLAGS.includes(k) ? false : null;
  }
  isEmpty() { return this.color == null && FLAGS.every((k) => this[k] == null) && this.click == null && this.hover == null; }
  // ChatStyle.getFormattingCode: colour, then l o n k m.
  code() {
    if (this.isEmpty()) return this.parent ? this.parent.code() : "";
    const c = this.get("color");
    return (c ? "§" + FORMATTING[c] : "") + (this.get("bold") ? "§l" : "") + (this.get("italic") ? "§o" : "") + (this.get("underlined") ? "§n" : "") + (this.get("obfuscated") ? "§k" : "") + (this.get("strikethrough") ? "§m" : "");
  }
  // createDeepCopy: every value resolved, no parent.
  resolved() {
    const s = new Style();
    for (const k of ["color", ...FLAGS, "click", "hover"]) s[k] = this.get(k);
    return s;
  }
  shallow() { return new Style({ color: this.color, bold: this.bold, italic: this.italic, underlined: this.underlined, strikethrough: this.strikethrough, obfuscated: this.obfuscated, click: this.click, hover: this.hover, parent: this.parent }); }
}

class Base {
  constructor() { this.siblings = []; this._style = null; }
  // ChatComponentStyle.getChatStyle: created on first use, the siblings' parent becomes it.
  get style() {
    if (!this._style) { this._style = new Style(); for (const s of this.siblings) s.style.parent = this._style; }
    return this._style;
  }
  setStyle(style) { this._style = style; for (const s of this.siblings) s.style.parent = style; return this; }
  append(c) { c.style.parent = this.style; this.siblings.push(c); return this; }
  // getFormattedText / getUnformattedText over the iteration (componentParts).
  formatted() { return componentParts(this).map((p) => p.style.code() + p.text + "§r").join(""); }
  unformatted() { return componentParts(this).map((p) => p.text).join(""); }
}
export class TextComponent extends Base {
  constructor(text) { super(); this.text = String(text); }
}
export class TranslationComponent extends Base {
  constructor(key, args = []) {
    super();
    this.key = key;
    this.args = args;
    this._children = null;
    for (const a of args) if (a instanceof Base) a.style.parent = this.style;
  }
  setStyle(style) {
    super.setStyle(style);
    for (const a of this.args) if (a instanceof Base) a.style.parent = style;
    for (const c of this._children || []) c.style.parent = style;
    return this;
  }
  // ChatComponentTranslation.initializeFromFormat on translateToLocal(key): "%(?:(\d+)\$)?([A-Za-z%]|$)" splits the pattern,
  // %s takes the next (or numbered) argument, %% is "%", any other conversion is "Unsupported format"; literal runs go through
  // String.format with no arguments. A failure is ChatComponentTranslationFormatException (TranslationError), which the native
  // client does not catch while drawing the chat.
  children() {
    if (this._children) return this._children;
    const format = translateKey(this.key), out = [], re = /%(?:(\d+)\$)?([A-Za-z%]|$)/g;
    const literal = (s) => { const t = new TextComponent(javaFormatNoArgs(s, this)); t.style.parent = this.style; out.push(t); };
    let j = 0, next = 0, m;
    while ((m = re.exec(format))) {
      const k = m.index, l = re.lastIndex;
      if (k > j) literal(format.slice(j, k));
      const whole = format.slice(k, l);
      if (m[2] === "%" && whole === "%%") { const t = new TextComponent("%"); t.style.parent = this.style; out.push(t); }
      else {
        if (m[2] !== "s") throw new TranslationError(this, `Error parsing: ${this.key}: Unsupported format: '${whole}'`);
        const i = m[1] != null ? Number(m[1]) - 1 : next++;
        if (!(i < this.args.length) || i < 0) throw new TranslationError(this, `Invalid index ${i} requested for ${this.key}`);
        const a = this.args[i];
        if (a instanceof Base) out.push(a);
        else { const t = new TextComponent(a == null ? "null" : String(a)); t.style.parent = this.style; out.push(t); }
      }
      j = l;
      if (l === k) re.lastIndex++; // the empty "%$" match at the end
    }
    if (j < format.length) literal(format.slice(j));
    return (this._children = out);
  }
}
export class TranslationError extends Error { constructor(component, msg) { super(msg); this.component = component; } }
// String.format(s) with no arguments: only %% and width-padded %% / %n survive; anything else is an IllegalFormatException.
function javaFormatNoArgs(s, component) {
  if (!s.includes("%")) return s;
  return s.replace(/%(\d+\$)?([-#+ 0,(<]*)(\d+)?(\.\d+)?([tT]?[a-zA-Z%])?/g, (all, pos, flags, width, prec, conv) => {
    if (conv === "%" && !pos && !prec) { const w = Number(width || 0); return flags.includes("-") ? "%".padEnd(w) : "%".padStart(w); }
    if (conv === "n" && !width && !prec && !flags) return "\n";
    throw new TranslationError(component, `Error parsing: ${component.key}: ${conv ? "MissingFormatArgumentException" : "UnknownFormatConversionException"}`);
  });
}

// ChatComponentStyle.iterator(): a text component yields itself then deep copies (resolved styles) of its siblings' iterations;
// a translation yields deep copies of its children's then its siblings' iterations, never itself. Each part is
// { text: getUnformattedTextForChat, style: resolved Style }.
export function componentParts(c) {
  const out = [];
  const walk = (comp, top) => {
    if (comp instanceof TextComponent) out.push({ text: comp.text, style: top ? comp.style.resolved() : comp.style.resolved() });
    else for (const ch of comp.children()) walk(ch, false);
    for (const s of comp.siblings) walk(s, false);
  };
  walk(c, true);
  return out;
}

// ---- IChatComponent.Serializer.deserialize and ChatStyle.Serializer.deserialize ----
function deserialize(json) {
  if (json instanceof JsonPrimitive) return new TextComponent(asString(json));
  if (json instanceof JsonObject) {
    let c;
    if (json.has("text")) c = new TextComponent(asString(json.get("text")));
    else if (json.has("translate")) {
      const key = asString(json.get("translate"));
      if (json.has("with")) {
        const w = cast(json.get("with"), JsonArray);
        if (w == null) throw new JsonError("npe", null);
        const args = w.elements.map((e) => {
          const a = deserialize(e);
          // A plain text argument without style or siblings is passed as its string.
          return a instanceof TextComponent && a.style.isEmpty() && !a.siblings.length ? a.text : a;
        });
        c = new TranslationComponent(key, args);
      } else c = new TranslationComponent(key, []);
    } else throw new JsonError("parse", "Don't know how to turn " + "<json>" + " into a Component");
    if (json.has("extra")) {
      const extra = cast(json.get("extra"), JsonArray);
      if (extra == null) throw new JsonError("npe", null);
      if (extra.elements.length <= 0) throw new JsonError("parse", "Unexpected empty array of components");
      for (const e of extra.elements) {
        const s = deserialize(e);
        if (s == null) throw new JsonError("npe", null);
        c.append(s);
      }
    }
    const style = deserializeStyle(json);
    if (style) c.setStyle(style);
    return c;
  }
  if (json instanceof JsonArray) {
    let base = null;
    for (const e of json.elements) {
      const s = deserialize(e);
      if (base == null) base = s;
      else { if (s == null) throw new JsonError("npe", null); base.append(s); }
    }
    return base;
  }
  throw new JsonError("parse", "Don't know how to turn null into a Component");
}
// The qf enum adapter reading `color` through a JsonTreeReader (Gson wraps its IllegalStateException in JsonSyntaxException).
function colorOf(e) {
  if (e == null || e instanceof JsonNull) return null;
  if (e instanceof JsonPrimitive) {
    if (e.kind === "boolean") { const x = new JsonError("state", "Expected STRING but was BOOLEAN"); x.wrapped = true; throw x; }
    return Object.hasOwn(FORMATTING, e.value) ? e.value : null;
  }
  const x = new JsonError("state", `Expected STRING but was ${e instanceof JsonArray ? "BEGIN_ARRAY" : "BEGIN_OBJECT"}`);
  x.wrapped = true;
  throw x;
}
// context.deserialize(value, IChatComponent): a missing or null value is null, other errors propagate.
const nested = (e) => (e == null || e instanceof JsonNull ? null : deserialize(e));
function deserializeStyle(json) {
  const s = new Style();
  for (const k of FLAGS) if (json.has(k)) s[k] = asBoolean(json.get(k));
  if (json.has("color")) s.color = colorOf(json.get("color"));
  if (json.has("clickEvent")) {
    const ce = cast(json.get("clickEvent"), JsonObject);
    if (ce) {
      const a = cast(ce.get("action"), JsonPrimitive), v = cast(ce.get("value"), JsonPrimitive);
      const action = a == null ? null : asString(a), value = v == null ? null : asString(v);
      if (action != null && Object.hasOwn(CLICK_ACTIONS, action) && value != null && CLICK_ACTIONS[action]) s.click = { action, value };
    }
  }
  if (json.has("hoverEvent")) {
    const he = cast(json.get("hoverEvent"), JsonObject);
    if (he) {
      const a = cast(he.get("action"), JsonPrimitive);
      const action = a == null ? null : asString(a);
      const value = nested(he.get("value"));
      if (action != null && Object.hasOwn(HOVER_ACTIONS, action) && value != null && HOVER_ACTIONS[action]) s.hover = { action, value };
    }
  }
  return s;
}

// CommandMessageRaw.processCommand's parse: { component } (null: an empty document, which the native client cannot display),
// { jsonError } for JsonParseException (the root cause message of commands.tellraw.jsonException, "" without a cause, "null"
// for a cause without a message) or { generic } for the other throwables (commands.generic.exception).
export function parseChatJson(text) {
  try {
    return { component: fromJson(text, deserialize).value };
  } catch (e) {
    if (!(e instanceof JsonError)) throw e;
    if (e.kind === "parse" || e.kind === "io" || e.wrapped) return { jsonError: e.wrapped ? String(e.javaMessage) : "" };
    return { generic: e };
  }
}

// ---- IChatComponent.Serializer.serialize (the S02PacketChat JSON) ----
export function serializeComponent(c) {
  const json = (x) => {
    const st = x._style && !x._style.isEmpty() ? x._style : null;
    if (st == null && x instanceof TextComponent && !x.siblings.length) return x.text;
    const o = {};
    if (st) {
      for (const k of FLAGS) if (st[k] != null) o[k] = st[k];
      if (st.color) o.color = st.color;
      if (st.click) o.clickEvent = { action: st.click.action, value: st.click.value };
      if (st.hover) o.hoverEvent = { action: st.hover.action, value: json(st.hover.value) };
    }
    if (x.siblings.length) o.extra = x.siblings.map(json);
    if (x instanceof TextComponent) o.text = x.text;
    else {
      o.translate = x.key;
      if (x.args.length) o.with = x.args.map((a) => (a instanceof Base ? json(a) : String(a)));
    }
    return o;
  };
  return JSON.stringify(json(c));
}
export const text = (s) => new TextComponent(s);
export const translation = (key, ...args) => new TranslationComponent(key, args);
export const isComponent = (c) => c instanceof Base;

// ---- FontRenderer (ascii.png widths; '§' is -1 and skips its code; bold set by l, cleared by r, adds 1 per glyph) ----
const glyph = (c) => (c === "§" ? -1 : c === " " ? 4 : charWidth(c));
export function fontWidth(s) {
  let w = 0, bold = false;
  for (let i = 0; i < s.length; i++) {
    let k = glyph(s[i]);
    if (k < 0 && i < s.length - 1) {
      const c = s[++i];
      if (c === "l" || c === "L") bold = true;
      else if (c === "r" || c === "R") bold = false;
      k = 0;
    }
    w += k;
    if (bold && k > 0) w++;
  }
  return w;
}
// trimStringToWidth(s, width, false).
export function fontTrim(s, width) {
  let out = "", w = 0, code = false, bold = false;
  for (let j = 0; j < s.length && w < width; j++) {
    const c = s[j], k = glyph(c);
    if (code) { code = false; if (c === "l" || c === "L") bold = true; else if (c === "r" || c === "R") bold = false; }
    else if (k < 0) code = true;
    else { w += k; if (bold) w++; }
    if (w > width) break;
    out += c;
  }
  return out;
}

// GuiNewChat.func_146237_a: the component's parts laid into lines of floor(chatWidth / chatScale) pixels. A part that does not
// fit is trimmed (at its last space when that leaves some width) and the rest becomes the next part; each line is a text
// component "" holding the pieces, piece text = (colours ? code : stripped code) + text, style a shallow copy of the part's.
// Returns [{ text: formatted line, parts: [{ text, style }] }], oldest first.
export function wrapComponent(component, maxWidth, colours = true) {
  const filter = (s) => (colours ? s : s.replace(/§[0-9a-fk-or]/gi, ""));
  const parts = componentParts(component), lines = [];
  let used = 0, line = [];
  const push = () => { lines.push(line); used = 0; line = []; };
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    let s = filter(p.style.code() + p.text), w = fontWidth(s), piece = s, wrapped = false;
    if (used + w > maxWidth) {
      let s1 = fontTrim(s, maxWidth - used), s2 = s1.length < s.length ? s.slice(s1.length) : null;
      if (s2 != null && s2.length > 0) {
        const k = s1.lastIndexOf(" ");
        if (k >= 0 && fontWidth(s.slice(0, k)) > 0) { s1 = s.slice(0, k); s2 = s.slice(k); }
        parts.splice(i + 1, 0, { text: s2, style: p.style });
      }
      w = fontWidth(s1);
      piece = s1;
      wrapped = true;
    }
    if (used + w <= maxWidth) { used += w; line.push({ text: piece, style: p.style }); }
    else wrapped = true;
    if (wrapped) push();
  }
  lines.push(line);
  return lines.map((ps) => ({ text: "§r" + ps.map((q) => q.style.code() + q.text + "§r").join(""), parts: ps }));
}
// GuiNewChat.func_146236_a within a line: the piece whose cumulative width (raw text, codes stripped when colours are off) passes x.
export function partAt(line, x, colours = true) {
  let w = 0;
  for (const p of line.parts || []) {
    w += fontWidth(colours ? p.text : p.text.replace(/§[0-9a-fk-or]/gi, ""));
    if (w > x) return p;
  }
  return null;
}

// GuiScreen.func_146283_a / GuiChat.drawScreen hover text: show_text splits getFormattedText at "\n"; show_achievement shows the
// stat name, the italic "Achievement"/"Statistic" type and an achievement's description wrapped to 150; show_item reads the
// value's unformatted text as JSON-NBT for an item tooltip (`item(text)` returns the lines or null for "Invalid Item!").
export function hoverLines(hover, { stat, item } = {}) {
  if (!hover) return null;
  if (hover.action === "show_text") return hover.value.formatted().split("\n");
  if (hover.action === "show_achievement") {
    const info = stat?.(hover.value.unformatted());
    if (!info) return ["§cInvalid statistic/achievement!"];
    const lines = [info.name, "§o" + translateKey("stats.tooltip.type." + (info.achievement ? "achievement" : "statistic")) + "§r"];
    if (info.description) lines.push(...wrapPlain(info.description, 150));
    return lines;
  }
  if (hover.action === "show_item") return item?.(hover.value.unformatted()) ?? ["§cInvalid Item!"];
  return null;
}
// FontRenderer.listFormattedStringToWidth for a plain description.
function wrapPlain(s, width) {
  const out = [];
  for (const para of s.split("\n")) {
    let rest = para;
    while (fontWidth(rest) > width) {
      let cut = fontTrim(rest, width).length;
      const sp = rest.lastIndexOf(" ", cut);
      if (sp > 0) cut = sp;
      if (cut <= 0) cut = 1;
      out.push(rest.slice(0, cut));
      rest = rest.slice(cut).replace(/^ /, "");
    }
    out.push(rest);
  }
  return out;
}
