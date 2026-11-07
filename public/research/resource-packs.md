# Resource Packs (GuiScreenResourcePacks, ResourcePackRepository)

Target: Minecraft Java 1.7.10. Not full parity; see "Remaining differences".

## Evidence

Bytecode-read with `javap -c` on the pinned client jar (sha1 e80d9b3b...), **not probed** (GUI classes need GL and a running Minecraft): `bgf` (GuiScreenResourcePacks), `bgk`/`bgj`/`bgl` (GuiResourcePackList, Available, Selected), `bgg`/`bgi`/`bgh` (list entries and the Default entry), `brc`/`brf` (ResourcePackRepository and its Entry). Numbers taken from them:

- Buttons 150 x 20: "Open resource pack folder" at `width/2 - 154`, Done at `width/2 + 4`, both at `height - 48`. Title `resourcePack.title` at (`width/2`, 16) white; `resourcePack.folderInfo` at (`width/2 - 77`, `height - 26`), color 0x808080.
- Lists 200 wide: Available at `width/2 - 4 - 200`, Selected at `width/2 + 4`; slot top 32, bottom `height - 55 + 4`, row height 36, a 13 unit header holding the underlined bold list title; scroll bar at the list's right edge - 6.
- Row: 32 x 32 icon, name at (`x + 34`, `y + 1`) white (cut to 157 with "..."), description wrapped at 157, two lines at `y + 12` and `y + 22`, color 0x808080. While hovered, the icon gets a 0xA0909090 overlay and the arrow cells of `textures/gui/resource_packs.png` (256 x 256): right arrow (0, 0/32), left arrow (32, 0/32), up (96, 0/32), down (64, 0/32); the second v is the hovered variant.
- Click rules (`bgg.a`): with the pointer inside the 32 px icon, an available entry moves to index 0 of the Selected list; on a selected entry x < 16 moves it to index 0 of Available, x > 16 and y < 16 moves it up when the entry above is movable, x > 16 and y > 16 moves it down. The Default entry (`bgh`) shows no arrows and is always last.
- Selected is shown reversed relative to the repository list (`Lists.reverse`), so the top row has the highest priority. Done builds the list from the Selected rows (reversed back), calls `setRepositories` and refreshes resources; Escape does not apply the lists.
- Entry name is the file name (`brf.d`), description the pack.mcmeta description or "Invalid pack.mcmeta (or missing 'pack' section)" (`brf.e`). options.txt stores the names as a Gson string list, lowest priority first.
- The Default entry description text "The default look and feel of Minecraft" is from memory of the launcher's default metadata, not read from the jar (the jar has no pack.mcmeta).

## Implemented

- Options > Resource Packs... opens the screen (`src/resource-packs-ui.js`, hooked in `src/menus.js`). Both lists, hover arrows, move/reorder, Default entry, scrolling (wheel and bar), title/folder-info text from the lang table, Done and Escape as above.
- "Open resource pack folder" cannot open a disk folder in a browser: it opens a file picker for `.zip` packs (Shift+click: a folder via `webkitdirectory`). Zips can also be dropped onto the screen. Packs persist in IndexedDB (`mc-web-resource-packs`); there is no delete control (clear site data to remove them).
- Zip reading without dependencies (`src/zip-reader.js`): stored and deflate entries via `DecompressionStream('deflate-raw')`.
- pack.mcmeta (`pack_format`, `description` as string or `{text}`), pack.png as the icon (a bundled `misc/unknown_pack.png` otherwise).
- Selected order persists in options.txt as `resourcePacks:["a.zip","b"]` (`src/options-txt.js`, also in `blockworld.settings`).
- Loading: Done resolves the selected packs lowest to highest (top row wins), writes the winning `assets/minecraft/textures/**.png` (-> `/media/1.7.10/**`), `sounds/**.ogg` (-> `/audio/1.7.10/**` and the music stream directory) to IndexedDB and `lang/en_US.lang` to a lang table. `public/resource-pack-sw.js` (a service worker) answers requests for those URLs from the table and passes everything else to the network, so every texture user (block atlas, items, entities, GUI, particles, environment, map, CSS backgrounds) is overridden without per-file hooks. Menu strings take the pack's lang entries at page start (`initResourcePacks`).
- Refresh: where native calls `refreshResources`, this build reloads the page (the world autosaves on unload) because textures are cached in many places. The check is browser-run only (below).
- HD packs: the block atlas keeps 16 px cells and draws the first square frame of any tile scaled to 16 px (`block-textures.js frameSize`), so an HD or animation-strip block texture no longer breaks or crops the atlas. Entity, GUI, item and particle textures are sampled by UV, so higher resolution there shows at full resolution.

## Verification

- `src/resource-packs.test.js` (11 tests): zip stored + deflate entries, rejection of non-zips, mcmeta parsing, URL mapping, override order (top wins), lang merge, pack info, `applyPacks` against an in-memory store, list arrows (bgg click rules), arrow cells/layout numbers, options.txt round trip.
- Browser run (headless Chrome, muted, vite on 5191, CDP script, not kept in the repo): a folder pack replacing `blocks/stone.png` with a 1 x 1 PNG was served by the worker (88 bytes, 1 x 1) and the bundled file (223 bytes) returned after clearing; the screen rendered both lists with three packs, arrows appeared on hover, two selections reordered the lists, Done saved `resourcePacks:["Alpha Pack","Beta.zip"]` to options.txt/settings and reloaded with the worker controlling the page. Screenshots were compared by eye to the bytecode geometry, not pixel-diffed.

## Remaining differences

- The refresh is a page reload, not an in-place resource reload. First use needs the service worker (HTTPS or localhost); a hard reload (Shift+reload) bypasses it until the next normal load.
- Animated textures: the game animates water, lava, portal and fire with hard-coded frame counts in `scene.js`, and compass/clock with fixed 32 frames. `.png.mcmeta` files in packs are ignored, so a pack with another frame count animates wrongly. Atlas tiles from strips use the first frame.
- Entity models, the chest atlas (fixed pixel rectangles of `entity/chest/normal`) and the block-atlas tint maps assume 16 px / 64 px sources; an HD chest or colormap pack file will be misread. The menu font is the bundled traced font, so `textures/font/*.png` overrides have no effect. Only `en_US.lang` is read (no other languages exist here); pack lang entries reach the menu table, not every system's strings (chat translations use a separate table).
- Sounds: a pack `sounds/**.ogg` replaces the file of the same path; `sounds.json` (new events) is not read. Streamed music needs the optional music fetch.
- Pack fonts, shaders, `assets/<other namespace>`, pack_format mismatch warnings and folder packs with a nested `assets` root are not handled. No server resource packs.
- No in-place delete or reorder of packs outside the screen; a pack that fails to open shows its error as the description.
