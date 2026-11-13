// Batch 63 mpwither: the Wither on the dedicated server.
// Single player's wither (wither-boss-mobs.js: EntityWither xc, EntityWitherSkull zp, the T of BlockSkull) already runs inside the EntityWorld the server uses for its mobs, so this
// module only adds what a server needs around it:
//   * `ServerWither.place` - ItemSkull.onItemUse on a server player's click: the T of soul sand and three wither skulls builds the wither (BlockSkull.func_149965_a, skull.js
//     tryBuildWither) at the Overworld difficulty; `spawn` makes the mob and awards `spawnWither` to every player within 50 blocks of its box.
//   * `installServerWither(mobs)` - the skulls in flight aim their sweep at the player nearest to them (the one `ai.player` the sweep reads, as fireballWatch does for ghast balls),
//     and a wither's death awards `killWither` to every player within the box of EntityWither.dropFewItems.
// Bytecode-read (javap on the 1.7.10 jar): BlockSkull.func_149965_a (anl) loops the players in `wither.boundingBox.expand(50, 50, 50)` and calls triggerAchievement(pc.I) on each (the
// creator is not special); EntityWither.dropFewItems (xc.b(boolean, int)) drops one nether star (ade.bN) and loops the players in `boundingBox.expand(50, 100, 50)` calling
// triggerAchievement(pc.J). So killWither does not depend on who dealt the blow. (That pc.I is spawnWither and pc.J killWither is recalled from the achievement list order.)
import { placeSkull } from '../skull.js';
import { SOUL_SAND } from '../nether-blocks.js';
import { PHYSICS } from '../world.js';
import { WITHER, WITHER_PROOF_INTERNAL, skullResistance } from '../wither-boss.js';
import { explosionResistance } from '../explosion.js';

// The players (server player records) of `views` whose box meets the wither's box grown by (ex, ey, ez): AxisAlignedBB.intersectsWith is strict on every side.
export function playersAround(views, e, ex, ey, ez) {
  const hw = WITHER.width / 2, pw = PHYSICS.width / 2, out = [];
  for (const v of views) {
    const p = v.player ?? v;
    if (!p?.position || p.dead) continue;
    const q = p.position;
    if (q.x + pw > e.x - hw - ex && q.x - pw < e.x + hw + ex && q.y + PHYSICS.height > e.y - ey && q.y < e.y + WITHER.height + ey && q.z + pw > e.z - hw - ez && q.z - pw < e.z + hw + ez) out.push(p);
  }
  return out;
}

// EntityWitherSkull.func_145772_a on a blue skull (the same function explosion-simulation.js uses): resistance capped at 0.8 except bedrock, end portal, its frame and command blocks.
export const boundedSkullResistance = id => skullResistance(true, WITHER_PROOF_INTERNAL.includes(id), explosionResistance(id));

export class ServerWither {
  constructor(sim) { this.sim = sim; }
  // The `hooks` of placeSkull for player `p`'s click. A Nether player builds no wither here (the Overworld only; the Nether's skull store is not the dimension's).
  hooks(p) {
    const sim = this.sim;
    return { skulls: sim.tileEntities.skulls, difficulty: p.dimension ? 0 : sim.difficulty, soulSand: SOUL_SAND, spawnWither: (x, y, z, yaw) => this.spawn(x, y, z, yaw) };
  }
  place(p, target) {
    const sim = this.sim;
    return placeSkull({ world: sim.world, survival: p.survival, yaw: p.yaw }, { id: p.survival.held.id, damage: p.survival.held?.damage ?? 0, target }, this.hooks(p)).placed;
  }
  // BlockSkull.func_149965_a's spawn: the entity joins the world (EntityWorld.spawnWither: Invul 220, a third of the health) and the players near it get `spawnWither`.
  spawn(x, y, z, yaw) {
    const sm = this.sim.mobs, e = sm.mobs.spawnWither(x, y, z, yaw);
    for (const p of playersAround(sm.views.values(), e, 50, 50, 50)) this.sim.achievements.award(p, 'spawnWither');
    return e;
  }
}

// Called once by ServerMobs' constructor (every dimension's instance).
export function installServerWither(sm) {
  const { mobs, host } = sm, skulls = mobs.skulls, tickOne = skulls.tickOne.bind(skulls);
  skulls.tickOne = b => { sm.target(b); return tickOne(b); }; // the sweep tests the player nearest to the skull (EntityFireball.onUpdate: every player's box in the world)
  const dead = mobs.onDeath;
  mobs.onDeath = function (e, source) {
    const r = dead.call(this, e, source);
    if (e?.type === 'wither') for (const p of playersAround(sm.views.values(), e, 50, 100, 50)) host.achievements?.award(p, 'killWither'); // dropFewItems: every player in the box
    return r;
  };
}
