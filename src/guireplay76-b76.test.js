// Batch 76 guireplay76: replays the remaining executed 1.7.10 records of public/research/gui-menus-reference.json (Multiplayer, Resource Packs,
// Add Server, Direct Connect, Disconnected, Sleep, Rename World, Yes/No) against the port, plus the Generate Structures toggle of Create World and
// the remote hardcore death button. Evidence: native rows are Executed (tools/verify-gui-menus.mjs); the Generate Structures rule is Bytecode-read
// (bdb = GuiCreateWorld: field s flips on button 4, bcb.l is only written for the Allow Cheats and Bonus Chest buttons); port behaviour is Port-read.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createMenus } from "./menus.js";
import { textWidth } from "./menu-screens.js";
import { gameOverScreen, quitConfirmScreen } from "./modal-dialogs.js";
import { KeyBindings } from "./keybindings.js";
import { ServerList, serverListScreen, addServerScreen, directConnectScreen, disconnectedScreen } from "./multiplayer/server-list-gui.js";
import { resourcePacksLayout } from "./resource-packs-ui.js";
import { BED_TEXT } from "./bed.js";

globalThis.document ??= { fullscreenElement: null };
import { recorder, fakeGui } from "./gui-record.test-helper.js";

const REF = JSON.parse(readFileSync(new URL("../public/research/gui-menus-reference.json", import.meta.url), "utf8")).rows;
const ref = (screen, w) => REF.find((r) => r.screen === screen && r.w === w);
const SIZES = [[320, 240], [427, 240], [200, 150]];
const init = (screen, w, h) => { const { g, rec } = recorder(w); screen.init(g, w, h); return rec; };
const store = () => ({ getItem: () => null, setItem() {} });

// Button differences (rect, label, enabled), as in gui-menus-b75.test.js.
function diff(native, rec) {
  const out = [], used = new Set();
  for (const n of native.buttons.filter((b) => b.visible)) {
    const i = rec.buttons.findIndex((p, k) => !used.has(k) && !p.hidden && p.x === n.x && p.y === n.y && p.w === n.w && p.h === n.h);
    if (i < 0) { out.push(`native-only ${JSON.stringify(n.label)} ${n.x},${n.y} ${n.w}x${n.h}`); continue; }
    used.add(i);
    const p = rec.buttons[i];
    if (n.label !== p.label) out.push(`label ${JSON.stringify(n.label)} / ${JSON.stringify(p.label)}`);
    if (n.enabled !== p.enabled) out.push(`enabled ${JSON.stringify(n.label)} native=${n.enabled} port=${p.enabled}`);
  }
  rec.buttons.forEach((p, k) => { if (!used.has(k) && !p.hidden && p.inList === undefined) out.push(`port-only ${JSON.stringify(p.label)} ${p.x},${p.y} ${p.w}x${p.h}`); });
  return out;
}
// Strings the port draws with g.text, matched by exact text: left edge (centre x for `center`), y and colour (default white 0xFFFFFF).
function textDiff(native, rec) {
  const out = [], used = new Set();
  for (const n of native.text) {
    const i = rec.texts.findIndex((p, k) => !used.has(k) && !p.hidden && p.text === n.text);
    if (i < 0) continue;
    used.add(i);
    const p = rec.texts[i], x = p.center ? p.x - Math.trunc(textWidth(p.text) / 2) : p.right ? p.x - textWidth(p.text) : p.x;
    if (x !== n.x || p.y !== n.y) out.push(`pos ${JSON.stringify(n.text)} native=${n.x},${n.y} port=${x},${p.y}`);
    const color = p.color ?? 0xffffff;
    if (color !== n.color) out.push(`color ${JSON.stringify(n.text)} native=${n.color} port=${color}`);
  }
  return out;
}
// Native GuiTextField text sits at (x + 4, y + (h - 8) / 2) with the colour 14737632; the port's field rect must put it there.
function fieldDiff(native, rec) {
  const out = [];
  for (const n of native.text.filter((s) => s.color === 14737632 && s.text !== "_")) {
    const f = rec.fields.find((p) => p.x + 4 === n.x && p.y + Math.trunc((p.h - 8) / 2) === n.y);
    if (!f) out.push(`no field for ${JSON.stringify(n.text)} at ${n.x},${n.y}`);
  }
  return out;
}

