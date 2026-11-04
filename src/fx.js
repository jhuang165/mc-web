// The particles.png and item-icon EntityFX kinds, Java 1.7.10, and RenderGlobal.doSpawnParticle
// (bma.b) routing for every name this build spawns. Each constructor and onUpdate is from the
// original class: EntityBubbleFX (bjv), EntityCritFX (bjx), EntityCrit2FX (bjw), EntityFlameFX
// (bkf), EntityLavaFX (bkk), EntityRainFX (blf), EntitySplashFX (bky), EntityHeartFX (bkh),
// EntitySpellParticleFX (bkx), EntityAuraFX (bla), EntitySuspendFX (bkz), EntityDropParticleFX
// (bjy) and EntityBreakingFX (bju) for iconcrack. Explosion and smoke kinds stay in
// explosion-particles.js, block dust in particles.js; all share one EffectRenderer.
// Evidence: public/research/fx-reference.json (tools/verify-fx.mjs) and particles.md.
import { moveParticleEntity } from "./particles.js";
import { acceptsParticle } from "./particle-settings.js";
import { EffectRenderer, entityFX, setSize } from "./effect-renderer.js";
import { JavaRandom, mhSin, mhCos } from "./lighting.js";
import { liquidHeightPercent } from "./fluids.js";
import { WATER, isLiquid } from "./world.js";
import { materialSolid } from "./plants.js";
import { POTION_TYPES } from "./potions.js";
import { makePortalParticle, stepPortalParticle, portalParticleScale, portalParticleLight } from './portal-particles.js';

const f = Math.fround;
const GROUND = f(0.7), DRAG = f(0.98);
// Math.random lifetimes: (int)(n / (Math.random() * 0.8 + 0.2)).
const life = (n, r) => Math.trunc(n / (r() * 0.8 + 0.2));
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
// The Entity.rand draws of the particle's own java.util.Random.
const freshEntityRandom = () => new JavaRandom(Math.floor(Math.random() * 2 ** 48));
// Material.isLiquid || Material.isSolid at the particle's block (rain and drip deaths).
const liquidOrSolid = (b) => isLiquid(b) || materialSolid(b);

// EntityFX.getFXLayer for each kind here.
const LAYER = { crit2: 3, iconcrack: 2 };
const KINDS = new Set(["bubble", "suspended", "depthsuspend", "townaura", "crit", "magicCrit", "mobSpell", "mobSpellAmbient", "spell", "instantSpell", "flame", "lava", "splash", "rain", "heart", "angryVillager", "happyVillager", "dripWater", "dripLava", "portal"]);

