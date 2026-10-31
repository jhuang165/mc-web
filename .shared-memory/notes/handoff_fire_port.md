Claude handoff, 2026-10-31, branch work/fire (not pushed; orchestrator merges).

Changed: ported 1.7.10 fire. Block 45 (FIRE, hidden, vanilla id 51) and item 126 (Flint and steel). Reserved ids not used: blocks 46/47, items 127/320-322.
- src/fire.js: BlockFire rules (alb), static-lava ignition (ant), lightning-bolt fire (xh), fire contact, renderBlockFire vertices, and the Fire runtime (scheduled ticks, random-tick approximation, crackle).
- Wiring: world.js (block), lighting.js (light 15, opacity 0), scene.js (animated fire_layer_0/1), main.js (flint and steel, left-click extinguish, player contact), weather.js (bolt hook), entities.js/item-entities.js (burning), survival.js (item and recipe), creative.js, shadows.js.
- Evidence: tools/probes/FireProbe.java, tools/verify-fire.mjs, public/research/fire-reference.json (probe, original classes). Entity.moveEntity, WorldServer ticks and ItemFlintAndSteel are bytecode only.
- Docs: public/research/fire.md, parity.md Fire row, weather.md, lava.md, fluids.js header.
- Audio: fire.fire and fire.ignite added to the manifest (165 entries; the importer regex was extended but a full importer run was not made).
Tests: npm test 343 pass, npm run build clean. Headless Chrome check: fire animates, spreads, burns planks and burns out.
Gaps: Normal difficulty fixed, humidity ignored, no End/netherrack/portal/TNT, approximated random-tick set, ticks not saved, no first-person or burning-mob fire render, no flame/smoke particles.
Merge hazards: world.js BLOCKS, survival.js ITEMS, main.js, scene.js, media manifest and media.test.js count, creative.js and creative.test.js, lighting.js, weather.js, shadows.js, inventory-reference.json and shadow-reference.json (regenerate if other branches add items or blocks).
