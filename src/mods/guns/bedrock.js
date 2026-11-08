// Guns mod (not 1.7.10): builds three.js models from the Bedrock geometry files (format 1.12.0) the TaCZ gun pack ships
// (geo_models/gun/*.json, installed locally; pack.js). The conversion follows Blockbench's reading of the format, which is
// how the pack's models were made: x is mirrored, a bone's pivot is its origin, rotations are degrees applied in Z, Y, X
// order with x and y negated, every cube carries per-face UV rectangles, and up/down faces are turned half a turn.
// Units stay in model pixels (1/16 block); the caller scales.
import * as THREE from "three";

const RAD = Math.PI / 180;
const flipX = (v) => [-(+v?.[0] || 0), +v?.[1] || 0, +v?.[2] || 0];
const bedrockEuler = (r = [0, 0, 0]) => new THREE.Euler(-(+r[0] || 0) * RAD, -(+r[1] || 0) * RAD, (+r[2] || 0) * RAD, "ZYX");

// The first geometry of a geo file: { width, height, bones: [{ name, parent, pivot, rotation, cubes }] }.
export function bedrockGeometry(json) {
  const geo = json?.["minecraft:geometry"]?.[0];
  if (!geo) return null;
  return { width: +geo.description?.texture_width || 64, height: +geo.description?.texture_height || 64, bones: geo.bones ?? [] };
}

// Each face: its outward normal and its four corners as [x, y, z] picks from (from, to), in the order top-left, top-right,
// bottom-right, bottom-left as seen from outside the cube (the order the face's UV rectangle maps onto).
const FACES = {
  north: { n: [0, 0, -1], c: [[1, 1, 0], [0, 1, 0], [0, 0, 0], [1, 0, 0]] },
  south: { n: [0, 0, 1], c: [[0, 1, 1], [1, 1, 1], [1, 0, 1], [0, 0, 1]] },
  east: { n: [1, 0, 0], c: [[1, 1, 1], [1, 1, 0], [1, 0, 0], [1, 0, 1]] },
  west: { n: [-1, 0, 0], c: [[0, 1, 0], [0, 1, 1], [0, 0, 1], [0, 0, 0]] },
  up: { n: [0, 1, 0], c: [[0, 1, 0], [1, 1, 0], [1, 1, 1], [0, 1, 1]] },
  down: { n: [0, -1, 0], c: [[0, 0, 1], [1, 0, 1], [1, 0, 0], [0, 0, 0]] },
};
// Bedrock's per-face names refer to its own (unmirrored) axes; after mirroring x, its east face is the -x side.
const FACE_SOURCE = { north: "north", south: "south", east: "west", west: "east", up: "up", down: "down" };

// Appends one cube's faces to the arrays, in the bone's local space (relative to its pivot).
function addCube(out, cube, bonePivot, width, height) {
  const size = cube.size ?? [0, 0, 0], inflate = +cube.inflate || 0;
  const o = cube.origin ?? [0, 0, 0];
  const from = [-(+o[0] + +size[0]) - inflate, +o[1] - inflate, +o[2] - inflate];
  const to = [from[0] + +size[0] + 2 * inflate, from[1] + +size[1] + 2 * inflate, from[2] + +size[2] + 2 * inflate];
  const m = new THREE.Matrix4();
  if (cube.rotation) {
    const p = new THREE.Vector3(...flipX(cube.pivot ?? [0, 0, 0]));
    m.makeTranslation(p.x, p.y, p.z).multiply(new THREE.Matrix4().makeRotationFromEuler(bedrockEuler(cube.rotation))).multiply(new THREE.Matrix4().makeTranslation(-p.x, -p.y, -p.z));
  }
  m.premultiply(new THREE.Matrix4().makeTranslation(-bonePivot[0], -bonePivot[1], -bonePivot[2]));
  const normal = new THREE.Matrix3().getNormalMatrix(m), v = new THREE.Vector3(), nv = new THREE.Vector3();
  for (const [name, face] of Object.entries(FACES)) {
    const uv = cube.uv?.[FACE_SOURCE[name]];
    if (!uv?.uv || !uv.uv_size) continue;
    let [u0, v0] = uv.uv, [w, h] = uv.uv_size;
    u0 = +u0; v0 = +v0; w = +w; h = +h;
    if (!w && !h) continue;
    // Up and down faces map their rectangle turned half a turn (Blockbench's Bedrock codec).
    let rect = [[u0, v0], [u0 + w, v0], [u0 + w, v0 + h], [u0, v0 + h]];
    if (name === "up" || name === "down") rect = [rect[2], rect[3], rect[0], rect[1]];
    const base = out.position.length / 3;
    nv.set(...face.n).applyMatrix3(normal).normalize();
    for (let i = 0; i < 4; i++) {
      const c = face.c[i];
      v.set(c[0] ? to[0] : from[0], c[1] ? to[1] : from[1], c[2] ? to[2] : from[2]).applyMatrix4(m);
      out.position.push(v.x, v.y, v.z);
      out.normal.push(nv.x, nv.y, nv.z);
      out.uv.push(rect[i][0] / width, 1 - rect[i][1] / height);
    }
    out.index.push(base, base + 3, base + 1, base + 1, base + 3, base + 2);
  }
}

