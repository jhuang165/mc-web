import * as THREE from "three";
import { WorldEffects } from "./effects.js";
import { ExplosionParticles } from "./explosion-particles.js";
import { ExplosionParticleRenderer } from "./explosion-particle-renderer.js";
import { ParticleSystem } from "./particles.js";
import { EffectRenderer } from "./effect-renderer.js";
import { Fx } from "./fx.js";
import { ParticleRenderer } from "./particle-renderer.js";
import { SIZE, HEIGHT, SEA, FIRE, SNOW_LAYER, ICE, WEB, LADDER, CACTUS, REEDS, blockHeight, snowSelectionHeight, isPlant, isCrop, isFlower, opaqueCube } from "./world.js";
import { createBlockAtlas, blockTile, tileRect, ATLAS_ROWS, ATLAS_COLUMNS } from "./block-textures.js";
import { createLighting, worldMaterial } from "./light-material.js";
import { LightVolume, lightOpacity, lightEmission, mhSin, mhCos, smoothFace, celestialAngle, sunBrightness, skylightSubtracted, starBrightness, skyColor, biomeTemperature, sunriseColors, cloudColor, fogColor, TorchFlicker, BRIGHTNESS } from "./lighting.js";
import { Sky, Clouds } from "./sky.js";
import { liquidHeight, flowAngle, viewpointBlock } from "./fluids.js";
import { DropRenderer } from "./drop-renderer.js";
import { ProjectileRenderer } from "./projectile-renderer.js";
import { ArrowRenderer } from "./arrow-renderer.js";
import { ShadowRenderer } from "./shadows.js";
import { WeatherRenderer } from "./weather-renderer.js";
import { fireVertices } from "./fire.js";
export { blockTile } from "./block-textures.js";

// Face order +x, -x, +y, -y, +z, -z with RenderBlocks' AO-path shades:
// 0.6 east/west, 0.8 north/south, 0.5 bottom, 1.0 top.
const FACES = [
  { n: [1, 0, 0], v: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], shade: 0.6 },
  { n: [-1, 0, 0], v: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], shade: 0.6 },
  { n: [0, 1, 0], v: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], shade: 1 },
  { n: [0, -1, 0], v: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], shade: 0.5 },
  { n: [0, 0, 1], v: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], shade: 0.8 },
  { n: [0, 0, -1], v: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], shade: 0.8 },
];
// Fancy graphics: leaves are not opaque at render time, so faces next to them draw.
const hides = (b) => opaqueCube(b) && b !== 5;
// Vanilla's world is 256 tall with clouds at 128 (65 above sea level 63);
// this compressed world keeps the 65-block gap above its own sea level.
const CLOUD_HEIGHT = SEA + 65;

