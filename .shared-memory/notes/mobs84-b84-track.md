# Batch 84 mobs84: live mob update gaps from corpse83

## Summary
- Live zombie (villager) conversion (`entities.js`): yq.cd's removeEntity only sets the zombie dead, so the rest of yq.h / sv.h runs in that tick. The port now restores health (from `removedHealth`), death 0 and recentlyHit after `cureZombie` and keeps going; `remarkCured` (the loop step) puts the removal marker back (health 0, death 20, recentlyHit 0; `removedHealth` re-read if the rest of the tick changed health). The villager and zombie at the same x/z do not push (d^2 < 0.01), no special case needed.
- Enderman: the `health > 0` gate on `endermanHurt` is gone (ya.a has no health test), so a projectile hit teleports a corpse too.
- Wither head particles (`wither-boss-mobs.js headParticles`): drawn on the entity's own Entity.rand and the mobs' worldRandom (the armour 1-in-4 roll, ahb.s), always, with `m.fx?.spawn` only when a sink exists. The Math.random-seeded visual Randoms are removed. The multiplayer server (no `fx`) now makes the draws natively too; the client copy (`copy-talk.js`) keeps its own draws.
- Live squid (`squid-bat-mobs.js`): `m.push` (sv.bo) after the move and before ws.e's tail, same order as `squidCorpse`.

## Evidence
- Bytecode-read (javap xc.e): the tail has no isRemote test; draws are Z.nextGaussian (and ahb.s.nextInt(4) when armoured, Z.nextFloat/Gaussian for Invul). Conversion, ya.a and sv.bo from the b83 reading.
- Port-read: the marker handling. No new executed probe.

## Verification
- `node --test src/mobs84-b84.test.js`: 4 pass. Neighbours (corpse79-83, enderman*, squid-bat*, wither*, mpwither*, zombie-villager*, mpvillage-b66, java-mobs, village-fight-b33..b39): 459 pass, 0 fail; second set (entities, entities82, village-fight, b31/b32, mpgolems-b66, fireext82): see lead run. `npm run build` ok. No full npm test, no browser.

## Follow-ups
- A zombie that dies in the same tick it converts (fire) goes through `dying` then gets the marker; its drops/experience are not modelled as a native dead-but-living mob would.
- Replayed native records for the live conversion tail and an executed squid push probe are still missing.
