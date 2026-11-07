# Batch 22 lead (claude-b22-lead, 2026-11-07)

## Summary
Five Sonnet tracks in manual worktrees `../wt22-<name>` on `batch22-<name>` (cut from 674d91b), merged into main with `--no-ff`: debugkeys (ba74640), villagers4 (e03152b), containerui (aa50868 + 1cf34d3 label regression test), spawning5 (71b2ce1), loading3 (aa79844). Per-track notes: `*-b22-track.md`.

Merge conflicts: only the `src/main.js` import block (loading3 `nextFrame` vs spawning5 `attachRing`/`wrapMobHooks`); kept every import. `scene.js` auto-merged (spawning5 ring guards in updateBlock/updateBlocks plus loading3 light slicing).

Lead review: containerui's first inventory screenshot lacked "Crafting"; the screenshot was stale (taken before the `data-bitmap` markup fix), re-shot and pinned by a test. debugkeys' Chrome used port 9333 shared with another track; loading3 and spawning5 confirm their measurements came from their own ports (9493, 9335).

Not staged: an uncommitted `vite.config.js` BASE_PATH change (tools/vite-base-path.mjs) from other work, left as found.

Version 0.52.0.

## Verification
- `npm test` 4341 pass, 0 fail on merged main; `npm run build` ok.
- Muted headless Chrome on :5189 (server stopped afterwards): new world (gen 18) in 1.5 s, longest long task 93 ms, ring 284 columns, 121 mobs, native F3 and inventory shell (`artifacts/b22-lead/f3-merged.png`, `inventory-merged.png`), no console errors.

## Follow-ups
- Portal trips: `TerrainPeek.portalColumns` invariant (terrain holds no portal block) is unprobed; Overworld return ~8 s wall.
- Light slices still on the page thread.
- Ring: projectiles, items, orbs, falling blocks, redstone, fluids tick only in the window; ring edits get no mesh/light until resident.
- Zero-size stacks: mob equipment and main inventory still drop them; container clicks on a zero armour slot unprobed.
- Horse and villager container screens not opened live; book width assumed.
- F3+C does not exit; hitbox widths partly assumed.
