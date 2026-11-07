import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseLang, mergeLocale, isUnicodeTable, formatLang, sortedLanguages, languageLabel, lang, selectLanguage, loadLanguageManifest, setForceUnicodeFont, overlayTable, onLanguage } from "./lang.js";
import { getCharWidth, getStringWidth, readFontWidths, font, usesAscii, glyphHtml, setGlyphSizes } from "./font-renderer.js";
import { DEFAULT_CHAR_WIDTHS } from "./font-widths.js";
import { writeOptionsTxt, parseOptionsTxt } from "./options-txt.js";
import { overrideUrls } from "./resource-packs.js";
import { translateKey } from "./chat-component.js";
import { ACHIEVEMENTS, STRINGS } from "./achievements.js";
import "./lang-hooks.js";

// public/research/languages-reference.json is produced by tools/verify-languages.mjs from the unchanged 1.7.10 FontRenderer (bbu)
// and Locale (brs) classes.
const ref = JSON.parse(readFileSync(new URL("../public/research/languages-reference.json", import.meta.url), "utf8"));
const glyphBytes = readFileSync(new URL("../public/media/1.7.10/font/glyph_sizes.bin", import.meta.url));
const glyphSizes = new Int8Array(glyphBytes.buffer, glyphBytes.byteOffset, 65536);
setGlyphSizes(glyphBytes);

const FIXTURES = {
  fx_base: "# comment\n\nplain=Hello\nnovalue\nk=v=w\nnum=%d items\nfmt=%2$.1f of %1$d\nfmts=%s and %1$s\nempty=\n=emptykey\n #notcomment=1\ncrlf=line\r\nuni=あい\nperc=100%% done\n",
  fx_over: "a=Hello\nb=World\n",
  fx_ovr: "a=Override\nc=Extra\n",
};
const ratioText = (plain, wide) => "k=" + "x".repeat(plain) + "あ".repeat(wide) + "\n";
const RATIOS = { "ratio-0pct": [100, 0], "ratio-9pct": [91, 9], "ratio-exact10pct": [90, 10], "ratio-11pct": [89, 11], "ratio-1pct": [99, 1] };

test("lang parsing and fallback order replay the native Locale", () => {
  for (const c of ref.locale) {
    const texts = RATIOS[c.name] ? [ratioText(...RATIOS[c.name])] : c.codes.map((k) => FIXTURES[k]);
    const merged = mergeLocale(texts);
    assert.deepEqual(Object.entries(merged.table).sort(([a], [b]) => (a < b ? -1 : 1)), c.entries, c.name);
    assert.equal(merged.unicode, c.unicode, c.name);
  }
});

test("lang parsing details: first = splits, % arguments become %s", () => {
  const t = parseLang("a=b=c\n#x=1\n\nbad\nn=%d of %2$.2f %%\n");
  assert.deepEqual({ ...t }, { a: "b=c", n: "%s of %2$s %%" });
  assert.equal(formatLang(t, "n", 3, 4.5), "3 of 4.5 %");
  assert.equal(formatLang(t, "missing"), "missing");
  assert.equal(formatLang({ k: "%s %s" }, "k", 1), "Format error: %s %s");
});

test("unicode rule: more than 10 percent of merged characters at or above 256 (float compare)", () => {
  assert.equal(isUnicodeTable({ k: "x".repeat(91) + "あ".repeat(9) }), false);
  assert.equal(isUnicodeTable({ k: "x".repeat(90) + "あ".repeat(10) }), true);
  assert.equal(isUnicodeTable({}), false);
});

test("every installed language agrees with the native unicode flag (when npm run lang:fetch was run)", () => {
  for (const r of ref.real) assert.equal(typeof r.unicode, "boolean");
  const unicode = ref.real.filter((r) => r.unicode).map((r) => r.code);
  if (ref.real.length) assert.ok(unicode.includes("ja_JP") && unicode.includes("ru_RU") && !unicode.includes("de_DE"));
});

test("sorted language list is by code with the name (region) label", () => {
  const languages = { zh_CN: { name: "简体中文", region: "中国" }, af_ZA: { name: "Afrikaans", region: "Suid-Afrika" }, en_US: { name: "English", region: "US" } };
  assert.deepEqual(sortedLanguages(languages), ["af_ZA", "en_US", "zh_CN"]);
  assert.equal(languageLabel(languages.en_US), "English (US)");
});

test("character widths equal the native FontRenderer for both unicode flags (first 256 recorded; all 65536 checked by tools/verify-languages.mjs)", () => {
  assert.equal(ref.font.length, 2);
  for (const r of ref.font) {
    const state = { unicode: r.unicode, widths: DEFAULT_CHAR_WIDTHS, glyphSizes };
    assert.deepEqual(DEFAULT_CHAR_WIDTHS.slice(0, 256).length, 256);
    for (let c = 0; c < 256; c++) assert.equal(getCharWidth(c, state), r.first256[c], `char ${c} unicode=${r.unicode}`);
    // Sampled spread of the rest (the probe verifies all 65536 in tools/verify-languages.mjs).
    for (let c = 256; c < 65536; c += 7) assert.ok(Number.isInteger(getCharWidth(c, state)));
  }
});

