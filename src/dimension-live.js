// Travel between the Overworld, the Nether and the End: how one saved world holds the three dimensions, the portal checks the
// player runs every tick, the arrival (Teleporter + transferEntityToWorld, dimensions.js) and the overlay/sounds.
//
// Save model. The Overworld is the world record itself (old saves load unchanged, byte for byte). In a dimension, `active` is a
// *view* record: id `${root}~${dimension}` (the key its block edits are stored under, as any streamed world), the player/global
// fields of the root, and the coordinate-keyed runtime fields (DIM_KEYS) and tile entities (TILE_KEYS) of that dimension only.
// save() stores `stored(view, root)` on the shelf instead: the root with the view's global fields, `dimension` (where the player
// is) and `dimensions[d] = { state, tiles }`. The Overworld's own fields stay at the top level of the root untouched.
import { DimensionWorld, TerrainPeek } from "./dimension-world.js";
import { World } from "./world.js";
import { javaSeed } from "./java-world.js";
import { JavaRandom } from "./java-random.js";
import { materialSolid } from "./plants.js";
import { BED, BED_DIR, isBedHead } from "./bed.js";
import { readChunkEdits } from "./world-storage.js";
import { OVERWORLD, NETHER, END, PortalState, Teleporter, transferTarget, GAME_IDS, providerOf, portalCooldown, readPlayerPortalState } from "./dimensions.js";

// Per-dimension runtime state: everything main.js's save() writes that is keyed by block coordinates or holds entities.
export const DIM_KEYS = ["drops", "projectiles", "eyes", "rockets", "fishing", "thrownPotions", "arrows", "tnt", "fluidTicks", "fireTicks", "redstone", "pistons", "commandBlocks", "musicTiles", "entities", "villages", "farms", "pots", "xpOrbs", "falling", "fallingTicks", "spawners", "minecarts", "boats", "hanging", "signs", "skulls", "beacons", "populatedColumns", "containerScope", "editSequence", "dragonSpawned"];
// Tile entities that survival.serialize() keeps in the player record, by block coordinate.
export const TILE_KEYS = ["furnaces", "chests", "dispensers", "brewing", "hoppers"];
const VIEW_ONLY = new Set(["id", "rootId", "chunked", "biome", "edits", "runtimeChunked", "dimensions", "dimension", "transit"]);
const pick = (o, keys) => { const r = {}; for (const k of keys) if (o && o[k] !== undefined) r[k] = o[k]; return r; };

export const dimensionOf = (record) => record?.dimension ?? OVERWORLD;
export const rootIdOf = (record) => record?.rootId ?? record?.id;
export const viewId = (rootId, d) => `${rootId}~${d}`;

// The record `launch` runs while the player is in dimension d (a copy; the root is not modified).
export function viewRecord(root, d) {
  const blob = root.dimensions?.[d] ?? {}, v = { ...root };
  for (const k of DIM_KEYS) delete v[k];
  for (const k of VIEW_ONLY) delete v[k];
  Object.assign(v, structuredClone(blob.state ?? {}));
  v.player = { ...(root.player ?? {}) };
  for (const k of TILE_KEYS) v.player[k] = structuredClone(blob.tiles?.[k] ?? {});
  if (root.transit) v.transit = root.transit; // an arrival in flight (consumed by DimensionLive.arrive)
  return Object.assign(v, { id: viewId(root.id, d), rootId: root.id, chunked: true, biome: "javaStreamed", edits: [], dimension: d });
}
// The root record that goes on the shelf for a running view (see the header).
export function storedRecord(view, root) {
  const out = { ...root }, d = view.dimension;
  for (const k of Object.keys(view)) if (!VIEW_ONLY.has(k) && !DIM_KEYS.includes(k)) out[k] = view[k];
  out.player = { ...(view.player ?? {}) };
  for (const k of TILE_KEYS) { if (root.player?.[k] !== undefined) out.player[k] = root.player[k]; else delete out.player[k]; }
  out.dimension = d;
  out.dimensions = { ...(root.dimensions ?? {}), [d]: { state: structuredClone(pick(view, DIM_KEYS)), tiles: structuredClone(pick(view.player, TILE_KEYS)) } };
  return out;
}

// Dimension rules the rest of the game asks for (WorldProvider / ItemBucket / BlockBed / ItemCompass / ItemClock).
export function rulesOf(world) {
  const d = world?.dimension ?? OVERWORLD, p = providerOf(d);
  return {
    dimension: d,
    waterEvaporates: p.hasNoSky, // ItemBucket.a(ahb,III)Z bytecode: ahb.t.f (hasNoSky, Nether only) with water -> random.fizz + smoke, no block
    bedExplodes: !p.canRespawnHere, // BlockBed.onBlockActivated: !provider.canRespawnHere() || biome == hell
    compassSpins: d !== OVERWORLD, // ItemCompass/TextureCompass: !worldProvider.isSurfaceWorld
    clockSpins: d !== OVERWORLD, // ItemClock/TextureClock: !worldProvider.isSurfaceWorld
  };
}

