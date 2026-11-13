// Batch 62 (singleleft): the enderman copy's wet teleport. EntityEnderman.onLivingUpdate (ya.e, bytecode-read) runs `if (isWet() || isBurning()) { target = null; setScreaming(false);
// teleportRandomly(); }` on BOTH sides (no isRemote guard), after the 12 portal-particle draws and before the scream roll. The copy therefore draws nextDouble, nextInt(64), nextDouble
// every tick it is wet, and a destination ya.k accepts (solid ground within reach below, a free box, no liquid) moves it, with 128 portal particles (6 draws each) on the copy's Random.
// Executed: tools/probes/MobCopies2Probe.java `watertp` (3 seeds, 160 ticks) -> public/research/mobcopies2-reference.json, replayed by src/singleleft-b62.test.js.
// Not modelled: a burning copy (the copy keeps no fire flag), other entities' boxes in the destination test, and the copy's `newPosRotationIncrements` (the next packet resets them).
import { teleportRandomly } from "./enderman.js";
import { collisionBoxes as cellBoxes, isLiquid, HEIGHT } from "./world.js";

// The environment enderman.js teleportTo needs, on the client copy's streaming world. Particles and the portal sound are silent on the client (RenderGlobal.playSound is empty
// in 1.7.10 and the live path shows the visible particles), so only their draws are made.
export function copyTeleportEnv(world) {
  return {
    blockExists: (x, y, z) => y >= 0 && y < HEIGHT && (world.isLoaded ? world.isLoaded(x, z) : true),
    blocksMovement: (x, y, z) => cellBoxes(world, x, y, z).length > 0,
    collides: (b) => {
      for (let x = Math.floor(b.minX); x < Math.floor(b.maxX + 1); x++)
        for (let y = Math.floor(b.minY) - 1; y < Math.floor(b.maxY + 1); y++)
          for (let z = Math.floor(b.minZ); z < Math.floor(b.maxZ + 1); z++)
            for (const [a, c, d, g, h, i] of cellBoxes(world, x, y, z))
              if (x + g > b.minX && x + a < b.maxX && y + h > b.minY && y + c < b.maxY && z + i > b.minZ && z + d < b.maxZ) return true;
      return false;
    },
    liquidIn: (b) => {
      for (let x = Math.floor(b.minX); x < Math.floor(b.maxX + 1); x++)
        for (let y = Math.floor(b.minY); y < Math.floor(b.maxY + 1); y++)
          for (let z = Math.floor(b.minZ); z < Math.floor(b.maxZ + 1); z++) if (isLiquid(world.get(x, y, z))) return true;
      return false;
    },
    particle() {}, sound() {},
  };
}

// One wet tick of the copy `c`: returns true when the copy moved.
export const copyWetTeleport = (c, world, rand) => teleportRandomly(c, copyTeleportEnv(world), rand);
