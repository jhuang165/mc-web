// Languages of Minecraft Java 1.7.10: Locale (brs) parsing and merging, the unicode rule, LanguageManager (brr) selection and the
// options.txt `lang:` / `forceUnicodeFont:` values. Replayed against the unchanged classes by tools/verify-languages.mjs
// (public/research/languages-reference.json, src/languages.test.js). Notes: public/research/languages.md.
//
//   Locale.loadLocaleDataFiles: the code list is ["en_US", selected] (en_US only once); every file of every code is read in order
//     and later keys win, so a missing translation falls back to English. Each file is read as UTF-8 lines; empty lines and lines
//     starting with '#' are skipped, a line is split at the first '=' into exactly two parts (a line with no '=' is dropped; "a="
//     and "=b" are kept), and each value has %[n$][width.]d|f rewritten to %[n$]s. Keys and values are not trimmed.
//   Locale.checkUnicode: over the characters of every merged value, isUnicode = (float)(chars >= 256) / (float)(all chars)
//     widened to double > 0.1. The comparison is done in float, so exactly 10 percent counts as unicode.
//   LanguageManager.getLanguages: a TreeSet of Language ordered by code (String.compareTo); Language.toString is "name (region)".
//   Locale.formatMessage: String.format over the value; a bad format gives "Format error: " + value; an unknown key is the key.
import { font, setUnicodeFlag } from "./font-renderer.js";

/** Locale's per-line rules. Returns a plain object of key -> value. */
export function parseLang(text) {
  const out = Object.create(null);
  for (const line of String(text).split(/\r\n|\r|\n/)) {
    if (line === "" || line[0] === "#") continue;
    const i = line.indexOf("=");
    if (i < 0) continue;
    out[line.slice(0, i)] = line.slice(i + 1).replace(/%(\d+\$)?[\d.]*[df]/g, "%$1s");
  }
  return out;
}

/** Locale.checkUnicode over a merged table. */
export function isUnicodeTable(table) {
  let wide = 0, all = 0;
  for (const v of Object.values(table)) {
    all += v.length;
    for (let i = 0; i < v.length; i++) if (v.charCodeAt(i) >= 256) wide++;
  }
  return all > 0 && Math.fround(Math.fround(wide) / Math.fround(all)) > 0.1;
}

/** Locale.loadLocaleDataFiles for text sources in code order (en_US first). */
export function mergeLocale(texts) {
  const table = Object.create(null);
  for (const t of texts) Object.assign(table, typeof t === "string" ? parseLang(t) : t);
  return { table, unicode: isUnicodeTable(table) };
}

/** Locale.formatMessage / translateKeyFormat: %s, %n$s and %% only (every %d/%f was rewritten while loading). */
export function formatLang(table, key, ...args) {
  const v = table[key];
  if (v === undefined) return key;
  let next = 0;
  try {
    return v.replace(/%(?:(\d+)\$)?([s%])|%/g, (m, pos, kind) => {
      if (!kind) throw new Error("UnknownFormatConversionException");
      if (kind === "%") return "%";
      const i = pos ? Number(pos) - 1 : next++;
      if (i >= args.length || i < 0) throw new Error("MissingFormatArgumentException");
      return String(args[i]);
    });
  } catch {
    return "Format error: " + v;
  }
}

/** LanguageManager.getLanguages: codes sorted like a TreeSet<Language>; `languages` is { code: { name, region, bidirectional } }. */
export const sortedLanguages = (languages) => Object.keys(languages).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
/** Language.toString. */
export const languageLabel = (l) => `${l.name} (${l.region})`;

// ---- Live state ----
export const DEFAULT_LANGUAGE = "en_US";
export const lang = {
  code: DEFAULT_LANGUAGE,
  table: null, // merged en_US + selected (null while English is selected: the built-in tables already are en_US)
  selected: null, // the selected language's own keys
  languages: { en_US: { name: "English", region: "US", bidirectional: false } },
  installed: false, // a lang manifest exists (npm run lang:fetch)
  unicode: false, // Locale.isUnicode
  bidirectional: false,
  forceUnicodeFont: false,
};
/** StatCollector.translateToLocal over the live table; `fallback` is the baked English text used while English is selected
 *  (or the key is absent), so the hand-written English strings stay the source for en_US. */
export const translate = (key, fallback) => lang.table?.[key] ?? fallback;
const hooks = new Set();
/** Registers fn(selectedKeys | null) called after every language change (menus, commands, achievements, death messages ...). */
export const onLanguage = (fn) => { hooks.add(fn); return () => hooks.delete(fn); };

// GuiLanguage / Minecraft.refreshResources: fontRenderer.setUnicodeFlag(isCurrentLocaleUnicode || forceUnicodeFont).
export function applyFontFlag() { setUnicodeFlag(lang.unicode || lang.forceUnicodeFont); }
export function setForceUnicodeFont(on) { lang.forceUnicodeFont = !!on; applyFontFlag(); }

/** Reads /lang/1.7.10/manifest.json. A missing file (or a dev server answering with index.html) leaves English only. */
export async function loadLanguageManifest(fetchImpl = fetch) {
  try {
    const r = await fetchImpl("/lang/1.7.10/manifest.json");
    if (!r.ok) return null;
    const m = JSON.parse(await r.text());
    if (!m?.languages?.en_US) return null;
    lang.languages = m.languages;
    lang.installed = true;
    return m;
  } catch {
    return null;
  }
}

/** Selects a language: en_US from the built-in table, others from the installed file. Falls back to English when absent. */
export async function selectLanguage(code, { fetchImpl = fetch, english } = {}) {
  const entry = lang.languages[code];
  let selected = null, table = null;
  if (code !== DEFAULT_LANGUAGE && entry) {
    try {
      const r = await fetchImpl(`/lang/1.7.10/${code}.lang`);
      if (r.ok) selected = parseLang(await r.text());
    } catch {}
  }
  if (selected) {
    const en = english ?? (await import("./lang-en-us.js")).EN_US;
    ({ table } = mergeLocale([en, selected]));
    lang.code = code;
  } else lang.code = DEFAULT_LANGUAGE;
  lang.selected = selected;
  lang.table = selected ? table : null;
  lang.unicode = selected ? isUnicodeTable(table) : false;
  lang.bidirectional = !!lang.languages[lang.code]?.bidirectional;
  applyFontFlag();
  for (const fn of hooks) fn(lang.selected);
  return lang.code;
}

/** Overlay helper for the hand-written English tables: sets the selected keys over `target` and restores replaced ones.
 *  `map(key)` turns a lang key into a key of the target (or null). `saved` keeps the originals. */
export function overlayTable(target, saved, selected, map = (k) => k) {
  for (const [k, v] of Object.entries(saved)) target[k] = v;
  for (const k of Object.keys(saved)) delete saved[k];
  if (!selected) return;
  for (const [lk, v] of Object.entries(selected)) {
    const k = map(lk);
    if (k == null || !(k in target)) continue;
    saved[k] = target[k];
    target[k] = v;
  }
}

export { font };
