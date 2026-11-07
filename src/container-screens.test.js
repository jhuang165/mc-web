import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SCREENS, CONTAINER_KINDS, BACKGROUND, backgroundCss, screenSize, guiOrigin, labelLayout, labelsHtml, containerKeyAction, beaconLabelX, BEACON_LABELS } from "./container-screens.js";
import { scaledSize } from "./menu-screens.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/container-screens-reference.json", import.meta.url)));
const main = readFileSync(new URL("./main.js", import.meta.url), "utf8");
const w = (s) => 6 * s.length; // a fixed-width stand-in for FontRenderer

test("drawDefaultBackground gradient is 0xC0101010 to 0xD0101010", () => {
  assert.equal(BACKGROUND.from, 0xc0101010);
  assert.equal(BACKGROUND.to, 0xd0101010);
  assert.match(backgroundCss(), /rgba\(16,16,16,0\.7529\),rgba\(16,16,16,0\.8157\)/);
});

test("xSize / ySize match the reference JSON", () => {
  for (const kind of CONTAINER_KINDS) {
    const r = ref.screens[kind];
    assert.ok(r, kind);
    const s = screenSize(kind, { rows: 3 });
    assert.equal(s.xSize, r.xSize, kind);
    if (typeof r.ySize === "number") assert.equal(s.ySize, r.ySize, kind);
  }
  assert.equal(screenSize("chest", { rows: 3 }).ySize, 168);
  assert.equal(screenSize("chest", { rows: 6 }).ySize, 222);
  assert.deepEqual(screenSize("beacon"), { xSize: 230, ySize: 219 });
  assert.deepEqual(screenSize("creative"), { xSize: 195, ySize: 136 });
  assert.equal(screenSize("hopper").ySize, 133);
});

test("guiLeft / guiTop use int division of the ceil scaled size", () => {
  // 854x480 at scale 2 -> 427 x 240
  assert.deepEqual(scaledSize(854, 480, 2), { w: 427, h: 240 });
  const inv = guiOrigin("inventory", 854, 480, 2);
  assert.equal(inv.guiLeft, 125); // (427 - 176) / 2 = 125.5 -> 125
  assert.equal(inv.guiTop, 37); // (240 - 166) / 2
  assert.equal(guiOrigin("chest", 854, 480, 2, { rows: 3 }).guiTop, 36);
  assert.equal(guiOrigin("beacon", 854, 480, 2).guiLeft, 98);
  assert.equal(guiOrigin("creative", 854, 480, 2).guiTop, 52);
  // fractional display / scale rounds up
  assert.equal(scaledSize(1001, 601, 3).w, 334);
  const m = guiOrigin("furnace", 1000, 600, 3);
  assert.equal(m.guiLeft, Math.trunc((334 - 176) / 2));
});

test("labels follow the bytecode offsets", () => {
  const at = (kind, opts) => Object.fromEntries(labelLayout(kind, { width: w, ...opts }).map((l) => [l.id, [l.x, l.y]]));
  assert.deepEqual(at("inventory", { title: "Crafting" }), { title: [86, 16] });
  assert.deepEqual(at("workbench", { title: "Crafting" }), { title: [28, 6], inventory: [8, 72] });
  assert.deepEqual(at("chest", { title: "Chest", rows: 3 }), { title: [8, 6], inventory: [8, 74] });
  assert.deepEqual(at("chest", { title: "Large Chest", rows: 6 }), { title: [8, 6], inventory: [8, 128] });
  assert.deepEqual(at("hopper", { title: "H" }), { title: [8, 6], inventory: [8, 39] });
  assert.deepEqual(at("enchanting", { title: "Enchant" }), { title: [12, 5], inventory: [8, 72] });
  assert.deepEqual(at("anvil", { title: "Repair" }), { title: [60, 6] });
  assert.deepEqual(at("horse", { title: "Horse" }), { title: [8, 6], inventory: [8, 72] });
  // centred titles: xSize / 2 - width / 2 in int arithmetic
  assert.deepEqual(at("furnace", { title: "Furnace" }).title, [88 - Math.trunc(42 / 2), 6]);
  assert.deepEqual(at("dispenser", { title: "Dispenser" }).title, [88 - 27, 6]);
  assert.equal(at("brewing", { title: "Brewing Stand" }).title[0], 88 - Math.trunc(78 / 2));
  assert.equal(at("merchant", { title: "Villager" }).title[1], 6);
  // the merchant inventory label belongs to merchant-ui.js; the beacon draws neither title nor inventory label here
  assert.equal(at("merchant", { title: "V" }).inventory, undefined);
  assert.deepEqual(labelLayout("beacon", { title: "x" }), []);
  assert.deepEqual(at("creative", { title: "Building Blocks" }), { title: [8, 6] });
});

