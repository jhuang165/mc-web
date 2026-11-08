# interchange3 (batch 24): spawn bonus, live Attributes, legacy owners

Branch `batch24-interchange3` (worktree `wt24-interchange3`, cut from 5181c22).

## Summary
- **Native probe.** `tools/probes/InterchangeSpawnProbe.java` and `tools/verify-interchange-spawn.mjs` write `public/research/interchange-spawn-reference.json`: 250 records covering spawnBonus 87, modEffect 84, babyBoost 8, weapon 36, legacyOwner 30 and wolfOwner 5.
  - The legacy-owner cases run `nz.a` (PreYggdrasilConverter) on an allocated MinecraftServer stub with a proxy GameProfileRepository.
  - Single player is online mode: IntegratedServer `bsx.e` calls `d(true)`, checked in the bytecode.
- **Spawn bonus.** Every EntityLiving except the cave spider draws the followRange "Random spawn bonus" first.
  - `entities.js` `onSpawnWithEgg`/`addSpawnBonus` stores it as a modifier for every class.
  - The spider, skeleton and horse rolls (`difficulty.js`, `horse.js`, `horse-live.js`) return `followBonus`.
- **Imported Attributes take effect.**
  - `mob-attributes.js liveAttribute` (base override plus stored modifiers plus live extras, with native clamps) now feeds `aiMoveSpeed` and `mob-effects.js attackDamage`, which takes the held-item bonus as live `gear` only.
  - `mob-attribute-list.js` imports max health for every class except wolf, slime, magma cube and horse (no 2048 cap).
  - An imported zombie keeps a saved knockback of 0. Export no longer double-counts a knockback base override.
  - `java-mobs.js` clamps health to the imported max.
  - `entities.js savedAttributeFields` keeps modifiers and max health for all types.
- **Baby boost.** An adult zombie or pigman keeps a saved boost: import, export and speed.
- **Owners.** `owner-links.js ownerFromNbt` is used for the wolf and the ocelot (`java-mobs.js`). `OwnerUUID` wins even when empty, and there is no trim. The legacy name maps to `offlineUuid(name)` as written, which matches native single player.

## Verification
- `npm test`: 4365 pass, 0 fail.
- `npm run build`: OK.
- `node tools/verify-interchange-spawn.mjs` regenerated the reference: 250 records.
- No browser check was run.

## Follow-ups
- Max-health modifiers on the wolf, slime and horse are not applied. These types derive their own maximum health; natively a wild wolf keeps the saved base.
- Pigman ground speed is a fixed 0.1, so the baby boost and speed modifiers have no effect on it. Horse speed uses `h.speed`.
- Some health clamps still read `ENTITY_TYPES.health` directly instead of the imported max health.
- No usercache, and no dedicated-server conversion of legacy owners (lower-cased name, or "" when online). An `Owner` of " " throws natively; the port converts it.
- A zombie with no Attributes list at all still gets a fresh knockback roll on load; natively it would be 0.
- Bonus chest timing was already at creation, so nothing changed. Torch onBlockAdded was not probed.
