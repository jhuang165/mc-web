# i18n2 (batch 17 translations round 2)

Branch b17-i18n2. Routed through `translate(key, fallback)`: firework star/rocket tooltip lines, creative tab labels, horse inventory title, trade and horse "Inventory" label, beacon labels/button tooltips/power names, Ender Dragon and Wither boss bar names. English (US) is byte-identical (nothing found wrong).

Evidence: `tools/probes/KeyTraceProbe.java` (key-echoing StatCollector over the unchanged jar) -> `tools/verify-lang-keys.mjs` -> `public/research/lang-keys-reference.json` -> `src/lang-keys.test.js`. Probed: 12 creative tab keys, 28 firework tooltip fixtures (incl. every dye). Bytecode-read (javap): beacon GUI `bez/bfa/bfb/bfc`, merchant GUI `bfv`, horse `wi.b_`, `sa.b_` (boss bar names); keys asserted to exist in en_US.

No src/main.js or src/gui.js edits (creative tab `name` is now a translating getter). Edited: fireworks.js, creative.js, horse-gear.js, pyramid-gui.js, merchant-ui.js, dragon.js, wither-boss-renderer.js, languages.md.

Tests: npm test 3805 pass, 0 fail; npm run build ok.

Remaining: F3 entity names, custom-named bosses on the boss bar, attacker death messages, invented aria-labels; Bidi/Arabic still out of scope.

Proposed replacement for the remaining-gaps.md "One local player" translations wording (Priority 5), if it lists these items: "Translations: item/block/container/potion/enchantment/bed/firework/creative-tab/horse/beacon/trade/boss-bar text is routed through the 1.7.10 lang keys (languages.md); left: F3 entity names, attacker death messages, bidi/Arabic shaping."