export class Fx {
  // `explosions` (ExplosionParticles) builds explode, smoke and largesmoke; `world` is the
  // client world the constructors that update at once (crit, Crit2FX) move in.
  constructor({ random = Math.random, entityRandom = freshEntityRandom, worldRandom = new JavaRandom(Date.now()), effects = new EffectRenderer(), explosions = null, world = null } = {}) {
    this.random = random;
    this.entityRandom = entityRandom;
    this.worldRandom = worldRandom;
    this.effects = effects;
    this.explosions = explosions;
    this.world = world;
    this.setting = 0;
    this.viewer = null;
  }
  get list() {
    return this.effects.layers.flat().filter((p) => p.owner === this);
  }
  clear() {
    for (const list of this.effects.layers)
      for (let i = 0; i < list.length; i++) if (list[i].owner === this) list.splice(i--, 1);
  }
  // World.spawnParticle -> RenderGlobal.doSpawnParticle: the Particles-setting and 16-block
  // filter, then the constructor and EffectRenderer.addEffect. iconcrack names are
  // "iconcrack_<item>[_<meta>]".
  spawn(name, x, y, z, vx = 0, vy = 0, vz = 0, viewer = this.viewer) {
    if (this.explosions && (name === "hugeexplosion" || name === "largeexplode")) return this.explosions.spawn(name, x, y, z, vx, vy, vz, viewer);
    if (!acceptsParticle(name, this.setting, this.worldRandom, x, y, z, viewer)) return null;
    if (name === "explode" || name === "smoke" || name === "largesmoke") return this.explosions ? this.effects.add(this.explosions.make(name, x, y, z, vx, vy, vz)) : null;
    let p;
    if (name.startsWith("iconcrack_")) {
      const [, id, meta = "0"] = name.split("_", 3);
      p = this.iconcrack(x, y, z, vx, vy, vz, Number(id), Number(meta));
    } else if (KINDS.has(name)) p = this.make(name, x, y, z, vx, vy, vz);
    else return null;
    return this.effects.add(p);
  }
  // EffectRenderer.addEffect(new ...) without RenderGlobal: EntityRenderer.addRainParticles
  // adds its rain drops and lava smoke this way, past the Particles setting and distance.
  addDirect(name, x, y, z, vx = 0, vy = 0, vz = 0) {
    if (name === "smoke") return this.explosions ? this.effects.add(this.explosions.make(name, x, y, z, vx, vy, vz)) : null;
    return this.effects.add(this.make(name, x, y, z, vx, vy, vz));
  }
  base(kind, x, y, z, vx, vy, vz) {
    const rand = this.entityRandom();
    const p = entityFX(x, y, z, vx, vy, vz, rand, this.random);
    return Object.assign(p, { kind, rand, tex: 0, layer: LAYER[kind] ?? 0, owner: this });
  }
  // The constructors, as RenderGlobal calls them for each name.
  make(name, x, y, z, vx = 0, vy = 0, vz = 0) {
    const r = this.random;
    let p;
    switch (name) {
      case 'portal': return makePortalParticle(this, x, y, z, vx, vy, vz);
      case "bubble": {
        p = this.base("bubble", x, y, z, vx, vy, vz);
        p.tex = 32;
        setSize(p, f(0.02), f(0.02));
        p.scale = f(p.scale * f(f(p.rand.nextFloat() * f(0.6)) + f(0.2)));
        p.mx = vx * f(0.2) + f(f(r() * 2 - 1) * f(0.02));
        p.my = vy * f(0.2) + f(f(r() * 2 - 1) * f(0.02));
        p.mz = vz * f(0.2) + f(f(r() * 2 - 1) * f(0.02));
        p.max = life(8, r);
        return p;
      }
      case "suspended": {
        p = this.base("suspended", x, y - 0.125, z, vx, vy, vz);
        p.r = f(0.4);
        p.g = f(0.4);
        p.b = f(0.7);
        setSize(p, f(0.01), f(0.01));
        p.scale = f(p.scale * f(f(p.rand.nextFloat() * f(0.6)) + f(0.2)));
        p.mx = vx * 0;
        p.my = vy * 0;
        p.mz = vz * 0;
        p.max = life(16, r);
        return p;
      }
      case "depthsuspend":
      case "townaura":
      case "happyVillager": {
        p = this.base("aura", x, y, z, vx, vy, vz);
        const c = f(f(p.rand.nextFloat() * f(0.1)) + f(0.2));
        p.r = p.g = p.b = c;
        setSize(p, f(0.02), f(0.02));
        p.scale = f(p.scale * f(f(p.rand.nextFloat() * f(0.6)) + f(0.5)));
        p.mx *= f(0.02);
        p.my *= f(0.02);
        p.mz *= f(0.02);
        p.max = life(20, r);
        p.noClip = true;
        if (name === "happyVillager") {
          p.tex = 82;
          p.r = p.g = p.b = 1;
        }
        return p;
      }
      case "crit":
      case "magicCrit": {
        p = this.crit(x, y, z, vx, vy, vz, 1, name === "magicCrit");
        return p;
      }
      case "mobSpell":
      case "mobSpellAmbient":
      case "instantSpell": // bma.b: the same EntitySpellParticleFX with setBaseSpellTextureIndex(144)
      case "spell": {
        const colour = name !== "spell" && name !== "instantSpell";
        p = this.base("spell", x, y, z, colour ? 0 : vx, colour ? 0 : vy, colour ? 0 : vz);
        p.my *= f(0.2);
        if ((colour || vx === 0) && (colour || vz === 0)) {
          p.mx *= f(0.1);
          p.mz *= f(0.1);
        }
        p.scale = f(p.scale * f(0.75));
        p.max = life(8, r);
        p.baseTex = name === "instantSpell" ? 144 : 128;
        if (name === "mobSpellAmbient") p.a = f(0.15);
        if (colour) {
          p.r = f(vx);
          p.g = f(vy);
          p.b = f(vz);
        }
        return p;
      }
      case "flame": {
        p = this.base("flame", x, y, z, vx, vy, vz);
        p.mx = p.mx * f(0.01) + vx;
        p.my = p.my * f(0.01) + vy;
        p.mz = p.mz * f(0.01) + vz;
        // The constructor's position jitter goes to its local copies only, but draws six floats.
        for (let i = 0; i < 6; i++) p.rand.nextFloat();
        p.base = p.scale;
        p.max = life(8, r) + 4;
        p.noClip = true;
        p.tex = 48;
        return p;
      }
      case "lava": {
        p = this.base("lava", x, y, z, 0, 0, 0);
        p.mx *= f(0.8);
        p.my *= f(0.8);
        p.mz *= f(0.8);
        p.my = f(f(p.rand.nextFloat() * f(0.4)) + f(0.05));
        p.scale = f(p.scale * f(f(p.rand.nextFloat() * 2) + f(0.2)));
        p.base = p.scale;
        p.max = life(16, r);
        p.tex = 49;
        return p;
      }
      case "rain":
      case "splash": {
        p = this.base("rain", x, y, z, 0, 0, 0);
        p.mx *= f(0.3);
        p.my = f(f(f(r()) * f(0.2)) + f(0.1));
        p.mz *= f(0.3);
        p.tex = 19 + p.rand.nextInt(4);
        setSize(p, f(0.01), f(0.01));
        p.gravity = f(0.06);
        p.max = life(8, r);
        if (name === "splash") {
          p.gravity = f(0.04);
          p.tex++;
          if (vy === 0 && (vx !== 0 || vz !== 0)) {
            p.mx = vx;
            p.my = vy + 0.1;
            p.mz = vz;
          }
        }
        return p;
      }
      case "heart":
      case "angryVillager": {
        const angry = name === "angryVillager";
        p = this.base("heart", x, angry ? y + 0.5 : y, z, 0, 0, 0);
        p.mx *= f(0.01);
        p.my *= f(0.01);
        p.mz *= f(0.01);
        p.my += 0.1;
        p.scale = f(p.scale * f(0.75));
        p.scale = f(p.scale * 2);
        p.base = p.scale;
        p.max = 16;
        p.tex = angry ? 81 : 80;
        return p;
      }
      case "dripWater":
      case "dripLava": {
        p = this.base("drip", x, y, z, 0, 0, 0);
        p.mx = p.my = p.mz = 0;
        p.lava = name === "dripLava";
        if (p.lava) p.g = p.b = 0;
        else p.r = p.g = 0;
        p.tex = 113;
        setSize(p, f(0.01), f(0.01));
        p.gravity = f(0.06);
        p.wait = 40;
        p.max = Math.trunc(64 / (r() * 0.8 + 0.2));
        return p;
      }
    }
    throw new Error("Unknown particle: " + name);
  }
  // new EntityCritFX(world, x, y, z, vx, vy, vz, 1.0F); RenderGlobal's magicCrit tints it
  // (r * 0.3, g * 0.8) and moves to the next texture. The constructor updates once.
  crit(x, y, z, vx, vy, vz, k = 1, magic = false) {
    const r = this.random, p = this.base("crit", x, y, z, 0, 0, 0);
    p.mx *= f(0.1);
    p.my *= f(0.1);
    p.mz *= f(0.1);
    p.mx += vx * 0.4;
    p.my += vy * 0.4;
    p.mz += vz * 0.4;
    p.g = p.b = f(r() * f(0.3) + f(0.6));
    p.r = p.b;
    p.scale = f(p.scale * f(0.75));
    p.scale = f(p.scale * k);
    p.base = p.scale;
    p.max = Math.trunc(6 / (r() * 0.8 + 0.6));
    p.max = Math.trunc(f(p.max * k));
    p.tex = 65;
    this.step(this.world, p);
    if (magic) {
      p.r = f(p.r * f(0.3));
      p.g = f(p.g * f(0.8));
      p.tex++;
    }
    return p;
  }
  // new EntityBreakingFX(world, x, y, z, vx, vy, vz, item, meta): the item icon, snow-block
  // gravity (1), half scale, motion * 0.1 plus the velocity.
  iconcrack(x, y, z, vx, vy, vz, item, meta = 0) {
    const p = this.base("iconcrack", x, y, z, 0, 0, 0);
    p.item = item;
    p.meta = meta;
    p.gravity = 1;
    p.scale = f(p.scale / 2);
    p.mx = p.mx * f(0.1) + vx;
    p.my = p.my * f(0.1) + vy;
    p.mz = p.mz * f(0.1) + vz;
    return p;
  }
  // EntityPlayerSP.onCriticalHit: new EntityCrit2FX(world, target), added directly.
  // `target()` gives the entity's live x, z, box minY, width, height and motion.
  // EntityPlayerSP.onEnchantmentCritical is the same with "magicCrit" (the tinted crit particle).
  crit2(target, magic = false) {
    const t = target(), p = this.base("crit2", t.x, t.minY + f(t.height / 2), t.z, t.mx, t.my, t.mz);
    Object.assign(p, { target, age: 0, max: 3, particle: magic ? "magicCrit" : "crit" });
    this.step(this.world, p);
    return this.effects.add(p);
  }
  // Each class's onUpdate.
  step(world, p) {
    if (p.kind === 'portal') { stepPortalParticle(p); return; }
    if (p.kind === "crit2") {
      const rand = p.rand, t = p.target();
      for (let i = 0; i < 16; i++) {
        const d3 = f(f(rand.nextFloat() * 2) - 1), d2 = f(f(rand.nextFloat() * 2) - 1), d = f(f(rand.nextFloat() * 2) - 1);
        if (d3 * d3 + d2 * d2 + d * d > 1) continue;
        this.spawn(p.particle, t.x + (d3 * t.width) / 4, t.minY + f(t.height / 2) + (d2 * t.height) / 4, t.z + (d * t.width) / 4, d3, d2 + 0.2, d);
      }
      if (++p.age >= p.max) p.dead = true;
      return;
    }
    p.px = p.x;
    p.py = p.y;
    p.pz = p.z;
    const k = p.kind, at = (bx, by, bz) => world.get(Math.floor(bx), Math.floor(by), Math.floor(bz));
    if (k === "bubble") {
      p.my += 0.002;
      moveParticleEntity(world, p, p.mx, p.my, p.mz);
      this.drag(p, f(0.85));
      if (at(p.x, p.y, p.z) !== WATER) p.dead = true;
      if (p.max-- <= 0) p.dead = true;
      return;
    }
    if (k === "suspended" || k === "aura") {
      moveParticleEntity(world, p, p.mx, p.my, p.mz);
      if (k === "aura") this.drag(p, 0.99);
      else if (at(p.x, p.y, p.z) !== WATER) p.dead = true;
      if (p.max-- <= 0) p.dead = true;
      return;
    }
    if (k === "rain" || k === "drip") {
      if (k === "drip") {
        if (p.lava) {
          p.r = 1;
          p.g = f(16 / (40 - p.wait + 16));
          p.b = f(4 / (40 - p.wait + 8));
        } else {
          p.r = f(0.2);
          p.g = f(0.3);
          p.b = 1;
        }
      }
      p.my -= p.gravity;
      if (k === "drip") {
        if (p.wait-- > 0) {
          p.mx *= 0.02;
          p.my *= 0.02;
          p.mz *= 0.02;
          p.tex = 113;
        } else p.tex = 112;
      }
      moveParticleEntity(world, p, p.mx, p.my, p.mz);
      this.drag(p, DRAG);
      if (p.max-- <= 0) p.dead = true;
      if (p.onGround) {
        if (k === "rain") {
          if (this.random() < 0.5) p.dead = true;
        } else if (!p.lava) {
          p.dead = true;
          this.spawn("splash", p.x, p.y, p.z, 0, 0, 0);
        } else p.tex = 114;
        p.mx *= GROUND;
        p.mz *= GROUND;
      }
      const bx = Math.floor(p.x), by = Math.floor(p.y), bz = Math.floor(p.z);
      if (liquidOrSolid(world.get(bx, by, bz)) && p.y < f(f(by + 1) - liquidHeightPercent(world.getMeta(bx, by, bz)))) p.dead = true;
      return;
    }
    if (p.age++ >= p.max) p.dead = true;
    if (k === "spell") {
      p.tex = p.baseTex + (7 - Math.trunc((p.age * 8) / p.max));
      p.my += 0.004;
    } else if (k === "lava") {
      if (p.rand.nextFloat() > f(p.age / p.max)) this.spawn("smoke", p.x, p.y, p.z, p.mx, p.my, p.mz);
      p.my -= 0.03;
    } else if (k === "iconcrack") p.my -= 0.04 * p.gravity;
    moveParticleEntity(world, p, p.mx, p.my, p.mz);
    if (k === "crit") {
      p.g = f(p.g * 0.96);
      p.b = f(p.b * 0.9);
      this.drag(p, f(0.7));
      p.my -= f(0.02);
    } else {
      if ((k === "heart" || k === "spell") && p.y === p.py) {
        p.mx *= 1.1;
        p.mz *= 1.1;
      }
      this.drag(p, k === "flame" || k === "spell" ? f(0.96) : k === "lava" ? f(0.999) : k === "heart" ? f(0.86) : DRAG);
    }
    if (p.onGround) {
      p.mx *= GROUND;
      p.mz *= GROUND;
    }
  }
  drag(p, d) {
    p.mx *= d;
    p.my *= d;
    p.mz *= d;
  }
  // The billboard for EffectRenderer.renderParticles: particles.png cell (tex % 16, tex / 16)
  // with the 0.0624375 inset, half-size 0.1 * scale (the render-time scale for crit, heart,
  // flame and lava), colour and alpha. Crit2FX draws nothing.
  sprite(p, partial) {
    if (p.kind === "crit2" || p.layer !== 0) return null;
    let scale = p.scale;
    const t = f(f(p.age + f(partial)) / p.max);
    if (p.kind === 'portal') scale = p.scale = portalParticleScale(p, partial);
    else if (p.kind === "crit" || p.kind === "heart") scale = f(p.base * clamp01(f(t * 32)));
    else if (p.kind === "flame") scale = f(p.base * f(1 - f(f(t * t) * f(0.5))));
    else if (p.kind === "lava") scale = f(p.base * f(1 - f(t * t)));
    const u = f((p.tex % 16) / 16), v = f(Math.trunc(p.tex / 16) / 16);
    return { u0: u, u1: f(u + f(0.0624375)), v0: v, v1: f(v + f(0.0624375)), size: f(f(0.1) * scale) };
  }
  // getBrightnessForRender overrides: flame adds block light as it ages, lava is fully lit,
  // a lava drip is 257 (block light past full).
  brightness(p, partial, packed) {
    if (p.kind === 'portal') return portalParticleLight(p, packed);
    if (p.kind === "flame") {
      const t = clamp01(f(f(p.age + f(partial)) / p.max));
      return Math.min(240, (packed & 255) + Math.trunc(f(f(t * 15) * 16))) | (((packed >> 16) & 255) << 16);
    }
    if (p.kind === "lava") return 240 | (((packed >> 16) & 255) << 16);
    if (p.kind === "drip" && p.lava) return 257;
    return packed;
  }
}

