import { BEACON } from "./pyramid.js";
import { compileReady } from "./shader-warm.js";
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
import { woodSlabBounds, trapBounds, wallMask, wallRenderBoxes } from './shaped-blocks.js';
import { LILY_PAD, FERN, HEIGHT, SEA, FIRE, SNOW_LAYER, ICE, WEB, LADDER, CACTUS, REEDS, FENCE, RAIL, VINE, COCOA, DOUBLE_PLANT, SANDSTONE_SLAB, LIT_REDSTONE_ORE, ANVIL, BED, PISTON_MOVING, wallSolid, blockBounds, blockHeight, snowSelectionHeight, isPlant, isCrop, isFlower, opaqueCube, STAINED_GLASS, CARPET } from "./world.js";
import { StreamingLight, nativeLightEnabled } from './streaming-light.js';
import { STONE_SLAB, END_PORTAL_FRAME, CAULDRON, FLOWER_POT, endFrameBoxes, cauldronBoxes, cauldronWaterHeight, CAULDRON_FLOOR, CAULDRON_WALL, potContents, POT_BOUNDS, potPlantOf } from './stone-utility.js';
import { REDSTONE_WIRE, STONE_PRESSURE_PLATE, WOODEN_PRESSURE_PLATE, STONE_BUTTON, LEVER, REPEATER, TRIPWIRE_HOOK, TRIPWIRE, isRedstoneBlock, redstoneBounds, wireArms, wireClimbs, wireTint } from './redstone-blocks.js';
import { REDSTONE_TORCH, REDSTONE_TORCH_OFF, COMPARATOR, COMPARATOR_POWERED, DAYLIGHT_SENSOR, isRedstone2Block, isCube2, redstoneBounds2 } from './redstone-blocks-2.js';
import { tileByName } from './block-textures.js';
import { lilyPadCornerUv } from "./lily-pad.js";
import { BiomeColorField, PINE, BIRCH, LILY_PAD_COLOR } from "./biome-colors.js";
import { biomeFacts } from "./biomes.js";
import { createBlockAtlas, blockTile, tileRect, namedTile } from "./block-textures.js";
import { pistonQuads, isPistonBase, PISTON_HEAD } from "./dispenser-piston.js";
import { createLighting, worldMaterial } from "./light-material.js";
import { entityBrightness } from "./display-light.js";
import { LightVolume, lightOpacity, lightEmission, mhSin, mhCos, smoothFace, flatFace, celestialAngle, sunBrightness, skylightSubtracted, starBrightness, skyColor, biomeTemperature, sunriseColors, cloudColor, fogColor, TorchFlicker, BRIGHTNESS } from "./lighting.js";
import { applyDimensionRender, fixedAngle, providerFog } from "./dimension-render.js";
import { nightVisionBrightness, blindnessFog, adjustFogColor, warpMatrix } from "./potion-fx.js";
import { hasVoidParticles, voidFogYFactor, voidFogFar } from "./void-fog.js";
import { Sky, Clouds } from "./sky.js";
import { PostProcessor, anaglyphFog } from "./post-shaders.js";
import { installAnaglyphUpload, meshAnaglyph, anaglyphMultiplier } from "./anaglyph.js"; // 3D Anaglyph at the native conversion points
import { requestGuiAnaglyph } from "./gui-anaglyph.js"; // ... and the DOM GUI
import { refreshResources } from "./resource-refresh.js"; // Super Secret Settings shaders and 3D Anaglyph
import { render, setRender, usePartialAo, leavesOpaque, shouldRenderClouds, shadowsEnabled } from "./render-settings.js";
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
import { TICKS_PER_SECOND, stripOffset, resolveAnimation, fetchMcmeta } from './texture-animation.js';
import { LAVA_FOG_DENSITY, waterFogDensity } from "./fire-fx.js";
import { mediaGeneration, versioned } from './media-version.js';
import { isDoor, isPane, doorFlags, doorBoundsFor, doorFaceFlip, paneMask, paneArms, paneSideRendered } from './doors-panes.js';
import { residentOnly } from './headless-env.js';
import { createAtlasUploader } from './atlas-upload.js';
export { blockTile } from "./block-textures.js";
import { MeshMethods, MESH_METHODS, Mesher, FACES, rectUvs, arraysGeometry } from "./chunk-mesher.js";
import { snapshotRegion } from "./mesh-region.js";