// root: a Group holding the bone tree; bones: Map name -> Group (position = pivot offset from its parent, rotation = rest);
// rest: Map name -> { position, rotation } copies for animation (animation.js adds to them each frame);
// meshes: Map name -> the bone's own cubes. `material(name)` gives each bone's material (one shared one in practice);
// `hidden(name)` hides a bone and everything under it; `hiddenCubes(name)` only the bone's own cubes.
export function buildBedrockModel(geo, material, { hidden = () => false, hiddenCubes = () => false } = {}) {
  const root = new THREE.Group(), bones = new Map(), rest = new Map(), meshes = new Map(), pivots = new Map();
  for (const b of geo.bones) pivots.set(b.name, flipX(b.pivot ?? [0, 0, 0]));
  for (const b of geo.bones) {
    const g = new THREE.Group();
    g.name = b.name;
    const p = pivots.get(b.name), parentPivot = b.parent && pivots.has(b.parent) ? pivots.get(b.parent) : [0, 0, 0];
    g.position.set(p[0] - parentPivot[0], p[1] - parentPivot[1], p[2] - parentPivot[2]);
    g.rotation.copy(bedrockEuler(b.rotation));
    rest.set(b.name, { position: g.position.clone(), rotation: g.rotation.clone() });
    if (hidden(b.name)) g.visible = false;
    if (b.cubes?.length) {
      const out = { position: [], normal: [], uv: [], index: [] };
      for (const c of b.cubes) addCube(out, c, p, geo.width, geo.height);
      if (out.index.length) {
        const bg = new THREE.BufferGeometry();
        bg.setAttribute("position", new THREE.Float32BufferAttribute(out.position, 3));
        bg.setAttribute("normal", new THREE.Float32BufferAttribute(out.normal, 3));
        bg.setAttribute("uv", new THREE.Float32BufferAttribute(out.uv, 2));
        bg.setIndex(out.index);
        const mesh = new THREE.Mesh(bg, material(b.name));
        if (hiddenCubes(b.name)) mesh.visible = false;
        g.add(mesh);
        meshes.set(b.name, mesh);
      }
    }
    bones.set(b.name, g);
  }
  for (const b of geo.bones) (b.parent && bones.has(b.parent) ? bones.get(b.parent) : root).add(bones.get(b.name));
  return { root, bones, rest, meshes };
}

// A bone's transform relative to the model root, from the bones' current local transforms.
export function boneMatrix(model, name, target = new THREE.Matrix4()) {
  target.identity();
  let g = model.bones.get(name);
  if (!g) return null;
  const chain = [];
  for (; g && g !== model.root; g = g.parent) chain.push(g);
  for (let i = chain.length - 1; i >= 0; i--) { chain[i].updateMatrix(); target.multiply(chain[i].matrix); }
  return target;
}

// TaCZ's functional bones as this game shows them with no attachments fitted (BedrockGunModel's renderers): the standard
// magazine, the iron sight and carry handle, the default handguard and each attachment slot's `_default` part; the
// pack's factory parts (`adapters`, from builtin_attachments' default_attached) under attachment_adapter. Positioning
// and view bones carry no cubes worth drawing; the placeholder arm cubes give way to the player's arms (pack-view.js).
const ATTACHMENT_TYPES = ["scope", "muzzle", "stock", "grip", "laser", "extended_mag"];
const HIDDEN = new Set(["mag_extended_1", "mag_extended_2", "mag_extended_3", "mount", "sight_folded", "handguard_tactical",
  "additional_magazine"]);
// Bones whose own cubes are markers (TaCZ draws something else there, or nothing), though their children may show.
export const MARKER_BONES = new Set(["muzzle_flash", "lefthand_pos", "righthand_pos", "constraint", "camera", "views", "idle_view",
  "iron_view", "positioning", "fixed", "ground", "thirdperson_hand", "shell", "muzzle_pos"]);
export function defaultVisibility(geo, { adapters = [] } = {}) {
  const parent = new Map(geo.bones.map((b) => [b.name, b.parent ?? null]));
  const keep = new Set(adapters);
  return (name) => {
    if (HIDDEN.has(name)) return true;
    if (ATTACHMENT_TYPES.some((t) => name === `${t}_pos`) && name !== "scope_pos") return true;
    if (parent.get(name) === "attachment_adapter") return !keep.has(name);
    return false;
  };
}
