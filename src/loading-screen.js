// The 1.7.10 loading screens as Gui screens (menu-ui.js): LoadingScreenRenderer (the integrated-server start), GuiErrorScreen,
// GuiDownloadTerrain and GuiScreenWorking. Layouts and constants were read from the unchanged client's bytecode with javap (not
// executed): bbo LoadingScreenRenderer, bdh GuiErrorScreen, bdt GuiScreenWorking, bdu GuiDownloadTerrain, bao.launchIntegratedServer
// and MinecraftServer.initialWorldChunkLoad. See public/research/loading-screens.md.
import { t, splitLines } from "./menu-screens.js";

// LoadingScreenRenderer.setLoadingProgress: nothing is drawn within 100 ms of the last drawn frame.
export const LOADING_THROTTLE_MS = 100;
// The progress bar: 100 x 2 units centred at x, y = height / 2 + 16; 0x808080 track, 0x80FF80 fill (width = progress).
export const BAR = { width: 100, height: 2, dy: 16, track: 0x808080, fill: 0x80ff80 };
// MinecraftServer.initialWorldChunkLoad: a 25 x 25 chunk square, printed ("Preparing spawn area", i * 100 / 625) at most once a second.
export const NATIVE_SPAWN_CHUNKS = 625;
export const SPAWN_LOG_INTERVAL_MS = 1000;

// LoadingScreenRenderer layout for a w x h GUI: the title (c) at h / 2 - 4 - 16, the message (a) at h / 2 - 4 + 8, both centred, white
// with a shadow. Java integer division.
export function loadingLayout(w, h) {
  const mid = Math.trunc(h / 2);
  return { cx: Math.trunc(w / 2), titleY: mid - 4 - 16, messageY: mid - 4 + 8, bar: { x: Math.trunc(w / 2) - BAR.width / 2, y: mid + BAR.dy, w: BAR.width, h: BAR.height } };
}
// GuiErrorScreen: title at (w / 2, 90), message at (w / 2, 110), a 200 x 20 Cancel button at (w / 2 - 100, 140); the background is a
// vertical gradient 0xFF402020 to 0xFF501010 (drawGradientRect(0, 0, w, h, -12574688, -11530224)).
export function errorLayout(w, h, lines = 1) {
  return { cx: Math.trunc(w / 2), titleY: 90, messageY: 110, button: { x: Math.trunc(w / 2) - 100, y: 140 + Math.max(0, lines - 3) * 10, w: 200, h: 20 } };
}
// GuiDownloadTerrain: dirt background, "multiplayer.downloadingTerrain" centred at (w / 2, h / 2 - 50).
export const downloadLayout = (w, h) => ({ cx: Math.trunc(w / 2), y: Math.trunc(h / 2) - 50 });
// GuiScreenWorking: the title (via displayProgressMessage) at (w / 2, 70) and "<message> <progress>%" at (w / 2, 90).
export const workingLayout = (w) => ({ cx: Math.trunc(w / 2), titleY: 70, lineY: 90 });
export const workingLine = (message, progress) => `${message} ${progress}%`;

// The state LoadingScreenRenderer keeps: displayProgressMessage sets the title, resetProgresAndWorkingMessage the message and clears
// the bar (progress -1), setLoadingProgress sets the bar subject to the throttle.
export class LoadingState {
  constructor() { this.title = ""; this.message = ""; this.progress = -1; this.lastDrawn = 0; this.version = 0; }
  displayProgressMessage(title) { this.title = title; this.version++; }
  resetProgressAndWorkingMessage(message) { this.message = message; this.progress = -1; this.lastDrawn = 0; this.version++; }
  // Returns whether the bar changed (false when the 100 ms throttle swallowed it).
  setLoadingProgress(progress, now) {
    if (now - this.lastDrawn < LOADING_THROTTLE_MS) return false;
    this.lastDrawn = now;
    this.progress = progress;
    this.version++;
    return true;
  }
}

