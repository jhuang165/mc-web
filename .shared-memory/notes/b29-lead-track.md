# Batch 29 lead (claude, 2026-11-08)

Eight Sonnet tracks ran in `../wt29-<name>` on `batch29-<name>`, cut from dc7fd7a (0.57.0, equal to github/main). Each was reviewed and merged --no-ff on `batch29-lead`. Per-track notes are `<name>-b29-track.md` (ringlight's worktree is `../wt29-lighting5`, branch `batch29-lighting5`).

## Merges
- **dimrules2**: `Weather.awayOverworld`, `saveWeather`, `saveOverworldSimulation`; `importedDimensionState`; `simulation`/`worldRandom` sanitised on import; DimTreeProbe.
- **leads3**: `gearDeath` keeps the lead, `dying()` runs `leashTick`; `{lost:true}` for an unusable Leash tag; horse slots limit 64, `saddled` = slot 0 non-null; mob rider thrown with status 6; Creative drop bounds.
- **text3**: ICU 51 multi-paragraph bidi; `layoutString` reports §k picks; `SignRenderer` redraws only §k lines of visible signs (16 a frame); sign editor repaints per frame.
- **anaglyph3**: `gui-anaglyph.js` (stylesheet/inline/img/canvas conversion, MutationObserver while on), `png-codec.js`; extra GL contexts share `guiAnaglyph`; `post.syncAnaglyph()` from `setRenderSettings`.
- **mobai**: `revenge-target.js`; TaskList starts tasks after the evaluation pass; despawn check every tick (the `& 31` gate was Forge's, not vanilla's); EntityMob +2 age in light; skeleton combat task last and Entity.rand; golem silent sound draws; village fight replay.
- **interchange6**: `tile-ticks.js`; TileTicks in region import/export and whole-save merge; `redstone` runtime field with `sanitizeRedstone`; export prefers the stored `orig` cell except runtime-owned farmland, furnaces and repeaters.
- **ringlight**: `ring-light.js` `computeColumnLight`; per-column `lstate` (height map, precipitation, bulk light); weather.js ring hooks; `canLightningStrikeAt` dry early return.
- **dimperf2**: `taskPause` (MessageChannel, frame every 100 ms) for mesh/light/arrival slices; Overworld presolve while in a dimension (>= 4 cores); sliced `sectionTickCount`; on-demand ring workers (`ringSpawn`, `ringMax`, ended after 100 idle ticks).
- **Conflicts**: one, `src/world-import.js` SANITIZE (dimrules2 `worldRandom`/`simulation` and interchange6 `redstone`): both kept. Auto-merges in `src/sign-editor.js` (text3, anaglyph3), `src/entities.js` (leads3, mobai), `src/weather.js` (dimrules2, ringlight), `src/main.js` (dimrules2, dimperf2).
- **Lead fix 8a4e03e**: `HeadlessColumns.invalidateLight` now also drops the column's own height and precipitation maps. A replaced column object (arrival, adopt) restarts its stamp, so the stamp check kept a stale map (repro: a 140-high pillar adopted into a held column still read height 81). Regression test in `ring-light.test.js`, fails without the fix.

## Verification (batch29-lead b4b96a2 plus the release commit)
- `npm test`: 4777 pass, 0 fail. `npm run build`: ok. Bridge unittest: OK. `git diff --check dc7fd7a HEAD`: clean.
- Muted headless Chrome (`artifacts/b29-lead/smoke.mjs`, `nether-torch.mjs`, `prof.mjs`; vite :5301, baseline 0.57.0 on :5302):
  - New world in 1.3-1.6 s. Torch light 14/13 in all three dimensions; nether-torch 0 mismatches at 12 Nether and 2 End spots. Inventory, styled chat and anaglyph flags as before. Only console error the favicon 404.
  - No long tasks in the 15 s after arriving in the Nether or the End in either batch 29 run (baseline: 117 ms and 78 ms in the End).
  - The 20 s after a new world's load was noisy on both trees under load average 17-18 (another session's SwiftShader headless Chrome used about 12 cores): batch 29 runs 4-28 long tasks, max 75-178 ms; baseline 2-13, max 64-144 ms. A CPU-profiled batch 29 run showed 1 long task (54 ms); bulk ring light cost 487 ms over 680 columns (0.7 ms each). Not conclusive either way; recheck on an idle machine.

## Remaining gaps
- In "Done in batch 29" / "Still open from batch 29" of `public/research/remaining-gaps.md`; the batch 28 open list was trimmed.
- Batch 30 candidates: villager flee sight through doors and death-tick draws (fight replay); Overworld spawn-area ticks while away; TileTicks native probe and comparator OutputSignal; ring rim light and resident-edit invalidation; server vs client light probe; meshing in a worker; End shader warm-up; anaglyph GUI sync conversion; saved horse stacks <= 0.
