# Resource packs track (batch 14)

Branch `b14-resource-packs`, base f832094. Details and evidence in `public/research/resource-packs.md`.

## Changed

- New: `src/zip-reader.js`, `src/resource-packs.js` (mcmeta, override resolution, IndexedDB store, apply, PackLists), `src/resource-packs-ui.js` (GuiScreenResourcePacks), `public/resource-pack-sw.js` (service worker serving `/media/1.7.10/**` and `/audio/1.7.10**` from the stored override table), `src/resource-packs.test.js` (11 tests).
- Small hooks: `menus.js` (Resource Packs... button opens the screen, import, the `UNAVAILABLE.resourcepack` reason removed), `menu-screens.js` (5 `resourcePack.*` lang strings), `options-txt.js` (`resourcePacks` is now a real field: Gson string list), `main.js` (import + one `initResourcePacks(options, LANG)` call after `createMenus`), `block-textures.js` (`frameSize`: atlas draws the first square frame of a tile scaled to 16 px).
- Docs: `resource-packs.md`, `remaining-gaps.md` item 9, `parity.md` rows.

## Merge hints

- `menus.js` conflicts: keep the new import line and the `show(resourcePacksScreen(ctx, () => screen, show))` button; `menu-screens.js`: keep the lang line before `options.resourcepack`.
- `gui-parity-catalogue.md` / `settings-parity-catalogue.md` still say Missing for GuiScreenResourcePacks (generated files, not edited).

## Not done

Applying packs reloads the page; pack `.mcmeta` animation, HD chest/colormap/font, `sounds.json`, other languages are not read.
