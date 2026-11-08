# attributes3 (batch 27): live hit amounts, foreign owners, fixed speed bases

## Summary
- **New probe.** `tools/probes/Attributes3Probe.java` and `tools/verify-attributes3.mjs` write `public/research/attributes3-reference.json` from the unchanged 1.7.10 classes: attack 306, strength 33, foreign 8, knockback 336, speed 203. `src/attributes3.test.js` (11 tests) replays it. Notes in `public/research/attributes3.md`.
- **Hit amounts.** Native: only EntityMob classes read attackDamage; wolf (2/4), ocelot (3), iron golem and slimes use fixed amounts and ignore both a saved attackDamage entry and Strength. `mobHitAmount` in `entities.js` now serves `hitPlayer` and `hitMob`. Skeleton table row had no `damage` (NaN) and now has 2. Operations 0/1/2 order was already right (16.875 case).
- **Speed bases.** Bat 0.7, ghast/squid/dragon 0.1, magma cube 0.2 now equal native (they only affect the exported/attribute value; those classes move by their own code). All ground movers already matched across 203 records.
- **Knockback / follow range.** 336 records match the port's loaded `knockbackResistance`, and `knockBack` motion over seeds 0-7; no code change needed.
- **Foreign owners.** `ownerPresent`/`ownerKey` in `owner-links.js`. A tamed wolf/ocelot with a foreign `ownerUuid` has no owner: it sits unasked, never follows, has no owner-hurt targeting, the player's click does not toggle sitting, and wolves with absent owners never attack each other (probed null==null). `wolf-ai.js`, `ocelot-ai.js`, `wolf.js`, two call sites in `entities.js`.
- **Knot leashes.** Already native (X/Y/Z, no UUID; batch 21 probe). No change.
- **Riders.** Bytecode-read: only EntityPig and EntityHorse read the rider; no other mount steers. No change.

## Verification
- `node tools/verify-attributes3.mjs` (MC_RESEARCH=.../tools/research) regenerates the reference.
- `node --test src/attributes3.test.js`: 11 pass. `npm test`: 4625 tests, 4625 pass, 0 fail. `npm run build`: ok.
- No browser check was done.

## Follow-ups
- Villagers: a moving player fighting back, several zombies or shooters (not started).
- Leash held by another mob (UUID resolved nearby) is still dropped on import.
- Horse foreign owner is bytecode-read only.
- Proposed remaining-gaps line (Riders): "open: leads held by another mob, horse owner checks unprobed; foreign owners, hit amounts, speed bases and steering are probed (attributes3.md)".
- Proposed remaining-gaps line (Villager): drop "movement speed/attack damage bases are round-tripped but not simulated"; keep "a moving player fighting back, several zombies or shooters".
