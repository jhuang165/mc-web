# Food status effects — Java 1.7.10

`src/status-effects.js` implements the two effects supplied by existing foods:

| Food | Effect | Chance | Duration |
| --- | --- | --- | --- |
| Raw chicken | Hunger I (17) | 30% | 600 ticks / 30 seconds |
| Rotten flesh | Hunger I (17) | 80% | 600 ticks / 30 seconds |
| Poisonous potato | Poison I (19) | 60% | 100 ticks / 5 seconds |

`ItemFood.onFoodEaten` uses a strict float comparison (`nextFloat() < probability`). Failed eating consumes no item and rolls no effect. The web build uses its existing random source, rounded to Java float for comparison; it does not reproduce a seeded world's random stream.

`PotionEffect.onUpdate` applies the effect before decrementing duration and removes it at zero. Poison is ready when the remaining duration is divisible by `25 >> amplifier` (every tick when that interval is zero). It inflicts one armor-bypassing magic damage only when health exceeds one; the existing hurt-resistance window still applies. Hunger adds float32 `0.025 * (amplifier + 1)` exhaustion every tick before FoodStats processes exhaustion. Creative ignores damage/exhaustion while durations continue to expire.

Matching effects combine using the original `PotionEffect.combine`: a stronger effect replaces duration and strength, equal strength only extends duration, and a weaker effect cannot extend or resume behind a stronger one. Active IDs, remaining durations and amplifiers survive saves, import/export and reload. Old saves start without effects. A new respawn player starts without effects. Milk clears both effects after its existing 32-tick drink; Survival returns an empty bucket and Creative retains the milk bucket.

`GuiIngame` uses the original sprites: Poison adds 36 to the heart fill's U coordinate; Hunger adds 36 to the food fill and uses the food container at U=133. Accessible HUD labels name the active effects.

## Evidence and verification

`node tools/verify-effects.mjs` compiles `tools/probes/EffectProbe.java` against the unchanged client JAR (SHA-1 `e80d9b3bf5085002218d4be59e668bac718abbc6`). [effects-reference.json](effects-reference.json) records hashes of `acx` ItemFood, `rv` Potion, `rw` PotionEffect and `adi` ItemBucketMilk and 109 cases:

- 32 original food-delivery cases, including float probability boundaries and an unaffected food.
- 48 complete effect runs across duration boundaries and amplifiers 0, 1, 4 and 5; recorded damage tick indices, health, exhaustion and expiry.
- 27 strength/duration combination cases.
- Two milk cases, Survival and Creative, recording effect clearing and resulting bucket.

The probe captures damage, exhaustion, delivery and clearing on a minimal player double. It does not run the full player tick or renderer. `src/status-effects.test.js` replays all records and separately tests FoodStats integration, armor bypass, hurt resistance, low-health Poison, Creative, invalid save data and save/reload continuation. Muted browser checks confirmed both HUD sprites, one-item food consumption and effect application, milk clearing both effects/returning a bucket, and Hunger persisting after Save and Quit/reload. Only an isolated imported test world was used.

## Limits

Other effects, potion items, brewing, effect particles, the inventory's effect list and its panel offset are unfinished. Existing simplified player hurt resistance and HUD damage animation remain. This is food-effect parity for the implemented foods, not a complete potion system.
