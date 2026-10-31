# Item entities and the HUD rows (0.10)

Sources: `javap -c -p -constants` on the 1.7.10 client JAR through the 1.7.10 SRG mapping. The classes used are EntityItem (`xk`), Entity (`sa`), Block (`aji`), EntityPlayer (`yz`), EntityLiving, BlockChest/BlockFurnace, EntityPickupFX, RenderItem and GuiIngame. The code is in `src/item-entities.js` and `src/drop-renderer.js`.

## Item entities

Broken blocks, killed mobs, thrown stacks, death drops and spilled containers now spawn individual item entities. Nothing goes straight into the inventory.

- **Spawning**
  - `Block.dropBlockAsItem`: each item is its own count-1 entity, placed at `rand × 0.7 + 0.15` inside the block, pickup delay 10.
  - `Entity.entityDropItem` (mob drops): at the mob's position, delay 10, one entity per item.
  - `EntityPlayer.func_146097_a` (Q / Ctrl + Q, closing a screen with a cursor stack):
    - Spawns at feet + 1.32 with delay 40.
    - Thrown at 0.3 along the view, plus a 0.02 random sideways kick and `(r − r) × 0.1` on y.
    - Death drops scatter at `rand × 0.5` in a random direction with 0.2 upwards.
  - `BlockChest.breakBlock` / `BlockFurnace.breakBlock`:
    - Contents spill in pieces of 10–30 at `rand × 0.8 + 0.1`.
    - Motion is gaussian × 0.05, with +0.2 on y; there is no pickup delay.
  - `EntityItem` constructor:
    - 0.25 × 0.25 box.
    - Motion `(float)(rand × 0.2 − 0.1)` on x and z, 0.2 on y.
    - Random hover phase `rand × 2π`, health 5.
- **`EntityItem.onUpdate`**
  - Pickup delay counts down.
  - Gravity 0.03999999910593033.
  - `func_145771_j` pushes an item out of a solid cell:
    - It tries the nearest open side in the order x−, x+, y+, z−, z+, never down, and falls back to up.
    - It moves at `rand × 0.2 + 0.1` with collisions off.
  - Movement clips against block boxes (y, then x, then z).
  - Drag is 0.98 in the air and 0.6 × 0.98 on the ground; motion y is × 0.98 and bounces × −0.5 on landing.
  - Items despawn at age 6,000 or below y −64.
- **`combineItems`**
  - It is checked when the item enters a new block or every 25 ticks, against items within 0.5 horizontally.
  - It needs the same item and damage.
  - The smaller stack joins the larger, without exceeding the stack limit.
  - The survivor keeps the longer pickup delay and the younger age.
- **Pickup** (`onCollideWithPlayer`)
  - The player box grows by (1, 0.5, 1). Pickup needs the delay at 0 and room in the inventory; partial stacks stay on the ground.
  - It plays `random.pop` at volume 0.2, pitch `((r − r) × 0.7 + 1) × 2`.
  - `EntityPickupFX` flies the item over three ticks (t²) to 0.5 below the eye.
- **Rendering** (`RenderItem.doRender`)
  - Bob `sin(age/10 + hover) × 0.1 + 0.1` above minY + 0.125.
  - Positions are interpolated between ticks by the partial tick.
- **Saves**
  - Each entity stores its stack, position, motion, age, delay and hover.
  - Pre-0.10 piles load as one entity per stack, with their remaining lifetime kept.

## HUD heart and food rows

`GuiIngame.renderGameOverlay` draws 9-pixel icons every 8 pixels, so a row of ten is 81 pixels wide; the build used to space them 9 apart.

- Each heart and drumstick draws its fill sprite over the container sprite (u 16): hearts at u 52/61, food at v 27. The icons therefore keep their black outline when empty.
- The food row runs right to left, so it empties from the left.
- Armor and air use the same 8-pixel step.

## Known differences

- No water current push on items, and no lava burning or fire damage.
- No hoppers, item frames or creative 4,800-tick despawn.
- Ground slipperiness is always the default 0.6 (ice is not in this build).
- The player picks items up only in the survival tick. Collision uses this build's block boxes, which are simpler than the full `addCollisionBoxesToList` shapes.

## Tests

`src/item-entities.test.js` covers:

- block drops (count 1, delay 10, spread);
- gravity, landing and ground drag;
- merging (larger stack wins, delay and age rules, different items, stack limit);
- pickup delay, reach and partial pickup;
- despawn by age and the void;
- push-out from a solid block;
- thrown and death motion;
- save round-trip and legacy pile migration.