// Vanilla's world is 256 tall with clouds at 128 (65 above sea level 63);
// this compressed world keeps the 65-block gap above its own sea level.
const CLOUD_HEIGHT = SEA + 65;
// The columns waiting for a (re)mesh. `stamps` records when each key was last added, so a mesh made in a worker from an older state of
// the column is recognised as stale when it arrives.
let dirtySeq = 0;
class DirtySet extends Set {
  constructor(items) { super(); this.stamps = new Map(); if (items) for (const k of items) this.add(k); }
  add(k) { this.stamps.set(k, ++dirtySeq); return super.add(k); }
  delete(k) { this.stamps.delete(k); return super.delete(k); }
  clear() { this.stamps.clear(); super.clear(); }
}

export class VoxelScene {
  constructor(container) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    this.renderer.setSize(innerWidth, innerHeight);
    // Colours stay in the game's own space end to end, as fixed-function GL did.
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer.autoClear = false;
    container.appendChild(this.renderer.domElement);
    this.post = new PostProcessor(this.renderer, { anaglyph: () => this.anaglyph });
    // Texture uploads are converted while anaglyph is on; toggling it refreshes resources like GameSettings.setOptionValue (bao.c()).
    this.anaglyphUpload = installAnaglyphUpload(this.renderer.getContext());
    this.post.onAnaglyphChange = (on) => {
      this.anaglyphUpload.state.on = on && !this.post.legacyAnaglyph;
      requestGuiAnaglyph(on); // DOM GUI images: converted ahead, committed by refreshResources (the native GUI converts even in the port's legacy mode, which only changes the 3D pass)
      meshAnaglyph.on = this.anaglyphUpload.state.on; // RenderBlocks colour multipliers; loadRenderers remeshes every chunk
      for (const k of this.chunks.keys()) this.dirty.add(k);
      refreshResources().catch(() => {});
    };
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
    this.textures.setUploader(createAtlasUploader(this.renderer, THREE)); // animated tiles upload as sub-rects (atlas-upload.js)
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
    this.strips = [];
    this.terrainMaterial = worldMaterial(this.lighting, { map: this.textures.terrain }); // chunk meshes: grey tinted tiles, per-vertex biome colours
    this.biomeColors = new BiomeColorField(() => biomeFacts("meadow")); this.colorX = this.colorZ = 0;
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
      return this.strip({ uv, frames, texture: t, url, depth, color: worldMaterial(this.lighting, { map: t, alphaTest: 0, transparent: true, uvTransform: uv }) });
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
      return this.strip({ uv, frames, texture: t, url, material: worldMaterial(this.lighting, { map: t, alphaTest, uvTransform: uv }) });
    };
    this.lavaStill = opaque("/media/1.7.10/blocks/lava_still.png", 20);
    this.lavaFlow = opaque("/media/1.7.10/blocks/lava_flow.png", 16);
    // Fire: fire_layer_0 and fire_layer_1 (32 frames, one tick each), cut out by alpha.
    this.fireLayers = [opaque("/media/1.7.10/blocks/fire_layer_0.png", 32, 0.1), opaque("/media/1.7.10/blocks/fire_layer_1.png", 32, 0.1)];
    this.chunks = new Map();
    this.dirty = new DirtySet(); this.keyEpoch = new Map(); this.meshGen = 0; this.meshPool = null;
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
  // `defer`: the resident columns' meshes are queued in `pendingBuild` for buildPending (frame-sliced, main.js openWorld) instead of built here.
  // Compiles the programs of everything visible now (the End sky, portal layers ...) so the first frame does not link them. Programs
  // already built are cached, so a second call costs nothing. Resolves when done; never rejects.
  warmShaders() {
    try { return compileReady(this.renderer, this.scene, this.camera); } catch { return Promise.resolve(); } // not renderer.compileAsync: it hangs when a mob's material is disposed meanwhile (shader-warm.js)
  }
  setWorld(world, { defer = false } = {}) {
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
    this.setBiomeColors(world);
    this.temperature = world.temperatureAt?.(64, world.seaLevel, 64) ?? biomeTemperature(world.biome);
    this.clouds.height = world.height === 256 ? 128 : CLOUD_HEIGHT;
    this.litFurnaces = new Set();
    this.repeaterLit = () => false; // main.js: LiveRedstone.lit lookup for the powered repeater's light 9
    this.repeaterEmit = new Map(); // repeater cell -> lit state the light volume last used
    applyDimensionRender(this, world); // Nether/End: brightness table, sky mode, clouds (dimension-render.js)
    this.resetLight({ defer });
    for (const v of this.chunks.values()) this.disposeChunk(v);
    this.chunks.clear();
    this.dirty.clear();
    this.meshGen++; this.meshing?.clear(); // worker meshes of the previous world are dropped
    this.pendingBuild = defer ? [...world.chunks.values()].map((c) => [c.x * 16, c.z * 16]) : [];
    if (!defer) for (const [x, z] of this.pendingBuild.splice(0)) this.buildChunk(x, z);
  }
  // Builds queued meshes (setWorld defer) for up to `budgetMs`; returns how many are left. A column already built since (an edit) is skipped.
  buildPending(budgetMs = 8) {
    const end = performance.now() + budgetMs;
    while (this.pendingBuild.length && performance.now() < end) {
      const [x, z] = this.pendingBuild.shift();
      if (!this.chunks.has(`${x},${z}`) && this.world.chunks.has(`${x / 16},${z / 16}`)) this.buildChunk(x, z);
    }
    return this.pendingBuild.length;
  }
  // Per-position biome colours (biome-colors.js): the field reads native coordinates (local + the world origin) and caches biomes per column.
  setBiomeColors(world) {
    const ox = world.originX ?? 0, oz = world.originZ ?? 0, preset = { ...biomeFacts(world.biome), slot: biomeFacts(world.biome).id };
    this.colorX = ox; this.colorZ = oz;
    this.biomeColors = new BiomeColorField(world.biomeAt ? (x, z) => world.biomeAt(x - ox, z - oz) ?? preset : () => preset);
  }
  // `defer`: the volume is created empty and `lightSteps()` (a generator, one flood step per resume) builds it; main.js openWorld drives
  // it in frame-sized slices behind the loading screen. The result equals the synchronous build.
  resetLight({ defer = false } = {}) {
    const Light = this.world.streaming ? StreamingLight : LightVolume;
    this.light = new Light(this.world, (x,y,z,b) => {
      if (b === 112) { const lit = this.repeaterLit(x, y, z); this.repeaterEmit.set(`${x},${y},${z}`, lit); return lightEmission(b, lit); } // powered repeater: light 9
      return lightEmission(b,b===14 && this.litFurnaces.has(`${x},${y},${z}`));
    }, { defer, native: this.world.streaming && nativeLightEnabled() });
    this.lightPending = defer ? this.light.buildSteps() : null;
  }
  // Runs the deferred light build for up to `budgetMs`; returns true while steps remain.
  buildLight(budgetMs = 8) {
    const end = performance.now() + budgetMs;
    while (this.lightPending) {
      if (this.lightPending.next().done) this.lightPending = null;
      else if (performance.now() >= end) break;
    }
    return !!this.lightPending;
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
    this.dirty = new DirtySet([...wanted].map((k) => k.split(',').map(Number))
      .sort((a,b)=>(a[0]-x)**2+(a[1]-z)**2-((b[0]-x)**2+(b[1]-z)**2)).map((c) => c.join(',')));
  }
  disposeChunk(group) {
    this.scene.remove(group);
    for (const child of group.children) child.geometry.dispose();
  }
  buildChunk(cx, cz) {
    const key = `${cx},${cz}`;
    this.keyEpoch.set(key, (this.keyEpoch.get(key) || 0) + 1); // an async mesh of this column made before now is stale
    this.dirty.delete(key);
    // Batch 55: while the client's own break or placement waits for the server's packet, the column is meshed from the predicted view (client-prediction.js).
    const real = this.world, shown = this.predicted?.active && this.predicted.world === real ? this.predicted.view : null;
    if (shown) this.world = shown;
    let m;
    try { m = this.meshColumn(cx, cz); } finally { this.world = real; }
    this.installChunk(key, { solid: m.solid.geometry(), water: m.water.geometry(), ice: m.ice.geometry(), flow: m.flow.geometry(), lava: m.lava.geometry(),
      lavaFlow: m.lavaFlow.geometry(), fire0: m.fire[0].geometry(), fire1: m.fire[1].geometry(), portal: m.portal.geometry() });
  }
  // Replaces the column's meshes with these geometries (null where a layer is empty).
  installChunk(key, g) {
    this.chunkUpdates = (this.chunkUpdates || 0) + 1; // WorldRenderer.chunksUpdated for the F3 title line (one column mesh per count)
    const old = this.chunks.get(key);
    if (old) this.disposeChunk(old);
    const group = new THREE.Group(), add = (geometry, ...materials) => {
      if (!geometry) return;
      materials.forEach((m, i) => {
        const mesh = new THREE.Mesh(geometry, m);
        mesh.renderOrder = materials.length > 1 ? i + 1 : 0;
        group.add(mesh);
      });
    };
    // Fancy graphics draws a translucent layer as a depth-only pass then colour; Fast as one blended pass.
    const pass = (o) => (render.fancy ? [o.depth, o.color] : [o.color]);
    add(g.solid, this.terrainMaterial);
    add(g.water, ...pass(this.water));
    add(g.ice, ...pass({ depth: this.iceDepth, color: this.iceColor }));
    add(g.flow, ...pass(this.flow));
    add(g.portal, ...pass(this.portal));
    add(g.lava, this.lavaStill.material);
    add(g.lavaFlow, this.lavaFlow.material);
    add(g.fire0, this.fireLayers[0].material);
    add(g.fire1, this.fireLayers[1].material);
    this.chunks.set(key, group);
    this.scene.add(group);
  }
  // --- Column meshes in workers (mesh-pool.js, mesh-region.js) ---------------------------------------------------------------------
  // A column's region is snapshotted when the job is sent and the arrays come back as typed arrays; the page only makes the buffers.
  // A result is dropped when the column was meshed on the page (an edit: keyEpoch), re-queued (dirty stamp), or the world was replaced
  // (meshGen). Live edits (updateBlock) still mesh on the page thread so they show at once.
  setMeshPool(pool) { this.meshPool = pool; }
  get meshWorkers() { return !!this.meshPool && !this.meshPool.unavailable; }
  // Sends a column to the pool. Resolves with { geometries } for installChunk, or null (no pool, stale input, worker failure).
  meshRequest(cx, cz) {
    const key = `${cx},${cz}`, pool = this.meshPool;
    if (!this.meshWorkers || !this.light || this.lightPending || this.predicted?.active || !this.world.chunks.has(`${cx / 16},${cz / 16}`)) return null; // a worker snapshot reads the real world, not the predicted view
    const epoch = this.keyEpoch.get(key) || 0, gen = this.meshGen, stamp = this.dirty.stamps?.get(key), snap = snapshotRegion(this, cx, cz);
    const lit = new Map(snap.job.repeaters.map(([x, y, z, on]) => [`${x},${y},${z}`, on]));
    return pool.request(snap).then((r) => {
      if (!r) return null;
      for (const k of r.repeaters) this.repeaterEmit.set(k, lit.get(k) === true); // the light volume's emission callback records these
      // current: still this world and not meshed on the page since; fresh: also not queued again since (a stale-by-stamp mesh is still installed, and the column stays queued)
      return { current: gen === this.meshGen && epoch === (this.keyEpoch.get(key) || 0), fresh: stamp === this.dirty.stamps?.get(key), layers: r.layers };
    });
  }
  // Applies a result from meshRequest to the column; false when it was stale or the column left the window.
  meshApply(cx, cz, result) {
    const key = `${cx},${cz}`;
    if (!result?.current || !this.world.chunks.has(`${cx / 16},${cz / 16}`)) return false;
    if (result.fresh) this.dirty.delete(key);
    const L = result.layers;
    this.installChunk(key, { solid: arraysGeometry(L.solid), water: arraysGeometry(L.water), ice: arraysGeometry(L.ice), flow: arraysGeometry(L.flow), lava: arraysGeometry(L.lava),
      lavaFlow: arraysGeometry(L.lavaFlow), fire0: arraysGeometry(L.fire0), fire1: arraysGeometry(L.fire1), portal: arraysGeometry(L.portal) });
    return true;
  }
  // The deferred first build (setWorld defer) in workers: every queued column is sent, a result that is still current is installed as it
  // arrives, anything else (no workers, stale, failed) is meshed here. `pause` is the loading screen's task pause between page-side steps.
  async buildPendingAsync(pause = () => Promise.resolve()) {
    if (!this.meshWorkers) { while (this.buildPending(12)) await pause(); return; }
    const gen = this.meshGen, pool = this.meshPool, pending = new Set(),
      list = this.pendingBuild.splice(0).filter(([x, z]) => !this.chunks.has(`${x},${z}`) && this.world.chunks.has(`${x / 16},${z / 16}`));
    const here = (cx, cz) => gen === this.meshGen && !this.chunks.has(`${cx},${cz}`) && this.world.chunks.has(`${cx / 16},${cz / 16}`);
    for (const [cx, cz] of list) {
      while (pool.inflight >= pool.capacity && gen === this.meshGen) { if (pending.size) await Promise.race(pending); else await pause(); }
      if (gen !== this.meshGen) return;
      const p = this.meshRequest(cx, cz);
      if (p) {
        const t = p.then((r) => { if (!this.meshApply(cx, cz, r) && here(cx, cz)) this.buildChunk(cx, cz); }).finally(() => pending.delete(t));
        pending.add(t);
      } else if (here(cx, cz)) this.buildChunk(cx, cz);
      await pause();
    }
    await Promise.all(pending);
  }
  // Once per frame: installs finished dirty-queue columns and sends more, nearest first (the render loop's old two page-side builds).
  pumpDirty() {
    const pool = this.meshPool;
    if (!this.meshWorkers || this.lightPending) { for (let budget = 2; budget > 0 && this.dirty.size; budget--) this.buildChunk(...this.dirty.values().next().value.split(",").map(Number)); return; }
    if (!this.meshing) this.meshing = new Set();
    for (const key of this.dirty) {
      if (pool.inflight >= pool.capacity) break;
      if (this.meshing.has(key)) continue;
      const [cx, cz] = key.split(",").map(Number), p = this.meshRequest(cx, cz);
      if (!p) { this.buildChunk(cx, cz); break; } // not servable now: the page builds it as before
      this.meshing.add(key);
      p.then((r) => {
        this.meshing.delete(key);
        if (!this.meshApply(cx, cz, r) && r === null && this.dirty.has(key) && this.world.chunks.has(`${cx / 16},${cz / 16}`)) this.buildChunk(cx, cz); // worker failure
      });
    }
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
    this.fallingList = residentOnly(this.world, list);
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
  setFurnaces(data) {
    const next = new Set(Object.entries(data).filter(([, f]) => f.lit ?? f.burn > 0).map(([key]) => key)),
      changed = [...new Set([...next, ...(this.litFurnaces || [])])].filter((k) => next.has(k) !== this.litFurnaces?.has(k));
    this.litFurnaces = next;
    for (const k of changed) {
      const [x, y, z] = k.split(",").map(Number);
      this.updateBlock(x, z, y);
    }
  }
  // The client's predicted cell (client-prediction.js) is drawn at once: the chunk and its touching neighbours are meshed from the predicted view; the light volume
  // is not changed (the server's own change relights when it lands).
  showPredicted(x, z) {
    const chunk = (v) => Math.floor(v / 16) * 16, keys = new Set([[x, z], [x - 1, z], [x + 1, z], [x, z - 1], [x, z + 1]].filter(([a, b]) => this.world.isLoaded(a, b)).map(([a, b]) => `${chunk(a)},${chunk(b)}`));
    for (const k of keys) this.buildChunk(...k.split(",").map(Number));
  }
  // Relights around an edit; the edited chunk and its touching neighbours
  // rebuild now, the rest of the changed light box over the next frames.
  updateBlock(x, z, y = 0) {
    if (this.world.ringSink && !this.world.isLoaded(x, z)) return; // a ring column's edit (headless-columns.js) has no mesh or light volume here
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
    if (this.world.ringSink) changes = changes.filter((c) => this.world.isLoaded(c[0], c[2])); // ring columns (headless-columns.js) have no mesh or light volume here
    if (!changes.length || !this.light) return;
    const chunk = (v) => Math.floor(v / 16) * 16, first = new Set(), later = new Set(), boxes = [],
      mark = (set, x0, x1, z0, z1) => {
        for (let a = chunk(Math.max(this.world.minX, x0)); a <= chunk(Math.min(this.world.maxX - 1, x1)); a += 16)
          for (let b = chunk(Math.max(this.world.minZ, z0)); b <= chunk(Math.min(this.world.maxZ - 1, z1)); b += 16) set.add(`${a},${b}`);
      };
    for (const [x, y, z, old, now] of changes) {
      mark(first, x - 1, x + 1, z - 1, z + 1);
      if (old === 112 || now === 112) { // a repeater powering on or off keeps its id; relight only when its emission changed
        const key = `${x},${y},${z}`, was = this.repeaterEmit.get(key) ?? !this.repeaterLit(x, y, z), is = now === 112 && this.repeaterLit(x, y, z);
        if (now === 112) this.repeaterEmit.set(key, is); else this.repeaterEmit.delete(key);
        if (was === is && lightOpacity(old) === lightOpacity(now)) continue;
      } else if (lightOpacity(old) === lightOpacity(now) && lightEmission(old) === lightEmission(now)) continue;
      if (this.light.native) { // World.setBlock's light part with the replaced block's opacity
        const box = this.light.update(x, y, z, old);
        if (box) mark(later, box.x0 - 1, box.x1 + 1, box.z0 - 1, box.z1 + 1);
        continue;
      }
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
    this.dirty = new DirtySet([...first, ...this.dirty, ...later]);
  }
  // Native light only: Chunk.func_150804_b for the resident chunks (pending gap rechecks); the changed box is remeshed over the next frames.
  tickLight() {
    const box = this.light?.native && this.light.tick();
    if (!box) return;
    const chunk = (v) => Math.floor(v / 16) * 16;
    for (let a = chunk(Math.max(this.world.minX, box.x0 - 1)); a <= chunk(Math.min(this.world.maxX - 1, box.x1 + 1)); a += 16)
      for (let b = chunk(Math.max(this.world.minZ, box.z0 - 1)); b <= chunk(Math.min(this.world.maxZ - 1, box.z1 + 1)); b += 16) this.dirty.add(`${a},${b}`);
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
    this.angle = (this.dimension ? fixedAngle(this.dimension) : null) ?? celestialAngle(ticks); // Hell 0.5, End 0: WorldProvider.calculateCelestialAngle
    const w = this.dimension ? null : this.weather, // no weather in the Nether/End
      rain = w ? w.rainStrength(1) : 0, thunder = w ? w.weightedThunder(1) : 0;
    this.subtracted = skylightSubtracted(this.angle, rain, thunder);
    this.tickLight();
    this.sun = sunBrightness(this.angle, rain, thunder);
    this.flash = !!w && w.lastLightning > 0;
    // Farming and mobs read the sky light that remains at this time of day.
    this.daylight = (15 - this.subtracted) / 15;
    // EntityRenderer.updateLightmap: Night Vision brightness (partial 0 stands in for the first frame of the tick).
    this.nightVision = this.potionView?.nightVision > 0 ? nightVisionBrightness(this.potionView.nightVision, 0) : 0;
    this.lighting.update(this.sun, this.flicker.tick(), this.gamma ?? 0, this.flash, this.nightVision, this.dimension);
    const p = this.camera.position, chunks = this.distance / 16,
      level = this.light ? this.light.level(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z), this.subtracted) : 15,
      target = BRIGHTNESS[level] * (1 - chunks / 16) + chunks / 16;
    this.fogBrightness += (target - this.fogBrightness) * 0.1;
  }
  // Video settings (render-settings.js). Fancy graphics and Smooth Lighting remesh every chunk
  // (RenderGlobal.loadRenderers); Fast swaps in the opaque leaf textures; mipmaps and anisotropy go to the atlas.
  setRenderSettings(options) {
    const before = { ...render };
    setRender(options);
    this.post.syncAnaglyph(); // the option may change while no frame renders (title screen)
    if (before.fancy !== render.fancy || this.textures.leavesOpaque !== !render.fancy) this.textures.setOpaqueLeaves(!render.fancy);
    this.textures.setFiltering(render.mipmapLevels, render.anisotropic, this.renderer.capabilities.getMaxAnisotropy?.() ?? 1);
    if (before.fancy !== render.fancy || before.ao !== render.ao) for (const k of this.chunks.keys()) this.dirty.add(k);
  }
  setGamma(gamma) {
    this.gamma = gamma;
    this.lighting.update(this.sun ?? sunBrightness(this.angle), this.flicker.x, gamma, this.flash, this.nightVision ?? 0, this.dimension);
  }
  // Registers an animated texture strip and resolves its frame count and timing from the image size and its .png.mcmeta (pack
  // overrides included). Until that loads, the vanilla frame count stays and the strip shows its first frame.
  strip(strip) {
    strip.texture.userData.packStrip = true;
    strip.load = async (gen = mediaGeneration()) => {
      const img = await new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = versioned(strip.url, gen); });
      const text = await fetchMcmeta(strip.url);
      const anim = resolveAnimation(text, img.width, img.height);
      if (anim.error) console.warn(`${strip.url}: ${anim.error}`);
      if (gen) { strip.texture.image = img; strip.texture.dispose(); strip.texture.needsUpdate = true; }
      strip.anim = anim; strip.frames = anim.count; strip.uv.y = 1 / anim.count;
    };
    strip.load().catch(() => {});
    this.strips.push(strip);
    return strip;
  }
  // In-place resource refresh: every strip re-reads its png and mcmeta.
  reloadStrips() { return Promise.all(this.strips.map((s) => s.load().catch(() => {}))); }
  // Brightness for an entity or tile entity at a world position.
  brightness(x, y, z) {
    return this.light ? this.light.packed(Math.floor(x), Math.floor(y), Math.floor(z), false, false) : 15 << 20; // World.getLightBrightnessForSkyBlocks(x, y, z, 0): no own emission, no slab rule (display-light-reference.json)
  }
  // Entity.getBrightness (sa.d(F)) for an entity whose box bottom is `feetY` and height `height` (display-light.js): the brightness table entry of the cell's light level.
  entityBrightness(x, feetY, z, height) {
    return this.light ? entityBrightness((cx, cy, cz) => { const p = this.light.packed(cx, cy, cz, false, false); return Math.max((p >> 20) - this.subtracted, (p >> 4) & 15); }, BRIGHTNESS, x, feetY, z, height) : 1;
  }
  render(time, dt = 1 / 60) {
    // Strip animations come from the .png.mcmeta files (texture-animation.js): vanilla's reproduce the old hard-coded phases exactly.
    const tick = Math.floor(time * TICKS_PER_SECOND);
    this.textures.animate?.(tick); // block atlas tiles animated by a pack's .png.mcmeta (block-textures.js)
    for (const strip of this.strips) if (strip.anim) strip.uv.w = stripOffset(strip.anim.frameAtTick(tick), strip.frames);
    this.pumpDirty();
    // World.getSkyColor reads the temperature at the viewer's own block, so it follows the player across biomes.
    if (this.world?.temperatureAt) this.temperature = this.world.temperatureAt(Math.floor(this.camera.position.x), Math.floor(this.camera.position.y), Math.floor(this.camera.position.z));
    let c = this.camera, look = c.getWorldDirection(new THREE.Vector3()), u = this.lighting.uniforms, angle = this.angle,
      // ActiveRenderInfo.getBlockAtEntityViewpoint: water or lava fog while the eye is in it. A source
      // cell counts up to its top and the test then reads the cell above, so swimming through a
      // column of water never drops the fog at cell boundaries (an 8/9 cut-off flashed the sky there).
      eye = this.world ? viewpointBlock(this.world, c.position.x, c.position.y, c.position.z) : 0,
      underwater = eye === 10,
      lava = eye === 42,
      // The frame-eased rain, thunder and lightning terms (World.getRainStrength(partial) ...).
      w = this.dimension ? null : this.weather, partial = this.dropPartial, rain = w ? w.rainStrength(partial) : 0, thunder = w ? w.weightedThunder(partial) : 0, lightning = w ? w.lastLightning : 0,
      fog = fogColor({ angle, temperature: this.temperature ?? biomeTemperature("meadow"), look: [look.x, look.y, look.z], chunks: this.distance / 16, brightness: this.fogBrightness, underwater, lava, respiration: this.potionView?.respiration ?? 0, rain, thunder, lightning, partial, provider: this.dimension ? providerFog(this.dimension, angle) : null });
    // potion-fx.js: the void/Blindness/Night Vision terms of updateFogColor, and Blindness' own setupFog branch (it wins over water and lava).
    const pv = this.potionView, blind = pv?.blindness > 0;
    if (pv && (blind || pv.nightVision > 0 || pv.feetY !== undefined || pv.eyeY !== undefined)) fog = adjustFogColor(fog, { feetY: pv.eyeY ?? pv.feetY ?? c.position.y, voidFactor: voidFogYFactor(this.world?.worldType), blindness: pv.blindness, nightVision: pv.nightVision > 0 ? nightVisionBrightness(pv.nightVision, this.dropPartial) : 0 });
    if (this.post.anaglyphOn && !this.post.legacyAnaglyph) fog = anaglyphFog(fog); // EntityRenderer.updateFogColor
    u.fogColor.value.set(...fog);
    // setupFog: linear from 3/4 of the far plane; exponential 0.1 in water, 2.0 in lava.
    u.fogDensity.value = blind ? 0 : lava ? LAVA_FOG_DENSITY : underwater ? waterFogDensity({ breathing: pv?.waterBreathing, respiration: pv?.respiration }) : 0;
    const bf = blind ? blindnessFog(pv.blindness, this.distance) : null;
    u.fogNear.value = bf ? bf.start : this.distance * 0.75;
    u.fogFar.value = bf ? bf.end : this.distance;
    // setupFog void term (full-height worlds only: the 64-block legacy terrain would fog every cave).
    if (!bf && !underwater && !lava && pv?.eyeY !== undefined && this.world?.height === 256 && this.light) {
      const y = pv.eyeY, sky = this.light.packed(Math.floor(c.position.x), Math.floor(y - 1.62 + 1.8 * 0.66), Math.floor(c.position.z)) >> 20 & 15,
        far = voidFogFar({ far: this.distance, skyLight: sky, y, creative: !!pv.creative, hasVoid: hasVoidParticles({ worldType: this.world.worldType, dimension: this.dimension ?? 0 }) });
      if (far < this.distance) { u.fogFar.value = far; u.fogNear.value = far * 0.75; }
    }
    const sky = underwater || lava || blind ? fog : (this.post.anaglyphOn && !this.post.legacyAnaglyph ? anaglyphFog : (c) => c)(skyColor(this.temperature ?? 0.8, angle, rain, thunder, lightning, partial));
    this.sky.update({ angle, sky, fog, sunrise: underwater || lava || blind ? null : sunriseColors(angle), stars: blind ? 0 : starBrightness(angle), anaglyph: this.post.anaglyphOn && !this.post.legacyAnaglyph, moonPhase: Math.floor(this.ticks / 24000) % 8, aboveHorizon: c.position.y - SEA, far: this.distance, underwater: underwater || lava || blind, rain });
    this.clouds.setFancy(render.fancy);
    this.clouds.setEnabled(!this.dimension && shouldRenderClouds(this.distance / 16));
    this.clouds.update(c, time * 20, this.post.anaglyphOn && !this.post.legacyAnaglyph ? anaglyphFog(cloudColor(angle, rain, thunder)) : cloudColor(angle, rain, thunder));
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
    this.post.begin(this.dropPartial); // post-shaders.js: draws into its targets while a shader or anaglyph is active
    this.sky.render(this.renderer, c, new THREE.Color(...fog));
    this.renderer.render(this.scene, c);
    // F2 (screenshot.js): the canvas is read in the same task as the draw, so no preserveDrawingBuffer is needed.
    // With post-processing the frame is finished by endFrame(), after the hand.
    if (!this.post.active) this.#capture();
    if (savedProj) { proj.copy(savedProj); c.projectionMatrixInverse.copy(proj).invert(); }
    this.worldTriangles = this.renderer.info.render.triangles;
  }
  #capture() { if (this.captureRequest) { const cb = this.captureRequest; this.captureRequest = null; this.renderer.domElement.toBlob(cb, "image/png"); } }
  // Called by the render loop after the first-person hand: runs the post chain / anaglyph merge and presents the frame.
  endFrame() { if (this.post.end()) this.#capture(); }
  // The next rendered frame as a PNG blob (cb(null) on failure).
  requestCapture(cb) { this.captureRequest = cb; }
  // Entity shadows for this frame; `viewer` is the player's eye position.
  setShadows(casters, viewer) {
    const w = this.world, light = this.light;
    if (!shadowsEnabled()) casters = [];
    this.shadows.update(casters, viewer, w && light && { get: (x, y, z) => w.get(x, y, z), light: (x, y, z) => light.level(x, y, z, this.subtracted) });
  }
  // `partial` is how far the frame is into the next physics tick.
  setDrops(drops, partial = this.dropPartial) {
    this.dropList = residentOnly(this.world, drops);
    this.dropPartial = partial;
  }
  // Thrown snowballs and their particles (see projectiles.js).
  setProjectiles(balls, particles) {
    this.projectileList = { balls: residentOnly(this.world, balls), particles };
  }
  // The fishing bobber and line (fishing-renderer.js): { hook, first, sneaking } or null.
  setFishing(state) {
    this.fishingState = state;
  }
  // Flying and stuck arrows (see bow.js).
  setArrows(list) {
    this.arrowList = residentOnly(this.world, list);
  }
  setDistance(distance) {
    this.distance = distance;
  }
}
// The column mesh methods (chunk-mesher.js) are VoxelScene's own: `this` is the world/light/biome source they read.
for (const k of MESH_METHODS) VoxelScene.prototype[k] = MeshMethods.prototype[k];
