# Batch 70 spfixes70: chicken seeds, ender chest particles, mob Smite and Bane, Bane slowness

## Summary
- `src/entities.js`: `isBreedingItem(type, id)` and `CHICKEN_BREEDING_ITEMS` (309, 361, 362, 386); `feed` uses it. `BREED_ITEM` (the tempt item, `ai.js`) is unchanged.
- `src/multiplayer/animal-use.js`: the server breed branch uses `isBreedingItem`.
- `src/display-ticks.js`: `randomDisplayTick` calls `enderDisplayParticles` for the ender chest (block 163) and spawns the three portal particles.
- `src/entities.js` `hitMob`: Smite and Bane now read the victim's creature attribute (`creatureAttribute(target.type)`); a landed hit runs the Bane slowness roll over the mob's five equipment slots plus the held item (on its own `Entity.rand`) and applies Slowness IV to an arthropod.
- `src/entities.js` `attack` (player): the rolled `info.slowness` is now applied to the hit spider with `addMobEffect(e, 2, ticks, 3)` (it was only reported).
- `src/armor-enchantments.js`: stale comment fixed. `public/research/enchantment-effects-tools.md`: slowness line updated.
- Test: `src/spfixes-b70.test.js` (6 tests).

## Evidence
- Chicken (bytecode-read): `EntityChicken.isBreedingItem` (`wg.c(add)`) is `stack.getItem() instanceof ItemSeeds` (`adw`). In `Item.registerItems` (`adb`) `new adw` runs four times: seeds (wheat), seeds_pumpkin, seeds_melon, netherStalkSeeds. Carrot and potato are `ItemSeedFood` (`adv extends acx`, an ItemFood), so they do not count.
- Ender chest: `enderDisplayParticles` already matched the executed display-tick records in `chests.test.js`; it was only never called. Wired in `display-ticks.js` (where all other block display ticks run), not in `main.js`; the unused import in `main.js` is left alone.
- Resistance (bytecode-read, `sv.c(ro, float)`): gap found wrong. Order is: absolute source returns; Resistance (`(amp + 1) * 5`, `amount * (25 - k) / 25` in floats, skipped for `outOfWorld`); `amount <= 0` returns 0; enchantments. The lead's "25% per level" is 20% per level (5/25). It is already ported in `Survival.damage`, `EntityWorld.damageEntity` and `client-health.js` (executed earlier: `mob-resist-reference.json`). Only a stale comment said otherwise.
- Mob Smite and Bane (bytecode-read, `yg.n`): `EnchantmentHelper.getEnchantmentModifierLiving(this, target)` (`afv.a(sv, sv)F`) takes the victim's creature attribute, and a landed hit then calls `afv.b(sv, sa)` (the arthropod iterator) on any target. Real, so ported. In practice this only matters for an equipped mob hitting an undead or arthropod mob.
- `EntityLiving.getLastActiveItems` (`sw.ak`) returns the five equipment slots (hand included) and `afv.b` then adds the held item again, so the hand counts twice (one extra random draw); `hitMob` does the same.
- Bane slowness (bytecode-read): `afx` (DamageIterator) calls `Enchantment.func_151368_a(attacker, target, level)`; the player path already rolled it. The roll was only reported, never applied (no consumer of `info.slowness` in `main.js` or the multiplayer files). Now applied in `attack`, and so also on the server, which uses the same `attack`.
- Executed: `node --test` on the replayed references listed below. No new Java probe (the facts are plain bytecode reads).

## Verification
- `node --test src/spfixes-b70.test.js`: 6 pass.
- `node --test` on 22 related files (attributes3, chests, chicken, crops, enchantment-effects, entities, leads2, mob-effects-b55, mpanimals-b61, mpmobs2-b60, mpsurvival-b58, void-fog, sheep, village-fight*, enderman-wolf*, player-throw-replay and others that import these): 549 pass, 0 fail.
- `node --check` on touched files; `npm run build` passes. Full npm test not run (batch rule).
- No new `main.js` name is read (main.js untouched), so no replay binding was needed.

## Follow-ups
- Browser-only: the ender chest portal particles on screen and the slowed spider's speed.
- The `enderDisplayParticles` import in `main.js` is now unused.
