# Batch 69 projectiles4: rocket fluids and boxes, ghast power, egg id

## Summary
- Firework rockets now take flowing-water push, the first-entry splash random draws, and boat and minecart boxes in their flight, matching native records.
- Ghast ExplosionPower to ball power and the EntityEgg id are executed records; the port already matched.
- Catalogue rows for FireworksRocketEntity, Fireball, Snowball and Arrow were shortened and updated; fireworks.md updated.

## Evidence
- Executed: `FireworkFluidProbe` (34 records, `public/research/firework-fluid-reference.json`, `tools/verify-firework-fluid.mjs`), replayed at 1e-12. ParticleProbe gained `realFluids` and `boxEntities`.
- Executed: `GhastPowerProbe` (7 records, `public/research/ghast-power-reference.json`, `tools/verify-ghast-power.mjs`): six ExplosionPower cases and the EntityList egg id.
- Executed earlier (found, not new): large fireball block case and water flight (batches 40-43); arrow Punch/Flame/Power on a villager (`skeleton-arrow-villager-reference.json`), Punch on the player (PlayerKnockbackProbe); 1200-tick in-ground despawn in the bow flight records.
- Bytecode-read: arrow pickup delay (onCollideWithPlayer, canBePickedUp), needs an EntityPlayer double on the arrow harness.
- Recalled / not executed: the server punch raycast pick for fireballs (deflection itself is executed; b62 test covers the server path).
- Port fixes: `firework-rocket.js` (water push, splash draws, entityBoxes), `particles.js` moveParticleEntity entityBoxes, `fireworks-live.js` and one line in `main.js` (setRocketEntityBoxes).

## Verification
- `node --test src/projectiles4-b69.test.js` (47 pass); with fireworks, projectiles3-b68, catalogue-consistency and content-catalogue tests: 108 pass.
- 14 neighbour test files (particles, fx, entity-list, away-throws, blaze-ghast, fireballs-native, mpprojectiles2-b63, object-tracker-extras, player-throw-replay, ring-events): 237 pass.
- `node --check` on main.js, firework-rocket.js, fireworks-live.js, particles.js; `npm run build` ok.
- Full npm test not run (batch rule). Only a browser could show the rocket rendering in water and the splash visuals/sound.

## Follow-ups
- Arrow pickup delay probe (EntityPlayer double on the arrow harness).
- Server punch raycast pick for fireballs, native record.
- Stale gap lines in blaze-ghast.md and bows.md still mention the large-ball and Punch gaps.
