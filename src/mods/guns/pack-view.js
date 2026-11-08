// Guns mod (not 1.7.10): the TaCZ pack's own gun models in this game. loadGunAssets fetches a gun's geometry (first-person
// and LOD), animations and the mod's default animations once; PackGunView poses the first-person model each frame from
// hooks.js view() the way TaCZ's first-person renderer does (the camera at the model's idle_view bone, moving to its
// iron_view bone as the player aims, the hands at lefthand_pos / righthand_pos, the flash at muzzle_flash), and
// packHeldModel gives the LOD model for third person, held at its thirdperson_hand bone. A fitted gun (fit.js) also carries
// its attachments' own models on the gun's <type>_pos bones; aiming through a scope or sight puts the camera at the part's
// scope_view bone, with the world seen through its ocular and the reticle (division) drawn only there (stencil).
import * as THREE from "three";
import { parseLenient } from "./json5.js";
import { packUrl } from "./pack.js";
import { bedrockGeometry, buildBedrockModel, boneMatrix, defaultVisibility, MARKER_BONES } from "./bedrock.js";
import { parseAnimations, gunLayers, poseModel, Pose } from "./animation.js";
import { GUN_SOUNDS } from "./feel.js";
import { muzzleOverride } from "./model.js";

const assets = new Map(); // gun id -> { promise, value }
const fetchJson = (url) => fetch(url).then((r) => (r.ok ? r.text() : null)).then((t) => (t == null ? null : parseLenient(t))).catch(() => null);

function cachedLoad(cache, key, loader, changed) {
  let a = cache.get(key);
  if (!a) {
    a = { value: null, failed: false, waiters: new Set() };
    cache.set(key, a);
    a.promise = loader().then((v) => { a.value = v; a.failed = !v; for (const w of a.waiters) w(); a.waiters.clear(); return v; });
  }
  if (!a.value && !a.failed) a.waiters.add(changed);
  return a.value;
}
// The gun's pack assets once loaded, else null (and the load starts). `changed` runs when they arrive. A fitted gun shares
// its catalog gun's assets.
export function gunAssets(gun, changed = () => {}, load = fetchJson) {
  if (!gun?.pack) return null;
  const base = gun.base ?? gun;
  return cachedLoad(assets, base.id, () => loadGunAssets(base, load), changed);
}
export const gunAssetsFailed = (gun) => !!assets.get((gun?.base ?? gun)?.id)?.failed;

// An attachment's models ({ geo, lod }), like gunAssets; null for a part without a model (the extended magazines and ammo
// mods draw nothing of their own).
const partCache = new Map();
export function partAssets(att, changed = () => {}, load = fetchJson) {
  if (!att?.model) return null;
  return cachedLoad(partCache, att.id, async () => {
    const [geo, lod] = await Promise.all([load(packUrl.geo(att.model)), att.lod?.model ? load(packUrl.geo(att.lod.model)) : null]);
    const g = bedrockGeometry(geo);
    return g ? { geo: g, lod: bedrockGeometry(lod) } : null;
  }, changed);
}
export const partAssetsFailed = (att) => !att?.model || !!partCache.get(att.id)?.failed;
// The fitted parts with a model, and whether every one of them has loaded (or failed): the views rebuild once they have.
export function gunParts(gun, changed) {
  const list = Object.entries(gun?.parts ?? {}).filter(([, a]) => a.model);
  const ready = list.filter(([, a]) => partAssets(a, changed) || partAssetsFailed(a)).length;
  return { list, ready, done: ready === list.length };
}

