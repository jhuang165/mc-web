import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  ChatLog, chatWidth, chatHeight, stripFormatting, CHAT_VISIBILITY, chatDelivered, chatCanOpen, linkUrlAllowed, screenshotName,
} from "./chat.js";
import { optionText, chatOptionsLayout, confirmLinkLayout, CHAT_OPTIONS, denormalize, LANG } from "./menu-screens.js";
import { migrateSettings, CHAT_SETTING_DEFAULTS } from "./settings.js";
import { playerListLayout, playerListVisible, pingRow } from "./player-list.js";
import { successMessage, failureMessage, takeScreenshot } from "./screenshot.js";

const ref = JSON.parse(await readFile(new URL("../public/research/chat-options-reference.json", import.meta.url)));

test("chat width and height conversions replay the JAR's GuiNewChat", () => {
  for (const r of ref.records.filter((x) => x.case === "size")) {
    assert.equal(chatWidth(r.value), r.width, "width " + r.value);
    assert.equal(chatHeight(r.value), r.height, "height " + r.value);
  }
});

test("formatting codes are stripped as EnumChatFormatting.getTextWithoutFormattingCodes does", () => {
  for (const r of ref.records.filter((x) => x.case === "strip")) assert.equal(stripFormatting(r.input), r.output, r.input);
});

test("EnumChatVisibility table and the option labels come from the JAR", () => {
  for (const r of ref.records.filter((x) => x.case === "visibility")) {
    assert.equal(CHAT_VISIBILITY[r.ordinal].name, r.name);
    assert.equal(CHAT_VISIBILITY[r.ordinal].key, r.key);
  }
  for (const [k, v] of Object.entries(ref.lang)) if (k.startsWith("options.chat") || k.startsWith("screenshot") || k.startsWith("chat.") || k.startsWith("gui.")) assert.equal(LANG[k], v, k);
});

test("visibility filter: hidden drops everything, commands only keeps system messages", () => {
  assert.equal(chatDelivered(0, false), true);
  assert.equal(chatDelivered(0, true), true);
  assert.equal(chatDelivered(1, true), true);
  assert.equal(chatDelivered(1, false), false);
  assert.equal(chatDelivered(2, true), false);
  assert.equal(chatDelivered(2, false), false);
  assert.equal(chatCanOpen(2), false);
  assert.equal(chatCanOpen(1), true);
});

test("slider text follows GameSettings.getKeyBinding", () => {
  assert.equal(optionText("CHAT_OPACITY", 1), "Opacity: 100%");
  assert.equal(optionText("CHAT_OPACITY", 0), "Opacity: 10%");
  assert.equal(optionText("CHAT_SCALE", 0), "Scale: OFF");
  assert.equal(optionText("CHAT_SCALE", 0.5), "Scale: 50%");
  assert.equal(optionText("CHAT_WIDTH", 1), "Width: 320px");
  assert.equal(optionText("CHAT_HEIGHT_FOCUSED", 1), "Focused Height: 180px");
  assert.equal(optionText("CHAT_HEIGHT_UNFOCUSED", CHAT_SETTING_DEFAULTS.chatHeightUnfocused), "Unfocused Height: 90px");
  assert.equal(optionText("CHAT_VISIBILITY", 1), "Chat: Commands Only");
  assert.equal(optionText("CHAT_COLOR", true), "Colors: ON");
  assert.equal(optionText("CHAT_LINKS_PROMPT", false), "Prompt on Links: OFF");
  assert.equal(denormalize("CHAT_SCALE", 0.25), 0.25);
});

test("ScreenChatOptions layout: nine options in two columns, the cape row and Done", () => {
  assert.deepEqual(ref.widgetOrder, CHAT_OPTIONS);
  const L = chatOptionsLayout(854, 480), s = 80, c = 427;
  assert.deepEqual(L.options.map(([o]) => o), CHAT_OPTIONS);
  assert.deepEqual(L.options[0][1], { x: c - 155, y: s, w: 150, h: 20 });
  assert.deepEqual(L.options[1][1], { x: c + 5, y: s, w: 150, h: 20 });
  assert.deepEqual(L.options[8][1], { x: c - 155, y: s + 96, w: 150, h: 20 });
  assert.deepEqual(L.cape, { x: c - 155, y: s + 144, w: 150, h: 20 });
  assert.equal(L.subtitle[1], s + 127);
  assert.equal(L.buttons.done.y, s + 168);
  const K = confirmLinkLayout(320, 240);
  assert.deepEqual(K.buttons.yes, { x: 106 - 83 + 0, y: 40 + 96, w: 100, h: 20 });
  assert.equal(K.buttons.no.x, 106 - 83 + 210);
});

