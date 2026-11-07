// The former `modal()` DOM dialogs of main.js, rebuilt as menu-ui.js Gui screens: FontRenderer glyphs, GuiButton widgets, the click sound
// and native GuiScreen positions. Evidence labels: bytecode-read = javap of the unchanged 1.7.10 jar (nothing executed); assumed = not
// from the jar. Positions are recorded in public/research/modal-dialogs.json and pinned by modal-dialogs.test.js.
//
// GuiGameOver (bdc), bytecode-read:
//   initGui: Respawn (id 0, deathScreen.respawn) at (w/2 - 100, h/4 + 72) and Title screen (id 1) at (w/2 - 100, h/4 + 96), 200 x 20; a
//     hardcore world has the single Delete world button (id 1) at (w/2 - 100, h/4 + 96); every button starts disabled and updateScreen
//     enables them when its counter reaches 20 ticks. (deathScreen.leaveServer replaces the hardcore button on a remote server only.)
//   drawScreen: drawGradientRect 0x60500000 -> 0xA0303030; glScalef(2, 2, 2) then the title (deathScreen.title or .title.hardcore)
//     centred at (w/2/2, 30) in white, so it is drawn at twice the size centred on w/2 at y 60; hardcore info (deathScreen.hardcoreInfo)
//     centred at (w/2, 144); "Score: " + EnumChatFormatting.YELLOW + score centred at (w/2, 100), all white with a shadow.
//   keyTyped is empty (Escape and Enter do nothing); doesGuiPauseGame is false. actionPerformed: id 0 respawns and closes; id 1 opens
//     GuiYesNo(this, deathScreen.quit.confirm, "", deathScreen.titleScreen, deathScreen.respawn, 0) and calls setButtonDelay(20) on it,
//     in a hardcore world as well as in a normal one. confirmClicked: yes leaves to the title screen, no respawns (the hardcore server
//     deletes the world, see hardcore.md).
// GuiYesNo (bcw), bytecode-read: line1 centred at (w/2, 70), line2 at (w/2, 90); two 150 x 20 buttons (id 0 yes, id 1 no) at
//   (w/2 - 155, h/6 + 96) and (w/2 + 5, h/6 + 96); setButtonDelay(n) disables them for n ticks. It has no keyTyped of its own, so
//   GuiScreen.keyTyped applies: Escape displayGuiScreen(null). Minecraft.displayGuiScreen(null) with a dead player (health <= 0)
//   opens a new GuiGameOver, so Escape on the quit confirmation brings the death screen back with its 20 tick delay.
// GuiEditSign (bfx), bytecode-read: Done (gui.done) 200 x 20 at (w/2 - 100, h/4 + 120); title sign.edit centred at (w/2, 40) white;
//   drawDefaultBackground. The board is the ModelSign rendered with a 93.75 scale; where the port's canvas sits inside it is assumed.
// Export World and the notes page have no 1.7.10 counterpart: they are port-only, laid out like GuiIngameMenu / GuiOptions (assumed).
import { LANG, t, splitLines, textWidth } from "./menu-screens.js";
import { yesNoLayout } from "./menu-screens.js";

const half = (n) => Math.trunc(n / 2);
const btn = (x, y, w = 200, h = 20) => ({ x, y, w, h });
const tr = (key, fallback) => (LANG[key] !== undefined ? t(key) : fallback);
export const BUTTON_DELAY_TICKS = 20;
const TICK_MS = 50;

/** GuiGameOver geometry. `hardcore` swaps the buttons and adds the info line. */
export function gameOverLayout(w, h, hardcore = false) {
  const c = half(w), q = Math.trunc(h / 4);
  return {
    background: { from: 0x60500000, to: 0xa0303030 },
    // glScalef(2, 2, 2): the string is placed in the scaled space at (w/2/2, 30).
    title: { scale: 2, x: half(c), y: 30 },
    infoY: 144, scoreY: 100, center: c,
    buttons: hardcore ? { deleteWorld: btn(c - 100, q + 96) } : { respawn: btn(c - 100, q + 72), titleScreen: btn(c - 100, q + 96) },
  };
}
/** The GuiYesNo of the quit question is the stock one (yesNoLayout); this names it for the test. */
export const quitConfirmLayout = yesNoLayout;
/** GuiEditSign: title y 40, Done at h/4 + 120. The canvas top is the port's own placement (assumed). */
export function signEditLayout(w, h) {
  const c = half(w), q = Math.trunc(h / 4);
  return { title: [c, 40], done: btn(c - 100, q + 120), canvasTop: 52, canvasBottom: q + 120 - 8 };
}
/** Export World (port-only, assumed): rows like GuiIngameMenu (title y 40, buttons 24 apart from h/4 + 24), Cancel last. */
export function exportLayout(w, h) {
  const c = half(w), q = Math.trunc(h / 4);
  return { title: [c, 40], textX: c, textY: 62, textWidth: 300, buttons: { browser: btn(c - 100, q + 72), java: btn(c - 100, q + 96), cancel: btn(c - 100, q + 120) } };
}
/** Notes page (port-only, assumed): title at y 15 like GuiOptions, a scroll area from y 32 to h - 32 and Done at h - 27 like GuiVideoSettings. */
export function notesLayout(w, h) {
  const c = half(w);
  return { title: [c, 15], area: { x: c - 150, y: 32, w: 300, h: Math.max(20, h - 64) }, lineHeight: 10, done: btn(c - 100, h - 27) };
}

