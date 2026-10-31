# Carrots, potatoes and pigs — Java 1.7.10

Carrots and potatoes plant directly on the top of empty farmland. Both grow through eight ages (0–7), use the existing moisture and light checks, and accept bone meal for 2–5 ages at a time. Mature plants return 1–4 roots without Fortune; immature plants return one. Mature potatoes additionally roll a poisonous potato with probability 1/50. Breaking their farmland drops the supported crop; flowing water harvests it with its current age. Alternating crop types avoids the same-crop crowding penalty, as in `BlockCrops`.

Carrots restore 4 food points at saturation modifier 0.6; potatoes restore 1 at 0.3; baked potatoes restore 6 at 0.6. Smelting a potato takes the ordinary 200 furnace ticks and produces a baked potato with 0.35 XP. Poisonous potatoes restore 2 at 0.3, but their Poison effect is **not implemented** (status effects remain unfinished). All four items appear in Foodstuffs and Creative search, in original registry order, with original item textures. Carrots and potatoes can be eaten when planting does not take the click.

Pigs are tempted by carrots and accept one carrot per ready adult for love mode. Two nearby parents create a half-size piglet, reset love, enter the 6,000-tick breeding cooldown and produce breeding XP through the existing `EntityAIMate` implementation. Piglets start at age −24,000. Ages, love and crop ages survive browser saves/exports.

To obtain the first crops in Survival, zombies now have their rare drop: after player damage within 100 ticks, a death rolls `nextInt(200) < 5` without Looting, then chooses an iron ingot, carrot or potato with `nextInt(3)`. Environmental deaths without a recent player hit do not roll it; player arrows count. The timer is transient and resets on reload.

Internal block IDs are carrots **49** and potatoes **50** (metadata 0–7). Item IDs are carrot **322**, potato **323**, baked potato **324** and poisonous potato **325**. These are browser IDs, not Java IDs. Wheat keeps its existing stage IDs 31–38, preserving old saves and generation versions. Root crop textures map ages to original icon indices **0,0,1,1,2,2,2,3**, and use the same four-plane crop mesh, non-solid material, 1/4-height projectile selection box and no receiving entity shadow.

## Evidence

`node tools/verify-crops.mjs` compiles `tools/probes/CropProbe.java` against the unchanged 1.7.10 JAR (SHA-1 `e80d9b3bf5085002218d4be59e668bac718abbc6`). It writes [crops-reference.json](crops-reference.json), recording class hashes and **4,683 cases**:

- 4,096 harvests: both crops, every age, 256 seeds. Subclasses override only item spawning to capture stacks. Float draws are held at 0.5 to isolate the integer rolls; this verifies harvest decisions, not item-entity offset RNG consumption.
- 512 growth cases on hydrated farmland with same-crop or wheat neighbours and recorded random bounds/results.
- 64 bone-meal cases, two icon tables, four food/furnace XP records and five pig breeding-item checks.

`src/crops.test.js` replays these records and checks planting, persistence, food textures, furnace cooking, pig breeding/tempting and rare-drop eligibility boundaries. The existing creative tests compare the expanded tab/search lists with the original full registry; inventory and shadow references are regenerated for the added items and blocks.

Zombie rarity and selection come from `javap -c -p sv yq`: `EntityLivingBase.onDeath` (`sv.a(ro)`) requires `recentlyHit` (`aS`) and rolls 200; `EntityZombie.dropRareDrop` (`yq.n(I)`) selects iron/carrot/potato. They are bytecode-derived and unit-tested, not executed by this probe. ItemSeedFood placement (`adv.a`), the existing animal mating path and the support-loss adapter are also not probe-run here.

## Limits

Farming retains its approximate hash-based random-tick sampling and light estimate; it does not yet use the shared `WorldServer` random-tick stream. No villages, natural crop patches, Fortune, golden carrots, carrot-on-a-stick riding, trampling or Poison effect. Other crops and the broader status-effect system remain unfinished. No claim of full Java parity.
