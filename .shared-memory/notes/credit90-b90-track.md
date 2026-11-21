# Batch 90 credit90: a dead body's TNT, arrows and fireballs, the click's look for digs and places, ownerless balls in the away run and the import

## Summary
- **A dead body's TNT: the mobs' attacker is the dead entity (bytecode-read oi.a(mw, int, boolean), sv.a(ro, F), sv.C 465-505).**
  - `server-mobs.js` explode: when the placer is a `corpseOf` body, the AI's "player" is `corpseView(body)` (a PlayerView with `alive = false` at the body's position, survival adapter from the body) and not the respawned record's view. The request carries `deadAttacker`.
  - `explosion-simulation.js` mobRows passes `deadAttacker` in the hit source; `entities.js` attackEntityFrom notes `DEAD_ATTACKER` (`revenge-target.js`, health 0) as the revenge target, so `revengeBrain` is null as sv.C leaves it after the mob's next update. recentlyHit, Looting and knockback still follow the body.
- **Arrows and punched fireballs in flight.**
  - `ServerSurvival.leaveBody` also gives each live arrow with `owner === p` an `ownerBody` (the same frozen body as the TNT) in every lane of the Overworld/Nether/End dispense instances, and swaps `punchedBy` of the fireballs to the body.
  - `owner` stays the record (credit, S2B sound and stats go to the shared StatisticsFile). `bow.js` reads the knockback origin and Looting from `ownerBody ?? owner`, adds `deadAttacker`, and the own-arrow 5-tick skip no longer applies to the new entity. `server-dispense.js` hitPlayer takes the body position. `fireballs.js` adds `deadAttacker` for a body's ball; `ServerMobs.fireballWatch` uses the corpse view and credits `corpseOf`.
- **Block aim and dig look.** `simulation.js` action loop: a queued dig or place (C07/C08) runs with `p.yaw/pitch` set to the look stored at arrival (`clickLook`, b89), restored after. aimCell, edit rays, sign/skull yaw and bucket traces all read that look.
- **Ownerless balls.**
  - `away-world.js` dispenser `thrown` marks the ball `dispensed: true` (as main.js, b89).
  - `java-projectiles.js` import: a Snowball with an empty ownerName gets `dispensed: true`; a named one is unchanged. Export now writes `ownerName: "Player"` for a snowball that is not `dispensed`, otherwise a player's own snowball would come back ownerless after a round trip.

## Evidence
- **Bytecode-read:** sv.a(ro, F) (no alive test of ro.j()), sv.C 465-505 (revengeTarget dropped when isEntityAlive is false), oi.a(mw, int, boolean) (old entity setDead; TNT/arrow/fireball hold the old reference), nh.a(jd)/nh.a(jo) with ej queue order (b89 dumps). No new probe.
- **Port-read:** where the port reads `ai.player`, the "player" revenge sentinel, `owner` and `punchedBy`.

## Verification
- `node --test --test-concurrency=2 src/credit90-b90.test.js`: 5/5 pass; 0/5 with the source changes stashed.
- Neighbour run, 138 test files naming the edited modules, `--test-concurrency=2` in four chunks: 1411 tests, 1409 pass. The 2 failures (`cmd-exec-b83` Ozelot air, `track88-b88` late-viewer S04) pass when those two files run alone on this branch (13/13) and on the parent commit: load-dependent, not caused by this change.
- No full `npm test`, no browser. `npm run build` not run (no new imports or modules).

## Found wrong in the batch 89 list
- Nothing wrong. The batch 89 export wrote `ownerName ''` for a player's snowball; that is fixed here (it only mattered once import started marking ownerless balls).

## Follow-ups
- Pigmen (`ew.ai.player` as entityToAttack) and zombie reinforcements now get the dead view as their target when the body is the attacker; whether native then drops them in exactly the same tick is not run.
- An arrow from a dead shooter that hits the new body of the same player counts as a self hit (pvp rule, `who === p`); natively the shooter is a different entity.
- Creative flag of hanging hosts and thorns read the record for a body's arrow.
- Position of a queued dig/place is still the server-moved position (only the look is the arrival's).
- `use` (item use start) has no stored look.
- Browser-only: knockback direction of a respawned player's arrow and TNT on mobs; digging while turning quickly.
