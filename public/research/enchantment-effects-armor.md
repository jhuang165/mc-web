# Armor and bow enchantment effects, and the glint (Minecraft Java 1.7.10)

Not full parity. This covers the live armor and bow effects listed below, nothing else.

## Evidence

- `tools/probes/ArmorEnchantmentProbe.java` runs against the unchanged 1.7.10 client classes (EntityLivingBase `sv`, Entity `sa`, EnchantmentHelper `afv`, EnchantmentProtection `agi`, EnchantmentThorns `agj`, ItemBow `abm`, ItemStack `add`) with fixed seeds. `tools/verify-armor-enchantments.mjs` regenerates and checks `armor-enchantment-reference.json`.
- Native records: protection 1168, fire 210, blast 63, air 68, thorns 160, bow 402, effect (hasEffect) 315, plus 22 damage sources.
- `src/armor-enchantments.test.js` replays every record through the live code (Survival, `releaseBow`, the helpers) and compares results, random draws and durability.

## Live effects

| Effect | Native rule | Port |
| --- | --- | --- |
| Protection / Fire / Blast / Projectile / Feather Falling | `applyPotionDamageCalculations`: amount <= 0 returns 0 with no draw; the sum is capped at 25, then `(n+1>>1)+rand.nextInt((n>>1)+1)`, capped at 20, then `amount*(25-k)/25` in floats. Armor step first (blockable sources only), then this step also for bypass sources (fall, drown, wall, magic, generic). Starvation is absolute and skipped. | `Survival.damage` via `enchantedDamage` |
| Fire Protection burn time | `setFire`: seconds*20 less `floor(ticks*level*0.15F)`, best piece; the counter only grows | `Survival.setFire` (lava, burning mobs, fire catch) |
| Blast Protection knockback | `floor_double(d*level*0.15F)` off the impact | `blastKnockback` in explosion-simulation. This is a faithful quirk: it is a no-op for impact <= 1 at normal levels. |
| Respiration | `decreaseAirSupply`: level i = best piece; with i > 0, `nextInt(i+1) > 0` keeps the air; the Random is drawn only when i > 0 | underwater air in Survival |
| Thorns | Each Thorns entry on each piece rolls `nextFloat < 0.15F*level`. Hit: damage `1+nextInt(4)` (or level-10 above 10), attacker hurt, `damage.thorns` sound, first Thorns piece loses 3 durability. Miss: that piece loses 1. | `thornsReaction`, triggered after a mob melee hit and when a mob's arrow hits the wearer |
| Bow Power / Punch / Flame / Infinity | Order in `onPlayerStoppedUsing`: Power (`+level*0.5+0.5`), Punch, Flame `setFire(100)` (100 s, so 2000 ticks), bow damage 1, sound. Creative or Infinity: `canBePickedUp = 2`, no arrow consumed; nocking still needs an arrow. | `releaseBow` + `applyBowEnchantments`. A burning arrow sets the target on fire for 5 s before the hit. |

## Random streams

- EnchantmentHelper's `enchantmentRand` is one static `Random` shared by the JVM, seeded from the clock. The port models it as one module-level, time-seeded `JavaRandom` (`enchantmentRandom`) that is never saved. Tests reseed it. Mobs wear no armor, so their draws (`nextInt(1)`) cannot change anything and are not replayed.
- The player's `Entity.rand` is modelled by `inventory.random`, the saved stream that Unbreaking and durability already use. Respiration and Thorns rolls draw from it.
- Arrows keep their own separate stream, as natively. Unbreaking on the bow uses the player's stream.
- No stream is added, and the draw order of existing draws is unchanged.

## Glint (`ItemStack.hasEffect`)

- Rule: any `ench` list (even empty) glints. The enchanted book (403), experience bottle (384), written book (387) and nether star (399) always glint. The golden apple (322) and potion (373) glint only with damage > 0, and the list does not count for them. The port has an enchanted book (id 365, `storesEnchantments`) and no other special items yet.
- Surfaces: inventory/hotbar icons (HTML overlay, `withGlint` in gui.js, CSS `.enchant-glint`), first-person held items and dropped items (a three.js overlay, `glintMesh` in first-person.js).
- `misc/enchanted_item_glint.png` (64x64, with `.mcmeta`) ships.
- Approximation: the original re-renders the icon with blend SRC_COLOR/ONE, colour (0.5, 0.25, 0.8) and two layers scrolling at -50 and 10 degrees with periods of 3000 and 4873 ms. The 3D overlay keeps the silhouette, colour and blend, but the scroll scale and offsets are in item UV space. The HTML overlay uses a CSS mask of the icon with a CSS animation. Neither is pixel exact. The glint is not drawn on worn armor models, nor on mobs' held items.

## Known limits

- The Resistance potion step is not ported. Lightning (weather-simulation.js) still sets `survival.fire` directly, so Fire Protection does not shorten it. Damage reasons not in the source map count as generic (only Protection applies).
- The glint rendering was syntax-checked and the logic replayed, but not visually checked in a browser.
