# Fishing track

Branch worktree-agent-af930017bc72dcefb. Fishing rod 346, EntityFishHook, fish 349/350 (internal ids 700-706).
Modules: src/fishing.js (hook, loot), fishing-content.js (items, recipe, smelting, creative), fishing-simulation.js (runtime),
fishing-renderer.js (bobber and line). Native probe: tools/probes/FishingProbe.java and tools/verify-fishing.mjs (needs MC_RESEARCH),
reference public/research/fishing-reference.json (3 tables, 7 casts, 3 reels, 2400 loot rolls). Docs: public/research/fishing.md.
Shared-file edits are small hooks: survival.js, original-items.js, item-durability.js, creative.js, experience.js, status-effects.js,
main.js (fishing host, save/load, tick), player-edit-simulation.js (rod branch), scene.js, first-person.js, player-renderer.js,
tools/inventory-replay.mjs (MC_IDS), and test counts in recipe-catalogue.test.js and merchant-ui.test.js (350 became mapped; the unmapped
probe item is now 358). Merge note: if another track adds ids 700-706 they collide. Remaining: no stats, no wake particle.