// Scope internals (TaCZ BedrockAttachmentModel): the ocular is the eyepiece the world shows through, the division the
// reticle seen only through it; *_view bones are camera marks.
const isOcular = (n) => n === "ocular" || /^ocular_(scope|sight)/.test(n);
const isDivision = (n) => n === "division" || n === "divisions";
// Hangs each loaded part's model on the gun model's <type>_pos bone. lod: third person's simpler models and textures.
// Returns { type: { model, ocular: [meshes], division: [meshes] } }.
function fitParts(model, gun, { material, texture, lod = false, side = THREE.FrontSide }) {
  const out = {};
  for (const [type, att] of Object.entries(gun.parts ?? {})) {
    const a = att.model ? partAssets(att) : null, bone = model.bones.get(`${type}_pos`);
    if (!a || !bone) continue;
    const geo = lod && a.lod ? a.lod : a.geo, tex = lod && a.lod && att.lod?.texture ? att.lod.texture : att.texture;
    if (!tex) continue;
    const map = texture(packUrl.texture(tex)), skin = material({ map, alphaTest: 0.1, side });
    const part = buildBedrockModel(geo, () => skin, { hiddenCubes: (n) => n.endsWith("_view") || (lod && (isOcular(n) || isDivision(n))) });
    // Nested scope internals, found by walking up from each bone (division_illuminated sits under division).
    const parentOf = new Map(geo.bones.map((b) => [b.name, b.parent ?? null]));
    const under = (n, test) => { for (let x = n; x; x = parentOf.get(x)) if (test(x)) return true; return false; };
    const entry = { model: part, ocular: [], division: [] };
    let reticle = null;
    if (!lod) for (const [n, mesh] of part.meshes) {
      if (under(n, isOcular)) entry.ocular.push(mesh);
      else if (under(n, isDivision)) { mesh.material = reticle ??= material({ map, alphaTest: 0.1, side }); entry.division.push(mesh); }
    }
    bone.add(part.root);
    out[type] = entry;
  }
  return out;
}

// TaCZ BedrockGunModel.renderAdditionalMagazine: the additional_magazine bone has no cubes of its own; while a reload
// animates it, the gun's `magazine` node (the fitted magazine and its rounds) is drawn a second time in that bone's frame,
// so the old magazine leaves while the new one goes in. Here: a copy of the magazine's children under the bone (sharing
// geometry and materials), whose transforms and visibility follow the originals each frame they show.
export function mirrorMagazine(model) {
  const bone = model.bones.get("additional_magazine"), mag = model.bones.get("magazine");
  if (!bone || !mag) return null;
  const copy = new THREE.Group(), pairs = [];
  const walk = (src, dst) => {
    for (const child of src.children) {
      const c = child.isMesh ? new THREE.Mesh(child.geometry, child.material) : new THREE.Group();
      c.name = child.name;
      pairs.push([child, c]);
      dst.add(c);
      walk(child, c);
    }
  };
  walk(mag, copy);
  bone.add(copy);
  return {
    copy,
    sync() {
      copy.visible = mag.visible;
      for (const [src, dst] of pairs) {
        dst.position.copy(src.position); dst.quaternion.copy(src.quaternion); dst.scale.copy(src.scale);
        dst.visible = src.visible;
      }
    },
  };
}

export async function loadGunAssets(gun, load = fetchJson) {
  const p = gun.pack;
  const [geoJson, lodJson, animJson, defJson] = await Promise.all([
    load(packUrl.geo(p.model)),
    p.lod?.model ? load(packUrl.geo(p.lod.model)) : null,
    p.animation ? load(packUrl.animation(p.animation)) : null,
    p.defaultAnimation ? load(packUrl.defaultAnimation(p.defaultAnimation)) : null,
  ]);
  const geo = bedrockGeometry(geoJson);
  if (!geo) return null;
  const animations = parseAnimations(animJson), defaults = parseAnimations(defJson);
  fillSounds(gun, animations);
  return { geo, lod: bedrockGeometry(lodJson), animations, defaults };
}

// A pack gun's inspect, reload and action sounds are the sound_effects keyframes of its animations, plus, as TaCZ's
// SoundPlayManager plays them, the display's whole-action clip for an inspect or a reload (sounds.inspect, reload_tactical,
// ...). The AA-12, M16s, MK14, M320, RPG-7, UMP45, Uzi and double barrels have only the clip: their keyframes name sound
// files the pack does not ship. No pack gun has both a clip and keyframes that resolve.
function fillSounds(gun, animations) {
  const keys = (name) => animations.get(name)?.sounds ?? [], s = gun.sounds ?? {};
  const clip = (path) => (path ? [[0, path]] : []);
  gun.inspectSounds = { full: [...clip(s.inspect), ...keys("inspect")], empty: [...clip(s.inspectEmpty), ...keys("inspect_empty")] };
  if (GUN_SOUNDS[gun.id] || !gun.sounds) return; // the hand-made guns keep their own timing (feel.js)
  const tactical = [...clip(s.reloadTactical), ...keys("reload_tactical")], empty = [...clip(s.reloadEmpty), ...keys("reload_empty")];
  Object.assign(gun.sounds, {
    tactical, empty: empty.length ? empty : tactical,
    start: keys("reload_intro"), shellKeys: keys("reload_loop"), end: keys("reload_end"),
    pump: gun.bolt === "manual_action" && keys("bolt").length ? keys("bolt") : null,
  });
}

