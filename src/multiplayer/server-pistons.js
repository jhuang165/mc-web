// Live pistons on the gun server (Java 1.7.10 TileEntityPiston, BlockPistonMoving), over the server's LiveRedstone.
//
// The push logic itself (BlockPistonBase, block events, the tile progress) runs in redstone.js as in single-player; this
// adds what piston-live.js gives the single-player runtime (redstone-runtime.js):
//   - TileEntityPiston.func_145863_a: every player, mob, dropped item, orb, primed TNT, falling block, cart and boat inside
//     the moving box is moved by the progress delta through its own moveEntity (piston-push.js);
//   - BlockPistonMoving.getCollisionBoundingBoxFromPool for this world's Entity.moveEntity calls (moving-boxes.js). That
//     provider is one per process and the server runs a world per dimension, so each world installs its own boxes only
//     while it ticks (`during`);
//   - the moving tiles in each tick message (`redstone.pistons`, the save's row form), which a tab draws between two
//     server ticks (redstone-runtime.js showPistons, piston-live.js frame).
// The mid-motion tiles are saved with the redstone (redstone-live.js save / restore).
import { PHYSICS } from '../world.js';
import { installPistons } from '../piston-live.js';
import { pistonPushExtras, pushPlayer } from '../piston-push.js';
import { setMovingBoxes } from '../moving-boxes.js';

const MAX_ROWS = 256; // a bound on the tiles one tick message carries (a big contraption still finishes on the server)

// The server player as piston-push.js pushPlayer's runtime adapter: its moveEntity body (motion, sneak edge, ySize, fall).
function playerAdapter(p) {
  return {
    position: p.position, velocity: p.velocity, motion: { sneaking: !!p.input?.sneak, ySize: p.motion?.ySize ?? 0, inWeb: !!p.motion?.inWeb },
    get onGround() { return !!p.grounded; }, set onGround(v) { p.grounded = v; },
    get collidedH() { return !!p.collidedH; }, set collidedH(v) { p.collidedH = v; },
    get fallDistance() { return p.fallDistance ?? 0; }, set fallDistance(v) { p.fallDistance = v; },
    flying: !!p.flying, inWater: !!p.inWater, vehicle: null, width: PHYSICS.width, height: PHYSICS.height,
  };
}
function pushServerPlayer(world, p, dx, dy, dz) {
  const a = playerAdapter(p);
  pushPlayer(world, a, dx, dy, dz);
  if (p.motion) { p.motion.ySize = a.motion.ySize; p.motion.inWeb = a.motion.inWeb; }
}

export function installServerPistons(sim) {
  const world = sim.world;
  // The entity systems as piston-push.js pistonPushExtras reads them (redstone-runtime.js's `game`).
  const game = {
    items: () => sim.play?.items.items ?? [], itemSystem: () => sim.play?.items ?? null,
    orbs: () => sim.mobs?.orbs.orbs ?? [], orbSystem: () => sim.mobs?.orbs ?? null,
    primed: () => sim.mobs?.primed ?? [], falling: () => sim.falling?.entities ?? [],
    minecarts: () => sim.mobs?.minecarts ?? null, boatSystem: () => sim.mobs?.boats ?? null, boats: () => sim.mobs?.boats?.carts ?? [],
    mobs: () => sim.mobs?.ew ?? null, player: () => null,
  };
  // A rider moves with its seat; a dead or sleeping player is not pushed.
  const players = () => [...sim.players.values()].filter(p => !p.dead && !p.rider?.vehicle && !p.bed?.sleeping).map(p => {
    const { x, y, z } = p.position, w = PHYSICS.width / 2;
    return { box: [x - w, y, z - w, x + w, y + PHYSICS.height, z + w], entity: p, move: (dx, dy, dz) => pushServerPlayer(world, p, dx, dy, dz) };
  });
  const pistons = installPistons({ redstone: sim.redstone, world,
    entities: { mobs: () => sim.mobs?.ew ?? [], extra: () => [...players(), ...pistonPushExtras(world, game)] } });
  pistons.boxes = box => pistons.collisionBoxes(box);
  // The tick message's rows: [x, y, z, block, meta, facing, extending, renderHead, progress, lastProgress] (ORIGINAL ids).
  pistons.rows = () => pistons.tiles().slice(0, MAX_ROWS).map(t => [t.x, t.y, t.z, t.block, t.meta, t.facing, t.extending ? 1 : 0, t.renderHead ? 1 : 0, t.progress, t.lastProgress]);
  return pistons;
}

// Runs fn with this world's moving blocks as the process's collision provider, then gives the provider back.
let current = null;
export function during(sim, fn) {
  const outer = current;
  current = sim.pistons?.boxes ?? null;
  setMovingBoxes(current);
  try { return fn(); } finally { current = outer; setMovingBoxes(outer); }
}
