# Mob movement (1.7.10)

Ports the ground/water motion of `EntityPig` [wo], `EntityCow` [wh] and `EntityZombie` [yq] in `src/entities.js`. Evidence: `tools/probes/MobMoveProbe.java` replays the unchanged classes on constructor-less entity/world doubles (flat stone floor, optional wall at z >= 2) and `tools/verify-mobmove.mjs` writes `mobmove-reference.json` (18 scenarios, per-tick position, motion, flags and limb swing). `src/entities.test.js` replays every tick through the JavaScript port and requires exact agreement (floats via `Math.fround`).

## Ported

- `EntityLivingBase.moveEntityWithHeading` [sv.e(FF)]: land friction `0.91 * slipperiness` of the block at `floor(minY) - 1` (only while on the ground, else 0.91); ground acceleration `aiMoveSpeed * 0.16277136 / friction^3`, 0.02 (`jumpMovementFactor`) in the air; `Entity.moveFlying` [sa.a(FFF)] with the MathHelper sine table; gravity 0.08 then x0.98; horizontal x friction. In water (AI mobs, `isAIEnabled`): accel 0.04 (not 0.02), x0.8 on all axes, -0.02, and a 0.3 climb out when blocked at the surface. Not ported: lava, ladders, water currents, ice.
- `Entity.moveEntity` [sa.d]: y, x, z axis order against block boxes, `stepHeight` 0.5 with the retry-and-revert rule, `onGround`/`collidedHorizontally`, motion zeroed on blocked axes, float width/height.
- `EntityLivingBase.jump` [sv.bj]: motion Y 0.42. Mobs hop when blocked on the ground (replaces pathfinding).
- Speeds: `movementSpeed` attributes pig 0.25, cow 0.2, zombie 0.23 (baby zombie +50 %, operation 1); `EntityLiving.setAIMoveSpeed` [sw.i] = attribute x task multiplier and also sets `moveForward`, which the tick scales by 0.98. Multipliers: wander 1.0 (vc), mate 1.0 (ua), panic pig 1.25 / cow 2.0 (uz), tempt pig 1.2 / cow 1.25 (vk), follow-parent pig 1.1 / cow 1.25 (uh), zombie chase 1.0 (us).
- `EntityLivingBase.knockBack` [sv.a(Entity, F, DD)] as exported `knockBack(e, fromX, fromZ)`: knockbackResistance roll, halve motion, subtract 0.4 along the attacker direction, `vy = vy/2 + 0.4` capped at 0.4. `addVelocity` [sa.g] is exported too. `EntityWorld.attack` takes an `extraKnockback` argument for the player's sprint/Knockback enchantment push (`player.yaw`); `src/main.js` does not pass it yet.
- Fall damage: `ceil(distance - 3)` on landing (`sv.b(F)`).

## Settled limbSwingAmount (60 ticks of walking)

| Mob and AI | multiplier | amount |
| --- | --- | --- |
| pig wander | 1.0 | 0.540 |
| pig tempt | 1.2 | 0.777 |
| pig panic | 1.25 | 0.843 |
| cow wander | 1.0 | 0.345 |
| cow panic | 2.0 | 1.0 (cap) |
| zombie chase | 1.0 | 0.457 |

## Gaps

- No `EntityMoveHelper` 30 degree yaw limit and no `EntityLookHelper`; `e.yaw` still turns instantly.
- No pathfinding: the hop-or-turn heuristic stands in for `PathNavigate`.
- No lava, ladder, ice or flowing-water currents; fall sound and particles omitted.
- Zombies no longer flee when hit (the old simplified flee was not in the original).
