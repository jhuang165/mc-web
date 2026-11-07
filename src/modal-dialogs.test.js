import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LANG, yesNoLayout } from './menu-screens.js';
import { gameOverView } from './hardcore.js';
import { gameOverLayout, quitConfirmLayout, signEditLayout, exportLayout, notesLayout, gameOverScreen, quitConfirmScreen, exportScreen, notesScreen, signEditHost, BUTTON_DELAY_TICKS } from './modal-dialogs.js';
import { NOTES } from './notes-content.js';

const ref = JSON.parse(readFileSync(new URL('../public/research/modal-dialogs.json', import.meta.url), 'utf8'));
const SIZES = [[427, 240], [320, 240], [640, 360], [213, 120]];
// Evaluate a reference expression such as "w/2-100" or "h/4+72" with Java int division.
const val = (v, w, h) => {
  if (typeof v !== 'string') return v;
  const e = v.replace(/w\/2\/2/g, 'tr(tr(w/2)/2)').replace(/w\/2/g, 'tr(w/2)').replace(/h\/4/g, 'tr(h/4)').replace(/h\/6/g, 'tr(h/6)');
  return Function('w', 'h', 'tr', `return ${e}`)(w, h, Math.trunc);
};
const at = (b, w, h, pair) => assert.deepEqual([b.x, b.y], [val(pair[0], w, h), val(pair[1], w, h)]);

// A recording stand-in for the menu-ui.js Gui: enough surface for init().
function fakeGui() {
  const calls = { text: [], button: [], image: [] };
  const el = () => ({ style: {}, children: [], append(...c) { this.children.push(...c); }, addEventListener() {} });
  const g = {
    calls, sound() {},
    text: (s, x, y, o = {}) => { calls.text.push({ s, x, y, ...o }); return {}; },
    image: (cls, x, y, w, h) => { const e = el(); calls.image.push({ cls, x, y, w, h }); return e; },
    button: (r, label, action, o = {}) => {
      const b = { r, label, action, enabled: o.enabled !== false, enable(on) { b.enabled = !!on; }, set(s) { b.label = s; } };
      calls.button.push(b); return b;
    },
    layer: el(),
  };
  return g;
}
globalThis.document ??= { createElement: () => ({ style: {}, children: [], append(...c) { this.children.push(...c); }, addEventListener() {}, set innerHTML(v) {}, childNodes: [] }) };

test('lang strings match the jar en_US.lang values recorded in the reference', () => {
  for (const [k, v] of Object.entries(ref.lang)) if (k in LANG) assert.equal(LANG[k], v, k);
  for (const k of ['deathScreen.title', 'deathScreen.title.hardcore', 'deathScreen.hardcoreInfo', 'deathScreen.score', 'deathScreen.respawn', 'deathScreen.titleScreen', 'deathScreen.deleteWorld', 'deathScreen.quit.confirm']) assert.equal(LANG[k], ref.lang[k], k);
});

test('GuiGameOver layout equals the bytecode reference at several GUI sizes', () => {
  const g = ref.gameOver;
  for (const [w, h] of SIZES) {
    const n = gameOverLayout(w, h, false), hc = gameOverLayout(w, h, true);
    at(n.buttons.respawn, w, h, g.buttons.respawn); at(n.buttons.titleScreen, w, h, g.buttons.titleScreen); at(hc.buttons.deleteWorld, w, h, g.buttons.deleteWorld);
    for (const b of [n.buttons.respawn, n.buttons.titleScreen, hc.buttons.deleteWorld]) assert.deepEqual([b.w, b.h], g.buttonSize);
    assert.deepEqual([n.title.x, n.title.y, n.title.scale], [val(g.titleCentreX, w, h), g.titleY, g.titleScale]);
    assert.deepEqual([n.scoreY, n.infoY], [g.scoreY, g.hardcoreInfoY]);
  }
  assert.deepEqual(gameOverLayout(427, 240).buttons.respawn, { x: 113, y: 132, w: 200, h: 20 });
  assert.equal(gameOverLayout(427, 240).title.x, 106);
  assert.deepEqual(gameOverLayout(427, 240, true).buttons, { deleteWorld: { x: 113, y: 156, w: 200, h: 20 } });
});