test("beacon labels are centred at 62 and 169, y 10, 0xE0E0E0", () => {
  assert.deepEqual(BEACON_LABELS, { y: 10, color: 0xe0e0e0, xs: [62, 169] });
  assert.equal(beaconLabelX(62, 60), 32);
  assert.equal(beaconLabelX(169, 61), 169 - 30);
});

test("reference JSON agrees with SCREENS for every kind", () => {
  assert.deepEqual(Object.keys(ref.screens).sort(), [...CONTAINER_KINDS].sort());
  assert.equal(ref.guiContainer.titleColor, 0x404040);
  for (const kind of CONTAINER_KINDS) assert.ok(SCREENS[kind].cls.includes("("), kind);
});

test("labels markup carries no page-font chrome and escapes text", () => {
  const html = labelsHtml("chest", { title: "<b>&", rows: 3 });
  assert.match(html, /&lt;b>&amp;/);
  assert.doesNotMatch(html, /close-button|modal-top|<h2/);
  assert.match(labelsHtml("creative", { title: "" }), /id="modal-title"/);
  // drawLabel skips an element whose data-bitmap already equals its text, so a pre-set data-bitmap leaves the label undrawn
  assert.doesNotMatch(labelsHtml("workbench", { title: "Crafting" }), /data-bitmap/);
  assert.match(labelsHtml("inventory", { title: "Crafting" }), />Crafting<\/span>/);
});

test("key handling: Escape and key.inventory close, a focused text field keeps the inventory key", () => {
  assert.equal(containerKeyAction({ escape: true }), "close");
  assert.equal(containerKeyAction({ escape: true, textFocused: true }), "close");
  assert.equal(containerKeyAction({ inventoryKey: true }), "close");
  assert.equal(containerKeyAction({ inventoryKey: true, textFocused: true }), null);
  assert.equal(containerKeyAction({}), null);
});

test("every container and the book route through containerShell, not modal()", () => {
  const open = main.slice(main.indexOf("function openContainer("), main.indexOf("function openContainer(") + 4200);
  assert.match(open, /containerShell\(/);
  assert.doesNotMatch(open, /\bmodal\(/);
  assert.match(main, /openBookUi\(\{ show: \(title, html\) => containerShell\("book"/);
  // modal() was removed with its last two callers
  const callers = main.match(/[^.\w]modal\(/g) ?? [];
  assert.equal(callers.length, 0, "the page-font modal() shell is gone");
  for (const kind of CONTAINER_KINDS) assert.ok(typeof SCREENS[kind].xSize === "number");
});

test("the shell CSS darkens with the native gradient and the old furnace page label is gone", () => {
  const css = readFileSync(new URL("./container-ui.css", import.meta.url), "utf8");
  assert.match(css, /#modal\.gui-shell\{[^}]*linear-gradient\(rgba\(16,16,16,\.7529\),rgba\(16,16,16,\.8157\)\)/);
  const mc = readFileSync(new URL("./minecraft-ui.css", import.meta.url), "utf8");
  assert.doesNotMatch(mc, /furnace-modal:before\{content:'Inventory'/);
});
