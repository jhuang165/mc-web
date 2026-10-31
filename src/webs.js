// BlockWeb (aok), Entity.setInWeb / moveEntity / doBlockCollisions (sa.as/d/I)
// and EntitySpider.setInWeb (yn.as), Minecraft Java 1.7.10.
import { WEB } from './world.js';

// Block callbacks use floor(min + .001)..floor(max - .001), inclusive.
export function touchesWeb(world, box) {
  for (let x = Math.floor(box[0] + .001); x <= Math.floor(box[3] - .001); x++)
    for (let y = Math.floor(box[1] + .001); y <= Math.floor(box[4] - .001); y++)
      for (let z = Math.floor(box[2] + .001); z <= Math.floor(box[5] - .001); z++)
        if (world.get(x, y, z) === WEB) return true;
  return false;
}
// Called at moveEntity's tail, after updateFallState. Spider's override is empty.
export function webContact(world, box, state, flying = false) {
  if (flying || state.type === 'spider' || !touchesWeb(world, box)) return false;
  state.inWeb = true;
  state.fallDistance = 0;
  return true;
}
// Consume LAST move's contact flag before the sneak-edge/collision loops. The
// displacement is reduced, motion is zeroed; later gravity/drag still run.
export function webMove(state, velocity = state, axes = ['vx', 'vy', 'vz']) {
  const move = axes.map(a => velocity[a]);
  if (state.inWeb) {
    state.inWeb = false;
    move[0] *= .25;
    move[1] *= 0.05000000074505806;
    move[2] *= .25;
    axes.forEach(a => { velocity[a] = 0; });
  }
  return move;
}
