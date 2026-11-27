// b101 spcopy101: GuiGameOver.doesGuiPauseGame is false (bytecode-read bdc.d: iconst_0), so the world ticks under the death screen in single player.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gamePaused, guiPausesGame, deadTickPlan, SCREEN_PAUSES } from "./screen-pause.js";

test("the death screen never pauses the world (single player, LAN public, multiplayer)", () => {
  for (const extra of [{}, { lanPublic: true }, { multiplayer: true }]) assert.equal(gamePaused({ screen: "dead", ...extra }), false);
  assert.equal(guiPausesGame("game-over"), false);
  assert.equal(SCREEN_PAUSES["game-over"], false);
  assert.equal(gamePaused({ screen: "home" }), true); // the title screen keeps its own loop
});

test("the dead tick runs the world only in single player; the server ticks it over a connection", () => {
  assert.deepEqual(deadTickPlan({ multiplayer: false }), { worldTick: true, deathTime: true });
  assert.deepEqual(deadTickPlan({ multiplayer: true }), { worldTick: false, deathTime: true });
  assert.deepEqual(deadTickPlan(), { worldTick: true, deathTime: true });
});

test("main.js (code-read hook): the dead branch drives movementTick through the plan, the pause rule treats dead as its own branch, a dead player finishes no meal or use-hold", () => {
  const src = readFileSync(new URL("./main.js", import.meta.url), "utf8");
  const dead = src.slice(src.indexOf('} else if (screen === "dead") {'));
  assert.match(dead.slice(0, 1800), /deadTickPlan\(\{ multiplayer: !!multiplayer \}\)\.worldTick\) movementTick\(IDLE_INPUT\)/);
  assert.match(src, /const running = \(\) => screen !== "dead" && !gamePaused\(/);
  assert.match(src, /if \(screen !== "dead" && useHold\.tick\(/);
});
