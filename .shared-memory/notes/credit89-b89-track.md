# Batch 89 credit89: kill credit from the combat tracker, a respawned player's TNT, the punch look, dispensed arrows and snowballs

## Summary
- **Kill credit is sv.aX now, not the last blow (bytecode-read sv.aX, sv.a(ro, F), sv.C, mw.a(ro)).**
  - sv.aX (func_94060_bK) returns rn.c() (the CombatTracker's best attacker), else aR (attackingPlayer), else i (the revenge target).
  - sv.a(ro, F) offsets 208-296: when ro.j() is a yz, aS (recentlyHit) = 100 and aR = it. When it is a tamed wv, aS = 100 and aR = null. When it is any sv, setRevengeTarget runs. This runs for top-up hits too, with no test of the attacker's life.
  - sv.C offsets 417-439: `if (aS > 0) aS--; else aR = null`, before the revenge expiry.
  - `combat-tracker.js` CombatTracker gains `attackingPlayer` and `recentlyHit`. `noteAttacker` sets them, `tick` counts them down, and `fighter()` is `killer() ?? attackingPlayer ?? revenge`. Single player and the server both use this tracker (the server's `p.survival.combat`), so there is no separate server port.
  - `server-survival.js` die() credits `killerOf(p)`: the fighter when it is a player (the self entity gives p.id; otherwise the record's playerId or name). b63 read `lastAttacker`.
  - A killing hit clears the earlier tracker entries (rn.g sees the victim dead; executed in combat-tracker-reference.json). So a fatal fall or fire after a player's hit has rn.c() null and credits him through aR while recentlyHit lasts (100 of the victim's ticks). The text stays the plain one ("fell from a high place" / "hit the ground too hard"). In 1.7.10 the fall-assist texts appear only in previews, never at death. ro.b(sv) (the ".player" variants) reads the same aX, so those texts change with it in single player.
- **A respawned player's TNT (bytecode-read oi.a(mw, int, boolean), ahb.f(sa), oi.a(yz), yz.a(yz, Z), yz.b(sa, int)).**
  - respawnPlayer setDeads the old EntityPlayerMP and builds a new one. Primed TNT keeps the old one as its placer. attackEntityFrom has no test of the attacker's life, so the blast is "explosion.player" by the dead body:
    - the knockback comes from where the body was removed;
    - the held item is the body's (empty after dropAllItems; clonePlayer copies stacks only under keepInventory or on returning from the End);
    - aX() is the body.
  - addToPlayerScore writes the StatisticsFile that oi.a(yz) keys by UUID, the same object the new entity uses. So the kill stats still go to the player.
  - `ServerSurvival.respawn` first calls `leaveBody(p)`. It swaps each of this record's primed TNT (Overworld, Nether and End lanes) to a frozen `deadBody(p)`: position, look, held copy, `dead`, and `corpseOf` pointing at the record.
  - `server-mobs.js` explode sets `ach.attacker = byPlayer.corpseOf` for the achievement/stat credit. `killerOf` resolves the body through fromOf's playerId, which is the record's id.
- **Punch look (bytecode-read ej, nh.a(jd) 625-678, ze.a(ro, F) 14-24).**
  - NetworkManager polls one ConcurrentLinkedQueue in order, so a C02/C07 sees the rotation of the C03 sent before it. ze.a deflects along ro.j().ag() at the hit.
  - `simulation.js` queueEdit/queueDig store `look` (`clickLook`, the record's yaw/pitch when the message arrives). The Nether punch passes it to `punchBall(p, look)`, which reads it instead of `p.yaw` at the action. A later C03 in the same tick no longer turns the punch.
- **Dispensed arrows (bytecode-read zc.b(dh), zc.a(dh)).** EntityArrow NBT has no shooter key ("player" in zc.a is the legacy pickup flag). `server-dispense.js` save() writes arrows without `by`, and load() ignores an old `by`, so a reloaded arrow keeps make()'s null shooter. Balls and potions keep their thrower name, because EntityThrowable writes ownerName.
- **Dispensed snowballs (bytecode-read zj.a, ro.a(sa, sa), rq.j, sv.a(ro, F) 322).**
  - zj.a hits with causeThrownDamage(this, getThrower()), which is `new rq("thrown", ball, thrower)`. rq.j() is the thrower, null for a dispensed ball. So there is no recentlyHit, no revenge and no knockBack (Math.random sets attackedAtYaw instead). A blaze still takes 3.
  - `projectiles.js` thrownHit: when `from == null` (the server's ownerless ball) or `ball.dispensed`, it calls `attackEntityFrom(e, amount, { name: "thrown", projectile: true })`. Before, the dispenser counted as the player.
  - main.js marks dispenser balls `dispensed`. `Projectiles.serialize/load` keep the mark.
  - main.js `thrownAtStruck` passes no player for a dispensed ball's vehicle/hanging hit, so a Creative player no longer breaks the cart without drops.
  - server-dispense ballHit and the ownerless pearl pass null, not the ball.
  - `entities.js` silverfishHurt counts `source.projectile` as an entity source. Every rq is an EntityDamageSource, thrower or not, so an ownerless thrown hit still arms the summon cooldown.

## Evidence
- **Bytecode-read** (`javap -c -p` on tools/research/minecraft-1.7.10.jar; scratch dumps named credit89-*.txt):
  - sv.aX, sv.a(ro, F) 208-322, sv.C 417-439;
  - rn.c, ro.b(sv), ro.a(sa, sa), rq.j;
  - zj.a, ze.a(ro, F) 14-24, zc.b(dh), zc.a(dh);
  - ej (the packet queue), nh.a(jd) 625-678;
  - oi.a(mw, int, boolean), oi.a(yz), ahb.f(sa), mt.f(sa);
  - yz.a(yz, Z), yz.b(sa, int), mw.a(ro), add.b.
- **Executed (existing references):** combat-tracker-reference.json (a fatal hit empties the earlier entries; "fall-after-zombie-none-fatal" gives "Player fell from a high place") and combat-best-reference.json (aX records). No new probe was run.
- **Port-read:** the server already used the single-player CombatTracker for death messages (deathComponent). pvpRules.fromOf carries playerId. Server arrows are made with shooter null by default.

## Verification
- `node --test --test-timeout=600000 src/credit89-b89.test.js`: 9/9 pass. It covers:
  - aX ordering (player, then zombie, then fatal fire names the player);
  - recentlyHit expiry at 100/101 ticks; a tamed wolf clearing aR; a wild wolf;
  - server die(): a punch, then a mob, then a fatal fall gives killer p0 and playerKills; no credit after 103 ticks;
  - a respawned placer's TNT: body position, knockback origin, held null, explosion.player, killer and playerKills on the record;
  - the queued click look and punchBall with the click's look against a later one;
  - arrow save/load without a shooter (including an old `by`);
  - a dispensed / ownerless snowball: no recentlyHit, revenge or knockback, blaze 17, silverfish cooldown 20, a player's ball unchanged;
  - the `dispensed` save round trip; the server ownerless ballHit.
- Old test updated: `src/mpprojectiles-b62.test.js` "projectiles in flight are saved and loaded ..." asserted the arrow's saved `by` and loaded `ownerName`. It now asserts neither, plus a null shooter (b89 comments).
- Neighbours, `--test-concurrency=1`:
  - kill credit, stats, scoreboard and death (19 files): 186/186 pass;
  - projectiles, dispense, fireballs, silverfish, Nether/End and wither (26 files): 339/339 pass;
  - action queue and main.js/simulation.js source scans (34 files): 332/332 pass;
  - `module-names`, `skins73-b73`, `skintex75-b75`, `sounds73-b73`: 54/54 pass.
  - No full `npm test` (track rules).
- `npm run build`: passes (only the usual chunk-size warning).

## Follow-ups
- The mobs' "player" for a dead body's blast (revenge, reinforcements) is still the live record's view. Natively the dead entity is no valid target.
- Arrows in flight and punched fireballs (`punchedBy`) still reference the live record after a respawn. Only primed TNT gets a body.
- aimCell and dig still read `p.yaw` at the action. Only the punch takes the click's look, and it uses the server-moved position.
- `away-world.js` / away-entities dispensed balls (tiles89's files) are not marked `dispensed`. They pass the ball as `from`, which still counts as a player hit.
- java-projectiles import: an ownerless snowball from a Java save is not marked `dispensed`.
- A thrower who logged out (the server's ownerOf null) now gives the ownerless hit. Natively getThrower looks the name up in the world, so this matches only while he is absent.
- Browser-only:
  - the death message and chat text for a fall or fire kill after a PvP hit;
  - the stats / scoreboard screen after a dead body's TNT kill;
  - the punch direction in the Nether when looking around quickly while clicking;
  - a pig or cow struck by a dispensed snowball not jumping away;
  - a cart or painting hit by a dispensed snowball in Creative dropping its item.
