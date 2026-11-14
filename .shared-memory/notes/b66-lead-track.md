# Batch 66 lead (claude-b66-lead), release 0.95.0

Ten Sonnet tracks in `../wt66-<name>` on `batch66-<name>`, cut from 0.94.0 (7b61f6b49), merged --no-ff on `batch66-lead`. Rules: `../artifacts/b66-lead/track-rules.md`. No browser checks (user request).

Merged (track note `<name>-b66-track.md` each): mpvillage 8c4242faa, mptrade 326d1e163, mppistons a7d75fb70, mplightning 321de5268, atlasunify abdf1fef5, mpgolems a602272a0, mpbooks 6b2b03b58, mpend3 beffacce3, bonemeal2 fb19f390e, mpsleep 224e9d5fa.

Conflicts and joins:
- mptrade into mpvillage: `server-mobs.js` interact keeps mpvillage's `villager` hook calling `this.villagerUse`, which mptrade's `installTrade` fills (`simulation.js`). mpvillage's stub test now asserts the hook is installed.
- mplightning: `main.js` keeps the pistons and lightning lines side by side; the track had put `remoteLightning = null` inside a comment in `leaveMultiplayer`, now a real statement.
- mpgolems: `server-mobs.js` imports both modules; the mob cap skips wither, villager, iron golem and snow golem.
- mpbooks: `server-nether.js` imports both pistons and music. Checked: the piston wrapper changes only piston behaviours' `onBlockEventReceived`, music sets the note block's, and only music wraps `redstone.save`.
- bonemeal2: `main.js` `onAux` keeps mpbooks' 1005 record branch and adds the 2005 `sparkle` callback.
- mpsleep: both sides kept in `main.js` (`onBolt`, `onSleep`) and `simulation.js` (bed and music clicks); `this.sleep.worldTick()` runs before `this.lightning.tick()`, as WorldServer.tick skips the night (after super.tick's weather) before tickBlocksAndAmbiance rolls the bolts.
- mpend3: merged clean. Legacy Ends predate `musicTiles` and `pistonTiles`, so the upgrade needs no new keys.

Test fix after the full run (test files only, 18bac2220): four tests used villager or silverfish as the "kind the server cannot show"; the giant is the one kind left outside `SUPPORTED`. The dispenser test now hatches a villager egg; its "egg kept" half is gone, since the giant has no spawn egg in 1.7.10 (EntityList.entityEggs).

Lead decision: mpend3 kept the 256 End window; tails past 128 blocks (measured to about 166, a 336 window covers 48 of 48 seeds) are an open item, not changed here.

Verification on the merged tree: `npm test` 7794/7798 (`../artifacts/b66-lead/npm-test.log`), the four failures the tests above; after the fix the three files pass 34/34 (mpdispense-b61 15, mpmobtypes-b61, mpspawners2-b65). `npm run build` ok; bridge 5/5. Targeted after merges: lightning + pistons 15; atlas joins 26; the six mp tracks 46; books joins 68; End joins 34; bone meal joins 44; sleep joins 54. No second full run (one full run per change).

Open: see "Still open from batch 66" in `public/research/remaining-gaps.md`.
