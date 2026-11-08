# Mob hurt, death, rewards and pushing (0.22.12, 0.22.13)

`tools/probes/CombatProbe.java` and `tools/verify-combat.mjs` run the unchanged 1.7.10 classes and write [combat-reference.json](combat-reference.json): 1,113 records, with the sha256 of every class used. `src/combat.test.js` replays them through `EntityWorld` (`src/entities.js`), with the rules in `src/combat.js`.

| Case | Records | What is checked |
| --- | --- | --- |
| hurt | 1,008 | `EntityLivingBase.attackEntityFrom`, `onDeath` and `onDeathUpdate` for the pig, cow, sheep, chicken, zombie, skeleton, spider and creeper (adults and animal children). Each seeded scenario is a run of hits from the player, a mob, a skeleton arrow, fire, lava, falls and drowning; health, motion, limb swing, hurt time, resistance, last damage, recently-hit, sound volume and pitch, every drop, the experience split and the next value of both random streams are compared |
| push | 96 | `collideWithNearbyEntities` and `applyEntityCollision` for every pair of mob types at 6 offsets, including a dead mob: exact motions and boxes |
| pushable | 8 | `canBePushed` for living and dead mobs, the player, items, orbs, arrows, TNT and falling blocks |
| split | 1 | `EntityXPOrb.getXPSplit` as `onDeathUpdate` uses it |

## Rules in the game

- **Hurt resistance.** A hit sets `hurtResistantTime` to 20 and `hurtTime` to 10. While hurt time is above 0, a hit no larger than the last one is refused, and a larger one deals only the difference, with no sound, flash or knockback.
- **Hit order.** An animal starts fleeing (and leaves love mode) even if the hit is refused. Then come the limb swing (1.5), resistance, `damageEntity`, revenge and the 100-tick recently-hit timer for a player hit, `setBeenAttacked`, knockback from the attacker, then the hurt or death sound. A zombie then calls reinforcements on Hard ([difficulty](difficulty.md)).
- **Random streams.** `setBeenAttacked` (not for drowning), knockback resistance, sound pitch, every drop roll and the death burst draw on the mob's own `Entity.rand`. The knockback nudge uses `Math.random`, as the original does. Animal experience draws on `World.rand`.
- **Sounds.** Cows play at volume 0.4 and other mobs at 1. Pitch is `(nextFloat − nextFloat) × 0.2 + 1`, or + 1.5 for a child.
- **Armour.** The zombie's 2 natural armour points cut melee, arrows, explosions, lava and fire blocks to 23/25. Falls, burning, drowning and generic damage bypass armour.
- **Drops** (no looting), one item entity per item:
  - pig: 1 to 3 porkchops;
  - cow: 0 to 2 leather and 1 to 3 beef;
  - chicken: 0 to 2 feathers and 1 chicken;
  - sheep: its wool, unless sheared;
  - zombie: 0 to 2 rotten flesh;
  - skeleton: 0 to 2 arrows and 0 to 2 bones;
  - spider: 0 to 2 string, plus an eye (1 in 3) after a player hit;
  - creeper: 0 to 2 gunpowder.

  Meat is cooked when the mob dies burning. After a player hit, a skeleton drops its bow with chance 0.085, worn by a random amount. Also after a player hit, a zombie has a 5 in 200 rare drop: an iron ingot, carrot or potato. Children drop nothing.
- **Experience.** At death tick 20, a mob hit by the player in the last 100 ticks drops experience: animals 1 to 3, monsters 5, and a skeleton 1 to 3 more for its bow. Children give none. The orbs drop in every game mode, and Creative players collect them too (since 0.22.13). The 20 `explode` particles follow.
- **Death timing.** A mob killed by a hit counts its first death tick on its next update. A mob killed by fire or drowning counts it in the same update. A dying mob still burns, slides on its knockback and is pushed.
- **Pushing.** Each living mob pushes every pushable entity whose box meets its own box grown by 0.2 horizontally. The push is 0.05 along the square root of the larger axis distance, and nothing happens within 0.01. Mobs push the player's box but never move the player; the player's own update pushes nearby mobs away.
- **Sun burning.** Adult zombies and skeletons in daylight above brightness 0.5 with open sky catch fire for 8 seconds when `nextFloat × 30 < (brightness − 0.4) × 2`, checked before the AI as in `onLivingUpdate`.