// The entity spawn sites. `e` carries the entity's x, z, box minY, posY (`y`), width, height
// and motion (mx, my, mz); `rand` is its Entity.rand.
const D02 = 0.20000000298023224;

// Entity.handleWaterMovement (sa.N), on the first tick in water (not the entity's first
// update): the splash sound's volume and pitch, then 1 + width * 20 "bubble" (sinking by
// up to 0.2) and as many "splash" at the box floor's next block, +-width around it.
export function enterWater(fx, e, rand) {
  let volume = f(f(Math.sqrt(e.mx * e.mx * D02 + e.my * e.my + e.mz * e.mz * D02)) * f(0.2));
  if (volume > 1) volume = 1;
  const pitch = f(1 + f(f(rand.nextFloat() - rand.nextFloat()) * f(0.4)));
  const w = f(e.width), top = f(Math.floor(e.minY) + 1), n = f(1 + f(w * 20));
  for (const name of ["bubble", "splash"])
    for (let i = 0; i < n; i++) {
      const dx = f(f(f(rand.nextFloat() * 2) - 1) * w), dz = f(f(f(rand.nextFloat() * 2) - 1) * w);
      fx?.spawn(name, e.x + dx, top, e.z + dz, e.mx, name === "bubble" ? e.my - f(rand.nextFloat() * f(0.2)) : e.my, e.mz);
    }
  return { volume, pitch };
}

