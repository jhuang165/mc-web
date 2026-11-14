// RenderSnowball (bod) and EntityBreakingFX (bju) drawing. A snowball is the
// item icon on a quad facing the camera at 0.5 scale, centred on the 0.25 box
// (vertices (-0.5, -0.25) to (0.5, 0.75) x 0.5 about posY); the quad's normal
// is (0, 1, 0) in its own frame so it takes the same two item lights as GL.
// RenderSnowball leaves shadowSize at 0, so it casts no shadow. Particles
// (every EntityBreakingFX in EffectRenderer layer 2: snowballpoof and iconcrack)
// are EntityBreakingFX.renderParticle quads on the ActiveRenderInfo basis
// (particleQuad, replayed against the original Tessellator output), lit only by
// the lightmap at getBrightnessForRender's cell, as GL lighting is off for particles.
import * as THREE from "three";
import { entityMaterial, worldMaterial, liveSpriteTransform } from "./light-material.js";
import { itemTexture, pixelTexture, skinBox } from "./first-person.js";
import { itemPasses, ITEM_POTION } from "./item-passes.js";
import { particleBasis, particleLightCell, particleQuad, quantize } from "./particles.js";

const SNOWBALL = 312, EGG = 316, ENDER_PEARL = 378;
export function projectileItemId(kind) {
  if (kind === "snowball") return SNOWBALL;
  if (kind === "egg") return EGG;
  if (kind === "enderPearl") return ENDER_PEARL;
  if (kind === "firework") return 2071; // RenderSnowball(Items.fireworks)
  if (kind === "eyeOfEnder") return 1960; // RenderManager maps EntityEnderEye (zd) to RenderSnowball(Items.ender_eye)
  if (kind === "fireball" || kind === "smallFireball") return 1952; // RenderFireball: the fire charge icon (fireballs.js)
  if (kind === "potion") return 385; // witch.js ITEM_POTION; drawn with the splash bottle icon (texture below)
  throw new TypeError(`Unsupported projectile render kind: ${kind}`);
}
// Entity.getBrightnessForRender samples floor(posY - yOffset + height * 0.66):
// 0.165 above the ball's posY.
const BALL_LIGHT = 0.25 * 0.66;

