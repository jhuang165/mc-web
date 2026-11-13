# Batch 57 trackerspawn: the second world ticks before the arrival

## Summary
- `tools/probes/TrackerJointProbe.java`: new `b57` mode (tag `b57ts`). World B now exists and ticks from tick 0, after world A's tick and tracker update, with nobody watching, as `MinecraftServer.updateTimeLightAndEntities` does (every WorldServer, then its tracker, then the network tick that moves the player). New cases `dimTick`, `dimTickLast`: B entities made with the world, one chicken made in B at 12 (network), one item that dies at 22, an arrow made in B's tile pass at 23, network spawns in the arrival tick (24) and the next (25).
- `tools/verify-tracker-joint.mjs` method text; `public/research/tracker-joint-reference.json` regenerated. All 17 older cases are byte-identical (checked by JSON compare); only `dimTick` and `dimTickLast` are new.
- `src/tracker-spawn-b57.test.js` (new): replays the new cases and, for the first time, every packet kind (moves, looks, heads, velocity) of the older `mobSpawn`, `earlySpawn` cases.
- No port change (`src/entity-tracker.js` untouched).

## Evidence
- Executed (real mn, my, entity and packet classes): the two new cases. Bytecode-read / stand-in: the world loop and the network phase.
- The listed gap "a network spawn arrives one update early" is wrong for the player's own world. Executed: with all packet kinds compared, `mobSpawn`, `mobSpawnLast`, `earlySpawn`, `earlySpawnLast` replay equal. A network spawn is sent in the tick the record puts it in, and the copy's first move comes on the entry's own third update (spawn tick, then +3). The b56 note's worry (a destroy on the other side of it by one update) did not show in any record.
- With world B ticking, the real difference at a dimension change: entries that existed in B before the arrival are mid-phase (frequency counter and last sent position kept since their making). The port builds the new world at the arrival, so those entries start at counter 0 with the current position as their last sent one. Executed example: `bc1` (made with the world) moves at ticks 25, 28; the port's at 24, 27. Entities made in B at or after the arrival (network spawns, later spawns) replay equal in every packet.

## Verification
- `MC_RESEARCH=/Users/programming-xcode/Desktop/mc-web/tools/research node tools/verify-tracker-joint.mjs` -> 19 cases x 60 ticks.
- `node --test src/tracker-spawn-b57.test.js` -> 10 pass. Every test file naming entity-tracker or MobTracker plus `src/tracker-*.test.js` -> 195 pass, 0 fail.
- Full npm test not run (batch rule).

## Follow-ups
- Entries that lived in a world while the player was away are not modelled; in a real game the new world's entities come from chunk loads at the arrival, so the port's start-at-arrival phase is right for them. Only entities loaded with a world that was ticking before (spawn chunks) would be mid-phase. The away worker (`away-world.js`) runs the old world's entities but not a tracker.