// EntityLivingBase.onEntityUpdate (sv), when the air supply reaches -20: 8 "bubble" within
// +-1 of posY with the entity's motion, before the drowning damage.
export function drownBubbles(fx, e, rand) {
  for (let i = 0; i < 8; i++) {
    const dx = f(rand.nextFloat() - rand.nextFloat()), dy = f(rand.nextFloat() - rand.nextFloat()), dz = f(rand.nextFloat() - rand.nextFloat());
    fx.spawn("bubble", e.x + dx, e.y + dy, e.z + dz, e.mx, e.my, e.mz);
  }
}

// The 7 or 20 spread-out particles of EntityAnimal.handleHealthUpdate(18) ("heart", 0.5 up,
// after feeding) and EntityLivingBase.onDeathUpdate at deathTime 20 ("explode"): three
// gaussian * 0.02 velocities, then a point in the box (+-width, height above y + `up`).
export function burst(fx, name, count, e, rand, up = 0) {
  const w = f(e.width), h = f(e.height);
  for (let i = 0; i < count; i++) {
    const vx = rand.nextGaussian() * 0.02, vy = rand.nextGaussian() * 0.02, vz = rand.nextGaussian() * 0.02;
    const x = e.x + f(f(rand.nextFloat() * w) * 2) - w, y = e.y + up + f(rand.nextFloat() * h), z = e.z + f(f(rand.nextFloat() * w) * 2) - w;
    fx.spawn(name, x, y, z, vx, vy, vz);
  }
}