const S = 1 / 16;
const flashTextures = new Map();

// The player's arms over TaCZ's arm placeholders (lefthand_pos / righthand_pos), matched to each placeholder cube's box;
// `arm(left)` makes an upright 4 x 12 x 4 pixel player-arm mesh in blocks, the hand at -y (turned over here). The melee
// weapons' models (melee-view.js) hold their arms the same way.
export function fitArms(model, arm) {
  for (const side of ["lefthand_pos", "righthand_pos"]) {
    const bone = model.bones.get(side), holder = model.meshes.get(side);
    if (!bone || !arm) continue;
    // Without a placeholder cube, the usual one: 4 x 12 x 4 out to the side, rising from the bone's pivot.
    const x = side === "righthand_pos" ? -8 : 4;
    const box = holder ? new THREE.Box3().setFromBufferAttribute(holder.geometry.attributes.position) : new THREE.Box3(new THREE.Vector3(x, 0, -2), new THREE.Vector3(x + 4, 12, 2));
    const m = arm(side === "lefthand_pos"), size = box.getSize(new THREE.Vector3()), centre = box.getCenter(new THREE.Vector3());
    m.scale.set(size.x / 4 * 16, size.y / 12 * 16, size.z / 4 * 16);
    m.position.copy(centre);
    m.rotation.x = Math.PI; // TaCZ's placeholder has the hand at its far (+y) end, away from the bone's pivot
    bone.add(m);
  }
}

// The first-person pivot matrix (camera space, blocks) for a model posed this frame: the camera at `from` (the idle_view
// bone's matrix) blended to `to` (iron_view or a scope's) by the aim, then the view bob and sway, damped while aiming.
export function handCameraMatrix(from, to, aim, bob = null, sway = null, out = new THREE.Matrix4()) {
  const pa = new THREE.Vector3(), qa = new THREE.Quaternion(), pb = new THREE.Vector3(), qb = new THREE.Quaternion(), sc = new THREE.Vector3();
  from.decompose(pa, qa, sc); to.decompose(pb, qb, sc);
  aim = Math.max(0, Math.min(1, aim ?? 0));
  const e = aim * aim * (3 - 2 * aim);
  const cam = new THREE.Matrix4().compose(pa.lerp(pb, e), qa.slerp(qb, e), new THREE.Vector3(1, 1, 1));
  out.copy(cam.invert()).premultiply(new THREE.Matrix4().makeScale(S, S, S));
  if (bob || sway) {
    const k = 1 - 0.85 * aim, m = new THREE.Matrix4();
    if (bob) m.multiply(new THREE.Matrix4().makeTranslation(bob.x * k, bob.y * k, 0)).multiply(new THREE.Matrix4().makeRotationZ(bob.rz * k)).multiply(new THREE.Matrix4().makeRotationX(bob.rx * k));
    if (sway) m.multiply(new THREE.Matrix4().makeRotationX(sway.x * k)).multiply(new THREE.Matrix4().makeRotationY(sway.y * k));
    out.premultiply(m);
  }
  return out;
}


