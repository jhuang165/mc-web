GEN-04i (Claude): worldgen animals and the populate freeze/snow pass, replayed natively.

- `src/population-tail.js`:
  - `CREATURES` (spawnableCreatureList per slot) and `SPAWN_CHANCE` (0.1);
  - `weightedPick`, `fleeceColor`, `canCreatureSpawnAt`, `performWorldGenSpawning` (the entry and the fleece come from world.rand, the rest from the population Random);
  - `canBlockFreeze`, `canPlaceSnow`, `canSnowAt`, `freezeAndSnow`;
  - `populateTail`: decorate, animals, snow, in native order.
- `src/gen-world.js` adds:
  - the Chunk precipitation-height cache (−999, reset in generateSkylightMap, invalidated in setBlockInChunk before the same-block return);
  - `getPrecipitationHeight`, `getSavedBlockLight` (onCall kind 6, `blockLight` option), the `biomeAt` option, `isNormalCube` (native id set), `isLiquid`, and `spawnEntity`/`onEntity`.
- Probe: `tools/probes/PopulationTailProbe.java` and `tools/verify-population-tail.mjs`.
  - It needs commons-io and `en_US.lang`, because EntityHorse calls StringTranslate. The verifier fails on caught spawn exceptions.
  - The reference has 144 records over 12 regions: 72 spawn, 24 snow (with a second pass after decorate plus cache edits) and 48 tail. They contain 1,250 animals and 10,681 ice/snow writes. All replay exactly.
- Mutation checks kill the light, temperature, packed-ice, liquid, tries, group-size, fleece and precipitation-invalidation rules.
  - Not exercised: freezing flowing water, snow on a full layer, bedrock below a spawn, a normal cube at head height.
  - Leaves pass either snow branch without fancy graphics.
- Gaps: each entity's own unseeded Random (follow-range bonus, horse variant, egg timer) and other entity state.
- npm test 752/752, build OK, bridge 5/5. Regeneration is byte-identical. App 0.23.4, generation 9, no Site publish.

Next: the full populate chain on one GenWorld (population-stage.js, then populateTail), then versioned runtime integration.
