# Wolves

Target: Minecraft Java 1.7.10. Names are the obfuscated classes of the unchanged client JAR (`tools/research/`, not shipped). Full parity is not claimed.

## Classes

`wv` EntityWolf, `tg` EntityTameable, `wf` EntityAnimal, `rx` EntityAgeable, `wp` EntitySheep, `yz` EntityPlayer. AI tasks: `vh` Sit, `um` LeapAtTarget, `ug` FollowOwner, `ty` Beg; targets `vs` OwnerHurtByTarget, `vt` OwnerHurtTarget, `vr` TargetNonTamed, `vn` HurtByTarget, `vu` EntityAITarget. Client: `bio` ModelWolf, `bpe` RenderWolf (shadow size 0.5).

## Evidence

`node tools/verify-wolf.mjs` (with `MC_RESEARCH=tools/research`) compiles `tools/probes/WolfProbe.java` against the jar, runs the unchanged `wv`, `tg`, `wf` and `bio`, and records `public/research/wolf-reference.json`: 355 interact rows (bone taming over seeds, meat at several health values, dyes, sit toggles, a stranger, a stick), 300 living-sound rolls, 66 mate / target rows, 49 ModelWolf rows (8 states x 3 poses x 2 partials, plus the rest pose), 42 shake ticks, 21 tail values, 3 child rows, 2 attack rows, hurt-source rows, the `getShakeAngle` / shade / begging angles and the dye colour table. `src/wolf.test.js` (pure rules) and `src/wolf-model.test.js` (every ModelWolf part point and angle, box and UV) replay them; `src/wolf-world.test.js` covers the wolf inside the entity world. The wolf sounds (21 files) were imported with `tools/import-vanilla-media.mjs` into `public/audio/1.7.10/mob/wolf/`.

## Ported

- Size 0.6 x 0.8, eye height 0.64, speed `0.3f`, 8 health wild and 20 tamed (health above 20 in an old save is clamped to 20 for an owned wolf, to 8 for a wild one). Bite 2 wild and 4 tamed. No drops.
- Tasks in `wolf-ai.js` with the original priorities and mutex bits: Swim, Sit, Leap (0.4), AttackOnCollide (1.0), FollowOwner (1.0, 10 / 2 blocks, teleport beside the owner), Mate, Wander, Beg (8), WatchClosest (8), LookIdle. Targets: OwnerHurtBy, OwnerHurtTarget, HurtByTarget (the pack joins in), TargetNonTamed (sheep, 1 in 200). A sitting wolf stays put because Sit's mutex bit blocks everything except Beg and Watch. Vertical face speed is 20 sitting and 40 otherwise.
- Taming: a bone is always used up; `nextInt(3) == 0` tames (owner, sitting, 20 health, 7 hearts), else 7 smoke. An angry wolf cannot be tamed. Meat heals only below 20 datawatcher health; a dye sets the collar to `15 - damage` when different (default collar 14, red). The owner's click toggles the sit wish (`sitWish = !sitting`); the sitting flag follows only when the Sit task runs. A favourite meat on an unhurt tamed wolf breeds it instead of toggling.
- Anger: hitting a wild wolf or giving a wild wolf a target sets `angry` (angry texture, growl, tail 1.539); the pack is angered through HurtByTarget. Damage from a creature that is neither a player nor an arrow is `(amount + 1) / 2`.
- Breeding: both tamed, not sitting, both in love; the puppy of a tamed parent is tamed to the same owner, health 8, collar 14.
- Sounds: `mob.wolf.growl / bark / panting / whine / hurt / death / shake / step`, volume 0.4 (step 0.15). The living sound rolls `nextInt(3)` first (whine for a tamed wolf below 10 health).
- Wet shake: timer +0.05 per tick, one shake sound, splash particles `trunc(sin((t - 0.4) * PI) * 7)`, brightness shade `0.75 + t / 2 * 0.25`.
- Render: `wolf-renderer.js` has ModelWolf's boxes, pivots and every pose (standing, sitting, tail from health, begging head tilt, shake offsets -0.08 / -0.16 / -0.2, leg swing, puppy head scale), `wolf.png` / `wolf_tame.png` (a tamed angry wolf keeps the tame skin) / `wolf_angry.png`, the collar pass tinted by the fleece table, and the wet pass (wolf.png darkened by the shade).
- Persistence: `owner`, `sitting`, `sitWish`, `angry`, `collar`, `growingAge`, `love` ride in the entity record (save, export and import paths); old records without them load as a wild wolf. `/summon Wolf` and mob spawners read `OwnerUUID` / `Owner`, `Sitting`, `Angry`, `CollarColor`, `Age`, `InLove`; world export writes them.
- Natural spawning: the generated taiga and forest packs in `population-tail.js` now spawn (they were unsupported before). A wild wolf despawns after 2400 ticks.

## Gaps

- The owner is "the player" (a non-empty string); a Java UUID or name is read as the player. There is no multiplayer owner lookup.
- Batch 69 (docs sweep): the wolf spawn egg exists (`src/spawn-eggs.js`, id 95) and natural spawning runs through `src/spawner-animals.js`.
- Pathfinding and target-search exactness is that of the existing AI framework, not a byte-for-byte replay of `PathFinder` or `EntityAITarget` timing.
- Arrows and explosions are not recorded as owner-hurt or attacker events. HurtByTarget's call for help skips a tamed wolf when the target is its owner, as the original does (`vn` checks `isOnSameTeam`, and `EntityTameable.c` is true for the owner).
- Puppy growth from feeding is simplified to the `-age / 20 * 0.1` step. No leash, no horses.
- Batch 69 (docs sweep): region import converts wolves (`src/java-mobs.js` `JAVA_SUMMON_MOBS`).
- Wet rendering folds the original's extra brightness factor into the lightmap, and the collar layer uses a polygon offset instead of GL_EQUAL.
- The probe records `false` for the sit-toggle interact result (a probe world quirk); the build treats the click as used, as a server does.