// The first-person gun: `material(options)` makes a lit entity material (first-person.js), `texture(url)` a pixel texture,
// `arm(left)` an upright player-arm mesh in blocks
// (4 x 12 x 4 pixels, centred, the hand at -y; turned over here).
export class PackGunView {
  constructor(gun, a, { material, texture, arm }) {
    this.gun = gun;
    this.animations = a.animations; this.defaults = a.defaults;
    // Unculled, as TaCZ and Blockbench draw these models: a cube seen through a cut-out (the TEC-9's barrel shroud) shows
    // its far wall, and the few faces the pack's models wind the wrong way still draw.
    const skin = material({ map: texture(packUrl.texture(gun.pack.texture)), alphaTest: 0.1, side: THREE.DoubleSide });
    const hidden = defaultVisibility(a.geo, { adapters: gun.pack.adapters, parts: gun.parts ?? null, extendedLevel: gun.extendedLevel });
    this.model = buildBedrockModel(a.geo, () => skin, { hidden, hiddenCubes: (n) => MARKER_BONES.has(n) || n.endsWith("_view") });
    this.parts = fitParts(this.model, gun, { material, texture, side: THREE.DoubleSide });
    this.outgoing = mirrorMagazine(this.model);
    this.root = new THREE.Group();
    this.root.matrixAutoUpdate = false;
    this.root.add(this.model.root);
    this.root.userData = { gunId: gun.id, pack: true, view: this };
    this.pose = new Pose();
    fitArms(this.model, arm);
    // The muzzle flash: the pack's flash texture on a quad facing the camera, spun at random each shot.
    const flashBone = this.model.bones.get("muzzle_flash");
    this.flash = new THREE.Group();
    if (flashBone && gun.pack.flash) {
      const url = packUrl.texture(gun.pack.flash.texture);
      if (!flashTextures.has(url)) flashTextures.set(url, texture(url));
      const mat = new THREE.MeshBasicMaterial({ map: flashTextures.get(url), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
      const size = 16 * gun.pack.flash.scale, quad = new THREE.PlaneGeometry(size, size);
      const face = new THREE.Mesh(quad, mat);
      this.flash.add(face);
      flashBone.add(this.flash);
    }
    this.flash.visible = false;
    // A muzzle part moves the flash out to its own end (muzzle_flash_offset, pixels along the barrel); a silencer has none.
    this.flashOffset = gun.parts?.muzzle?.flashOffset ?? 0;
    this.flash.position.z -= this.flashOffset;
    this.idle = new THREE.Matrix4(); this.iron = new THREE.Matrix4(); this.scopeView = new THREE.Matrix4();
    this.lens(this.parts.scope); // last: the arms and flash take the stencil test too
  }
  // A scope or sight's eyepiece marks the stencil (drawn first, no colour or depth); the reticle draws only there, over the
  // scope's own insides, and everything else of the hand pass only outside it, so the world shows through the glass.
  lens(scope) {
    if (!scope?.ocular.length) return;
    const mask = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, side: THREE.DoubleSide, stencilWrite: true,
      stencilRef: 1, stencilFunc: THREE.AlwaysStencilFunc, stencilZPass: THREE.ReplaceStencilOp });
    for (const m of scope.ocular) { m.material = mask; m.renderOrder = -1; }
    // The materials are this view's own (the reticle's apart, fitParts), so they change in place.
    const reticle = new Set(scope.division);
    this.root.traverse((n) => {
      if (!n.isMesh || n.material === mask) return;
      const inside = reticle.has(n);
      Object.assign(n.material, { stencilWrite: true, stencilRef: 1, stencilFunc: inside ? THREE.EqualStencilFunc : THREE.NotEqualStencilFunc,
        stencilFail: THREE.KeepStencilOp, stencilZFail: THREE.KeepStencilOp, stencilZPass: THREE.KeepStencilOp });
      if (inside) { n.material.depthTest = false; n.material.depthWrite = false; n.renderOrder = 2; }
    });
  }
  // TaCZ's model_fov / zoom_model_fov for the hand camera: the gun's own field of view, narrowing as it aims.
  // A scope's own `fov` replaces the gun's while aimed through it.
  fov(aim) {
    const p = this.gun.pack, from = p.modelFov ?? 70, to = (this.parts.scope && this.gun.scopeFov) || (p.zoomModelFov ?? from);
    return from + (to - from) * aim;
  }
  // view: hooks.js view(); bob/sway: first-person-pose.js's. Returns the pivot matrix (camera space, blocks).
  update(view, bob = null, sway = null, out = new THREE.Matrix4()) {
    const layers = gunLayers(this.animations, this.defaults, {
      sinceDraw: view.sinceDraw ?? Infinity, sinceShot: view.sinceShot, empty: view.empty, mode: view.mode, bolt: this.gun.pack.bolt ?? this.gun.bolt,
      timeline: view.timeline, sinceInspect: view.sinceInspect, inspectEmpty: view.inspectEmpty,
    });
    poseModel(this.model, layers, this.pose);
    const outgoing = this.model.bones.get("additional_magazine");
    // ModelAdditionalMagazineListener: shown only while a playing animation moves the bone.
    if (outgoing) outgoing.visible = layers.some(([anim]) => anim.bones?.has?.("additional_magazine") ?? anim.name?.startsWith("reload"));
    if (outgoing?.visible) this.outgoing?.sync();
    // Rounds in the gun: the chambered round and the magazine's top round show only while there are rounds.
    for (const n of ["bullet_in_barrel", "bullet_in_mag", "bullet_chain"]) { const b = this.model.bones.get(n); if (b) b.visible = !view.empty; }
    this.flash.visible = !this.gun.silenced && view.sinceShot >= 0 && view.sinceShot < 0.05;
    if (this.flash.visible) this.flash.rotation.z = (view.sinceShot * 9301 % 1) * Math.PI * 2;
    // The camera: idle_view, blended to iron_view by the aim (TaCZ's idleSightPath / ironSightPath).
    const idle = boneMatrix(this.model, "idle_view", this.idle) ?? this.idle.identity();
    // Through a scope or sight: the gun's scope_pos bone times the part's own scope_view.
    const scope = this.parts.scope, sv = scope && boneMatrix(scope.model, "scope_view", this.scopeView);
    const iron = (sv && boneMatrix(this.model, "scope_pos", this.iron)?.multiply(sv)) || boneMatrix(this.model, "iron_view", this.iron) || idle;
    handCameraMatrix(idle, iron, view.aim, bob, sway, out);
    this.root.matrix.identity();
    // The muzzle in camera space (blocks), for the smoke hooks.js puts in the world.
    const mz = boneMatrix(this.model, "muzzle_flash") ?? boneMatrix(this.model, "muzzle_pos");
    this.muzzle = mz ? new THREE.Vector3().setFromMatrixPosition(mz).applyMatrix4(out).toArray() : null;
    if (this.muzzle) muzzleOverride.set(this.gun.id, this.muzzle);
    return out;
  }
  dispose() {
    muzzleOverride.delete(this.gun.id);
    this.root.traverse((n) => { n.geometry?.dispose(); });
  }
}

