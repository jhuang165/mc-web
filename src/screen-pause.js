// b100 spcopy100: Minecraft.runTick sets isGamePaused = isSingleplayer() && currentScreen != null && currentScreen.doesGuiPauseGame() && !integratedServer.getPublic(),
// and IntegratedServer.tick skips the world while it is set (bytecode-read, bao.runTick / bsx.u).
// GuiScreen.doesGuiPauseGame (bdw.d) returns true; the only overrides in the 1.7.10 jar (bytecode-read) return false for:
//   GuiChat (bct) and GuiSleepMP (bdi, extends it), GuiGameOver (bdc), GuiDownloadTerrain (bdu), GuiContainer (bex, so every container screen and the creative one);
// GuiWinGame (beg) returns true explicitly and GuiEditSign (bfx), GuiScreenBook (bfe), GuiCommandBlock (bfh), GuiIngameMenu (bdp) and the option screens inherit true.
export const SCREEN_PAUSES = Object.freeze({
  chat: false, sleep: false, "game-over": false, "download-terrain": false, container: false,
  credits: true, "edit-sign": true, book: true, "command-block": true, "game-menu": true,
});
// GuiScreen's default for a screen not listed.
export const guiPausesGame = (kind) => SCREEN_PAUSES[kind] ?? true;

// The port's screen state to the native screen kind. `screen` is main.js's own state ("playing", "paused" = the game menu and its sub-screens,
// "inventory" = every other screen that releases the pointer, "credits", "dead", "home"); `guiId` is gui.screen?.id.
export function screenKind({ screen, guiId = null, chat = false, sleeping = false, container = false, modal = false }) {
  if (screen === "credits") return "credits";
  if (screen === "paused") return "game-menu";
  if (screen !== "inventory") return null;
  if (guiId === "edit-sign" || guiId === "command-block") return guiId;
  if (chat) return "chat";
  if (sleeping) return "sleep";
  if (container) return "container";
  if (modal) return "book"; // the only other containerShell page opened from this state (book-ui.js)
  return "container";
}

// True while the integrated server's world is stopped by the open screen (Minecraft.isGamePaused). `home` and `dead` keep the port's own loops
// (the death screen's world wait is a known gap, GuiGameOver pauses nothing natively).
export function gamePaused({ screen, multiplayer = false, lanPublic = false, ...state }) {
  if (screen === "playing") return false;
  if (screen === "home" || screen === "dead") return true;
  if (multiplayer || lanPublic) return screen === "credits"; // the credits are a port-side trip step: the server clock is credited afterwards (dimension-live.js)
  return guiPausesGame(screenKind({ screen, ...state }));
}

// updateScreen runs every client tick whether or not the game is paused (Minecraft.runTick); this drives it while the world loop is stopped.
export class TickClock {
  constructor(step) { this.step = step; this.acc = 0; }
  run(dt, fn) { this.acc += dt; while (this.acc >= this.step) { this.acc -= this.step; fn(); } }
}
