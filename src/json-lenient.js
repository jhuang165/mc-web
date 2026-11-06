// Gson 2.2.4 (the version the 1.7.10 client ships) as IChatComponent.Serializer uses it: Gson.fromJson(String, Class) reads
// with a lenient com.google.gson.stream.JsonReader into the JsonElement tree (Streams.parse / TypeAdapters.JSON_ELEMENT), then
// restores non-lenient mode for assertFullConsumption, so trailing content fails with the "setLenient" message. Lenient means:
// unquoted and single-quoted names and strings, ';' between members, '=' and '=>' after names, '//' '#' and '/* */' comments,
// the ")]}'\n" prefix, case-mixed true/false/null keywords and empty array slots as null. Error messages and their
// "at line L column C" positions follow the reader; public/research/commands-b13-reference.json records the native outcomes.

export class JsonError extends Error {
  // kind: "malformed" (MalformedJsonException), "eof" (EOFException), "number" (NumberFormatException), "state"
  // (IllegalStateException), "unsupported" (UnsupportedOperationException), "cast" (ClassCastException), "parse"
  // (JsonParseException without a cause) and "npe".
  constructor(kind, message) { super(message ?? ""); this.kind = kind; this.javaMessage = message; }
}

// The JsonElement tree. JsonObject keeps insertion order with a re-put key keeping its place (LinkedTreeMap).
export class JsonNull { get type() { return "null"; } }
export const JSON_NULL = new JsonNull();
export class JsonPrimitive {
  // kind "string" | "number" | "boolean"; value is the string, the number's text or the boolean.
  constructor(kind, value) { this.kind = kind; this.value = value; }
  get type() { return "primitive"; }
}
export class JsonArray { constructor() { this.elements = []; } get type() { return "array"; } }
export class JsonObject {
  constructor() { this.members = new Map(); }
  get type() { return "object"; }
  has(k) { return this.members.has(k); }
  get(k) { return this.members.get(k) ?? null; }
}
const simpleName = (e) => ({ null: "JsonNull", primitive: "JsonPrimitive", array: "JsonArray", object: "JsonObject" })[e.type];

// JsonElement.getAsString / getAsBoolean / getAs* casts with the exceptions Gson throws.
export function asString(e) {
  if (e instanceof JsonPrimitive) return e.kind === "boolean" ? String(e.value) : e.value;
  if (e instanceof JsonArray) { if (e.elements.length === 1) return asString(e.elements[0]); throw new JsonError("state", null); }
  throw new JsonError("unsupported", simpleName(e));
}
export function asBoolean(e) {
  if (e instanceof JsonPrimitive) return e.kind === "boolean" ? e.value : String(e.value).toLowerCase() === "true";
  if (e instanceof JsonArray) { if (e.elements.length === 1) return asBoolean(e.elements[0]); throw new JsonError("state", null); }
  throw new JsonError("unsupported", simpleName(e));
}
export function cast(e, Type) {
  if (e == null || e instanceof Type) return e;
  throw new JsonError("cast", `class com.google.gson.${simpleName(e)} cannot be cast to class com.google.gson.${Type.name}`);
}

const EMPTY_ARRAY = 1, NONEMPTY_ARRAY = 2, EMPTY_OBJECT = 3, DANGLING_NAME = 4, NONEMPTY_OBJECT = 5, EMPTY_DOCUMENT = 6, NONEMPTY_DOCUMENT = 7;
const P = { NONE: 0, BEGIN_OBJECT: 1, END_OBJECT: 2, BEGIN_ARRAY: 3, END_ARRAY: 4, TRUE: 5, FALSE: 6, NULL: 7, SINGLE_QUOTED: 8, DOUBLE_QUOTED: 9, UNQUOTED: 10, SINGLE_QUOTED_NAME: 12, DOUBLE_QUOTED_NAME: 13, UNQUOTED_NAME: 14, LONG: 15, NUMBER: 16, EOF: 17 };
const TOKEN = { 1: "BEGIN_OBJECT", 2: "END_OBJECT", 3: "BEGIN_ARRAY", 4: "END_ARRAY", 5: "BOOLEAN", 6: "BOOLEAN", 7: "NULL", 8: "STRING", 9: "STRING", 10: "STRING", 12: "NAME", 13: "NAME", 14: "NAME", 15: "NUMBER", 16: "NUMBER", 17: "END_DOCUMENT" };
const MIN_LONG = -(2n ** 63n), MIN_INCOMPLETE = MIN_LONG / 10n;