// The server-side "Preparing spawn area: N%" line. Natively it only reaches the server log (MinecraftServer.outputPercentRemaining stores
// the text and percent in fields the client never reads), so it is printed to the console here at the same one-second cadence.
export class SpawnAreaLog {
  constructor(total = NATIVE_SPAWN_CHUNKS, log = (line) => console.info(line)) { this.total = total; this.log = log; this.last = null; }
  percent(done) { return Math.trunc((done * 100) / this.total); }
  report(done, now, force = false) {
    if (!force && this.last !== null && now - this.last <= SPAWN_LOG_INTERVAL_MS) return null;
    this.last = now;
    const line = `Preparing spawn area: ${this.percent(done)}%`;
    this.log(line);
    return line;
  }
}

// launchIntegratedServer: displayProgressMessage(I18n "menu.loadingLevel"), then the server's user message every 200 ms through
// resetProgresAndWorkingMessage(I18n message): "menu.loadingLevel" while the world loads, "menu.generatingTerrain" during the chunk load.
export const STAGES = Object.freeze({ loading: "menu.loadingLevel", terrain: "menu.generatingTerrain" });
export function startLoading(state = new LoadingState()) {
  state.displayProgressMessage(t("menu.loadingLevel"));
  state.resetProgressAndWorkingMessage(t(STAGES.loading));
  return state;
}
export const setStage = (state, key) => state.resetProgressAndWorkingMessage(t(key));

export function loadingScreen(state) {
  let title, message, bar, fill, seen = -1;
  return {
    id: "loading",
    background: () => "dirt",
    escape() {},
    init(g, w, h) {
      const L = loadingLayout(w, h);
      title = g.text(state.title, L.cx, L.titleY, { center: true });
      message = g.text(state.message, L.cx, L.messageY, { center: true });
      bar = g.image("mc-load-track", L.bar.x, L.bar.y, L.bar.w, L.bar.h);
      fill = g.image("mc-load-fill", L.bar.x, L.bar.y, 0, L.bar.h);
      seen = -1;
      this.frame();
    },
    // Repaints from the state when it changed (the renderer draws on every call; the screen is idle otherwise).
    frame() {
      if (seen === state.version) return;
      seen = state.version;
      title.set(state.title);
      message.set(state.message);
      const on = state.progress >= 0;
      bar.hidden = fill.hidden = !on;
      if (on) fill.style.width = `calc(${Math.min(state.progress, BAR.width)}*var(--u))`;
    },
  };
}

// GuiErrorScreen. `cancel()` is mouseClicked's displayGuiScreen(null); Escape does nothing (keyTyped is empty).
export function errorScreen({ title, message, cancel }) {
  return {
    id: "error",
    background: () => "error",
    escape() {},
    init(g, w, h) {
      const lines = splitLines(String(message), Math.max(40, w - 40)), L = errorLayout(w, h, lines.length);
      g.text(title, L.cx, L.titleY, { center: true });
      lines.forEach((line, i) => g.text(line, L.cx, L.messageY + 10 * i, { center: true }));
      g.button(L.button, t("gui.cancel"), cancel);
    },
  };
}

export function downloadTerrainScreen() {
  return {
    id: "download-terrain",
    background: () => "dirt",
    escape() {},
    init(g, w, h) { const L = downloadLayout(w, h); g.text(t("multiplayer.downloadingTerrain"), L.cx, L.y, { center: true }); },
  };
}

// GuiScreenWorking: `state` is a LoadingState; the progress line is its message and bar progress as a percentage.
export function workingScreen(state) {
  let title, line, seen = -1;
  return {
    id: "working",
    background: () => "default",
    escape() {},
    init(g, w) {
      const L = workingLayout(w);
      title = g.text(state.title, L.cx, L.titleY, { center: true });
      line = g.text("", L.cx, L.lineY, { center: true });
      seen = -1;
      this.frame();
    },
    frame() {
      if (seen === state.version) return;
      seen = state.version;
      title.set(state.title);
      line.set(workingLine(state.message, Math.max(0, state.progress)));
    },
  };
}

// Lets the browser paint the screen that was just shown before synchronous work blocks the thread.
export const nextPaint = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
// One animation frame: the pause between slices of work that the screen needs no paint of its own for.
export const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));
