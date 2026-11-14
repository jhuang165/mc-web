# Polish track (batch 7): heads, maps, firework summon, command cart

Target: Minecraft Java 1.7.10 client `minecraft-1.7.10.jar` (SHA-1 e80d9b3b...). Evidence is in `public/research/polish-reference.json`
(18 records: 4 bytecode GL-call extractions from `tools/verify-polish.mjs`, 14 probe records from `tools/probes/PolishProbe.java` run by
`tools/verify-polish-probe.mjs`, merged via `tools/polish-probe-records.json`). Tests: `src/polish.test.js` (20).
Nothing here was checked in a browser; the lead must do that.

## 1. Wearable heads (`src/wearable-heads.js`)
Pumpkin (block 67) and skulls (item 2050, damage = SkullType 0-4) are valid in the helmet slot (`armorTypeOf`: ItemArmor type 0 /
ItemBlock pumpkin / ItemSkull override), also for shift-click (`PlayerContainer.transfer`; the whole stack moves, as in `mergeItemStack`).
Rendering on the player model and the paper doll: `RenderPlayer.func_77029_c` branch (`bop.a(blg,float)` offsets 31-249): skull scale 1.0625,
pumpkin translate/rotate/scale (0.625). First-person pumpkin blur: `#pumpkin-blur` overlay with `misc/pumpkinblur.png`, first-person view only.
Also fixed: Enderman helmet check used the wrong armour index and item id.

## 2. First-person map (`src/map-render.js`, `src/first-person.js`)
ItemRenderer map branch (`bly.a(float)` offsets 368-960): both arms (`bop` arm offsets), the map pose (scale 0.38, tilt from pitch), the
`map_background.png` quad (-7..135), 128x128 colours from `mapByteRgb`, and `map_icons.png` markers (4x4 grid, z steps -0.001).
Constants are bytecode-derived; a numeric orientation test checks that the map lies flat below the view and turns face-on at pitch 90.

## 3. Item frames showing maps (`src/hanging-renderer.js`, `src/maps-clock-live.js`)
RenderItemFrame map branch (`bnx.d(st)` offsets 48-352). **Rotation step count: 4 steps of 90 degrees** (`rotation % 4`, bytecode of
`st`), not the 8 steps of later versions. The frame's marker is a `frame-<id>` decoration refreshed every 10 ticks for frames holding a map
(EntityTrackerEntry), and the map-marker yaw passed from main was in radians instead of degrees (fixed).

## 4. `/summon FireworksRocketEntity` (`src/firework-summon.js`)
Original path: `new zf(world)` then `Entity.readFromNBT` and `zf.readEntityFromNBT` (`Life`, `LifeTime`, `FireworksItem` via
`ItemStack.loadItemStackFromNBT`; a null stack keeps no item). The default constructor leaves life = lifetime = 0 and zero motion (the
random lifetime and the 0.05 climb belong to the stack constructor), so `/summon FireworksRocketEntity` with no tag explodes on its first
tick; `{LifeTime:30}` waits; `Motion` components above 10 in magnitude reset to 0. 9 `fireworkNbt` probe records. Any valid item stack is
kept (a stone stack is kept, as in the original), an unknown id is dropped.

## 5. Command block minecart (`src/command-cart.js`, `src/cart-variants.js`)
`xn` (EntityMinecartCommandBlock) bytecode, 3 `commandCartPass` and 2 `commandCartNbt` probe records:
- `onActivatorRailPass(x,y,z,powered)`: `if (powered && ticksExisted - b >= 4) { logic.func_145755_a(world); b = ticksExisted; }` with `b`
  starting at 0. **This is not a rising-edge trigger**: while the rail stays powered the command runs every 4 ticks; it runs on the first
  powered pass once the cart is at least 4 ticks old (a cart is its own age from 0 on load, so reloaded carts can fire at once).
- Right-click (`xn.c(yz)`, client side) opens the command block GUI (reused `openCommandBlock`, Creative + op as for the block).
- Sender position: `floor(x), floor(y + 0.5), floor(z)`; `SuccessCount` set from the command result.
- NBT keys `Command`, `SuccessCount`, `CustomName`, `TrackOutput`, `LastOutput`; `CustomName` is shared with the entity name key.
- Placement on a rail, kill drops (only the minecart) and /summon MinecartCommandBlock already existed (batch 6) and were reused.

## Gaps
- No browser verification of any item (matrices and constants only unit-tested; no pixel comparison against the original renderer).
- (Batch 71: closed, see the last line.) Heads are not drawn on zombies/skeletons (no equipment system; Halloween pumpkins are not rendered on mobs). Skull `SkullOwner`
- Batch 70 (docs sweep, 2026-11-14): partly closed. A carved pumpkin or jack-o'-lantern on a mob's head is drawn: `src/mob-equipment-renderer.js` (about lines 107-114, `headItemMatrix` from `src/wearable-heads.js`). Still gaps: a skull item in a mob's helmet slot is not drawn there (that renderer only builds the pumpkin branch), and `SkullOwner` skins are not rendered, `src/skull-renderer.js` draws `SKULL_TEXTURES` only although `src/skull-profile.js` keeps the profile.
  skins are not rendered (default skulls only).
- First-person map and item-frame map rendering have no numeric probe against the original renderer (bytecode-derived constants only).
- Command cart: the `commandBlocksEnabled` server flag is not modelled; the command runs with the same sender as command blocks.
- Batch 71 (mobrender71, 2026-11-14): heads on mobs and `SkullOwner` skins. (1) A skull in a zombie, pigman, skeleton or wither skeleton helmet slot is drawn (`src/mob-equipment-renderer.js`): `RenderBiped` `bnw.a(sw, float)` (bytecode-read) scales 1.0625 (1, -1, -1) and calls `TileEntitySkullRenderer`. The mob's helmet stack now keeps `skullOwner` / `skullRaw` through `/summon` and save NBT (`mob-equipment.js` `skullFields`, `java-mobs.js`, `mob-equipment-live.js`). (2) A type 3 head with a profile takes a skin from `src/skull-skins.js` (`skinBook`): the signed-in player's skin and the multiplayer players' skins already loaded (matched by profile name, case-insensitive), else Steve. This is the port's stand-in for the textures property (native binds `SkinManager.func_152790_a(profile)` SKIN, else Steve, bytecode-read `bms.a`); no Mojang call is made, so a head named after a player the game has not loaded stays Steve. Drawn on the head block (`skull-renderer.js`), worn by a player (`player-renderer.js`), and worn by a mob. (3) A skull held in the hand or dropped has no model natively: only `bnw`, `bop` (RenderPlayer) and `bmk` (the tile renderer dispatcher) reference `bms` in the jar, so held and dropped heads stay the flat icon. Only a browser could show: the head's placement on a zombie, the skin on a block head, and the late swap when a skin finishes loading.
