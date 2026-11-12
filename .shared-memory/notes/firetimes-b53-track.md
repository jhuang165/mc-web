# firetimes batch 53 track (branch batch53-firetimes, from 5ea7bb4d1)

## Summary
- **Correction of batch 52 (wither and fire-immune mobs).** The "runs down by 4, a rested -1 stays" rule is only `Entity.onEntityUpdate` (sa.C). `EntityLivingBase.onEntityUpdate` (sv.C) then runs `if (isImmuneToFire() || worldObj.isRemote) extinguish()`, so every fire-immune living mob (pigman, magma cube, wither skeleton, wither) ends each update at 0; the move tail afterwards rests it at -1 or raises it to 1 in a fire block (so a fire block never ignites it: counter 0 -> 1). The wither's old `fire = 0` was right. `EntityWorld.burn` now sets 0 for every fire-immune mob (the wither joins `fireproof`; its own wrapper in `wither-boss-mobs.js` is gone). A strike still ignites a mob resting at -1 (b52 bolt rows unchanged).
- **Fire Protection on every mob ignition** (`setMobFire(e, seconds)` in `armor-enchantments.js`, = `Entity.setFire` with `getFireTimeForEntity` over the mob's `equipment`, only raises the counter): Fire Aspect (pre-hit setFire(1) and level * 4 s), a mob's own Fire Aspect weapon, a zombie's hit on a mob (difficulty ticks / 20), a flame arrow (setFire(5)), a small fireball (setFire(5)), lava (setFire(15)), sunlight burn (setFire(8)), and the fire block tail (`blockCollisions` takes `hooks.armor`, `moveHooks` passes the mob's equipment).
- **Unmodelled effects kept on mobs.** Haste 3, mining fatigue 4, jump boost 8, blindness 15, night vision 16, hunger 17, health boost 21 and saturation 23 are kept on import (and the saved-state round trip), count down and are exported, with their ambient flag. `Potion.isReady` is false for them and `performEffect` only acts on players (hunger, saturation), so nothing else happens. Health boost is not addable (its maxHealth modifier is not applied on add; a load keeps the saved Attributes). Jump boost now raises a mob's jump by `(amp + 1) * 0.1F` (`sv.bj`, bytecode-read; the magma cube's own `bj` ignores it); its fall reduction already existed.

## Evidence
- Executed (`b53ft`): `MobVictimProbe` +420 `setfire` records (5 kinds x 4 counters x 7 durations x none / Fire Protection IV / I armour, `sa.e(int)`) and +35 `firetick` records (`sa.C` through `sv.C`, 6 ticks, 5 kinds x 7 counters); the 1727 earlier records are unchanged. `MobEffectsProbe` +28 `b52me` rows (case 6, all eight effects) and 28 `b53ft` tick rows (`sv.aO` six times per kind: map order, durations, health). Files: `public/research/mob-victims-reference.json` (2182 records), `public/research/mob-effects-reference.json`.
- Bytecode-read: `sv.C` offsets 47-65 (`K()` = `ae`, then `F()` extinguish), `sa.C` fire section, `sv.bj` jump boost.

## Verification
- `node --test src/fire-times-b53.test.js` 11 pass. Targeted existing tests (mob-effects-b52, mob-lightning-b52 (its fire-immune burn test now expects 0), mob-victims-b51, block-collisions, armor-enchantments, fire-armor-b49, fireballs-*, wither*, magma-pigman*, enderman-wolf*, weather*, java-mobs, mob-nbt*, status-effects, bow*, zombie*, mob-steps, mob-equipment*, stuck-arrows): 493 pass; mob-*, entit*, region-*, level-dat, village-fight*, damage-fx, blaze*, fire*, skeleton*, witch*: 762 pass. `npm run build` ok. No full `npm test`.
- Reference regenerated with `node tools/verify-mob-victims.mjs` and `node tools/verify-mob-effects.mjs`.

## Follow-ups (proposed gap lines)
- Instant damage (7) is still dropped on import (natively kept, its performEffect hurts); the health boost maxHealth modifier is not applied when added at runtime.
- The effect map's insertion order inside one bucket (2/18, 6/22) is not tracked.
- A mob arrow on an enderman natively skips setFire (not checked in the port's flame arrow path); the burning-arrow condition on mobs is the arrow's own fire, not the `isBurning` of the victim.
- Mob jump boost is bytecode-read only (no executed jump record).
