# Batch 19 mobdoors3 track (branch worktree-agent-a5db18817df7c0e67)

## Summary
- Pigmen: `EntityPigZombie` runs `EntityZombie`'s CanBreakDoors roll, but `yh.bk()` (isAIEnabled) is false, so no AI task ever runs on it. The port now stores the rolled flag (`create`/`onSpawnWithEgg`, `canBreakDoors` kept across save and load), exports `CanBreakDoors` (was always 0), imports it (region import and `/summon`), and still runs no door task. This is the native behaviour, not a gap.
- Zombie door walk in a ticking world: new `ZombieDoorWalkProbe.java` + `tools/verify-zombie-door-walk.mjs` -> `zombie-door-walk-reference.json` (18 walks of 380 ticks + 2 pigman records) -> `src/zombie-door-walk.test.js`, replayed against a full `EntityWorld.tick`. One divergence found and fixed: zombie tasks used the world-shared random stream, the original uses `Entity.rand` (`ai.js`, 2 lines). After that every decision, draw, task state, break counter and aux event matches natively.
- Thrown potions and exp bottles: new `potion-idle` / `exp-bottle-idle` scenarios in `tripwire-reference.json` (42 scenarios): an idle potion or bottle in the cell never powers an idle line natively. The existing port already matched.
- Probe-support edit: `VillageLiveProbe.W` gained `setBlockToAir` (`f(x,y,z)`) so a native zombie can break a door in that double; the earlier probes never call it.

## Native evidence
- Executed natively (unchanged classes): `yq` ticking through `Entity.onUpdate` (EntityAIAttackOnCollide, EntityAIMoveThroughVillage, EntityAIBreakDoor, PathNavigate, move helper, door collision, Hard removal), pigman tag round trip (`yh.a(dh)` / `yh.b(dh)`) and `bk()` on `yh` and `yq`, idle EntityPotion / EntityExpBottle against a tripwire.
- Bytecode-read only: `yh.a(sy)` calling `yq.a(sy)` then `j(false)`; `sv.e()` choosing `bn()` (updateAITasks) only when `bk()` is true.

## Tests
`npm test` and `npm run build` pass (4000 tests, 0 failures). New: `zombie-door-walk.test.js` (2), `java-mobs.test.js` (+1 pigman round trip), `tripwire-live.test.js` assertion for the idle scenarios.

## Remaining gaps
- Mobs rebuild their box from the centre each move while `Entity` keeps the AABB, so positions differ by an ulp or two once a coordinate crosses a power of two (x 64); the walk replay accepts 1e-9 on position. Not fixed (global physics change).
- The walk replay stops where the zombie touches its target (the probe's villager is never pushed, the port's stand-in is). A zombie walking to a real player or villager and attacking through a door is not replayed.
- A leader pigman's max-health bonus is not stored (zombies only).
- Pigman child/villager flags are still rolled as before (IsBaby/IsVillager export untouched).

## Proposed remaining-gaps lines
- Villager: "MoveThroughVillage, the golem's reach check and a zombie's full door walk (pathing, door collision, EntityAIBreakDoor, Entity.rand draws tick by tick, 18 native walks) are probed; the walk replay ignores an ulp of position drift past x 64 and stops at target contact."
- Mob riding / pigmen: "Pigman CanBreakDoors is rolled, saved, exported and imported; natively no AI task runs on a pigman (isAIEnabled false), so there is no door task to port. A leader pigman's health bonus is not stored."
- Temples: "Idle thrown potions and bottles in a string cell never trip it (probed, 42 scenarios)."
