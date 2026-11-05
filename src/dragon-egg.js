// Dragon egg (BlockDragonEgg, akp, original id 122) from Minecraft Java 1.7.10. Pure rules, no
// imports: the live hooks (world.js, falling.js, scene.js, player-edit-simulation.js) call in here.
// Evidence: public/research/end-reference.json (tools/verify-end.mjs, tools/probes/EndProbe.java),
// notes in public/research/end.md.
export const DRAGON_EGG = 171;          // BLOCKS slot of the dragon egg
export const DRAGON_EGG_ORIGINAL_ID = 122;
export const EGG_TICK_RATE = 5;         // Block.tickRate: both onBlockAdded and neighbour change schedule 5
export const EGG_BOUNDS = [0.0625, 0, 0.0625, 0.9375, 1, 0.9375];
export const EGG_LIGHT = 1;             // setLightLevel(0.125F) -> 1
export const EGG_TRIES = 1000;
export const EGG_PARTICLES = 128;

const f = Math.fround;

// RenderBlocks.renderBlockDragonEgg (blm.a(akp,III)) draws eight stacked boxes from the top down.
// Each row has a half width of w/16 in x and z and a height of h/16; the table (w, h) is read from
// the bytecode: (2,1) (3,1) (4,1) (5,2) (6,3) (7,5) (6,2) (3,1), 16 sixteenths in all.
const ROWS = [[2, 1], [3, 1], [4, 1], [5, 2], [6, 3], [7, 5], [6, 2], [3, 1]];
export function eggBoxes() {
  const boxes = [];
  let used = 0;
  for (const [w, h] of ROWS) {
    const half = f(w / 16), top = f(1 - used / 16), bottom = f(1 - (used + h) / 16);
    used += h;
    boxes.push([f(0.5 - half), bottom, f(0.5 - half), f(0.5 + half), top, f(0.5 + half)]);
  }
  return boxes;
}

// BlockDragonEgg.func_150018_e (m): when the block at (x, y, z) is still the egg, up to 1000 random
// targets (x + nextInt(16) - nextInt(16), y + nextInt(8) - nextInt(8), z + nextInt(16) - nextInt(16))
// are tried; the first air cell wins. On the server the egg (with its metadata) is placed there with
// flags 2 and the old cell cleared (setBlockToAir, flags 3). On the client 128 "portal" particles are
// drawn along the line from the target to the old cell instead and nothing is changed.
// hooks: { isEgg(x,y,z), isAir(x,y,z), place(x,y,z), clear(x,y,z), particle(name,x,y,z,vx,vy,vz) }
export function teleportEgg(x, y, z, random, remote, hooks) {
  if (!hooks.isEgg(x, y, z)) return false;
  for (let n = 0; n < EGG_TRIES; n++) {
    const i = x + random.nextInt(16) - random.nextInt(16);
    const j = y + random.nextInt(8) - random.nextInt(8);
    const k = z + random.nextInt(16) - random.nextInt(16);
    if (!hooks.isAir(i, j, k)) continue;
    if (!remote) {
      hooks.place(i, j, k);
      hooks.clear(x, y, z);
    } else {
      for (let c = 0; c < EGG_PARTICLES; c++) {
        const d = random.nextDouble();
        const vx = f(f(random.nextFloat() - 0.5) * f(0.2));
        const vy = f(f(random.nextFloat() - 0.5) * f(0.2));
        const vz = f(f(random.nextFloat() - 0.5) * f(0.2));
        const px = i + (x - i) * d + (random.nextDouble() - 0.5) * 1 + 0.5;
        const py = j + (y - j) * d + random.nextDouble() * 1 - 0.5;
        const pz = k + (z - k) * d + (random.nextDouble() - 0.5) * 1 + 0.5;
        hooks.particle("portal", px, py, pz, vx, vy, vz);
      }
    }
    return true;
  }
  return false;
}
