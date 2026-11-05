# Wither boss (Minecraft Java 1.7.10)

Not full parity. Evidence: `tools/probes/WitherBossProbe.java` runs the unchanged EntityWither (`xc`), EntityWitherSkull (`zp`) and EntityFireball (`ze`) on the MobMoveProbe world double; `tools/verify-wither-boss.mjs` writes `public/research/wither-boss-reference.json` (record counts: facts 1, spawnStart 2, spawn 440, headPos 4, launchEntity 2, launchCoords 4, skullStart 2, skullFlight 60, skullImpact 9, skullBlast 24, skullProps 1, hurt 3, armored 6, drops 4, nbt 1); `src/wither-boss.test.js` checks the port against it.

## Behaviour

- Construction: soul sand T plus three wither skulls calls `spawnWither`: Invul 220, health max/3 (100), +10 health every 10 ticks, size growth, then a power 7 explosion at the eye height and the `mob.wither.spawn` broadcast (level event 1013). During the countdown nothing else runs (probe: `xc.bn`).
- EntityWither: 300 HP, 0.9 x 4, flying chase (motionY * 0.6, climb to 5 blocks above the target while unarmoured), three heads (centre follows the attack target, side heads pick their own targets), 1 HP regeneration per 20 ticks, armour phase at or below 150 HP that rejects arrows, armour value 4, undead, immune to fire, drowning and falls, rejects undead attackers, blockBreakCounter sweep (3x4x3 around it, skipping bedrock, end portal, frame and command block), nether star drop (2060) and 50 XP.
- EntityWitherSkull: black and blue (0.3125 box), motion factor 0.95 / 0.73, explosion power 1 without fire, the blue skull caps block resistance at 0.8 except bedrock, end portal, frame and command block, wither effect 10 s on Normal and 40 s on Hard, 8 damage, heals the shooter 5 on a kill.
- Rendering: ModelWither (three heads, shoulders, spine, tail), wither.png, wither_invulnerable.png flashing in the last 80 spawn ticks, growth scale, scrolling armour layer below half health, skull billboard, fullbright.
- `src/boss-bar.js`: reusable `setBossStatus(entity, name)` (health / max, 100 frames), a DOM bar from `icons.png` with its own animation loop; the dragon track can call it.
- `/summon WitherBoss` with `Invul`; the region export writes `WitherBoss` with an Invul int and the importer restores it.

## Evidence

- Probe-run (unchanged classes): facts, spawn countdown and explosion/event, head positions, skull launch positions and aux 1014, skull flight, skull impact explosion, block resistance, hurt rejections (invulnerable, drown, armoured arrow), armour threshold, drops, Invul NBT.
- Bytecode-derived (`javap -c -p xc`, `xc.bn`/`xc.e`, `zp.a(azu)`, `bpc`, `bin`, `bln`, `bbv`): head cadence (10 + rand 10 ticks, random shots every 16th on Normal/Hard, 40 + rand 20 after a targeted shot), target selection, head tracking (40 / 10 degrees), block breaking, regeneration, the wither effect and damage values, model boxes, boss bar layout.

## Gaps

- `xc.bn` after the invulnerable phase and `xc.e` flight call the full EntityMob stack, so they are bytecode-derived, not probed; the port runs it as the Brain's updateAITick (after the navigator, before the move helpers), not after all of super.bn.
- Skull impact damage was probed only on a 6 HP bat (cap), the effect duration and the 8 damage are bytecode-derived; the shooter heal is not probed.
- Target candidate order and the wither effect's damage over time on non-player mobs are not Java's / not ticked in this engine.
- Skull model orientation is approximate. Missing: spawn snow particles, the kill-Wither achievement, head particles, wither-specific hurt sounds beyond the base set.
- Not browser-checked in this track (no dev server was started).
