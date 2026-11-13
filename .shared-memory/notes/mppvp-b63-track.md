# Batch 63 mppvp: player versus player on the dedicated server

## Summary
- `src/multiplayer/server-pvp.js` (new): `ServerPvp` (`enabled`, `allows`, `inReach`, `attack`) and `pickPlayer` (client aim). The attack follows NetHandlerPlayServer.processUseEntity and EntityPlayer.attackTargetEntityWithCurrentItem: reach (below 36 squared, below 9 without line of sight), weapon attribute damage, Sharpness, crit x1.5, Knockback and sprint push, attacker motion x0.6 and sprint cleared, Fire Aspect, Thorns, hurt window, armour/Protection, weapon and armour wear. Creative victims are immune.
- `src/multiplayer/simulation.js`: `pvp` option (default true), `queuePvpAttack`, a `pvp` action in the action loop, and one check in `damagePlayer`.
- `src/multiplayer/server-survival.js`: `p.inWater` stored each tick (crit test); the `death` event carries `killer` (player id) when a player's blow was the last hit. The existing death message is "X was slain by Y".
- `server/server.js`: `pvp` option, `--pvp` / `MC_WEB_PVP`, handler for `attackPlayer`.
- `src/multiplayer/client.js`: `attackPlayer(player)`. `src/main.js`: aim at another player and send the attack (short hooks).
- Probe `tools/probes/PvpAttackProbe.java`, `tools/verify-pvp.mjs`, `public/research/pvp-reference.json` (69 records, tag b63pvp); `PlayerDamageProbe.java` gained a `playerClass` hook.
- Wire: client message `attackPlayer {player}`. Server events (in `sim.events`, unknown types ignored by ServerSocial): `pvpHit {id, victim, damage, dealt}` for mpstats; `death` gains `killer`.
- pvp=false: melee is refused in `ServerPvp.attack`; `damagePlayer` refuses any damage whose `source.from` is another player, so player arrows and potions also do nothing (the mpprojectiles2 item). Self-damage is not blocked.

## Evidence
- Executed: all 69 attack records from the unchanged 1.7.10 classes (tools, Sharpness, Smite/Bane add nothing against players, Knockback, Fire Aspect, sprint, crits, armour/Protection, hurt-window pairs, creative, lethal, yaw) replayed by the test.
- Bytecode-read: player attackers are not difficulty scaled; reach thresholds; isPVPEnabled / canAttackPlayer.
- Recalled: the "was slain by" text (already in deathComponent).

## Verification
- `node --test src/multiplayer.test.js src/mpsurvival-b58.test.js src/mphealth-b60.test.js src/mphealth2-b61.test.js src/mpprojectiles-b62.test.js src/serverbroadcast-b58.test.js src/b62-lead.test.js src/b61-lead.test.js src/mpnether2-b62.test.js src/mpmobs2-b60.test.js src/pvp-b63.test.js`: 89 pass, 0 fail (pvp-b63 has 13 tests).
- `node --check` on every touched JS file. `npm run build` succeeded.
- Full npm test not run (batch rule). No browser checks.

## Follow-ups
- Browser check: aiming at another player and the swing/hurt animation on the victim client.
- The victim client's knockback and the `pvpHit` statistic are not consumed yet (mpstats). Arrow kill credit lives in mpprojectiles2.
- Bow and potion paths rely on `source.from` being set to the shooter.