// com.google.gson.stream.JsonReader over the whole string as its buffer (the 1024-char refills only shift positions).
export class JsonReader {
  constructor(text) {
    this.buf = String(text);
    this.pos = 0; this.limit = this.buf.length; this.lineNumber = 0; this.lineStart = 0;
    // fillBuffer: a leading byte order mark is skipped.
    if (this.buf.charCodeAt(0) === 0xfeff) { this.pos++; this.lineStart++; }
    this.lenient = false; this.peeked = P.NONE; this.stack = [EMPTY_DOCUMENT];
  }
  syntaxError(msg) { return new JsonError("malformed", `${msg} at line ${this.lineNumber + 1} column ${this.pos - this.lineStart + 1}`); }
  checkLenient() { if (!this.lenient) throw this.syntaxError("Use JsonReader.setLenient(true) to accept malformed JSON"); }
  where() { return ` at line ${this.lineNumber + 1} column ${this.pos - this.lineStart + 1}`; }
  peek() { return TOKEN[this.peeked === P.NONE ? this.doPeek() : this.peeked]; }
  doPeek() {
    const st = this.stack, top = st.length - 1, peekStack = st[top];
    if (peekStack === EMPTY_ARRAY) st[top] = NONEMPTY_ARRAY;
    else if (peekStack === NONEMPTY_ARRAY) {
      const c = this.nextNonWhitespace(true);
      if (c === "]") return (this.peeked = P.END_ARRAY);
      if (c === ";") this.checkLenient();
      else if (c !== ",") throw this.syntaxError("Unterminated array");
    } else if (peekStack === EMPTY_OBJECT || peekStack === NONEMPTY_OBJECT) {
      st[top] = DANGLING_NAME;
      if (peekStack === NONEMPTY_OBJECT) {
        const c = this.nextNonWhitespace(true);
        if (c === "}") return (this.peeked = P.END_OBJECT);
        if (c === ";") this.checkLenient();
        else if (c !== ",") throw this.syntaxError("Unterminated object");
      }
      const c = this.nextNonWhitespace(true);
      if (c === '"') return (this.peeked = P.DOUBLE_QUOTED_NAME);
      if (c === "'") { this.checkLenient(); return (this.peeked = P.SINGLE_QUOTED_NAME); }
      if (c === "}") {
        if (peekStack !== NONEMPTY_OBJECT) return (this.peeked = P.END_OBJECT);
        throw this.syntaxError("Expected name");
      }
      this.checkLenient();
      this.pos--;
      if (this.isLiteral(c)) return (this.peeked = P.UNQUOTED_NAME);
      throw this.syntaxError("Expected name");
    } else if (peekStack === DANGLING_NAME) {
      st[top] = NONEMPTY_OBJECT;
      const c = this.nextNonWhitespace(true);
      if (c === "=") { this.checkLenient(); if (this.pos < this.limit && this.buf[this.pos] === ">") this.pos++; }
      else if (c !== ":") throw this.syntaxError("Expected ':'");
    } else if (peekStack === EMPTY_DOCUMENT) {
      if (this.lenient) this.consumeNonExecutePrefix();
      st[top] = NONEMPTY_DOCUMENT;
    } else if (peekStack === NONEMPTY_DOCUMENT) {
      const c = this.nextNonWhitespace(false);
      if (c === -1) return (this.peeked = P.EOF);
      this.checkLenient();
      this.pos--;
    }
    const c = this.nextNonWhitespace(true);
    switch (c) {
      case "]":
        if (peekStack === EMPTY_ARRAY) return (this.peeked = P.END_ARRAY);
      // fall through
      case ";":
      case ",":
        if (peekStack === EMPTY_ARRAY || peekStack === NONEMPTY_ARRAY) { this.checkLenient(); this.pos--; return (this.peeked = P.NULL); }
        throw this.syntaxError("Unexpected value");
      case "'": this.checkLenient(); return (this.peeked = P.SINGLE_QUOTED);
      case '"': if (st.length === 1) this.checkLenient(); return (this.peeked = P.DOUBLE_QUOTED);
      case "[": return (this.peeked = P.BEGIN_ARRAY);
      case "{": return (this.peeked = P.BEGIN_OBJECT);
      default: this.pos--;
    }
    if (st.length === 1) this.checkLenient();
    let result = this.peekKeyword();
    if (result !== P.NONE) return result;
    result = this.peekNumber();
    if (result !== P.NONE) return result;
    if (!this.isLiteral(this.buf[this.pos])) throw this.syntaxError("Expected value");
    this.checkLenient();
    return (this.peeked = P.UNQUOTED);
  }
  peekKeyword() {
    const b = this.buf, c = b[this.pos];
    let kw, up, peeking;
    if (c === "t" || c === "T") [kw, up, peeking] = ["true", "TRUE", P.TRUE];
    else if (c === "f" || c === "F") [kw, up, peeking] = ["false", "FALSE", P.FALSE];
    else if (c === "n" || c === "N") [kw, up, peeking] = ["null", "NULL", P.NULL];
    else return P.NONE;
    for (let i = 1; i < kw.length; i++) {
      if (this.pos + i >= this.limit) return P.NONE;
      const d = b[this.pos + i];
      if (d !== kw[i] && d !== up[i]) return P.NONE;
    }
    if (this.pos + kw.length < this.limit && this.isLiteral(b[this.pos + kw.length])) return P.NONE;
    this.pos += kw.length;
    return (this.peeked = peeking);
  }
  peekNumber() {
    const b = this.buf, p = this.pos, l = this.limit;
    let value = 0n, negative = false, fits = true, last = 0, i = 0;
    // NUMBER_CHAR_NONE 0, SIGN 1, DIGIT 2, DECIMAL 3, FRACTION_DIGIT 4, EXP_E 5, EXP_SIGN 6, EXP_DIGIT 7
    for (; ; i++) {
      if (p + i === l) { if (i === 1024) return P.NONE; break; }
      const c = b[p + i];
      if (c === "-") {
        if (last === 0) { negative = true; last = 1; continue; }
        if (last === 5) { last = 6; continue; }
        return P.NONE;
      } else if (c === "+") {
        if (last === 5) { last = 6; continue; }
        return P.NONE;
      } else if (c === "e" || c === "E") {
        if (last === 2 || last === 4) { last = 5; continue; }
        return P.NONE;
      } else if (c === ".") {
        if (last === 2) { last = 3; continue; }
        return P.NONE;
      } else if (c < "0" || c > "9") {
        if (!this.isLiteral(c)) break;
        return P.NONE;
      } else if (last === 1 || last === 0) { value = -BigInt(c.charCodeAt(0) - 48); last = 2; }
      else if (last === 2) {
        if (value === 0n) return P.NONE; // a leading '0' (could be octal)
        const next = value * 10n - BigInt(c.charCodeAt(0) - 48);
        fits &&= value > MIN_INCOMPLETE || (value === MIN_INCOMPLETE && next < value);
        value = next;
      } else if (last === 3) last = 4;
      else if (last === 5 || last === 6) last = 7;
    }
    if (last === 2 && fits && (value !== MIN_LONG || negative)) {
      this.peekedLong = negative ? value : -value;
      this.pos += i;
      return (this.peeked = P.LONG);
    }
    if (last === 2 || last === 4 || last === 7) { this.peekedNumberLength = i; return (this.peeked = P.NUMBER); }
    return P.NONE;
  }
  isLiteral(c) {
    switch (c) {
      case "/": case "\\": case ";": case "#": case "=":
        this.checkLenient();
      // fall through
      case "{": case "}": case "[": case "]": case ":": case ",": case " ": case "\t": case "\f": case "\r": case "\n":
        return false;
      default:
        return true;
    }
  }
  nextNonWhitespace(throwOnEof) {
    const b = this.buf;
    let p = this.pos;
    while (p < this.limit) {
      const c = b[p++];
      if (c === "\n") { this.lineNumber++; this.lineStart = p; continue; }
      if (c === " " || c === "\r" || c === "\t") continue;
      if (c === "/") {
        this.pos = p;
        if (p === this.limit) return c;
        this.checkLenient();
        const peek = b[this.pos];
        if (peek === "*") {
          this.pos++;
          if (!this.skipTo("*/")) throw this.syntaxError("Unterminated comment");
          p = this.pos + 2;
          continue;
        }
        if (peek === "/") { this.pos++; this.skipToEndOfLine(); p = this.pos; continue; }
        return c;
      }
      if (c === "#") { this.pos = p; this.checkLenient(); this.skipToEndOfLine(); p = this.pos; continue; }
      this.pos = p;
      return c;
    }
    this.pos = p;
    if (throwOnEof) throw new JsonError("eof", "End of input" + this.where());
    return -1;
  }
  skipToEndOfLine() {
    while (this.pos < this.limit) {
      const c = this.buf[this.pos++];
      if (c === "\n") { this.lineNumber++; this.lineStart = this.pos; break; }
      if (c === "\r") break;
    }
  }
  skipTo(s) {
    for (; this.pos + s.length <= this.limit; this.pos++) {
      if (this.buf[this.pos] === "\n") { this.lineNumber++; this.lineStart = this.pos + 1; continue; }
      if (this.buf.startsWith(s, this.pos)) return true;
    }
    return false;
  }
  consumeNonExecutePrefix() {
    this.nextNonWhitespace(true);
    this.pos--;
    if (this.buf.startsWith(")]}'\n", this.pos)) this.pos += 5;
  }
  nextQuotedValue(quote) {
    const b = this.buf;
    let out = "", start = this.pos, p = this.pos;
    while (p < this.limit) {
      const c = b[p++];
      if (c === quote) { this.pos = p; return out + b.slice(start, p - 1); }
      if (c === "\\") { this.pos = p; out += b.slice(start, p - 1) + this.readEscapeCharacter(); p = start = this.pos; }
      else if (c === "\n") { this.lineNumber++; this.lineStart = p; }
    }
    this.pos = p;
    throw this.syntaxError("Unterminated string");
  }
  readEscapeCharacter() {
    if (this.pos === this.limit) throw this.syntaxError("Unterminated escape sequence");
    const e = this.buf[this.pos++];
    switch (e) {
      case "u": {
        if (this.pos + 4 > this.limit) throw this.syntaxError("Unterminated escape sequence");
        const hex = this.buf.slice(this.pos, this.pos + 4);
        if (!/^[0-9a-fA-F]{4}$/.test(hex)) throw new JsonError("number", "\\u" + hex);
        this.pos += 4;
        return String.fromCharCode(parseInt(hex, 16));
      }
      case "t": return "\t";
      case "b": return "\b";
      case "n": return "\n";
      case "r": return "\r";
      case "f": return "\f";
      case "\n": this.lineNumber++; this.lineStart = this.pos; return e;
      default: return e;
    }
  }
  nextUnquotedValue() {
    let i = 0;
    for (; this.pos + i < this.limit; i++) {
      const c = this.buf[this.pos + i];
      if ("/\\;#=".includes(c)) { this.checkLenient(); break; }
      if ("{}[]:, \t\f\r\n".includes(c)) break;
    }
    const s = this.buf.slice(this.pos, this.pos + i);
    this.pos += i;
    return s;
  }
  expect(p, what) {
    if (this.peeked === P.NONE) this.doPeek();
    if (this.peeked !== p) throw new JsonError("state", `Expected ${what} but was ${this.peek()}${this.where()}`);
    this.peeked = P.NONE;
  }
  beginArray() { this.expect(P.BEGIN_ARRAY, "BEGIN_ARRAY"); this.stack.push(EMPTY_ARRAY); }
  endArray() { this.expect(P.END_ARRAY, "END_ARRAY"); this.stack.pop(); }
  beginObject() { this.expect(P.BEGIN_OBJECT, "BEGIN_OBJECT"); this.stack.push(EMPTY_OBJECT); }
  endObject() { this.expect(P.END_OBJECT, "END_OBJECT"); this.stack.pop(); }
  hasNext() { const p = this.peeked === P.NONE ? this.doPeek() : this.peeked; return p !== P.END_OBJECT && p !== P.END_ARRAY; }
  nextName() {
    const p = this.peeked === P.NONE ? this.doPeek() : this.peeked;
    let r;
    if (p === P.UNQUOTED_NAME) r = this.nextUnquotedValue();
    else if (p === P.SINGLE_QUOTED_NAME) r = this.nextQuotedValue("'");
    else if (p === P.DOUBLE_QUOTED_NAME) r = this.nextQuotedValue('"');
    else throw new JsonError("state", `Expected a name but was ${this.peek()}${this.where()}`);
    this.peeked = P.NONE;
    return r;
  }
  nextString() {
    const p = this.peeked === P.NONE ? this.doPeek() : this.peeked;
    let r;
    if (p === P.UNQUOTED) r = this.nextUnquotedValue();
    else if (p === P.SINGLE_QUOTED) r = this.nextQuotedValue("'");
    else if (p === P.DOUBLE_QUOTED) r = this.nextQuotedValue('"');
    else if (p === P.LONG) r = this.peekedLong.toString();
    else if (p === P.NUMBER) { r = this.buf.slice(this.pos, this.pos + this.peekedNumberLength); this.pos += this.peekedNumberLength; }
    else throw new JsonError("state", `Expected a string but was ${this.peek()}${this.where()}`);
    this.peeked = P.NONE;
    return r;
  }
  nextBoolean() {
    const p = this.peeked === P.NONE ? this.doPeek() : this.peeked;
    if (p === P.TRUE || p === P.FALSE) { this.peeked = P.NONE; return p === P.TRUE; }
    throw new JsonError("state", `Expected a boolean but was ${this.peek()}${this.where()}`);
  }
  nextNull() { this.expect(P.NULL, "null"); }
}

