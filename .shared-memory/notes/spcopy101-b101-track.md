# spcopy101 (batch 101): the world ticks under the death screen, remaining GuiScreen pause flags

## Summary
Does not claim full parity.
- `src/screen-pause.js`: `gamePaused({screen:"dead"})` is now false (native); new `deadTickPlan({multiplayer})` = `{worldTick: !multiplayer, deathTime: true}`.
- `src/main.js` (shared, code-read only, 5 small hunks): import; `running()` is `screen !== "dead" && ...` (the dead state keeps its own branch, not the camera/aim branch); the dead branch calls `movementTick(IDLE_INPUT)` when `deadTickPlan(...).worldTick` instead of `deadBodyTick()` (function removed; movementTick on foot ends in the same `movePlayer(state, IDLE_INPUT)`, a seated body goes through `moveRidingPlayer`); `die()` clears `eating`; the use-hold line in movementTick skips while dead. Result in single player: survival clock (`survival.time++`), world systems, fluids/fire, mobs, items, orbs, spawners, portals tick while dead, as natively. Over a connection nothing new (the server ticks).
- `src/spcopy101-b101.test.js` (3 tests). Old tests changed: `spcopy100-b100.test.js` (dead paused = true was the known gap, now false); `horse97-b97.test.js` code-read contract line (`deadBodyTick();` string became the new call; seated body still not thrown).

## Item 1 evidence
- Bytecode-read (b100, re-read now): `bdc.d()` (GuiGameOver) is `iconst_0`; `bao.runTick` isGamePaused needs `d()` true. Port-read: the dead branch already ran `onDeathUpdate` (deathTime to 20, `explode` burst, effectRenderer); health-gated paths already tolerate a dead player (`survival.damage` refuses at 0, regen/food heal need health > 0, orbs/arrows collect need health > 0, spawner `feet` null at 0, portal tick `alive`, `pushClientPlayer dead`, `die()` returns when already dead).
- Not executed (main.js is not importable, no browser): that the whole movementTick is safe with health 0 (mob targeting of a dead player copy, seated dead rider with a moving vehicle) is code-read only.

## Item 2 (Teleporter terrain beside the picked portal on the worker): not done
Same verdict as b99/b100: generated Overworld terrain is not stored, so neither a saved-data peek nor a small worker call gives "is this cell air" beside a player-built portal; moving it needs a worker request/response round trip inside `Teleporter.placeInExistingPortalSteps` (async step machine), not small. Left open.

## Item 3 (remaining screens vs doesGuiPauseGame), Bytecode-read (javap over bd*/be*/bf* classes extending bdw)
- Confirmed the b100 list (bct chat, bdc game over, bdu download terrain, bex containers false). New finds: `bee` (GuiMainMenu) false, irrelevant in game; `bei` (GuiAchievements) and `bej` (GuiStats) return `!loading` where `loading` is true from the constructor and cleared by `onStatsUpdated` (`bei.a()`); their initGui sends C16 REQUEST_STATS (`is`). So natively they do not pause until the S37 answer arrives: in single player the integrated server needs an unpaused tick to process the C16, so the world runs roughly one to a few ticks and then pauses. The port pauses at once (state "paused"); the difference is those few ticks. Not implemented (tiny, exact count unmeasured).
- GuiInventory/containers: false in the table, and the port maps every container screen (incl. book/sign/command block overrides) as b100 did.

## Verification
- `node --test --test-concurrency=2 src/spcopy101-b101.test.js src/spcopy100-b100.test.js`: 9 pass, 0 fail; with `screen-pause.js` reverted the new test fails (import).
- Related (bed, gui-screens, horse97, mpperf86, spcopy87, creeper, player-actions, mpsurvival-b58, player-throw-replay): 98 tests, all pass after the horse97 line update (one failure before it, the old string contract).
- No build (import is plain, `screen-pause.js` has no `node:`), no full npm test, no browser.

## Follow-ups
- Browser-only: the dead tick with mobs near, a seated dead rider, death in a Nether portal frame, respawn after the world ran on, thrown body motion.
- Achievements/stats loading-window ticks; Teleporter terrain read stays on the page thread.
