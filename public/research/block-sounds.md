# Block sounds (Block.SoundType)

Every block in 1.7.10 carries a `stepSound` (`Block.SoundType`: a name, a volume and a frequency). The port now has one table for it, [`src/block-sounds.js`](../../src/block-sounds.js), mapping each internal block id through `block-registry.js` to its original id and the SoundType that original block holds. Evidence: [`block-sounds-reference.json`](block-sounds-reference.json), written by `tools/verify-block-sounds.mjs` from `tools/probes/BlockSoundProbe.java` run against the unchanged client JAR (SHA1 `e80d9b3b...`), replayed by `src/block-sounds.test.js`.

## Native-verified

- **The twelve types.** `Block.soundTypeStone, Wood, Gravel, Grass, Piston, Metal, Glass, Cloth, Sand, Snow, Ladder, Anvil` with their `name`, `volume` and `frequency`. Everything is volume 1 and frequency 1 except `Metal` (name `stone`, frequency 1.5) and `Anvil` (name `anvil`, volume 0.3). `Piston` and `Stone` are identical in data (both `stone`, 1, 1) but distinct fields; `Block`'s own default is `soundTypePiston`, which is why 48 of the 171 blocks hold it.
- **The accessors.** `getBreakSound` is `dig.<name>`, `getStepResourcePath` is `step.<name>`, and the place sound (`func_150496_b`) defaults to the break sound. Glass overrides break to `dig.glass` and place to `step.stone` (its step is `step.stone`, its name is `stone`); the ladder overrides break (and so place) to `dig.wood` with step `step.ladder`; the anvil overrides break to `dig.stone` and place to `random.anvil_land`, with step `step.anvil`.
- **All 171 registered blocks.** Each original id's SoundType (by field identity) is in the reference; the module's table and every internal id's lookup are asserted against it. Metal covers gold, iron and diamond blocks, the emerald block, the redstone block, the iron door and bars, the spawner, rails (66) and the powered, detector and activator rails (27, 28, 157). This closes the earlier gap where those rails, iron blocks, doors and bars played the stone sound at pitch 1: they now use the stone files at frequency 1.5.
- **Call-site formulas** (javap token windows of the original client classes are in the reference; the arithmetic is float32):

| Event | Original call site | Name | Volume | Pitch |
|---|---|---|---|---|
| Break | `RenderGlobal.playAuxSFX` 2001 | break | `(v + 1) / 2` | `f * 0.8` |
| Place | `ItemBlock`, `ItemReed`, `ItemSnow`, `ItemSlab` `onItemUse` | place | `(v + 1) / 2` | `f * 0.8` |
| Hit while digging | `PlayerControllerMP.onPlayerDamageBlock`, every 4th tick (counter reset per dig), air skipped | **step** | `(v + 1) / 8` | `f * 0.5` |
| Hoe | `ItemHoe` | step of the tilled block | `(v + 1) / 2` | `f * 0.8` |
| Footstep | `Entity.func_145780_a` | step | `v * 0.15` | `f` |

  The hit sound is the *step* name (not `dig.*`), which the earlier port got wrong. The footstep takes the snow layer's type when the block above the stepped block is a snow layer, and plays nothing for liquid materials (water, lava).
- **Silent placers.** `ItemDoor`, `ItemBed`, `ItemSign`, `ItemRedstone`, `ItemSeeds`, `ItemSeedFood`, `ItemSkull` and `ItemDye` (bone meal sends only level event 2005) reference no SoundType and play no sound. The port no longer plays door, redstone-dust or bone-meal sounds.
- **Missing audio is native.** `step.anvil` is not an event in the 1.7.10 asset index (no `step/anvil` file), so stepping on or hitting an anvil is silent there too. No sound files were added: `dig.glass` uses the already imported `random/glass1-3`, `random.anvil_land` is already in the manifest.

## Where it is wired

`main.js` (`sound(place, block)` for breaks and placements, silverfish/eat-grass breaks, `digSound` hits, footsteps), `player-mining.js` (hit cadence and block position), `player-edit-simulation.js` (hoe), `block-placement-simulation.js` (snow stacking) and `audio.js` (`blockSound` / `stepSound` now read the table; they return the `dig.`/`step.` family name). The per-block constants (`REDSTONE_SOUND`, `SOUND2`, `BREAK_PITCH2`, `HOPPER_SOUND`) stay as data, because those modules are imported by `world.js` and cannot call the table at load time; `block-sounds.test.js` asserts they agree with it.

## Approximated or not covered

- Footsteps still pick their cell as `floor(y - 0.05)` rather than `floor(y - 0.2 - yOffset)` and have no fence/wall-below rule; the footstep volume is now the native `0.15 * v` (it was 0.22) and plays at the listener without attenuation.
- The hit counter restarts when the aim leaves the block; the original keeps it while the same position and tool are held.
- Mobs' own footsteps are wired after 0.43.0 (unreleased) ([mob steps](mob-steps.md)); fall sounds (`EntityLivingBase.fall`, `EntityHorse`) are not; falling-block anvil landings keep their fixed `random.anvil_land` sound.
- Sound variant choice (random file per event) and the distance-attenuation curve are the existing `audio.js` behaviour; the attenuation curve is assumed (paulscode is not in the JAR).
- Not a parity claim: this covers the SoundType table and its call sites, not every sound event of the game.
