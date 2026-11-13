# Batch 58 trackerphase: entries keep their phase while nobody is in the world

## Summary
- `src/entity-tracker.js`: `MobTracker.idleUpdate(mobs, size, joint)` is the world's tracker tick with no player: entries are made and walked in set order, nothing is sent, dead entities leave without a destroy. At the arrival, `jointUpdate` with a joining player now sends every entry already in the set in the set's order (new `held` line). `TrackerEntry.tryStart` now sets the last sent head angle when it builds a mob spawn packet (native `my.c()` writes field `i`). `idOf` helper (mob and object variants, `src/object-tracker.js`).
- `tools/probes/TrackerJointProbe.java`: tag `b58tp`, cases `dimAge5/13/30/45/59` (the b57 world-B script, arrival at those ticks) and `dimAgeLong` (arrival at 1195 after 1194 ticks, across the 401st relative update at tick 1201). `tools/verify-tracker-joint.mjs` method text; `public/research/tracker-joint-reference.json` regenerated (older cases JSON-identical).
- `src/trackerphase-b58.test.js` (new): replays every packet from the arrival on for those cases and for `dimTick`, `dimTickLast`, with B's tracker run silently from tick 1.
- Five older replay files (`tracker-dim-b55`, `-joint2-b53`, `-mobs-b56`, `-flush-b52`, `-spawn-b57`): the initial-entity row switch now happens after the first `tryStart` (the spawn sees the state of tick 0, the first walk the state of tick 1, as in the record). It was before the spawn; harmless until the head fix.

## Evidence
- Executed: all new cases (real mn, my, entity, packet classes). Bytecode-read: `my.a(List)` runs the head test inside the update block, and only `my.c()` (spawn packet) and that block write the last head field.
- Found: the gap is real. An entry made in B before the arrival is mid-phase (counter, last position, motion, head). Replayed equal with `idleUpdate`; the mutation check (no silent tick) fails.
- Found along the way: a spawn packet sets the last sent head. Without it, mid-phase and initial entities send a head packet one fire off.

## Verification
- `MC_RESEARCH=... node tools/verify-tracker-joint.mjs` -> 25 cases.
- `node --test src/trackerphase-b58.test.js` -> 10 pass. Every test file naming entity-tracker, MobTracker, object-tracker or jointUpdate, plus `src/tracker-*.test.js` -> 370 pass, 0 fail. `npm run build` ok. Full npm test not run (batch rule).

## Follow-ups
- Production wiring: `idleUpdate` has no caller. The game builds the second world at the arrival and does not tick it while away, so only entities loaded with a world that had been ticking (spawn chunks, about 25x25 chunks, recalled) would be mid-phase; chunk-loaded entities start at age 0 natively too, so the port's start is right for them. Wiring needs a ticking second EntityWorld (or the away worker) to call `idleUpdate`.
- The test shifts host states by hand (spawn at tick D-1 state); a real caller must spawn the kept entries at the state they hold at the arrival.