// Buttons that start disabled and come alive after `ticks` GUI ticks (GuiGameOver.updateScreen / GuiYesNo.setButtonDelay). Time based:
// Gui.frame runs per animation frame, one tick is 50 ms.
function delayed(ticks = BUTTON_DELAY_TICKS) {
  const buttons = [];
  let start = null, released = false;
  return {
    add(b) { buttons.push(b); b.enable(released); return b; },
    reset() { start = null; released = false; for (const b of buttons) b.enable(false); },
    frame(now) {
      if (released) return;
      if (start === null) start = now;
      if (Math.floor((now - start) / TICK_MS) >= ticks) { released = true; for (const b of buttons) b.enable(true); }
    },
    release() { released = true; for (const b of buttons) b.enable(true); },
    get released() { return released; },
  };
}

/**
 * GuiGameOver. `respawn()` is id 0 (Respawn), `leave()` the quit confirmation's Title screen answer, `confirmNo()` its Respawn answer
 * (the hardcore flow deletes the world), `again()` re-shows this screen (Escape on the confirmation: displayGuiScreen(null) with a dead
 * player makes a new GuiGameOver), `isDead()` tells whether the player is still dead after a respawn attempt.
 */
export function gameOverScreen({ hardcore = false, score = 0, respawn, leave, confirmNo, again, isDead = () => true, show }) {
  const gate = delayed();
  return {
    id: "game-over",
    background: () => "game-over",
    escape() {}, // keyTyped is empty
    frame: (now) => gate.frame(now),
    init(g, w, h) {
      const L = gameOverLayout(w, h, hardcore);
      gate.reset();
      // glScalef(2, 2, 2): a layer scaled from the top left.
      const big = g.image("mc-scale2", 0, 0, w, h);
      big.style.transform = "scale(2)";
      big.style.transformOrigin = "0 0";
      g.text(tr(hardcore ? "deathScreen.title.hardcore" : "deathScreen.title", hardcore ? "Game over!" : "You died!"), L.title.x, L.title.y, { center: true, parent: big });
      if (hardcore) g.text(t("deathScreen.hardcoreInfo"), L.center, L.infoY, { center: true });
      g.text(`${t("deathScreen.score")}: §e${score}`, L.center, L.scoreY, { center: true });
      const ask = () => show(quitConfirmScreen({ yes: leave, no: confirmNo, again }));
      if (hardcore) {
        gate.add(g.button(L.buttons.deleteWorld, t("deathScreen.deleteWorld"), ask));
      } else {
        gate.add(g.button(L.buttons.respawn, t("deathScreen.respawn"), async () => {
          gate.reset();
          try { await respawn(); } finally { if (isDead()) gate.release(); }
        }));
        gate.add(g.button(L.buttons.titleScreen, t("deathScreen.titleScreen"), ask));
      }
    },
    delay: gate,
  };
}

/** The quit question of GuiGameOver: GuiYesNo(..., "", Title screen, Respawn) with a 20 tick button delay. */
export function quitConfirmScreen({ yes, no, again }) {
  const gate = delayed();
  return {
    id: "game-over-confirm",
    background: () => "default", // drawDefaultBackground
    escape: () => again(), // GuiScreen.keyTyped -> displayGuiScreen(null) -> new GuiGameOver
    frame: (now) => gate.frame(now),
    init(g, w, h) {
      const L = yesNoLayout(w, h);
      gate.reset();
      g.text(t("deathScreen.quit.confirm"), ...L.line1, { center: true });
      g.text("", ...L.line2, { center: true });
      gate.add(g.button(L.buttons.yes, t("deathScreen.titleScreen"), () => yes()));
      gate.add(g.button(L.buttons.no, t("deathScreen.respawn"), () => no()));
    },
    delay: gate,
  };
}