const solidId = (id) => id !== 0 && materialSolid(id);
// World.get for an ordinary (finite or resident) World, with writes recorded for the later real apply.
class LivePeek {
  constructor(world) { this.world = world; this.writes = []; this.dimension = 0; this.time = 0; this.actualHeight = 256; }
  get(x, y, z) { return this.world.get(x, y, z); }
  set(x, y, z, id, meta = 0, flags = 3) { this.writes.push([x, y, z, id, meta, flags]); }
  notify() {}
}
// Entity yaw in the game (radians, three.js, 0 looks toward -z) <-> Minecraft degrees (0 looks toward +z).
export const gameYaw = (mcDegrees) => Math.PI - (mcDegrees * Math.PI) / 180;
export const mcYaw = (yaw) => ((Math.PI - yaw) * 180) / Math.PI;

export class DimensionLive {
  // host: { active(), world(), worlds(), save(), openWorld(record), sound(name, opts) }
  constructor(host) {
    this.host = host; this.state = new PortalState(); this.busy = false; this.overlayAmount = 0; this.writes = [];
    this.readEdits = readChunkEdits; this.onDragonSpawn = () => {}; this.quiet = false; this.overlay = null; this.trigger = false;
  }
  // main.js openWorld hooks ------------------------------------------------------------
  // A record saved while the player was in a dimension opens as that dimension's view.
  openRecord(record, joined) { return record.dimension && !record.rootId ? viewRecord(joined, record.dimension) : record; }
  createWorld(record) { return record.rootId ? new DimensionWorld(record.seed, record.dimension) : new World(record.seed, record.biome, record.generationVersion ?? 1, record.worldType); }
  // Called after the world exists and before the saved position is read. Sets record.position for a travel arrival.
  async arrive(prepared, record) {
    const t = record.transit; delete record.transit; this.writes = []; this.exit = false;
    if (!t) return;
    const to = dimensionOf(record), from = t.from;
    if (t.death || from === END) delete record.portalState; // A new player is created on respawn.
    else if ((from === NETHER || to === NETHER) && !record.portalState?.t) {
      // Scripted travel has no preceding portal tick. Guard its arrival too.
      record.portalState = { c: 0, t: portalCooldown(true) };
    }
    if (t.death) { record.position = null; return; } // the respawn handler picks the bed / world spawn
    if (from === END) { // leaving the End: the bed or world spawn (EntityPlayerMP.travelToDimension(1) -> respawnPlayer)
      const bed = record.bed?.spawn;
      record.position = bed ? { x: bed[0] + 0.5, y: bed[1], z: bed[2] + 0.5, yaw: record.position?.yaw ?? 0, pitch: 0 } : null;
      this.exit = !!bed;
      return;
    }
    const tt = transferTarget(from, to, t.x, t.y, t.z, mcYaw(t.yaw ?? 0));
    const edits = to === OVERWORLD && !record.chunked ? null : new Map(await this.readEdits(record.id));
    const world = prepared.streaming ? new TerrainPeek(prepared, edits ?? new Map()) : new LivePeek(prepared);
    world.dimension = to; world.actualHeight = providerOf(to).hasNoSky ? 128 : 256;
    world.seed = javaSeed(record.seed);
    const e = { x: tt.x, y: tt.y, z: tt.z, vx: 0, vy: 0, vz: 0, yaw: tt.yaw, pitch: 0, teleportDirection: t.dir ?? 0 };
    new Teleporter(world, { isSolid: solidId, random: new JavaRandom(world.seed) }).placeInPortal(e, tt.x, tt.y, tt.z, tt.yaw);
    this.writes = world.writes;
    record.position = { x: e.x, y: e.y, z: e.z, yaw: gameYaw(e.yaw), pitch: 0 };
  }
  restorePlayer(record) {
    this.state.restore(readPlayerPortalState(record.portalState));
    this.setOverlay(0);
  }
  // After the resident columns (and their saved edits) are loaded: the portal frames/platform the Teleporter placed.
  applyWrites(prepared, record, { verifyBed } = {}) {
    for (const [x, y, z, id, meta] of this.writes) prepared.set(x, y, z, id, true, meta);
    this.writes = [];
    if (this.exit) { // bed spawn of the Overworld: still a bed with a free cell beside it, else the world spawn
      this.exit = false;
      const cell = verifyBed?.(prepared, record.bed.spawn);
      record.position = cell ? { ...cell, yaw: record.position.yaw, pitch: 0 } : null;
    }
    if (record.dimension === END && !record.dragonSpawned) { record.dragonSpawned = true; this.onDragonSpawn({ x: 0, y: 128, z: 0 }); } // first entry: the dragon spawn hook
  }
  // Travel ---------------------------------------------------------------------------
  async travel(target, { exit = false, death = false } = {}) {
    if (this.busy) return false;
    this.busy = true;
    try {
      const h = this.host, rec = h.active(), p = h.player();
      await h.save();
      const root = h.worlds().find((w) => w.id === rootIdOf(rec));
      if (!root) return false;
      if (exit) await h.showCredits?.();
      const next = { ...root, transit: { from: dimensionOf(rec), x: p.x, y: p.y, z: p.z, yaw: p.yaw, dir: this.state.teleportDirection, exit, death } };
      if (target) next.dimension = target; else delete next.dimension;
      this.quiet = true;
      h.sound("portal.travel", { volume: 0.25, pitch: 0.8 + Math.random() * 0.4 });
      await h.openWorld(next);
      return true;
    } finally { this.busy = false; this.quiet = false; this.setOverlay(0); }
  }
  // Per physics tick (EntityPlayerSP.onLivingUpdate / Entity.onEntityUpdate / BlockPortal / BlockEndPortal). `prev`/`pos`: feet
  // positions of the previous and current tick. Returns whether the player is standing in a nether portal (overlay input).
  tick(world, prev, pos, { creative = false, riding = false, alive = true } = {}) {
    if (this.busy || !alive || !world) return false;
    const d = world.dimension ?? OVERWORLD, hw = 0.3 - 0.001;
    let inPortal = false, endPortal = false;
    for (let x = Math.floor(pos.x - hw); x <= Math.floor(pos.x + hw); x++) for (let z = Math.floor(pos.z - hw); z <= Math.floor(pos.z + hw); z++) for (let y = Math.floor(pos.y + 0.001); y <= Math.floor(pos.y + 1.8 - 0.001); y++) {
      const b = world.get(x, y, z);
      if (b === GAME_IDS.portal) inPortal = true; else if (b === GAME_IDS.endPortal) endPortal = true;
    }
    if (endPortal && !riding) { this.travel(d === END ? OVERWORLD : END, { exit: d === END }); return false; }
    if (inPortal && !riding) this.state.setInPortal(prev.x, prev.z, pos.x, pos.z);
    const shown = this.state.inPortal;
    const go = this.state.tick(d, { creative, riding });
    if (go !== null) this.travel(go);
    return shown;
  }
  // EntityPlayerSP.onLivingUpdate: the first tick in a portal plays portal.trigger (volume 0.25, pitch 0.8-1.2); the overlay follows timeInPortal.
  portalFrame(timer, inPortal) {
    if (inPortal && timer.prev === 0 && timer.cur > 0) this.host.sound("portal.trigger", { volume: 0.25, pitch: 0.8 + Math.random() * 0.4 });
    this.setOverlay(timer.cur);
  }
  // Death inside a dimension: the respawn happens in the Overworld (WorldProvider.canRespawnHere is false in both others).
  async leaveByDeath() {
    if (!(await this.travel(OVERWORLD, { death: true }))) return false;
    return true;
  }
  // GuiIngame.renderPortalOverlay's alpha from EntityPlayerSP.timeInPortal (PortalTimer.cur): squared twice, then 0.8x + 0.2.
  setOverlay(timeInPortal) {
    if (typeof document === "undefined") return;
    if (!this.overlay) {
      const el = document.createElement("div");
      el.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:4;display:none;background:url(/media/1.7.10/blocks/portal.png) 0 0/100% 3200% no-repeat;image-rendering:pixelated";
      document.body.appendChild(el); this.overlay = el;
    }
    let f = timeInPortal;
    if (f > 0) { if (f < 1) { f *= f; f *= f; f = f * 0.8 + 0.2; } }
    this.overlay.style.display = f > 0 ? "block" : "none";
    this.overlay.style.opacity = String(Math.min(1, f));
  }
}

// BlockBed.onBlockActivated where !provider.canRespawnHere() (Nether, End): the head cell and the foot beside it become air and the
// bed explodes at the head cell centre with power 5, flaming and smoking. NOT probed (recalled from the 1.7.10 class; see dimensions.md).
// Returns the explosion centre and the cleared cells, or null when the bed works normally.
export function bedExplosion(world, x, y, z) {
  if (!rulesOf(world).bedExplodes || world.get(x, y, z) !== BED) return null;
  let meta = world.getMeta(x, y, z);
  if (!isBedHead(meta)) {
    const [dx, dz] = BED_DIR[meta & 3];
    x += dx; z += dz;
    if (world.get(x, y, z) !== BED) return { cells: [], handled: true };
    meta = world.getMeta(x, y, z);
  }
  const cells = [[x, y, z]];
  world.put(x, y, z, 0, 0);
  const [dx, dz] = BED_DIR[meta & 3];
  if (world.get(x - dx, y, z - dz) === BED) { world.put(x - dx, y, z - dz, 0, 0); cells.push([x - dx, y, z - dz]); }
  return { cells, x: x + 0.5, y: y + 0.5, z: z + 0.5, size: 5, handled: true };
}