// Third person: the LOD model (else the full one) in blocks, its thirdperson_hand bone at the origin, scaled by the pack's
// third-person scale, in the frame model.js gunHeldMatrix expects (barrel along -z, top up).
export function packHeldModel(gun, a, material, texture) {
  const lod = a.lod ?? a.geo, url = packUrl.texture(a.lod && gun.pack.lod?.texture ? gun.pack.lod.texture : gun.pack.texture);
  const skin = material({ map: texture(url), alphaTest: 0.1 });
  const model = buildBedrockModel(lod, () => skin, {
    hidden: defaultVisibility(lod, { adapters: gun.pack.adapters, parts: gun.parts ?? null, extendedLevel: gun.extendedLevel }),
    hiddenCubes: (n) => MARKER_BONES.has(n) || n.endsWith("_view") || n === "lefthand" || n === "righthand",
  });
  fitParts(model, gun, { material, texture, lod: true });
  const hand = boneMatrix(model, "thirdperson_hand");
  const group = new THREE.Group(), inner = new THREE.Group();
  inner.add(model.root);
  if (hand) inner.matrix.copy(hand.clone().invert()); else inner.matrix.identity();
  inner.matrixAutoUpdate = false;
  const s = gun.pack.thirdPersonScale ?? [1, 1, 1];
  group.scale.set(S * s[0], S * s[1], S * s[2]);
  group.add(inner);
  group.userData = { gunId: gun.id, pack: true };
  return group;
}
