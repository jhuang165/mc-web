# Batch 100 credit100: removed-body death side effects closed as native-not-applicable, Thorns of an online wearer on a logged-out shooter

## Summary
- **Item 1, closed with evidence (no code for S19 / XP / death throw).** A logged-out shooter's removed body killed by Thorns gets no S19, no XP orbs, no visible death throw natively; kill credit exists only when the killer is a player (mob killers credit nothing).
- **server-survival.js `dieGone`:** the death event now carries `killer` and the killing player's `playerKills` stat is counted (`killerOf`); a player attacker adds no killed-by stat (no EntityList name). Comment on `goneHit` records the native-not-applicable list.
- **Item 2, found and fixed: online Thorns wearer vs a removed shooter's arrow (server-dispense.js `hitPlayer`).** The port ran the wearer's Thorns only when the shooter was online (`ownerOf`), so a logged-out shooter's arrow gave no Random roll, armour wear, damage or sound. Now the removed body takes the Thorns hit (`goneHit`), a lethal one is credited to the wearer. Also `byPlayer: true` added to the live-player-shooter Thorns call (b91 miss: afv.a visits the held item when the attacker is a yz).
- Other delayed damage on a logged-out player: fishing hook, ender pearl, burning arrow (below): no gap found.
- Item 3 not done (see Follow-ups).
- Tests: `src/credit100-b100.test.js` (3).

## Evidence
- **Bytecode-read:** oi.e(mw) (logout): mt.e(sa) = ahb.e(sa) (setDead, playerEntities.remove, ahb.b -> mp.b -> mn.b(sa) untrack by id) then the profile is dropped. ahb.a(sa, B) is empty; mt.a(sa, B) -> mn.b(sa, ft) looks the id up in the tracker map and sends only if found: no S19 (status 2 or 3). sv.a(ro) (onDeath): killer `aX()` gets `b(this, ba)` (sa.b(sa, int) is an empty method, yz.b(sa, int) scores/playerKills) and `sa.a(sv)` (empty in sa); drops/rare drop only; the XP orbs are in sv.aF (onDeathUpdate), reached from the entity tick. ahb.h tests `sa.K` (isDead) before updateEntity, then removes it, so a removed body never ticks. yz.a(ro) sets motion, but the body never moves or is sent. afv.a(sv, sa): `sa instanceof yz` visits `be()` (held item).
- **Not enumerated:** the server subclasses overriding `sa.a(sv)` (zombie villager conversion); none acts on a player victim as far as read.
- **Port-read:** pearl (b92 `pearlImpact`: owner null once logged out, native zm.a needs an open connection, closed at logout), fishing hook and burning arrow on a removed shooter left unchanged; EntityFishHook dies when its angler isDead (port-read from earlier batches, not re-read here).
- Not executed (no live-class probe: needs EntityPlayerMP and a world).

## Verification
- `node --test --test-concurrency=2 src/credit100-b100.test.js`: 3/3; with server-survival.js and server-dispense.js reverted 0 pass / 3 fail.
- Neighbour run, 45 files naming serverSurvival/server-survival/dieGone/goneHit/server-dispense/hitPlayer(/mobThornsOnShooter or credit9x: 389 tests, 389 pass, concurrency 2. No build, no full npm test, no browser.

## Found wrong in the batch 99 list
- Nothing wrong; "not modelled: death throw, S19, XP orbs" is native for a removed body (not a gap). The Thorns-from-an-online-wearer direction was missing and is now fixed.

## Follow-ups
- Item 3 (killed by a mob ridden by another mob, spider jockey skeleton arrow: killed-by stat and message attacker) not started.
- Fishing hook / pearl / burning arrow paths on a logged-out player not re-read at bytecode level this batch.
- Browser-only: nothing checked.
