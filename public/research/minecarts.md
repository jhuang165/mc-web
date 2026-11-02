# Chest minecarts (mineshaft carts)

Target: Minecraft Java 1.7.10 `EntityMinecartChest` (`xm`), `EntityMinecartContainer` (`xp`), `EntityMinecart` (`xl`), `RenderMinecart` (`boi`) and `ModelMinecart` (`bhq`). This covers the chest carts that mineshaft corridors place on their rails. It is not full minecart parity.

## What is ported (`src/minecarts.js`)

- **Body.** `setSize(0.98, 0.7)` with yOffset 0.35 (float), and `setPosition` builds the box from the float half width. A cart spawns at the native posY-style doubles from the generation record.
- **Tick order (`onUpdate`).**
  1. Rolling amplitude decays by 1, and damage decays by 1.
  2. Below y -64 the cart is killed and spills, and the tick continues.
  3. Gravity of `(double)0.04f`.
  4. The rail lookup, which also accepts a rail one block below.
  5. The second `doBlockCollisions` pass (cactus hurts, webs slow).
  6. Pitch is reset to 0, and yaw comes from the horizontal travel, using the reverse flag and the ±170° flip.
  7. Cart-cart `applyEntityCollision` within a 0.2 grown box.
- **Derailed movement (`func_94088_b`).** Motion is clamped to ±0.4. On the ground it is scaled by 0.5 before the move; in the air by `0.95f` after the move.
- **Rail movement (`func_145821_a`).** This covers plain rails and golden rails, and the detector and activator meta masks:
  - the 10-entry shape table;
  - slope acceleration of 0.0078125, and posY raised by 1 on ascending shapes;
  - direction snapping, with speed capped at 2;
  - the golden brake: below 0.03 the cart stops, otherwise its speed halves;
  - snapping onto the rail line;
  - the clamped move and the slope end correction;
  - `EntityMinecartContainer.applyDrag`, which is `0.98 + 0.001 × (15 − comparator level)` in float math over the 27 slots;
  - the rail height energy correction and the cell-change redirect;
  - the golden boost of 0.06, and the 0.02 kick off a normal cube.
- **`moveEntity`.** Step height is 0. A cart is blocked by block boxes (rails have none) and by every pushable entity's box (`getCollisionBox`, so other carts and the player). It also covers the web slowdown and `onGround`. The tail of `doBlockCollisions` and the burning box (`inFire` 1 per tick, and the fire counter, which never decays because carts do not run `onEntityUpdate`) are shared with `block-collisions.js`.
- **Pushes.**
  - Cart against cart: a trade along the track when the alignment is at least 0.8, using the MathHelper sin and cos tables. Two carts head-on swap motion.
  - Cart against a living entity: `collide(cart, entity)` / `pushEntity` return the entity's velocity share. A chest cart never mounts mobs.
- **Damage (`attackEntityFrom`).** A hit flips the rolling direction, sets rolling to 10 and adds `amount × 10` to the damage. The cart breaks above 40.
  - A Creative player's hit breaks it immediately. If the cart has no custom name, that hit only calls `setDead`: the contents spill but no cart or chest items drop.
  - `killMinecart` gives:
    1. the container spill;
    2. the minecart item (328, delay 10, carrying the custom name);
    3. the second pass over the emptied slots (3 floats per slot);
    4. the chest (54, delay 10).
- **Spill (`EntityMinecartContainer.setDead`).** These values come from the cart's own `Random`:
  - each stack starts at a random offset of 0.1 to 0.9 inside the cart;
  - it splits into pieces of `nextInt(21) + 10`;
  - each piece gets gaussian motion of ×0.05, plus 0.2 upward;
  - delay is 0, and the item's tag is kept (the book's `stored` list).
