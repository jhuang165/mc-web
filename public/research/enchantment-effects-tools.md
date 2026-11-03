# Live tool and weapon enchantment effects (1.7.10)

Native evidence: `tools/probes/EnchantmentEffectProbe.java` drives the unchanged 1.7.10 classes (EntityPlayer, Block.harvestBlock, EntityLivingBase, EnchantmentHelper) with Unsafe-allocated worlds and seeded `java.util.Random`s. `tools/verify-enchantment-effects.mjs` writes `public/research/enchantment-effects-reference.json`: 9165 dig rows, 6426 harvest rows and 2288 attack rows (17,879 native records). `src/enchantment-effects.test.js` replays all of them, including the random-stream state left behind.

## Mining
- Efficiency adds level^2 + 1 only when the base strength is above 1; Aqua Affinity (helmet) removes the underwater /5; airborne /5 is unchanged. `playerMiningState` reads both from the held stack and the helmet and defers to `Survival.mining` when neither is present.
- Replay also corrected `src/mining.js` (sword 1.5 on plants, vines and gourds; axe speed on plants/vines; shears only fast on leaves/cobweb/wool-class blocks, not vines).

## Drops (`harvestBlock`, `enchantedBreakDrops`)
- Silk Touch: `canSilkHarvest` then `createStackedBlock`; draws only the 3 spawn floats, no quantity draw, no XP.
- Otherwise draw order is quantity (with Fortune), then per item `nextFloat() <= 1`, item id draws, 3 spawn floats, then ore XP. Fortune is not clamped.
- Covered: stone, grass, dirt, gravel (flint 1/(10-3*min(f,3))), coal/diamond/emerald/lapis/redstone ores, glass, panes, ice (water unless silk), packed ice, snow, clay, melon (cap 9), bookshelf, mycelium, huge mushrooms, cobweb, end portal frame, leaves (sapling/apple chances), tall grass, crops.
- `breakPlayerBlock` uses these only when the held stack is the tool being used, not shearing, not Creative. `dropRandom` (a JavaRandom) can be injected; otherwise `Math.random` is adapted.

## Weapons (`Entities.attack`)
- Order: damage, x1.5 on crit, add Sharpness/Smite/Bane; Fire Aspect `setFire(1)` before the hit; Knockback (enchant + sprint) and the player's 0.6 slowdown; magic-crit particles when the enchantment bonus is positive; fire = level*4 s after a landed hit, extinguished if the hit was refused.
- Bane of Arthropods rolls slowness `20 + nextInt(10*level)` on the player's own random (max over armor and held), only on a landed hit on arthropods.
- Tool wear and 0.3 exhaustion only on a landed hit; dead targets are rejected first.
- Looting is applied in `mobDrops` on the mob's own random: `nextInt(looting+1)` only when looting > 0 (animals always draw), skeleton arrows/bones `nextInt(3+looting)`, equipment `nextFloat - looting*0.01 < chance`, rare drop `nextInt(200) - looting < 5`.

## Limits
- Bane slowness is rolled and reported (`info.slowness`) but not applied to the mob; the mob effect system has no slowness.
- Blocks outside the rule table keep their non-enchanted drops; glowstone and nether quartz ore are not live.
- Live drops use a `Math.random` adapter unless `dropRandom` is supplied, so they are not seed-reproducible in play.
- Full 1.7.10 parity is not claimed.