test("chat settings persist with native defaults and bad values are dropped", () => {
  const s = migrateSettings({ chatVisibility: 7, chatColors: "x", chatScale: 3, chatWidth: -1, chatOpacity: 0.5, chatLinks: false, showCape: false, chatHeightFocused: "a" });
  assert.equal(s.chatVisibility, 2);
  assert.equal("chatColors" in s, false);
  assert.equal(s.chatScale, 1);
  assert.equal(s.chatWidth, 0);
  assert.equal(s.chatOpacity, 0.5);
  assert.equal(s.chatLinks, false);
  assert.equal(s.showCape, false);
  assert.equal("chatHeightFocused" in s, false);
  assert.deepEqual(CHAT_SETTING_DEFAULTS, { chatVisibility: 0, chatColors: true, chatLinks: true, chatLinksPrompt: true, chatOpacity: 1, chatScale: 1, chatWidth: 1, chatHeightFocused: 1, chatHeightUnfocused: 0.44366196, showCape: true });
});

test("ChatLog honours colours, width, scale and heights and rewraps on change", () => {
  const log = new ChatLog();
  log.print("§aGreen text", 0);
  assert.equal(log.lines[0].text, "§aGreen text");
  log.applySettings({ chatColors: false });
  assert.equal(log.lines[0].text, "Green text");
  log.applySettings({ chatColors: true });
  assert.equal(log.lines[0].text, "§aGreen text");
  const long = "word ".repeat(40);
  log.print(long, 1);
  const wide = log.lines.length;
  log.applySettings({ chatWidth: 0 }); // 40 px
  assert.equal(log.width, 40);
  assert.ok(log.lines.length > wide, "narrower chat wraps into more lines");
  log.applySettings({ chatHeightFocused: 0, chatHeightUnfocused: 0 });
  assert.equal(log.visibleLines(true), 2);
  assert.equal(log.visibleLines(false), 2);
  log.applySettings({ chatOpacity: 0 });
  assert.equal(log.draw(0, true)[0].alpha, 25); // 255 * (0 * 0.9 + 0.1)
});

test("link spans are hit-tested per line and carry the click event", () => {
  const log = new ChatLog();
  log.print("Saved screenshot as §nfile.png§r", 0, 0, [{ text: "file.png", click: { action: "open_file", value: "file.png" } }]);
  const x0 = 0;
  assert.equal(log.clickAt(x0 + 1, 3), null);
  const hit = log.clickAt(120, 3);
  assert.equal(hit?.value, "file.png");
  assert.equal(log.clickAt(120, 12), null);
  assert.equal(log.clickAt(120, -1), null);
});

test("only http and https links are allowed", () => {
  assert.equal(linkUrlAllowed("https://example.com/a"), true);
  assert.equal(linkUrlAllowed("HTTP://example.com"), true);
  assert.equal(linkUrlAllowed("ftp://example.com"), false);
  assert.equal(linkUrlAllowed("javascript:alert(1)"), false);
  assert.equal(linkUrlAllowed("example.com"), false);
});

test("screenshot names follow yyyy-MM-dd_HH.mm.ss with the first free _N suffix", () => {
  const d = new Date(2026, 10, 6, 9, 5, 7);
  assert.equal(screenshotName(d), "2026-11-06_09.05.07.png");
  const used = new Set(["2026-11-06_09.05.07.png", "2026-11-06_09.05.07_2.png"]);
  assert.equal(screenshotName(d, (n) => used.has(n)), "2026-11-06_09.05.07_3.png");
  assert.equal(ref.screenshot.format, "yyyy-MM-dd_HH.mm.ss");
});

test("screenshot messages and the capture flow", () => {
  const m = successMessage("a.png");
  assert.equal(m.text, "Saved screenshot as §na.png§r");
  assert.equal(m.links[0].click.action, "open_file");
  assert.equal(failureMessage("boom").text, "Couldn't save screenshot: boom");
  const out = [], saved = [];
  takeScreenshot({ capture: (cb) => cb({ size: 1 }), save: (b, n) => saved.push(n), print: (x) => out.push(x), now: () => new Date(2026, 0, 2, 3, 4, 5) });
  assert.deepEqual(saved, ["2026-01-02_03.04.05.png"]);
  assert.match(out[0].text, /Saved screenshot as/);
  takeScreenshot({ capture: (cb) => cb(null), save: () => {}, print: (x) => out.push(x) });
  assert.match(out[1].text, /Couldn't save screenshot: no image data/);
});

test("tab list: native condition, layout and ping bars", () => {
  assert.equal(playerListVisible({ integrated: true, players: 1 }), false);
  assert.equal(playerListVisible({ integrated: true, players: 2 }), true);
  assert.equal(playerListVisible({ integrated: false, players: 1 }), true);
  assert.equal(playerListVisible({ integrated: true, players: 1, lanShared: true }), true);
  const L = playerListLayout(8, 320);
  assert.equal(L.cols, 1);
  assert.equal(L.colWidth, 150);
  assert.equal(L.x0, 85);
  assert.deepEqual(L.backdrop, { x: 84, y: 9, w: 151, h: 73 });
  assert.deepEqual(L.cells[3], { x: 85, y: 37 });
  const big = playerListLayout(60, 854);
  assert.equal(big.cols, 3);
  assert.equal(big.rows, 20);
  assert.equal(big.colWidth, 100);
  assert.deepEqual([-1, 0, 149, 150, 299, 300, 599, 600, 999, 1000].map(pingRow), [5, 0, 0, 1, 1, 2, 2, 3, 3, 4]);
  assert.equal(ref.playerList.maxPlayers, 8);
});
