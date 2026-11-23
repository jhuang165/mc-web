# mobrec98 (batch 98) track note

Worktree `wt98-mobrec`, branch `batch98-mobrec98`, from 3dd97fce9 (0.126.0). Scope: villagers, the largest unrecorded mob. Nothing here claims full parity.

## Summary (file by file)
- `tools/probes/VillageFightProbe.java`: new `b98-` scenarios (32 records) run real `yv` EntityVillager through the VillageLiveProbe world double. New script ops `day on|off`, `babyv k`, `agev k n`, `trade k` (`a_(player)` + `b(player)`), `untrade k`, `buy k`, `door x z meta`. Row element 8 lists every villager (starting, then born) as `[growingAge, isMating, isPlaying, hasCustomer, timeUntilReset, needsInit, riches, offers (-1 none), uses[], maxUses[], Regeneration ticks, randomTickDivider]`. `Collections.r` (the shared Random behind `Collections.shuffle` in `yv.a(agn)`/`b_`) is reseeded per record (`987654321 + seed*7919`) so records are reproducible; the java run needs `--add-opens=java.base/java.util=ALL-UNNAMED`.
- `tools/verify-villagers98.mjs` (new): builds the probe with the SeedRandom/SeedMath class edits, runs it, writes `public/research/village-fight-b98-reference.json` (AI tasks), `-b98-trade-`, `-b98-breed1/2/3-reference.json` (each under 2 MB).
- `src/village-fight-replay.js`: `fightReference98` (the five files merged), ops `day`, `babyv`/`agev` (anchored shrink as in b87), `trade`/`untrade`/`buy`/`door`, per-record shuffle Random, `villagerRow`, and a row-8 compare in `firstDivergence`.
- `src/villager.js` (fix 1): `LookAtTradePlayer` now runs the inherited WatchClosest timer: start draws `40 + nextInt(40)` on Entity.rand, continue needs a live target within 8 blocks and `timer > 0`, update looks then `timer--`. It used to draw nothing and end with the customer flag.
- `src/entities.js` (fix 2): `spawnVillagerChild` draws the follow-range gaussian on the child's own Entity.rand (`onSpawnWithEgg`), then World.rand.nextInt(5) for the profession, and sets yaw 0 (the head keeps its default).
- `src/mobrec98-b98.test.js`: 36 tests (32 record replays plus pins for the look timer, restock fields and reputation, birth).

## Evidence
- Executed: 32 records with `firstDivergence` null: night indoors (9801-9803), day wander (9804-9805), dusk (9806-9807), door walks (9808-9809), flee from a zombie night and day (9810-9811), breeding gates (9812-9817, 12-door village, no birth), one birth (`b98-breed-birth-9902`, tick 635: parents to age 5999, child -23999), three villagers (9818-9819, 9819 a birth-side child), child at play and at night (9820-9822), trade look (9830-9831), walk away (9832), restock (9833-9837: needsInit, 40-tick reset timer, riches +1, Regeneration, max uses 7, offer count; 9836 with the screen open), trade at night (9837), trade with a child (9838). 19 of them already matched before any fix, so wander, move indoors, doors, avoid zombie, breeding gates, restock and child play were already native.
- Bytecode-read: `uo` overrides only `shouldExecute`; `un` start/continue/update as above (it does not test isTrading, so closing the screen does not end the look). `yv.b(rx)` is `new yv` then `onSpawnWithEgg(null)` (`yv.a(sy)`: gaussian bonus, then World.rand.nextInt(5)). `up.g`: mate and parent age 6000, child -24000, `setLocationAndAngles(parent, 0, 0)`, `spawnEntityInWorld`, entity state 12. 1.7.10 has no separate "willingness" gate beyond adult age 0, the `nextInt(500)` roll, enough doors (`villagers < int(doors*0.35)`) and a mating season; read in part, not proven end to end.
- Port-read: yaw 0 on the child is not visible in the record (rows do not compare it); the heart particles at the child and villager sounds are not compared.

## Verification
- `node --test --test-concurrency=2 src/mobrec98-b98.test.js`: 36 pass, 0 fail.
- Without `src/villager.js` and `src/entities.js` fixes (checked out aside, then restored): 13 of 36 fail (all trade records, 9902, 9819, the look and birth pins).
- 33 test files naming the edited files or the replay (village*, villager*, village-fight-b3x/b4x, mobrec86/87/90, zombie-villager*, mpvillage/mptrade-b66, pathfinding, bed, corpse, convert, spcopy91, docs-sweep and the new test): 457 pass, 0 fail. No full `npm test`, no build (no imports of shipped code changed), no browser.

## Found wrong in the batch 97 list
- Nothing in the batch 97 list was wrong. Found wrong in the port: the LookAtTradePlayer timer and its i40 draw, the born child's missing gaussian, and the child's yaw copied from the parent.

## Follow-ups (open)
- Only one birth record (9902); births are rare (1 in 60 "VV" seeds of 2400 ticks, none in 60 "VVV" seeds), so the breeding path is thin.
- Not compared: heart particles at the child, villager sounds, the child's yaw. The probe player is a plain double, so the customer name "probe" is mapped in the replay; `babyv`/`agev` mid-run shrink is a replay-only device.
- Not recorded: a child following an iron golem holding a rose, villager-to-zombie conversion paths (b85/b86 cover those), a trade with a real EntityPlayerMP.
- Browser-only: none identified (no browser checks run).
