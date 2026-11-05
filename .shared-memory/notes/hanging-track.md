# Hanging entities track (paintings, item frames)

Status: implemented on worktree branch; see `public/research/hanging-entities.md` for rules and evidence.

- New modules: `src/hanging.js`, `hanging-interaction.js`, `hanging-renderer.js`, `hanging.test.js`; probe `tools/probes/HangingProbe.java`, `tools/verify-hanging.mjs` (run with `MC_RESEARCH=.../tools/research`), reference `public/research/hanging-reference.json`.
- Small edits in shared files: `main.js` (state, aim, edit hook, tick, render, save/restore), `survival.js` (items 1700/1701 + recipes), `original-items.js` (321/389), `chunk-runtime.js`, `explosion-simulation.js`, `bow.js`, `region-export.js`, `population-creative.js` (regenerated).
- Gotchas: rotation is `% 4`; 26 arts; inverted thickness box; no entity overlap check; tick fires on the 101st update.
- Todo: region import, maps in frames, adventure-mode check, frame UV cropping, browser verification of rendering.
