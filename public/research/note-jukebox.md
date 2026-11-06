# Note blocks, jukebox and the twelve music discs

Target: Minecraft Java 1.7.10. Names are the obfuscated classes of the unchanged client JAR (`tools/research/`, not shipped). Full parity is not claimed.

## Classes

`amj` BlockNote, `apl` TileEntityNote, `alq` BlockJukebox, `alr` TileEntityJukebox, `adr` ItemRecord, `xz` EntityCreeper (onDeath), `bbv` GuiIngame (record text), `bkl` EntityNoteFX, `qh` MathHelper.

## Evidence

`node tools/verify-note-jukebox.mjs` (with `MC_RESEARCH=tools/research`) compiles `tools/probes/NoteJukeboxProbe.java` against the jar, runs the unchanged classes on a map-backed probe world and records `public/research/note-jukebox-reference.json` (200 records: facts 2, trigger 69, instruments 1, event 6, click 4, click-no-tile 1, redstone 2, note-nbt 11, disc 12, empty 1, eject 72, jukebox-nbt 4, jukebox-legacy 8, creeper 5, hud 1, note-colour 1) plus the en_US strings and the two CraftingManager recipes. `src/note-jukebox.test.js` replays it. The instrument table is probed over every original block id 0-175, not guessed from materials.

## Ids

Internal blocks 177 (note block) and 178 (jukebox) map to original 25 and 84; their items are 1177 and 1178 (1000 + block id). The discs are items 530-541 for original 2256-2267. Internal block ids 140-176 belong to other tracks of the same release; until they are defined, `installNoteJukeboxBlocks` fills them with `reserved` placeholders that are never listed, mapped or placeable (tests skip them).

## Ported

- Note block: right click raises the note 0-24 (wrapping) and plays it; left click plays it in Survival (Creative breaks the block); a rising redstone edge plays it. Instrument from the block below (harp default; bd for stone-like, snare for sand, gravel, soul sand; hat for glass; bassattack for wood). Nothing plays when the block above is not air. Sound `note.<instrument>` at the block centre, volume 3, pitch `fround(2^((note-12)/12))`; particle `note` at (x+.5, y+1.2, z+.5) with x velocity note / 24 and the colour from the 65536-entry MathHelper sin table.
- Note NBT: id `Music`, byte `note` clamped to 0-24 on read; the powered state is not saved. Saved in the world record (`musicTiles`) and in region import and export.
- Jukebox: a disc in a metadata 0 jukebox sets metadata 1 and shows "Now playing: C418 - <name>" (60 ticks, alpha `f2 * 255 / 20` capped at 255, drawn above 8, colour `HSBtoRGB(f2 / 50, 0.7, 0.6)`); the disc leaves the stack outside Creative. A click on a loaded jukebox, or breaking it, ejects the disc as an item (pickup delay 10) at `fround(r * 0.7f) + 0.3f * 0.5`, `... + 0.3f * 0.2 + 0.6`, `... + 0.3f * 0.5` from three `nextFloat` calls, with the original order (stop, clear tile, metadata 0 with flag 2, spawn). Comparator output is disc index + 1.
- Jukebox NBT: id `RecordPlayer`, `Record` int and `RecordItem` compound; a legacy positive `Record` reads as a one-item stack.
- Discs: names "Music Disc" with the tooltip "C418 - <name>", stack size 1, rarity rare (aqua name), Creative Miscellaneous in native order. A creeper killed by a skeleton drops `2256 + nextInt(12)` (arrow and melee both; creeper melee, cactus and shooterless arrows do not), replayed against 240 seeds per source.
- Recipes: jukebox 8 planks + diamond, note block 8 planks + redstone.
- Audio: the `note/*.ogg` files are imported (manifest 274 sounds).

## Gaps

- **Record music needs a local install.** The twelve `records.*` streams are not in Git (size and provenance). `npm run music:fetch` installs them, and a disc then plays at the jukebox (volume 4, LINEAR, 64 blocks) until it is ejected or the jukebox breaks ([music.md](music.md)). Without them, a playing disc shows only the HUD line and the jukebox state. The original's `playAuxSFX 1005` event is replaced by a direct callback.
- The note particle's motion (heart-like, 6 ticks, scale x 1.5) is built from the decompiled constructor, not probed frame by frame.
- Old inert discs (items 373 and 374) are kept hidden and accepted by the jukebox as records 2256 and 2257.
- The original keeps any item in a jukebox read from a legacy `Record` int; this build keeps only the twelve discs.
- The HUD is a DOM line at the bottom centre, not the GUI font renderer; its fade and colour are the recorded values.
- The probe's world has no sound or particle settings: note volume attenuation uses the engine's existing sound path.
