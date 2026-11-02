// The tail of Entity.moveEntity [sa.d] in Minecraft Java 1.7.10, after updateFallState:
// doBlockCollisions [sa.I] and the burning-box test. Replayed against the unchanged
// EntityPlayerSP in src/block-collisions.test.js (tools/probes/BlockCollideProbe.java).
import { CACTUS, WEB } from "./world.js";
import { boundingBoxBurning, contract } from "./fire.js";

// Entity.fireResistance [sa.ab]: 1, and 20 for EntityPlayer. A counter at or below 0 that is
// not in a burning box rests at -fireResistance, so the player stands 20 ticks in fire or lava
// before setFire(8) catches; other entities catch on the first tick.
export const FIRE_RESISTANCE = 1, PLAYER_FIRE_RESISTANCE = 20;
const SET_FIRE = 8 * 20;

// Entity.setInWeb [sa.as]; EntityPlayer skips it while flying and EntitySpider's override is empty.
export function setInWeb(e, flying = false) {
  if (flying || e.type === "spider" || e.type === "cave_spider") return;
  e.inWeb = true;
  e.fallDistance = 0;
}

// `box` is [x0, y0, z0, x1, y1, z1] after the move. doBlockCollisions calls
// Block.onEntityCollidedWithBlock for every cell floor(min + 0.001)..floor(max - 0.001), x then
// y then z: each cactus cell is attackEntityFrom(cactus, 1) (two cells, two calls) and a web
// cell setInWeb. Then World.isBoundingBoxBurning on the box contracted by 0.001 (fire or lava):
// dealFireDamage(1) (inFire) and, unless wet, ++fire with setFire(8) when it reaches 0; outside,
// a counter <= 0 rests at -fireResistance. A wet entity still burning fizzes and rests too.
// Without `hooks` (falling blocks, primed TNT) only the web part runs. Hooks:
// hurt(source, amount), wet, flying, resistance, fizz() and web() (each web cell's call).
export function blockCollisions(world, box, e, hooks) {
  const x1 = Math.floor(box[3] - 0.001), y1 = Math.floor(box[4] - 0.001), z1 = Math.floor(box[5] - 0.001);
  for (let x = Math.floor(box[0] + 0.001); x <= x1; x++)
    for (let y = Math.floor(box[1] + 0.001); y <= y1; y++)
      for (let z = Math.floor(box[2] + 0.001); z <= z1; z++) {
        const b = world.get(x, y, z);
        if (b === CACTUS) hooks?.hurt?.("cactus", 1);
        else if (b === WEB) {
          hooks?.web?.();
          setInWeb(e, hooks?.flying);
        }
      }
  if (!hooks) return;
  const wet = !!hooks.wet, resistance = hooks.resistance ?? FIRE_RESISTANCE;
  e.fire ??= 0;
  if (boundingBoxBurning((x, y, z) => world.get(x, y, z), contract(box))) {
    hooks.hurt?.("inFire", 1);
    if (!wet && ++e.fire === 0) e.fire = Math.max(e.fire, SET_FIRE);
  } else if (e.fire <= 0) e.fire = -resistance;
  if (wet && e.fire > 0) {
    hooks.fizz?.();
    e.fire = -resistance;
  }
}
