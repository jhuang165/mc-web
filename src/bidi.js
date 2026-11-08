// FontRenderer.bidiReorder (bbu.b(String)) of Minecraft Java 1.7.10, ported:
//   new Bidi(new ArabicShaping(ArabicShaping.LETTERS_SHAPE).shape(s), Bidi.DEFAULT_RTL)  [ICU4J 51.2, flags 8 and 127]
//   bidi.setReorderingMode(REORDER_DEFAULT); return bidi.writeReordered(Bidi.DO_MIRRORING);   (an ArabicShapingException returns s)
// FontRenderer applies it when the language is bidirectional (setBidiFlag, from Language.isBidirectional: ar_SA, he_IL): drawString
// reorders the whole string (colour codes included, as natively), and drawSplitString lines are right aligned on the reordered width.
//
// The tables (src/bidi-data.js) are generated from the ICU4J data of the client libraries; the algorithm is the Unicode bidirectional
// algorithm of ICU 51 (Unicode 6.2: embeddings and overrides, no isolates, no N0 bracket pairs) over one paragraph per B character, then a
// single line reorder. tools/verify-font-style.mjs replays the unchanged class over a seeded corpus (public/research/font-style-reference.json).
import { BIDI_CLASS_RUNS, BIDI_MIRRORS, SHAPE_CHARS, SHAPE_LIGATURES } from "./bidi-data.js";

export const L = 0, R = 1, EN = 2, ES = 3, ET = 4, AN = 5, CS = 6, B = 7, S = 8, WS = 9, ON = 10, LRE = 11, LRO = 12, AL = 13, RLE = 14, RLO = 15, PDF = 16, NSM = 17, BN = 18;
const MAX_DEPTH = 61;

// Class lookup: binary search over the run starts.
const starts = [], classOf = [];
for (let i = 0; i < BIDI_CLASS_RUNS.length; i += 2) { starts.push(BIDI_CLASS_RUNS[i]); classOf.push(BIDI_CLASS_RUNS[i + 1]); }
export function bidiClass(c) {
  let lo = 0, hi = starts.length - 1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (starts[mid] <= c) lo = mid; else hi = mid - 1; }
  return classOf[lo];
}
const mirrors = new Map();
for (let i = 0; i < BIDI_MIRRORS.length; i += 2) mirrors.set(BIDI_MIRRORS[i], BIDI_MIRRORS[i + 1]);
export const mirrorOf = (c) => mirrors.get(c) ?? c;

