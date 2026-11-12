# mobresist batch 50 track (branch batch50-mobresist, from ca6a447bf)

## Summary
- Mobs now run the same potion step as the player in `EntityWorld.damageEntity` (`src/entities.js`): armour, then Resistance (20% per level, every source except outOfWorld, not an absolute source such as starve), then the worn gear's enchantments, the witch's own rule, then the absorption amount (`e.absorption`), then health.
- `mob-effects.js` models Resistance (11) and Absorption (22) as mob effects (`/effect`, ActiveEffects, spawners; 1.7.10 has no potion item for either). Absorption adds 4 * (amp + 1) on a new effect; a re-add (onChangedPotionEffect) removes the combined effect's amount (floor 0) then adds it again, so a spent shield refills; expiry removes it (floor 0).
- Mob armour never loses durability: `EntityLivingBase.damageArmor` (sv.h) is an empty method, only EntityPlayer overrides it. Executed records confirm all armour slots keep damage 0 (the anvil/falling block helmet wear is the separate existing path and also matches).
- Player-versus-player: `causePlayerDamage` records run on the real EntityPlayerMP once the server double enables PvP (`MobResistProbe.PvpServer.ab()`; the GameProfile stub gained `getName`, which `yz.bt()` needs). The port's player path already matched (no source change).
- Persistence of a mob's `absorption` through saves/NBT (`AbsorptionAmount`) and the model for the wither (takes no effects) were not touched.

## Evidence
- Executed: `tools/probes/MobResistProbe.java` + `tools/verify-mob-resist.mjs` -> `public/research/mob-resist-reference.json`, 771 records tagged `b50mr`: real EntityZombie (natural armour 2) x 22 DamageSources (21 of b49fa plus causePlayerDamage) x amounts 1 and 6 x 16 loadouts (bare, leather, iron, diamond+Protection IV, iron with Protection II / Fire / Feather Falling / Blast / Projectile IV, Resistance 0/1/4, absorption 4 and 10, all together), 64 real EntityPlayerMP rows with a player or mob attacker (PvP on), and 3 big hits. Health, the four armour pieces' damage, absorption left.
- Bytecode-read: sv.d, sv.c (Resistance, `rw.c()+1)*5`), sv.h empty, rr (Absorption potion), sv.c(rw)/sv.a(rw, boolean) (onChanged remove-then-apply), sv.d(rw) (undead immune to regeneration and poison; not changed here).
- Not probed: wither/skeleton/pigman as victims (same sv.d code; only the zombie ran), Resistance and absorption through a splash potion (none exists in 1.7.10).

## Verification
- `node --test src/mob-resist-b50.test.js`: 5 pass (header, 771-record zombie replay through `attackEntityFrom`, PvP player rows, absorption add/refill/expiry, Resistance exceptions).
- Targeted with combat, mob-equipment, difficulty, fire-armor-b49, wither-boss, magma-pigman, swordblock-b48, zombie-door-player, witch, entity-list: 199 pass, 0 fail. `npm run build`: ok. No full `npm test`.

## Follow-ups (proposed gap lines)
- A mob's `AbsorptionAmount` is not read from or written to NBT/saves; a loaded mob with an Absorption effect starts at 0.
- The potion-applicability rule (`EntityLivingBase.isPotionApplicable`: undead take no Regeneration or Poison) is bytecode-read only.
- Skeletons, pigmen and the wither as victims were not executed.
