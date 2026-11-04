# Beds (1.7.10)

Ported from BlockBed (`ajh`), ItemBed (`abg`), EntityPlayer sleep/wake (`yz`), World (`ahb`) and WorldServer (`mt`). Code: `src/bed.js` (pure rules, `Beds` watcher, `BedSleep` state), wired in `src/main.js`, `src/player-edit-simulation.js`, `src/block-break-simulation.js`, `src/block-textures.js` and `src/scene.js`.

## Ids

Internal block 138 = Bed (`138: same(26)` in the block registry); item 355 maps to internal item 472. Creative tab: Decoration. Recipe: three wool over three planks gives one bed. Metadata: bits 0-1 facing, bit 2 occupied, bit 3 head.

## Rules

- Hardness 0.2, height 9/16, light opacity 0, stone sound, not opaque; explosion resistance 0.2.
- Placement: top face only, facing from yaw; both cells must be replaceable with solid tops below. Breaking either half removes the other; one bed drops from the foot half, the head drops nothing.
- Sleeping: status messages, 0.2 x 0.2 lying box, "Leave Bed" button, sleepTimer to 100, then the time skips to the next morning and weather clears. The spawn point is set to the bed and verified on respawn; otherwise "Your home bed was missing or obstructed" and world spawn. Spawn and sleeping state are saved.
- Zombie-villager cure boost: `BOOST_BLOCKS` includes the bed.

## Native evidence

`tools/probes/BedProbe.java`, run by `tools/verify-beds.mjs` (needs `MC_RESEARCH`), drives the unchanged classes of `minecraft-1.7.10.jar` and writes `bed-reference.json` (1,298 records). `src/bed.test.js` replays them.

## Limits

Browser check on localhost covered rendering only; sleeping flow is covered by the replay tests. Villages and mob sleeping have no bed logic. Full parity remains unfinished.