// ---- ArabicShaping(LETTERS_SHAPE) ----
const shapeRows = new Map();
for (const [c, iso, fin, ini, med, flags] of SHAPE_CHARS) shapeRows.set(c, { iso, fin, ini, med, prev: !!(flags & 1), next: !!(flags & 2), transparent: !!(flags & 4) });
const isLam = (c) => c === 0x644 || (c >= 0xfedd && c <= 0xfee0);
const alefBase = (c) => {
  if (c === 0x622 || c === 0x623 || c === 0x625 || c === 0x627) return c;
  if (c === 0xfe81 || c === 0xfe82) return 0x622;
  if (c === 0xfe83 || c === 0xfe84) return 0x623;
  if (c === 0xfe87 || c === 0xfe88) return 0x625;
  if (c === 0xfe8d || c === 0xfe8e) return 0x627;
  return 0;
};
/** ICU4J ArabicShaping(LETTERS_SHAPE).shape: Arabic letters (U+0621-064A and the FE70-FEFC forms) take their contextual FE forms, lam + alef becomes one ligature. */
export function shapeArabic(s) {
  const text = String(s);
  // Fast exit: nothing in the Arabic ranges or the join controls.
  let any = false;
  for (let i = 0; i < text.length && !any; i++) { const c = text.charCodeAt(i); any = shapeRows.has(c); }
  if (!any) return text;
  // Resolve ligatures first: units are {c, row} with lam + (transparent*) + alef merged into one unit followed by its transparent chars.
  const units = [];
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i), row = shapeRows.get(c);
    if (row && isLam(c)) {
      let j = i + 1;
      while (j < text.length && shapeRows.get(text.charCodeAt(j))?.transparent) j++;
      const a = j < text.length ? alefBase(text.charCodeAt(j)) : 0;
      if (a) {
        units.push({ c, row, lig: SHAPE_LIGATURES[a], prev: row.prev, next: false });
        for (let k = i + 1; k < j; k++) units.push({ c: text.charCodeAt(k), row: shapeRows.get(text.charCodeAt(k)) });
        i = j;
        continue;
      }
    }
    units.push({ c, row });
  }
  const link = (u) => (u.row ? { prev: u.prev ?? u.row.prev, next: u.next ?? u.row.next, transparent: u.row.transparent } : null);
  let out = "";
  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    if (!u.row) { out += String.fromCharCode(u.c); continue; }
    const me = link(u);
    let p = i - 1, n = i + 1;
    while (p >= 0 && units[p].row?.transparent) p--;
    while (n < units.length && units[n].row?.transparent) n++;
    const lp = p >= 0 && units[p].row ? link(units[p]) : null, ln = n < units.length && units[n].row ? link(units[n]) : null;
    const joinsPrev = me.prev && !!lp && lp.next, joinsNext = me.next && !!ln && ln.prev;
    let code;
    if (u.lig) code = joinsPrev ? u.lig[1] : u.lig[0];
    else if (me.transparent) code = (lp && lp.next && ln && ln.prev && u.row.med) || u.row.iso;
    else code = (joinsPrev && joinsNext ? u.row.med : joinsPrev ? u.row.fin : joinsNext ? u.row.ini : 0) || u.row.iso;
    out += String.fromCharCode(code);
  }
  return out;
}

// ---- Bidi(text, DEFAULT_RTL) + writeReordered(DO_MIRRORING) ----
/** Resolved embedding levels (one per UTF-16 unit) of the text under ICU's DEFAULT_RTL paragraph direction, one paragraph per B. */
export function resolveLevels(text) {
  const n = text.length, types = new Array(n), levels = new Array(n).fill(0);
  for (let i = 0; i < n; i++) types[i] = bidiClass(text.charCodeAt(i));
  // paragraph level per character (P2, P3: first strong L, R or AL of the paragraph, else RTL), one paragraph per B
  const paraOf = new Array(n);
  for (let ps = 0; ps < n;) {
    let pe = ps;
    while (pe < n && types[pe] !== B) pe++;
    if (pe < n) pe++; // the separator belongs to its paragraph (CR LF is two separators here, as natively)
    const p = firstStrong(types, ps, pe, 1);
    for (let i = ps; i < pe; i++) paraOf[i] = p;
    ps = pe;
  }
  resolveText(types, levels, paraOf);
  return { levels, types };
}
function firstStrong(types, s, e, fallback) {
  // ICU 51 (before isolates) does not skip embeddings: the first L, R or AL in the paragraph decides; with none the paragraph is RTL (DEFAULT_RTL), whatever the previous paragraph was.
  for (let i = s; i < e; i++) {
    const t = types[i];
    if (t === L) return 0;
    if (t === R || t === AL) return 1;
  }
  return fallback;
}
/**
 * ubidi_setPara after getDirProps: resolveExplicitLevels (X1-X8, the stack restarts at each paragraph), then ICU's loop over the level runs of
 * the WHOLE text (not per paragraph): explicit codes and BN characters extend the run before them (so a code at the start of a paragraph
 * belongs to the previous paragraph's last run), a run's sor is the previous run's eor unless the character before it is a B (then the
 * paragraph level), the eor comes from max(level, level of the next run); override runs (LRO/RLO) and plain runs of the same level are separate.
 */
