# Beds (1.7.10)

Ported from BlockBed (`ajh`), ItemBed (`abg`), EntityPlayer sleep/wake (`yz`), World (`ahb`) and WorldServer (`mt`). Code: `src/bed.js` (pure rules, `Beds` watcher, `BedSleep` state), wired in `src/main.js`, `src/player-edit-simulation.js`, `src/block-break-simulation.js`, `src/block-textures.js` and `src/scene.js`.

## Ids

Internal block 138 = Bed (`138: same(26)` in the block registry); item 355 maps to internal item 472. Creative tab: Decoration. Recipe: three wool over three planks gives one bed. Metadata: bits 0-1 facing, bit 2 occupied, bit 3 head.

## Rules

- Hardness 0.2, height 9/16, light opacity 0, stone sound, not opaque; explosion resistance 0.2.
- Placement: top face only, facing from yaw; both cells must be replaceable with solid tops below. Breaking either half removes the other; one bed drops from the foot half, the head drops nothing.
- Sleeping: status messages, 0.2 x 0.2 lying box, "Leave Bed" button, sleepTimer to 100, then the time skips to the next morning and weather clears. The spawn point is set to the bed and verified on respawn; otherwise "Your home bed was missing or obstructed" and world spawn. Spawn and sleeping state are saved.
- Lying render (bytecode-read RenderPlayer, RenderGlobal and EntityRenderer): the player model lies on its back with its feet 1.8 from the entity position (`func_71013_b`), turned `bK` (90/0/270/180 by bed direction), 90 about z and 270 about y, drawn at posY - 0.2. RenderGlobal draws the sleeper in first person too. The bed view sits at posY + 0.12 (0.3 lift, -0.42 offset), looking level towards the bed foot. F5 has no back-off while sleeping. The head keeps the yaw and pitch frozen at bed entry (`isMovementBlocked` skips the old-AI `rotationYawHead` copy, GuiSleepMP releases the mouse, and `renderYawOffset` stays inside its 75 degree clamp), so ModelBiped turns it by `rotationYawHead - renderYawOffset` and `rotationPitch`. The sleeper casts its shadow in every view (`RenderManager.func_147939_a` calls `doRenderShadowAndFire` for each rendered entity): at the entity position, shadow size 0.5, centre `posY + height / 2` = posY + 0.1 for the 0.2 box. Over a bed it lands on the floor cell inside the bed, so it is mostly hidden. Not native: clicking a bed glides the camera into place.
- Leave Bed (and Escape on the sleep screen) sends C0BPacketEntityAction 3, which NetHandlerPlayServer turns into `wakeUpPlayer(false, true, true)` (bytecode-read `nh`): the sleep timer is kept for the fade and the bed becomes the spawn point.
- Gun server (`src/multiplayer/server-beds.js`): the server runs `BedSleep` per player. A bed click goes through `activateBed` with the monster check against the server mobs and the other sleepers; its status lines go to that player only. Sleepers do not move, use items or fight; damage, death, the bed going or leaving the server wakes them without setting the spawn. Once every connected player has slept 100 ticks the world time skips to the next morning, rain and thunder clear and everyone wakes with the spawn set. Respawns use `verifyRespawn` at the saved bed (checked once its column is loaded) or fall back to the world spawn with "Your home bed was missing or obstructed". The tab gets `you.sleep` (bed, facing, timer) for its lying view, Leave Bed and fade; other tabs get `sleeping` in presence and draw the lying model, with the name tag 1.5 lower (bytecode-read RendererLivingEntity `boh`).
- Zombie-villager cure boost: `BOOST_BLOCKS` includes the bed.

## Native evidence

`tools/probes/BedProbe.java`, run by `tools/verify-beds.mjs` (needs `MC_RESEARCH`), drives the unchanged classes of `minecraft-1.7.10.jar` and writes `bed-reference.json` (1,298 records). `src/bed.test.js` replays them.

## Limits

Single-player sleeping is covered by the replay tests. On the gun server, a two-tab localhost check covered lying down, the monster refusal, the other tab's view, the night skip, Leave Bed and the respawn at the bed (`src/server-beds.test.js` covers the same server rules). The Nether/End bed explosion is single-player only, since the gun server has no other dimensions. Villages and mob sleeping have no bed logic. Full parity remains unfinished.
