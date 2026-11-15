// Replays the EXECUTED 1.7.10 menu records (public/research/gui-menus-reference.json, tools/verify-gui-menus.mjs: real initGui/drawScreen
// with a fake Minecraft, recording buttonList and drawString calls) against the port's screens through a recording widget factory.
// Buttons are matched by rect; labels and enabled state are compared; the remaining differences must equal the documented list per case,
// so a listed difference that stops occurring fails the test (the list then needs trimming) and a new one fails it too.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createMenus } from "./menus.js";
import { textWidth } from "./menu-screens.js";
import { gameOverScreen } from "./modal-dialogs.js";
import { KeyBindings } from "./keybindings.js";

globalThis.document ??= { fullscreenElement: null };
import { recorder, fakeGui } from "./gui-record.test-helper.js";

const REF = JSON.parse(readFileSync(new URL("../public/research/gui-menus-reference.json", import.meta.url), "utf8")).rows;
const ref = (screen, w = 320) => REF.find((r) => r.screen === screen && r.w === w);

function setup(over = {}) {
  const shown = [];
  const ctx = {
    options: { difficulty: 2, fov: 70, sensitivity: 0.5, soundLevels: {} }, inGame: () => true, lanOpen: () => false, isRemote: () => false,
    bindings: new KeyBindings(), worlds: [{ id: "w1", name: "World1", mode: "survival" }], splashes: ["x"], soundLevel: () => 1,
    saveOptions() {}, closeScreen() {}, activeWorld: () => null, canSingleplayer: () => true, achievements: {}, stats: {}, icon() {}, ...over,
  };
  return { menus: createMenus(fakeGui(shown), ctx), shown, ctx };
}
const init = (screen, w = 320, h = 240) => { const { g, rec } = recorder(w); screen.init(g, w, h); return rec; };
const press = (rec, label) => { const b = rec.buttons.find((x) => x.label === label); assert.ok(b, `no button ${label}`); b.action(); };

// Compare a native record with a port record. Returns difference strings.
function diff(native, rec) {
  const out = [];
  const used = new Set();
  for (const n of native.buttons.filter((b) => b.visible)) {
    const i = rec.buttons.findIndex((p, k) => !used.has(k) && !p.hidden && p.x === n.x && p.y === n.y && p.w === n.w && p.h === n.h);
    if (i < 0) { out.push(`native-only ${JSON.stringify(n.label)} ${n.w}x${n.h}`); continue; }
    used.add(i);
    const p = rec.buttons[i];
    if (n.label !== p.label) out.push(`label ${JSON.stringify(n.label)} / ${JSON.stringify(p.label)}`);
    if (n.enabled !== p.enabled) out.push(`enabled ${JSON.stringify(n.label)} native=${n.enabled} port=${p.enabled}`);
  }
  rec.buttons.forEach((p, k) => { if (!used.has(k) && !p.hidden && p.inList === undefined) out.push(`port-only ${JSON.stringify(p.label)} ${p.w}x${p.h}`); });
  return out;
}
// Native drawString calls (x is the left edge) against port text calls (centre x when `center`). Strings are matched exactly.
function textDiff(native, rec) {
  const out = [];
  const used = new Set();
  for (const n of native.text) {
    const i = rec.texts.findIndex((p, k) => !used.has(k) && !p.hidden && p.text === n.text);
    if (i < 0) continue; // state-dependent strings (option values, world names, lists) are not matched
    used.add(i);
    const p = rec.texts[i], x = p.center ? p.x - Math.trunc(textWidth(p.text) / 2) : p.right ? p.x - textWidth(p.text) : p.x;
    if (x !== n.x || p.y !== n.y) out.push(`pos ${JSON.stringify(n.text)} native=${n.x},${n.y} port=${x},${p.y}`);
  }
  return out;
}
const SIZES = [[320, 240], [427, 240], [200, 150]];

