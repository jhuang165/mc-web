# mobai-b29 track (batch 29, branch batch29-mobai)

## Summary
- New `src/revenge-target.js`: shared revenge target (player or mob) for any living DamageSource entity; 100-tick lapse and dead-target clear; wolves use the same map.
- `src/ai.js`: `uj.a()` start-after-evaluation ordering, no age gate on the despawn check (`sw.w`), EntityMob +2 age in light, skeleton Entity.rand, combat task added last, `unarmed` skeleton option.
- `src/entities.js` (small hunks, AI/target only): attackEntityFrom revenge block, `callReinforcement(e, by)`, revenge lapse, golem living-sound draws, `talk` early return, `unticked` player flag for the replay.
- `src/village-fight-replay.js` + rewritten `src/village-fight.test.js` replay the 5 native fight records through the ticked mob layer; `src/revenge-target.test.js` unit tests.
- Probes: `VillageFightProbe` and `VillagerProbe` fixed (player box, entity lists, closest player, ticksExisted); reference regenerated.

## Verification
- Native evidence (probed on the jar): `public/research/village-fight-reference.json` regenerated. First diverging ticks: 114, 241, 322, 232, 322 (positions within 1e-3, draws exact). See village.md "Batch 29".
- npm test 4747 pass, 0 fail; npm run build passes.

## Follow-ups
- Proposed remaining-gaps line: "Village fight replay diverges at tick 114 (villager flee sight ray through a door) and after kills (native death-tick particle draws)."
- Proposed: "Peaceful, several skeletons in a village and villager flee from several zombies are not probed."
- Death-tick Entity.rand draws (g g g f f f) are not made by the port.
- entities.js hunks need merging with leads3 (leash, death-drop) edits.
