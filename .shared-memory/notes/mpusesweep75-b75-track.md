# Batch 75 mpusesweep75: dedicated-server right and left click sweep

## Summary
Drove `DedicatedSimulation` (`rules.chunkStream = false`) against the single-player path (`applyPlayerEdit`) on identical fixtures and compared world, entity and inventory state. Tools: `tools/sweep-use75.mjs` (every item id, damages 0-5, 8, 15, on 20 mob kinds, plus air) and `tools/sweep-attack75.mjs` (items x 8 enchantment sets x 20 kinds). Gaps found were closed by calling the single-player module from the server (glue in `server-use-entity.js`, `server-air.js`, `server-vehicle-hit.js`). Buckets on blocks were skipped (mpbuckets75). Full parity is not claimed.

| Click | Gap before | After |
|---|---|---|
| Name tag on any mob | ignored | `nameTagUse` |
| Spawn egg on ageable mob | ignored | baby spawns, egg spent, no villager trade window |
| Flint and steel on creeper | ignored | `creeperIgnite`, sound, tool wear (not in Creative) |
| Wheat, chest, saddle, armour on horse/donkey/mule | ignored | `horseInteract` (direct equip, no GUI) |
| Saddle on pig, left click | missing | `saddleHit` |
| Armour right click in air or on a block | ignored | equips to empty slot |
| Glass bottle on water | ignored | `useGlassBottle` |
| Spawn egg on water | ignored | `useEggOnWater` |
| Firework rocket on a block | ignored | `useFirework` |
| Sprint hit on cart or boat | no knockback | `vehicleSprintPush` |
| Left click per tool and enchantment | clean except the pig saddle | 0 differing rows |

## Evidence
- Executed: both sweeps, `src/mpusesweep-b75.test.js` (10 tests).
- Recalled / read from comments: native interact-first order. Single player handles bow, bucket, potion, bottle, rod and book before the entity branch; those rows differ from the server by an SP ordering quirk, not a server gap.
- Read only, not executed: item frame, painting and knot paths look consistent. A right click on a player has no native effect.

## Verification
Targeted `node --test`: mpusesweep-b75 10/0, mpanimals-b61 11/0, mpvehicles-b61 10/0, mpriding2-b62 15/0, mpvillage-b66 9/0 (pass/fail). `node --check` on all touched files. Full npm test not run (batch rule). Only a browser could show client prediction, sounds and the feel of the new clicks.

## Follow-ups
- Mounting a horse (steering, jump wire, tame by riding) and the horse inventory window.
- Client prediction for the new clicks (the server result arrives as a correction).
- Hanging entities only read, not swept.
- Merge: `simulation.js` `edit` hooks sit beside mpbuckets75's `bucketUse` lines; one-line hooks in `animal-use.js` and `server-mobs.js`.
