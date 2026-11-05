# Minecart variants (1.7.10)

Furnace, TNT and hopper minecarts, plus the command block cart item, on top of the empty and chest carts in `minecarts.md`. Evidence: `tools/probes/CartsProbe.java` runs the unchanged 1.7.10 classes (EntityMinecart xl, furnace xq, TNT xv, hopper xr, container xp, TileEntityHopper api) and `tools/verify-carts.mjs` writes `public/research/carts-reference.json` (30 cases, 844 ticks: furnace 10, TNT 13, hopper 7). `src/carts.test.js` replays every case tick for tick (position, motion, state, fuel/push/fuse/cooldown, slots, explosions, smoke particles, drops with their random velocities, item entities, coal uses and NBT before and after).

## Items

| Original | Internal | Cart type | Recipe |
| --- | --- | --- | --- |
| 343 | 2090 | 2 furnace | furnace above minecart |
| 407 | 2091 | 3 TNT | TNT above minecart |
| 408 | 2092 | 5 hopper | hopper above minecart |
| 422 | 2093 | 6 command block | none (creative only, item defined) |

Cart items place on rails, dispense from dispensers, appear in the creative transport tab and save through `region-export.js` as MinecartFurnace, MinecartTNT, MinecartHopper (`/summon` names match).

## Rules ported (`src/cart-variants.js`, `src/cart-hopper.js`)

- Furnace: coal and charcoal add 3600 fuel ticks (not consumed in creative); push is the cart minus player position; push drag is 0.8f plus 0.05 push, otherwise 0.98f, then the base drag; fuel counts down, push clears at zero, smoke at y+0.8 one tick in four. Drops minecart and furnace (no furnace if killed by an explosion). NBT Fuel, PushX, PushZ.
- TNT: activator rail with fuse < 0 sets fuse 80 (primed sound); fuse counts down with smoke; explosion power 4 + rand * 1.5 * min(5, speed); landing from a fall of 3 or more explodes with (distance/10)^2; fire, lava or explosion damage, or breaking at motion^2 >= 0.01, explodes. Drops TNT unless an explosion killed it. NBT TNTFuse. The flash and swell are drawn from the fuse.
- Hopper: 5 slots, picks up from the inventory or the item entity above, cooldown 4, a powered activator rail disables it, comparator reads it, GUI shared with the hopper. Kill spills, drops the minecart and hopper. NBT Items, TransferCooldown.
- Drag: the 1.7.10 float constants matter; the probe caught 0.98f and 0.8f.

## Gaps

- Command block cart: the item is defined, but there is no entity behaviour, no GUI and no command execution.
- Spawner cart (type 4) is not supported.
- The wall-collision explosion of the TNT cart never fires on rails in the original either (motion is zeroed first), so it is not covered by any recorded case.
- The hopper cart block inside the model is approximated from boxes; furnace, TNT and command block use the block textures at the original offset and scale. Not compared with native screenshots.
- Native keeps a size-0 stack in a spilled slot (NBT Count 0); the port empties the slot.
- Hopper cart interaction with hopper block chains and other tile entities beyond the probed cases is not recorded.
- Browser behaviour (rendering, GUI, sounds) was not exercised in a browser. Full parity is not claimed.
