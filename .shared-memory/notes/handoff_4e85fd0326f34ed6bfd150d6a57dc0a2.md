Claude handoff — 2026-10-31, version 0.11.0 (commit cdeabf5, pushed to GitHub with npm run push:github).

Changed:
- The creative picker is replaced by a port of the 1.7.10 GuiContainerCreative (bfl), ContainerCreative (bfm) and CreativeSlot (bfn); code in src/creative.js.
- Tabs: the twelve CreativeTabs (abt) in original order, listing implemented items only.
  - Tab art and click boxes follow drawTab and func_147049_a; column 5's click box starts at x 169.
  - Tab-name tooltips and the static selected tab are ported.
- Scrolling: wheel (one row per notch, Java float) and the scrollbar drag (y-25.5)/97.
- Search: tooltip search.
  - T opens the search tab.
  - Hotbar digits act on the hovered slot first, then the field takes keys, so E and Q type.
  - The first key after a slot click clears the field.
  - Items show their own tab name in bold blue in the search tab.
- handleMouseClick rules:
  - Copy 1, or a full stack with Shift; the same item adds or removes 1; a different item is deleted.
  - Middle-click picks a full stack; number keys copy a full stack to the hotbar; Q drops a copy.
  - Clicking outside throws the cursor (one item with the right button).
- Survival inventory tab: ContainerPlayer slots at creative positions, Destroy Item bin at (173,112) (Shift clears everything), player figure func_147046_a(43,45,20).
- main.js:
  - openCreative / renderCreativeBody.
  - openContainer takes an optional gui and addresses slots by list index; it computes GUI-pixel pointer coordinates.
  - Creative key routing is added before E/Q.
  - Creative can break bedrock above y=0, and bedrock can be placed.
- container-ui.css: creative screen styles. The survival inventory figure is rescaled to the original (51,75,30): scale gs*.625, left 28.5, top 15.

Evidence: tools/verify-creative.mjs compiles tools/probes/CreativeProbe.java against the unchanged JAR classes and writes public/research/creative-reference.json. Original tab totals: 141/103/26/12/56/606/28/33/45/65/45/0. Notes are in public/research/creative.md; parity.md and PROJECT.md are updated.

Tests: npm test 91/91 (9 new in src/creative.test.js, which compare every tab with the reference and cover click modes, scroll math, search, the text field, survival tab layout and the bin). npm run build OK.

Browser check on the dev server (creative world):
- Tabs render and switch.
- Search "swo" lists the 5 swords in original order.
- The wheel moves the bar to y 45 after two notches.
- Tooltips work, including the tab line.
- Shift-click gives 64; placing into the hotbar works.
- The survival tab places items and the bin deletes the cursor.
- T switches to search, E types, Esc closes, and reopening keeps the tab.
- The survival inventory figure now fills its box.

Remaining:
- Redstone, Transportation and Brewing tabs are empty until those items exist.
- The compass icon shows frame 0.
- The figure does not follow the pointer.
- No clipboard or selection in the search field.
- Click rules are bytecode-ported and unit-tested, not probe-run.

Sites publication was not run. The claim did not list tools/probes/CreativeProbe.java and tools/verify-creative.mjs; both are new files.