test('hardcore.js gameOverView agrees with the layout (button y offsets, info line)', () => {
  const v = gameOverView(true), n = gameOverView(false), L = gameOverLayout(427, 240, false), H = gameOverLayout(427, 240, true);
  assert.equal(H.buttons.deleteWorld.y - 60, v.buttons[0].y);
  assert.equal(L.buttons.respawn.y - 60, n.buttons[0].y);
  assert.equal(L.buttons.titleScreen.y - 60, n.buttons[1].y);
  assert.equal(L.infoY, v.infoY);
});

test('quit confirmation is GuiYesNo (150 wide buttons at h/6 + 96, lines at 70 / 90) and GuiEditSign positions match', () => {
  for (const [w, h] of SIZES) {
    const L = quitConfirmLayout(w, h);
    assert.deepEqual(L, yesNoLayout(w, h));
    at(L.buttons.yes, w, h, ref.yesNo.buttons.yes); at(L.buttons.no, w, h, ref.yesNo.buttons.no);
    assert.deepEqual([L.line1[1], L.line2[1], L.buttons.yes.w, L.buttons.yes.h], [ref.yesNo.line1[1], ref.yesNo.line2[1], 150, 20]);
    const S = signEditLayout(w, h);
    assert.deepEqual(S.title, [val('w/2', w, h), ref.editSign.title[1]]);
    at(S.done, w, h, ref.editSign.done);
    assert.deepEqual([S.done.w, S.done.h], ref.editSign.doneSize);
    // port-only layouts follow the recorded (assumed) positions
    const E = exportLayout(w, h), N = notesLayout(w, h), pe = ref.portOnly.exportWorld;
    at(E.buttons.browser, w, h, pe.buttons.browser); at(E.buttons.java, w, h, pe.buttons.java); at(E.buttons.cancel, w, h, pe.buttons.cancel);
    assert.deepEqual(N.done, { x: val('w/2-100', w, h), y: h - 27, w: 200, h: 20 });
  }
});

test('game over screen: normal world routes Respawn and Title screen; buttons wait 20 ticks; Escape/Enter do nothing', async () => {
  const log = [];
  let shown = null, dead = true;
  const s = gameOverScreen({ score: 42, respawn: async () => { log.push('respawn'); dead = false; }, leave: () => log.push('leave'), confirmNo: () => log.push('no'), again: () => log.push('again'), isDead: () => dead, show: (x) => { shown = x; } });
  const g = fakeGui();
  assert.equal(s.background(), 'game-over');
  s.init(g, 427, 240);
  const texts = g.calls.text.map((t) => t.s);
  assert.ok(texts.includes('You died!') && texts.includes('Score: §e42'));
  assert.deepEqual(g.calls.button.map((b) => b.label), ['Respawn', 'Title screen']);
  assert.ok(g.calls.button.every((b) => !b.enabled));
  s.frame(1000); s.frame(1000 + 50 * (BUTTON_DELAY_TICKS - 1)); assert.ok(g.calls.button.every((b) => !b.enabled));
  s.frame(1000 + 50 * BUTTON_DELAY_TICKS); assert.ok(g.calls.button.every((b) => b.enabled));
  assert.equal(s.escape(), undefined); assert.equal(s.key, undefined);
  // Title screen opens the GuiYesNo, in a normal world too (bdc.actionPerformed id 1)
  g.calls.button[1].action();
  assert.equal(shown.id, 'game-over-confirm');
  await g.calls.button[0].action(); assert.deepEqual(log, ['respawn']);
});

test('hardcore game over has a single Delete world button and the info line; the confirmation routes Yes/No/Escape', () => {
  let shown = null; const log = [];
  const s = gameOverScreen({ hardcore: true, score: 3, leave: () => log.push('leave'), confirmNo: () => log.push('no'), again: () => log.push('again'), show: (x) => { shown = x; } });
  const g = fakeGui(); s.init(g, 427, 240);
  assert.deepEqual(g.calls.button.map((b) => b.label), ['Delete world']);
  assert.ok(g.calls.text.some((t) => t.s === 'Game over!') && g.calls.text.some((t) => t.s === 'You cannot respawn in hardcore mode!' && t.y === 144));
  g.calls.button[0].action();
  const c = shown, g2 = fakeGui(); c.init(g2, 427, 240);
  assert.deepEqual(g2.calls.button.map((b) => b.label), ['Title screen', 'Respawn']);
  assert.equal(g2.calls.text[0].s, 'Are you sure you want to quit?');
  assert.ok(g2.calls.button.every((b) => !b.enabled));
  c.frame(0); c.frame(50 * BUTTON_DELAY_TICKS); assert.ok(g2.calls.button.every((b) => b.enabled));
  g2.calls.button[0].action(); g2.calls.button[1].action(); c.escape();
  assert.deepEqual(log, ['leave', 'no', 'again']);
});

