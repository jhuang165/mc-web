# Batch 78 packs78: pack row text, straight-alpha frames and tint icons, flower pot damage

## Summary
- `src/resource-packs-ui.js`: pack row descriptions now follow `getFormattedText`. A valid description is drawn as text + "§r"; a pack without a usable `pack` section is "§c" + "Invalid pack.mcmeta (or missing 'pack' section)" with no reset (whatever error text the loader stored is ignored). The Default row gets the bundled description + "§r". Wrapping is a port of `FontRenderer.listFormattedStringToWidth` (`wrapFormatted`: break at the last space, newline, bold width, and the active format code prefixed to each continuation line), replacing the plain `splitLines`.
- New `src/straight-frames.js` (pure): `fetchDecoded`, `frameRgba`/`frameUrl` (cut a strip frame), `tintRgba`, `eggRgba`/`eggUrl` (two tinted layers composed source-over). PNGs are written with `encodePngStored`, so the pixels read back as stored.
- `src/item-animation.js` cuts pack animation frames from decoded pixels (canvas cut kept as the fallback for a PNG the decoder refuses); `src/maps-clock-live.js` cuts clock frames the same way; `src/spawn-eggs.js` bakes the two-layer tinted egg texture from decoded pixels (canvas compose only when the decoder fails). Before the decode finishes the callers behave as before the images load (raw strip / untinted base).
- Flower pot damage values: documented, not changed (below).

## Evidence
- Executed: gui-menus-reference.json rows GuiScreenResourcePacks+packs / +packs+selected: "A short description.§r", "§aGreen§r and plain text§r", two wrapped lines of the long description, gray 0x808080 at y+12 / y+22, name white. The new test replays them with no trailing-reset stripping (the b77 test stripped it).
- Bytecode-read: `ResourcePackListEntryFound` (bgi) `a()` = `brf.e()`: `bsg.a().d()` (IChatComponent.getFormattedText) or `EnumChatFormatting.RED + "Invalid pack.mcmeta (or missing 'pack' section)"`; `b()` = `brf.d()` the pack name. `ResourcePackListEntryDefault` (bgh) `b()` is the literal "Default", `a()` the bundled pack's metadata text (or "§cMissing pack.mcmeta :(" when absent: a probe artefact, the probe double has no pack.mcmeta; a real client shows "The default look and feel of Minecraft§r", Port-read DEFAULT_DESCRIPTION). `ResourcePackListEntry.drawEntry` (bgg): name trimmed to 157 with "...", white; `listFormattedStringToWidth(a(), 157)` at most two lines at x+34, y+12 / y+22, 0x808080. FontRenderer `sizeStringToWidth` / `getFormatFromString` were written from recall of the 1.7.10 source and checked only by the executed wrapped rows (plain text) and unit cases.
- Port-read: item-animation / maps-clock-live / spawn-eggs used `drawImage` + `toDataURL` on a 2D canvas (premultiplied). Recalled: a canvas re-rounds partly transparent texels. The new test builds texels the premultiply round trip provably changes (alpha 3, 77, 128, 254) and checks the data URL decodes to exactly the strip's rows.
- Not changed: the canvas atlas fallbacks inside block-textures.js (`tinted`, `iconRaw` last line) only feed the fallback when `exactLevels` is null; exact tile bytes already drive the GL atlas and the translucent/box/flat icons (`softIcon`, `rasterIcon`). Chest and potion composites were not found as canvas paths other than that fallback. The enchanting-glyph and screenshot canvases are not pack frames.

## Flower pot damage values (documented, not fixed)
- The port drops them at the item catalogue, not in the pot: `itemFromOriginal` returns no stack for dandelion/mushroom/cactus/dead bush at damage 1-15, red flower 9-15 or sapling 6-15, so those 113-minus-held native stacks never reach `potUse`. `potPlantOf` also refuses red flower > 8 and sapling > 5, so `potFromNbt` turns a native pot holding such a plant into an empty pot (single-icon plants keep the plant and lose the damage value).
- A pot-only hold would be partial and misleading: the damage is the block metadata, the break drop and the pick-block stack, which the port could only emit as an unrepresentable stack. Drawing sapling 6-15 and flower 9-15 also needs the native icon clamp for those damages, which `pot-sweep-reference.json` does not record (only plant block and render type). Left open.
- A cheap partial step for a follow-up: carry the native `Data` on the pot record for NBT round trips only, accepting that drops and pick stay at damage 0.

## Verification
- `node --test src/packs78-b78.test.js`: 6 pass. Related files (guireplay76-b76, worldflags77-b77, resource-packs, spawn-eggs, spawn-egg-rolls-b52, sprite-frames, itemsprites2-b65, item-passes, item-names, maps tests, catalogue tests, others importing the touched modules): 180 pass, 0 fail.
- `npm run build` once at the end. Full npm test not run (batch rule). Nothing checked in a browser; only a browser could show that the data-URL frames and the baked egg display unchanged.

## Follow-ups
- Format codes in a pack's own chat-component object description (`{"text":..., "color":...}` with style or `extra`) are not formatted; the port reads the plain `text` only.
- Pot damage values above (not fixed).
- Browser-only: the first frames before the async decode finishes still show the raw strip / untinted egg for a moment, as before image load.
