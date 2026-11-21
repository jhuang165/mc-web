# Batch 92 credit92: a dead thrower's balls and pearls keep the old body, arrow Thorns on mob victims

## Summary
- **Thrown balls keep the old EntityPlayerMP (bytecode-read zk.j, zk.h, zj.a, zm.a, oi.a(mw, int, boolean)).**
  - `projectiles.js` thrownHit: a ball with `ownerBody` takes the knockback origin from the body's position and adds `deadAttacker` (mobs store a dead target, dropped at their next update, as for arrows and TNT). `step`: the thrower skip of the first five ticks does not apply to a ball whose thrower body is gone (zk.h compares the stored object, the new player is another one).
  - Server: `ServerSurvival.leaveBody` also gives each live ball and potion with `thrower === p` an `ownerBody` (all lanes of the Overworld/Nether/End instances). `server-dispense.js` `throwerBody` also creates the body for a thrower who is dead and not yet respawned (the old entity is the same object, lying dead). `ballHit`, hanging hits (frozen Creative flag), potion splash origin and the thrower skip read it.
  - Pearl: the old entity's connection is open and its world is where it was removed, so the pearl does teleport, through `nh.a(DDDFF)` whose entity (`nh.b`) is the NEW player. The fall reset and the 5 fall damage land on the old entity (refused, health <= 0). So the new player moves, keeps its fallDistance and takes no damage. A thrower dead and not yet respawned is also moved now (the old code skipped it). The dimension test uses the body's dimension.
  - Single player: `respawnPlayer` (main.js) gives every non-dispensed ball in `projectiles.balls` a body frozen at the death position; the hit origin, Creative flag, pearl hit and `pearl-player.js` (no fall reset, no 5 damage, riding false) follow it.
- **Arrow Thorns on mob victims (bytecode-read zc.h 1065-1088, afv.a(sv, sa), thorns-live.js).** `EntityWorld.thornsOfVictim` (entities.js, also used by the melee hit now) runs the mob's equipment Thorns. `bow.js` `victimThorns` after a landed arrow on a living mob (not dragon parts or crystals): a player shooter takes the damage via `ctx.survival` (single player) or `ctx.thornsOnShooter` (server: `mobThornsOnShooter`, damagePlayer with the mob as source; a dead body only hears the sound at its position); a mob shooter takes it through `attackEntityFrom`.
- Tests: `src/credit92-b92.test.js`.

## Evidence
- **Bytecode-read:** zk.j (name lookup only when the field is null), zk.h skip test, zj.a, zm.a (j() instanceof mw, nh.b().d(), mw.o == o, sv.a(DDD), sv.R, sv.a(ro.h, 5)), mw.a(DDD) -> nh.a(DDDFF) (moves `nh.b`), oi.a(mw, int, boolean) (new entity takes `mw.a`), nh 1985-2053 (`nh.b = respawnPlayer(...)`), zc.h 1065-1100 (afv.a(victim, shooter) whenever the shooter is an sv, inside the landed-damage branch), afv.a/afv.b bodies, thorns-live.js header (callers scan). Subclasses of zk: zj egg, zl snowball, zm pearl, zn potion, zo exp bottle.
- **Port-read:** where the port reads the record (`ownerOf`, `targets`, `pearlImpact`, `thrownHit`, main.js projectile hooks).
- **Not executed:** no probe; no JVM run of the dead-thrower pearl (the open-connection / same-world reading is bytecode).

## Verification
- `node --test --test-concurrency=2 src/credit92-b92.test.js`: 7/7 pass; with the source reverted 1 pass / 6 fail for the server-ball tests and 4/3 for the bow.js part reverted alone.
- Neighbour run: see the lead message (files naming thrownHit, pearl-player, server-dispense, DedicatedSimulation, bow.js, thorns, Arrows).
- No full `npm test`, no `npm run build`, no browser.

## Found wrong in the batch 91 list
- "Arrow Thorns on mob victims are not modelled" was right; additionally the melee side already existed (thorns-live.js). Mobs do get enchanted gear natively (enchantEquipment), so Thorns mobs are reachable without NBT.

## Follow-ups
- A ball thrown before a dimension change also holds the old EntityPlayerMP (transferPlayerToDimension builds a new entity); the server record is reused there and single player does not mark it. Same for balls in a Nether/End stash when a single-player death happens there (`respawnPlayer` runs after `leaveByDeath`).
- Single player does not mark thrown potions/exp bottles; arrows of a dead shooter in single player are still not given a body.
- `afv.b(shooter, victim)` (the shooter's Fire Aspect / Bane on armour or held item for an arrow hit) is not modelled.
- A pearl hitting the old body's old riding state is treated as not riding.
- Browser-only: sound at the old position, S08 timing of a dead thrower's pearl.

## Neighbour run result
- 105 files naming thrownHit, pearl-player, server-dispense, DedicatedSimulation, bow.js, thorns, leaveBody or Arrows, `--test-concurrency=2`: 2101 tests, 2100 pass at first. The one failure (`spexec79-b79` server pearl landing) was a stub host without the new `throwerBody` helper, not behaviour; the stub got `throwerBody: () => null` (the only old test touched) and the file now passes (with credit92: pass counts above).
