# Batch 40 fireballs track

## Summary
- New native evidence: `public/research/fireballs-reference.json` (27 records, `tools/probes/FireballProbe.java`, `tools/verify-fireballs.mjs`), replayed exactly by `src/fireballs-replay.js` and `src/fireballs-native.test.js`. Large and small fireballs are ticked whole (`ze.h`) on the unchanged classes; the probe removes setDead entities each tick like World.updateEntities.
- `src/fireballs.js` fixes: dispenser aim normalised; constructor box on the first update; water test and push before the sweep; impact does not end the update; large balls collidable; owner grace by `ticksInAir`; punch keeps `ticksInAir` and the small ball refuses it; shooter as the damage source entity (`attacker`), a shooterless ball is its own source (knockback, dead target); pigman fire-immune.
- `src/projectiles.js`: cake uses its shaped ray box (shared with arrows).
- EntityMob target rule (`entities.js` `TARGETS_ATTACKER`): blaze, silverfish, giant, spider, cave spider, pigman take any living attacker as target; blaze, silverfish and giant think now handle a mob target (shoot or melee via hitMob). Recorded natively in `fb-hurt-mobs` and `fb-hurt-ball`.
- Blaze crackle is a `clientOnly` client sound at the blaze (`blaze-ghast-mobs.js`); `drainClientSounds` untouched (tracker track owns it). Server draws unchanged.
- isJumping: silverfish and giant think no longer reset it (`st.jumping = !!e.jumping`); bytecode-read: `td.bq` clears `bc` only on its path-following branch and `yk`/`ye` write none. Local `entities.js` edits: `TARGETS_ATTACKER`, attackEntityFrom target lines, silverfishThink/giantThink env and jumping.

## Verification
Focused tests, one at a time (full `npm test` and build left to the lead): fireballs-native 28/28, legacy-ai 36/36, blaze-ghast 7/7, blaze-ghast-world 6/6, slime 11/11, slime-world 8/8, silverfish 75/75, giant 7/7, entities 21/21, projectiles 20/20, village-fight-b38 32/32, village-fight-b39 22/22. No browser check run. Load average before the probe run: 8.9.

## Follow-ups (proposed gap lines)
- Fireball `blockExists` (y range, unloaded chunk) and the `inGround` path are bytecode-read only; the probe world always reports blocks present.
- Enderman (legacy EntityMob) and other EntityMob users outside this track were not checked for the attacker target rule; AI-task mobs ignore `entityToAttack` in 1.7.10 (bytecode-read).
- A blaze targeting a mob uses the port's brain view; native mob-target flights of blaze volleys are not recorded (only the target rule).
- Client crackle position is the blaze entity, not posX+0.5/posY+0.5/posZ+0.5.
