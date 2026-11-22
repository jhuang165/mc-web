# entnbt95 (batch 95): player NBT audit against a real EntityPlayerMP

## Summary
Not full parity; open items at the end.
- `region-export.js` `levelNbt` (the level.dat Player compound): `Sleeping` / `SleepTimer` come from the saved bed state (`record.bed.bed` / `.timer`, was always 0); `HurtTime` and a dying player's `DeathTime` (only at Health 0) come from `record.playerState`; `OnGround` and `FallDistance` too (were always 0); `generic.attackDamage` carries the held tool or sword modifier; `generic.movementSpeed` writes the empty `Modifiers` list while sprinting.
- `player-nbt.js` (new): the 20 held-item damage modifiers (name, amount) and the shared item modifier UUID.
- `main.js` `save()`: writes `active.playerState = {onGround, fallDistance, hurtTime, deathTime (dead screen only, max 20), sprinting}`. No import change needed (the native load of those keys has no visible effect on the client copy).
- New: `src/entnbt95-b95.test.js` (6 tests), `tools/probes/Entnbt95Probe.java`, `tools/verify-entnbt95.mjs`, `public/research/entnbt95-reference.json`.

## Evidence
- **Executed** (`Entnbt95Probe`, ServerPlayerProbe real `EntityPlayerMP`, `readFromNBT` then `writeToNBT`, then a second player reads and writes again; 38 rows plus 20 item rows): a fresh player writes AbsorptionAmount, Air, AttackTime, Attributes (maxHealth 20, knockbackResistance 0, movementSpeed 0.10000000149011612, attackDamage 1), DeathTime, Dimension, EnderItems, FallDistance, Fire, HealF, Health, HurtTime, Inventory, Invulnerable, Motion, OnGround, PortalCooldown, Pos, Rotation, Score, SelectedItemSlot, SleepTimer, Sleeping, UUIDLeast/Most, XpLevel/P/Total, abilities, foodExhaustionLevel/Level/SaturationLevel/TickTimer, playerGameType. HurtTime, DeathTime, AttackTime (also negative, 300), SleepTimer (77, 500), FallDistance, OnGround, PortalCooldown, Dimension (7 kept), SelectedItemSlot (9, -1), Score and food values (negative, 99, 500) are kept as loaded. HealF 0 keeps DeathTime 9 and 25. Negative HealF writes 0, NaN HealF writes NaN with Health 0. playerGameType 3 and 9 load as 0 (1.7.10 has no spectator), 2 writes `abilities.mayBuild` 0b. After the player has the held stack applied through the real attribute map, a diamond sword writes `Modifiers:[{Name:"Weapon modifier",Amount:7.0,Operation:0,UUID CB3F55D3-645C-4F38-A497-9C13A33DB5CF}]` on attackDamage (survives reload); of all items only the 5 swords ("Weapon modifier", amounts 4/5/6/7/4) and the 15 shovel/pickaxe/axe tiers ("Tool modifier", 1 to 6) carry one. `setSprinting(true)` writes `Modifiers:[]` on movementSpeed (the sprint modifier is not saved); a reload drops the empty list. Active effects loaded from NBT leave Attributes unchanged (no modifiers applied on load).
- **Bytecode-read:** `mw.a(dh)` reads playerGameType and calls `MinecraftServer.getServer().getForceGamemode()`.
- **Port-read:** `bed.js save()` already keeps `bed`/`timer` only while sleeping; `main.js` saves at `die()` with deathTime 0 and does not autosave on the death screen; the item ids that carry modifiers are the Java ids written by `stackNbt`.
- Leash: a real holder is already covered by executed batch 21 rows (`interchange-links.test.js`, `leashWrite`: player UUID, knot X/Y/Z); the batch 94 edge rows show the `/summon` double writes only `Leashed` without a holder, which the port matches.
- Zombie / horse random attributes: the executed compounds of `entnbt94-reference.json` (random `zombie.spawnReinforcements`, rolled horse values) are now used as import input, so the round trip is exact. A `/summon` does not run `onSpawnWithEgg`, so the "Random spawn bonus" modifiers stay covered by the batch 21 `attrVariant` rows.

## Verification
- `node --test --test-concurrency=2 src/entnbt95-b95.test.js`: 6 pass. With `region-export.js` reverted from Git: 2 pass, 4 fail (tests 2 to 5).
- Wider run, 54 files naming levelNbt, exportJavaSave, region-export or level-dat (plus bed.test.js and the new file), concurrency 2: 794 tests, 794 pass, 0 fail.
- Build not run (new import is a plain module).

## Found wrong in the batch 94 list
- "The port's player export always writes DeathTime 0 ... a player saved at Health 0 is not modelled (the player respawns before any save)": not so. `die()` calls `save()` at Health 0 (DeathTime 0 then, right) and a later save on the death screen (pagehide, quit) held a stale 0 where native counts. Now written.

## Follow-ups
- Not done: `Motion` of the player is still 0 (the port keeps velocity in its own units; the import already drops it above 0.08); `AttackTime` stays 0 for players (no port state; native only sets it from mob attacks).
- Native loads effects without applying their attribute modifiers (speed, strength, health boost appear in Attributes only for a session-applied effect, which writes `Modifiers:[]`). The port writes no empty lists for effect modifiers (it cannot tell session-applied from loaded effects) and keeps loaded effects functional; the native load behaviour (a reloaded speed potion does not speed the player) was not probed for movement, only for the attribute compound.
- `Sleeping` 1b could not be probed on the double (its load threw in the bed lookup); the port writes it from the bytecode-read wake-up rule. `SleepTimer` 101 to 109 after waking is not exported (`bed.js save()` writes 0 while awake).
- Browser-only: none of the saved Player compound was loaded in a browser.
