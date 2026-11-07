# Game rules (0.43.0)

Target: Minecraft Java 1.7.10. Nothing here claims full parity.

## Evidence

`tools/verify-game-rules.mjs` runs `javap -c` over every class of the pinned client JAR (SHA1 e80d9b3b...) that holds a rule
name, records each method that loads one with `ldc`, names it through `joined-1.7.10.srg`, and writes
`game-rules-reference.json`: 40 call sites (31 reads outside the GameRules constructor) for the nine 1.7.10 rules, each marked
wired, absent (the feature is not in this build) or registry. The script fails if a site has no port status.
`src/game-rules.test.js` replays it and checks the behaviour on real `EntityWorld`, `Farming` and explosion code.

## Port

`src/game-rules.js` is the one reader. main.js points it at the active world record (`gameRules`, written by /gamerule),
so a change applies on the next read without reloading, as `World.getGameRules()` does. Values follow
`GameRules.Value.setValue`: `Boolean.parseBoolean`, so "TRUE" is on and anything other than "true" in any case is off.

| Rule | Native sites | Port |
| --- | --- | --- |
| doFireTick | BlockFire.updateTick returns at once (no spread, no burn-out, no rain check); EntityLightningBolt places no fire | fire.js `L.fireTick`. BlockStaticLiquid (lava lighting fires) does not read it, natively or here. |
| doMobSpawning | WorldServer.tick skips SpawnerAnimals.findChunksForSpawning; BlockPortal spawns no pigmen | `EntityWorld.tick` skips the SpawnerAnimals port ([natural spawning](natural-spawning.md)). Chunk-generation animals, spawner blocks and zombie reinforcements are not gated, as natively. No portal pigmen in this build. |
| mobGriefing | creeper explosion `isSmoking`; farmland trampled by non-players; EntityAIEatGrass block edit; silverfish waking monster eggs; plus loot pickup, door breaking, enderman, wither, wither skull, ghast fireball, dragon | Creeper: the rays and random draws still run, entities are still hurt, no block breaks or drops and the client gets an empty block list (WorldServer.newExplosion clears it). Farmland: the nextFloat roll comes first. Sheep still finish eating and regrow wool. Silverfish turn eggs back into their block. Zombie door breaking is gated by it (see [mob-riding](mob-riding.md)). Batch 16: all 11 native read sites are wired (loot pickup in `entities.js lootPickup`, enderman `carryStep`, wither spawn explosion and block sweep, wither skull and large fireball explosions, dragon `destroyBlocks`); `mob-griefing.test.js` lists them and drives each off and on. Fireball and skull explosions stay flaming or not independent of the rule; the ender crystal, TNT, small fireballs and villagers (no farming AI in 1.7.10) have no read. |
| doMobLoot | EntityLivingBase.onDeath (dropFewItems, dropEquipment, rare drop); onDeathUpdate experience orbs (players too: EntityPlayer does not override it); EntityAIMate breeding experience | entities.js onDeath, deathUpdate, spawnBaby; main.js player death orbs (the experience is still lost). |
| commandBlockOutput | ServerCommandManager.func_152372_a | Wired in command-block.js: operator feedback only; Track Output remains independent. |
| keepInventory, doTileDrops, doDaylightCycle, naturalRegeneration | as listed in the reference | Wired since 0.42.0. 0.43.0 adds the naturalRegeneration check to the Peaceful heal (EntityPlayer.onLivingUpdate). |

## Not covered

The spawn pass the rule gates is the SpawnerAnimals port; its own approximations are in [natural spawning](natural-spawning.md).
