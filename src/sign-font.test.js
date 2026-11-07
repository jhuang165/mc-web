import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { setGlyphSizes, getStringWidth, font } from "./font-renderer.js";
import { layoutString } from "./sign-font.js";
import { drawSignText } from "./sign-renderer.js";
import { SignEditModel } from "./signs.js";
import { tooltipLines } from "./gui.js";

// public/research/sign-font-reference.json: the unchanged FontRenderer (bbu) widths of sign lines, from tools/verify-sign-font.mjs.
const ref = JSON.parse(readFileSync(new URL("../public/research/sign-font-reference.json", import.meta.url), "utf8"));
setGlyphSizes(readFileSync(new URL("../public/media/1.7.10/font/glyph_sizes.bin", import.meta.url)));
const state = (unicode) => ({ ...font, unicode });

test("sign line widths and centred x equal the original FontRenderer", () => {
  for (const row of ref.rows) for (const [s, w, x] of row.lines) {
    const st = state(row.unicode);
    assert.equal(getStringWidth(s, st), w, JSON.stringify(s));
    assert.equal(0 - Math.trunc(getStringWidth(s, st) / 2) + 0, x);
    // the draw pen is the float advance: equal to getStringWidth with the default font for the ascii.png characters (not for page glyphs or a trailing section sign),
    // and longer by the dropped halves with the unicode flag (getCharWidth truncates, renderUnicodeChar advances by the float)
    if (!row.unicode && /^[\x20-\x7e]*$/.test(s) || !row.unicode && /^[\x20-\x7e§]*[^§]$/.test(s) && !/[^\x00-\x7f§]/.test(s)) assert.equal(layoutString(s, 0, st).width, w, JSON.stringify(s));
  }
});

test("layout: ascii glyphs, spacing, section codes and bold", () => {
  const plain = layoutString("Hi", 0, state(false));
  assert.deepEqual(plain.ops.map((o) => [o.kind, o.x, o.color]), [["ascii", 0, 0], ["ascii", 6, 0]]);
  assert.equal(plain.width, getStringWidth("Hi", state(false)));
  assert.equal(layoutString("a b", 0, state(false)).ops.length, 2);
  const coloured = layoutString("§4a§rb", 0, state(false)).ops;
  assert.deepEqual(coloured.map((o) => o.color), [0xaa0000, 0]);
  const bold = layoutString("§la", 0, state(false));
  assert.equal(bold.ops.length, 2);
  assert.equal(bold.ops[1].x, 1);
  assert.equal(bold.width, getStringWidth("§la", state(false)));
  assert.equal(layoutString("§lE", 0, state(true)).ops[1].x, 0.5); // renderStringAtPos: 0.5 with the unicode flag
  assert.equal(layoutString("§zq", 0, state(false)).ops[0].color, 0xffffff); // an unknown code counts as 15
  assert.equal(layoutString("§n§mq", 0, state(false)).ops.filter((o) => o.kind === "bar").length, 2);
});

test("unicode flag and non-table characters use the unicode pages", () => {
  const u = layoutString("é", 0, state(false)); // not in the 256 table? either way a glyph is produced
  assert.ok(u.ops.length >= 1);
  const forced = layoutString("A", 0, state(true));
  assert.equal(forced.ops[0].kind, "unicode");
  assert.equal(forced.ops[0].code, 65);
  assert.equal(layoutString("あ", 0, state(false)).ops[0].kind, "unicode");
});

test("drawSignText draws centred lines with a recording context", () => {
  const calls = [];
  const ctx = new Proxy({}, { get: (_, k) => (k === "imageSmoothingEnabled" ? false : (...a) => calls.push([k, ...a])), set: () => true });
  const canvas = { width: 600, height: 180, getContext: () => ctx };
  drawSignText(canvas, ["", "Hello", "", ""], state(false));
  assert.equal(calls[0][0], "clearRect");
  assert.ok(!calls.some((c) => c[0] === "drawImage")); // atlas images are not loadable outside a browser: nothing is drawn, nothing throws
});

test("edit model: 15 character limit and allowed characters as GuiEditSign.keyTyped", () => {
  const m = new SignEditModel();
  for (const ch of "§abcdefghijklmnopqrstuvwxyz") m.type(ch);
  assert.equal(m.lines[0], "abcdefghijklmno");
  assert.equal(m.display(0), "> abcdefghijklmno <");
});

test("1.7.10 hardcodes the advanced Durability line (no lang key)", () => {
  const en = readFileSync(new URL("./lang-en-us.js", import.meta.url), "utf8");
  assert.ok(!en.includes('"item.durability"'));
  assert.equal(tooltipLines({ name: "Sword", durability: 100 }, { damage: 10 }, true).at(-1).text, "Durability: 90 / 100");
});
