import test from "node:test";
import assert from "node:assert/strict";
import { countLayout, tooltipString, tooltipLayout, tooltipHtml, countHtml, bitmapHtml, xpLevelHtml } from "./bitmap-text.js";
import { getStringWidth, font } from "./font-renderer.js";
import { entityDisplayName, ENTITY_LANG } from "./entity-names.js";
import { EN_US } from "./lang-en-us.js";

test("stack count: x + 19 - 2 - width, y + 6 + 3, only above 1 (RenderItem.renderItemOverlayIntoGUI bytecode)", () => {
  assert.equal(countLayout(1), null);
  assert.equal(countLayout(0), null);
  for (const n of [2, 9, 10, 64, 100]) {
    const l = countLayout(n);
    assert.equal(l.text, String(n));
    assert.equal(l.x, 17 - getStringWidth(String(n)));
    assert.equal(l.y, 9);
  }
  assert.match(countHtml(64), /class="item-count mc-text"/);
  assert.equal(countHtml(1), "");
});

test("tooltip strings and geometry follow GuiScreen.drawHoverText", () => {
  const lines = [{ text: "Diamond Sword", color: "aqua", italic: true }, { text: "" }, { text: "+7 Attack Damage", color: "blue" }];
  const strings = lines.map(tooltipString);
  assert.deepEqual(strings, ["§b§oDiamond Sword", "§7", "§9+7 Attack Damage"]);
  const t = tooltipLayout(strings);
  assert.equal(t.width, Math.max(getStringWidth("Diamond Sword"), getStringWidth("+7 Attack Damage")));
  assert.deepEqual(t.ys, [0, 12, 22]);
  assert.equal(t.height, 8 + 2 + 2 * 10);
  assert.equal(tooltipLayout(["a"]).height, 8);
  assert.equal(tooltipHtml(lines).width, t.width);
  assert.match(tooltipHtml(lines).html, /<span class="tl">/);
});

test("rendered strings are cached per font state and keep native shadow colours", () => {
  const a = bitmapHtml("Hi", 0xffffff);
  assert.equal(bitmapHtml("Hi", 0xffffff), a);
  assert.match(a, /--sh:#3f3f3f/);
  assert.match(bitmapHtml("Hi", 0x80ff20), /color:#80ff20;--sh:#203f08/);
  const v = font.version;
  font.version++;
  try { assert.equal(bitmapHtml("Hi", 0xffffff), a); } finally { font.version = v; }
});

test("the XP level is four black copies and one 0x80FF20 copy (GuiIngame)", () => {
  const html = xpLevelHtml(7);
  assert.equal((html.match(/color:#000000/g) || []).length, 4);
  assert.equal((html.match(/color:#80ff20/g) || []).length, 1);
  assert.equal(xpLevelHtml(0), "");
});

test("entity names: custom name first, then entity.<EntityList>.name, English fallbacks equal en_US", () => {
  for (const [type, key] of Object.entries(ENTITY_LANG)) assert.equal(entityDisplayName(type), EN_US[`entity.${key}.name`], type);
  assert.equal(entityDisplayName({ type: "wither", customName: "Withie" }), "Withie");
  assert.equal(entityDisplayName("ender_crystal"), "Ender Crystal");
});

test("§ colours come from the FontRenderer table: native gold shadow, unknown code = white with styles cleared, anaglyph conversion", async () => {
  const { textHtml } = await import("./menu-ui.js");
  const { setFontAnaglyph } = await import("./font-renderer.js");
  const gold = textHtml("§6x", 0xffffff);
  assert.match(gold, /color:#ffaa00;--sh:#2a2a00/); // entry 22 = (170,170,0)/4: the +85 red is entry 6 only
  assert.match(textHtml("§nu§zq", 0xff0000), /color:#ffffff[^>]*>q/); // §z: indexOf -1 < 16 -> reset + colour 15
  assert.doesNotMatch(textHtml("§nu§zq", 0xff0000).split("§")[0].split("</span>")[1] ?? "", /tu/);
  setFontAnaglyph(true);
  try {
    assert.match(textHtml("§cx", 0xffffff), /color:#888888;--sh:#222222/); // (255,85,85) -> (136,136,136); shadow = that / 4
  } finally { setFontAnaglyph(false); }
  assert.match(textHtml("§cx", 0xffffff), /color:#ff5555/);
});

test("§k: random-capable runs are re-picked spans, nothing changes with the unicode flag", async () => {
  const { textHtml } = await import("./menu-ui.js");
  const html = textHtml("§kabc d", 0xffffff);
  assert.match(html, /class="kr" style="[^"]*" data-k="abc d" data-b="0"/);
  font.unicode = true;
  try { assert.doesNotMatch(textHtml("§kabc", 0xffffff), /kr/); } finally { font.unicode = false; }
});
