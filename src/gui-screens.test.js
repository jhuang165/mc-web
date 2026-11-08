// Batch 25 non-container GUI parity: replays public/research/gui-screens-reference.json (tools/verify-gui-screens.mjs, bytecode-read)
// against the GuiEditSign geometry, the GuiAchievement toast, the tick-driven GuiGameOver / GuiYesNo delay, the disabled GuiTextField
// colour and the GuiErrorScreen routes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { signGuiGeometry, SIGN_GUI } from './sign-layout.js';
import { signEditLayout, gameOverScreen, quitConfirmScreen, BUTTON_DELAY_TICKS } from './modal-dialogs.js';
import { toastState, TOAST_MS, TOAST_W, TOAST_H, HINT_DELAY_MS } from './achievements-ui.js';
import { errorLayout, workingLayout, errorScreen } from './loading-screen.js';
import { createMenus } from './menus.js';

const ref = JSON.parse(readFileSync(new URL('../public/research/gui-screens-reference.json', import.meta.url), 'utf8'));
const src = (f) => readFileSync(new URL(f, import.meta.url), 'utf8');
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg}: ${a} vs ${b}`);
const rect = (a, b, msg) => { for (const k of ['x', 'y', 'w', 'h']) near(a[k], b[k], `${msg}.${k}`); };

function fakeGui() {
  const calls = { text: [], button: [] };
  return {
    calls, sound() {},
    text: (s, x, y, o = {}) => { calls.text.push({ s, x, y, ...o }); return { set() {} }; },
    image: () => ({ style: {}, append() {} }),
    button: (r, label, action) => { const b = { r, label, action, enabled: true, enable(on) { b.enabled = !!on; } }; calls.button.push(b); return b; },
  };
}

test('GuiEditSign: the board, stick and text origin follow the drawScreen transforms (standing and wall)', () => {
  assert.deepEqual([SIGN_GUI.scale, SIGN_GUI.translate[1], SIGN_GUI.lift, ...SIGN_GUI.tile], [-ref.editSign.scale, ref.editSign.translate[2], ref.editSign.lift, ...ref.editSign.tile]);
  for (const [standing, r] of [[true, ref.editSign.standing], [false, ref.editSign.wall]]) {
    const g = signGuiGeometry(standing);
    near(g.origin, r.origin, 'origin');
    rect(g.board, r.board, 'board');
    if (standing) rect(g.stick, r.stick, 'stick'); else assert.equal(g.stick, null);
    near(g.text.y, r.textY, 'textY');
    near(g.text.scale, r.textScale, 'textScale');
    // The text origin is the board's centre, as the renderer's 0.5 * f1 lift puts it.
    near(g.text.y, g.board.y + g.board.h / 2, 'centred text');
  }
  // 1.7.10 draws a wall sign 29.3 GUI px lower than a standing one; the board is 93.75 x 46.875 face on.
  const s = signGuiGeometry(true), w = signGuiGeometry(false);
  assert.ok(Math.abs(s.board.y - 68.359375) < 1e-5 && Math.abs(w.board.y - 97.65625) < 1e-5);
  assert.ok(Math.abs(s.board.w - 93.75) < 1e-5 && Math.abs(s.board.h - 46.875) < 1e-5 && Math.abs(s.stick.h - 54.6875) < 1e-5);
  for (const [W, H] of [[427, 240], [320, 240], [640, 360], [213, 120]]) {
    const L = signEditLayout(W, H, true), c = Math.trunc(W / 2);
    near(L.sign.x, c - 46.87500139698386, 'sign x');
    near(L.sign.y, ref.editSign.standing.board.y, 'sign y');
    assert.deepEqual(L.title, [c, ref.editSign.titleY]);
    assert.deepEqual(L.done, { x: c - 100, y: Math.trunc(H / 4) + 120, w: 200, h: 20 });
  }
});

test('sign editor draws the edited line on the updateScreen counter (counter / 6 % 2 == 0), not a wall clock', () => {
  const s = src('./sign-editor.js');
  assert.ok(!/setInterval/.test(s), 'no 50 ms interval');
  assert.match(s, /tick: \(\) => \{ ticks\+\+; paint\(\); \}/);
  assert.match(s, /Math\.floor\(ticks \/ 6\) % 2 === 0/);
  assert.equal(ref.editSign.blinkDivisor, 6);
});

test('GuiAchievement toast: 3000 ms window, the quartic slide, x = scaledWidth - 160, background (96, 202) 160 x 32, text colours', () => {
  const T = ref.achievementToast;
  assert.deepEqual([TOAST_MS, HINT_DELAY_MS, TOAST_W, TOAST_H], [T.windowMs, T.hintDelayMs, T.width, T.height]);
  const native = (d, hint) => {
    if (!hint && (d < 0 || d > 1)) return null;
    if (hint && d > T.hintClamp) d = T.hintClamp;
    let e = d * 2; if (e > 1) e = 2 - e; e = 1 - e * 4; if (e < 0) e = 0; e = e * e * e * e;
    return 0 - Math.trunc(e * T.slide);
  };
  for (const width of [213, 320, 427, 641]) {
    for (let ms = -100; ms <= 3100; ms += 37) {
      const got = toastState({ start: 1000, hint: false }, 1000 + ms, width), y = native(ms / 3000, false);
      if (y === null) { assert.equal(got, null, `t ${ms}`); continue; }
      assert.deepEqual(got, { x: width - 160, y }, `t ${ms}`);
    }
    // the hint stays fully in after half the window
    assert.deepEqual(toastState({ start: 0, hint: true }, 60000, width), { x: width - 160, y: 0 });
  }
  const ui = src('./achievements-ui.js');
  assert.match(ui, /background-position:\$\{px\(-96\)\} \$\{px\(-202\)\}/);
  assert.match(ui, /text\(STRINGS\.get, 30, 7, 0xffff00\)/);
  assert.match(ui, /text\(a\.name, 30, 18, 0xffffff\)/);
  assert.match(ui, /"mc-text flat"/); // FontRenderer.drawString: no shadow
  assert.match(ui, /left:\$\{state\.x \* u\}px/); // native x, not CSS right:0
  assert.ok(!/\.ach-toast\{position:fixed;right:0/.test(ui));
  assert.deepEqual([T.texture.u, T.texture.v, T.texture.w, T.texture.h, T.get.title[2], T.get.name[2], T.hint.wrap], [96, 202, 160, 32, '0xFFFFFF00', '0xFFFFFFFF', 120]);
});

test('GuiGameOver: the 20-tick delay counts updateScreen ticks; a rebuild keeps the count', () => {
  assert.equal(BUTTON_DELAY_TICKS, ref.gameOver.delayTicks);
  const s = gameOverScreen({ score: 1, respawn() {}, leave() {}, confirmNo() {}, again() {}, show() {} });
  let g = fakeGui();
  s.init(g, 427, 240);
  assert.equal(s.frame, undefined); // no wall-clock path is left
  for (let i = 1; i < 20; i++) s.tick();
  assert.ok(g.calls.button.every((b) => !b.enabled));
  // a resize at tick 19 rebuilds disabled buttons and keeps the counter (initGui does not reset it)
  g = fakeGui(); s.init(g, 640, 360);
  assert.ok(g.calls.button.every((b) => !b.enabled));
  s.tick();
  assert.ok(g.calls.button.every((b) => b.enabled));
  assert.equal(s.delay.count, 20);
  // after the release a rebuild stays enabled (port: native would leave them disabled for good, see modal-dialogs.js)
  g = fakeGui(); s.init(g, 427, 240);
  assert.ok(g.calls.button.every((b) => b.enabled));
});

test('GuiYesNo quit question: setButtonDelay(20) on the first initGui; a later initGui builds enabled buttons', () => {
  const c = quitConfirmScreen({ yes() {}, no() {}, again() {} });
  let g = fakeGui();
  c.init(g, 427, 240);
  for (let i = 1; i < 20; i++) c.tick();
  assert.ok(g.calls.button.every((b) => !b.enabled));
  c.tick();
  assert.ok(g.calls.button.every((b) => b.enabled));
  const d = quitConfirmScreen({ yes() {}, no() {}, again() {} });
  d.init(fakeGui(), 427, 240); d.tick();
  g = fakeGui(); d.init(g, 640, 360);
  assert.ok(g.calls.button.every((b) => b.enabled) && ref.yesNo.initGuiEnables);
});

test('main.js feeds Gui.tick from the client tick loops (death screen and running world)', () => {
  const m = src('./main.js');
  assert.equal([...m.matchAll(/\bgui\.tick\(\);/g)].length, 2);
  const dead = m.slice(m.indexOf('} else if (screen === "dead") {'));
  assert.ok(dead.indexOf('gui.tick();') > 0 && dead.indexOf('gui.tick();') < dead.indexOf('++deathTime'));
  assert.match(src('./menu-ui.js'), /tick\(\) \{ this\.screen\?\.tick\?\.\(\); \}/);
});

test('GuiTextField disabled colour 0x707070 for the read-only Previous Output field (enabled 0xE0E0E0)', () => {
  assert.deepEqual([ref.textField.enabledColor, ref.textField.disabledColor], ['0xE0E0E0', '0x707070']);
  const ui = src('./menu-ui.js');
  assert.match(ui, /const color = enabled \? 0xe0e0e0 : 0x707070;/);
  assert.match(ui, /field\.readOnly = !enabled;/);
  assert.match(src('./command-block-screen.js'), /label: t\("advMode\.previousOutput"\), enabled: false/);
  assert.equal(ref.textField.commandBlockOutputEnabled, false);
});

test('GuiErrorScreen / GuiScreenWorking layouts and the GuiSelectWorld "Unable to load worlds" route', () => {
  const E = ref.errorScreen, L = errorLayout(427, 240);
  assert.deepEqual([L.titleY, L.messageY, L.button.x, L.button.y], [E.titleY, E.messageY, 213 - 100, E.cancel[1]]);
  assert.deepEqual([workingLayout(427).titleY, workingLayout(427).lineY], [ref.workingScreen.titleY, ref.workingScreen.lineY]);
  assert.match(src('./menu-screens.css'), /data-background=error\]\{background:linear-gradient\(#402020,#501010\)/);
  let shown = null;
  const ctx = { worldsError: () => 'Saved world A is unavailable', worlds: [], options: {}, bindings: { code: () => 0 } };
  const menus = createMenus({ show: (s) => { shown = s; } }, ctx);
  const s = menus.selectWorld();
  assert.equal(s.id, 'error');
  const g = fakeGui(); s.init(g, 427, 240);
  assert.deepEqual(g.calls.text.slice(0, 2).map((t) => [t.s, t.y]), [[E.selectWorldTitle, 90], ['Saved world A is unavailable', 110]]);
  g.calls.button[0].action(); // Cancel: displayGuiScreen(null) -> the main menu
  assert.equal(shown.id, 'title');
  assert.equal(createMenus({ show() {} }, { ...ctx, worldsError: () => null }).selectWorld().id, 'select-world');
  assert.equal(errorScreen({ title: 'x', message: 'y', cancel() {} }).escape(), undefined);
  // the shelf is never rewritten while it could not be read
  assert.match(src('./main.js'), /if \(!worldWriterAvailable \|\| worldsError\) return false;/);
});