function replay(name, make, { allowed = [], textAllowed = [], fields = false, sizes = SIZES, nativeName = name } = {}) {
  for (const [w, h] of sizes) {
    test(`b76 replay ${name} ${w}x${h}`, () => {
      const n = ref(nativeName, w);
      assert.ok(n, nativeName);
      const rec = init(make(), w, h);
      assert.deepEqual(diff(n, rec), allowed);
      assert.deepEqual(textDiff(n, rec), textAllowed);
      if (fields) assert.deepEqual(fieldDiff(n, rec), []);
    });
  }
}

const list = (entries = []) => { const l = new ServerList(store()); l.entries = entries; return l; };
const never = () => new Promise(() => {});
const noop = () => {};

function setup(over = {}) {
  const shown = [];
  const ctx = {
    options: { difficulty: 2, fov: 70, sensitivity: 0.5, soundLevels: {} }, inGame: () => true, lanOpen: () => false, isRemote: () => false,
    bindings: new KeyBindings(), worlds: [{ id: "w1", name: "World1", mode: "survival" }], splashes: ["x"], soundLevel: () => 1,
    saveOptions() {}, closeScreen() {}, activeWorld: () => null, canSingleplayer: () => true, achievements: {}, stats: {}, icon() {}, renameWorld() {}, deleteWorld() {}, ...over,
  };
  return { menus: createMenus(fakeGui(shown), ctx), shown };
}
// Selects the world in the Select World list, presses a button and returns the screen it opened.
function fromSelectWorld(label) {
  const { menus, shown } = setup();
  const rec = init(menus.selectWorld(), 320, 240);
  rec.lists[0].click(0, false);
  rec.buttons.find((b) => b.label === label).action();
  return shown.at(-1);
}

// Port-read: GuiMultiplayer draws no "Scanning for games on your local network" (a web page has no LAN discovery); every button matches.
replay("GuiMultiplayer", () => serverListScreen({ list: list(), ping: never, show: noop, join: noop, back: noop }));
replay("GuiScreenAddServer", () => addServerScreen({ entry: { name: "Minecraft Server", ip: "" }, done: noop, cancel: noop }), { fields: true });
replay("GuiScreenAddServer+existing", () => addServerScreen({ entry: { name: "Home", ip: "play.example.com:25566" }, done: noop, cancel: noop }), { fields: true });
replay("GuiScreenServerList", () => directConnectScreen({ connect: noop, cancel: noop }), { fields: true });
replay("GuiDisconnected", () => disconnectedScreen({ headingKey: "disconnect.lost", message: "Timed out", back: noop }));
replay("GuiRenameWorld", () => fromSelectWorld("Rename"), { fields: true });
// The port has no free-standing GuiYesNo: its instances are the delete confirmation (Delete / Cancel), the quit confirmation of the death
// screen (Title screen / Respawn, delayed by 20 ticks) and the endless copy question. Geometry equals the native record; labels differ by design.
replay("GuiYesNo (death screen quit question)", () => quitConfirmScreen({ yes: noop, no: noop, again: noop }), { nativeName: "GuiYesNo",
  allowed: ['label "Yes" / "Title screen"', 'enabled "Yes" native=true port=false', 'label "No" / "Respawn"', 'enabled "No" native=true port=false'] });
replay("GuiYesNo (delete world)", () => fromSelectWorld("Delete"), { nativeName: "GuiYesNo", textAllowed: [],
  allowed: ['label "Yes" / "Delete"', 'label "No" / "Cancel"'] });

test("b76 GuiScreenResourcePacks geometry (layout function; the screen itself needs IndexedDB and the DOM)", () => {
  for (const [w, h] of SIZES) {
    const n = ref("GuiScreenResourcePacks", w), L = resourcePacksLayout(w, h);
    const rects = { folder: n.buttons.find((b) => b.id === 2), done: n.buttons.find((b) => b.id === 1) };
    for (const k of ["folder", "done"]) assert.deepEqual([L.buttons[k].x, L.buttons[k].y, L.buttons[k].w, L.buttons[k].h], [rects[k].x, rects[k].y, rects[k].w, rects[k].h], `${k} ${w}x${h}`);
    assert.deepEqual(n.buttons.map((b) => b.label).sort(), ["Done", "Open resource pack folder"]);
    // Title (centred, y 16) and the folder info line (centred, y h - 26, gray) against the native drawString calls.
    const title = n.text.find((s) => s.text === "Select Resource Packs"), info = n.text.find((s) => s.text === "(Place resource pack files here)");
    assert.equal(L.title[0] - Math.trunc(textWidth(title.text) / 2), title.x);
    assert.equal(L.title[1], title.y);
    assert.equal(L.info[0] - Math.trunc(textWidth(info.text) / 2), info.x);
    assert.equal(L.info[1], info.y);
  }
});

