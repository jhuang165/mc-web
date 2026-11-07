# i18n track (batch 16)

Branch b16-i18n, base main 60d9af0 (app 0.45.0).

Changed: `tools/probes/ItemKeyProbe.java` + `tools/verify-item-keys.mjs` -> `public/research/item-keys-reference.json`, `src/item-keys-data.js` (ITEM_KEYS per original id/damage, EGG_ENTITIES). `src/item-names.js`: `localizedItemName`, `localizedPotionName`, `displayName` (= stackName; custom name, then language, then baked English). `src/container-names.js` (default English title -> lang key). `lang.js` gained `translate(key, fallback)`. Wired: main.js (container titles and bag labels, 6 lines), gui.js tooltip (unbreakable, attack damage), potions.js tooltip, bed.js BED_TEXT (getters), note-jukebox-content.js nowPlaying, lang-hooks.js (enchantment names overlay).

Tests: item-names.test.js (en_US table as selected language reproduces every baked name; inline German-like fixtures; reference replay), container-names.test.js, lang-strings.test.js. None read fetched `.lang` files. `npm test` 3698+ pass, `npm run build` ok.

Facts: 1.7.10 keys are old style (`item.ingotIron`, `tile.stonebrick` = cobblestone), not modern names. Only potion (373) and spawn egg (383) compose names; skull and written book are plain lookups in the probe.

Remaining: firework tooltip lines, horse/merchant/beacon GUI inner labels, creative tab names, mob names in F3/boss bar/nametags, item.skull.player, `Durability:` stays English as in the original, drawing item text with the bitmap font, bidi/shaping. A browser check with a fetched language was not done.
