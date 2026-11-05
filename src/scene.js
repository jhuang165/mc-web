import { BEACON } from "./pyramid.js";
import { END_PORTAL } from "./eye-of-ender.js"; // drawn by end-portal-renderer.js
import { DRAGON_EGG, eggBoxes } from "./dragon-egg.js";
import { isChestShaped } from "./chest-blocks.js"; // chest, trapped chest and ender chest are drawn by chest-renderer.js
import { PUMPKIN_STEM, MELON_STEM, CAKE, cakeBounds, stemDirection, stemTint, stemQuads } from './stems-cake.js';
import { PORTAL, portalSideRendered } from "./nether-portal.js";
import { NETHER_WART } from "./nether-wart.js";
import * as THREE from "three";
import { WorldEffects } from "./effects.js";
import { ExplosionParticles } from "./explosion-particles.js";
import { ExplosionParticleRenderer } from "./explosion-particle-renderer.js";
import { ParticleSystem } from "./particles.js";
import { EffectRenderer } from "./effect-renderer.js";
import { Fx } from "./fx.js";
import { ParticleRenderer } from "./particle-renderer.js";
import { woodSlabBounds, gateRenderBoxes, trapBounds, wallMask, wallRenderBoxes } from './shaped-blocks.js';
import { HEIGHT, SEA, FIRE, SNOW_LAYER, ICE, WEB, LADDER, CACTUS, REEDS, FENCE, RAIL, VINE, COCOA, DOUBLE_PLANT, SANDSTONE_SLAB, LIT_REDSTONE_ORE, ANVIL, BED, PISTON_MOVING, wallSolid, blockBounds, blockHeight, snowSelectionHeight, isPlant, isCrop, isFlower, opaqueCube, STAINED_GLASS, CARPET } from "./world.js";
import { StreamingLight } from './streaming-light.js';
import { STONE_SLAB, END_PORTAL_FRAME, CAULDRON, FLOWER_POT, endFrameBoxes, cauldronBoxes, cauldronWaterHeight, CAULDRON_FLOOR, CAULDRON_WALL, potContents, POT_BOUNDS, potPlantOf } from './stone-utility.js';
import { REDSTONE_WIRE, STONE_PRESSURE_PLATE, WOODEN_PRESSURE_PLATE, STONE_BUTTON, LEVER, REPEATER, TRIPWIRE_HOOK, TRIPWIRE, isRedstoneBlock, redstoneBounds, wireArms, wireClimbs, wireTint } from './redstone-blocks.js';
import { REDSTONE_TORCH, REDSTONE_TORCH_OFF, COMPARATOR, COMPARATOR_POWERED, DAYLIGHT_SENSOR, isRedstone2Block, isCube2, redstoneBounds2 } from './redstone-blocks-2.js';
import { tileByName } from './block-textures.js';
import { createBlockAtlas, blockTile, tileRect, ATLAS_ROWS, ATLAS_COLUMNS, namedTile } from "./block-textures.js";
import { pistonQuads, isPistonBase, PISTON_HEAD } from "./dispenser-piston.js";
import { createLighting, worldMaterial } from "./light-material.js";
import { LightVolume, lightOpacity, lightEmission, mhSin, mhCos, smoothFace, celestialAngle, sunBrightness, skylightSubtracted, starBrightness, skyColor, biomeTemperature, sunriseColors, cloudColor, fogColor, TorchFlicker, BRIGHTNESS } from "./lighting.js";
import { nightVisionBrightness, blindnessFog, adjustFogColor, warpMatrix } from "./potion-fx.js";
import { Sky, Clouds } from "./sky.js";
import { liquidHeight, flowAngle, viewpointBlock } from "./fluids.js";
import { DropRenderer } from "./drop-renderer.js";
import { ProjectileRenderer } from "./projectile-renderer.js";
import { FishingRenderer } from "./fishing-renderer.js";
import { ArrowRenderer } from "./arrow-renderer.js";
import { ShadowRenderer } from "./shadows.js";
import { WeatherRenderer } from "./weather-renderer.js";
import { fireVertices } from "./fire.js";
import { fenceMask, fenceRenderBoxes } from "./fences.js";
import { NETHER_FENCE, QUARTZ_BLOCK } from "./nether-blocks.js";
import { anvilModelBoxes } from './anvil-block.js';
import { isStair, stairBoxes } from './stairs.js';
import { BED_DIR, bedTexture } from './bed.js';
import { isDoor, isPane, doorFlags, doorBoundsFor, doorFaceFlip, paneMask, paneArms, paneSideRendered } from './doors-panes.js';
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
    this.fishingRenderer = new FishingRenderer(this.scene, this);
    this.fishingState = null;
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
    this.portal = animated("/media/1.7.10/blocks/portal.png", 32, 1); // portal.png.mcmeta: one tick per frame
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
    this.distance = 192;
    this.fogBrightness = 1;
    this.warpM4 = new THREE.Matrix4();
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
    this.fishingRenderer.clear();
    this.arrows.clear();
    this.arrowList = [];
    this.projectileList = { balls: [], particles: [] };
    this.fallingList = [];
    this.world = world;
    this.textures.setBiome(world.biome);
    this.temperature = world.temperatureAt?.(64, world.seaLevel, 64) ?? biomeTemperature(world.biome);
    this.clouds.height = world.height === 256 ? 128 : CLOUD_HEIGHT;
    this.litFurnaces = new Set();
    this.resetLight();
    for (const v of this.chunks.values()) this.disposeChunk(v);
    this.chunks.clear();
    this.dirty.clear();
    for (const c of world.chunks.values()) this.buildChunk(c.x*16, c.z*16);
  }
  resetLight() {
    const Light = this.world.streaming ? StreamingLight : LightVolume;
    this.light = new Light(this.world, (x,y,z,b) => lightEmission(b,b===14 && this.litFurnaces.has(`${x},${y},${z}`)));
  }
  // After World.streamAround({ added, removed }): the light volume follows the square
  // (StreamingLight.shift), and only new columns, columns beside an added or removed one (their
  // faces and corner shading saw the old neighbour) and columns whose light changed are remeshed,
  // nearest first. Without a change list, or after a full relight, every column is.
  syncChunks(change = null) {
    const x = this.world.minX+64, z = this.world.minZ+64, resident = (k) => this.world.chunks.has(k.replace(/-?\d+/g, (v) => v / 16));
    for (const [key, group] of this.chunks) if (!resident(key)) {
      this.disposeChunk(group); this.chunks.delete(key);
    }
    let boxes = null;
    if (change && this.light?.shift) boxes = this.light.shift(); else this.resetLight();
    const wanted = new Set([...this.dirty].filter(resident));
    if (!boxes) for (const c of this.world.chunks.values()) wanted.add(`${c.x*16},${c.z*16}`);
    else {
      const mark = (x0, x1, z0, z1) => {
        for (let a = Math.floor(x0 / 16); a <= Math.floor(x1 / 16); a++)
          for (let b = Math.floor(z0 / 16); b <= Math.floor(z1 / 16); b++) if (this.world.chunkAt(a, b)) wanted.add(`${a*16},${b*16}`);
      };
      for (const c of [...change.added, ...change.removed]) mark(c.x*16 - 16, c.x*16 + 16, c.z*16 - 16, c.z*16 + 16);
      for (const b of boxes) mark(b.x0 - 1, b.x1 + 1, b.z0 - 1, b.z1 + 1);
    }
    this.dirty = new Set([...wanted].map((k) => k.split(',').map(Number))
      .sort((a,b)=>(a[0]-x)**2+(a[1]-z)**2-((b[0]-x)**2+(b[1]-z)**2)).map((c) => c.join(',')));
  }
  disposeChunk(group) {
    this.scene.remove(group);
    for (const child of group.children) child.geometry.dispose();
  }
  buildChunk(cx, cz) {
    const key = `${cx},${cz}`, old = this.chunks.get(key);
    if (old) this.disposeChunk(old);
    this.dirty.delete(key);
    const w = this.world, solid = new Mesher(), water = new Mesher(), ice = new Mesher(), flow = new Mesher(), lava = new Mesher(), lavaFlow = new Mesher(), fire = [new Mesher(), new Mesher()], portal = new Mesher();
    for (let x = cx; x < cx + 16; x++)
      for (let z = cz; z < cz + 16; z++)
        for (let y = 0; y < (w.height ?? HEIGHT); y++) {
          const b = w.get(x, y, z);
          if (!b || b === END_PORTAL || isChestShaped(b) || b === PISTON_MOVING || b === 175 || b === 176 || b === 172) continue; // signs are drawn by sign-renderer.js; the moving block is drawn by updateMoving, never as a cube
          if (b === PORTAL) this.portalBlock(portal, x, y, z);
          else if (b === NETHER_WART) this.crops(solid, b, x, y, z);
          else if (b === 20) this.torch(solid, x, y, z);
          else if (isCrop(b)) this.crops(solid, b, x, y, z);
          else if (b === PUMPKIN_STEM || b === MELON_STEM) this.stem(solid, b, x, y, z);
          else if (b === DRAGON_EGG) eggBoxes().forEach((box) => this.box(solid, b, x, y, z, box, 0, true)); // RenderBlocks.renderBlockDragonEgg
          else if (b === CAKE) this.box(solid, b, x, y, z, cakeBounds(w.getMeta(x, y, z)), w.getMeta(x, y, z), true);
          else if (b===COCOA||b===SANDSTONE_SLAB) this.box(solid,b,x,y,z,blockBounds(w,x,y,z));
          else if (b===STONE_SLAB) this.box(solid,b,x,y,z,blockBounds(w,x,y,z),w.getMeta(x,y,z));
          else if (b===END_PORTAL_FRAME) this.endFrame(solid,x,y,z);
          else if (b===BEACON) this.beacon(solid,x,y,z);
          else if (b===133) this.hopper(solid,x,y,z);
          else if (b===CAULDRON) this.cauldron(solid,x,y,z);
          else if (b===FLOWER_POT) this.flowerPot(solid,x,y,z);
          else if (b===134) this.brewingStand(solid,x,y,z);
          else if (b===ANVIL) this.anvil(solid,x,y,z);
          else if (isPistonBase(b)||b===PISTON_HEAD) this.piston(solid,b,x,y,z);
          else if (isStair(b)) this.stairs(solid,b,x,y,z);
          else if (isDoor(b)) this.door(solid,b,x,y,z);
          else if (b===BED) this.bed(solid,b,x,y,z);
          else if (isPane(b)) this.pane(solid,b,x,y,z);
          else if (b===VINE) this.vine(solid,x,y,z);
          else if (isPlant(b) || b === WEB || b === REEDS) this.crossed(solid, b, x, y, z);
          else if (b === LADDER) this.ladder(solid, x, y, z);
          else if (b === FENCE || b === NETHER_FENCE) for (const box of fenceRenderBoxes(fenceMask(w, x, y, z))) this.box(solid, b, x, y, z, box);
          else if (b >= 165 && b !== 166 && b <= 169) this.shaped(solid, b, x, y, z);
          else if (isRedstoneBlock(b)) this.redstone(solid, b, x, y, z);
          else if (b === RAIL || (b >= 135 && b <= 137)) this.rail(solid, x, y, z, b);
          else if (b === CACTUS) this.cactus(solid, x, y, z);
          else if (b === 10) this.liquid(10, water, flow, x, y, z);
          else if (b === 42) this.liquid(42, lava, lavaFlow, x, y, z);
          else if (b === FIRE) this.fireBlock(fire, x, y, z);
          else if (b === CARPET) this.box(solid, b, x, y, z, blockBounds(w, x, y, z), w.getMeta(x, y, z));
          else this.cube(b === ICE || b === STAINED_GLASS ? ice : solid, b, x, y, z);
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
    add(portal, this.portal.depth, this.portal.color);
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
      if (b === STAINED_GLASS && nb === b && w.getMeta(x + f.n[0], y + f.n[1], z + f.n[2]) === w.getMeta(x, y, z)) return;
      const corners = f.v.map((v) => [v[0], v[1] * h, v[2]]), r = tileRect(blockTile(b, fi, lit, w.getMeta(x, y, z), b === 1 && (w.get(x, y + 1, z) === SNOW_LAYER || w.get(x, y + 1, z) === 23))), uvs = rectUvs(r);
      // RenderBlocks.renderBlockQuartz: a pillar lying on x (meta 3) turns the top, bottom and z faces a quarter, one on z (meta 4) the x faces.
      if (b === QUARTZ_BLOCK) { const qm = w.getMeta(x, y, z); if ((qm === 3 && fi >= 2) || (qm === 4 && fi < 2)) uvs.push(uvs.shift()); }
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
  // RenderBlocks.renderBlockTorch (blm.c(aji, III)) and renderTorchAtAngle: wall torches
  // (metadata 1-4) move 0.1 towards their wall, rise 0.2 and lean 0.4 over their 1-block height;
  // metadata 5 (the port's 0) stands upright. A 2x2-pixel top at 10/16 above the base, a 2x2
  // bottom from pixels 7-9 / 13-15, and four sides 1/16 from the centre, all in the cell's own
  // brightness with no face shading. Vertices follow the original order.
  torch(m, x, y, z, tileId = 20) {
    const meta = this.world.getMeta(x, y, z), light = this.light.packed(x, y, z), t = blockTile(tileId, 0),
      tx = (t % ATLAS_COLUMNS) * 16, ty = Math.floor(t / ATLAS_COLUMNS) * 16, W = ATLAS_COLUMNS * 16, H = ATLAS_ROWS * 16,
      uv = (u, v) => [(tx + u) / W, 1 - (ty + v) / H];
    const lean = Math.fround(0.4), wall = 0.5 - lean, rise = Math.fround(0.2);
    let px = x, py = y, pz = z, dx = 0, dz = 0;
    if (meta === 1) [px, py, dx] = [x - wall, y + rise, -lean];
    else if (meta === 2) [px, py, dx] = [x + wall, y + rise, lean];
    else if (meta === 3) [pz, py, dz] = [z - wall, y + rise, -lean];
    else if (meta === 4) [pz, py, dz] = [z + wall, y + rise, lean];
    const r = 0.0625, h = 0.625, cx = px + 0.5, cz = pz + 0.5, x0 = cx - 0.5, x1 = cx + 0.5, z0 = cz - 0.5, z1 = cz + 0.5,
      tx0 = cx + dx * (1 - h), tz0 = cz + dz * (1 - h);
    const quads = [
      [[tx0 - r, py + h, tz0 - r, 7, 6], [tx0 - r, py + h, tz0 + r, 7, 8], [tx0 + r, py + h, tz0 + r, 9, 8], [tx0 + r, py + h, tz0 - r, 9, 6]],
      [[cx + r + dx, py, cz - r + dz, 9, 13], [cx + r + dx, py, cz + r + dz, 9, 15], [cx - r + dx, py, cz + r + dz, 7, 15], [cx - r + dx, py, cz - r + dz, 7, 13]],
      [[cx - r, py + 1, z0, 0, 0], [cx - r + dx, py, z0 + dz, 0, 16], [cx - r + dx, py, z1 + dz, 16, 16], [cx - r, py + 1, z1, 16, 0]],
      [[cx + r, py + 1, z1, 0, 0], [cx + dx + r, py, z1 + dz, 0, 16], [cx + dx + r, py, z0 + dz, 16, 16], [cx + r, py + 1, z0, 16, 0]],
      [[x0, py + 1, cz + r, 0, 0], [x0 + dx, py, cz + r + dz, 0, 16], [x1 + dx, py, cz + r + dz, 16, 16], [x1, py + 1, cz + r, 16, 0]],
      [[x1, py + 1, cz - r, 0, 0], [x1 + dx, py, cz - r + dz, 0, 16], [x0 + dx, py, cz - r + dz, 16, 16], [x0, py + 1, cz - r, 16, 0]],
    ];
    for (const q of quads) m.quad(q.map((p) => [p[0], p[1], p[2]]), q.map((p) => uv(p[3], p[4])), 1, light);
  }
  // Wood slab, fence gate, trapdoor and cobblestone wall models (shaped-blocks.js).
  shaped(m, b, x, y, z, all = false) {
    const w = this.world, meta = w.getMeta(x, y, z);
    if (b === 165) this.box(m, b, x, y, z, woodSlabBounds(b, meta), meta, all);
    else if (b === 167) for (const box of gateRenderBoxes(meta)) this.box(m, b, x, y, z, box, meta, true);
    else if (b === 168) this.box(m, b, x, y, z, trapBounds(meta), meta, true);
    else if (b === 169) for (const box of wallRenderBoxes(wallMask(w, x, y, z, wallSolid), w.get(x, y + 1, z) === 0)) this.box(m, b, x, y, z, box, meta, true);
  }
  // RenderBlocks.renderStandardBlock over setRenderBounds (used by renderBlockFence): each face of
  // the box with the ambient-occlusion path. Texture coordinates follow renderFace*: u = x on the
  // top, bottom and south faces, z on the west face, 1 - x north and 1 - z east (the mirrored
  // field_152631_f mapping, which for the centred fence post equals the plain one); v = z on the
  // top and bottom, 1 - y on the sides. A face on the cell boundary is skipped next to an opaque cube.
  box(m, b, x, y, z, [x0, y0, z0, x1, y1, z1], meta = 0, renderAllFaces = false) {
    const w = this.world, L = this.light, lo = [x0, y0, z0], hi = [x1, y1, z1];
    FACES.forEach((f, fi) => {
      const axis = fi >> 1, positive = (fi & 1) === 0, boundary = positive ? hi[axis] >= 1 : lo[axis] <= 0;
      if (!renderAllFaces && boundary && hides(w.get(x + f.n[0], y + f.n[1], z + f.n[2]))) return;
      const r = tileRect(blockTile(b, fi, false, meta)),
        corners = f.v.map((v) => [v[0] ? x1 : x0, v[1] ? y1 : y0, v[2] ? z1 : z0]),
        st = (p) => [[1 - p[2], 1 - p[1]], [p[2], 1 - p[1]], [p[0], p[2]], [p[0], p[2]], [p[0], 1 - p[1]], [1 - p[0], 1 - p[1]]][fi],
        uvs = corners.map((p) => {
          const [s, t] = st(p);
          return [r.u0 + (r.u1 - r.u0) * s, r.v1 - (r.v1 - r.v0) * t];
        }),
        s = smoothFace(L, x, y, z, fi, corners, boundary);
      m.quad(corners.map((p) => [x + p[0], y + p[1], z + p[2]]), uvs, s.ao.map((a) => a * f.shade), s.packed);
    });
  }
  // RenderBlocks.renderBlockStairs (render type 10): the half block with the usual face culling, then
  // the second box and the optional inner-corner box with renderAllFaces set (stairBoxes).
  stairs(m,b,x,y,z) {
    stairBoxes(this.world,x,y,z).forEach((box,i)=>this.box(m,b,x,y,z,box,0,i>0));
  }
  // RenderBlocks.renderBlockDoor (render type 7): the half's bounds as a box with the usual face culling, each side
  // face using BlockDoor.getIcon's flipped or plain texture (doorFaceFlip); the top and bottom use the lower texture.
  door(m,b,x,y,z) {
    const w=this.world,L=this.light,flags=doorFlags(w,x,y,z),[x0,y0,z0,x1,y1,z1]=doorBoundsFor(flags),lo=[x0,y0,z0],hi=[x1,y1,z1],
      SIDE=[5,4,1,0,3,2],half=(flags&8)?8:0;
    FACES.forEach((f,fi)=>{
      const axis=fi>>1,positive=(fi&1)===0,boundary=positive?hi[axis]>=1:lo[axis]<=0;
      if(boundary&&hides(w.get(x+f.n[0],y+f.n[1],z+f.n[2])))return;
      const flip=fi<2||fi>3?doorFaceFlip(flags,SIDE[fi]):false,
        r=tileRect(blockTile(b,fi,false,fi===2||fi===3?0:half)),
        corners=f.v.map(v=>[v[0]?x1:x0,v[1]?y1:y0,v[2]?z1:z0]),
        st=(p)=>[[1-p[2],1-p[1]],[p[2],1-p[1]],[p[0],p[2]],[p[0],p[2]],[p[0],1-p[1]],[1-p[0],1-p[1]]][fi],
        uvs=corners.map(p=>{const [s0,t]=st(p),s=flip?1-s0:s0;return[r.u0+(r.u1-r.u0)*s,r.v1-(r.v1-r.v0)*t];}),
        sm=smoothFace(L,x,y,z,fi,corners,boundary);
      m.quad(corners.map(p=>[x+p[0],y+p[1],z+p[2]]),uvs,sm.ao.map(a=>a*f.shade),sm.packed);
    });
  }
  // RenderBlocks.renderBlockBed (render type 14): the 9/16-high box whose bottom face (planks) sits 3/16 up; the side and
  // end textures only use their lower 9 rows (the legs). u runs along the bed from the foot end to the head end.
  bed(m,b,x,y,z) {
    const w=this.world,L=this.light,meta=w.getMeta(x,y,z),[dx,dz]=BED_DIR[meta&3],SIDE=[5,4,1,0,3,2],top=.5625;
    FACES.forEach((f,fi)=>{
      const boundary=(fi>>1)!==1; // the side faces lie on the cell border, the 9/16 top and the raised bottom do not
      if(boundary&&hides(w.get(x+f.n[0],y+f.n[1],z+f.n[2])))return;
      const kind=bedTexture(SIDE[fi],meta).split('_').pop(),r=tileRect(blockTile(b,fi,false,meta)),
        corners=f.v.map(v=>[v[0],v[1]?top:(fi===3?.1875:0),v[2]]),
        along=(p)=>dz===1?p[2]:dz===-1?1-p[2]:dx===1?p[0]:1-p[0],
        across=(p)=>dz===1?p[0]:dz===-1?1-p[0]:dx===1?1-p[2]:p[2],
        st=(p)=>kind==='end'?[across(p),1-p[1]]:kind==='side'?[along(p),1-p[1]]:[along(p),across(p)],
        uvs=corners.map(p=>{const [s,t]=st(p);return[r.u0+(r.u1-r.u0)*s,r.v1-(r.v1-r.v0)*t];}),
        sm=smoothFace(L,x,y,z,fi,corners,boundary);
      m.quad(corners.map(p=>[x+p[0],y+p[1],z+p[2]]),uvs,sm.ao.map(a=>a*f.shade),sm.packed);
    });
  }
  // RenderBlocks.renderBlockPane (render types 18 and 41): thin planes through the cell's centre line for each
  // arm (a half plane per one-sided connection, a full one through or with none), the side texture's matching
  // half, 2-pixel caps (u 7-9 of the top texture) where a lone arm ends, and top and bottom strips.
  pane(m,b,x,y,z) {
    const w=this.world,mask=paneMask(w,x,y,z),side=tileRect(blockTile(b,0,false,w.getMeta(x,y,z))),top=tileRect(blockTile(b,2,false,w.getMeta(x,y,z))),light=this.light.packed(x,y,z),
      lerp=(a,c,t)=>a+(c-a)*t,c0=0.4375,c1=0.5625,
      plane=(axis,from,to)=>{
        const sa=from,sb=to,v=axis==='x'?[[x+from,y+1,z+.5],[x+from,y,z+.5],[x+to,y,z+.5],[x+to,y+1,z+.5]]:[[x+.5,y+1,z+from],[x+.5,y,z+from],[x+.5,y,z+to],[x+.5,y+1,z+to]];
        m.quad(v,[[lerp(side.u0,side.u1,sa),side.v1],[lerp(side.u0,side.u1,sa),side.v0],[lerp(side.u0,side.u1,sb),side.v0],[lerp(side.u0,side.u1,sb),side.v1]],1,light,true);
      },
      cap=(axis)=>{ // the plane through x = 0.5 (or z = 0.5) spanning the 2-pixel post on the other axis
        const v=axis==='x'?[[x+.5,y+1,z+c0],[x+.5,y,z+c0],[x+.5,y,z+c1],[x+.5,y+1,z+c1]]:[[x+c0,y+1,z+.5],[x+c0,y,z+.5],[x+c1,y,z+.5],[x+c1,y+1,z+.5]];
        m.quad(v,[[lerp(top.u0,top.u1,7/16),top.v1],[lerp(top.u0,top.u1,7/16),top.v0],[lerp(top.u0,top.u1,9/16),top.v0],[lerp(top.u0,top.u1,9/16),top.v1]],1,light,true);
      },
      strip=(axis,from,to,yy)=>{
        const v=axis==='x'?[[x+from,y+yy,z+c0],[x+to,y+yy,z+c0],[x+to,y+yy,z+c1],[x+from,y+yy,z+c1]]:[[x+c0,y+yy,z+from],[x+c1,y+yy,z+from],[x+c1,y+yy,z+to],[x+c0,y+yy,z+to]],
          ua=lerp(top.u0,top.u1,7/16),ub=lerp(top.u0,top.u1,9/16),va=lerp(top.v0,top.v1,from),vb=lerp(top.v0,top.v1,to);
        m.quad(v,[[ua,va],[ua,vb],[ub,vb],[ub,va]],1,light,true);
      };
    const arms=paneArms(mask),above=paneSideRendered(b,w.get(x,y+1,z)),below=paneSideRendered(b,w.get(x,y-1,z));
    for(const a of arms){
      plane(a.axis,a.from,a.to);
      // A one-sided arm ends at the centre; it gets a cap unless an arm on the other axis closes it.
      if((a.to-a.from)<1&&arms.length===1)cap(a.axis);
      if(above)strip(a.axis,a.from,a.to,1);
      if(below)strip(a.axis,a.from,a.to,0);
    }
  }
  // RenderBlocks render type 16/17 (piston base/extension): rotated native quads from dispenser-piston.js,
  // flat cell brightness instead of per-vertex AO.
  piston(m,b,x,y,z) {
    const meta=this.world.getMeta(x,y,z),light=this.light.packed(x,y,z);
    for(const q of pistonQuads(b,meta)){
      const r=tileRect(namedTile(q.icon));
      m.quad(q.verts.map(v=>[x+v[0],y+v[1],z+v[2]]),q.verts.map(v=>[r.u0+(r.u1-r.u0)*v[3],r.v1-(r.v1-r.v0)*v[4]]),q.shade,light,true);
    }
  }
  // RenderBlocks render type 35: native four-piece metal silhouette, with the
  // metadata orientation and damaged top tile. BlockAnvil.shouldSideBeRendered
  // returns true, so all outward faces remain visible beside full cubes.
  // RenderBlocks.renderBlockBeacon (render type 34): the glass shell, the obsidian base and the beacon core (the last two draw every face).
  beacon(m,x,y,z) {
    this.box(m,BEACON,x,y,z,[0,0,0,1,1,1],0);
    this.box(m,BEACON,x,y,z,[.125,.00625,.125,.875,.1875,.875],1,true);
    this.box(m,BEACON,x,y,z,[.1875,.1875,.1875,.8125,.875,.8125],2,true);
  }
  // RenderBlocks.renderBlockEndPortalFrame (render type 26): the 13/16 base, then the eye's smaller box with every face
  // drawn in the endframe_eye texture (blockTile reads meta bit 16 as that override).
  endFrame(m,x,y,z) {
    const meta=this.world.getMeta(x,y,z);
    endFrameBoxes(meta).forEach((box,i)=>this.box(m,END_PORTAL_FRAME,x,y,z,box,i?16:meta,i>0));
  }
  // RenderBlocks.renderBlockCauldron (render type 24): the outer boxes (floor and four walls) in the cauldron textures, the
  // inner faces of floor and walls in cauldron_inner, and the water surface (water_still, not biome tinted) at 6/16 + 3/16 per level.
  cauldron(m,x,y,z) {
    cauldronBoxes().forEach(box=>this.box(m,CAULDRON,x,y,z,box,0,true));
    const own=this.light.packed(x,y,z);
    // blockTile reads meta bit 16 as cauldron_inner and bit 32 as water_still.
    const innerUv=rectUvs(tileRect(blockTile(CAULDRON,0,false,16))),F=CAULDRON_FLOOR,W=CAULDRON_WALL,e=0.002;
    m.quad([[x+W,y+F+e,z+W],[x+1-W,y+F+e,z+W],[x+1-W,y+F+e,z+1-W],[x+W,y+F+e,z+1-W]],innerUv,0.9,own,true);
    // inner wall faces, bottom edge first
    for(const q of [
      [[W,F,W],[1-W,F,W],[1-W,1,W],[W,1,W]], [[W,F,1-W],[1-W,F,1-W],[1-W,1,1-W],[W,1,1-W]],
      [[W,F,W],[W,F,1-W],[W,1,1-W],[W,1,W]], [[1-W,F,W],[1-W,F,1-W],[1-W,1,1-W],[1-W,1,W]],
    ])m.quad(q.map(p=>[x+p[0],y+p[1],z+p[2]]),innerUv,0.8,own,true);
    const level=this.world.getMeta(x,y,z)&3;
    if(level>0){const h=cauldronWaterHeight(level),wuv=rectUvs(tileRect(blockTile(CAULDRON,0,false,32)));
      m.quad([[x+W,y+h,z+W],[x+1-W,y+h,z+W],[x+1-W,y+h,z+1-W],[x+W,y+h,z+1-W]],wuv,1,own,true);}
  }
  // RenderBlocks.renderBlockBrewingStand (render type 25): the centre post in brewing_stand, the three base slabs in brewing_stand_base
  // (blockTile reads meta bit 16 as the base) and one vertical sprite plane toward each slab whose bottle bit (1/2/4) is set.
  brewingStand(m,x,y,z) {
    const meta=this.world.getMeta(x,y,z),own=this.light.packed(x,y,z);
    this.box(m,134,x,y,z,[0.4375,0,0.4375,0.5625,0.875,0.5625],0,true);
    for(const box of [[0.5625,0,0.3125,0.9375,0.125,0.6875],[0.125,0,0.0625,0.5,0.125,0.4375],[0.125,0,0.5625,0.5,0.125,0.9375]])this.box(m,134,x,y,z,box,16,true);
    const uvs=rectUvs(tileRect(blockTile(134,0,false,0)));
    [[0.75,0.5],[0.3125,0.25],[0.3125,0.75]].forEach(([cx,cz],i)=>{
      if(!(meta&(1<<i)))return;
      const dx=cx-0.5,dz=cz-0.5,len=Math.hypot(dx,dz),px=-dz/len*0.28,pz=dx/len*0.28;
      m.quad([[x+0.5-px,y+0.01,z+0.5-pz],[x+0.5+px,y+0.01,z+0.5+pz],[x+0.5+px,y+0.875,z+0.5+pz],[x+0.5-px,y+0.875,z+0.5-pz]],uvs,1,own,true);
    });
  }
  // RenderBlocks.renderBlockHopper (render type 38, bytecode func_147799_a): the bowl box (0, 5/8, 0)-(1, 1, 1) in the block's own icons
  // (hopper_top on top, hopper_outside elsewhere), its four inner wall faces 1/8 in from the edge in hopper_outside and the floor at
  // 5/8 in hopper_inside, the funnel (1/4, 1/4, 1/4)-(3/4, 5/8 - 0.002, 3/4) and the spout box for the facing, both in hopper_outside.
  // blockTile reads meta bit 16 as hopper_outside on every face and bit 32 as hopper_inside.
  hopper(m,x,y,z) {
    const B=133,facing=this.world.getMeta(x,y,z)&7,own=this.light.packed(x,y,z),F=0.625,W=0.125;
    this.box(m,B,x,y,z,[0,F,0,1,1,1],0,true);
    const wall=rectUvs(tileRect(blockTile(B,0,false,16))),floor=rectUvs(tileRect(blockTile(B,0,false,32)));
    for(const q of [
      [[W,F,0],[W,F,1],[W,1,1],[W,1,0]], [[1-W,F,0],[1-W,F,1],[1-W,1,1],[1-W,1,0]],
      [[0,F,W],[1,F,W],[1,1,W],[0,1,W]], [[0,F,1-W],[1,F,1-W],[1,1,1-W],[0,1,1-W]],
    ])m.quad(q.map(p=>[x+p[0],y+p[1],z+p[2]]),wall,0.8,own,true);
    m.quad([[x,y+F,z],[x+1,y+F,z],[x+1,y+F,z+1],[x,y+F,z+1]],floor,1,own,true);
    this.box(m,B,x,y,z,[0.25,0.25,0.25,0.75,F-0.002,0.75],16,true);
    const spout={0:[0.375,0,0.375,0.625,0.25,0.625],2:[0.375,0.25,0,0.625,0.5,0.25],3:[0.375,0.25,0.75,0.625,0.5,1],4:[0,0.25,0.375,0.25,0.5,0.625],5:[0.75,0.25,0.375,1,0.5,0.625]}[facing];
    if(spout)this.box(m,B,x,y,z,spout,16,true);
  }
  // BlockFlowerPot (render type 33): the 6/16 pot in the flower_pot texture and its plant as crossed quads sunk into the pot.
  flowerPot(m,x,y,z) {
    this.box(m,FLOWER_POT,x,y,z,[...POT_BOUNDS],0,true);
    const c=potContents(this.world,x,y,z);
    if(!c||!potPlantOf(c.id,c.damage))return;
    const uvs=rectUvs(tileRect(blockTile(c.id,0,false,c.damage))),light=this.light.packed(x,y,z),py=y+0.1875,a=0.1875,d=0.8125;
    m.quad([[x+a,py+0.1875,z+a],[x+d,py+0.1875,z+d],[x+d,py+1.0,z+d],[x+a,py+1.0,z+a]],uvs,1,light,true);
    m.quad([[x+a,py+0.1875,z+d],[x+d,py+0.1875,z+a],[x+d,py+1.0,z+a],[x+a,py+1.0,z+d]],uvs,1,light,true);
  }
  anvil(m,x,y,z) {
    const meta=this.world.getMeta(x,y,z);
    for(const [x0,y0,z0,x1,y1,z1] of anvilModelBoxes(meta))
      this.box(m,ANVIL,x,y,z,[x0,y0,z0,x1,y1,z1],meta,true);
  }
  // RenderBlocks.renderBlockMinecartTrack (blm.a(aje, III), render type 9): one quad 1/16 above
  // the cell floor, drawn from both sides, its corners rotated per metadata and the raised edge
  // of an ascending rail (2-5) lifted by one block; the cell's mixed brightness, colour 1.
  // Powered, detector and activator rails (ids 135-137) draw the same quad from metadata & 7; bit 8 picks the powered texture.
  rail(m, x, y, z, id = RAIL) {
    const raw = this.world.getMeta(x, y, z), meta = id === RAIL ? raw : raw & 7, r = tileRect(blockTile(id, 0, false, raw)), light = this.light.packed(x, y, z);
    let ax = x + 1, bx = x + 1, cx = x, dx = x, az = z, bz = z + 1, cz = z + 1, dz = z;
    if (meta === 1 || meta === 2 || meta === 3 || meta === 7) [ax, dx, bx, cx, az, bz, cz, dz] = [x + 1, x + 1, x, x, z + 1, z + 1, z, z];
    else if (meta === 8) [ax, bx, cx, dx, az, dz, bz, cz] = [x, x, x + 1, x + 1, z + 1, z + 1, z, z];
    else if (meta === 9) [ax, dx, bx, cx, az, bz, cz, dz] = [x, x, x + 1, x + 1, z, z, z + 1, z + 1];
    const h = y + 0.0625;
    let ay = h, by = h, cy = h, dy = h;
    if (meta === 2 || meta === 4) { ay += 1; dy += 1; }
    else if (meta === 3 || meta === 5) { by += 1; cy += 1; }
    // Original (maxU, minV), (maxU, maxV), (minU, maxV), (minU, minV); minV is the tile's top.
    m.quad([[ax, ay, az], [bx, by, bz], [cx, cy, cz], [dx, dy, dz]], [[r.u1, r.v1], [r.u1, r.v0], [r.u0, r.v0], [r.u0, r.v1]], 1, light, true);
  }
  // Redstone components (redstone-blocks.js). Inert: the dust is always drawn at power 0 and the lever,
  // repeater and button show their stored state only. Dust follows RenderBlocks.renderBlockRedstoneWire
  // (base quad 0.015625 up, tint, overlay, climbing strips); the lever, repeater, hook and
  // tripwire models are drawn from the class descriptions, not replayed against the native renderer.
  redstone(m, b, x, y, z) {
    const w = this.world, meta = w.getMeta(x, y, z), light = this.light.packed(x, y, z);
    if (b === REDSTONE_WIRE) this.wire(m, x, y, z, light);
    else if (b === STONE_PRESSURE_PLATE || b === WOODEN_PRESSURE_PLATE || b === STONE_BUTTON) this.box(m, b, x, y, z, redstoneBounds(b, meta), meta, true);
    else if (b === LEVER) this.lever(m, x, y, z, meta, light);
    else if (b === REPEATER) this.repeater(m, x, y, z, meta, light);
    else if (b === TRIPWIRE_HOOK) this.hook(m, x, y, z, meta, light);
    else if (b === TRIPWIRE) this.tripwire(m, x, y, z, meta, light);
    else if (isRedstone2Block(b)) this.redstone2(m, b, x, y, z, meta, light);
  }
  // Second redstone family (redstone-blocks-2.js), block side only: the torches reuse the torch model with their own
  // texture, the lamps, redstone block and glowstone are full cubes, the button, plates and daylight sensor are
  // boxes of redstoneBounds2 and the comparator is a repeater-like slab with torches. The comparator's torch layout
  // is drawn from the class description (not replayed against the native renderer).
  redstone2(m, b, x, y, z, meta, light) {
    if (b === REDSTONE_TORCH || b === REDSTONE_TORCH_OFF) this.torch(m, x, y, z, b);
    else if (isCube2(b)) this.cube(m, b, x, y, z);
    else if (b === COMPARATOR || b === COMPARATOR_POWERED) this.comparator(m, b, x, y, z, meta, light);
    else this.box(m, b, x, y, z, redstoneBounds2(b, meta), meta, b !== DAYLIGHT_SENSOR);
  }
  // BlockRedstoneComparator (render type 37): a 1/8 slab (top comparator_off/on, sides stone slab, bottom torch texture)
  // with two rear torches and a front torch that is raised in subtract mode (metadata bit 2).
  comparator(m, b, x, y, z, meta, light) {
    this.box(m, b, x, y, z, [0, 0, 0, 1, 0.125, 1], meta, true);
    const dir = meta & 3, subtract = (meta & 4) !== 0, lit = b === COMPARATOR_POWERED;
    const rotate = (side, back) => [dir === 1 ? -back : dir === 3 ? back : dir === 0 ? side : -side, dir === 0 ? back : dir === 2 ? -back : dir === 1 ? side : -side];
    const torches = [[0, -0.3125, subtract, subtract ? 0.625 : 0.3125], [-0.25, 0.25, lit, 0.5], [0.25, 0.25, lit, 0.5]];
    const r = 0.0625;
    for (const [side, back, on, height] of torches) {
      const t = tileRect(tileByName(on ? "redstone_torch_on" : "redstone_torch_off")), U = (p) => t.u0 + ((t.u1 - t.u0) * p) / 16, V = (p) => t.v1 - ((t.v1 - t.v0) * p) / 16;
      const [ox, oz] = rotate(side, back), cx = x + 0.5 + ox, cz = z + 0.5 + oz, y0 = y + 0.125, y1 = y0 + height;
      const sides = [[[-r, -r], [r, -r]], [[r, -r], [r, r]], [[r, r], [-r, r]], [[-r, r], [-r, -r]]];
      for (const [[ax, az], [bx, bz]] of sides) m.quad([[cx + ax, y0, cz + az], [cx + bx, y0, cz + bz], [cx + bx, y1, cz + bz], [cx + ax, y1, cz + az]], [[U(7), V(16)], [U(9), V(16)], [U(9), V(16 - height * 16)], [U(7), V(16 - height * 16)]], 1, light, true);
      m.quad([[cx - r, y1, cz + r], [cx + r, y1, cz + r], [cx + r, y1, cz - r], [cx - r, y1, cz - r]], [[U(7), V(8)], [U(9), V(8)], [U(9), V(6)], [U(7), V(6)]], 1, light, true);
    }
  }
  wire(m, x, y, z, light) {
    const { w, e, n, s } = wireArms(this.world, x, y, z), climb = wireClimbs(this.world, x, y, z), tint = wireTint(0);
    const lineX = (w || e) && !n && !s, lineZ = (n || s) && !w && !e, cross = !lineX && !lineZ;
    const uOf = (r, p) => r.u0 + ((r.u1 - r.u0) * p) / 16, vOf = (r, p) => r.v1 - ((r.v1 - r.v0) * p) / 16;
    const setTint = (c) => { const k = m.shade.length - 12; for (let i = 0; i < 4; i++) { m.shade[k + i * 3] = c[0]; m.shade[k + i * 3 + 1] = c[1]; m.shade[k + i * 3 + 2] = c[2]; } };
    const y0 = y + 0.015625, px = [0, 0, 16, 16];
    let x0 = x, x1 = x + 1, z0 = z, z1 = z + 1;
    if (cross) {
      if (!w) { x0 += 0.3125; px[0] = 5; }
      if (!e) { x1 -= 0.3125; px[2] = 11; }
      if (!n) { z0 += 0.3125; px[1] = 5; }
      if (!s) { z1 -= 0.3125; px[3] = 11; }
    }
    const names = cross ? ["redstone_dust_cross", "redstone_dust_cross_overlay"] : ["redstone_dust_line", "redstone_dust_line_overlay"];
    names.forEach((name, k) => {
      const r = tileRect(tileByName(name)), verts = [[x0, y0, z1], [x1, y0, z1], [x1, y0, z0], [x0, y0, z0]],
        pts = [[px[0], px[3]], [px[2], px[3]], [px[2], px[1]], [px[0], px[1]]];
      m.quad(verts, pts.map(([u, v]) => (lineX ? [uOf(r, v), vOf(r, u)] : [uOf(r, u), vOf(r, v)])), 1, light, true);
      setTint(k === 0 ? tint : [1, 1, 1]);
    });
    // Strips up the side of a normal cube that carries dust on top.
    const top = y + 1.021875, q = 0.015625;
    const strips = [[climb.w, x + q, null], [climb.e, x + 1 - q, null], [climb.n, null, z + q], [climb.s, null, z + 1 - q]];
    for (const [on, sx, sz] of strips) {
      if (!on) continue;
      const verts = sx !== null ? [[sx, top, z + 1], [sx, y, z + 1], [sx, y, z], [sx, top, z]] : [[x, top, sz], [x, y, sz], [x + 1, y, sz], [x + 1, top, sz]];
      ["redstone_dust_line", "redstone_dust_line_overlay"].forEach((name, k) => {
        const r = tileRect(tileByName(name));
        m.quad(verts, [[r.u0, r.v1], [r.u0, r.v0], [r.u1, r.v0], [r.u1, r.v1]], 1, light, true);
        setTint(k === 0 ? tint : [1, 1, 1]);
      });
    }
  }
  // Axis-aligned textured box with the whole tile on every face (shaded by direction).
  tbox(m, name, x, y, z, [x0, y0, z0, x1, y1, z1], light) {
    const uv = rectUvs(tileRect(tileByName(name)));
    for (const f of FACES) m.quad(f.v.map((v) => [x + (v[0] ? x1 : x0), y + (v[1] ? y1 : y0), z + (v[2] ? z1 : z0)]), uv, f.shade, light);
  }
  // A square prism from centre a to centre b with half-width hw, textured with a tile sub-rectangle (pixels).
  stick(m, name, a, b, hw, light, [pu0, pv0, pu1, pv1]) {
    const r = tileRect(tileByName(name)), U = (p) => r.u0 + ((r.u1 - r.u0) * p) / 16, V = (p) => r.v1 - ((r.v1 - r.v0) * p) / 16;
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], len = Math.hypot(...d), dn = d.map((c) => c / len);
    const h = Math.abs(dn[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const cr = (p, q) => [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]];
    let u = cr(dn, h); const ul = Math.hypot(...u); u = u.map((c) => (c / ul) * hw);
    let v = cr(dn, u); const vl = Math.hypot(...v); v = v.map((c) => (c / vl) * hw);
    const ring = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([s, t]) => [0, 1, 2].map((i) => s * u[i] + t * v[i])), add = (p, o) => [p[0] + o[0], p[1] + o[1], p[2] + o[2]];
    for (let i = 0; i < 4; i++) {
      const o0 = ring[i], o1 = ring[(i + 1) % 4];
      m.quad([add(a, o0), add(a, o1), add(b, o1), add(b, o0)], [[U(pu0), V(pv1)], [U(pu1), V(pv1)], [U(pu1), V(pv0)], [U(pu0), V(pv0)]], 0.8, light, true);
    }
    m.quad(ring.map((o) => add(b, o)), [[U(pu0), V(pv0 + 2)], [U(pu1), V(pv0 + 2)], [U(pu1), V(pv0)], [U(pu0), V(pv0)]], 1, light, true);
  }
  // Lever/hook local frame: local y runs away from the supporting face. Returns a cell-space mapper for a
  // lever metadata (5/6 floor, 7/0 ceiling, 1-4 walls).
  leverFrame(meta, x, y, z) {
    const f = { 5: (a, b, c) => [a, b, c], 6: (a, b, c) => [c, b, a], 7: (a, b, c) => [a, -b, c], 0: (a, b, c) => [c, -b, a],
      1: (a, b, c) => [b, a, c], 2: (a, b, c) => [-b, a, c], 3: (a, b, c) => [c, a, b], 4: (a, b, c) => [c, a, -b] }[meta & 7] || ((a, b, c) => [a, b, c]);
    return ([lx, ly, lz]) => { const [a, b, c] = f(lx - 0.5, ly - 0.5, lz - 0.5); return [x + 0.5 + a, y + 0.5 + b, z + 0.5 + c]; };
  }
  localBox(T, [x0, y0, z0, x1, y1, z1]) {
    const p = [T([x0, y0, z0]), T([x1, y1, z1])];
    return [0, 1, 2].map((i) => Math.min(p[0][i], p[1][i])).concat([0, 1, 2].map((i) => Math.max(p[0][i], p[1][i])));
  }
  // BlockLever (render type 12): a cobblestone base and a stick that leans one way off and the other on.
  lever(m, x, y, z, meta, light) {
    const T = this.leverFrame(meta, x, y, z), base = this.localBox(T, [0.25, 0, 0.25, 0.75, 0.1875, 0.75]), tilt = meta & 8 ? 0.25 : -0.25;
    this.tbox(m, "cobblestone", 0, 0, 0, base, light);
    this.stick(m, "lever", T([0.5, 0.1875, 0.5]), T([0.5 + tilt, 0.6875, 0.5]), 0.0625, light, [7, 6, 9, 16]);
  }
  // BlockRedstoneRepeater (render type 15): a 1/8 slab with its top texture, and two torches (fixed and delay).
  repeater(m, x, y, z, meta, light) {
    this.box(m, REPEATER, x, y, z, [0, 0, 0, 1, 0.125, 1], meta, true);
    const dir = meta & 3, delay = (meta >> 2) & 3, val = [-0.0625, 0.0625, 0.1875, 0.3125][delay], r = 0.0625;
    const t = tileRect(tileByName("redstone_torch_off")), U = (p) => t.u0 + ((t.u1 - t.u0) * p) / 16, V = (p) => t.v1 - ((t.v1 - t.v0) * p) / 16;
    for (const d of [-0.3125, val]) {
      const cx = x + 0.5 + (dir === 1 ? -d : dir === 3 ? d : 0), cz = z + 0.5 + (dir === 0 ? d : dir === 2 ? -d : 0), y0 = y + 0.125, y1 = y0 + 0.625;
      const sides = [[[-r, -r], [r, -r]], [[r, -r], [r, r]], [[r, r], [-r, r]], [[-r, r], [-r, -r]]];
      for (const [[ax, az], [bx, bz]] of sides) m.quad([[cx + ax, y0, cz + az], [cx + bx, y0, cz + bz], [cx + bx, y1, cz + bz], [cx + ax, y1, cz + az]], [[U(7), V(16)], [U(9), V(16)], [U(9), V(0)], [U(7), V(0)]], 1, light, true);
      m.quad([[cx - r, y1, cz + r], [cx + r, y1, cz + r], [cx + r, y1, cz - r], [cx - r, y1, cz - r]], [[U(7), V(8)], [U(9), V(8)], [U(9), V(6)], [U(7), V(6)]], 1, light, true);
    }
  }
  // BlockTripWireHook: a plank plate on its wall and the hook sprite.
  hook(m, x, y, z, meta, light) {
    const T = this.leverFrame([3, 2, 4, 1][meta & 3], x, y, z), plate = this.localBox(T, [0.375, 0, 0.3125, 0.625, 0.125, 0.6875]);
    this.tbox(m, "planks_oak", 0, 0, 0, plate, light);
    const r = tileRect(tileByName("trip_wire_source"));
    m.quad([[0.2, 0.125, 0.5], [0.8, 0.125, 0.5], [0.8, 0.6875, 0.5], [0.2, 0.6875, 0.5]].map((p) => T(p)), [[r.u0, r.v0], [r.u1, r.v0], [r.u1, r.v1], [r.u0, r.v1]], 1, light, true);
  }
  // BlockTripWire (render type 30): a thin strip along the axis its neighbours (tripwire or hook) lie on.
  tripwire(m, x, y, z, meta, light) {
    const w = this.world, linked = (px, pz) => { const q = w.get(px, y, pz); return q === TRIPWIRE || q === TRIPWIRE_HOOK; };
    const alongX = linked(x - 1, z) || linked(x + 1, z), h = y + (meta & 2 ? 0.1 : 0.0625), r = tileRect(tileByName("trip_wire"));
    const a = 0.4375, b = 0.5625;
    const verts = alongX ? [[x, h, z + a], [x + 1, h, z + a], [x + 1, h, z + b], [x, h, z + b]] : [[x + a, h, z], [x + b, h, z], [x + b, h, z + 1], [x + a, h, z + 1]];
    m.quad(verts, [[r.u0, r.v0], [r.u1, r.v0], [r.u1, r.v1], [r.u0, r.v1]], 1, light, true);
  }
  vine(m,x,y,z) {
    const w=this.world,meta=w.getMeta(x,y,z),uv=rectUvs(tileRect(blockTile(VINE,0))),light=this.light.packed(x,y,z),e=1/64;
    for(const [bit,v] of [[1,[[0,0,1-e],[1,0,1-e],[1,1,1-e],[0,1,1-e]]],[2,[[e,0,0],[e,0,1],[e,1,1],[e,1,0]]],[4,[[1,0,e],[0,0,e],[0,1,e],[1,1,e]]],[8,[[1-e,0,1],[1-e,0,0],[1-e,1,0],[1-e,1,1]]]])
      if(meta&bit)m.quad(v.map(p=>[x+p[0],y+p[1],z+p[2]]),uv,1,light,true);
  }
  // renderCrossedSquares, with the tall-grass position jitter from the block coordinates.
  // RenderBlocks.renderBlockStem (stems-cake.js stemQuads): crossed planes tinted by age, plus the connected plane beside a fruit.
  stem(m, b, x, y, z) {
    const meta = this.world.getMeta(x, y, z), dir = stemDirection(this.world, x, y, z, b), light = this.light.packed(x, y, z), tint = stemTint(meta),
      prefix = b === PUMPKIN_STEM ? "pumpkin_stem_" : "melon_stem_";
    for (const q of stemQuads(meta, dir)) {
      const r = tileRect(tileByName(prefix + (q.tile === "connected" ? "connected" : "disconnected")));
      m.quad(q.verts.map((v) => [x + v[0], y + v[1], z + v[2]]), q.uvs.map(([u, v]) => [r.u0 + (r.u1 - r.u0) * u, r.v1 - (r.v1 - r.v0) * v]), 1, light, true);
      const k = m.shade.length - 12;
      for (let i = 0; i < 4; i++) { m.shade[k + i * 3] = tint[0]; m.shade[k + i * 3 + 1] = tint[1]; m.shade[k + i * 3 + 2] = tint[2]; }
    }
  }
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
    const raw=w.getMeta(x,y,z), plantMeta=b===DOUBLE_PLANT&&(raw&8)?(w.getMeta(x,y-1,z)&7)|8:raw;
    const uvs = rectUvs(tileRect(blockTile(b, 0, false, plantMeta))), light = this.light.packed(x, y, z), a = 0.05, c = 0.95;
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
      if(e.block===ANVIL){
        for(const [x0,y0,z0,x1,y1,z1] of anvilModelBoxes(e.meta,x-0.5,y,z-0.5))
          this.fallingAnvil(m,[x0,y0,z0,x1,y1,z1],e.meta,light);
      } else FACES.forEach((f, fi) => m.quad(f.v.map((v) => [x - 0.5 + v[0], y + v[1], z - 0.5 + v[2]]), rectUvs(tileRect(blockTile(e.block, fi, false, e.meta))), f.shade, light));
    }
    this.fallingMesh = new THREE.Mesh(m.geometry(), this.material);
    this.scene.add(this.fallingMesh);
  }
  setFalling(list) {
    this.fallingList = list;
  }
  // TileEntityRendererPiston (piston-live.js): moving blocks as [{ x, y, z, parts: [{ block, meta, quads|null, offset }] }].
  // Parts with quads (piston bases and heads) draw those; any other stored block draws as a cube/box with every face
  // (renderBlockAllFaces) through a one-cell world view. The mesh is moved by `offset`; rebuilt each frame.
  setMovingBlocks(list) {
    this.movingList = list;
  }
  // Geometry only depends on the stored block, its quads and the cell light, so it is cached per part until that changes;
  // each frame only moves the mesh by the part's offset. Stale parts are removed and their geometry disposed.
  updateMoving() {
    const cache = (this.movingMeshes ??= new Map()), used = new Set();
    if (this.movingList?.length && this.light) {
      const real = this.world;
      for (const e of this.movingList)
        e.parts.forEach((part, i) => {
          const key = `${e.x},${e.y},${e.z},${i}`, light = this.light.packed(e.x, e.y, e.z),
            last = part.quads?.[part.quads.length - 1]?.verts?.[0]?.join(","),
            sig = `${part.block},${part.meta},${part.quads ? `q${part.quads.length}:${last}` : "c"},${light}`;
          used.add(key);
          let entry = cache.get(key);
          if (!entry || entry.sig !== sig) {
            if (entry) { this.scene.remove(entry.mesh); entry.mesh.geometry.dispose(); cache.delete(key); }
            const g = this.movingGeometry(e, part, light, real);
            if (!g) return;
            const mesh = new THREE.Mesh(g, this.material);
            this.scene.add(mesh);
            cache.set(key, (entry = { sig, mesh }));
          }
          entry.mesh.position.set(...part.offset);
        });
    }
    for (const [key, entry] of cache)
      if (!used.has(key)) { this.scene.remove(entry.mesh); entry.mesh.geometry.dispose(); cache.delete(key); }
  }
  movingGeometry(e, part, light, real) {
    const m = new Mesher();
    if (part.quads) {
      for (const q of part.quads) {
        const r = tileRect(namedTile(q.icon));
        m.quad(q.verts.map((v) => [e.x + v[0], e.y + v[1], e.z + v[2]]), q.verts.map((v) => [r.u0 + (r.u1 - r.u0) * v[3], r.v1 - (r.v1 - r.v0) * v[4]]), q.shade, light, true);
      }
    } else {
      const b = part.block, view = Object.create(real);
      view.get = (x, y, z) => (x === e.x && y === e.y && z === e.z ? b : 0);
      view.getMeta = (x, y, z) => (x === e.x && y === e.y && z === e.z ? part.meta : real.getMeta(x, y, z));
      this.world = view;
      try {
        if (isStair(b)) this.stairs(m, b, e.x, e.y, e.z);
        else if (b === STONE_SLAB) this.box(m, b, e.x, e.y, e.z, blockBounds(view, e.x, e.y, e.z), part.meta, true);
        else if (b === FENCE || b === NETHER_FENCE) for (const box of fenceRenderBoxes(fenceMask(view, e.x, e.y, e.z))) this.box(m, b, e.x, e.y, e.z, box, 0, true);
        else if (b >= 165 && b !== 166 && b <= 169) this.shaped(m, b, e.x, e.y, e.z, true);
        else this.cube(m, b, e.x, e.y, e.z);
      } finally {
        this.world = real;
      }
    }
    return m.geometry();
  }
  fallingAnvil(m,[x0,y0,z0,x1,y1,z1],meta,light){
    for(const [fi,f] of FACES.entries()){
      const corners=f.v.map(v=>[v[0]?x1:x0,v[1]?y1:y0,v[2]?z1:z0]);
      m.quad(corners,rectUvs(tileRect(blockTile(ANVIL,fi,false,meta))),f.shade,light);
    }
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
  // BlockPortal: bounds by axis, faces kept by shouldSideBeRendered (portalSideRendered),
  // drawn from the whole animated portal.png strip.
  portalBlock(m, x, y, z) {
    const w = this.world, bb = blockBounds(w, x, y, z), light = this.light.packed(x, y, z), VANILLA_SIDE = [5, 4, 1, 0, 3, 2];
    FACES.forEach((f, fi) => {
      if (!portalSideRendered(w, x + f.n[0], y + f.n[1], z + f.n[2], VANILLA_SIDE[fi])) return;
      const corners = f.v.map((v) => [x + (v[0] ? bb[3] : bb[0]), y + (v[1] ? bb[4] : bb[1]), z + (v[2] ? bb[5] : bb[2])]);
      const uvs = f.v.map((v) => (fi < 2 ? [v[2], v[1]] : fi < 4 ? [v[0], v[2]] : [v[0], v[1]]));
      m.quad(corners, uvs, f.shade, light, true);
    });
  }
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
    const now = new Set([[chunk(x), chunk(z)], [chunk(x - 1), chunk(z)], [chunk(x + 1), chunk(z)], [chunk(x), chunk(z - 1)], [chunk(x), chunk(z + 1)]].filter(([a, b]) => this.world.isLoaded(a, b)).map((c) => c.join(",")));
    if (box)
      for (let a = chunk(Math.max(this.world.minX, box.x0 - 1)); a <= chunk(Math.min(this.world.maxX - 1, box.x1 + 1)); a += 16)
        for (let b = chunk(Math.max(this.world.minZ, box.z0 - 1)); b <= chunk(Math.min(this.world.maxZ - 1, box.z1 + 1)); b += 16) if (!now.has(`${a},${b}`)) this.dirty.add(`${a},${b}`);
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
        for (let a = chunk(Math.max(this.world.minX, x0)); a <= chunk(Math.min(this.world.maxX - 1, x1)); a += 16)
          for (let b = chunk(Math.max(this.world.minZ, z0)); b <= chunk(Math.min(this.world.maxZ - 1, z1)); b += 16) set.add(`${a},${b}`);
      };
    for (const [x, , z, old, now] of changes) {
      mark(first, x - 1, x + 1, z - 1, z + 1);
      if (lightOpacity(old) === lightOpacity(now) && lightEmission(old) === lightEmission(now)) continue;
      this.light.column(x, z);
      boxes.push([Math.max(this.world.minX, x - 15), Math.min(this.world.maxX - 1, x + 15), Math.max(this.world.minZ, z - 15), Math.min(this.world.maxZ - 1, z + 15)]);
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
    // EntityRenderer.updateLightmap: Night Vision brightness (partial 0 stands in for the first frame of the tick).
    this.nightVision = this.potionView?.nightVision > 0 ? nightVisionBrightness(this.potionView.nightVision, 0) : 0;
    this.lighting.update(this.sun, this.flicker.tick(), this.gamma ?? 0, this.flash, this.nightVision);
    const p = this.camera.position, chunks = this.distance / 16,
      level = this.light ? this.light.level(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z), this.subtracted) : 15,
      target = BRIGHTNESS[level] * (1 - chunks / 16) + chunks / 16;
    this.fogBrightness += (target - this.fogBrightness) * 0.1;
  }
  setGamma(gamma) {
    this.gamma = gamma;
    this.lighting.update(this.sun ?? sunBrightness(this.angle), this.flicker.x, gamma, this.flash, this.nightVision ?? 0);
  }
  // Brightness for an entity or tile entity at a world position.
  brightness(x, y, z) {
    return this.light ? this.light.packed(Math.floor(x), Math.floor(y), Math.floor(z)) : 15 << 20;
  }
  render(time, dt = 1 / 60) {
    this.water.uv.w = 1 - ((Math.floor(time * 10) % 32) + 1) / 32;
    this.flow.uv.w = 1 - ((Math.floor(time * 20) % 32) + 1) / 32;
    this.portal.uv.w = 1 - ((Math.floor(time * 20) % 32) + 1) / 32;
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
    let c = this.camera, look = c.getWorldDirection(new THREE.Vector3()), u = this.lighting.uniforms, angle = this.angle,
      eye = this.world?.get(Math.floor(c.position.x), Math.floor(c.position.y), Math.floor(c.position.z)),
      underwater = eye === 10 && c.position.y - Math.floor(c.position.y) < 8 / 9,
      // ActiveRenderInfo.getBlockAtEntityViewpoint: lava fog while the eye is in lava.
      lava = !!this.world && viewpointBlock(this.world, c.position.x, c.position.y, c.position.z) === 42,
      // The frame-eased rain, thunder and lightning terms (World.getRainStrength(partial) ...).
      w = this.weather, partial = this.dropPartial, rain = w ? w.rainStrength(partial) : 0, thunder = w ? w.weightedThunder(partial) : 0, lightning = w ? w.lastLightning : 0,
      fog = fogColor({ angle, temperature: this.temperature ?? biomeTemperature("meadow"), look: [look.x, look.y, look.z], chunks: this.distance / 16, brightness: this.fogBrightness, underwater, lava, rain, thunder, lightning, partial });
    // potion-fx.js: the void/Blindness/Night Vision terms of updateFogColor, and Blindness' own setupFog branch (it wins over water and lava).
    const pv = this.potionView, blind = pv?.blindness > 0;
    if (pv && (blind || pv.nightVision > 0 || pv.feetY !== undefined)) fog = adjustFogColor(fog, { feetY: pv.feetY ?? c.position.y - 1.62, blindness: pv.blindness, nightVision: pv.nightVision > 0 ? nightVisionBrightness(pv.nightVision, this.dropPartial) : 0 });
    u.fogColor.value.set(...fog);
    // setupFog: linear from 3/4 of the far plane; exponential 0.1 in water, 2.0 in lava.
    u.fogDensity.value = blind ? 0 : lava ? 2 : underwater ? 0.1 : 0;
    const bf = blind ? blindnessFog(pv.blindness, this.distance) : null;
    u.fogNear.value = bf ? bf.start : this.distance * 0.75;
    u.fogFar.value = bf ? bf.end : this.distance;
    const sky = underwater || lava || blind ? fog : skyColor(this.temperature ?? 0.8, angle, rain, thunder, lightning, partial);
    this.sky.update({ angle, sky, fog, sunrise: underwater || lava || blind ? null : sunriseColors(angle), stars: blind ? 0 : starBrightness(angle), moonPhase: Math.floor(this.ticks / 24000) % 8, aboveHorizon: c.position.y - SEA, far: this.distance, underwater: underwater || lava || blind, rain });
    this.clouds.update(c, time * 20, cloudColor(angle, rain, thunder));
    this.weatherRenderer.update(w, this.world, c, partial, time);
    this.drops.update(this.dropList, this.dropPartial, time * 20);
    this.updateFalling(this.dropPartial);
    this.updateMoving();
    const particleView = this.particleView ?? { yaw: c.rotation.y, pitch: c.rotation.x };
    this.projectiles.update(this.projectileList.balls, this.effectRenderer.layers[2], c, this.dropPartial, particleView);
    this.arrows.update(this.arrowList, this.dropPartial);
    this.fishingRenderer.update(this.fishingState?.hook ?? null, c, this.dropPartial, { ...particleView, ...this.fishingState });
    this.particleRenderer.update(this.particles.list, this.dropPartial, particleView);
    this.explosionParticleRenderer.update(this.effectRenderer, this.dropPartial, particleView);
    // EntityRenderer.setupCameraTransform: the Nausea / portal warp, a matrix applied to eye space ahead of the projection.
    const proj = c.projectionMatrix, savedProj = pv?.warp > 0 ? proj.clone() : null;
    if (savedProj) { proj.multiply(this.warpM4.fromArray(warpMatrix(pv.rendererTicks ?? this.ticks, this.dropPartial, pv.warp, pv.nausea))); c.projectionMatrixInverse.copy(proj).invert(); }
    this.sky.render(this.renderer, c, new THREE.Color(...fog));
    this.renderer.render(this.scene, c);
    if (savedProj) { proj.copy(savedProj); c.projectionMatrixInverse.copy(proj).invert(); }
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
  // The fishing bobber and line (fishing-renderer.js): { hook, first, sneaking } or null.
  setFishing(state) {
    this.fishingState = state;
  }
  // Flying and stuck arrows (see bow.js).
  setArrows(list) {
    this.arrowList = list;
  }
  setDistance(distance) {
    this.distance = distance;
  }
}