// PotionHelper.calcPotionLiquidColor over the active effects (ascending ids; each counted
// amplifier + 1 times): datawatcher 7, 0 without effects. Potion.liquidColor: speed 0x7CAFC6,
// strength 0x932423, regeneration 0xCD5CAB, invisibility 0x7F8392, hunger 0x587653, poison 0x4E9331.
const LIQUID_COLOR = Object.fromEntries(Object.values(POTION_TYPES).map((t) => [t.id, t.color])); // potions.js: all 23 Potion.liquidColor values
export function potionColor(effects) {
  let r = 0, g = 0, b = 0, n = 0;
  for (const e of [...effects].sort((a, c) => a.id - c.id)) {
    const c = LIQUID_COLOR[e.id] ?? 3694022;
    for (let i = 0; i <= e.amplifier; i++) {
      r = f(r + f(((c >> 16) & 255) / 255));
      g = f(g + f(((c >> 8) & 255) / 255));
      b = f(b + f((c & 255) / 255));
      n = f(n + 1);
    }
  }
  if (!n) return 0;
  return (Math.trunc(f(f(r / n) * 255)) << 16) | (Math.trunc(f(f(g / n) * 255)) << 8) | Math.trunc(f(f(b / n) * 255));
}

// EntityLivingBase.updatePotionEffects (sv): with colour `color`, a visible entity spawns a
// "mobSpell" half the ticks (ambient beacon effects one in five of those, as
// "mobSpellAmbient"), tinted by the colour, in the box: posY - yOffset plus up to the height.
export function potionParticles(fx, e, color, rand, { ambient = false, invisible = false } = {}) {
  if (color <= 0) return;
  let show = invisible ? rand.nextInt(15) === 0 : rand.nextBoolean();
  // `show &= nextInt(5) == 0`: the roll is drawn even when `show` is already false.
  if (ambient) show = (rand.nextInt(5) === 0) && show;
  if (!show) return;
  const r = ((color >> 16) & 255) / 255, g = ((color >> 8) & 255) / 255, b = (color & 255) / 255;
  const x = e.x + (rand.nextDouble() - 0.5) * f(e.width), y = e.y + rand.nextDouble() * f(e.height) - (e.yOffset ?? 0), z = e.z + (rand.nextDouble() - 0.5) * f(e.width);
  fx.spawn(ambient ? "mobSpellAmbient" : "mobSpell", x, y, z, r, g, b);
}

