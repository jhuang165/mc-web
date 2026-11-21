# Batch 88 blast88: the server's look at blast time, wither skull and ghast fireball sources, a player's TNT on players, unsaved shooters, Looting from arrows

## Summary
- **The server's look comes from its own copy, taken at the native time (bytecode-read MinecraftServer.v, nh.a(jd)).** MinecraftServer.v ticks each world (mt.b, mt.h updateEntities, the tracker) and only THEN the network (nc.c). So a blast in the world tick reads the rotationYaw / rotationPitch that processPlayer set in the previous tick's network phase. In nh.a(jd), offsets 625-678, the packet's angles go through mw.a(DDDFF) when jd.k(); the sleeping branch keeps the entity's own. The port's `simulation.input()` writes `p.yaw` / `p.pitch` when the message arrives. Now the tick's player loop (its processPlayer) copies them into `p.serverLook` right after the sleep restore. `fireballs.js` `serverLookOf(p)` reads that copy, and `lookOf` uses it for a server player, with `p.yaw` as the fallback. In today's tick order the copy equals `p.yaw` during the world phase. It guards the in-loop order and reads at arrival time.
- **A punched server ball hitting another ball (fixed).** `ro.a(ze, shooter).j()` is the shooter, so a punched ball turns the other ball to the puncher's look. The server path called `hitBall(other, "player")`. With no server `playerLook`, that never deflected. It now passes `b.punchedBy` when that is a server player record.
- **Wither skulls and ghast fireballs as blast sources (bytecode-read zg.a(azu), zp.a(azu)).**
  - Both blasts are plain `newExplosion(null, ...)`, so agw.c() is null: the source is "explosion", with no entity, no knockback from an entity and no kill credit. The port already did this. The explode events have source null; `blast88-b88.test.js` asserts it.
  - **Ownerless skull (fixed).** zp.a(azu) offsets 65-77, with no shooter: attackEntityFrom(ro.k magic, 5) on any entity. The port called `mobs.damage(..., b.x, b.z, ..., { name: "magic" })`, which pushed the mob away from the skull, and it skipped the player. Now a mob takes `mobs.hazard(t, 5, "magic")` (no knockback), and the player takes `survival.damage(5, "magic", false)`. Magic is unblockable and not difficulty scaled. An owned skull still hits for 8, scaled, from the wither and heals it 5 on a kill.
  - **Punched-ball Looting (fixed, bytecode-read sv.a(ro), afv.i).** onDeath takes Looting from ro.j() when it is a player, using the item he holds at the death. A punched fireball's mob kill rolled 0. It now passes `getLootingModifier(held)` from the puncher: the server record's survival, or the single-player survival.
- **A player's TNT on players (fixed; bytecode-read ro.a(agw), rp.r(), mw.a(ro,F), mw.a(ro), yz.b(sa,int)).**
  - ro.a(agw) is rp "explosion.player" with agw.c() as its entity when that is non-null, and plain "explosion" otherwise.
  - rp.r() (isDifficultyScaled) is true only for a living entity that is not a yz player. Plain ro.r() returns field v, which explosions set.
  - Server, `server-mobs.js` explode: the player row used to hurt with `from: ev.source` (the TNT entity), unscaled, under the reason "explosion", which the combat tracker does not know. Now `blastFrom` is `pvpRules.fromOf(placer)` for a player's TNT, or the living exploder (a creeper or the wither), or null.
  - A player's TNT is `s.damage(..., 'explosion', blastFrom)`: unscaled, the death message is death.attack.explosion.player with the attacker, the knockback comes from the placer, and the killer gets playerKills.
  - The rest is `scaledDamage` with the living exploder as `from`.
  - With pvp off (mw.a(yz)), a player's TNT is refused, his own included. The doExplosionA push still applies.
  - **Self kill (fixed).** yz.b(sa,int) adds playerKills for a yz victim with no self test, and aX() is the player himself after his own TNT. `server-survival.js` die() now adds playerKills to the victim when killer === p.id. The death event still carries no `killer` for a self kill.
  - Single player, `explosion-simulation.js` applyExplosion: the player's own TNT was the plain, difficulty-scaled "explosion". It is now unscaled `survival.damage(..., "explosion", own position, { self: true })`. A creeper's or wither's blast and the plain blast are still scaled.
