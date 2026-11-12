# awayorder (batch 50)

## Summary
- Away run list order probed and replayed: 8 executed scenarios (`b50ao-*`: mixed item, orb, arrow, cart, boat, painting, cow joins and removals, reversed, mixed and late joins, mid-pass kills). The away run already matched (8 of 8), so no walk change was needed.
- Dispenser hosts (src/away-world.js, and a minimal hunk in src/main.js): dispensed arrows (away only), thrown balls and potions now stamp `joined` so they take their place at the end of the list; exp bottles and potions go through the potion list (`mobs.potions.projectiles`, walked as "potion").
- src/dispense.js: Bottle o' Enchanting (1951) is now a projectile dispense (was a dropped item); the fire charge draws its acceleration from `world.rand` (it used an entity/host stream).
- Away items and orbs each own a seeded Entity.rand (src/away-entities.js `ownRandom`), separate from the run's shared stream, so the run still replays.

## Evidence
- Executed: tools/probes/AwayOrderProbe.java (real 1.7.10 jar, EntityListProbe.scenario) -> public/research/away-order-reference.json (regeneration is byte-identical), replayed by src/away-order-b50.test.js through src/away-order-replay.js against the away run's `awayEntities().tick()`.
- Bytecode-read (javap): ku (exp bottle dispense: EntityExpBottle zn, inaccuracy 6.0F*0.5F, velocity 1.1F*1.25F as the potion kv), kk (projectile base: velocity 1.1F, inaccuracy 6.0F, heading dy+0.1F), kz (fire charge uses world.rand).
- Existing executed dispense-reference.json still covers arrow/egg/snowball/potion headings and drop motion.

## Verification
- `node --test src/away-order-b50.test.js` 12/12.
- `node --test src/away-*.test.js src/dispense.test.js src/dispenser-piston*.test.js src/entity-list.test.js src/dimension-away.test.js src/fireballs-b4*.test.js src/fireballs-native.test.js src/experience.test.js src/item-entities.test.js src/potion-use.test.js src/potions.test.js` 328/328.
- `npm run build` ok. No full npm test run (batch rule).

## Follow-ups
- Saved cross-kind list order (items vs mobs vs arrows from a save) is not stored; unstamped entities go after known mobs in walk-kind order.
- The away run has no player, so orb pickup and the probe's player shell are not replayed.
- Spawn eggs are not dispensed (native BehaviorDispenseSpawnEgg).
- Item-frame hit drop in the away run (hangingDrop) was not re-probed against HangingProbe frame records; its motion uses the run's stream.
- Exp bottle dispense heading is bytecode-read only; no executed AwayDispenseProbe record yet.
