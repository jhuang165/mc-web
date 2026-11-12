# mobvictims batch 51 track (branch batch51-mobvictims, from 119a6db93)

## Summary
- A mob's absorption amount is saved and loaded: `restore` keeps `absorption` (floored at 0), `/summon` and Java chunk NBT read `AbsorptionAmount` (`absorptionFields`, java-mobs.js), and the export writes `AbsorptionAmount` for every mob (0 when none), as native `EntityLivingBase.writeEntityToNBT` always does (sv.b/sv.a bytecode-read).
- Skeleton, wither skeleton, zombie pigman and wither run as victims of the 22 b50mr DamageSources. Skeleton and wither skeleton matched unchanged. Mismatches fixed:
  - Fire damage (inFire, onFire, lava) was refused inside `attackEntityFrom` for the pigman and wither. Natively `isImmuneToFire` (sa.ae) is checked by the callers (`dealFireDamage`, lava), not by attackEntityFrom (only the Fire Resistance effect is). The refusal moved to `EntityWorld.hazard`; the wither skeleton (yl.a(1) sets ae) joins `fireproof`, the wither (xc constructor sets ae) is immune in `hazard`.
  - The wither's armour is a flat 4 (`xc.aV` returns 4): worn gear no longer adds to it.
  - The wither's undead-attacker rule uses `DamageSource.getEntity`, so an arrow from a skeleton or zombie shooter is refused too (`source.shooter ?? source.attacker`).
- Already matching: the wither's Invul phase (refuses everything including outOfWorld while Invul > 0), the armoured arrow rule at health <= 150, bv/bu counters, pigman anger (player hit angers the pigmen within the 32 block box, a mob's hit none), hurt window top-ups.

## Evidence
- Executed: `tools/probes/MobVictimProbe.java` + `tools/verify-mob-victims.mjs` -> `public/research/mob-victims-reference.json`, 1669 records tagged `b51mv`: real EntitySkeleton x2 types, EntityPigZombie and EntityWither (yl, yh, xc), 273 each for skeleton/wither skeleton/pigman (22 sources x amounts 1, 6 x 6 loadouts incl. Protection, Resistance, absorption), 840 wither records (Invul 220/1/0, health 100/300/151/150/20, undead and spider attackers, absorption, iron gear), hit-window pairs, 1 HP kills, 10 pigman call-for-help scenarios. `PlayerDamageProbe.World` gained an optional `near` entity list.
- Bytecode-read: AbsorptionAmount read/write (sv.b, sv.a, sv.m floors at 0), isImmuneToFire = sa.ae set by yl.a(1) and the xc constructor.
- Not covered: the skeleton's entityToAttack (EntityMob.attackEntityFrom) is recorded but unused by its AI tasks, not compared; Resistance on the wither (it takes no effects); a pigman angered by an arrow shot by a player (probe shooter was a mob).

## Verification
- `node --test src/mob-victims-b51.test.js`: 9 pass.
- Targeted (combat, combat-tracker, damage-fx, enderman-wolf, entity-list, fire*, fireballs, java-mobs, magma-pigman, mob-*, player-riding, region-export/import, village-fight b37-41, weather, wither, zero-stacks): 725 pass, 0 fail. `npm run build`: ok. No full `npm test`.

## Follow-ups (proposed gap lines)
- `ActiveEffects` export still limited to zombie, villager and iron golem.
- Lightning on a fire-immune mob still advances the fire counter by one natively (`++fire`); not checked here.
- A mob's AbsorptionAmount is not reapplied from an Absorption effect on load (native does not either).