- **Container.** `interact(cart)` returns a 27-slot `StackArray` titled "Minecart" or the custom name. `container(cart, inventory)` wraps it as a `ChestContainer` with 3 rows. `usable` applies the native 8-block check.
- **Items.** Loot records use original ids and are mapped with `region-import.js itemFromOriginal`. An original item that this build cannot map yet stays in `cart.unmapped` in the same slot. It is saved, counts towards the comparator drag, uses the spill RNG and drops as `{ stack: null, original }`. It maps as soon as the id table has it.
- **Saves.** `toJSON` / `Minecarts.fromJSON` store position, motion, rotation, fall distance, fire, `onGround`, the name and the items with original ids. Damage and rolling are DataWatcher state, so a native reload resets them too. `toNBT` gives the `Entity.writeToNBT` view (Pos, Motion, Rotation, FallDistance, Fire, Air, OnGround, Dimension, Invulnerable, PortalCooldown, Items, CustomName).

## Rendering (`src/minecart-renderer.js`)

- **Entity transform.** The cart gets the entity-id jitter. It is then placed on the rail at `func_70489_a`, with y averaged from the points ±`0.3f` along the rail (`func_70495_a`).
- **Rotation.** Yaw is `atan2` of that segment and pitch is `atan(dy) × 73`. The rotations are applied as Y `(180 − yaw)`, then Z `−pitch`, then the X wobble `sin(rolling − partial) × (rolling − partial) × max(0, damage − partial) / 10 × rollingDirection`.
- **Chest.** It is scaled by 0.75 and raised 8/16, then `renderBlockAsItem` turns it 90° and centres it. The chest model is closed at metadata 0.
- **Cart model.** `scale(-1, -1, 1)` and the six ModelMinecart boxes from `entity/minecart.png` (64 × 32). The inner plate's rotation point is 4.1.
- **Lighting.** Brightness is sampled 0.66 of the box height up.

## Evidence

- **Sources.** `tools/verify-minecarts.mjs` compiles `tools/probes/MinecartProbe.java` against the pinned client (SHA-1 `e80d9b3b…`). It runs the unchanged classes. The subclass only logs `attackEntityFrom`, and the World double is map-backed. The output goes to `public/research/minecart-reference.json`, with the class hashes and the method text.
- **Coverage.** 34 cases, 1213 ticks:
  - ground drop and slide, the air clamp, a wall;
  - the mineshaft spawn, with NBT;
  - straight, crossing, sloped, north-slope and curved rails;
  - the golden brake, boost and kicks;
  - web, cactus, fire, the void;
  - two carts following and two carts head-on;
  - a player push and a player box blocking the cart;
  - fist, spaced, player, sword, Creative and named-Creative hits;
  - hits while moving;
  - a loaded cart on rails (drag 0.991).
- **Recorded per tick.**
  - Per cart: position, motion, `onGround`, yaw, pitch, dead, damage, rolling, rolling direction, in web, minY, fire, and the three renderer rail points.
  - Per tick: the hurt log and every spawned EntityItem.
- **Replay.** `src/minecarts.test.js` replays every case exactly, including negative zero and every spilled item's position and motion. The exception is `entityDropItem` motion: it is `Math.random()` in `EntityItem`, so the replay checks only id, count, position, delay and name for those items.

## Gaps

- Riding, mob pickup by empty carts, and furnace, TNT, hopper, spawner and command carts.
- Hoppers pulling from carts, and the comparator output.
- Powered rail redstone propagation and detector rail output. The meta bits are read, but nothing powers or unpowers rails.
- Rail placement and shape logic (`BlockRailBase$Rail`).
- The cart item and placement.
- Client interpolation (`setPositionAndRotation2`) and the 0.5 shadow.
- The player's own collision with the cart box: main.js has to treat carts as obstacles and call `pushEntity`.
- `inventory.js copyStack` drops `stored` and `name` when a stack moves through the container or becomes an item entity.
- 328 (minecart) and several loot items have no browser item yet, so they drop as unmapped records.