- **Coincident knockback terminates.** A self hit (his own TNT) puts the attacker on top of the player, and with a constant stub random, the nudge loops in `player-knockback.js` knockBack and `death-throw.js` relativeAngle never ended. Both are now capped at 1000 rolls and then fall back to dx = 0.01. A real random leaves the loop in its first rolls, so live behaviour is unchanged.
- **Shooter saving (fixed; bytecode-read ze.b(dh) / ze.a(dh), sv.b(dh)).** EntityFireball writes xTile, yTile, zTile, inTile, inGround and direction (zg adds ExplosionPower), never the shooter. The browser save kept `owner` (a mob id or "player"), and `load` restored it. Now neither does, so a loaded ghast, blaze, wither or punched ball is nobody's, and an old save's `owner` is ignored. Mob revenge and recentlyHit were already transient, which matches sv.b(dh): it saves neither the revenge target nor recentlyHit. `punchedBy` is a runtime field and is not saved.
- **Arrow Looting (fixed; bytecode-read sv.a(ro), afv.i, ro.a(zc, sa)).** The arrow source's getEntity is the shooter. A player's arrow kill now takes Looting from the item he holds at the moment of the hit (`a.owner?.survival` on the server, `ctx.survival` in single player). It was 0 for every arrow. A skeleton's arrow stays 0.

## Evidence
- Bytecode-read (`javap -c -p` on the 1.7.10 jar):
  - The server tick: MinecraftServer.v (world ticks before nc.c).
  - Look handling: nh.a(jd) offsets 625-678 (setPositionAndRotation; the sleeping branch).
  - Damage sources: ro.a(agw), agw.c(), rp.r(), ro.r() (field v), ro.a(zc, sa).
  - Player damage and death: mw.a(ro,F) (pvp test), mw.a(ro) (onDeath, aX()), yz.b(sa,int) (addToPlayerScore, no self test).
  - Projectiles: zp.a(azu) offsets 65-77 (the magic branch with no shooter; the heal branch), zg.a(azu), ze.b(dh) / ze.a(dh).
  - Mob death and saving: sv.a(ro) (onDeath Looting from ro.j()), afv.i (getLootingModifier on the held item), sv.b(dh).
- Port-read: `simulation.input()` writes the look at arrival. tick() runs the player loop, then the actions, then the world (dispense, mobs), with the Nether after. ServerSurvival.die picks the killer from `lastAttacker`, and pvpRules.fromOf builds the isPlayer source.
- Executed: only the port's own tests. No new native probe ran this batch; BlastOrderProbe was not changed.

## Verification
- `node --test --test-concurrency=1 --test-timeout=600000 src/blast88-b88.test.js`: 11/11 pass. It covers:
  - the serverLook snapshot and its fallback;
  - punchedBy deflection and Looting;
  - the ownerless and owned skulls;
  - PvP TNT (message, attacker, killer, playerKills); pvp off; a self kill;
  - unplaced TNT and the creeper source; single-player own TNT;
  - knockback termination under a constant random;
  - no saved fireball owner;
  - arrow Looting [3, 2, 0].
- Old test updated: `src/projectile-nbt.test.js` asserted the shooter round trip (saved owner 'mob-7', a loaded skull owner 'player'). It now asserts no saved owner and null after load (b88 comments).
- Neighbours, `--test-concurrency=1`. The list: every test that imports or names an edited module, or matches explosion.player / punchedBy / playerKills / serverLook, plus the simulation.js tests that touch explode / fireball / TNT / pvp / skull / wither.
  - First 60 files: 630/630 pass.
  - Next 54 files: 596/596 pass.
  - Source scans (`module-names`, `skins73-b73`, `skintex75-b75`, `sounds73-b73`): 54/54 pass.
  - No full `npm test` (track rules).
- `npm run build`: passes (only the usual chunk-size warning).

## Follow-ups
- `server-dispense.js` restores an arrow's shooter by `ownerName`, but native zc NBT has no shooter (console88's save code).
- `projectiles.js` thrownHit treats a dispensed snowball as a player hit.
- ServerSurvival.die takes the killer from `lastAttacker`, not aX() / the CombatTracker's best attacker. An earlier player hit followed by a fall still credits only the last source.
- A respawned placer's record is reused, so a TNT placed before death credits the new body. Natively the old dead entity keeps its own position and look.
- `punchBall` (C02) still reads `p.yaw` at the action. The client sends its look right before a click (main.js), so a native C03-then-C02 order within a tick is not modelled.
- Browser-only:
  - how the knockback looks when a player's own TNT nudges him;
  - the death message and chat text for a PvP TNT kill;
  - the scoreboard / stats screen after a self kill;
  - a reloaded ghast fireball no longer sparing its ghast;
  - the drops from a Looting arrow kill.
