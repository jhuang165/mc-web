# Ender Dragon (1.7.10)

Target: Minecraft Java 1.7.10 only. This is a partial port; it is not full parity (see Gaps).

## Evidence

- `tools/probes/DragonProbe.java` drives the unchanged original classes (EntityDragon `xa`, EntityDragonPart `wy`, EntityEnderCrystal `wz`, EntityLivingBase `sv`) on a World double with real chunk storage. `tools/verify-dragon.mjs` compiles and runs it (set `MC_RESEARCH` to `tools/research`) and writes `public/research/dragon-reference.json`: 169 records (facts 1, flight 5, ring 1, damage 112, damageMain 1, hurtWindow 1, crystal 4, collide 8, collideHurt 1, destroy 32, destroyTicks 1, death 2).
- `src/dragon.test.js` replays those records against `src/dragon.js` bit for bit (floats go through `Math.fround`, the MathHelper sine table is the one in `lighting.js`). It includes SHA-1 digests over thousands of flight ticks. V8's `Math.log` differs from Java `StrictMath.log` in the last bit, so the test carries an fdlibm port for the entity Random; in game the drift is possible.
- The probe's flight `state()` field 13 is the sound volume, not the yaw velocity (cosmetic; the trace is still compared on the other fields).
- Bytecode-derived or recalled (not probed): the ModelDragon reconstruction, the spawn in the End chunk (ChunkProviderEnd.populate at chunk 0,0, (0, 128, 0), random heading), the growl draw (EntityLiving.onEntityUpdate), the wing flap sound.

## Behaviour implemented

- Flight AI (`xa.e`): ring buffer of 64 (yaw, y) samples, target selection (`setNewTarget`, player or random point), the float-exact velocity and yaw update, noClip movement, slowdown when blocks are broken.
- Seven parts with the original sizes (head 3x3, body 5x3, tails 2x2, wings 4x2 and 4x3) placed from the ring offsets every tick; wing sweep pushes living entities, the head hurts them for 10 while the dragon is not in its hurt window.
- Block destruction (`destroyBlocksInAABB`): everything except obsidian, end stone and bedrock is removed when `mobGriefing` is on; protected blocks slow the dragon.
- Damage: only parts take hits; non-head parts take dmg / 4 + 1; only a player or an explosion hurts; the base hurt window applies; each part hit re-targets the dragon (3 `nextFloat` draws).
- Crystals: `updateDragonEnderCrystal` finds the nearest crystal within 32 every ~10 ticks, heals 1 HP every 10 ticks, and a destroyed healer hurts the dragon for 10 as an explosion.
- Death: 200 ticks, rising 0.1 per tick, yaw +20 per tick, XP orbs 1000 every 5 ticks after tick 150 and 2000 at 200 (12,000 in total), world event 1018 (`mob.enderdragon.end`), `hugeexplosion` particles from tick 180, then the exit portal (`exit-portal.js` `createExitPortal`) and removal.
- Integration (`src/dragon-mobs.js`): type `ender_dragon` in `ENTITY_TYPES`, `/summon EnderDragon`, `spawnDragonIfAbsent(world, mobs)`, part picking for the player's ray (`entityHit` hook), damage routing, save/restore of the compact state, growl and hurt sounds, blocks edited through `blockEdit` events.
- Rendering (`src/dragon-renderer.js`): ModelDragon boxes and pose, exploding-texture mask during death, additive eyes, crystal beam, boss bar and the seeded additive death rays from the client `RenderDragon` bytecode. The browser keeps a dying dragon’s timer across a save and retains the exit portal after the death finishes.

## Gaps

- The original model geometry and hurt pass have not been replayed. The dragon only ticks while its chunk is ticking. Java Anvil conversion does not preserve the browser’s death timer.
- Arrows, snowballs and other projectiles still use the 16x8 entity box and route to the nearest part; explosions route to the body instead of testing every part.
- The wing sound is a client approximation using `Math.cos` and `Math.random`, not the original's float/Random sequence. The matching `mob/enderdragon/*` sound files are in the manifest.
- Hit random draws (4 floats, plus a double for a player source) were matched against the probe, not read from every code path.
- Item ids 2130-2139 are unused; no drops other than the egg and portal, and the egg is placed by the portal only (the second kill behaviour of the original is not modelled).
