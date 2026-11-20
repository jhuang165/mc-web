# Batch 86 mobrec86: squid push on a boat and a ticked player, villager-to-zombie conversion, a zombie pigman fight (executed records)

## Summary
- Squid against a boat and squid against a ticked player are now executed records (they were port-read follow-ups in convert85). There are 7 records in `public/research/squid-push-b86-reference.json`. All 7 replay with 0 mismatches. No port change was needed: the live path already matched (`EntityWorld.push` -> boat walker `pushMob` -> `Boats.collide`, `boatBoxProvider` boxes, `pushServerPlayer`, and the player's own `serverPlayerUpdate`).
- Villager-to-zombie conversion was re-recorded on Easy, Normal and Hard through the native `EntityZombie.onKillEntity` path (`yq.a(sv)`, called from `EntityLivingBase.onDeath`). There are 11 records in `public/research/village-fight-b86-reference.json`, and all 11 replay with no divergence. No port change was needed.
  - Easy never converts, and Hard always converts.
  - On Normal, 2 of the 4 kill seeds plus the blow seed convert, depending on the killer's `nextBoolean`.
  - In the "kill" records the zombie's own `EntityAIAttackOnCollide` hit makes the kill at tick 10. The villager and zombie are penned in a 2x1 cell walled two high with stone, so the villager cannot flee. The first try in the open never killed: the villager outran the zombie.
- Zombie pigman fight (task 3): there are 4 records in the same file, all replaying with no divergence and the same loot kinds (items and orbs).
  - A player's hit at tick 5 angers it.
  - It strikes the held probe player (7.5 on Normal).
  - The player's hit at tick 50 kills it.
  - The recentlyHit drops (rotten flesh or gold nugget `xk`) and the deathTime 20 orbs (`sq`) are in `loot`.
  - Easy pigman records were not made.
- Probe changes:
  - `SquidPushProbe` has an `SQ_B86` branch: a water pool world built on `EntityListProbe.EW`, a real boat, and a real `EntityPlayerMP` that is ticked each tick.
  - `VillageFightProbe`: `b86-` names use the b37 extras, the b85 `loot` field and the b38 legacy-row layout (`bright`, `patches`, `poison`).
- Verify scripts:
  - `verify-squid-push.mjs` runs SQ_B86 after the old run; the old file regenerates unchanged.
  - `verify-village-fight.mjs` adds `VF_PREFIX=b86-`, which asserts 15 records; the b85 file regenerates unchanged.
- `src/village-fight-replay.js` exports `fightReference86`.

## Evidence
- Executed: the 1.7.10 classes run unchanged by the probes.
  - `SQ_B86=1` SquidPushProbe produces `b86-boat-sb`, `b86-boat-bs`, `b86-boat-drift`, `b86-boat-ram-15`, `b86-boat-ram-25` (this boat breaks on tick 1 against the squid's box) and `b86-tplayer-0`/`-1`.
  - `VF_PREFIX=b86-` VillageFightProbe produces `b86-kill-d{1,2,3}-*`, `b86-blow-d{1,2,3}-8610` and `b86-pigman-d2-{8620,8621,8622}`/`-d3-8623`.
- Bytecode-read (javap on the 1.7.10 jar):
  - `sv.bo` (collideWithNearbyEntities) and `xi.i(sa)` / `xi.h(sa)` (getCollisionBox returns the other entity's box), plus the boat's break when it is collided horizontally at speed > 0.2.
  - `mw.i` / `mw.h`, `yq.a(sv)` (Hard always; Normal unless `nextBoolean`; Easy never), `yh.b(boolean,int)` (EntityPigZombie dropFewItems: `nextInt(2 + looting)` rotten flesh `ade.bh`, then gold nuggets `ade.bl`).
- Port-read: the replay plumbing (the harness for `entityWalkers`, `orderStamp` and `afterEntities`), and where `replayFight` places conversions.

## Verification
- `node --test --test-timeout=600000 src/mobrec86-b86.test.js`: 27 pass, 0 fail. It covers:
  - 7 squid records, the check that the records push, and negative checks:
    - without the boat's push the non-ram records fail;
    - without the boat boxes the ram records fail;
    - without the player tick the tplayer records fail.
  - 15 fight records, with loot kinds.
  - The conversion check over the difficulties, and a negative check: the Hard records diverge when replayed on Easy.
  - The pigman check.
- Neighbours (`convert85-b85`, `squid-push-b85`, `pathfinding`, `village-fight*`, `squid-bat*`, `zombie-villager*`, `corpse79-83`, `mobs84`, `boats`, `boatstand-b67`, `entity-list`): 583 pass, 0 fail.
- `npm run build`: ok. No full `npm test` and no browser checks.
- No old test encoded the gaps, because no port behaviour changed.

## Follow-ups
- Not recorded:
  - a witch fight;
  - a pigman on Easy, killed by a golem, or a group;
  - a boat with a rider pushed by a squid;
  - a villager killed by a baby zombie or a zombie villager.
- Browser-only:
  - how a squid pushing a boat looks in play;
  - the converted zombie appearing on the villager's frame (the aux SFX 1016 sound);
  - pigman anger and its loot visuals.