class Mesher {
  constructor() {
    this.p = [];
    this.uv = [];
    this.shade = [];
    this.light = [];
    this.idx = [];
  }
  // Four vertices with per-vertex (or shared) shade and packed brightness.
  quad(verts, uvs, shade, packed, twoSided = false) {
    const v = this.p.length / 3;
    for (let i = 0; i < 4; i++) {
      this.p.push(...verts[i]);
      this.uv.push(...uvs[i]);
      const s = Array.isArray(shade) ? shade[i] : shade, l = Array.isArray(packed) ? packed[i] : packed;
      this.shade.push(s, s, s);
      this.light.push(l & 0xffff, (l >> 16) & 0xffff);
    }
    this.idx.push(v, v + 1, v + 2, v, v + 2, v + 3);
    if (twoSided) this.idx.push(v, v + 2, v + 1, v, v + 3, v + 2);
  }
  geometry() {
    if (!this.idx.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute("shade", new THREE.Float32BufferAttribute(this.shade, 3));
    g.setAttribute("lightCoord", new THREE.Float32BufferAttribute(this.light, 2));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return g;
  }
}
const rectUvs = (r) => [[r.u0, r.v0], [r.u1, r.v0], [r.u1, r.v1], [r.u0, r.v1]];
// BlockLiquid.getMixedBrightnessForBlock: the brighter of the cell and the one above.
const maxPacked = (a, b) => Math.max(a & 0xffff, b & 0xffff) | (Math.max(a >>> 16, b >>> 16) << 16);

export class VoxelScene {
  constructor(container) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    this.renderer.setSize(innerWidth, innerHeight);
    // Colours stay in the game's own space end to end, as fixed-function GL did.
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer.autoClear = false;
    container.appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.lighting = createLighting();
    this.flicker = new TorchFlicker();
    this.effects = new WorldEffects(this.scene, this.lighting);
    this.camera = new THREE.PerspectiveCamera(65, innerWidth / innerHeight, 0.05, 400);
    this.camera.rotation.order = "YXZ";
    this.sky = new Sky();
    this.clouds = new Clouds(this.lighting, CLOUD_HEIGHT);
    this.scene.add(this.clouds.depth, this.clouds.mesh);
    this.textures = createBlockAtlas();
    this.drops = new DropRenderer(this.scene, this);
    this.projectiles = new ProjectileRenderer(this.scene, this);
    this.projectileList = { balls: [], particles: [] };
    this.arrows = new ArrowRenderer(this.scene, this);
    this.arrowList = [];
    this.shadows = new ShadowRenderer(this.scene, this.lighting);
    this.weather = null; // a Weather (weather.js), assigned by main.js
    this.weatherRenderer = new WeatherRenderer(this.scene, this.lighting, this);
    this.dropList = [];
    this.dropPartial = 1;
    // Block particles (particles.js); main.js ticks them and sets particleView
    // to the player's yaw, pitch and front-view flag each frame.
    // effectRenderer is the shared EffectRenderer pool (effect-renderer.js):
    // main.js ticks it once per client tick, every system adds to it.
    this.effectRenderer = new EffectRenderer();
    this.particles = new ParticleSystem({ effects: this.effectRenderer });
    this.explosionParticles = new ExplosionParticles({ effects: this.effectRenderer });
    // World.spawnParticle for the particles.png and item-icon kinds (fx.js).
    this.fx = new Fx({ effects: this.effectRenderer, explosions: this.explosionParticles });
    this.explosionParticleRenderer = new ExplosionParticleRenderer(this.scene, this);
    this.particleRenderer = new ParticleRenderer(this.scene, this);
    this.particleView = null;
    this.material = worldMaterial(this.lighting, { map: this.textures.texture });
    const animated = (url, frames, scale) => {
      const t = new THREE.TextureLoader().load(url);
      t.magFilter = t.minFilter = THREE.NearestFilter;
      t.generateMipmaps = false;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      const uv = new THREE.Vector4(scale, 1 / frames, 0, 0);
      // Fancy graphics draws translucent geometry twice: depth only, then colour,
      // so only the nearest water surface shows.
      const depth = worldMaterial(this.lighting, { map: t, alphaTest: 0, transparent: true, uvTransform: uv });
      depth.colorWrite = false;
      return { uv, frames, depth, color: worldMaterial(this.lighting, { map: t, alphaTest: 0, transparent: true, uvTransform: uv }) };
    };
    // BlockIce is a translucent-pass block (getRenderBlockPass 1): like water it
    // draws a depth-only pass, then blended colour, from the terrain atlas.
    this.iceDepth = worldMaterial(this.lighting, { map: this.textures.texture, alphaTest: 0, transparent: true });
    this.iceDepth.colorWrite = false;
    this.iceColor = worldMaterial(this.lighting, { map: this.textures.texture, alphaTest: 0, transparent: true });
    this.water = animated("/media/1.7.10/blocks/water_still.png", 32, 1);
    this.flow = animated("/media/1.7.10/blocks/water_flow.png", 32, 1);
    // Lava is an opaque-pass block (BlockLiquid.getRenderBlockPass is 0 for lava):
    // no depth pre-pass and no blending, and its textures carry no alpha.
    const opaque = (url, frames, alphaTest = 0) => {
      const t = new THREE.TextureLoader().load(url);
      t.magFilter = t.minFilter = THREE.NearestFilter;
      t.generateMipmaps = false;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      const uv = new THREE.Vector4(1, 1 / frames, 0, 0);
      return { uv, frames, material: worldMaterial(this.lighting, { map: t, alphaTest, uvTransform: uv }) };
    };
    this.lavaStill = opaque("/media/1.7.10/blocks/lava_still.png", 20);
    this.lavaFlow = opaque("/media/1.7.10/blocks/lava_flow.png", 16);
    // Fire: fire_layer_0 and fire_layer_1 (32 frames, one tick each), cut out by alpha.
    this.fireLayers = [opaque("/media/1.7.10/blocks/fire_layer_0.png", 32, 0.1), opaque("/media/1.7.10/blocks/fire_layer_1.png", 32, 0.1)];
    this.chunks = new Map();
    this.dirty = new Set();
    // RenderGlobal.drawSelectionBox: black lines at 40% alpha, grown by 0.002.
    this.outline = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004)),
      new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4 }),
    );
    this.scene.add(this.outline);
    this.outline.visible = false;
    this.distance = 155;
    this.fogBrightness = 1;
    this.setTime(6000);
    this.resize = () => {
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight);
    };
    window.addEventListener("resize", this.resize);
  }
  setWorld(world) {
    this.effects.clear();
    this.effectRenderer.clear();
    this.fx.world = world;
    this.explosionParticleRenderer.clear();
    this.drops.clear();
    this.dropList = [];
    this.projectiles.clear();
    this.arrows.clear();
    this.arrowList = [];
    this.projectileList = { balls: [], particles: [] };
    this.fallingList = [];
    this.world = world;
    this.textures.setBiome(world.biome);
    this.temperature = biomeTemperature(world.biome);
    this.litFurnaces = new Set();
    this.light = new LightVolume(world, (x, y, z, b) => (b === 42 || b === FIRE ? 15 : b === 20 ? 14 : b === 14 && this.litFurnaces.has(`${x},${y},${z}`) ? 13 : 0));
    for (const v of this.chunks.values()) this.disposeChunk(v);
    this.chunks.clear();
    this.dirty.clear();
    for (let x = 0; x < SIZE; x += 16) for (let z = 0; z < SIZE; z += 16) this.buildChunk(x, z);
  }
  disposeChunk(group) {
    this.scene.remove(group);
    for (const child of group.children) child.geometry.dispose();
  }
  buildChunk(cx, cz) {
    const key = `${cx},${cz}`, old = this.chunks.get(key);
    if (old) this.disposeChunk(old);
    this.dirty.delete(key);
    const w = this.world, solid = new Mesher(), water = new Mesher(), ice = new Mesher(), flow = new Mesher(), lava = new Mesher(), lavaFlow = new Mesher(), fire = [new Mesher(), new Mesher()];
    for (let x = cx; x < cx + 16; x++)
      for (let z = cz; z < cz + 16; z++)
        for (let y = 0; y < HEIGHT; y++) {
          const b = w.get(x, y, z);
          if (!b || b === 41) continue;
          if (b === 20) this.torch(solid, x, y, z);
          else if (isCrop(b)) this.crops(solid, b, x, y, z);
          else if (isPlant(b) || b === WEB || b === REEDS) this.crossed(solid, b, x, y, z);
          else if (b === LADDER) this.ladder(solid, x, y, z);
          else if (b === CACTUS) this.cactus(solid, x, y, z);
          else if (b === 10) this.liquid(10, water, flow, x, y, z);
          else if (b === 42) this.liquid(42, lava, lavaFlow, x, y, z);
          else if (b === FIRE) this.fireBlock(fire, x, y, z);
          else this.cube(b === ICE ? ice : solid, b, x, y, z);
        }
    const group = new THREE.Group(), add = (mesher, ...materials) => {
      const g = mesher.geometry();
      if (!g) return;
      materials.forEach((m, i) => {
        const mesh = new THREE.Mesh(g, m);
        mesh.renderOrder = materials.length > 1 ? i + 1 : 0;
        group.add(mesh);
      });
    };
    add(solid, this.material);
    add(water, this.water.depth, this.water.color);
    add(ice, this.iceDepth, this.iceColor);
    add(flow, this.flow.depth, this.flow.color);
    add(lava, this.lavaStill.material);
    add(lavaFlow, this.lavaFlow.material);
    add(fire[0], this.fireLayers[0].material);
    add(fire[1], this.fireLayers[1].material);
    this.chunks.set(key, group);
    this.scene.add(group);
  }
  // renderBlockFire (blm.a(alb, ...)): the vertex stream of fire.js, one layer per quad, at
  // the cell's own brightness (block light 15) with no side shading. v is flipped for the
  // bottom-up texture coordinates.
  fireBlock(meshers, x, y, z) {
    const get = (a, b, c) => this.world.get(a, b, c), light = this.light.packed(x, y, z), v = fireVertices(get, x, y, z);
    for (let i = 0; i < v.length; i += 4) {
      const q = v.slice(i, i + 4);
      meshers[q[0][5]].quad(q.map((p) => [p[0], p[1], p[2]]), q.map((p) => [p[3], 1 - p[4]]), 1, light);
    }
  }
  // renderStandardBlockWithAmbientOcclusion; blocks that emit light (a lit
  // furnace) take the flat colour-multiplier path with neighbour brightness.
  cube(m, b, x, y, z) {
    const w = this.world, L = this.light, h = b === SNOW_LAYER ? snowSelectionHeight(w.getMeta(x, y, z)) : blockHeight(b), lit = b === 14 && this.litFurnaces.has(`${x},${y},${z}`);
    FACES.forEach((f, fi) => {
      const boundary = fi !== 2 || h >= 1, nb = w.get(x + f.n[0], y + f.n[1], z + f.n[2]);
      // BlockSnow.shouldSideBeRendered always draws the top.
      if (boundary && hides(nb) && !(b === SNOW_LAYER && fi === 2)) return;
      if ((b === 9 || b === ICE) && nb === b) return;
      const corners = f.v.map((v) => [v[0], v[1] * h, v[2]]), r = tileRect(blockTile(b, fi, lit, b === 19 ? w.getMeta(x, y, z) : 0, b === 1 && (w.get(x, y + 1, z) === SNOW_LAYER || w.get(x, y + 1, z) === 23))), uvs = rectUvs(r);
      // Side faces of short blocks crop the texture from the top, as renderMaxY does.
      if (fi !== 2 && fi !== 3 && h < 1) uvs[2][1] = uvs[3][1] = r.v0 + (r.v1 - r.v0) * h;
      const verts = corners.map((v) => [x + v[0], y + v[1], z + v[2]]);
      if (lit) m.quad(verts, uvs, f.shade, L.packed(x + f.n[0], y + f.n[1], z + f.n[2]));
      else {
        const s = smoothFace(L, x, y, z, fi, corners, boundary);
        m.quad(verts, uvs, s.ao.map((a) => a * f.shade), s.packed);
      }
    });
  }
  // renderTorchAtAngle for a standing torch: four side planes 1/16 from the
  // centre spanning the block, and a 2x2-pixel top at 10/16.
  torch(m, x, y, z) {
    const r = tileRect(blockTile(20, 0)), uvs = rectUvs(r), light = this.light.packed(x, y, z), d = 1 / 16,
      t = blockTile(20, 0), tx = (t % ATLAS_COLUMNS) * 16, ty = Math.floor(t / ATLAS_COLUMNS) * 16, W = ATLAS_COLUMNS * 16, H = ATLAS_ROWS * 16;
    m.quad([[x + 0.5 - d, y, z], [x + 0.5 - d, y, z + 1], [x + 0.5 - d, y + 1, z + 1], [x + 0.5 - d, y + 1, z]], uvs, 1, light);
    m.quad([[x + 0.5 + d, y, z + 1], [x + 0.5 + d, y, z], [x + 0.5 + d, y + 1, z], [x + 0.5 + d, y + 1, z + 1]], uvs, 1, light);
    m.quad([[x, y, z + 0.5 + d], [x + 1, y, z + 0.5 + d], [x + 1, y + 1, z + 0.5 + d], [x, y + 1, z + 0.5 + d]], uvs, 1, light);
    m.quad([[x + 1, y, z + 0.5 - d], [x, y, z + 0.5 - d], [x, y + 1, z + 0.5 - d], [x + 1, y + 1, z + 0.5 - d]], uvs, 1, light);
    const u0 = (tx + 7) / W, u1 = (tx + 9) / W, v0 = 1 - (ty + 8) / H, v1 = 1 - (ty + 6) / H, top = y + 0.625;
    m.quad([[x + 0.5 - d, top, z + 0.5 + d], [x + 0.5 + d, top, z + 0.5 + d], [x + 0.5 + d, top, z + 0.5 - d], [x + 0.5 - d, top, z + 0.5 - d]], [[u0, v0], [u1, v0], [u1, v1], [u0, v1]], 1, light);
  }
  // renderCrossedSquares, with the tall-grass position jitter from the block coordinates.
  crossed(m, b, x, y, z) {
    const w = this.world;
    let px = x, py = y, pz = z;
    if (b === 39 || isFlower(b)) {
      let i = BigInt.asIntN(64, BigInt(Math.imul(x, 3129871)) ^ (BigInt(z) * 116129781n) ^ BigInt(y));
      i = BigInt.asIntN(64, i * i * 42317861n + i * 11n);
      const bits = (s) => Number((i >> BigInt(s)) & 15n) / 15;
      // blm.l: tall grass moves 0.5 sideways and sinks; flowers (yellow and
      // red) use the same hash for a 0.3 sideways jitter and do not sink.
      const spread = b === 39 ? 0.5 : 0.3;
      px += (bits(16) - 0.5) * spread;
      if (b === 39) py += (bits(20) - 1) * 0.2;
      pz += (bits(24) - 0.5) * spread;
    }
    const uvs = rectUvs(tileRect(blockTile(b, 0, false, w.getMeta(x, y, z)))), light = this.light.packed(x, y, z), a = 0.05, c = 0.95;
    m.quad([[px + a, py, pz + a], [px + c, py, pz + c], [px + c, py + 1, pz + c], [px + a, py + 1, pz + a]], uvs, 1, light, true);
    m.quad([[px + a, py, pz + c], [px + c, py, pz + a], [px + c, py + 1, pz + a], [px + a, py + 1, pz + c]], uvs, 1, light, true);
  }
  // RenderBlocks.renderBlockCactusImpl (render type 13): no ambient occlusion. The bottom and top
  // follow shouldSideBeRendered (not under an opaque cube) in the brightness of the cell beyond;
  // the four sides are full faces moved 1/16 inwards (Tessellator.addTranslation), always drawn,
  // in the cactus cell's own brightness. Shades 0.5, 1, 0.8 (z) and 0.6 (x).
  cactus(m, x, y, z) {
    const w = this.world, L = this.light, t = 1 / 16, own = L.packed(x, y, z);
    FACES.forEach((f, fi) => {
      const vertical = fi === 2 || fi === 3;
      if (vertical && hides(w.get(x, y + f.n[1], z))) return;
      const verts = f.v.map((v) => [x + v[0] - f.n[0] * t, y + v[1], z + v[2] - f.n[2] * t]);
      m.quad(verts, rectUvs(tileRect(blockTile(CACTUS, fi))), f.shade, vertical ? L.packed(x, y + f.n[1], z) : own);
    });
  }
  // RenderFallingBlock -> RenderBlocks.renderBlockSandFalling: a unit cube centred on posY
  // (the box's minY + 0.49), interpolated between ticks, every face in the brightness of the
  // entity's cell with the usual face shades. Rebuilt each frame; there are rarely many.
  updateFalling(partial) {
    if (this.fallingMesh) {
      this.scene.remove(this.fallingMesh);
      this.fallingMesh.geometry.dispose();
      this.fallingMesh = null;
    }
    const list = this.fallingList || [];
    if (!list.length || !this.light) return;
    const m = new Mesher();
    for (const e of list) {
      const x = e.px + (e.x - e.px) * partial, z = e.pz + (e.z - e.pz) * partial, y = e.py + (e.y - e.py) * partial + 0.49 - 0.5;
      const light = this.light.packed(Math.floor(e.x), Math.floor(e.y + 0.49), Math.floor(e.z));
      FACES.forEach((f, fi) => m.quad(f.v.map((v) => [x - 0.5 + v[0], y + v[1], z - 0.5 + v[2]]), rectUvs(tileRect(blockTile(e.block, fi, false, e.meta))), f.shade, light));
    }
    this.fallingMesh = new THREE.Mesh(m.geometry(), this.material);
    this.scene.add(this.fallingMesh);
  }
  setFalling(list) {
    this.fallingList = list;
  }
  // RenderBlocks.renderBlockLadder (render type 8): one quad 0.05 off the wall the metadata
  // names, facing away from it, in the cell's own brightness with no face shading.
  ladder(m, x, y, z) {
    const uvs = rectUvs(tileRect(blockTile(LADDER, 0))), light = this.light.packed(x, y, z), a = 0.05, c = 0.95;
    const quads = {
      5: [[x + a, y, z + 1], [x + a, y, z], [x + a, y + 1, z], [x + a, y + 1, z + 1]],
      4: [[x + c, y, z], [x + c, y, z + 1], [x + c, y + 1, z + 1], [x + c, y + 1, z]],
      3: [[x, y, z + a], [x + 1, y, z + a], [x + 1, y + 1, z + a], [x, y + 1, z + a]],
      2: [[x + 1, y, z + c], [x, y, z + c], [x, y + 1, z + c], [x + 1, y + 1, z + c]],
    };
    const verts = quads[this.world.getMeta(x, y, z)];
    if (verts) m.quad(verts, uvs, 1, light);
  }
  // renderBlockCropsImpl: a # of four planes at 1/4 and 3/4, sunk 1/16.
  crops(m, b, x, y, z) {
    const uvs = rectUvs(tileRect(blockTile(b, 0, false, this.world.getMeta(x, y, z)))), light = this.light.packed(x, y, z), y0 = y - 1 / 16, y1 = y0 + 1;
    for (const o of [0.25, 0.75]) {
      m.quad([[x + o, y0, z], [x + o, y0, z + 1], [x + o, y1, z + 1], [x + o, y1, z]], uvs, 1, light, true);
      m.quad([[x, y0, z + o], [x + 1, y0, z + o], [x + 1, y1, z + o], [x, y1, z + o]], uvs, 1, light, true);
    }
  }
  // renderBlockLiquid (blm.d(Lawt;III)): the top uses the still frames, or the
  // flowing ones turned to the flow direction (func_149802_a) when the water
  // moves; both are drawn from either side. The four corner heights drop by
  // 0.001 when the top is drawn and the sides follow them. Sides use the
  // flowing texture's top-left quarter, a 0.001 inset and liquid brightness.
  liquid(kind, still, flow, x, y, z) {
    const w = this.world, L = this.light, e = 0.001, inset = 0.0010000000474974513,
      bright = (bx, by, bz) => maxPacked(L.packed(bx, by, bz), L.packed(bx, by + 1, bz)),
      top = w.get(x, y + 1, z) !== kind,
      h = [[liquidHeight(w, x, y, z, kind), liquidHeight(w, x, y, z + 1, kind)], [liquidHeight(w, x + 1, y, z, kind), liquidHeight(w, x + 1, y, z + 1, kind)]];
    if (top) {
      for (const row of h) for (let i = 0; i < 2; i++) row[i] -= inset;
      const verts = [[x, y + h[0][0], z], [x, y + h[0][1], z + 1], [x + 1, y + h[1][1], z + 1], [x + 1, y + h[1][0], z]], angle = flowAngle(w, x, y, z, kind);
      if (angle > -999) {
        const a = Math.fround(angle), s = Math.fround(mhSin(a) * 0.25), c = Math.fround(mhCos(a) * 0.25),
          at = (du, dv) => [(8 + du * 16) / 16, 1 - (8 + dv * 16) / 16];
        flow.quad(verts, [at(-c - s, -c + s), at(-c + s, c + s), at(c + s, c - s), at(c - s, -c - s)], 1, bright(x, y, z), true);
      } else still.quad(verts, [[0, 1], [0, 0], [1, 0], [1, 1]], 1, bright(x, y, z), true);
    }
    const below = w.get(x, y - 1, z);
    if (below !== kind && !opaqueCube(below))
      still.quad([[x, y + e, z], [x + 1, y + e, z], [x + 1, y + e, z + 1], [x, y + e, z + 1]], [[0, 1], [1, 1], [1, 0], [0, 0]], 0.5, bright(x, y - 1, z));
    for (const fi of [0, 1, 4, 5]) {
      const f = FACES[fi], nx = x + f.n[0], nz = z + f.n[2], nb = w.get(nx, y, nz);
      if (nb === kind || hides(nb)) continue;
      const verts = f.v.map((v) => [x + v[0] - f.n[0] * e, y + (v[1] ? h[v[0]][v[2]] : 0), z + v[2] - f.n[2] * e]),
        uvs = f.v.map((v, i) => [i === 1 || i === 2 ? 0.5 : 0, v[1] ? 1 - (1 - h[v[0]][v[2]]) * 0.5 : 0.5]);
      flow.quad(verts, uvs, f.shade, bright(nx, y, nz));
    }
  }
  setFurnaces(data) {
    const next = new Set(Object.entries(data).filter(([, f]) => f.burn > 0).map(([key]) => key)),
      changed = [...new Set([...next, ...(this.litFurnaces || [])])].filter((k) => next.has(k) !== this.litFurnaces?.has(k));
    this.litFurnaces = next;
    for (const k of changed) {
      const [x, y, z] = k.split(",").map(Number);
      this.updateBlock(x, z, y);
    }
  }
  // Relights around an edit; the edited chunk and its touching neighbours
  // rebuild now, the rest of the changed light box over the next frames.
  updateBlock(x, z, y = 0) {
    const box = this.light?.update(x, y, z), chunk = (v) => Math.floor(v / 16) * 16;
    const now = new Set([[chunk(x), chunk(z)], [chunk(x - 1), chunk(z)], [chunk(x + 1), chunk(z)], [chunk(x), chunk(z - 1)], [chunk(x), chunk(z + 1)]].filter(([a, b]) => a >= 0 && b >= 0 && a < SIZE && b < SIZE).map((c) => c.join(",")));
    if (box)
      for (let a = chunk(Math.max(0, box.x0 - 1)); a <= chunk(Math.min(SIZE - 1, box.x1 + 1)); a += 16)
        for (let b = chunk(Math.max(0, box.z0 - 1)); b <= chunk(Math.min(SIZE - 1, box.z1 + 1)); b += 16) if (!now.has(`${a},${b}`)) this.dirty.add(`${a},${b}`);
    for (const k of now) this.buildChunk(...k.split(",").map(Number));
  }
  // Applies a tick's fluid edits ([x, y, z, oldBlock, newBlock] from
  // Fluids.tick) in one pass. Cells around each edit are queued for a rebuild,
  // the ones touching an edit first; only edits that change light opacity or
  // emission relight, one LightVolume.relight per merged 31 x 31 box. The
  // render loop then rebuilds the queue at its usual two chunks per frame.
  updateBlocks(changes) {
    if (!changes.length || !this.light) return;
    const chunk = (v) => Math.floor(v / 16) * 16, first = new Set(), later = new Set(), boxes = [],
      mark = (set, x0, x1, z0, z1) => {
        for (let a = chunk(Math.max(0, x0)); a <= chunk(Math.min(SIZE - 1, x1)); a += 16)
          for (let b = chunk(Math.max(0, z0)); b <= chunk(Math.min(SIZE - 1, z1)); b += 16) set.add(`${a},${b}`);
      };
    for (const [x, , z, old, now] of changes) {
      mark(first, x - 1, x + 1, z - 1, z + 1);
      if (lightOpacity(old) === lightOpacity(now) && lightEmission(old) === lightEmission(now)) continue;
      this.light.column(x, z);
      boxes.push([Math.max(0, x - 15), Math.min(SIZE - 1, x + 15), Math.max(0, z - 15), Math.min(SIZE - 1, z + 15)]);
    }
    // Overlapping boxes merge, so a spreading front relights once per tick.
    for (let i = 0; i < boxes.length; i++)
      for (let j = boxes.length - 1; j > i; j--) {
        const a = boxes[i], b = boxes[j];
        if (a[0] > b[1] || b[0] > a[1] || a[2] > b[3] || b[2] > a[3]) continue;
        boxes[i] = [Math.min(a[0], b[0]), Math.max(a[1], b[1]), Math.min(a[2], b[2]), Math.max(a[3], b[3])];
        boxes.splice(j, 1);
        j = boxes.length;
      }
    for (const [x0, x1, z0, z1] of boxes) {
      const box = this.light.relight(x0, x1, z0, z1);
      if (box) mark(later, box.x0 - 1, box.x1 + 1, box.z0 - 1, box.z1 + 1);
    }
    this.dirty = new Set([...first, ...this.dirty, ...later]);
  }
  preview(time) {
    this.setTime(6000);
    this.camera.position.set(91 + Math.sin(time * 0.025) * 4, 48, 108 + Math.cos(time * 0.025) * 4);
    this.camera.lookAt(49, 20, 44);
    this.outline.visible = false;
  }
  // Once per tick: torch flicker, the lightmap, and the fog-brightness easing
  // from the light level at the camera (EntityRenderer.updateRenderer).
  setTime(ticks) {
    this.ticks = ticks;
    this.angle = celestialAngle(ticks);
    const w = this.weather, rain = w ? w.rainStrength(1) : 0, thunder = w ? w.weightedThunder(1) : 0;
    this.subtracted = skylightSubtracted(this.angle, rain, thunder);
    this.sun = sunBrightness(this.angle, rain, thunder);
    this.flash = !!w && w.lastLightning > 0;
    // Farming and mobs read the sky light that remains at this time of day.
    this.daylight = (15 - this.subtracted) / 15;
    this.lighting.update(this.sun, this.flicker.tick(), this.gamma ?? 0, this.flash);
    const p = this.camera.position, chunks = this.distance / 16,
      level = this.light ? this.light.level(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z), this.subtracted) : 15,
      target = BRIGHTNESS[level] * (1 - chunks / 16) + chunks / 16;
    this.fogBrightness += (target - this.fogBrightness) * 0.1;
  }
  setGamma(gamma) {
    this.gamma = gamma;
    this.lighting.update(this.sun ?? sunBrightness(this.angle), this.flicker.x, gamma, this.flash);
  }
  // Brightness for an entity or tile entity at a world position.
  brightness(x, y, z) {
    return this.light ? this.light.packed(Math.floor(x), Math.floor(y), Math.floor(z)) : 15 << 20;
  }
  render(time, dt = 1 / 60) {
    this.water.uv.w = 1 - ((Math.floor(time * 10) % 32) + 1) / 32;
    this.flow.uv.w = 1 - ((Math.floor(time * 20) % 32) + 1) / 32;
    // lava_still: frametime 2 over frames 0..19 and back down to 1 (38 steps);
    // lava_flow: frametime 3 over 16 frames.
    const step = Math.floor(time * 10) % 38;
    this.lavaStill.uv.w = 1 - ((step < 20 ? step : 38 - step) + 1) / 20;
    this.lavaFlow.uv.w = 1 - ((Math.floor((time * 20) / 3) % 16) + 1) / 16;
    // fire_layer_0 plays frames 16..31 then 0..15 (its mcmeta), layer_1 plays in order; one tick each.
    const fireStep = Math.floor(time * 20) % 32;
    this.fireLayers[0].uv.w = 1 - (((fireStep + 16) % 32) + 1) / 32;
    this.fireLayers[1].uv.w = 1 - (fireStep + 1) / 32;
    for (let budget = 2; budget > 0 && this.dirty.size; budget--) this.buildChunk(...this.dirty.values().next().value.split(",").map(Number));
    const c = this.camera, look = c.getWorldDirection(new THREE.Vector3()), u = this.lighting.uniforms, angle = this.angle,
      eye = this.world?.get(Math.floor(c.position.x), Math.floor(c.position.y), Math.floor(c.position.z)),
      underwater = eye === 10 && c.position.y - Math.floor(c.position.y) < 8 / 9,
      // ActiveRenderInfo.getBlockAtEntityViewpoint: lava fog while the eye is in lava.
      lava = !!this.world && viewpointBlock(this.world, c.position.x, c.position.y, c.position.z) === 42,
      // The frame-eased rain, thunder and lightning terms (World.getRainStrength(partial) ...).
      w = this.weather, partial = this.dropPartial, rain = w ? w.rainStrength(partial) : 0, thunder = w ? w.weightedThunder(partial) : 0, lightning = w ? w.lastLightning : 0,
      fog = fogColor({ angle, temperature: this.temperature ?? biomeTemperature("meadow"), look: [look.x, look.y, look.z], chunks: this.distance / 16, brightness: this.fogBrightness, underwater, lava, rain, thunder, lightning, partial });
    u.fogColor.value.set(...fog);
    // setupFog: linear from 3/4 of the far plane; exponential 0.1 in water, 2.0 in lava.
    u.fogDensity.value = lava ? 2 : underwater ? 0.1 : 0;
    u.fogNear.value = this.distance * 0.75;
    u.fogFar.value = this.distance;
    const sky = underwater || lava ? fog : skyColor(this.temperature ?? 0.8, angle, rain, thunder, lightning, partial);
    this.sky.update({ angle, sky, fog, sunrise: underwater || lava ? null : sunriseColors(angle), stars: starBrightness(angle), moonPhase: Math.floor(this.ticks / 24000) % 8, aboveHorizon: c.position.y - SEA, far: this.distance, underwater: underwater || lava, rain });
    this.clouds.update(c, time * 20, cloudColor(angle, rain, thunder));
    this.weatherRenderer.update(w, this.world, c, partial, time);
    this.drops.update(this.dropList, this.dropPartial, time * 20);
    this.updateFalling(this.dropPartial);
    const particleView = this.particleView ?? { yaw: c.rotation.y, pitch: c.rotation.x };
    this.projectiles.update(this.projectileList.balls, this.effectRenderer.layers[2], c, this.dropPartial, particleView);
    this.arrows.update(this.arrowList, this.dropPartial);
    this.particleRenderer.update(this.particles.list, this.dropPartial, particleView);
    this.explosionParticleRenderer.update(this.effectRenderer, this.dropPartial, particleView);
    this.sky.render(this.renderer, c, new THREE.Color(...fog));
    this.renderer.render(this.scene, c);
    this.worldTriangles = this.renderer.info.render.triangles;
  }
  // Entity shadows for this frame; `viewer` is the player's eye position.
  setShadows(casters, viewer) {
    const w = this.world, light = this.light;
    this.shadows.update(casters, viewer, w && light && { get: (x, y, z) => w.get(x, y, z), light: (x, y, z) => light.level(x, y, z, this.subtracted) });
  }
  // `partial` is how far the frame is into the next physics tick.
  setDrops(drops, partial = this.dropPartial) {
    this.dropList = drops;
    this.dropPartial = partial;
  }
  // Thrown snowballs and their particles (see projectiles.js).
  setProjectiles(balls, particles) {
    this.projectileList = { balls, particles };
  }
  // Flying and stuck arrows (see bow.js).
  setArrows(list) {
    this.arrowList = list;
  }
  setDistance(distance) {
    this.distance = distance;
  }
}