/**
 * Export World (port-only, no 1.7.10 counterpart). `browser()` downloads the JSON backup, `java(progress)` resolves with a message
 * after exporting the zip, `back()` leaves, `busy(on)` reports the export state, `notice(text)` shows a message.
 */
export function exportScreen({ browser, java, back, busy = () => {}, notice = () => {} }) {
  let working = false;
  return {
    id: "export-world",
    escape() { if (!working) back(); },
    init(g, w, h) {
      const L = exportLayout(w, h);
      g.text("Export World", ...L.title, { center: true });
      splitLines("Keep a browser backup, or download a Java 1.7.10 save with region files and conversion notes.", L.textWidth).forEach((line, i) => g.text(line, L.textX, L.textY + 10 * i, { center: true, color: 0xa0a0a0 }));
      const all = [];
      const run = async (b) => {
        if (working) return;
        working = true; busy(true);
        for (const x of all) x.enable(false);
        try {
          const message = await java((n, total) => b.set(`Exporting ${n} / ${total} columns…`));
          back(); if (message) notice(message);
        } catch (e) {
          notice("Could not export Java save: " + e.message);
          b.set("Java 1.7.10 save (.zip)");
          for (const x of all) x.enable(true);
        } finally { working = false; busy(false); }
      };
      all.push(g.button(L.buttons.browser, "Browser backup (.json)", () => browser()));
      const j = g.button(L.buttons.java, "Java 1.7.10 save (.zip)", () => run(j));
      all.push(j);
      all.push(g.button(L.buttons.cancel, t("gui.cancel"), () => back()));
    },
  };
}

/** The port's build notes page (port-only). `openLink(url)` opens a research document, `back()` closes. */
export function notesScreen({ notes, openLink, back }) {
  return {
    id: "build-notes",
    escape: back,
    init(g, w, h) {
      const L = notesLayout(w, h), gray = 0xaaaaaa;
      g.text(notes.title, ...L.title, { center: true });
      const clip = g.image("mc-notes-clip", L.area.x, L.area.y, L.area.w, L.area.h);
      const inner = document.createElement("div");
      inner.className = "mc-notes-inner";
      clip.append(inner);
      let y = 0;
      const lines = (s, color) => splitLines(s, L.area.w).forEach((line) => { g.text(line, 0, y, { color, parent: inner }); y += L.lineHeight; });
      lines(notes.subtitle, gray); y += 4;
      for (const f of notes.facts) { lines(`${f.value} ${f.label}`, 0xffff55); }
      y += 4;
      for (const s of notes.sections) { lines(s.tag, gray); lines(s.text, 0xdddddd); y += 4; }
      for (const l of notes.links) {
        g.text(`§9§n${l.label}`, 0, y, { parent: inner });
        const hit = g.image("mc-link", 0, y, textWidth(l.label), 9, inner);
        hit.addEventListener("pointerdown", (e) => { if (e.button === 0) { g.sound(); openLink(l.url); } });
        y += L.lineHeight;
      }
      const max = Math.max(0, y - L.area.h);
      let top = 0;
      const place = () => { inner.style.transform = `translateY(calc(${-top}*var(--u)))`; };
      this.wheel = (dir) => { top = Math.max(0, Math.min(max, top + dir * 3 * L.lineHeight)); place(); };
      g.button(L.done, t("gui.done"), back);
    },
  };
}

/**
 * GuiEditSign host for sign-editor.js: show(title, html, { done }) puts the canvas html in the Gui layer with the native title and Done
 * button; close() goes through `close`. `gui` is the main Gui.
 */
export function signEditHost(gui, { close, markUnsaved }) {
  return {
    markUnsaved,
    close,
    show(title, html, { done } = {}) {
      if (document.pointerLockElement) document.exitPointerLock();
      // Built once: a GUI rebuild (window resize) moves the same canvas instead of replacing it under sign-editor.js.
      const content = document.createElement("div");
      content.innerHTML = html;
      gui.show({
        id: "edit-sign",
        background: () => "default",
        escape() {}, // sign-editor.js owns the keys (Escape is keyCode 1 of the model)
        init(g, w, h) {
          const L = signEditLayout(w, h);
          g.text(title, ...L.title, { center: true });
          const holder = g.image("mc-sign-holder", 0, L.canvasTop, w, Math.max(20, L.canvasBottom - L.canvasTop));
          holder.style.display = "flex";
          holder.style.alignItems = "center";
          holder.style.justifyContent = "center";
          holder.append(...content.childNodes);
          g.button(L.done, t("gui.done"), () => done?.());
        },
      });
    },
  };
}