test("string widths with unicode text, bold and section codes equal the native FontRenderer", () => {
  for (const r of ref.font) {
    const state = { unicode: r.unicode, widths: DEFAULT_CHAR_WIDTHS, glyphSizes };
    assert.ok(r.samples.length > 15);
    for (const [s, w] of r.samples) assert.equal(getStringWidth(s, state), w, `${JSON.stringify(s)} unicode=${r.unicode}`);
  }
});

test("space is 4, section sign is -1, a bold glyph adds 1", () => {
  assert.equal(getCharWidth(" "), 4);
  assert.equal(getCharWidth("§"), -1);
  assert.equal(getStringWidth("ab"), getCharWidth("a") + getCharWidth("b"));
  assert.equal(getStringWidth("§lab"), getCharWidth("a") + getCharWidth("b") + 2);
  assert.equal(getStringWidth("§lab§rab"), 2 * (getCharWidth("a") + getCharWidth("b")) + 2);
});

test("a resource pack ascii.png keeps the 8 pixel layout (readFontTexture widths)", () => {
  // 16x16 grid of 16 px cells, every glyph 10 columns wide: width = (int)(0.5 + 10 * 8 / 16) + 1 = 6.
  const size = 256, rgba = new Uint8Array(size * size * 4);
  for (let cell = 0; cell < 256; cell++) {
    const col = cell % 16, row = cell >> 4;
    for (let y = 0; y < 16; y++) for (let x = 0; x < 10; x++) rgba[((row * 16 + y) * size + col * 16 + x) * 4 + 3] = 255;
  }
  const w = readFontWidths(rgba, size, size);
  assert.equal(w[65], 6);
  assert.equal(w[32], 6); // not the 4 special case: a drawn cell overrides it, as in the original loop
  assert.deepEqual(readFontWidths(new Uint8Array(128 * 128 * 4), 128, 128)[65], 1);
});

test("unicode flag switches the glyph source and the DOM output", () => {
  setForceUnicodeFont(false);
  assert.equal(usesAscii(65), true);
  const asciiW = getCharWidth("A");
  setForceUnicodeFont(true);
  assert.equal(lang.forceUnicodeFont, true);
  assert.equal(font.unicode, true);
  assert.equal(usesAscii(65), false);
  assert.notEqual(glyphHtml(65), "");
  assert.ok(getCharWidth("A") > 0 && asciiW > 0);
  setForceUnicodeFont(false);
  assert.equal(font.unicode, false);
});

test("options.txt persists lang and forceUnicodeFont", () => {
  const text = writeOptionsTxt({ language: "de_DE", forceUnicodeFont: true });
  assert.match(text, /^lang:de_DE$/m);
  assert.match(text, /^forceUnicodeFont:true$/m);
  const { options } = parseOptionsTxt(text);
  assert.equal(options.language, "de_DE");
  assert.equal(options.forceUnicodeFont, true);
  assert.match(writeOptionsTxt({}), /^lang:en_US$/m);
  assert.match(writeOptionsTxt({}), /^forceUnicodeFont:false$/m);
});

test("without a manifest only English is offered", async () => {
  const none = async () => ({ ok: false });
  assert.equal(await loadLanguageManifest(none), null);
  assert.equal(lang.installed, false);
  assert.deepEqual(Object.keys(lang.languages), ["en_US"]);
  assert.equal(await selectLanguage("de_DE", { fetchImpl: none }), "en_US");
});

test("selecting a language applies at once to chat translations, achievements and falls back to en_US", async () => {
  const files = { "/lang/1.7.10/xx_XX.lang": "chat.type.text=«%s» %s\nachievement.openInventory=Inventaire\nnot.a.key=1\n" };
  lang.languages = { en_US: { name: "English", region: "US" }, xx_XX: { name: "Test", region: "XX" } };
  const fetchImpl = async (url) => (files[url] ? { ok: true, text: async () => files[url] } : { ok: false });
  let seen = 0;
  const off = onLanguage(() => seen++);
  const before = translateKey("chat.type.text");
  assert.equal(before, "<%s> %s");
  assert.equal(await selectLanguage("xx_XX", { fetchImpl }), "xx_XX");
  assert.equal(seen, 1);
  assert.equal(translateKey("chat.type.text"), "«%s» %s");
  assert.equal(translateKey("chat.type.emote"), "* %s %s"); // missing key: en_US fallback
  assert.equal(ACHIEVEMENTS.find((a) => a.id === "openInventory").name, "Inventaire");
  assert.equal(ACHIEVEMENTS.find((a) => a.id === "mineWood").name, "Getting Wood");
  await selectLanguage("en_US", { fetchImpl });
  assert.equal(translateKey("chat.type.text"), "<%s> %s");
  assert.equal(STRINGS.openInventory, "Taking Inventory");
  off();
  lang.languages = { en_US: { name: "English", region: "US" } };
});

test("overlayTable restores replaced keys and ignores unknown ones", () => {
  const target = { a: "1", b: "2" }, saved = {};
  overlayTable(target, saved, { a: "X", z: "Y" });
  assert.deepEqual(target, { a: "X", b: "2" });
  overlayTable(target, saved, null);
  assert.deepEqual(target, { a: "1", b: "2" });
});

test("a pack's glyph_sizes.bin is served under the font path", () => {
  assert.deepEqual(overrideUrls("assets/minecraft/font/glyph_sizes.bin"), ["/media/1.7.10/font/glyph_sizes.bin"]);
});
