// EntityFireworkStarterFX (bke), EntityFireworkSparkFX (bkd) and EntityFireworkOverlayFX (bkc), Java 1.7.10.
// Evidence: public/research/fireworks-reference.json (starter / lifecycle records). The particles live in the shared
// EffectRenderer layer 0 (particles.png); ExplosionParticleRenderer draws them through sprite()/brightness().
import { moveParticleEntity } from './particles.js';
import { EffectRenderer, entityFX } from './effect-renderer.js';
import { JavaRandom } from './lighting.js';
const f = Math.fround, PI_F = f(Math.PI);

// Shape tables (bke static initialisers via the bytecode).
export const STAR_SHAPE = [[0, 1], [0.3455, 0.309], [0.9511, 0.309], [0.3795918367346939, -0.12653061224489795], [0.6122448979591837, -0.8040816326530612], [0, -0.35918367346938773]];
export const CREEPER_SHAPE = [[0, 0.2], [0.2, 0.2], [0.2, 0.6], [0.6, 0.6], [0.6, 0.2], [0.2, 0.2], [0.2, 0], [0.4, 0], [0.4, -0.6], [0.2, -0.6], [0.2, -0.4], [0, -0.4]];
const channel = (c, shift) => f(((c >> shift) & 255) / 255);

export class FireworkParticles {
  constructor({ random = Math.random, entityRandom = () => new JavaRandom(Math.floor(Math.random() * 2 ** 48)), effects = new EffectRenderer(), playSound = () => {}, viewer = null } = {}) {
    this.random = random; this.entityRandom = entityRandom; this.effects = effects; this.playSound = playSound; this.viewer = viewer;
  }
  // new EntityFireworkStarterFX(world, x, y, z, vx, vy, vz, effectRenderer, Fireworks tag): `fireworks` is
  // { explosions: [...] } (or null). EntityFX 7-arg constructor draws, then Explosions.
  spawnStarter(x, y, z, vx, vy, vz, fireworks) {
    const rand = this.entityRandom(), p = entityFX(x, y, z, 0, 0, 0, rand, this.random);
    Object.assign(p, { kind: 'fwStarter', rand, layer: 0, owner: this, mx: vx, my: vy, mz: vz, max: 8, explosions: null, twinkle: false });
    const list = fireworks?.explosions;
    if (list && list.length) {
      p.explosions = list;
      p.max = list.length * 2 - 1;
      if (list.some((e) => e.flicker)) { p.twinkle = true; p.max += 15; }
    }
    return this.effects.add(p);
  }
  // EntityFireworkSparkFX(world, x, y, z, vx, vy, vz, effectRenderer): the 4-argument EntityFX constructor, then
  // scale * 0.75 and the lifetime 48 + nextInt(12) from the particle's own Entity.rand.
  makeSpark(x, y, z, vx, vy, vz) {
    const rand = this.entityRandom(), p = entityFX(x, y, z, 0, 0, 0, rand, () => 0.5);
    Object.assign(p, { kind: 'fwSpark', rand, layer: 0, owner: this, mx: vx, my: vy, mz: vz, trail: false, twinkle: false, hasFade: false, fr: 0, fg: 0, fb: 0, frame: 160 });
    p.scale = f(p.scale * f(0.75));
    p.max = 48 + rand.nextInt(12);
    p.noClip = false;
    return p;
  }
  // RenderGlobal "fireworksSpark" (the rocket's trail): always accepted.
  spawnSpark(x, y, z, vx, vy, vz) { return this.effects.add(this.makeSpark(x, y, z, vx, vy, vz)); }
  setColour(p, c) { p.r = channel(c, 16); p.g = channel(c, 8); p.b = channel(c, 0); }
  setFade(p, c) { p.fr = channel(c, 16); p.fg = channel(c, 8); p.fb = channel(c, 0); p.hasFade = true; }
  // EntityFireworkStarterFX.createParticle.
  createParticle(s, x, y, z, vx, vy, vz, colors, fade, trail, twinkle) {
    const p = this.makeSpark(x, y, z, vx, vy, vz);
    p.trail = trail; p.twinkle = twinkle;
    this.setColour(p, colors[s.rand.nextInt(colors.length)]);
    if (fade && fade.length) this.setFade(p, fade[s.rand.nextInt(fade.length)]);
    this.effects.add(p);
  }
  ball(s, speed, n, e) {
    const r = s.rand;
    for (let i = -n; i <= n; i++)
      for (let j = -n; j <= n; j++)
        for (let k = -n; k <= n; k++) {
          const dx = j + (r.nextDouble() - r.nextDouble()) * 0.5, dy = i + (r.nextDouble() - r.nextDouble()) * 0.5, dz = k + (r.nextDouble() - r.nextDouble()) * 0.5;
          const d = f(Math.sqrt(dx * dx + dy * dy + dz * dz)) / speed + r.nextGaussian() * 0.05;
          this.createParticle(s, s.x, s.y, s.z, dx / d, dy / d, dz / d, e.colors, e.fade, e.trail, e.flicker);
          if (i !== -n && i !== n && j !== -n && j !== n) k += n * 2 - 1;
        }
  }
  shaped(s, speed, shape, e, creeper) {
    const first = shape[0];
    this.createParticle(s, s.x, s.y, s.z, first[0] * speed, first[1] * speed, 0, e.colors, e.fade, e.trail, e.flicker);
    const angle = f(s.rand.nextFloat() * PI_F), step = creeper ? 0.034 : 0.34;
    for (let i = 0; i < 3; i++) {
      const theta = angle + f(f(i) * PI_F) * step;
      let px = first[0], py = first[1];
      for (let j = 1; j < shape.length; j++) {
        const nx = shape[j][0], ny = shape[j][1];
        for (let t = 0.25; t <= 1.0; t += 0.25) {
          let dx = (px + (nx - px) * t) * speed;
          const dy = (py + (ny - py) * t) * speed, dz = dx * Math.sin(theta);
          dx *= Math.cos(theta);
          for (let sign = -1; sign <= 1; sign += 2) this.createParticle(s, s.x, s.y, s.z, dx * sign, dy, dz * sign, e.colors, e.fade, e.trail, e.flicker);
        }
        px = nx; py = ny;
      }
    }
  }
  burst(s, e) {
    const r = s.rand, ox = r.nextGaussian() * 0.05, oz = r.nextGaussian() * 0.05;
    for (let i = 0; i < 70; i++) {
      const vx = s.mx * 0.5 + r.nextGaussian() * 0.15 + ox, vz = s.mz * 0.5 + r.nextGaussian() * 0.15 + oz, vy = s.my * 0.5 + r.nextDouble() * 0.5;
      this.createParticle(s, s.x, s.y, s.z, vx, vy, vz, e.colors, e.fade, e.trail, e.flicker);
    }
  }
  // EntityFireworkStarterFX.j(): far when no viewer or the viewer is 16 or more blocks away.
  far(s) { const v = this.viewer; return !v || (s.x - v[0]) ** 2 + (s.y - v[1]) ** 2 + (s.z - v[2]) ** 2 >= 256; }
  step(world, p) {
    if (p.kind === 'fwStarter') return this.stepStarter(p);
    p.px = p.x; p.py = p.y; p.pz = p.z;
    if (p.kind === 'fwOverlay') { if (p.age++ >= p.max) p.dead = true; return; }
    if (p.age++ >= p.max) p.dead = true;
    const half = Math.trunc(p.max / 2);
    if (p.age > half) {
      p.a = f(1 - f((p.age - half) / p.max));
      if (p.hasFade) {
        p.r = f(p.r + f(f(p.fr - p.r) * f(0.2)));
        p.g = f(p.g + f(f(p.fg - p.g) * f(0.2)));
        p.b = f(p.b + f(f(p.fb - p.b) * f(0.2)));
      }
    }
    p.frame = 160 + (7 - Math.trunc(p.age * 8 / p.max));
    p.my -= 0.004;
    moveParticleEntity(world, p, p.mx, p.my, p.mz);
    p.mx *= 0.9100000262260437; p.my *= 0.9100000262260437; p.mz *= 0.9100000262260437;
    if (p.onGround) { p.mx *= 0.699999988079071; p.mz *= 0.699999988079071; }
    if (p.trail && p.age < half && (p.age + p.max) % 2 === 0) {
      const t = this.makeSpark(p.x, p.y, p.z, 0, 0, 0);
      t.r = p.r; t.g = p.g; t.b = p.b;
      t.age = Math.trunc(t.max / 2);
      if (p.hasFade) { t.hasFade = true; t.fr = p.fr; t.fg = p.fg; t.fb = p.fb; }
      t.twinkle = p.twinkle;
      this.effects.add(t);
    }
  }
  stepStarter(s) {
    const list = s.explosions, far = this.far(s) ? '_far' : '';
    if (s.age === 0 && list) {
      const large = list.length >= 3 || list.some((e) => e.type === 1);
      this.playSound('fireworks.' + (large ? 'largeBlast' : 'blast') + far, s.x, s.y, s.z, 20, f(f(0.95) + f(s.rand.nextFloat() * f(0.1))), true);
    }
    if (s.age % 2 === 0 && list && s.age / 2 < list.length) {
      const e = list[s.age / 2];
      if (e.colors.length) { // an explosion without Colors makes the original call Random.nextInt(0), which throws
        if (e.type === 1) this.ball(s, 0.5, 4, e);
        else if (e.type === 2) this.shaped(s, 0.5, STAR_SHAPE, e, false);
        else if (e.type === 3) this.shaped(s, 0.5, CREEPER_SHAPE, e, true);
        else if (e.type === 4) this.burst(s, e);
        else this.ball(s, 0.25, 2, e);
        const o = entityFX(s.x, s.y, s.z, 0, 0, 0, this.entityRandom(), () => 0.5);
        Object.assign(o, { kind: 'fwOverlay', layer: 0, owner: this, mx: 0, my: 0, mz: 0, max: 4 });
        this.setColour(o, e.colors[0]);
        this.effects.add(o);
      }
    }
    s.age++;
    if (s.age > s.max) {
      if (s.twinkle) this.playSound('fireworks.twinkle' + far, s.x, s.y, s.z, 20, f(f(0.9) + f(s.rand.nextFloat() * f(0.15))), true);
      s.dead = true;
    }
  }
  // Renderer hooks (explosion-particle-renderer.js).
  sprite(p, partial) {
    if (p.kind === 'fwStarter') return null;
    if (p.kind === 'fwOverlay') {
      const t = f(f(p.age + partial) - 1);
      p.a = f(f(0.6) - f(f(t * f(0.25)) * f(0.5)));
      return { u0: 0.25, u1: 0.5, v0: 0.125, v1: 0.375, size: f(f(7.1) * f(Math.sin(f(f(t * f(0.25)) * PI_F)))) };
    }
    if (p.twinkle && !(p.age < Math.trunc(p.max / 3) || Math.trunc((p.age + p.max) / 3) % 2 === 0)) return null;
    const u = f((p.frame % 16) / 16), v = f(Math.floor(p.frame / 16) / 16);
    return { u0: u, u1: f(u + f(0.0624375)), v0: v, v1: f(v + f(0.0624375)), size: f(f(0.1) * p.scale) };
  }
  brightness(p, partial, base) { return p.kind === 'fwSpark' ? 15728880 : base; }
}
