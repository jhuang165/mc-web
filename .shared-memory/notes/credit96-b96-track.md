# Batch 96 credit96: mob Knockback direction, potion kill Looting, mob-arrow hook audit

## Summary
- **Mob-on-mob Knockback (entities.js `hitMob`).** The held item's Knockback pushed the victim along the direction attacker-to-target. Native yg.n does `addVelocity(-sin(yaw) * i * 0.5F, 0.1, cos(yaw) * i * 0.5F)` on the attacker's own yaw (sine table, Java floats) and then multiplies the attacker's motionX/Z by 0.6. Now identical to `mobKnockbackKick` (the player-victim path). `hitMob` is shared by single player, the server and the ocelot AI.
- **Looting on a potion kill (witch-potions.js `impact`, multiplayer/server-dispense.js).** A player's splash potion kill passed no `looting`, so drops ignored the thrower's Looting. The source entity of a potion is its thrower, so the item held at the moment of death counts (as arrows, explosions and fireballs since b88). Single player reads `survival.held`, the server reads `thrower.held` (new field on the thrower object in `server-dispense.js`), a dead old body its frozen `ownerBody.survival.held`.
- Tests: `src/credit96-b96.test.js` (2).

## Evidence
- **Bytecode-read:** yg.n (knockback on `y` = rotationYaw, `v`/`x` *= 0.6, then fire `e(i*4)`, afv.a(sv,sa), afv.b(sa)); yl.a(sv, F) (Power: `b(e() + i*0.5) + 0.5` as two adds, Punch `a(I)`, Flame or type 1 `e(100)`, `random.bow`); yl.n (type 1 adds Wither 200 ticks); zc.h entity branch (setFire(5) before damage, knockback `aw*0.6/h` and 0.1, `afv.a(victim, shooter)` and `afv.b(shooter, victim)` when the shooter is an `sv`, enderman keeps the arrow).
- **Audit, nothing wrong:** skeleton arrow Power/Punch/Flame (bow.js skeletonShoot, mob-equipment.js bowEffects; the b-mob-equipment arrow records already match executed values), the Power sum order (checked 500k random doubles: `(d + 0.5i) + 0.5` equals the port's `d + (0.5i + 0.5)` every time), the wither skeleton's sword Fire Aspect and Wither effect (entities.js hitPlayer / hitMob), Thorns on a mob arrow's victim (bow.js damageTarget, server-dispense.js hitPlayer), Punch on a player or mob victim.
- No new probe: the real classes need a live world; nothing here was executed.

## Verification
- `node --test --test-concurrency=2 src/credit96-b96.test.js`: 2/2 pass; with entities.js and witch-potions.js reverted 0 pass / 2 fail.
- Neighbour run, 23 files naming hitMob, WitchPotions, witch-potions, mobKnockback or indirectMagic: 244 tests, 244 pass.
- `server-dispense.js` thrower `held` is exercised only by code reading (the test passes the thrower object directly). No build, no full `npm test`, no browser.

## Found wrong in the batch 95 list
- Nothing on the list was wrong. The stashed-thrower item stays open as batch 95 described it (shared `serialize()`; not narrow), so item 3 was not started.

## Follow-ups
- Stashed thrower after a real reload (name lookup): open.
- Wither skeleton: the renderer does not draw the held sword (gap listed earlier, unchanged).
- Browser-only: nothing checked.