function resolveText(origTypes, levelsOut, paraOf) {
  const len = origTypes.length;
  const types = origTypes.slice(), levels = new Array(len), ovr = new Array(len).fill(false);
  const removed = new Array(len).fill(false);
  let stack = [], overflow = 0, cur = { level: paraOf[0] ?? 0, override: -1 };
  for (let i = 0; i < len; i++) {
    const t = types[i];
    if (i === 0 || origTypes[i - 1] === B) { stack = []; overflow = 0; cur = { level: paraOf[i], override: -1 }; }
    if (t === RLE || t === LRE || t === RLO || t === LRO) {
      levels[i] = cur.level; removed[i] = true;
      const next = (t === RLE || t === RLO) ? (cur.level + 1) | 1 : (cur.level + 2) & ~1;
      if (next <= MAX_DEPTH && overflow === 0) { stack.push(cur); cur = { level: next, override: t === RLO ? R : t === LRO ? L : -1 }; }
      else overflow++;
    } else if (t === PDF) {
      removed[i] = true;
      if (overflow > 0) overflow--; else if (stack.length) cur = stack.pop();
      levels[i] = cur.level;
    } else if (t === B) {
      levels[i] = paraOf[i];
    } else if (t === BN) {
      levels[i] = cur.level; removed[i] = true;
    } else {
      levels[i] = cur.level;
      if (cur.override >= 0) { types[i] = cur.override; ovr[i] = true; }
    }
  }
  const lr = (level) => (level & 1 ? R : L);
  const idx = [];
  for (let i = 0; i < len; i++) if (!removed[i]) idx.push(i);
  const m = idx.length, t = idx.map((i) => types[i]), lv = idx.map((i) => levels[i]), res = lv.slice();
  const ov = idx.map((i) => ovr[i]);
  // level runs over the retained characters (a B always ends a run piece: the next paragraph starts afresh)
  const runs = [];
  for (let a = 0; a < m;) {
    let b = a + 1;
    while (origTypes[idx[b - 1]] !== B && b < m && lv[b] === lv[a] && ov[b] === ov[a]) b++;
    runs.push([a, b, a > 0 && lv[a - 1] === lv[a] && ov[a - 1] === ov[a]]); a = b;
  }
  // a leading explicit code or BN is a run of its own (at the level it was given) when the first retained character is at another level
  let eorPrev = m ? lr(Math.max(levels[0], lv[0])) : lr(paraOf[0] ?? 0);
  for (let r = 0; r < runs.length; r++) {
    const [a, b, cont] = runs[r], level = lv[a];
    const ri = idx[a];
    const sor = cont ? lr(level) : ri > 0 && origTypes[ri - 1] === B ? lr(paraOf[ri]) : eorPrev;
    const nextLevel = r < runs.length - 1 ? lv[b] : paraOf[len - 1];
    const trueEor = lr(Math.max(level, nextLevel));
    const eor = origTypes[idx[b - 1]] === B ? lr(level) : trueEor; // inside a run a B ends the paragraph: nothing after it counts
    eorPrev = trueEor;
    if (ov[a]) continue; // override runs keep their explicit level (the characters are already L or R at a matching level)
    resolveRun(t, res, a, b, level, sor, eor);
  }
  // Retained removed characters (explicit codes, BN) take the level of the next retained character of their paragraph (the paragraph level at its end).
  for (let i = len - 1, k = m - 1, next = paraOf[len - 1]; i >= 0; i--) {
    if (!removed[i]) { next = res[k--]; levels[i] = next; } else levels[i] = next;
  }
  // L1: separators and trailing whitespace (with removed characters) go back to the paragraph level.
  let tail = true;
  for (let i = len - 1; i >= 0; i--) {
    const o = origTypes[i];
    if (o === B || o === S) { levels[i] = paraOf[i]; tail = true; }
    else if (o === WS || removed[i]) { if (tail) levels[i] = paraOf[i]; }
    else tail = false;
  }
  for (let i = 0; i < len; i++) levelsOut[i] = levels[i];
}
function resolveRun(t, lv, a, b, level, sor, eor) {
    // W1
    for (let i = a, prev = sor; i < b; i++) {
      if (t[i] === NSM) t[i] = prev;
      prev = t[i];
    }
    // W2, W3
    for (let i = a, strong = sor; i < b; i++) {
      if (t[i] === L || t[i] === R || t[i] === AL) strong = t[i];
      else if (t[i] === EN && strong === AL) t[i] = AN;
    }
    for (let i = a; i < b; i++) if (t[i] === AL) t[i] = R;
    // W4
    for (let i = a + 1; i < b - 1; i++) {
      if (t[i] === ES && t[i - 1] === EN && t[i + 1] === EN) t[i] = EN;
      else if (t[i] === CS && t[i - 1] === EN && t[i + 1] === EN) t[i] = EN;
      else if (t[i] === CS && t[i - 1] === AN && t[i + 1] === AN) t[i] = AN;
    }
    // W5
    for (let i = a; i < b; i++) {
      if (t[i] !== ET) continue;
      let j = i;
      while (j < b && t[j] === ET) j++;
      if ((i > a && t[i - 1] === EN) || (j < b && t[j] === EN)) for (let k = i; k < j; k++) t[k] = EN;
      i = j - 1;
    }
    // W6
    for (let i = a; i < b; i++) if (t[i] === ES || t[i] === ET || t[i] === CS) t[i] = ON;
    // W7
    for (let i = a, strong = sor; i < b; i++) {
      if (t[i] === L || t[i] === R) strong = t[i];
      else if (t[i] === EN && strong === L) t[i] = L;
    }
    // N1, N2
    const isNI = (x) => x === B || x === S || x === WS || x === ON;
    const dir = (x) => (x === L ? L : R); // R, EN and AN count as R
    for (let i = a; i < b; i++) {
      if (!isNI(t[i])) continue;
      let j = i;
      while (j < b && isNI(t[j])) j++;
      const lead = i > a ? dir(t[i - 1]) : sor, trail = j < b ? dir(t[j]) : eor;
      const res = lead === trail ? lead : (level & 1 ? R : L);
      for (let k = i; k < j; k++) t[k] = res;
      i = j - 1;
    }
    // I1, I2
    for (let i = a; i < b; i++) {
      if (level & 1) { if (t[i] === L || t[i] === EN || t[i] === AN) lv[i] = level + 1; }
      else if (t[i] === R) lv[i] = level + 1;
      else if (t[i] === AN || t[i] === EN) lv[i] = level + 2;
    }
}

