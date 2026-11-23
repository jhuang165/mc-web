# Batch 98 credit98: Thorns on a logged-out shooter, player-victim Thorns order

## Summary
- **Logged-out shooter takes the Thorns hit (server-dispense.js `mobThornsOnShooter`, server-survival.js new `dieGone`).** b97 only rolled the mob's Thorns and played the sound. Now the damage reaches the removed body's Survival (`damage(n, 'thorns', true, 'thorns', mob)`, which keeps Creative and spawn-protection refusals). A lethal hit calls `ServerSurvival.dieGone`: the CombatTracker death event goes to the whole server and `dropOnDeath` throws the body's inventory (unless keepInventory); the file saved at logout is untouched, as natively. Not modelled (the removed entity never ticks): death throw, S19 view, XP orbs, death/kill stats, hurt sound.
- **Player-victim Thorns order (entities.js `hitPlayer`).** Thorns ran inside `scaledDamage`, before Knockback and Fire Aspect. Now `scaledDamage` is called without `attacker` and `survival.thorns(thorns)` runs after both, as yg.n does. server-mobs.js: the view proxy gets `thorns` forwarding to the real survival (wear and the broken flag belong to it).
- Tests: `src/credit98-b98.test.js` (3).

## Evidence
- **Bytecode-read:** mw.a(ro, F): invulnerable (aw), spawn protection `bU` (not for ro.i), PvP test only when the source is a yz, then yz.a; yz.a: Creative, aS() <= 0, never an online test; sv.a ends with onDeath when aS() <= 0; mw.a(ro): `oi.a(rn.b())` broadcast, dropAllItems unless keepInventory, aX() credit, deaths stat. yg.n order: damage, knockback, setFire(afv.a(sv)*4), afv.a(victim, attacker), afv.b.
- **Port-read:** the dedicated entity update never visits a removed player, so no onDeathUpdate (no orbs).
- Not executed: no live-class probe (needs EntityPlayerMP and a world).

## Verification
- `node --test --test-concurrency=2 src/credit98-b98.test.js`: 3/3; with entities.js and server-dispense.js reverted 0 pass / 3 fail.
- Neighbour run, 29 files (credit90-98, attributes3, cave-spider, difficulty, mob-equipment, player-knockback, sounds73, stats, thorns-wear, bow, mpdispense, every test naming hitPlayer/thornsOfVictim): 180 tests, 180 pass. Three old tests pass stub survivals without `thorns`, so the call is `survival.thorns?.(...)`. No build, no full npm test, no browser.

## Found wrong in the batch 97 list
- Nothing.

## Follow-ups
- Removed-body death side effects listed above; spawn-protection `bU` freeze is the port's `protection` (also not ticking).
- Browser-only: nothing checked.