const viaOptions = (label) => ({ menus }) => { const rec = init(menus.optionsScreen(() => null)); press(rec, label); return null; };
const opened = (open) => (s) => { open(s); return s.shown.at(-1); };
const BC = 'enabled "Broadcast Settings..." native=true port=false', SN = 'enabled "Snooper Settings..." native=true port=false';
const TS = 'enabled "Touchscreen Mode: OFF" native=true port=false';
const MP = 'enabled "Multiplayer" native=true port=false', RE = 'enabled "Minecraft Realms" native=true port=false', QT = 'enabled "Quit Game" native=true port=false';
const LANG = 'native-only "" 20x20'; // the language button is drawn by g.languageButton (asserted separately)
const IMP = 'port-only "Import" 50x20', EXP = 'port-only "Export" 50x20', END = 'port-only "Endless" 50x20';
const GS = 'enabled "Generate Structures: ON" native=true port=false';
const EXPORT = 'port-only "Export World" 200x20';
const CASES = [
  ["GuiIngameMenu+remote", ({ menus }) => menus.ingameMenu(), { isRemote: () => true }, [EXPORT]],
  ["GuiIngameMenu+singleplayer", ({ menus }) => menus.ingameMenu(), {}, [EXPORT]],
  ["GuiOptions+noworld", ({ menus }) => menus.optionsScreen(() => null), { inGame: () => false }, [BC, SN]],
  ["GuiOptions+world", ({ menus }) => menus.optionsScreen(() => null), {}, [BC, SN]],
  ["GuiOptions+hardcore", ({ menus }) => menus.optionsScreen(() => null), { activeWorld: () => ({ hardcore: true }) }, [BC, SN]],
  ["GuiVideoSettings", opened(({ menus }) => press(init(menus.optionsScreen(() => null)), "Video Settings...")), {}, []],
  ["GuiScreenOptionsSounds", opened(({ menus }) => press(init(menus.optionsScreen(() => null)), "Music & Sounds...")), {}, []],
  ["GuiControls", opened(({ menus }) => press(init(menus.optionsScreen(() => null)), "Controls...")), {}, [TS]],
  ["GuiLanguage", opened(({ menus }) => press(init(menus.optionsScreen(() => null)), "Language...")), {}, []],
  ["ScreenChatOptions", ({ menus }) => menus.chatOptionsScreen({}), {}, []],
  ["GuiShareToLan", opened(({ menus }) => press(init(menus.ingameMenu()), "Open to LAN")), {}, []],
  ["GuiConfirmOpenLink+untrusted", ({ menus }) => menus.confirmOpenLink("http://example.com", () => {}), {}, []],
  ["GuiMainMenu", ({ menus }) => menus.mainMenu(), {}, [MP, RE, QT, LANG]],
  ["GuiSelectWorld", ({ menus }) => menus.selectWorld(), {}, [IMP, EXP, END]],
  ["GuiGameOver", () => gameOverScreen({ show() {} }), {}, []],
  // Remote hardcore shows "Leave server" (deathScreen.leaveServer); the port's death screen has only the singleplayer wording.
  ["GuiGameOverHardcore", () => gameOverScreen({ hardcore: true, show() {} }), {}, ['label "Leave server" / "Delete world"']],
  ["GuiGameOverHardcore+singleplayer", () => gameOverScreen({ hardcore: true, show() {} }), {}, []],
  ["GuiCreateWorld", ({ menus }) => menus.createWorld({}), {}, []],
  ["GuiCreateWorld+more", ({ menus }) => { const sc = menus.createWorld({}); press(init(sc), "More World Options..."); return sc; }, {}, [GS]],
];
const only = process.env.ONLY;
for (const [name, make, ctxOver = {}, allowed = []] of CASES) {
  if (only && !name.includes(only)) continue;
  for (const [w, h] of SIZES) {
    test(`b75 menu replay ${name} ${w}x${h}`, () => {
      const s = setup(ctxOver);
      const n = ref(name, w);
      assert.ok(n, name);
      const d = diff(n, init(make(s), w, h));
      if (process.env.REPORT) console.log(name, w, JSON.stringify(d));
      else assert.deepEqual(d, allowed);
      // Every native string the port also draws sits at the native position (centred strings by their left edge).
      const td = textDiff(n, init(make(setup(ctxOver)), w, h));
      if (process.env.REPORT) console.log("TEXT", name, w, JSON.stringify(td));
      else assert.deepEqual(td, []);
    });
  }
}