/** writeReordered(DO_MIRRORING) of the text for the given levels (L2 over the whole string, mirrored characters at odd levels). */
export function reorderLevels(text, levels) {
  const n = text.length;
  if (!n) return "";
  let hi = 0, lowOdd = 255;
  for (const l of levels) { if (l > hi) hi = l; if (l & 1 && l < lowOdd) lowOdd = l; }
  const order = Array.from({ length: n }, (_, i) => i);
  for (let level = hi; level >= lowOdd; level--) {
    for (let i = 0; i < n;) {
      if (levels[order[i]] < level) { i++; continue; }
      let j = i;
      while (j < n && levels[order[j]] >= level) j++;
      for (let a = i, b = j - 1; a < b; a++, b--) { const tmp = order[a]; order[a] = order[b]; order[b] = tmp; }
      i = j;
    }
  }
  let out = "";
  for (const i of order) { const c = text.charCodeAt(i); out += String.fromCharCode(levels[i] & 1 ? mirrorOf(c) : c); }
  return out;
}

/** FontRenderer.bidiReorder: shaping, DEFAULT_RTL paragraph, visual order with mirroring. */
export function bidiReorder(s) {
  const text = shapeArabic(s);
  if (!text.length) return text;
  // ICU shortcut: with no R, AL, AN or explicit-embedding characters and an LTR first paragraph the text is trivially LTR (a single
  // run: no reordering, no mirroring, whatever the later paragraphs resolve to) unless a later paragraph raises the right-to-left flag.
  const types = new Array(text.length);
  let rtl = false, explicit = false;
  for (let i = 0; i < text.length; i++) {
    const t = types[i] = bidiClass(text.charCodeAt(i));
    rtl = rtl || t === R || t === AL || t === AN;
    explicit = explicit || t === RLE || t === RLO || t === LRE || t === LRO || t === PDF || t === BN;
  }
  // With explicit codes or BN characters ICU's resolveExplicitLevels recounts the direction flags per character at its embedding level
  // (an override counts as the direction it forces, not as the character's own class).
  let ltr = true;
  if (explicit) { const f = embeddedFlags(types); rtl = f.rtl; ltr = f.ltr; }
  if (explicit && rtl && !ltr) return reorderLevels(text, new Array(text.length).fill(1)); // purely right to left: the whole string is reversed
  if (!rtl) {
    let pe = 0;
    while (pe < text.length && types[pe] !== B) pe++;
    if (firstStrong(types, 0, Math.min(pe + 1, text.length), 1) === 0 && (explicit || !laterParagraphIsRtl(types))) return text;
  }
  return reorderLevels(text, resolveLevels(text).levels);
}

