# Batch 17 villagers2 track (branch b17-villagers2)

## Summary
- New probe `tools/probes/VillagerPolishProbe.java` + `tools/verify-villager-polish.mjs` -> `public/research/villager-polish-reference.json` (249 records, unchanged 1.7.10 jar) -> `src/villager-polish.test.js` (5 tests).
- Visual-Random particles: statuses 12/13/14 probed (72 cases); `visualRandom(e)`/`setVisualRandom` in `src/village-ai.js` is a per-entity client-side Random; `villagerParticles` and the angry burst in `EntityWorld.villagerHurtBy` use it (angry no longer consumes server Entity.rand; baby size honoured). Draw order and positions match natively.
- +5 default reputation: already set by `cureZombie` and applied in `updateVillagerAI`; now probed (48 cases: flag, village found/not found, empty/clamped reputations, delay draw). No code change needed; `village.md` claim that it had no setter was stale and is fixed.
- "Distance-test path check": was the iron golem's monster target (`NearestMonster`). Replaced with native `canEasilyReach` (PathFinder end within 1.5 blocks, state/timer cached on the task, 10 + nextInt(5) draw, evaluation of every candidate in list order, nearest wins, no circular range cut). 128 cases, 8 terrains.
- Extra item: EntityAIMoveIndoors clear-daytime rule now uses `canSpawnLightningBolt` of the biome and `hasNoSky` (1,920 rows).
- Docs: villager-trading-live.md (Batch 17 section), village.md, iron-golem.md; catalogue rows in `tools/build-content-catalogue.mjs` (regenerate with the catalogue build if the lead merges; not regenerated here to avoid generated-file conflicts).
- Shared-file edits: `src/entities.js` (one import, `villagerHurtBy` angry burst), nothing in main.js/ai.js.

## Tests
`npm test` 3802 pass, 0 fail (before adding docs); `npm run build` ok.

## Remaining gaps
Aggressor list only tracks the local player; MoveThroughVillage does not break doors; golem path search shares the navigator budget (denied search = unreachable); client Random seed is free (not reproducible, by design); villager professions/career changes, zombie villager professions not covered.

## Proposed remaining-gaps Villager line
- Villager: Partial; see the entity catalogue gap text. Region NBT import/export verified (`riding-nbt-reference.json`). Batches 15 and 17: trade items map, golem sounds/retargeting/rose, status 12/13/14 particles (client Random draws), +5 default reputation, MoveIndoors biome/hasNoSky and the golem's nearbyOnly path check are probed and ported (`villager-polish-reference.json`); remaining: only the local player is a village aggressor/reputation holder, MoveThroughVillage door breaking, golem path search budget.
