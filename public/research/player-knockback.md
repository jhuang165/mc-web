# Player knockback and attribute effects (1.7.10)

Evidence: `tools/probes/PlayerKnockbackProbe.java` run by `tools/verify-player-knockback.mjs` against the real 1.7.10 classes (`javap -c -p` read first). Output: `player-knockback-reference.json` (827 records: melee 600, golem 72, arrow 72, blast 64, attrs 19). `src/player-knockback.test.js` replays it. This is not full parity.

## Formula (`EntityLivingBase.knockBack`)
- Skipped if `rand.nextDouble() < knockbackResistance` (player: 0).
- Motion is halved on all axes, then `vx -= dx/len*0.4f`, `vy += 0.4f`, `vz -= dz/len*0.4f`, with `vy` capped at 0.4000000059604645. `len` is a float sqrt.
- A coincident attacker is nudged by `Math.random` in `attackEntityFrom`.
- It runs only on a fresh hit (hurtResistantTime not above max/2) when the DamageSource has an entity. A larger hit inside the window deals only the difference with no knockback. Creative, invulnerable, dead and zero-damage hits return early.
- Projectiles: the attacker is the shooter, or the arrow itself with no shooter. Dragon, wither skull and fireball hits knock back from their source.

## Extra velocity
- Mob Knockback enchant: after a landed hit, `addVelocity(-sin(yaw)*i*0.5, 0.1, cos(yaw)*i*0.5)`; the mob's own motion x/z is multiplied by 0.6.
- Iron golem: `motionY += 0.4` after the hit, so about 0.8 total (cap applied first).
- Punch arrow: knock first, then `(mx*level*0.6/h, 0.1, mz*level*0.6/h)`.
- Explosions: a living exploder is the damage source and knocks back first; the blast velocity (Blast Protection scaled) is added afterwards. No exploder means no knockback.

## Attributes and FOV
- Speed I 0.12, Slowness I 0.085, Strength I attackDamage 2.3, Weakness I 0.5; Speed II + Slowness I 0.119; Strength II + Weakness I 1.8.
- `movementSpeed` and `attackDamage` clamp at 0. Weakness II on an empty hand gives exactly 0, and vanilla attacks only when damage > 0 (or enchant damage > 0), so no attack happens.
- FOV is `(attributeValue/walkSpeed + 1)/2` (flying x1.1), so Speed and Slowness change it.

## Gaps
- Death throw (`EntityPlayer.onDeath` replaces motion) is not modelled.
- Self-ignited TNT random nudge and bed explosions are not modelled.
- Thorns and other indirect sources do not knock back.
- The `Entity.rand` draw for the resistance roll is not consumed.
