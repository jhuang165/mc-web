# Batch 71 mobfixes71: Weakness on mobs, slime split cap, four spawner kinds, XP orb target

## Summary
- `src/mob-effects.js`: `attackDamage` adds Weakness (id 18, `-0.5F * (amp + 1)`, operation 0) before Strength (operation 2).
- `src/entities.js`: `splitSlime` lost the 40-mob cap (guard `SLIME_SPLIT_GUARD` 5000); `spawnerHooks.canSpawnHere` has a villager branch (space checks only).
- `src/mob-spawner.js`: `SPAWNER_ENTITY_IDS` + Squid, Bat, LavaSlime, Villager; a Slime spawner counts magma cubes; display entity fields (`size`, `profession`).
- `src/experience.js`, `src/multiplayer/server-items.js`: `tickOne(..., players)` keeps `orb.who` like `EntityXPOrb.closestPlayer`; `tickOrbs` passes the player list.
- New: `tools/probes/MobWeaknessProbe.java`, `tools/verify-mob-weakness.mjs`, `public/research/mob-weakness-reference.json`, tests `mob-weakness-b71`, `slime-split-b71`, `spawner-mobs-b71`, `xp-orbs-b71`.
- Docs: slime.md, xp-orbs.md, squid-bat.md, difficulty.md, mob-spawner.md ("Batch 71" lines).

## Evidence
- Executed: Weakness x Strength attack amounts (84 records, unchanged classes).
- Bytecode-read: `rs.a` and `rv.<clinit>` (operations), `ym.B` (no count test), `ws.by`/`wu.by` (squid: height band and entity collision only, no water), `we.by` (bat), `yf.by`, `td.by` with path weight 0 (villager), `sq.h` (closestPlayer kept until null or distance squared > 64).
- Found wrong: "squid needs water" (native squid spawner needs only 45 < y < 63 and a free box). Single-player orbs already kept their target (one player).
- Recalled: none.

## Verification
- `node --test` on the four new files: 3 + 2 + 8 + 4 pass. Related files (xp-orbs, experience, slime, spawner, difficulty, attributes3, interchange-spawn, mob-effects, mp spawner/items, witch, squid-bat and others, 317 tests): all pass.
- `npm run build` run once. Full npm test not run (batch rule).

## Follow-ups
- Browser only: the spinning display of the four new kinds, slime display size (native rolls 1/2/4 unseeded; port shows 1).
- Multi-player orb targeting is bytecode-read, not executed (the probe player is an EntityPlayerSP double).
- Zombie/pigman and cow/mooshroom spawner counting by subclass is unchanged.
