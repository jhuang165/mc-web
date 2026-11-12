# firearmor batch 49 track (branch batch49-firearmor, from ac7027870)

## Summary
- Audit of which stages each DamageSource goes through on the player, executed against the unchanged `EntityPlayerMP.attackEntityFrom`. Native rules (bytecode-read sv.b, sv.c, sv.d, yz.d, ro.<clinit>): armour reduction and armour durability loss only when `!source.isUnblockable()` (setDamageBypassesArmor: onFire, inWall, drown, starve, fall, outOfWorld, generic, magic, wither, indirectMagic); Resistance (20% per level) for every source except outOfWorld, and not at all for an absolute source (starve); then the enchantment step (starve skipped); then absorption; then `addExhaustion(source.hungerDamage)` when something is left (0.3, but 0 for armour-bypassing and absolute sources).
- The batch 48 follow-up "burning goes through armour" was a test call shape, not live behaviour: every live caller of burning (`Survival.update`, `damage(1, "burning")`) already left `blockable` false. The real weakness was that armour hung on the caller's `blockable` flag. `Survival.damage` now decides by the DamageSource key (`isUnblockable`) and ignores the flag, so no caller can send fire, drowning, a fall, magic or wither through armour (and no blockable source skips it).
- Fixes found by the executed records: Resistance no longer reduces starvation (it did: 3 hearts-halves became 0 at Resistance V); every hit that gets past absorption now adds 0.3 hunger exhaustion unless the source bypasses armour or is absolute (the port added none; `Survival.exhaust`, so Creative is excluded as native `disableDamage`).
- Mobs (`combat.js`): `armorReduced` already used the same bypass list except `indirectMagic` (thrown harming potion), now shared from `armor-enchantments.js` (`UNBLOCKABLE_SOURCES`). Mobs have no Resistance model in the port; not changed.
- Everything else matched with no change: anvil/fallingBlock helmet wear (`anvilDamage`), arrows, fireballs (fire + projectile), thrown, thorns, explosion, mob attacks, Protection/Fire/Feather Falling/Blast/Projectile Protection with the shared enchantment Random, armour wear `max(1, amount / 4)`, absorption.

## Evidence
- Executed: `tools/probes/ArmorSourceProbe.java` + `tools/verify-armor-sources.mjs` -> `public/research/armor-source-reference.json`, 675 records tagged `b49fa`: 21 DamageSources x amounts 1 and 6 x 16 loadouts (bare; leather, iron, diamond+Protection IV; iron with Protection II, Fire, Feather Falling, Blast, Projectile Protection IV; Resistance 0/1/4; absorption 4 and 10; everything together) plus 3 big hits (18). Health, each armour piece's damage, absorption left, exhaustion added; EnchantmentHelper's static Random seeded per record.
- Bytecode-read: causePlayerDamage (ro.a(yz)) is the same flag-free EntityDamageSource as causeMobDamage; the double refuses a player attacker with PvP off, so it is not in the records.
- Not probed: mobs' own damage path against the original (only the flag set, bytecode-read).

## Verification
- `node --test src/fire-armor-b49.test.js`: 6 pass (reference header, 675-record replay, flag-independence, starvation/Resistance, exhaustion, mob bypass set).
- Targeted (143 files that construct Survival or call armorReduced/scaledDamage/anvilDamage/exhaustion): 1544 pass, 0 fail. `npm run build`: ok. No full `npm test`.

## Follow-ups (proposed gap lines)
- Mobs have no Resistance or absorption in `combat.js damageEntity`.
- `Survival.damage`'s `blockable` parameter is now unused by armour; callers still pass it (harmless, could be removed).
- Player-versus-player (causePlayerDamage) is not in the executed records (PvP refused by the double).
- Hunger exhaustion from a hit to the integrated server's copy versus the client `Survival` is not separated (single player only).