// Vec3.rotateAroundX / rotateAroundY with MathHelper's table sine.
function rotate(v, pitch, yaw) {
  let c = mhCos(pitch), s = mhSin(pitch);
  const y = v[1] * c + v[2] * s, z0 = v[2] * c - v[1] * s;
  c = mhCos(yaw);
  s = mhSin(yaw);
  return [v[0] * c + z0 * s, y, z0 * c - v[0] * s];
}

// EntityPlayer.updateItemUse (n = 5 while eating, 16 when done) and
// EntityLivingBase.renderBrokenItemStack (5, for a broken tool): "iconcrack_<id>" crumbs
// from in front of the eyes, thrown up and forward along the look. `e` gives x, the eye y
// (posY + getEyeHeight), z and the Java rotationYaw/rotationPitch in degrees.
export function itemCrumbs(fx, n, name, e, rand, random = fx.random) {
  const pitch = f(f(f(-e.pitch) * f(Math.PI)) / 180), yaw = f(f(f(-e.yaw) * f(Math.PI)) / 180);
  for (let i = 0; i < n; i++) {
    const v = rotate([(rand.nextFloat() - 0.5) * 0.1, random() * 0.1 + 0.1, 0], pitch, yaw);
    const q = rotate([(rand.nextFloat() - 0.5) * 0.3, -rand.nextFloat() * 0.6 - 0.3, 0.6], pitch, yaw);
    fx.spawn(name, q[0] + e.x, q[1] + e.y, q[2] + e.z, v[0], v[1] + 0.05, v[2]);
  }
}

// ItemDye.func_150918_a (RenderGlobal.playAuxSFX 2005, after bone meal is used): 15
// "happyVillager" over the block, up to its bounds' maxY, from the static Item.itemRand;
// nothing if the cell is air by then.
export function boneMealSparkles(fx, block, x, y, z, maxY, rand, count = 15) {
  if (block === 0) return;
  for (let i = 0; i < count; i++) {
    const vx = rand.nextGaussian() * 0.02, vy = rand.nextGaussian() * 0.02, vz = rand.nextGaussian() * 0.02;
    fx.spawn("happyVillager", f(x + rand.nextFloat()), y + rand.nextFloat() * maxY, f(z + rand.nextFloat()), vx, vy, vz);
  }
}
