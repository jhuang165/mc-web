# Batch 65 lead (claude-b65-lead), release 0.94.0

Ten Sonnet tracks in `../wt65-<name>` on `batch65-<name>`, cut from 0.93.0 (800542e52), merged --no-ff on `batch65-lead`. Rules: `../artifacts/b65-lead/track-rules.md`. No browser checks (user request).

Merged (track note `<name>-b65-track.md` each): mpinvis de69e38f1, mpdragon2 6ef106d3c, itemsprites2 1ce909c53, mpuse2 aec26cf89, terrainatlas e3e91e0c6, trackertransient2 eac5599f9, mpstats3 fc88c8d8e, mpendwindow faeec65ed, mpspawners2 9dea1116e, clientreplays c1b37bc65.

Conflicts: only `main.js` `makeRemoteDispense`: mpdragon2's `eyeTrail` and mpspawners2's `spawnerBurst` / `spawnerDelay` / `spawnerPuff` kept side by side. Everything else merged clean.

Lead fix (98d7ca3e6):
- **S19 status 9.** mpuse2 recorded that the server sends no "use finished" message. Bytecode says otherwise: `EntityPlayerMP.onItemUseFinish` (`mw.p`) sends `new S19PacketEntityStatus(this, 9)` on its own connection before `EntityPlayer.onItemUseFinish`. The server's `tickUse` now queues `{ type: 'useDone', id }` on the eater's `itemsOut` (ahead of the S2F of the eaten stack). The client routes it in order (`DedicatedClient.onUseDone`), and `finishPredictedUse` (`client-use-predict.js`) plays updateItemUse(16) (16 crumbs and random.eat, or one random.drink) and clears the use. The client's copy of ItemFood.onEaten is skipped: its stack change is replaced by the S2F and its burp is silent on a client. Test: `src/b65-lead.test.js`.

Lead decisions:
- clientreplays' `CLIENT_PUSHES_PLAYER = false` kept. I checked the bytecode myself: in `sv.e`, the "push" section calls `bo()` (collideWithNearbyEntities) only `if (!world.E)` (isRemote). The controlled player is no longer pushed by mobs. This reverses batch 46's reading.
- The Java 7 effect order stays off (the game uses Java 8's), as clientreplays left it.
- The "Still open from batch 46" egg / exp bottle / pearl line stays: `entity-flight-reference.json` has no vehicle or painting hit cases.

Test fix after the full run (test file only): `ai.test.js` "a damaged cow flees along a path": the cow's Entity.rand (`entityRandom`, seeded from Math.random) picks the panic spot, which now and then lands within a block; first failure in ten batch runs, ai.js unchanged this batch. The test now seeds the cow (`setEntityRandom`, JavaRandom 65). The whole file passed 6 of 6 before the fix and 4 of 4 after.

Verification on the merged tree: `npm test` 7705/7706 (`../artifacts/b65-lead/npm-test.log`), the one failure the cow test above; `npm run build` ok; bridge 5/5. Targeted after the merges: b65-lead 2, mpuse2-b65 + mpclientanim-b64 31, the End/dragon/stats joins 26, spawners/dispense joins 34, clientreplays + mobpush-b46 + fishing + mpstats3 49. No second full run (one full run per change).

Open: see "Still open from batch 65" in `public/research/remaining-gaps.md`.
