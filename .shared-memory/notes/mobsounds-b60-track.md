# Batch 60 mobsounds: the living sound roll and onLivingUpdate draws on every client copy

## Summary
- `src/copy-talk.js` (new): `copyLivingRoll(c, m)` draws EntityLiving.onEntityUpdate's `nextInt(1000) < livingSoundTime++` on the copy's own Random for every living copy except horse (horse-copy.js), squid (entities.js, already) and dragon / crystal (own code). A hit sets livingSoundTime = -talkInterval (120 for pig, cow, mooshroom, sheep, chicken, wolf, ocelot, both golems and squid; 80 for the rest) and draws the living sound: nothing for creeper, giant, slime, magma cube; wolf nextInt(3) (not angry), tamed ocelot nextInt(4) (not in love), bat nextInt(4) while hanging; then two floats (pitch). A dead copy rolls nothing. `copyLivingUpdate(c, m)` draws onLivingUpdate's particle draws: enderman 12 doubles (+ nextInt(100) while its copy screams), blaze nextInt(24) (hit: 2 floats) + 6 doubles, wither 9 gaussians, slime / magma cube landing size*16 floats (+2 for the land sound: magma always, slime above size 2). Positions of those particles are not made (the live path shows them).
- `src/entities.js` (3 lines): import; `clientEnvironment` calls `copyLivingRoll` after the squid branch; `clientAfterMove` calls `copyLivingUpdate` first.
- `src/entity-tracker.js` (1 line): `ClientEntity.step` sets `this.gone = this.deathDone` before the death update (a removed copy draws no onLivingUpdate part; the burst tick itself still does, as native). ClientEntity API unchanged; `c.rand` is made lazily by death-fx.js `deathRandom`.
- `tools/probes/MobSoundsProbe.java`, `tools/verify-mobsounds.mjs`, `public/research/mobsounds-reference.json` (tag b60ms): 28 mobs x (`update` = sv.C, `full` = sv.h), 400 ticks.
- `src/mobsounds-b60.test.js`: 108 tests.

## Evidence
- Executed: the unchanged mob classes (EntityList.createEntityByName) on a client world double with a logging Random: per-tick draws, sounds, particles, onGround. Talk intervals (sw.q) read from the classes. The port replays every tick's draw string exactly for 26 mob types (squid and horse excluded: own tests).
- Bytecode-read (javap ya, xc): enderman `isScreaming && !isAggressive && nextInt(100) == 0` (bv is isAggressive, server only); wither smoke loop = 3 heads x 3 nextGaussian on the entity Random (the armoured `nextInt(4)` uses the world Random); the invulnerable-spawn mobSpell loop (also nextGaussian) is not ported.
- Recalled: nothing new. Native hit with a null living sound (creeper, giant, slime) draws nothing: seen in the record (roll only).

## Verification
- `MC_RESEARCH=/Users/programming-xcode/Desktop/mc-web/tools/research node tools/verify-mobsounds.mjs` (56 records).
- `node --test src/mobsounds-b60.test.js`: 108 pass. Tracker, death-fx, horse, squid, dragon, entities, vehicle tests: 590 pass. Away, ride, damage-fx, fx, combat, enderman, blaze, slime, wither, wolf, squid-bat tests: 529 pass. 0 fail. `npm run build`: ok. Full npm test not run (batch rule). No browser check.

## Follow-ups
- Gap "Mob deaths: only the horse copy draws the living-sound roll" is closed for the roll and for the onLivingUpdate draws above. Not executed: the probe world has no water, so the splash on entering water (only squid does it) and drowning-air draws on other copies are still missing; the wither's spawn charge (invulnerable time > 0) draws; zombie-villager / witch / wolf shaking status particles (client status packets, not per tick).
- The probe's enderman screamed after a fall (fall damage on the client double); the copy follows the live `screaming` flag instead of a real watcher 18 from S1C.
- Slime size comes from the live mob; slime landing relies on the copy's onGround from its own physics (not probed against a real floor contact order).
- Browser could show: nothing visible changes (draws only); a visual check of death poof positions would only differ if the stream was previously off.