// TypeAdapters.JSON_ELEMENT.read.
function readElement(r) {
  switch (r.peek()) {
    case "STRING": return new JsonPrimitive("string", r.nextString());
    case "NUMBER": return new JsonPrimitive("number", r.nextString());
    case "BOOLEAN": return new JsonPrimitive("boolean", r.nextBoolean());
    case "NULL": r.nextNull(); return JSON_NULL;
    case "BEGIN_ARRAY": {
      const a = new JsonArray();
      r.beginArray();
      while (r.hasNext()) a.elements.push(readElement(r));
      r.endArray();
      return a;
    }
    case "BEGIN_OBJECT": {
      const o = new JsonObject();
      r.beginObject();
      while (r.hasNext()) { const k = r.nextName(); o.members.set(k, readElement(r)); }
      r.endObject();
      return o;
    }
    default: throw new Error("IllegalArgumentException");
  }
}

// Gson.fromJson(String, type) for a type with a JsonDeserializer (TreeTypeAdapter): `deserialize(element)` is called with the
// parsed tree unless it is JsonNull. Returns { value } or throws a JsonError whose `syntax` flag marks the exceptions Gson wraps
// in JsonSyntaxException (whose root cause message CommandMessageRaw shows) and `root` the root cause message (undefined: none).
export function fromJson(text, deserialize) {
  const r = new JsonReader(text);
  r.lenient = true;
  let value = null;
  try {
    let empty = true;
    try {
      r.peek();
      empty = false;
      const tree = readElement(r);
      value = tree === JSON_NULL ? null : deserialize(tree);
    } catch (e) {
      if (e instanceof JsonError && e.kind === "eof" && empty) return { value: null };
      if (e instanceof JsonError && ["eof", "malformed", "number", "state"].includes(e.kind)) e.wrapped = true;
      throw e;
    }
  } finally {
    r.lenient = false;
  }
  // assertFullConsumption: only a non-null result is checked; the reader is strict again.
  if (value != null) {
    try {
      if (r.peek() !== "END_DOCUMENT") throw new JsonError("io", "JSON document was not fully consumed.");
    } catch (e) {
      if (e instanceof JsonError && e.kind === "malformed") e.wrapped = true;
      throw e;
    }
  }
  return { value };
}

// Parses standard or lenient JSON to the tree without a deserializer (tests and probes).
export const parseTree = (text) => { const r = new JsonReader(text); r.lenient = true; r.peek(); return readElement(r); };
