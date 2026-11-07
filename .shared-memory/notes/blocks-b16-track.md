# Batch 16 block behaviour audit

Branch b16-blocks. Added `BlockAuditProbe.java`, `tools/verify-block-audit.mjs`, `public/research/block-audit-reference.json`, `src/block-audit.test.js` and `public/research/block-behaviour-audit.md` (per-block status table).

Port fixes: explosion resistances for 10 blocks and the end portal value, materials for nether portal, nether wart and dragon egg, wart drops in `block-break-simulation.js`, skull light opacity, pumpkin and jack o'lantern support check in `block-placement-simulation.js`, Silk Touch on the double wood slab. Shared files touched: `survival.js` (one materials line), `explosion.js`, `lighting.js`, `block-placement-simulation.js`, `block-break-simulation.js`, `enchantment-effects.js`.

Remaining: lit repeater light 9 (per-cell lit state in `LiveRedstone` would need a scene emission hook), and block-by-block port replay of the neighbour, box and tick probe records.
