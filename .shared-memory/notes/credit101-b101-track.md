# Batch 101 credit101: indirect kill credit (jockey arrows, skeleton/pigman source entities, deflected fireball on a player, own splash)

## Summary
- **Item 1, spider jockey skeleton's arrow: credit already native (no change for the arrow itself).** rq("arrow", arrow, shooter): `ro.j()` is the shooter, so credit, message, killed-by stat and revenge target are the skeleton, never the spider. The port passes `shooter` (bow.js damageTarget) and `sourceEntity` returns it; yg.a's "not my rider / mount" test is present (entities.js); mob victims get no recentlyHit (no XP) from a mob source.
- **entities.js `onDeath` (found and fixed):** the creeper's music disc was keyed on `source.attacker === "skeleton"`, a string only the arrow path sets. A skeleton's melee, a wither skeleton's arrow or melee gave no disc. Native `xz.a(ro)`: `ro.j() instanceof yl` (EntitySkeleton, the wither skeleton too). Now keyed on the source entity type (shooter, else attacker object, else the arrow's type name). Same lookup makes a pigman's villager kill convert (yq.a(sv) is inherited by yh, which declares none).
- **fireballs.js `impact` + server-mobs.js `fireballWatch`/`useHit` (found and fixed):** a deflected large ball (owner "player") hitting a player was an "onFire" source with the ball: no puncher in the message, no killer. Native ze.a(ro, F) stores the puncher as shooter, zg.a hits with `ro.a(ze, shooter)`. Single player: `{ self: true }` (fireball by himself). Dedicated server: `playerBallHit` goes through `damagePlayer` with `pvpRules.fromOf(puncher)` (message, killer, playerKills, and the PvP-off refusal of mw.a(ro, F)). A mob-owned ball is unchanged.
- **witch-potions.js (found and fixed):** the single player's own harming splash on himself was plain "magic"; native Potion.affectEntity gives a non-null thrower `ro.b(target, thrower)` (indirectMagic by the thrower, also the target itself). Passes `{ self: true }` (server path `splashPlayers` already passed the thrower).
- **Item 2 closed native, no code:** chicken jockey zombie hit (EntityDamageSource "mob", entity the zombie; riding changes nothing); blaze ball (zi.a: causeFireballDamage(ball, shooter), combat-tracker handles shooter / ownerless); ghast ball kill of a mob by a puncher (credit, looting: b88); large ball explosion has a null exploder (zg.a, bytecode-read: `newExplosion(null, ...)`), so the port's "world's explosion" is right; witch potion on a mob: attacker is the witch (indirectMagic, revenge target the witch, no XP).
- Tests: `src/credit101-b101.test.js` (6).

## Evidence
- **Executed (port probe):** before the fix a skeleton's melee, a wither skeleton's arrow and melee gave 0 discs, the skeleton arrow 1 (/tmp probe over EntityWorld.attackEntityFrom). Not an executed run of the real classes: needs a world.
- **Bytecode-read:** xz.a(ro) (`ro.j() instanceof yl`, ade.cd + nextInt(ade.co - ade.cd + 1)); yl extends yg and is the wither skeleton's class; yq.a(sv) (Normal: nextBoolean, Hard: always, only for yv) and yh has no `(sv)`; ze.a(ro, F) (look vector into motion and acceleration, 0.1x, shooter field set when ro.j() is an sv); zg.a(azu) (damage `ro.a(ze, shooter)` 6.0 then `newExplosion(null, ..., mobGriefing)`); rv (Potion) 98-150: `ro.b(target, thrower)` for a thrower, `ro.k` (magic) for none.
- **Port-read:** bow.js damageTarget, revenge-target.js sourceEntity, entities.js TARGETS_ATTACKER, combat-tracker.js damageSource, server-dispense.js splashPlayers.

## Verification
- `node --test --test-concurrency=2 src/credit101-b101.test.js`: 6/6; with entities.js, fireballs.js, witch-potions.js, server-mobs.js reverted: 3 fail (disc, pigman, deflected ball) and, reverting witch-potions.js alone, the splash test fails (the other tests pass).
- Neighbour run, 60 files (fireballs, blast, blaze-ghast, credit89-101, creeperwitch, mpball/mpprojectiles2/mpwither, witch, mobrec, deathdrops, mpmobs, combat, away-mobs, hurt-drops, pots82, mpvillage, note-jukebox, player-damage, b64-lead): 936 tests, 936 pass. No build (no new imports in browser modules), no full npm test, no browser.

## Found wrong in the batch 100 list
- Item 3 (killed by a mob ridden by another mob) was open; the arrow path is native, the real gaps were the source-entity type tests above.

## Follow-ups
- A deflected ball's hit on a player in single player after the 25-tick grace is code-read plus the Survival test only (no ball-flight test).
- Death message of the self-fireball / self-splash uses the existing tracker (`entity.self`); wording was not executed against the real lang table here (existing credit tests cover the keys).
- Browser-only: nothing checked.