export class ProjectileRenderer {
  constructor(scene, view) {
    this.scene = scene;
    this.view = view;
    this.balls = new Map();
    this.particles = new Map();
    const g = new THREE.PlaneGeometry(1, 1);
    g.translate(0, 0.25, 0);
    const n = g.attributes.normal;
    for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
    this.sprite = g;
  }
  // RenderSnowball(item): an egg uses the egg icon, a snowball the snowball icon;
  // the "snowballpoof" particles (EntityBreakingFX with Items.snowball) always show the snowball.
  texture(kind) {
    // RenderSnowball(Items.potionitem, 16384): the splash bottle icon (no potion colour overlay is drawn).
    if (kind === "potion") return pixelTexture("/media/1.7.10/items/potion_bottle_splash.png");
    if (kind === "expBottle") return pixelTexture("/media/1.7.10/items/experience_bottle.png"); // RenderSnowball(Items.experience_bottle)
    return pixelTexture(itemTexture(projectileItemId(kind)));
  }
  // RenderWitherSkull (bpd): ModelSkeletonHead on wither_invulnerable.png for a blue skull, else wither.png.
  skullMaterial(b) {
    return entityMaterial(this.view.lighting, { map: pixelTexture(b.blue ? "/media/1.7.10/entity/wither/wither_invulnerable.png" : "/media/1.7.10/entity/wither/wither.png") });
  }
  skullMesh(material) {
    const group = new THREE.Group(), box = new THREE.Mesh(skinBox(8, 8, 8, 0, 0, 64, 32), material);
    box.position.y = 4 / 16;
    box.rotation.y = Math.PI; // skinBox's front is +z; the model's front is -z
    group.add(box);
    return group;
  }
  material(kind) {
    return entityMaterial(this.view.lighting, { map: this.texture(kind), alphaTest: 0.1 });
  }
  // RenderSnowball.doRender (bod, bytecode-read): an EntityPotion whose icon is the splash bottle first draws the "overlay" icon (potion_overlay)
  // with glColor3f of PotionHelper's liquid colour for the potion damage, then resets to white and draws the bottle. Same quad both times, so the
  // tinted overlay is the ball's own mesh and the bottle is a child in front of it (polygon offset, as the leather overlay).
  potionPasses(b) {
    const passes = itemPasses(ITEM_POTION, (b.damage | 0) | 16384);
    const overlay = entityMaterial(this.view.lighting, { map: pixelTexture(passes.base), color: passes.tint, alphaTest: 0.1 });
    const bottle = entityMaterial(this.view.lighting, { map: pixelTexture(passes.overlay), alphaTest: 0.1 });
    bottle.polygonOffset = true;
    bottle.polygonOffsetFactor = -1;
    return { overlay, bottle };
  }
  // `partial` is the fraction of the current tick; balls interpolate from
  // lastTickPos (RenderManager), particles from prevPos. `view` is the player's
  // rotation for the particle basis, as the other particle renderers take it.
  update(balls, particles, camera, partial = 1, { yaw = 0, pitch = 0, mirror = false } = {}) {
    const seen = new Set(), lerp = (a, b) => a + (b - a) * partial;
    for (const b of balls) {
      seen.add(b);
      let m = this.balls.get(b);
      if (!m) {
        const skull = b.kind === "witherSkull", potion = b.kind === "potion" ? this.potionPasses(b) : null,
          material = skull ? this.skullMaterial(b) : potion ? potion.overlay : this.material(b.kind), mesh = skull ? this.skullMesh(material) : new THREE.Mesh(this.sprite, material);
        if (potion) {
          const bottle = new THREE.Mesh(this.sprite, potion.bottle);
          bottle.renderOrder = 1;
          bottle.frustumCulled = false;
          mesh.add(bottle);
        }
        if (!skull) mesh.scale.setScalar(b.scale ?? 0.5); // RenderFireball scale 2 (large) / 0.5 (small)
        mesh.frustumCulled = false;
        this.scene.add(mesh);
        this.balls.set(b, (m = { mesh, material, extra: potion?.bottle ?? null }));
      }
      const x = lerp(b.px, b.x), y = lerp(b.py, b.y), z = lerp(b.pz, b.z);
      if (b.kind === "witherSkull") {
        // RenderWitherSkull: the 8 cube turned to its flight (yaw from the motion, pitch up or down); the exact angles are approximated.
        m.mesh.position.set(x, y, z);
        m.mesh.rotation.set(-Math.atan2(b.vy, Math.hypot(b.vx, b.vz)), Math.atan2(b.vx, b.vz), 0, "YXZ");
        m.material.setLight(15728880);
        continue;
      }
      m.mesh.position.set(x, y + 0.25 * (b.scale ?? 0.5), z);
      m.mesh.quaternion.copy(camera.quaternion);
      const packed = b.fullbright ? 15728880 : this.view.brightness(x, y + BALL_LIGHT, z);
      m.material.setLight(packed);
      m.extra?.setLight(packed);
    }
    for (const [b, m] of this.balls)
      if (!seen.has(b)) {
        this.scene.remove(m.mesh);
        m.material.dispose();
        m.extra?.dispose();
        this.balls.delete(b);
      }
    const basis = particleBasis(180 - (yaw * 180) / Math.PI, (-pitch * 180) / Math.PI, mirror), seenFx = new Set();
    for (const p of particles) {
      seenFx.add(p);
      let m = this.particles.get(p);
      if (!m) {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(12), 3));
        geometry.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(8), 2));
        geometry.setAttribute("shade", new THREE.BufferAttribute(new Float32Array(12), 3));
        geometry.setAttribute("lightCoord", new THREE.BufferAttribute(new Float32Array(8), 2));
        geometry.setIndex([0, 1, 2, 0, 2, 3]);
        // EffectRenderer layer 2: snowballpoof and iconcrack show their item's icon.
        const map = pixelTexture(itemTexture(p.item ?? SNOWBALL, p.meta ?? 0)), material = worldMaterial(this.view.lighting, { map, uvTransform: liveSpriteTransform(map), alphaTest: 0.003921569, side: THREE.DoubleSide }),
          mesh = new THREE.Mesh(geometry, material);
        mesh.frustumCulled = false;
        this.scene.add(mesh);
        this.particles.set(p, (m = { mesh, geometry, material }));
      }
      // The icon is a whole texture here, so its bounds are 0..1 (v runs up in texture space).
      const corners = particleQuad(p, partial, basis), a = m.geometry.attributes,
        packed = this.view.brightness(...particleLightCell(p)), shade = [quantize(p.r ?? 1), quantize(p.g ?? 1), quantize(p.b ?? 1)];
      corners.forEach(([x, y, z, u, v], i) => {
        a.position.setXYZ(i, x, y, z);
        a.uv.setXY(i, u, 1 - v);
        a.shade.setXYZ(i, ...shade);
        a.lightCoord.setXY(i, packed & 0xffff, (packed >> 16) & 0xffff);
      });
      for (const k of ["position", "uv", "shade", "lightCoord"]) a[k].needsUpdate = true;
    }
    for (const [p, m] of this.particles)
      if (!seenFx.has(p)) {
        this.scene.remove(m.mesh);
        m.geometry.dispose();
        m.material.dispose();
        this.particles.delete(p);
      }
  }
  clear() {
    this.update([], [], { quaternion: new THREE.Quaternion() }, 0);
  }
}
