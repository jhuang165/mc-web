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

// True while the integrated server's world is stopped by the open screen (Minecraft.isGamePaused). `home` keeps the port's own loop; `dead` is
// never paused (GuiGameOver.doesGuiPauseGame is false, b101 spcopy101), so the world keeps ticking under the death screen (see deadTickPlan).
export function gamePaused({ screen, multiplayer = false, lanPublic = false, statsLoading = false, ...state }) {
  if (screen === "playing") return false;
  if (screen === "home") return true;
  if (screen === "dead") return false;
  if (multiplayer || lanPublic) return screen === "credits"; // the credits are a port-side trip step: the server clock is credited afterwards (dimension-live.js)
  if (statsLoading && STATS_SCREENS.has(state.guiId)) return false; // b102: GuiStats / GuiAchievements.doesGuiPauseGame is !loading, until the S37 answer arrives
  return guiPausesGame(screenKind({ screen, ...state }));
}

// What one client tick does while the death screen is open (main.js "dead" branch). Native: the world, the time, the mobs, items and fire keep ticking and the dead
// player is still in the entity list (EntityLivingBase.onDeathUpdate: deathTime to 20, then the body goes up in "explode" particles). In single player the port's full
// player/world tick (movementTick: the dead body's idle move, survival clock, world systems, mobs, items) runs; over a connection the server ticks the world itself, so
// no world tick runs here. `deathTime` counts in both.
export function deadTickPlan({ multiplayer = false } = {}) {
  return { worldTick: !multiplayer, deathTime: true };
}

// updateScreen runs every client tick whether or not the game is paused (Minecraft.runTick); this drives it while the world loop is stopped.
export class TickClock {
  constructor(step) { this.step = step; this.acc = 0; }
  run(dt, fn) { this.acc += dt; while (this.acc >= this.step) { this.acc -= this.step; fn(); } }
}

// b102 spcopy102: GuiAchievements (bei) and GuiStats (bej) return `!loading` from doesGuiPauseGame (bytecode-read, b101); `loading` is true from the constructor and cleared by
// onStatsUpdated. initGui sends C16 REQUEST_STATS, which the integrated server answers in its next tick (Not executed: the integrated server is its own thread, so the true window
// is one to two ticks). Modelled as one tick of wall time (50 ms) after the screen first shows, during which the world still runs.
export const STATS_SCREENS = new Set(["stats", "achievements"]);
export class StatsLoad {
  constructor(windowMs = 50) { this.windowMs = windowMs; this.id = null; this.since = 0; }
  // Call with the open gui screen's id and a clock in ms; true while the stats request is unanswered.
  loading(id, now) {
    if (id !== this.id) { this.id = id; this.since = now; }
    return STATS_SCREENS.has(id) && now - this.since < this.windowMs;
  }
}
