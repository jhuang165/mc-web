# Batch 85 convert85: zombie-villager conversion and squid push, replayed against executed records

## Summary
- Live conversion (`entities.js cureZombie`): yq.cd spawns the villager at once and it joins the walked list, so it ticks in the same pass (`tickOrder.push`); the villager's new-entity seed comes from the record (`entitySeed(v, "cured")`). The converted zombie draws no ambient `nextInt(1000)` roll (sw.C gates it on isEntityAlive), so `talk` is skipped while `curedLive === e`.
- Converting corpse: a corpse whose timer ends converts the same way and its whole `dying` update runs (experience at deathTime 20 in that update); the old b82 `convertedCorpse` shortcut (skipped the rest of the update) is deleted. A corpse that reached deathTime 20 first is removed and never converts.
- Zombie killed by its own fire in the converting update: its row keeps the post-kill health (0) (`remarkCured` now stores `removedHealth = health` unconditionally); drops and orbs follow the normal kill.
- Squid push (sv.bo, ahb.b(sa, azt), Entity.o): the live port path (`squid-bat-mobs.js` `m.push`, `EntityWorld.push`, `pushServerPlayer`) already matched the records; no port change needed.
- Villager-to-zombie conversion (EntityZombie.onKillEntity) is covered by the b31-b41 village-fight records (not re-recorded).

## Evidence
- Executed: `tools/probes/VillageFightProbe.java` b85 scenarios (23 records -> `public/research/village-fight-b85-reference.json`, via `VF_PREFIX=b85- tools/verify-village-fight.mjs`): conversion ending at tick 1/12/30 (3 seeds), hard difficulty, a corpse converting at deathTime 0/1/3/10/19 (k20 and k24 are removed first), corpse hit by a player and by a mob, fire kill in the converting update (hit, no hit, early). New ops `zvillager`, `convert`, `fire`; the villager spawn drain, loot list (`loot`: items and orbs per tick) were added. `tools/probes/SquidPushProbe.java` (`tools/verify-squid-push.mjs` -> `public/research/squid-push-reference.json`, 7 records): pairs at four offsets and three squids (40 ticks), one squid beside a stub player (30 ticks, player motion).
- Bytecode-read (javap on the 1.7.10 jar): yq.cd, yv.a(sy), sw.C, sv.bo, sa.e(int) (setFire).
- Port-read: everything else (replay plumbing, `tickOrder`, `remarkCured`).

## Verification
- `node --test src/convert85-b85.test.js`: 23 b85 records plus coverage test, pass. `src/squid-push-b85.test.js`: 7 pass.
- Neighbours (corpse80-83, mobs84, zombie-villager*, squid-bat*, village-fight*, convert85, squid-push): 304 pass, 0 fail; java-mobs, mpvillage-b66, saved-order2-b53: 33 pass. `npm run build` ok. No full `npm test`, no browser.
- Test notes: the squid test compares each squid's motion only for the last squid (the probe logs a squid right after its own update, before later squids push it), stops a record when the port's block-based squid water test (ws.H box, expand(0,-0.6,0)) leaves the water column (the probe world is wet at every height), turns the player's own tick off (`unticked`, the probe never ticks it) and puts the stub's box 1.62 below its y (yz yOffset). Float-exact damages (20.75) are needed in fire scripts because the replay parses `Number("20.9")` as a double.
- Old behaviour changed: the b82 `convertedCorpse` shortcut (corpse82 note); the b84 note's fire follow-up is now done.

## Follow-ups
- Squid against a boat is not recorded (earlier boat push records cover boats); a squid and a ticked player together (both push) is port-read only.
- Browser-only: how the converted villager and the corpse's death animation look on the same frame, and squid push seen in play.
