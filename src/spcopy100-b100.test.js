// Batch 100 spcopy100: which screens stop the integrated server (Minecraft.isGamePaused) and the End credits' clock under a public LAN server.
// Bytecode-read: bdw.d (GuiScreen.doesGuiPauseGame) is true; overrides returning false: bct (GuiChat), bdc (GuiGameOver), bdu (GuiDownloadTerrain), bex (GuiContainer);
// bdi (GuiSleepMP) extends bct; beg (GuiWinGame) returns true; bfx (sign), bfe (book), bfh (command block), bdp (game menu) inherit true.
import test from "node:test";
import assert from "node:assert/strict";
import { gamePaused, guiPausesGame, screenKind, TickClock, SCREEN_PAUSES } from "./screen-pause.js";
import { DimensionLive, viewRecord } from "./dimension-live.js";

test("per-screen table matches the bytecode (default true, the five false overrides)", () => {
  for (const k of ["chat", "sleep", "game-over", "download-terrain", "container"]) assert.equal(guiPausesGame(k), false, k);
  for (const k of ["credits", "edit-sign", "book", "command-block", "game-menu", "options"]) assert.equal(guiPausesGame(k), true, k);
  assert.equal(Object.values(SCREEN_PAUSES).filter((v) => !v).length, 5);
});

test("the port's screen state maps to a native screen kind", () => {
  assert.equal(screenKind({ screen: "inventory", guiId: "edit-sign" }), "edit-sign");
  assert.equal(screenKind({ screen: "inventory", guiId: "command-block" }), "command-block");
  assert.equal(screenKind({ screen: "inventory", modal: true }), "book");
  assert.equal(screenKind({ screen: "inventory", modal: true, container: true }), "container");
  assert.equal(screenKind({ screen: "inventory", chat: true, modal: true }), "chat");
  assert.equal(screenKind({ screen: "inventory", sleeping: true }), "sleep");
  assert.equal(screenKind({ screen: "inventory" }), "container");
  assert.equal(screenKind({ screen: "playing" }), null);
});

test("single player: sign, book, command block, game menu and credits stop the world; chat, containers and sleeping do not", () => {
  const paused = (state) => gamePaused({ multiplayer: false, lanPublic: false, ...state });
  assert.equal(paused({ screen: "playing" }), false);
  assert.equal(paused({ screen: "paused" }), true);
  assert.equal(paused({ screen: "credits" }), true);
  assert.equal(paused({ screen: "inventory", guiId: "edit-sign" }), true);
  assert.equal(paused({ screen: "inventory", guiId: "command-block" }), true);
  assert.equal(paused({ screen: "inventory", modal: true }), true);
  assert.equal(paused({ screen: "inventory", chat: true }), false);
  assert.equal(paused({ screen: "inventory", container: true }), false);
  assert.equal(paused({ screen: "inventory", sleeping: true }), false);
  assert.equal(paused({ screen: "home" }), true);
  assert.equal(paused({ screen: "dead" }), false); // b101: GuiGameOver pauses nothing (bytecode-read bdc.d false); b100 held true as a known gap
});

test("a public LAN server or a multiplayer session never pauses behind a screen (credits stay a port-side step)", () => {
  for (const extra of [{ lanPublic: true }, { multiplayer: true }]) {
    assert.equal(gamePaused({ screen: "paused", ...extra }), false);
    assert.equal(gamePaused({ screen: "inventory", guiId: "edit-sign", ...extra }), false);
    assert.equal(gamePaused({ screen: "credits", ...extra }), true);
  }
});

test("TickClock delivers one call per 50 ms of paused time", () => {
  const c = new TickClock(0.05); let n = 0;
  c.run(0.12, () => n++); assert.equal(n, 2);
  c.run(0.04, () => n++); assert.equal(n, 3);
});

const root = { id: "w100", seed: 5, biome: "javaStreamed", chunked: true, generationVersion: 18 };
const exitTrip = async (creditsRuns) => {
  const log = { ticks: [], away: null };
  const p = { x: 0, y: 64, z: 0, yaw: 0, motion: { x: 0, y: 0, z: 0 } };
  const host = {
    worlds: () => [root], active: () => viewRecord(root, 1), ticks: () => 0, player: () => p, save: async () => {}, sound() {},
    showCredits: () => new Promise((r) => setTimeout(r, 200)), openWorld: async () => {}, advanceTicks: (n) => log.ticks.push(n),
    ...(creditsRuns === undefined ? {} : { creditsRuns: () => creditsRuns }),
  };
  const dims = new DimensionLive(host);
  dims.away = { rootId: root.id, tripMs: 0, worker: { terminate() {} }, ticks0: 0 };
  dims.finishAway = async () => { log.away = dims.away.tripMs; dims.away = null; return null; };
  await dims.travel(0, { exit: true });
  return log;
};

test("End credits under a public LAN server count their wall time like a loading screen; a paused server does not", async () => {
  const run = await exitTrip(true);
  assert.ok(run.away >= 190, `away tripMs ${run.away}`);
  assert.ok(run.ticks[0] >= 4, `advanceTicks ${run.ticks}`);
  const paused = await exitTrip(false);
  assert.equal(paused.away, 0);
  assert.ok(paused.ticks[0] <= 1);
  assert.equal((await exitTrip()).away, 0);
});
