// Paintings and item frames on the gun server (not 1.7.10 networking): the world's one Hanging list (hanging.js), placed, turned,
// filled and broken by the players' clicks (hanging-interaction.js, as single player runs it), re-checked against their wall every
// 100 ticks, broken by explosions and arrows, and saved with the world. Each tab gets the ones near its player (EntityTracker's
// 160-block range for hanging entities) whenever that list changed; its HangingRenderer draws them, with a framed map's colours
// from the map rows (server-maps.js).
import { Hanging, PAINTING_ITEM, FRAME_ITEM, pickHanging, hangingArrowTargets } from '../hanging.js';
import { applyHangingEdit } from '../hanging-interaction.js';
import { copyStack } from '../inventory.js';
import { JavaRandom } from '../java-random.js';

export const HANGING_RANGE = 160; // EntityTracker.trackEntity(EntityHanging, 160, Integer.MAX_VALUE)
const HANGING_ROWS = 256;

export class ServerHanging {
  constructor(sim, saved = null) {
    this.sim = sim;
    this.hanging = Hanging.fromJSON(Array.isArray(saved) ? saved : [], { random: () => new JavaRandom(Math.floor(sim.random() * 2 ** 48)) });
  }
  get entities() { return this.hanging.entities; }
  // Entity.entityDropItem for what broke: the frame, its item, the painting.
  drops() { for (const d of this.hanging.drain()) this.drop(d); }
  drop(d) { this.sim.play.items.spawn(copyStack(d.stack), d.x, d.posY, d.z, { delay: d.delay }); }
  // EntityHanging.onUpdate: the 100-tick wall check in ticking columns.
  tick() {
    const world = this.sim.world;
    this.hanging.tick(world, { active: e => !world.streaming || world.isTicking(e.x, e.z) });
    this.drops();
  }
  // EntityRenderer.getMouseOver for a hanging entity: { hanging, distance } or null.
  pick(eye, dir, reach, wall) {
    const hit = pickHanging(this.hanging, eye, dir, reach, wall);
    return hit ? { hanging: hit.entity, distance: hit.distance } : null;
  }
  // A click on a painting or frame under player p's crosshair (`aimed`), or a held painting or frame used on a wall.
  // Returns whether the click was taken.
  edit(p, place, target, aimed = null) {
    const s = p.survival, held = s.held?.id ?? 0;
    if (!aimed && (!place || (held !== PAINTING_ITEM && held !== FRAME_ITEM))) return false;
    const done = applyHangingEdit({ hanging: this.hanging, world: this.sim.world, survival: s, heldId: held, place, target, aimed: aimed ? { entity: aimed } : null },
      { swing: () => { p.swing = 6; }, drop: d => this.drop(d) });
    this.drops();
    return done;
  }
  // Explosion.doExplosionA's entity pass for paintings and frames.
  explode(x, y, z, size) { this.hanging.explode(x, y, z, size); this.drops(); }
  // EntityArrow targets: the paintings and frames (bow.js breaks them through ctx.hanging).
  arrowTargets() { return hangingArrowTargets(this.hanging); }
  // The paintings and frames near player p: [id, kind, dir, tx, ty, tz, art, item, rotation]; kind 0 painting, 1 frame; item a stack
  // or 0. Null when the list is the one this player's tab already has.
  rows(p) {
    const at = p.position, out = [];
    for (const e of this.hanging.entities) {
      if (e.dead || Math.abs(e.x - at.x) > HANGING_RANGE || Math.abs(e.z - at.z) > HANGING_RANGE) continue;
      out.push([e.id, e.kind === 'frame' ? 1 : 0, e.dir, e.tx, e.ty, e.tz, e.art | 0, e.item ? copyStack(e.item) : 0, e.rotation | 0]);
      if (out.length >= HANGING_ROWS) break;
    }
    const key = JSON.stringify(out);
    if (key === p.sentHanging) return null;
    p.sentHanging = key;
    return out;
  }
  // The frames holding a filled map within range of player p (the maps its tab must draw).
  framesNear(p, id) {
    const at = p.position;
    return this.hanging.entities.filter(e => !e.dead && e.kind === 'frame' && e.item?.id === id && Math.abs(e.x - at.x) <= HANGING_RANGE && Math.abs(e.z - at.z) <= HANGING_RANGE);
  }
  save() { return this.hanging.toJSON(); }
}