test('export dialog routing: browser backup, java export with progress, failure re-enables, Escape is ignored while busy', async () => {
  const log = []; let release;
  const s = exportScreen({ back: () => log.push('back'), browser: () => log.push('browser'), busy: (b) => log.push('busy' + b), notice: (m) => log.push(m),
    java: (p) => new Promise((res, rej) => { p(1, 4); release = { res, rej }; }) });
  const g = fakeGui(); s.init(g, 427, 240);
  assert.deepEqual(g.calls.button.map((b) => b.label), ['Browser backup (.json)', 'Java 1.7.10 save (.zip)', 'Cancel']);
  g.calls.button[0].action(); assert.deepEqual(log, ['browser']); log.length = 0;
  const run = g.calls.button[1].action();
  assert.equal(g.calls.button[1].label, 'Exporting 1 / 4 columns…');
  assert.ok(g.calls.button.every((b) => !b.enabled));
  s.escape(); assert.deepEqual(log, ['busytrue']);
  release.rej(new Error('boom')); await run;
  assert.deepEqual(log.slice(1), ['Could not export Java save: boom', 'busyfalse']);
  assert.equal(g.calls.button[1].label, 'Java 1.7.10 save (.zip)'); assert.ok(g.calls.button.every((b) => b.enabled));
  log.length = 0; const r2 = g.calls.button[1].action(); release.res('done'); await r2;
  assert.deepEqual(log, ['busytrue', 'back', 'done', 'busyfalse']);
  log.length = 0; s.escape(); assert.deepEqual(log, ['back']);
});

test('build notes screen: Done and Escape go back, links open, content is the former DOM text', () => {
  const log = [];
  const s = notesScreen({ notes: NOTES, openLink: (u) => log.push(u), back: () => log.push('back') });
  const g = fakeGui(); s.init(g, 427, 240);
  assert.equal(g.calls.text[0].s, 'Rebuilding 1.7.10, system by system.');
  assert.equal(g.calls.button[0].label, 'Done');
  g.calls.button[0].action(); s.escape();
  assert.deepEqual(log, ['back', 'back']);
  assert.equal(NOTES.links.length, 26); assert.equal(NOTES.sections.length, 3);
  s.wheel(1); s.wheel(-5);
});

test('sign editor host: native title, Done and canvas routed through Gui.show', () => {
  let screen = null; const log = [];
  const host = signEditHost({ show: (x) => { screen = x; } }, { close: () => log.push('close'), markUnsaved: () => log.push('unsaved') });
  host.show('Edit sign message', '<canvas></canvas>', { done: () => log.push('done') });
  const g = fakeGui(); g.image = (...a) => ({ style: {}, append() {} }); screen.init(g, 427, 240);
  assert.deepEqual(g.calls.text[0], { s: 'Edit sign message', x: 213, y: 40, center: true });
  assert.deepEqual(g.calls.button[0].r, { x: 113, y: 180, w: 200, h: 20 });
  g.calls.button[0].action(); assert.deepEqual(log, ['done']);
  assert.equal(screen.escape(), undefined);
});

test('main.js call sites: only the container screens and the book still use modal(); the rest go through modal-dialogs.js', () => {
  const src = readFileSync(new URL('./main.js', import.meta.url), 'utf8');
  const calls = [...src.matchAll(/\bmodal\(/g)].length;
  // definition + openContainer (containers) + openBook (book-modal)
  assert.equal(calls, 3);
  for (const name of ['gameOverScreen(', 'exportScreen(', 'notesScreen(', 'signEditHost(']) assert.ok(src.includes(name), name);
  assert.ok(!/Export World', '<p>/.test(src) && !/id="respawn"/.test(src) && !/death-modal/.test(src));
});
