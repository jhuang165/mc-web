# Batch 20, interchange track

## Summary
- Mount UUID keys: `src/entity-uuid.js`. Every exported entity and the player write UUIDMost/UUIDLeast (long tags). Mobs (`create()`), boats and carts persist a `uuid` in browser saves; import keeps it (`uuidFields`); short-lived entities get a name-derived UUID at export.
- Other mounts on level.dat import: any cart variant (`rider: true`) and any importable mob except chicken, dragon, wither, crystal and babies (`playerRides`); the rest is dropped with a note in `report.level.player.lost`.
- Leader zombie/pigman bonus: saved as AttributeModifiers (`src/mob-attributes.js`, `difficulty.js` `zombieSpawnRolls` `modifiers`), exported in the native six-entry `Attributes` list and applied to max health on import.
- Spider jockey skeleton gear: new probe technique (LCG inversion with a counting Random) replayed in tests.
- Bonus chest: torches now take the `BlockTorch.onBlockAdded` orientation (main.js `placeBonusChest`). Gated by the existing `bonusChest`/`bonusChestPlaced` flags, so existing saves are untouched. The chest is still placed on first open, not on the creation screen.

## Native evidence
Probed (executed natively, jar sha1 e80d9b3b...): `tools/probes/InterchangeProbe.java` (171 jockey records, 72 leader records), `InterchangeMountProbe.java` (cow, spider, zombie, chicken, furnace/TNT/hopper cart all remount, none saved in a chunk). `tools/verify-interchange.mjs` -> `public/research/interchange-reference.json`.
Bytecode-read only: `BlockTorch.onBlockAdded` neighbour order, Entity UUID semantics beyond the probed keys.

## Tests
`src/interchange.test.js` (13 tests). Existing tests that compared two independent world builds now ignore the random `uuid` (entities, sheep, population-runtime).

## Remaining gaps
- Attributes are written only for horse, zombie and pigman; native writes them for every mob. The baby speed boost modifier is the baby flag, not a stored modifier.
- Short-lived entities have derived, not persisted, UUIDs. Wolf/ocelot OwnerUUID and the leash holder UUID stay placeholders.
- Chicken, dragon, wither, crystal as the player's mount are dropped with a note; non-horse/pig mounts have no steering.
- Bonus chest still placed on first open.

## Proposed remaining-gaps lines
- Save interchange: UUIDs persist for mobs, boats and carts; owner and leash UUIDs, and non-horse/zombie Attributes lists, are not written.
- Bonus chest is placed on first world open rather than inside world creation.
