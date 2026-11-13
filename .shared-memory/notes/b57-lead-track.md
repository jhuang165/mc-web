# Batch 57 lead (2026-11-12)

Ten Sonnet tracks were cut from 21c490724 (release 0.85.0) in `../wt57-<name>` on `batch57-<name>` and merged --no-ff on `batch57-lead`. Every track followed `../artifacts/b57-lead/track-rules.md` (targeted tests only, no full `npm test`, muted headless checks on their own port). Release 0.86.0.

## Merges
- crystalfire (e67973a76), trackerspawn (b558105cb), chatmulti (afc52572f), horsesounds (fd8459603), savedorder5 (ea39b8705), boatcollide (040beb5e6), prediction3 (b61b88d58), displaypixel (ee6e1bbda), mpdig (9d07110b8), itemtags (7f3afaf9b).
- One conflict: `src/main.js` between prediction3 and crystalfire (the client-prediction import and `showPrediction`). Kept both: the crystal fire layer line and prediction3's `drawPrediction` wrapper.
- Found wrong by the tracks (with evidence in their notes): the network spawn one update early, the Nether/End spawn grid, the horse `bq` starters, lead/bed/sign/skull prediction.

## Lead fixes
- 7859f4929: `src/display-pixel-cases.js` renamed `display-light-cases.js` ("pixel" is an ad-blocker word, `module-names.test.js`); `player-throw-replay.test.js` binds `mutePlaceSound` (prediction3 put it in the `playSound` hook).
- c591f278f: End crystals wrote the original fire id 51 raw into the port world, where 51 is the cobweb (pre-existing since batch 6; `end.test.js` pinned it). `ender-crystal-mobs.js` maps the rule's original ids to port ids (`portId`, `originalId`) for the server crystal and the client layer. `Scene.showPredictedCells` skips columns that are not loaded chunks: with `ringSink` detached for the swap, a ring cell read threw (found by the smoke in the End, every crystal tick).

## Verification
- Full `npm test` once on the merged branch before the lead fixes: 6826 tests, 6824 pass, 2 fail (the two fixed in 7859f4929). `npm run build` ok. Bridge unittest OK.
- After the fixes, targeted only: throw replay, module names, display pixel (11); crystal fire, dragon death, End, client prediction b55/b56/b57 (42). All pass. `npm run push:github` runs the full suite again before the push.
- Muted headless smoke (`artifacts/b57-lead/smoke.mjs` and `boat.mjs`, vite 5590, killed afterwards; Survival with cheats):
  - Door toggle seen 25 ms after the press, real 80 ms, one `random.door_close`. Water bucket: predicted 27 ms / real 59 ms in the first run, the same frame (68 ms) in the second (timing-dependent, as in b56).
  - `/give` kept Lore ["Sharp","Old"], SkullOwner "Notch" and CustomPotionEffects [{id 1, amplifier 1, duration 400}]. `/tell @p hello` gives `commands.message.sameTarget` (red); `/me waves` prints `chat.type.emote`.
  - Held leaves and ladder screenshots (`held-leaves.png`, `held-ladder.png`).
  - Ridden boat: copy z within 0.01 of the live boat as it sped up; at 0.25 it hit the second boat and broke (native break rule above 0.2), boat count 2 -> 1.
  - Horse ridden, copy flags 6.
  - End: 15 crystals, fire under them, no cobwebs, no errors. Ticks 160 per 8 s in the Overworld, the Nether and the End; no long tasks while turning. Only the known 404.

## Follow-ups
See "Still open from batch 57" in `public/research/remaining-gaps.md`.
