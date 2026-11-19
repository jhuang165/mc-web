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
import { EntityFireRenderer } from "./entity-fire-renderer.js";
import { fireballTurn, interpolateRotation, lerpPitch } from "./fireball-turn.js";

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
// The EntityThrowable kinds whose fire counter Projectiles keeps (b80 fluids80; b81 throwfire81: splash potions and bottles o' enchanting too, witch-potions.js). b82 fireext82:
// eyes of ender and rockets (both setSize(0.25, 0.25), yOffset 0) keep the counter too (eye-of-ender.js eyeFire, firework-rocket.js tickRocket).
const THROWN_FIRE = new Set(["snowball", "egg", "enderPearl", "potion", "expBottle", "eyeOfEnder", "firework"]);
// b82 mpball82 (correction 2026-11-18): EntityLargeFireball and EntitySmallFireball are not fire immune and ze.h calls setFire(1) every update, so Entity.isBurning is true
// from the first update (executed, tools/probes/BallFlagProbe.java), and RenderFireball keeps Render.doRenderShadowAndFire: the flames over the ball's box (width = height,
// yOffset 0). The wither skull's isBurning (zp.al) returns false. `burning` is a multiplayer copy's (fireball-copy.js), else the live counter (fireballs.js fireballBurn).
const BALL_FIRE = { fireball: 1, smallFireball: Math.fround(0.3125) };

// ModelSkeletonHead(0, 35, 64, 64) (bib, the wither skull's model): one box addBox(-4, -8, -4, 8, 8, 8) at rotation point 0, texture offset
// (0, 35) on the 64 x 64 wither texture. skinBox is laid out in the mob frame (x, -y, -z), the box centre (0, -4, 0) / 16 in model axes.
export const skullGeometry = () => skinBox(8, 8, 8, 0, 35, 64, 64).translate(0, 4 / 16, 0);
// The modelview RenderWitherSkull builds (bytecode-read, executed in renderfx80-reference.json): glTranslatef((float) x, (float) y, (float) z),
// glScalef(-1, -1, 1), then ModelRenderer's glRotatef(rotateAngleY * 57.295776) about y and glRotatef(rotateAngleX * 57.295776) about x, where
// ModelSkeletonHead sets rotateAngleY = yaw / 57.295776 and rotateAngleX = pitch / 57.295776; times the mob frame's diag(1, -1, -1).
const DEG = Math.fround(57.295776), RAD = Math.PI / 180;
const angle = (deg) => Math.fround(Math.fround(Math.fround(deg) / DEG) * DEG) * RAD;
export function skullMatrix(x, y, z, yaw, pitch, out = new THREE.Matrix4()) {
  const r = new THREE.Matrix4(), f = Math.fround;
  out.makeTranslation(f(x), f(y), f(z)).multiply(r.makeScale(-1, -1, 1)).multiply(r.makeRotationY(angle(yaw))).multiply(r.makeRotationX(angle(pitch)));
  return out.multiply(r.makeScale(1, -1, -1));
}

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
  // RenderWitherSkull (bpd): ModelSkeletonHead on wither_invulnerable.png for a blue skull, else wither.png; GL_CULL_FACE is off.
  skullMaterial(b) {
    return entityMaterial(this.view.lighting, { map: pixelTexture(b.blue ? "/media/1.7.10/entity/wither/wither_invulnerable.png" : "/media/1.7.10/entity/wither/wither.png"), side: THREE.DoubleSide });
  }
  skullMesh(material) {
    const mesh = new THREE.Mesh(skullGeometry(), material);
    mesh.matrixAutoUpdate = false;
    return mesh;
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
        // RenderWitherSkull: the rotation EntityFireball.onUpdate gave the skull (wither-boss-mobs.js tickOne), interpolated. A row without
        // it (a multiplayer copy) turns the same way here from its per-tick displacement, which is the motion the native turn reads.
        if (!Number.isFinite(b.yaw)) {
          const at = `${b.x},${b.y},${b.z}`;
          if (m.at !== at) { m.at = at; const t = m.turn ?? (m.turn = { yaw: 0, pitch: 0 }); t.prevYaw = t.yaw; t.prevPitch = t.pitch; if (m.seen) fireballTurn(t, b.x - b.px, b.y - b.py, b.z - b.pz); m.seen = true; }
        }
        const r = Number.isFinite(b.yaw) ? b : m.turn;
        m.mesh.matrix.copy(skullMatrix(x, y, z, interpolateRotation(r.prevYaw ?? r.yaw, r.yaw, partial), lerpPitch(r.prevPitch ?? r.pitch, r.pitch, partial)));
        m.mesh.matrixWorldNeedsUpdate = true;
        m.material.setLight(15728880);
        continue;
      }
      m.mesh.position.set(x, y + 0.25 * (b.scale ?? 0.5), z);
      m.mesh.quaternion.copy(camera.quaternion);
      const packed = b.fullbright ? 15728880 : this.view.brightness(x, y + BALL_LIGHT, z);
      m.material.setLight(packed);
      m.extra?.setLight(packed);
      // b80 fluids80: Render.doRenderShadowAndFire (bno.b, bytecode-read) draws renderEntityOnFire over a burning throwable (canRenderOnFire = isBurning; the 0.25 box):
      // a pearl or snowball out of lava. `burning` is the client copy's watched flag (object-tracker.js objectView), else the live counter.
      const ballFire = BALL_FIRE[b.kind], burning = (THROWN_FIRE.has(b.kind ?? "snowball") || ballFire !== undefined) && (b.burning ?? b.fire > 0);
      if (burning && !m.fire) m.fire = new EntityFireRenderer(this.scene, ballFire ?? 0.25, ballFire ?? 0.25, 0);
      m.fire?.update({ x, y, z }, burning, 180 - (yaw * 180) / Math.PI);
    }
    for (const [b, m] of this.balls)
      if (!seen.has(b)) {
        this.scene.remove(m.mesh);
        m.material.dispose();
        m.extra?.dispose();
        m.fire?.dispose();
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
