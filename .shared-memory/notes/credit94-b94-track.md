# Batch 94 credit94: mob Bane rolled once, Thorns' second held visit for a player attacker, a dead body's stash and armour

## Summary
- **Mob melee Bane (entities.js `hitMob`).** The `arthropodSlowness` call no longer passes `equipment[0]` as a separate held item: slot 0 is already in the mob's five-slot list, and afv.b adds `be()` only for an EntityPlayer. One roll, not two.
- **Victim-side Thorns found wrong in the same way, the other direction.** afv.a(victim, attacker) adds the victim's held item after `victim.ak()` when the ATTACKER is an EntityPlayer, so a mob victim holding Thorns is visited twice by a player's melee hit or arrow (each visit its own roll and wear), once by a mob attacker. `armor-enchantments.js thornsReaction` takes `extra`; `thorns-live.js mobThornsOnPlayerHit` and `entities.js thornsOfVictim` take `byPlayer`; passed from the player melee hit (entities.js attack), the single-player player arrow (bow.js victimThorns) and the server player arrow (server-dispense.js mobThornsOnShooter). A mob shooter or the mob-victim hit by a mob stays one visit. The player-victim side (survival.thorns) is armour only unless the attacker is a player (PvP, not changed).
- **Dead body through the Nether/End stash.** A stash is a saved record, which dropped `ownerBody`, so the away run saw ownerless balls and shooterless arrows. `projectiles.js` `saveOwnerBody`/`loadOwnerBody` (position, dimension, Creative flag, held item) are written by `Projectiles.serialize`, `WitchPotions.serialize` and `Arrows.serializeOne` (which also keeps `shooter: "player"`) and read by their loaders. The away run's existing `thrownHit(mobs, ref, ball)` and arrow code then act as the dead body (knockback origin, `deadAttacker`).
- **Single-player dead body's arrow into a Thorns mob (bow.js victimThorns)** used to damage the NEW player; now the body takes none (sv.a refuses at health <= 0) and the sound plays at the body.
- **Dead body's armour.** `server-survival.js deadBody` and `main.js deathBodyHere` copy the armour still worn (empty after dropAllItems, all of it under keepInventory), and `bow.js shooterBane` now reads it (it used to pass null for a body). Observable effect: Bane of Arthropods on the body's arrows. Thorns/armour value on hits the body takes have no effect: sv.a refuses every hit at health <= 0 before armour is read.
- Tests: `src/credit94-b94.test.js` (5).

## Evidence
- **Bytecode-read:** afv.a(sv, sa) (`aload_1 instanceof yz` then victim `be()`), afv.b(sv, sa) (`aload_0 instanceof yz`), sv.ak for mobs = equipment incl. held (credit93 reading).
- **Port-read:** away-entities.js projectileHit/arrowOptions, main.js respawnPlayer/giveDeathBody, server-survival.js leaveBody.
- Not executed: no probe, no JVM run.

## Verification
- `node --test --test-concurrency=2 src/credit94-b94.test.js`: 5/5 pass; with the nine source files reverted 0 pass / 5 fail.
- Neighbour run, 83 files naming thorns, hitMob, ownerBody, WitchPotions, Arrows, Projectiles or serverSurvival, `--test-concurrency=2`: 782 tests, 782 pass.
- `main.js` is not importable in node; its `deathBodyHere` change is read, not run. No full `npm test`, no build, no browser.

## Found wrong in the batch 93 list
- "A body never wears armour on the server": true in the port; with keepInventory natively it keeps it (fixed above), but only Bane on its arrows can observe it.
- Not on the list: the Thorns second held visit for a player attacker (new finding, fixed).

## Follow-ups
- A stashed body is saved to disk with the record: after a reload natively the thrower is looked up by name (the new player, or null in an empty world); the port keeps the dead body. Narrow (dead thrower plus reload).
- PvP: a player victim hit by a player should also visit his held item for Thorns (afv.a); not changed.
- mob-vs-mob `hitMob` never calls the victim's Thorns (yg.n would, afv.a(target, attacker)); not changed.
- Browser-only: nothing checked.
