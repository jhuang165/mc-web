# mobexport batch 52 track (branch batch52-mobexport, from 8cd3f1725)

## Summary
- `ActiveEffects` is exported for every mob kind with effects (was zombie, villager, iron golem). The compound is Id, Amplifier, Duration, Ambient as native `PotionEffect.a(dh)`. The list order is the native `HashMap<Integer, PotionEffect>` bucket order (id & 15, id & 31 above 12 entries); equal buckets (2/18, 6/22) stay in id order, not insertion order.
- Import and the saved-state round trip keep them for all 28 kinds. The Amplifier is a signed byte natively (255 reads back as -1, 200 as -56): `readMobEffects` now clamps to -128..255 instead of 0..255, the shifts (`50 >> amp`) behave like Java's. `Ambient` is read, kept (`ambient: true` only when set) and exported. Unmodelled ids (haste, hunger...) are still dropped on import.
- Lightning (`Entity.onStruckByLightning`, sa.a(xh): `f(5)` dealFireDamage, `++fire`, `if (fire == 0) setFire(8)`): the port's path already advanced a fire-immune mob's counter (the immunity refusal is in `hazard`). Fixed: (1) `setFire(8)` is shortened by worn Fire Protection (mobs' `equipment`, the player's armour), 160 -> 64 at level IV; (2) `burn()` for pigmen, magma cubes and wither skeletons only runs a positive counter down by 4 (a rested -1 stayed 0 before, so a later strike did not ignite).
- Pigman shot by a player's arrow (shooter credit): executed; the port already matched (player arrows reach `damage` with `player: true`), now covered by a test.

## Evidence
- Executed: `tools/probes/MobEffectsProbe.java` + `tools/verify-mob-effects.mjs` -> `public/research/mob-effects-reference.json`, 168 `b52me` records (28 kinds by `EntityList.createEntityByName` x 6 effect layouts incl. ambient, amplifier 200/255, ids 3/14, empty map): NBT of the first write, the loaded mob rewritten (identical), loaded effect map. ActiveEffects exists only for a non-empty map.
- Executed: `MobVictimProbe` now also records 54 `bolt` rows (zombie, pigman, wither skeleton, wither, magma cube, skeleton; fire -1/0/1/5/19/160; Fire Protection IV armour on three kinds) and 4 `pigman-arrow` rows (player and mob shooter, alone and with 4 neighbours). The 1669 `b51mv` records are byte-identical; the file now has 1727.
- Bytecode-read: `sa.a(xh)`, `sa.f(int)` (ae check), `sa.e(int)` + `agi.a`, `sa.C` fire section (ae: `fire -= 4` only when fire > 0), `sv.b(dh)` (ActiveEffects only when the map is non-empty).

## Verification
- `node --test src/mob-effects-b52.test.js` 3 pass; `src/mob-lightning-b52.test.js` 5 pass.
- Targeted (mob-effects-b52, mob-lightning-b52, mob-victims-b51, weather*, enderman-wolf*, wither*, magma-pigman*, fire*, block-collisions*, java-mobs, mob-nbt, mob-*, region-*, level-dat, village-fight*, entity-list*, zero-stacks*): 851 pass, 0 fail. `npm run build` ok. No full `npm test`.
- `src/entities.js` is claimed by savedorder: my hunk there is the 2-line `burn()` change only.

## Follow-ups (proposed gap lines)
- The wither module (wither-boss-mobs.js `burn`) zeroes the wither's fire counter every tick; natively it runs down by 4 and a strike advances it.
- Fire Aspect, flame arrows and zombie ignition on mobs still use unshortened ticks (natively `setFire` applies Fire Protection to any living victim).
- The effect map's insertion order inside one bucket (2/18, 6/22) is not tracked; the export writes id order there.
- Effects of unmodelled potions (haste, hunger, saturation...) are dropped on import, natively kept and ticked.
