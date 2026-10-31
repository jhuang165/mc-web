# Cobwebs — Minecraft Java 1.7.10

Version 0.19 adds `BlockWeb` (original ID 30, internal block 51). Cobwebs use the original `blocks/web.png`, two crossed double-sided planes (`renderType` 1), full-cell selection, no collision box, light opacity 1 and hardness 4. They appear in Decorations and Search in original registry order. They can be placed without supporting blocks and do not behave as replaceable plants. Held and dropped cobwebs use the original flat sprite.

## Contact and movement

`Entity.doBlockCollisions` scans the entity box inset by 0.001 on each side. `BlockWeb.onEntityCollidedWithBlock` calls `Entity.setInWeb`, setting the contact flag and clearing fall distance. On the **next** `moveEntity`, the flag is consumed: requested X/Z displacement is multiplied by 0.25, Y by the double value of `0.05f` (0.05000000074505806), and all three motion components become zero. Gravity and drag still run afterward. Contact after that move can set the flag again. Leaving a web therefore retains one slowed move.

The shared functions in `src/webs.js` run around movement for the player, walking mobs, dropped items and XP orbs. Ordinary spiders override `setInWeb` with an empty method, so they are immune. `EntityPlayer.setInWeb` skips the base call while `capabilities.isFlying`; merely being in Creative does not grant immunity. The contact flag is transient and rebuilt after loading, as in the original.

## Harvesting and fluids

Only swords and shears can harvest a web with the current tool set. Both have dig speed 15, yielding eight grounded, dry mining ticks; a sword takes two durability damage, shears one. Other tools and bare hands break it without a drop. The ordinary drop is **one string**, including when cut with shears: collecting the web itself requires Silk Touch, which is not implemented. No modern shears-to-cobweb rule is substituted. Water can wash a web away and drop string; lava destroys it silently through the existing liquid flow rules.

## Evidence and validation

`node tools/verify-webs.mjs` runs unchanged `BlockWeb` (`aok`), `Entity` (`sa`), `EntityPlayer` (`yz`), `EntitySpider` (`yn`) and `EntityItem` (`xk`) classes from the original 1.7.10 JAR (SHA-1 `e80d9b3bf5085002218d4be59e668bac718abbc6`). [web-reference.json](web-reference.json) records 252 cases: block facts, 80 fixed-velocity moves each for a pig, spider and item, two flying/walking player contacts and nine box-edge contact tests. The world double supplies a stone floor and a web column; no game classes are patched or shipped.

`src/webs.test.js` replays those movements/contact boundaries and checks player integration rules, selection/bucket ray behavior, harvesting/wear, texture mapping, edit/stack persistence, fluid wash callbacks and XP contact. The original mining harness now excludes non-mining tools and reads per-stack durability, allowing it to regenerate 2,992 cases including snow layers, ice, saplings and cobwebs. It also caught the sapling's missing native axe/sword speed factors; hardness remains zero. All 63 native inventory cases pass, including web fuel/smelting registry entries. The shadow probe confirms a web cannot receive entity shadows. All 447 JavaScript tests, five bridge tests and the production build pass. Muted browser verification in the isolated Cobweb Feature Check world confirmed crossed/held sprites, movement from Z 68.94 to 68.45 over a one-second web interval, shears yielding string with 237/238 durability, and web/inventory persistence after Save and Quit/reload; no browser warnings or errors.

## Remaining limits

Full parity is unfinished. Natural webs need abandoned mineshafts/stronghold libraries, which are absent; Creative is the available source of web blocks. Silk Touch, cave spiders and complete original mob navigation/spawning remain unimplemented. XP orb motion retains the existing simplified physics. The player still uses the existing collision solver; only the web contact and displacement rules are new here. Projectile ray traces retain the existing 1.7.10 distinction: snowballs/eggs can hit a web's selection box while arrows skip blocks without collision boxes.
