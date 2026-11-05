// Render.doRenderShadowAndFire / renderShadow / func_147907_a (bno) from the
// 1.7.10 JAR, as drawn with Fancy graphics: a misc/shadow.png square of side
// 2 x shadowSize, centred under the entity, laid 1/64 above the top of every
// solid cube below it and faded by height, viewer distance and block light.
import * as THREE from "three";
import { STAIRS } from "./stairs.js";
import { STONE_SLAB, CAULDRON, FLOWER_POT } from "./stone-utility.js";
import { isFlower, isCrop, FIRE, WEB, LADDER, CACTUS, REEDS, LILY_PAD, FENCE, RAIL, ANVIL, ENCHANTING_TABLE, WOODEN_DOOR, IRON_DOOR, IRON_BARS, GLASS_PANE } from "./world.js";
import { BRIGHTNESS } from "./lighting.js";
import { FOG_PARS } from "./light-material.js";

const f = Math.fround;
// shadowSize and shadowOpaque as set by each renderer's constructor
// (RenderManager registers RenderPig/RenderCow/RenderSheep with 0.7, RenderZombie's
// RenderBiped with 0.5; RenderItem and RenderXPOrb use 0.15 and 0.75).
export const SHADOWS = {
  item: { size: f(0.15), opaque: f(0.75) },
  orb: { size: f(0.15), opaque: f(0.75) },
  pig: { size: f(0.7), opaque: 1 },
  cow: { size: f(0.7), opaque: 1 },
  sheep: { size: f(0.7), opaque: 1 },
  // RenderChicken: super(new ModelChicken(), 0.3F).
  chicken: { size: f(0.3), opaque: 1 },
  // RenderManager: new RenderWolf(new ModelWolf(), new ModelWolf(), 0.5F).
  wolf: { size: f(0.5), opaque: 1 },
  // RenderManager: new RenderOcelot(new ModelOcelot(), 0.4F).
  ocelot: { size: f(0.4), opaque: 1 },
  zombie: { size: f(0.5), opaque: 1 },
  // RenderEnderman: super(new ModelEnderman(), 0.5F).
  enderman: { size: f(0.5), opaque: 1 },
  spider: { size: 1, opaque: 1 },
  // RenderCaveSpider: shadowSize *= 0.7F on RenderSpider's 1.0.
  cave_spider: { size: f(0.7), opaque: 1 },
  // RenderSquid: super(model, 0.7F); RenderBat: super(new ModelBat(), 0.25F).
  squid: { size: f(0.7), opaque: 1 },
  bat: { size: f(0.25), opaque: 1 },
  // RenderSilverfish: super(new ModelSilverfish(), 0.3F).
  silverfish: { size: f(0.3), opaque: 1 },
  skeleton: { size: f(0.5), opaque: 1 },
  // RenderCreeper: super(new ModelCreeper(), 0.5F); RenderTNTPrimed: shadowSize = 0.5F.
  creeper: { size: f(0.5), opaque: 1 },
  tnt: { size: f(0.5), opaque: 1 },
  // RenderPlayer: super(new ModelBiped(0), 0.5).
  player: { size: f(0.5), opaque: 1 },
};
// Blocks whose renderAsNormalBlock is false take no shadow (probe evidence in
// public/research/shadow-reference.json): glass, water, lava, torches, farmland,
// wheat, tall grass, chests, fire (45), the snow layer (46), the sapling (48), fences and rails. Every block that does is a full cube
// (ice does: it renders as a normal block).
const NOT_NORMAL = new Set([165,167,168,169,175,176,STONE_SLAB,CAULDRON,FLOWER_POT,...Object.keys(STAIRS).map(Number),WOODEN_DOOR,IRON_DOOR,IRON_BARS,GLASS_PANE,140,141,142,107,108,109,110,111,112,113,114,116,117,118,69,72,73,75,76,79,82,83,84,ANVIL,ENCHANTING_TABLE,9, 10, 20, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 41, 42, FIRE, 46, 48, WEB, LADDER, CACTUS, REEDS, LILY_PAD, FENCE, 154, RAIL, 119, 120, 124, 125, 126, 127, 128, 129, 130, 133, 134, 135, 136, 137, 138]);
export const takesShadow = (b) => b !== 0 && !NOT_NORMAL.has(b) && !isFlower(b) && !isCrop(b);

