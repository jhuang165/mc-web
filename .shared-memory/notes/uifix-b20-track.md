# uifix track, batch 20

## Summary
- GuiSelectWorld: the native layout (title y 20, buttons at h-52 / h-28, 150 / 72 wide) was already right; the non-native Import / Endless / Export controls moved from y 6 (overlapping the title row) to one centred row at y 0..20 (`selectWorldLayout`, `ew` = min(50, (w-8)/3 - 2)), so they end where the title begins at every GUI size.
- GuiAchievement hint ("Taking Inventory"): bytecode shows `beh.b(pb)` keeps only the description and draws it with drawSplitString at (x+30, y+7), width 120, colour -1. The port drew the name at y 7 and the description from y 18, which spilled below the 32 px box; now only the wrapped description from y 7 (`toastHintLines`). The "get" variant (title y+7 0xFFFF00, name y+18 white, no shadow, icon at x+8,y+8, 160x32 frame, slide curve and 3 s timing) already matched and is unchanged.
- GuiCommandBlock now uses the bitmap Gui path: new `src/command-block-screen.js` (title y 20, "Console Command" y 37, field 300x20 at y 50, the three @p/@r/@a hint lines at y 75 + 9i, "Previous Output" label y 122 and a read-only field at y 135 when there is output, Done / Cancel 150 wide at h/4+132). The invented O/X track-output button and the DOM modal are gone (1.7.10 has no such control); `main.js openCommandBlock` just calls `gui.show`. The en_US `advMode.*` strings were added to `menu-screens.js` LANG.
- `toast()` (including "Drag to look. Left click to mine. Right click to use.", an invented hint with no native counterpart) now renders through `bitmapHtml` at the GUI scale.
- Book arrows: hover shift (u +23) implemented, see `public/research/books.md`.

## Native evidence
Bytecode-read with javap (nothing executed): `bfh` GuiCommandBlock (initGui, drawScreen, keyTyped), `beh` GuiAchievement (a, b(pb), a(pb), draw), `bff` NextPageButton. The wrap itself uses the existing `splitLines` (FontRenderer width model probed in batch 17/19); the slide timing was already replayed by `achievements.test.js`. No new probe: GuiAchievement needs GL and Minecraft doubles that were not worth building for layout constants.

## Tests
`npm test` 4056 pass / 0 fail (new: `command-block-screen.test.js` 2 tests, hint-fit test in `achievements.test.js`, select-world row overlap test for widths 213..960). `npm run build` ok.
Browser (headless Chrome `--mute-audio`, vite 5201): select world at 854x480 (scale 2), 1920x1080 and 427x240 (scale 1) with no overlap; Taking Inventory hint at scale 2 fits the box; "Drag to look" toast at scale 2 and 4 uses the bitmap font; command block screen at scale 2 matches the layout (the 1920 capture was a standalone Gui on a test root, so positions there are not meaningful); book forward arrow hover moves background-position to -46px (scale 2).

## Remaining gaps
- Pause-menu notes modal (`notes()`) and the other DOM `modal()` dialogs still use the page font (only `#modal-title` goes through drawLabels); export has no dialog. The read-only Previous Output field is drawn with the normal field text colour (native disabled colour is 0x707070).
- The toast keeps its browser CSS placement (centred above the hotbar), not a native location. Its scale is fixed when it is shown.
- Command block screen not exercised in a live world (a standalone Gui was used), Tab/field focus order not checked; achievement and book visuals are not pixel compared with GL.

## Proposed remaining-gaps lines
- GUI polish: GuiSelectWorld extras, Taking Inventory hint, GuiCommandBlock and the book arrow hover now follow the bytecode; remaining page-font GUI text is the `modal()` DOM dialogs (pause notes, a few others) and the toast's CSS placement.