## Gaps

- Looting is not ported (there are no enchantments).
- Creepers killed by a skeleton draw the record roll, but this build has no records.
- Revenge targets come only from player hits; mobs do not retaliate against other mobs.
- Mobs are updated in this build's entity list order, not the original's chunk order, so pushes between three or more mobs can land in a different order.
- Every skeleton is assumed to hold a bow; spawn equipment rolls are not run.

## Suffocation

`suffocation-reference.json` (218 records, regenerate with `node tools/verify-suffocation.mjs`) is recorded from the unchanged client by `tools/probes/SuffocationProbe.java`: `Block.isNormalCube` for 38 ids, `Entity.isEntityInsideOpaqueBlock` over position sweeps for ten entity sizes (stone fully swept; glass, leaves, water, slabs and others for the player, zombie, pig and chicken), and 78 tick sequences through `EntityLivingBase.onEntityUpdate`.

- `isEntityInsideOpaqueBlock` samples eight corners (width * 0.8, 0.1 tall) at the eye (`height * 0.85F` for mobs; the server player uses posY + 1.62F, sneaking or not) with `isNormalCube`. Leaves, glass, water, snow layers, TNT, farmland, cactus, chests, ladders and torches do not count; stone, sand, gravel, clay, bedrock, soul sand and dirt do. `world.js` `normalCube` already agreed, so no new predicate was added (`src/suffocation.js`).
- A living, inside entity takes `DamageSource.inWall` 1.0 each update through the hurt pipeline: no armour, no Creative, no damage during 60 ticks of spawn protection, a hit every 10 ticks. A larger hit during the window deals only the difference (the player previously refused it; `Survival.damage` now tops up). Mob replays include sounds, hurt resistance and death ticks (`src/suffocation.test.js`).
- Not ported: slabs, stairs and fences (their native values are recorded). The void exception to spawn protection and the "suffocated in a wall" death text are covered under [Player hurt rules](#player-hurt-rules).

## Player hurt rules

`player-damage-reference.json` (116 records, regenerate with `node tools/verify-player-damage.mjs`) is recorded from the unchanged classes by `tools/probes/PlayerDamageProbe.java` on the real `EntityPlayerMP`, with a zombie for comparison. `src/player-damage.test.js` replays it through `Survival` (`src/survival.js`) and `src/death-messages.js`.

| Case | Records | What is checked |
| --- | --- | --- |
| hits | 30 | Hit runs on the player and a zombie: fresh hits, top-ups (including at the last window tick), refused hits, fatal top-ups and fresh kills. Each hit's return value, health, resistance, hurt time, last damage and world events (statuses, sounds at the entity, sounds the player sends to others) are recorded, plus the death message from the real `CombatTracker`. The final hit is each of ten sources, alone or 12 ticks after a zombie hit |
| protection | 77 | One 4.0 hit from each of 11 sources in Survival, with spawn protection (60 and 1), in Creative with and without protection, and in iron armour with and without protection |
| void | 9 | `Entity.onEntityUpdate` at fixed heights around −64 for the player (protected, Creative, armoured) and a zombie |

- **Top-ups send no hurt status.** On the server, `attackEntityFrom` only sends status 2 and plays the hurt or death sound when the hit opens a window (`flag`). The player's `playSound` is `playSoundToNearExcept`, so the player never hears the server's sound. It hears status 2 instead (`EntityLivingBase.handleHealthUpdate`: `game.player.hurt`, volume 1, pitch `(r − r) × 0.2 + 1`). Status 3 comes from `onDeath` and plays `game.player.die`. So the player hears nothing for a top-up, hurt then death for a fresh kill, and only the death sound for a top-up kill. The zombie records show the same on the server: a top-up kill sends `status|3` alone. This build used to play the hurt sound whenever health dropped, at volume 0.8.
- **Top-ups still shake the camera.** `EntityPlayerSP.setPlayerSPHealth` (`blk.n`, read with javap, not run) sets `hurtTime = maxHurtTime = 10` whenever the synced health drops, top-ups included. `Survival.hurtTime` now drives the hurt camera tilt, the damage flash and the third-person tint. The server-side window (`hurtTicks`) no longer does.
- **Spawn protection.** `EntityPlayerMP.attackEntityFrom` refuses every source while `field_147101_bU > 0`, unless it is `DamageSource.outOfWorld`. The PvP fall exception applies only on a dedicated server. `EntityPlayer.attackEntityFrom` then refuses Creative players unless the source `canHarmInCreative`, and only `outOfWorld` can. The void also bypasses armour: a void hit takes the full 4 even in iron armour.
- **The void.** `Entity.onEntityUpdate` calls `kill()` when `posY < −64` (exactly −64 is safe). `EntityLivingBase.kill` is `attackEntityFrom(outOfWorld, 4)`. The hurt window gates it, so the player takes 4 every 10 ticks and dies at tick 40 from full health, in every mode. It comes after the fire and lava hits and before `inWall`. `Survival.tick({ outOfWorld })` does this, and main.js passes `position.y < -64`. In practice the path is not reached yet, because main.js still moves a player below y 1 back to spawn and `world.get` returns lava below y 0. In addition, main.js only opens the death screen for Survival players, so a Creative void death would need that check changed.
- **Death messages.** `EntityPlayerMP.onDeath` broadcasts `CombatTracker.func_151521_b` to chat (1.7.10 has no `showDeathMessages` rule). `GuiGameOver` shows only "You died!" and the score. The full tracker is ported in `src/combat-tracker.js` (see [Combat tracker and death messages](#combat-tracker-and-death-messages)); `src/death-messages.js` turns its `{ key, args }` into the text through `translate`, and the line prints at the `GuiNewChat` position. There is no account name, so "Player" stands in.

### Gaps

- Looting is still not ported, because this build has no enchantments.
- Death-message gaps are listed under [Combat tracker and death messages](#combat-tracker-and-death-messages).
- 0.23.4 makes the void reachable: `World.get` returns air below y 0 (World.getBlock), a Creative player can break the y 0 bedrock, the low spawn teleport is gone, Creative players die there too (death screen, "Player fell out of the world", respawn keeps the mode) and mobs take the same outOfWorld 4 under y −64 instead of dying at y 0. Survival players still cannot break bedrock, so they reach the void only through an existing hole.
- The client hurt timing (`setPlayerSPHealth`) was read from bytecode but not executed, and the chat line uses wall-clock time instead of the 200-tick counter.

## Combat tracker and death messages

`combat-tracker-reference.json` (532 records, regenerate with `MC_RESEARCH=<dir> node tools/verify-combat-tracker.mjs`) is recorded from the unchanged `CombatTracker` (`rn`), `CombatEntry` (`rm`), `DamageSource`, `EntityDamageSource(Indirect)` and `EntityLivingBase`/`EntityPlayerMP` by `tools/probes/CombatTrackerProbe.java` (it reuses `PlayerDamageProbe.init()`). Every scenario runs twice, once ending in a fatal hit (what a death shows) and once in a non-fatal hit (the `func_151521_b` state a live player has). `src/combat-tracker.test.js` replays the matrix through `Survival.damage`: accepted or refused, entry count and the message after every hit, and the death message.

Probed (executed natively):
- **Entries.** `damageEntity` sets the new health first and then calls `func_94547_a`. A hit that deals 0 adds no entry; a top-up inside the hurt window adds only the difference; a refused hit adds none.
- **A lethal hit clears the earlier entries.** `func_94549_h` runs inside `func_94547_a` while the player is already dead, so the list is emptied and the death message only sees the killing blow. As a result `death.fell.assist`, `.assist.item`, `.killer` and `.finish` can appear only for a non-fatal preview, never for a real death. The records show this for every fall scenario.
- **Window.** The list is cleared by the next hit once the last entry is more than 100 ticks old, or 300 once a living attacker opened the "in combat" state.
- **Fall texts.** A fall entry counts only when its `fallDistance` is above 5: 5.0 prints `death.attack.fall` ("hit the ground too hard"), 5.5 prints `death.fell.accident.*`. The suffix is `ladder` or `vines` when the cell at the feet is one, else `water` in water, else `generic`. `outOfWorld` counts as an unbounded fall.
- **Fighting entity.** `func_94550_c`: the player that dealt the most damage if it dealt at least a third of the most any living entity dealt, else that living entity (the first wins a tie). A projectile with no shooter is never the fighter.
- **`.player` on a real death** comes from `EntityLivingBase.func_94060_bK`: the revenge target (the last living source entity, cleared by `sv.C` when dead or 100 ticks after the hit), not from the tracker. A drowning 99 ticks after a zombie hit reads "drowned whilst trying to escape Zombie"; at 101 ticks it reads "drowned". `.player` keys exist for inFire, onFire, lava, drown, cactus and explosion.
- **Item argument.** The `.item` keys are used when the source entity holds a stack with a custom name, and the argument prints as `[Name]` (square brackets). Only arrow, fireball, thrown, indirectMagic and player have `.item` keys; `death.attack.mob` has none, so a renamed sword on a zombie prints "slain by Zombie".
- **Sources.** An ownerless fireball is `onFire` with the fireball as entity ("burned to death", and "doomed to fall by Small Fireball" in a fall preview). An ownerless arrow names the arrow but is not a tracked entity. A player's own arrow has the victim as shooter ("drowned whilst trying to escape Player" after one). Lightning is `inFire` in 1.7.10 (there is no lightning source).

Bytecode-read only (javap, not executed): the 20-tick `func_94549_h` sweep in `EntityLivingBase.onUpdate` (it changes nothing observable), `World.updateEntityWithOptionalForce` incrementing `ticksExisted` before `onUpdate`, the dead second branch of `CombatTracker.i()`, why `death.fell.finish` can never be printed (the last entry's source is `fall`, which has no entity), the three callers of `EnchantmentHelper.func_151384_a`, which mob classes override `attackEntityAsMob`, `Entity.fallDistance` writers (no `mountEntity` write), and `EntityMob`/`EntityLiving.enchantEquipment`.

Port wiring: `Survival.damage` records an entry after the health update (`dealt != 0`) and sets the revenge target for every accepted hit with a living source entity; `Survival.tick` expires it. `player-environment.js` samples the fall site and distance for the fall hit; `bow.js` passes `{ self: true }` for the player's own arrow; `main.js` `die()` prints `trackerMessage(survival.combat, ...)` with the held stack's custom name. The English fallbacks are the en_US `death.attack.*` and `death.fell.*` values (pinned in the test) and `lang-hooks.js` overlays both tables for the selected language.

Not ported: damage to the player from another player (no PvP, so `aR`/attacking-player is not modelled), held-item names of mobs beyond `equipment[0].displayName`, and the Thorns of a player's held stack.

### Damage sources round 2 (deaths2, batch 20)

`combat-tracker-reference.json` now holds 532 records (`CombatTrackerProbe` also compiles in `deaths2-probe/` of the research folder). Newly probed (executed on the unchanged classes):
- **Thorns overload.** The batch 19 `thorns:*` rows printed `death.attack.mob` because `ro.a(who)` with a statically typed `sv` argument binds `DamageSource.causeMobDamage(sv)`; `causeThornsDamage` is `ro.a(sa)`. With the right overload the text is `death.attack.thorns` ("%1$s was killed trying to hurt %2$s") naming the wearer, for a zombie, a renamed zombie, a skeleton and a player. There is no `death.attack.thorns.item` key, so a held renamed item adds nothing. Thorns damages the entity that hit the wearer, so the player dies of it only when the player hits a mob that wears Thorns. It counts as a living source entity: it opens the 300-tick window, wins `func_94550_c` and sets the revenge target.
- **Who has Thorns.** `EnchantmentHelper.func_151384_a(victim, attacker)` walks `getLastActiveItems` (a mob: all five equipment stacks, the held one first) and has three callers (scan of every class): `EntityMob.attackEntityAsMob`, `EntityArrow.onUpdate` and `EntityPlayer.attackTargetEntityWithCurrentItem`. Mobs get enchanted gear (`EntityLiving.enchantEquipment`, already ported in `mob-equipment.js`). `EntityWolf`, `EntitySlime`/magma cube, iron golem and ocelot override `attackEntityAsMob` without `EntityMob`'s, so they never trigger the victim's Thorns (the port used to; `thorns-live.js` `NO_THORNS_ATTACKER`). The roll and the wear (3 durability on a hit, 1 on a miss, on the first piece carrying Thorns; not 2 or 3) were already probed in `armor-enchantment-reference.json`. The thorns source is not armour-bypassing, so the player's armour reduces it.
- **Falling blocks.** `EntityFallingBlock.fall(float)` run against a world double that returns the real player: damage `min(floor(ceil(distance - 1) * fallHurtAmount), fallHurtMax)` (40 and 2.0 by default), `DamageSource.anvil` for an anvil and `fallingBlock` for any other block with `hurtEntities`, "was squashed by a falling anvil" / "falling block". The helmet rule of `attackEntityFrom` (helmet wear `(int)(4a + rand * 2a)`, damage times 0.75) applies to both sources. A plain block hurts only when summoned with `HurtEntities` (`FallHurtAmount`, `FallHurtMax`; `entity-summon.js`). The anvil's own degradation is unchanged. Known difference: when the helmet wears out on the same hit the original keeps an emptied stack in the slot, which still counts its armour point for that hit, while the port removes it first (8 or fewer records of the replay).
- **Tamed wolves.** A wolf is an ordinary living source entity: `death.attack.mob` "was slain by Wolf" (or the custom name "Bob"), the same tamed or not; ownership changes nothing in the text. The owner-revenge AI (`EntityAIOwnerHurtByTarget` / `OwnerHurtTarget`) was already ported in `wolf-ai.js`; the gap closed here is that only melee hits fed the owner's revenge target, so arrows, fireballs and thorns did not. `Survival.damage` now reports every accepted hit with a living source entity (`onRevenge`, wired in `ai.js` `beginTick`).
- **Fall sites.** An ender pearl sets `fallDistance` to 0 and then deals `DamageSource.fall` 5.0: every site (ladder, vines, water, after other hits) prints "hit the ground too hard", which the port already did (the pearl path leaves `combatFall` 0). A mount's fall reaches the rider through `Entity.fall`; the rider's own `fallDistance` field is untouched, so a rider that never fell reads 0 ("hit the ground too hard"), while one that was falling when it mounted reads that distance and the cell at its feet (ladder, vines or generic). `vehicle-simulation.js` now samples both.
- **`.item` text.** A mob holding a renamed sword prints `death.attack.mob` (no `.item` key exists for `mob` or `thorns`; `player`, `arrow`, `fireball`, `thrown` and `indirectMagic` have one). A player attacker holding a renamed sword in `InventoryPlayer.getCurrentItem` prints "was slain by Alex using [Sting]", also for arrows and fireballs. `fell.assist` uses `.item` for any living entity, mobs included. An ownerless `thrown` or `indirectMagic` prints the raw key `entity.ThrownPotion.name` (executed now, was bytecode-read).

Tests: `src/combat-tracker.test.js` now replays the whole matrix (thorns, thrown, ownerless magic, wolves, player sword, pearl and rider falls) and `src/falling-damage.test.js` replays the falling-block records and covers the Thorns, revenge and vehicle hooks.


### Thorns wear and team names (combat3, batch 21)

**Thorns wear with Unbreaking** (`ThornsWearProbe`, `thorns-wear-reference.json`: 2880 rows plus 36 break rows, regenerated by `tools/verify-thorns-wear.mjs`). Probed on the unchanged `EnchantmentHelper.func_151384_a`: Thorns I-III x Unbreaking 0-III on a leather or diamond chestplate, boots and helmet at damage 0, max-3, max-1 and max, for a mob with five equipment stacks, a survival player and a Creative player, plus two-Thorns-piece cases (the first piece in slot order takes both wears).
- A hit costs the piece 3, a miss 1, through `ItemStack.damageItem(amount, wearer)`: Unbreaking is rolled on the **wearer's own Random** in the native order (armour: 60 % gate first, then `nextInt(level + 1) > 0`, once per point), the rest is subtracted, and a stack past its maximum breaks. Observed wear with Unbreaking III on a hit: 1, 2 or 3; on a miss 0 or 1.
- **A mob wearer rolls Unbreaking too.** The batch 20 note that mob equipment ignores Unbreaking was wrong (the probe's mob double wears 0-3 off a Unbreaking piece); `thorns-live.js` now uses `attemptDamageItem` on the mob's Random. The survival player path (`inventory.damage`) already matched and now also replays Unbreaking III.
- A Creative player's piece is never worn and draws no Unbreaking numbers; the Thorns rolls still happen.
- A broken piece is **not removed**: `damageItem` only decrements the stack size, so a zero-size stack (damage reset to 0) stays in the slot and keeps rolling Thorns and being worn on later reactions (36 rows, mob and player). Ported for players in batch 22 and for mobs in batch 24 (below).

**Team-formatted names** (`TeamNameProbe`, `team-names-reference.json`, 329 records; `tools/verify-team-names.mjs`; port `team-names.js`). Probed on the real `EntityPlayerMP`, `CombatTracker.func_151521_b` and a real `Scoreboard` with teams holding a prefix, suffix and members by name:
- `EntityPlayer.func_145748_c_` (`yz.c_`) is `ScorePlayerTeam.formatPlayerName(team, name)` = prefix + name + suffix. Every other entity's `Entity.func_145748_c_` (`sa.c_`) is the plain name: a zombie named "Bob" is not formatted even when a team lists "Bob" (probed; `sv.bt` returns null, bytecode-read; `EntityTameable.bt` only matters for friendly fire).
- So the victim, an attacking player (mob/player/arrow/thorns/explosion/fireball sources), the own-arrow shooter, fall assists and the `.player` revenge texts print the formatted player name; mobs and wolves never do. `/scoreboard teams option color` sets prefix `§c`-style and suffix `§r`; prefix and suffix beyond that arrive only through imported scoreboard data.
- Every translation argument is its own component and the chat draws `getFormattedText`, which appends `§r` after every component, so an unclosed team prefix such as `§l[Mod] §a` cannot colour the rest of the line. The port printed the death text and chat as one string, which leaked such colours; `deathComponent` and `chatTextComponent` (`team-names.js`) now print `chat-component.js` translations (322 death scenarios and 7 `chat.type.text` lines match the native `getFormattedText`). The item argument is the component `"§f[§r§fName§r§f]§r"` in the rarity colour; the port uses white for every stack (assumed; rare/epic or enchanted stacks would print aqua/light purple).
- The only team member in the live port is the one local player, so the formatted attacker name (`withTeamName`) is reachable only through the replay; there is no PvP.

### Zero-size armour stack and arrow-at-villager (villagers4, batch 22)
Never claim full parity. Labels: probed / bytecode-read / assumed.
- Probed: `tools/probes/ZeroArmourStackProbe.java` + `tools/verify-zero-armour-stack.mjs` -> `zero-armour-stack-reference.json` (30 records), replayed by `src/zero-armour-stack.test.js`. An iron chestplate at stack size 0 in a real `EntityPlayer`'s armour slot (what `ItemStack.damageItem` leaves when Thorns wear breaks it): `getTotalArmorValue` still counts it (6; with boots 8), `EnchantmentHelper` Protection still rolls its enchantments, `writeToNBT` writes it as `Count:0b`, `readFromNBT` keeps it (for a main slot too), and `InventoryPlayer.damageArmor` clears it from the slot (no wear, no break sound) while a normal piece wears and a last-durability piece breaks and is cleared.
- Bytecode-read: `ItemStack.damageItem` leaves the size-0 stack; Thorns (`EnchantmentHelper.func_151384_a`) and the anvil/falling-block helmet hit in `EntityLivingBase.attackEntityFrom` (`sv.a(ro, F)` calls `add.a(int, sv)` directly) both leave it; only `InventoryPlayer.damageArmor` nulls it; the player drop path returns null for stackSize 0, so a zero piece is never dropped on death.
- Ported (player armour slots only): `PlayerInventory.damage(i, amount, keepEmpty)` used by `Survival.thorns` and `anvilDamage`; `Survival.applyArmor` clears a size-0 piece; the armour constructor path, `itemStackFromNbt({allowEmpty})` and `javaPlayerFromNbt` keep a `Count:0b` armour entry; the export already writes it; `takeAll` clears but never drops it. Rendering needs no change: a zero stack still has an id.
- Pinned differences (main inventory, mob path and container clicks closed in batch 24, below): the main inventory still rejected size-0 stacks (native keeps them, probed), plain `itemStackFromNbt` still rejects Count 0 (hoppers, drops, `/give`), and the mob path (`mobThornsOnPlayerHit`) still removes a broken mob piece instead of keeping a size-0 stack (mob equipment never takes ordinary damage; the port's mob drops, NBT export and render assume non-empty stacks and the zero case was not probed there). Container clicks on a zero armour slot (shift-click, swap) are not probed natively; the port treats the stack as a normal stack.
- The skeleton arrow at a villager (death text, aggressor, golem) is recorded in `village.md` batch 22.

### Zero-size stacks on mobs, in the main inventory and in container clicks (zerostacks, batch 24)

- Probed: `tools/probes/ZeroStacksProbe.java` + `tools/verify-zero-stacks.mjs` -> `zero-stacks-reference.json` (42 inventory script cases from `tools/probes/zero-stack-scenarios.txt`, plus 183 records: mobThorns 36, mobNbt 3, mobDrop 72, mobXp 12, anvil 60), replayed by `src/zero-stacks.test.js`.
- **Mobs.** A real `EntityZombie`'s Thorns piece that breaks stays a size-0 stack with damage 0, keeps its armour point and its Thorns, and is worn again (Unbreaking rolls on the mob's Random). `renderBrokenItemStack` plays `random.break` and draws 15 floats of the mob's Random (5 particles x 3). `writeToNBTOptional` writes `Count:0b` and `createEntityFromNBT` keeps it. `dropEquipment` still rolls for it (nextFloat, plus the two damage ints) but `entityDropItem` refuses it. `getExperiencePoints` counts it like a whole piece. An anvil or falling block wears a mob's helmet-slot stack first; a broken helmet stays at size 0 and keeps its point, and a size-0 helmet still cuts the damage to 0.75. Ported: `thorns-live.js`, `mob-equipment.js` (`fallingBlockHelmet`, `readGear`, `dropEquipment`, `pickUpItem`), `java-mobs.js` and the region-import `convertItem` (`allowEmpty`), and one line in `entities.js attackEntityFrom`.
- **Player anvil helmet.** Natively a helmet that breaks on the hit still counts for that hit (`getTotalArmorValue` is read before `damageArmor`), and then `damageArmor` clears it. The port already matched this; the skip in `falling-damage.test.js` was stale and has been removed.
- **Main inventory.** `InventoryPlayer.readFromNBT` keeps a Count 0 main stack, and so do the port's `PlayerInventory` constructor and `javaPlayerFromNbt` (the `inventory-odd-slots` level.dat row reads back `[1,0,0]`). Every native held-item `damageItem` caller clears a stack at size 0 afterwards, broken or not, so a zero-size tool is cleared on its next use; `PlayerInventory.damage` now does the same.
- **Container clicks.** All 41 click scripts on a zero armour slot already replayed natively: pick-up, place, swap, shift-click, number keys, Q / ctrl-Q, outside drops, close, collect, drag and creative clone. This includes the native quirk where right-clicking outside with a zero cursor drops a whole piece and leaves the cursor at -1.
- Not ported or unprobed: a zero-size block, food or armour used from the hand (`ItemBlock.onItemUse` refuses stackSize 0; the port's consume path does not check). Rendering of a zero stack on a mob is bytecode-read only (`RenderBiped` draws any non-null stack, and the port does too). The player's own 15 `renderBrokenItemStack` draws are not modelled.

### Movement attributes, zero-size use and the break pitch (attributes2, batch 25)

- **Probed** (`attributes2-reference.json`, `src/attributes2.test.js`):
  - `isAIEnabled` is false for the blaze, cave spider, dragon, enderman, ghast, giant, magma cube, pigman, silverfish, slime, spider and squid. Their `getAIMoveSpeed` is a fixed 0.1, with 0.02 water acceleration. The port's ground movers in that set (`LEGACY_MOVE`) now use these factors. The giant and silverfish speeds, and the baby pigman's +50% boost, come from the attribute.
  - `renderBrokenItemStack` pitch is `0.8 + world.rand.nextFloat() * 0.4` on the World Random, not `Entity.rand`. The mob Thorns and anvil-helmet break sounds now use the world Random.
- **Zero-size use** (`tryPlaceItemIntoWorld` / `useItemRightClick` at stackSize 0):
  - `ItemBlock`, `ItemReed`, `ItemSlab` and `ItemSnow` refuse in either mode. The port's `placeHeldBlock` and cake placement now refuse a held size-0 stack too.
  - Redstone, doors, signs, skulls, seeds, nether wart, spawn eggs, bone meal and minecarts act at 0 and leave a -1 stack. So do throwables, food, stew, milk, potions, buckets and bottles. The hoe and flint and steel take damage without a stack check.
  - Batch 26 closed this gap (below): the port now keeps negative stacks.
  - Bed placement was not probed (the probe's world double refused it at count 1).

### Negative stacks (negstacks, batch 26)

- **Probed** (`neg-stacks-reference.json`, `tools/probes/NegStacksProbe.java`, `tools/verify-neg-stacks.mjs`; 88 records: tileRead 16, playerRead 6, use 52, rightClick 14; replayed by `src/neg-stacks.test.js`):
  - `TileEntityChest`, `Dispenser`, `Furnace` and `BrewingStand` `readFromNBT` keep a slot of Count -1, 0 or 127 and write the same Count byte back. So does `InventoryPlayer.readFromNBT` (main and armour). `ItemStack.loadItemStackFromNBT` and `TileEntityHopper` already kept them (attributes2).
  - At stackSize -1 and -2, `ItemBlock`, `ItemSlab` and `ItemReed` place and leave count - 1 (their refusal is `stackSize == 0` only). Redstone, doors, seeds, nether wart, spawn eggs (Survival only), bone meal and minecarts do the same. The ItemStack-level probe also shows -1 in Creative, because Creative restores the stack in `ItemInWorldManager`, not `ItemStack`.
  - Bytecode-read: `ItemSign.onItemUse` and `ItemSkull.onItemUse` end with an unchecked `--stackSize` (the probe's world double throws before it). Torches are ItemBlock.
  - Throwables, apple, bread and milk go to count - 1 at -1. Buckets and bottles replace the stack when `--stackSize <= 0`.
- **Ported:**
  - Every container tile read keeps Count 0 and negative bytes. `PlayerInventory.read` keeps any count when empty stacks are allowed.
  - `Survival.take` shrinks a held stack at size 0 or below itself (0 -> -1; only an exact 0 clears the slot), and `Survival.usable` replaces the `count(id)` gate at the held-item use sites (placement, doors, redstone, signs, skulls, seeds, wart, bone meal, cake, throwables, eating, spawn eggs). `PlayerInventory.count` ignores stacks of size 0 or below.
  - `placeHeldBlock` and cake placement refuse only an exact 0.
  - The player's tool-break pitch (`main.js reportBrokenTool`) uses the world Random (`weather.random`).
- **Gaps:** an armour slot read at Count -1 for a non-armour item is still dropped (the port filters armour by slot type, native does not). Furnace, dispenser and brewing ticks on size-0 or negative stacks were not probed. A negative stack in a container GUI or the creative drag path was not checked. `FireworksItem` and plain `/give` still refuse Count 0.