/**
 * ICU 51 getDirProps flags a strong-less paragraph (default level 1) that has content besides its separator and follows a level 0
 * paragraph as right to left, which turns an otherwise left-to-right text into the MIXED direction (levels resolved per character).
 * A strong-less paragraph after a separator-only paragraph does not raise it (probed: `a\n(` mirrors, `a\n\n(` does not).
 */
function laterParagraphIsRtl(types) {
  let prevLevel = -1, prevEnd = 0;
  for (let ps = 0; ps < types.length;) {
    let pe = ps;
    while (pe < types.length && types[pe] !== B) pe++;
    if (pe < types.length) pe++;
    const level = firstStrong(types, ps, pe, 1);
    // content (not a separator, BN or code) before the paragraph's first strong character, or anywhere when it has none
    let content = false;
    for (let i = ps; i < pe && !content; i++) {
      if (types[i] === L || types[i] === R || types[i] === AL) break;
      content = !(types[i] === B || types[i] === BN || isCode(types[i]));
    }
    if (ps > 0 && prevLevel === 0 && level === 1 && content) return true;
    prevLevel = level;
    ps = pe;
  }
  return false;
}
const isCode = (t) => t === LRE || t === LRO || t === RLE || t === RLO || t === PDF;

/**
 * ICU flags right to left only for a character that is actually drawn at an odd embedding level (RLE/RLO with a character after
 * them in the same paragraph, X1-X8 stack as resolveParagraph); explicit codes with nothing under them leave the text left to right.
 */
function embeddedFlags(types) {
  let stack = [{ level: 0, override: -1 }], overflow = 0, rtl = false, ltr = false, para = 0, prev = 0;
  for (let i = 0, pastB = true; i < types.length; i++) {
    const t = types[i];
    if (pastB) { stack = [{ level: firstStrongFrom(types, i), override: -1 }]; overflow = 0; pastB = false; if (i === 0) { para = prev = stack[0].level; } }
    const top = stack[stack.length - 1];
    if (t === RLE || t === LRE || t === RLO || t === LRO) {
      const next = (t === RLE || t === RLO) ? (top.level + 1) | 1 : (top.level + 2) & ~1;
      if (next <= MAX_DEPTH && overflow === 0) stack.push({ level: next, override: t === RLO ? R : t === LRO ? L : -1 }); else overflow++;
    } else if (t === PDF) { if (overflow > 0) overflow--; else if (stack.length >= 2) stack.pop(); }
    else if (t === B) { pastB = true; prev = stack[0].level; } // the separator carries its paragraph's level over to the next paragraph
    else if (t === BN) continue;
    else {
      // a character whose embedding differs from the previous character's counts as that embedding's direction (an override as the
      // direction it forces); the character's own class counts only without an override
      const key = top.level + (top.override >= 0 ? 256 : 0);
      if (key !== prev) { prev = key; if (top.override >= 0) { if (top.override === R) rtl = true; else ltr = true; } else if (top.level & 1) rtl = true; else ltr = true; }
      if (top.override < 0) { if (t === R || t === AL || t === AN) rtl = true; if (t === L || t === EN || t === AN) ltr = true; }
    }
  }
  // the codes and BN flag themselves, which counts as a neutral: the first paragraph's direction is added
  if (para & 1) rtl = true; else ltr = true;
  return { rtl, ltr };
}
function firstStrongFrom(types, s) {
  let e = s;
  while (e < types.length && types[e] !== B) e++;
  return firstStrong(types, s, e, 1);
}