test("b76 GuiSleepMP: Leave Bed is a DOM button in the port (Port-read of main.js)", () => {
  const src = readFileSync(new URL("./main.js", import.meta.url), "utf8");
  assert.equal(BED_TEXT.leave, "Leave Bed");
  // native (w/2 - 100, h - 40) 200 x 20 at every size; CSS: left 50% - 100, bottom 20, 200 x 20.
  for (const [w, h] of SIZES) { const n = ref("GuiSleepMP", w).buttons[0]; assert.deepEqual([n.x, n.y, n.w, n.h, n.label], [Math.trunc(w / 2) - 100, h - 40, 200, 20, "Leave Bed"]); }
  assert.ok(src.includes("left:calc(50% - 100*var(--u));bottom:calc(20*var(--u));width:calc(200*var(--u));height:calc(20*var(--u))"));
});

// --- Generate Structures (bytecode-read bdb + executed records: always enabled, ON by default, flipped by button 4) ---
test("b76 Generate Structures is enabled for the Java world types and toggles", () => {
  const { menus } = setup();
  const sc = menus.createWorld({}), rec = init(sc, 320, 240);
  rec.buttons.find((b) => b.label === "More World Options...").action();
  let gs = rec.buttons.find((b) => /^Generate Structures/.test(b.label) && !b.hidden);
  const n = ref("GuiCreateWorld+more", 320).buttons.find((b) => b.id === 4);
  assert.deepEqual([gs.x, gs.y, gs.w, gs.h, gs.label, gs.enabled], [n.x, n.y, n.w, n.h, n.label, n.enabled]);
  gs.action();
  assert.equal(gs.label, "Generate Structures: OFF");
  assert.equal(gs.enabled, true);
  gs.action();
  assert.equal(gs.label, "Generate Structures: ON");
});
test("b76 Generate Structures stays enabled for hardcore, Superflat and Amplified (native records) and the record carries the flag", () => {
  for (const name of ["GuiCreateWorld+more+type", "GuiCreateWorld+more+type3"]) assert.equal(ref(name, 320).buttons.find((b) => b.id === 4).enabled, true);
  let launched = null;
  const { menus } = setup({ launch: (r) => { launched = r; }, makeRecord: (p) => p, folderName: undefined });
  const sc = menus.createWorld({}), rec = init(sc, 320, 240);
  rec.buttons.find((b) => b.label === "More World Options...").action();
  const mode = rec.buttons.find((b) => /^Game Mode/.test(b.label));
  mode.action(); // hardcore
  const gs = rec.buttons.find((b) => /^Generate Structures/.test(b.label));
  assert.equal(gs.enabled, true);
  gs.action();
  rec.buttons.find((b) => b.label === "Create New World").action();
  assert.equal(launched.mapFeatures, false);
  assert.equal(launched.hardcore, true);
});
test("b76 browser landscapes keep Generate Structures drawn Off and disabled (no structures exist there)", () => {
  const { menus } = setup();
  const rec = init(menus.createWorld({}), 320, 240);
  rec.buttons.find((b) => b.label === "More World Options...").action();
  const type = rec.buttons.find((b) => /^World Type/.test(b.label));
  for (let i = 0; i < 4; i++) type.action();
  const gs = rec.buttons.find((b) => /^Generate Structures/.test(b.label));
  assert.deepEqual([gs.label, gs.enabled], ["Generate Structures: OFF", false]);
});

// --- GuiGameOver remote hardcore ---
test("b76 remote hardcore death screen reads Leave server (executed GuiGameOverHardcore, single=false)", () => {
  for (const [w, h] of SIZES) {
    const n = ref("GuiGameOverHardcore", w), rec = init(gameOverScreen({ hardcore: true, remote: true, show() {} }), w, h);
    assert.deepEqual(diff(n, rec), []);
    assert.equal(rec.buttons.length, 1);
  }
});
test("b76 singleplayer hardcore death keeps Delete world; remote softcore keeps Respawn and Title screen", () => {
  const sp = init(gameOverScreen({ hardcore: true, show() {} }), 320, 240);
  assert.deepEqual(sp.buttons.map((b) => b.label), ["Delete world"]);
  const soft = init(gameOverScreen({ hardcore: false, remote: true, show() {} }), 320, 240);
  assert.deepEqual(soft.buttons.map((b) => b.label), ["Respawn", "Title screen"]);
});
