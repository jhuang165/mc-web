# Batch 97 credit97: stashed thrower after a reload, mob Fire Aspect/Smite/Bane audit, logged-out arrow shooter

## Summary
- **Real reload drops the stashed dead body (projectiles.js `forgetOwnerBodies`, main.js one line after `arrows.load`).** Native EntityThrowable (zk) saves only `ownerName` and looks the thrower up by name, so after a disk load a ball or potion credits the live player; a dead or missing one credits no one. EntityArrow (zc) saves no owner at all. The port kept `ownerBody` (the b94 stash record) through a real load. `if (realLoad) forgetOwnerBodies(projectiles, mobs.potions, arrows)` (the b95 `realLoad` flag, so a Nether/End stash still keeps the body) deletes `ownerBody` from balls and potions and `ownerBody` + `shooter` from arrows. The `main.js` line is code-read only (not importable); the helper is tested.
- **Logged-out arrow shooter, server (server-dispense.js `mobThornsOnShooter`).** The arrow keeps `zc.c`, the removed EntityPlayerMP; `ownerOf` is null once the player left, so the mob's Thorns (`afv.a(victim, shooter)`) were skipped (no Random roll, no armour wear, no sound). Now the stale record counts as a gone body: the roll and the sound at the removed body happen, no damage reaches anyone online. Credit/XP/Looting already flowed through the stale `a.owner` (bow.js).
- Tests: `src/credit97-b97.test.js` (4).

## Evidence
- **Bytecode-read:** zk NBT strings (`ownerName` only), zk.a(String) name search; zc NBT has no owner; yg.n order (damage = attribute + afv.a(sv,sv) on be(); on a hit knockback, `setFire(afv.a(sv) * 4)`, afv.a(victim, attacker), afv.b); sa.e(I) (`i * 20`, agi.a Fire Protection, only raised); afv.a(sv) reads `be()`.
- **Port-read, nothing wrong (item 2):** hitMob and hitPlayer (entities.js) use `meleeEffects` with the target's creature attribute (UNDEFINED for a player), Fire Aspect after knockback, `setMobFire`/`survival.setFire` with Fire Protection, Bane slowness on the mob's five slots. Test asserts 2 x 4 s = 160 ticks on a mob and a player, and Smite 3 = +7.5 before the zombie's armour. Server and single player share these functions. Small order difference left: for a player victim the port runs the victim's Thorns inside `scaledDamage`, before knockback and fire (native: after); no observable effect found.
- **Port-read (item 3):** an arrow that kills a Thorns mob still hurts the shooter (test) and keeps the player credit flag.
- Not executed: no live-class probe (needs EntityPlayerMP/world).

## Verification
- `node --test --test-concurrency=2 src/credit97-b97.test.js`: 4/4; with server-dispense.js reverted the logout test fails (the reload test needs the new export).
- Neighbour run, 20 files (credit90-97, bow, projectiles*, mpdispense, b62-lead, mpthrown84, pearl-player, projectile-nbt, skeleton-arrow-villager, mphook85, mpobjects89): 181 tests, 181 pass. No build, no full npm test, no browser.

## Found wrong in the batch 96 list
- Nothing.

## Follow-ups
- Natively a Thorns hit on a logged-out shooter damages the removed body (a lethal one would broadcast a death message and drop items); not modelled.
- Player victim Thorns order inside `scaledDamage` (before knockback/fire): left.
- Browser-only: nothing checked.
