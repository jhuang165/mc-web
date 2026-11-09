# villagefight4 (batch 32): village fights beyond the flat arena

## Summary

Records replayed exactly: before this track 26 of 26 (7 base + 19 b31, all on a flat open arena). Now 48 of 48 (7 + 19 + 22 new b32 records), after the
probe change below also re-recorded for the b31 records' new zombie yaw field.

New native evidence (`tools/probes/VillageFightProbe.java`, run on the unchanged 1.7.10 classes by `tools/verify-village-fight.mjs`, written to
`public/research/village-fight-b32-reference.json`; inputs stay outside Git):
- 1-block and 2-block terrain steps and a three-fill terrace (Normal and Hard, with and without a hunt).
- A water pool (real water physics, `water` flag): zombies, villagers and the golem crossing and swimming.
- A walled house with closed doors (Hard zombies break them) and open doors the villagers use.
- Arrows from bow skeletons into stone, a fence, glass and a slab.
- Hard reinforcements in a dark world (`light` 0, `reinforce` 1.0): every reinforcement zombie is compared (position, health, target, per-tick Random draws).

Divergences found and fixed in the port (each matched to native by trace, not by guessing):
- `Random.nextGaussian` needs fdlibm `StrictMath.log` (`strictLog` in `src/java-random.js`); skeleton damage grouping in `src/bow.js` follows the native float order.
- `canSee` uses the block ray trace; the golem's attack task has the long-memory flag (no sight test); `AttackOnCollide` honours it.
- Path search: native `PathFinder` starts from the stored `boundingBox.minX` floor (`floorEdge`), and has no node cap. The port's 1500 node cap is lifted for replays only (`setPathNodeCap`).
- Water: the splash happens inside the move (`updateFallState` calls `handleWaterMovement`), not at tick start (`waterAfterMove`); `enterWater` draws its bubble Random even with no fx.
- A zombie created in a pass (conversion or reinforcement, including one an arrow hurts into a reinforcement) ticks in the same pass (`tickOrder`, and a `lateEntity` marker so arrows can tick at the end of the list in replays).
- Reinforcement site search: `solidTop` no longer refuses y below 0 (real worlds return air there, so nothing changes in the game; the probe arena's floor is at y -1). The probe's collision list is now intersection-filtered behind an `exact` flag, as natively.
- `ew.brightnessLevel` hook: the probe's `getLightBrightness` is 1.0 whatever `getBlockLightValue` (`k()`) answers, so a "dark" probe zombie still gains +2 entityAge in light; the replay says so.

Gap items:
- Hard reinforcements: compared (above). Closed.
- Converted villager zombie's own ticks: compared (Entity.rand of arrows, converted and reinforcement zombies is seedable through a constant-pool patch of `sa.class` to a `SeedRandom` subclass, in the probe only). Closed.
- Arrow start headings: now derived from the seeded Random (`headingDiff` is empty in every record). The record's shot list is only used to check them. The one start value no seed reaches is a new zombie's constructor yaw (`Math.random`, 0..2pi degrees): it is kept in the record (field 8 of `zombies`).
- Terrain steps, water, closed doors, block-type arrow hits: probed (above).

Other: `src/silverfish.test.js` "live silverfish: chases the player..." was flaky: entity Random is seeded from `Math.random`, and about 2 in 40000 starts wander over 300 ticks (the other starts bite by tick 174). The test now seeds the silverfish with eight fixed seeds, same 300 tick bound.

`vv.isSafeToStandAt` and the door-passing checks were bytecode-read only; everything else above ran natively.

## Verification

- `node --test src/village-fight.test.js src/village-fight-b31.test.js src/village-fight-b32.test.js`: 15 tests, 15 pass.
- `npm test`: 4877 tests, 4877 pass, 0 fail.
- `npm run build`: built (only the usual chunk size warnings).
- `git diff --check`: clean.
- Browser: no headless Chrome check was run for this track (the changes are replay and AI/path details covered by native records; the live game paths touched are `entities.js` tick order, reinforcement site search, pathfinding start cell, `canSee`).
- Probe re-run: `VF_EXPECT_B32=22 node tools/verify-village-fight.mjs` regenerates all three reference files with class hashes.

## Follow-ups (proposed gap lines)

- Village fights are probed on a flat arena plus 1- and 2-block steps, a terrace, a pool, a closed/open-door house and four arrow-shield blocks; no stairs, ladders, trapdoors, gates, lava, ice, slime or multi-chunk terrain.
- Reinforcements were compared in a dark probe world at Hard; the live game's real light levels and the spawn-site chunk-loaded check (`isTicking`) were not compared against native.
- A new zombie's constructor yaw (`Math.random`) is the only start value kept from the record; the port's live reinforcement zombie rolls its own yaw.
- The path node cap (1500) is lifted only in replays; native has none, so a live search in a huge enclosed space can still fail where native would succeed.
- The probe's `exact` collision filter and light-brightness override apply to the village-fight probes only; older probes' records were not re-recorded with them.
