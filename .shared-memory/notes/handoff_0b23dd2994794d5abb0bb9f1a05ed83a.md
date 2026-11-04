0.39.0 five-Sonnet tranche committed and pushed: 1f43256 (jhuang165/mc-web main). The tranche finished the interrupted redstone batch and added witches and villager trading.
Tracks:
- Redstone blocks 119-131: the redstone-blocks-2 family, native recipes, and regenerated shadow-reference and metadata catalogue.
- Live redstone: redstone-runtime.js, wired into main.js for finite and streamed worlds.
- Live pistons: piston-live.js with cached moving meshes, push, save, and Java Piston tile import/export.
- Witch: witch.js, witch-potions.js and witch-renderer.js; items 384 and 385.
- Villager trading: merchant-ui.js, plus a VillagerTradeLiveProbe with 60 sessions.
Lead fixes:
- projectiles rayBounds now routes 119-130 through blockBounds.
- The projectiles test skips the metadata-shaped anvil and the 119-129 blocks in its default-box check, because the regenerated shadow probe records constructor defaults.
- main.js dev handle gains `__mc.redstone`.
Validation:
- npm test 1608/1608; build passes (existing large-chunk warning); push:github reran suite, bridge tests and build before the push.
- Localhost 5181 ?silent check: lever, dust and lamp light; sticky piston extends, retracts and pulls stone back, rendered with the arm; lamp turns off after 4 ticks; no console warnings.
Open items are in PROJECT.md 0.39.0 paragraph and parity.md. Two agent handoff notes from the witch and trading tracks are included in the commit. No Site publication and no full-parity claim.