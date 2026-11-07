# Temples track (batch 15, branch b15-temples)

Goal: working jungle and desert temple traps in the live game, and close the temple gaps.

## What changed
- `src/redstone.js`: BlockTripWireHook (aog, 131) and BlockTripWire (aof, 132) behaviours (placement, `onPostBlockPlaced`, 10-tick rechecks, hook attach/power logic with the exact sound order, entity box, break paths, string drop 287). Header and `DROP_ITEM` updated; `replayScenario` gained the `place2` and `placehook` events.
- `tools/probes/RedstoneProbe.java` (+ the two events), `tools/verify-tripwire.mjs`, `public/research/tripwire-reference.json` (16 native scenarios, 640 ticks), `src/tripwire.test.js` (17 tests).
- Live wiring: `redstone-live.js` watches strings every tick (like plates) and maps string drop 287 to the internal string item; `redstone-runtime.js` calls `onPostBlockPlaced` for hooks; `block-break-simulation.js` disarms a string broken with shears (metadata |8 first).
- `src/temple-traps.test.js` (7 tests, finite v14 seed 267 jungle): tripwire -> wire -> dispenser arrow once, the second line fires the other dispenser, an arrow entity trips a string, shears disarm, drops, lever puzzle (only the third lever opens the sticky pistons), plate -> TNT (hand-built desert column; seed 395's pyramid is outside the finite 128-block world).
- Docs: `scattered-features.md` (Live traps section, stale "not wired" removed), `redstone.md`, `redstone-live.md`, `parity-roadmap.md`, `remaining-gaps.md` Priority 4, `structure-population-world.md`, the structure catalogue Temple rows and their generator `tools/build-surface-catalogue.mjs`.

## Facts worth keeping
- "319 short" was already closed (call counts equal in `structure-population-area.test.js`; the gap was the TNT `onBlockAdded` power query). Only docs and generator strings were stale.
- The brief said "6 tick delay" for dispensers; the native-verified dispenser uses tick rate 4 and was not changed.
- Native `func_150136_a` plays the sounds for BOTH hooks with the first hook's old attached/powered state.
- Breaking a string without shears powers the line (`func_150138_a(meta|1)`); with shears (|8) it unattaches without power.
- Generated (inert) hook meta facing|4 and string meta 4 equal the native settled state (probe scenario `generated-state-trip`), so generation needs no settle step.

## Not probed / open
- Shears disarm itself (needs a player), selection bounds (`setBlockBoundsBasedOnState`, string sensing box uses 0.15625), random ticks.
- Thrown projectiles, boats, fireballs, falling blocks do not trip strings (`entitiesIn` "all").
- Witch hut and structure NBT unchanged.
