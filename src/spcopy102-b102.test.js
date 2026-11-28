// b102 spcopy102: dead-player edges of the world tick under the death screen, and the stats/achievements loading window.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Survival } from "./survival.js";
import { gamePaused, StatsLoad } from "./screen-pause.js";

test("a corpse does not drown: air refills, no bubbles", () => {
  const s = new Survival();
  s.air = 100;
  s.health = 0;
  s.tick({ underwater: true });
  assert.equal(s.air, 300);
  assert.ok(!s.drowned);
  const alive = new Survival();
  alive.tick({ underwater: true });
  assert.ok(alive.air < 300);
});

test("pressure plates still see a corpse until it leaves the list (listed), and never one that left", () => {
  const src = readFileSync(new URL("./redstone-runtime.js", import.meta.url), "utf8");
  assert.match(src, /p\.alive !== false \|\| p\.listed/);
  const main = readFileSync(new URL("./main.js", import.meta.url), "utf8");
  assert.match(main, /listed: !!mobs\?\.ai\?\.player\?\.inWorld/);
});

test("stats and achievements run the world for one tick of loading, then pause; other game-menu screens pause at once", () => {
  const load = new StatsLoad(50), base = { screen: "paused" };
  assert.equal(gamePaused({ ...base, guiId: "stats", statsLoading: load.loading("stats", 1000) }), false);
  assert.equal(gamePaused({ ...base, guiId: "stats", statsLoading: load.loading("stats", 1049) }), false);
  assert.equal(gamePaused({ ...base, guiId: "stats", statsLoading: load.loading("stats", 1050) }), true);
  assert.equal(gamePaused({ ...base, guiId: "achievements", statsLoading: load.loading("achievements", 2000) }), false);
  assert.equal(gamePaused({ ...base, guiId: "options", statsLoading: load.loading("options", 2010) }), true);
  assert.equal(gamePaused({ ...base, guiId: "stats" }), true);
});
