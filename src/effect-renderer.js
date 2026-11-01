// EffectRenderer (bkn), Java 1.7.10: one pool of client particles in four
// layers, keyed by EntityFX.getFXLayer (bkm.a()). Layer 0 is the particles.png
// sheet (smoke, flame, splash, bubbles, crits, hearts, spells...), 1 the block
// atlas (digging and block dust, plus the huge-explosion emitter), 2 the item
// atlas (EntityBreakingFX: snowballpoof, iconcrack) and 3 the particles that
// draw themselves (large explosion puffs, the Crit2FX emitter). Each particle
// carries `layer` and the `owner` whose step(world, p) is its onUpdate.
// Evidence: public/research/particles.md and fx-reference.json.
const f = Math.fround;

// EffectRenderer.addEffect: a layer holds at most 4000; the oldest is removed first.
export const PARTICLE_LIMIT = 4000;
export const F01 = f(0.1), F04 = f(0.4), F015 = f(0.15), F09 = f(0.9);
// The float constants the bytecode widens to double.
export const D01 = 0.10000000149011612, D04 = 0.4000000059604645;
// EntityFX: setSize(0.2F, 0.2F), yOffset = height / 2.
export const FX_SIZE = f(0.2), FX_Y_OFFSET = f(FX_SIZE / 2);

export class EffectRenderer {
  constructor({ limit = PARTICLE_LIMIT } = {}) {
    this.limit = limit;
    this.layers = [[], [], [], []];
  }
  // EffectRenderer.addEffect(EntityFX).
  add(p) {
    const list = this.layers[p.layer];
    if (list.length >= this.limit) list.shift();
    list.push(p);
    return p;
  }
  // EffectRenderer.updateEffects: layers 0 to 3, each walked by index against its
  // live size, so a particle added to a later position (or a later layer) during
  // the pass gets its first update this tick; dead ones are removed in place.
  tick(world) {
    for (const list of this.layers)
      for (let j = 0; j < list.length; j++) {
        const p = list[j];
        p.owner.step(world, p);
        if (p.dead) list.splice(j--, 1);
      }
  }
  clear() {
    for (const list of this.layers) list.length = 0;
  }
  // EffectRenderer.getStatistics (the F3 "P:" count): layers 0 to 2 only.
  count() {
    return this.layers[0].length + this.layers[1].length + this.layers[2].length;
  }
}

// new EntityFX(world, x, y, z, vx, vy, vz) (bkm): the 4-argument constructor
// (box, yOffset, white colour, then four Entity.rand draws: jitter x, jitter y,
// scale and lifetime), then the 7-argument motion: a +-0.4 Math.random kick on
// each axis, rescaled to length (r + r + 1) * 0.15 * 0.4 with +0.1 upwards.
// `rand` is the particle's Entity.rand, `r` Math.random. particleGravity
// (field i) starts at 0.
export function entityFX(x, y, z, vx, vy, vz, rand, r) {
  const jx = f(rand.nextFloat() * 3), jy = f(rand.nextFloat() * 3),
    scale = f(f(f(rand.nextFloat() * 0.5) + 0.5) * 2),
    max = Math.trunc(f(4 / f(f(rand.nextFloat() * F09) + F01)));
  let mx = vx + f(f(r() * 2 - 1) * F04), my = vy + f(f(r() * 2 - 1) * F04), mz = vz + f(f(r() * 2 - 1) * F04);
  const speed = f(f(r() + r() + 1) * F015), n = f(Math.sqrt(mx * mx + my * my + mz * mz));
  mx = (mx / n) * speed * D04;
  my = (my / n) * speed * D04 + D01;
  mz = (mz / n) * speed * D04;
  const half = f(FX_SIZE / 2), y0 = y - FX_Y_OFFSET;
  return {
    x, y, z, px: x, py: y, pz: z, mx, my, mz,
    box: [x - half, y0, z - half, x + half, y0 + FX_SIZE, z + half],
    width: FX_SIZE, height: FX_SIZE, yOffset: FX_Y_OFFSET,
    jx, jy, scale, age: 0, max, gravity: 0,
    r: 1, g: 1, b: 1, a: 1,
    onGround: false, inWeb: false, noClip: false, dead: false,
  };
}

// Entity.setSize on a particle: the box keeps its min corner (posX/posZ catch up
// on the next move); yOffset stays what the constructor set.
export function setSize(p, w, h) {
  const b = p.box;
  p.width = w;
  p.height = h;
  b[3] = b[0] + w;
  b[5] = b[2] + w;
  b[4] = b[1] + h;
  return p;
}