// `e`: { x, y, z } interpolated Java position (posY, which for items and orbs
// includes their yOffset), `pos` the tick position used for the distance
// test, `height`, `size`, `opaque`, and `child` for ageable living entities.
// `viewer` is RenderManager's viewer position (the player's eye for the
// local player). `world.get(x, y, z)` gives a block; `world.light(x, y, z)`
// World.getBlockLightValue. Returns quads { x0, x1, z0, z1, y, u0, u1, v0, v1, alpha }.
export function shadowQuads(e, viewer, world) {
  const p = e.pos ?? e, d = (p.x - viewer.x) ** 2 + (p.y - viewer.y) ** 2 + (p.z - viewer.z) ** 2,
    opacity = f((1 - d / 256) * e.opaque), quads = [];
  if (!(opacity > 0)) return quads;
  let size = e.size;
  // EntityLiving.getRenderSizeModifier is 1; children halve the shadow.
  if (e.child) size = f(size * 0.5);
  const ex = e.x, ey = e.y + f(f(e.height) / 2), ez = e.z;
  for (let bx = Math.floor(ex - size); bx <= Math.floor(ex + size); bx++)
    for (let by = Math.floor(ey - size); by <= Math.floor(ey); by++)
      for (let bz = Math.floor(ez - size); bz <= Math.floor(ez + size); bz++) {
        const b = world.get(bx, by - 1, bz);
        if (!b) continue;
        const level = world.light(bx, by, bz);
        if (level <= 3 || !takesShadow(b)) continue;
        let alpha = (opacity - (ey - by) / 2) * 0.5 * BRIGHTNESS[level];
        if (alpha < 0) continue;
        if (alpha > 1) alpha = 1;
        const x0 = bx, x1 = bx + 1, z0 = bz, z1 = bz + 1, uv = (a, b) => f((a - b) / 2 / size + 0.5);
        quads.push({ x0, x1, z0, z1, y: by + 0.015625, u0: uv(ex, x0), u1: uv(ex, x1), v0: uv(ez, z0), v1: uv(ez, z1), alpha: f(alpha) });
      }
  return quads;
}

// One batched mesh, rebuilt each frame: blended, no depth writes, drawn
// before water (entities render in pass 0 in 1.7.10) and fogged like entities.
export class ShadowRenderer {
  constructor(scene, lighting) {
    const map = new THREE.TextureLoader().load("/media/1.7.10/misc/shadow.png");
    map.magFilter = map.minFilter = THREE.NearestFilter;
    map.wrapS = map.wrapT = THREE.ClampToEdgeWrapping;
    map.generateMipmaps = false;
    map.flipY = false;
    this.geometry = new THREE.BufferGeometry();
    this.capacity = 0;
    this.material = new THREE.ShaderMaterial({
      uniforms: { ...lighting.uniforms, map: { value: map } },
      vertexShader: `attribute float alpha;varying vec2 vUv;varying float vAlpha;varying float vFogDistance;
void main(){vUv=uv;vAlpha=alpha;vec4 mv=modelViewMatrix*vec4(position,1.);vFogDistance=length(mv.xyz);gl_Position=projectionMatrix*mv;}`,
      fragmentShader: `uniform sampler2D map;varying vec2 vUv;varying float vAlpha;${FOG_PARS}
void main(){vec4 t=texture2D(map,vUv);gl_FragColor=vec4(applyFog(t.rgb),t.a*vAlpha);}`,
      transparent: true,
      depthWrite: false,
    });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1;
    scene.add(this.mesh);
  }
  grow(n) {
    this.capacity = Math.max(64, n * 2);
    const v = this.capacity * 6;
    this.geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(v * 3), 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(v * 2), 2).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute("alpha", new THREE.BufferAttribute(new Float32Array(v), 1).setUsage(THREE.DynamicDrawUsage));
  }
  update(casters, viewer, world) {
    const quads = world ? casters.flatMap((e) => shadowQuads(e, viewer, world)) : [];
    this.count = quads.length;
    this.mesh.visible = quads.length > 0;
    if (!quads.length) return;
    if (quads.length > this.capacity) this.grow(quads.length);
    const pos = this.geometry.attributes.position.array, uv = this.geometry.attributes.uv.array, alpha = this.geometry.attributes.alpha.array;
    let i = 0;
    for (const q of quads) {
      // The four Tessellator vertices, as two triangles.
      const corners = [[q.x0, q.z0, q.u0, q.v0], [q.x0, q.z1, q.u0, q.v1], [q.x1, q.z1, q.u1, q.v1], [q.x1, q.z0, q.u1, q.v0]];
      for (const k of [0, 1, 2, 0, 2, 3]) {
        const [x, z, u, v] = corners[k];
        pos.set([x, q.y, z], i * 3);
        uv.set([u, v], i * 2);
        alpha[i++] = q.alpha;
      }
    }
    this.geometry.setDrawRange(0, i);
    for (const name of ["position", "uv", "alpha"]) this.geometry.attributes[name].needsUpdate = true;
  }
}
