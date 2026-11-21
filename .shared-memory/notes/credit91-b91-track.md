# Batch 91 credit91: a dead body as attacker for pigmen and reinforcements, a dead shooter's arrow on the new body, Thorns, hanging Creative flag, the look of C02 and the bow release

## Summary
- **Pigmen and zombie reinforcements (bytecode-read yg.a, yh.a/c, yq.a, td.bq).**
  - `entities.js` attackEntityFrom: for a hit with `source.deadAttacker` (a respawned placer's TNT, a dead shooter's arrow, a punched fireball) the legacy mobs' entityToAttack (spider, pigman, silverfish, blaze, giant) is the dead body (`deadTargetAt(source)`, `alive: false`, at the body's position), not `ai.player`. td.bq then drops it at the mob's next update, as native.
  - `nether-melee-live.js` pigmanHurt: the pigmen within 32 blocks get the same dead target (yh.c on each; a dead EntityPlayer is still a `yz`, so the anger rolls still run).
  - `callReinforcement(e, by, dead)`: attack target, else revenge, else the dead body, else the living attacker. The reinforcement zombie receives the dead sentinel as its attack target (yq.d(sv) has no life test); the target tasks and AttackOnCollide refuse a dead target.
  - `revenge-target.js` gets `deadTargetAt` (same shape as the existing shooterless-fireball sentinel).
- **A dead shooter's arrow on the respawned body (zc.h 1127-1163, 1065-1100).** Not a self hit natively: the S2B sound test compares objects (`hit != shooter`, the old entity is another object), so the hit sound reaches the player's connection; Thorns (afv.a(victim, shooter)) run on the old body.
  - `server-dispense.js` hitPlayer: the `random.successful_hit` sound is also sent when `a.ownerBody` is set.
  - Thorns of the victim now also run for a player shooter (the port only did it for mob shooters): the shooter takes the damage through `damagePlayer` with the pvp test; for a dead body the damage is refused (sv.a: health <= 0) and only the `damage.thorns` sound plays at the body's position (agj.b plays it unconditionally).
- **Hanging Creative flag.** `tickArrow` passes `(a.ownerBody ?? ownerOf(a)).survival.creative` to `arrowHost`: EntityHanging.attackEntityFrom reads the old EntityPlayerMP's capabilities (the frozen flag in `deadBody`). TNT already used the body (b90).
- **Look of C02 and the bow release.** `simulation.js` queueAttack, queuePvpAttack and queueUse store `clickLook`; the action loop restores the look around every pvp/attack/dig/place/use action. The C02 Knockback/sprint push and the arrow's aim (shootBow reads `p.yaw/pitch`) no longer follow a later C03 of the tick. Interact (animal use) and vehicle clicks read no look, so they are unchanged.

## Evidence
- **Bytecode-read:** yg.a(ro, F) (bm = ro.j(), no life test); yh.a(ro, F) 0-114 and yh.c; yq.a(ro, F) (o(), bT(), ro.j(), d(sv) on the new zombie); td.bq 107-182 (dead bm cleared); zc.h 706-779 (canAttackPlayer/disableDamage), 1065-1166 (afv.a/afv.b, S2B only for `hit != c`); afv.a(sv, sa); agj.b (thorns roll on the victim's Random, damage then sound with no result test); ej queue order (b89 dumps). Scratch dumps in the session scratchpad. No new probe.
- **Port-read:** where the port reads `ai.player`, `brain.attackTarget`, `owner`/`ownerBody`, `arrowHost`, `clickLook`.
- Not executed: the exact tick a dropped dead target leaves a pigman (td.bq is read; the port's creatureActionState already drops `alive: false` targets, executed for the shooterless fireball in b89).

## Verification
- `node --test --test-concurrency=2 src/credit91-b91.test.js`: 6/6 pass; 0/6 with the source changes stashed (entities.js, nether-melee-live.js, multiplayer/).
- Neighbour run, 224 test files naming DedicatedSimulation, server-dispense, nether-melee-live, reinforcement, revenge-target or pigman, `--test-concurrency=2`: 3062 tests, 3061 pass. The one failure (`mpnether3-b63` Nether experience orbs) passes alone on this branch (9/9) and fails alone on the parent commit 94e060855 (8/1): load/timing flake, not caused by this change.
- No full `npm test`, no `npm run build` (no new imports of modules outside src), no browser.

## Found wrong in the batch 90 list
- Nothing wrong. "Thorns read the record" was narrower than the real gap: the server ran no Thorns at all for a player's arrow on a Thorns wearer (only mob shooters); now it does, live shooter or body.

## Follow-ups
- Thrown balls (snowball, pearl, potion) of a dead thrower keep the record: EntityThrowable stores the thrower object, so `hanging.thrown` and the ball's knockback origin should read a body too (leaveBody covers arrows, TNT and fireballs only).
- Arrow Thorns on mob victims (an enchanted mob hit by a player's arrow) are not modelled in `bow.js` (single player too): zc.h calls afv.a for any living target.
- Browser-only: the knockback direction after a quick turn between a C02 and the next C03; the sound of the thorns at a respawned player's old position.
