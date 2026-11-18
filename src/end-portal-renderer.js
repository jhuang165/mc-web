// TileEntityEndPortalRenderer (bmt), ported from its bytecode and checked against the unchanged class run on a headless GL stub
// (tools/probes/RenderFx80Probe.java -> public/research/renderfx80-reference.json, replayed in src/renderfx80-b80.test.js).
//
// Native, per end portal tile entity within 64 blocks (TileEntity.getMaxRenderDistanceSquared 4096, from the cell centre to the camera entity):
// lighting off, Random reseeded to 31100 every frame, then 16 passes of one upward quad at y + 0.75, all at the same depth.
//   pass i: depth f14 = 16 - i, texture-matrix scale f15 = 0.0625, shade f16 = 1 / (f14 + 1);
//           pass 0: end_sky.png, shade 0.1, depth 65, scale 0.125, GL_SRC_ALPHA / GL_ONE_MINUS_SRC_ALPHA;
//           pass 1 onward: entity/end_portal.png, GL_ONE / GL_ONE (additive); pass 1 sets the scale to 0.5, later passes keep 0.0625.
//   colour: three nextFloat()s per pass (pass 0 draws them too, then uses white): r = f * 0.5 + 0.1, g = f * 0.5 + 0.4, b = f * 0.5 + 0.5,
//           times the shade, through Tessellator.setColorRGBA_F (bytes, (int) (c * 255)).
//   texgen: S, T, R object linear with planes (1,0,0,0), (0,0,1,0), (0,0,0,1); Q eye linear with plane (0,1,0,0) given under the modelview
//           translated by (camX, y + 0.75 + (h + objY) / (h + f14 + objY), camZ), where h = camY - (tileY + 0.75) (the quad's height below the
//           camera entity) and objX/Y/Z are ActiveRenderInfo's object coordinates; texture matrix
//           T(0, (getSystemTime() % 700000) / 700000, 0) S(f15) T(0.5, 0.5, 0) Rz((i * i * 4321 + i * 9) * 2 deg) T(-0.5, -0.5, 0)
//           T(-camX, -camZ, -camY) T(objX * f14 / (h + objY), objZ * f14 / (h + objY), -camY).
// WebGL has no fixed-function texgen, so the fragment shader computes the same texture coordinates in closed form (endPortalUv below,
// equal to the GL pipeline within float rounding): with E the eye point (camera entity position + ActiveRenderInfo object offset) and W
// the fragment on the plane, P = E + (W - E) * (hE + f14) / hE (hE = E.y - W.y) is where the eye ray meets a plane f14 blocks below the
// portal; (s, t) = (-P.x, -P.z) go through the rotation, scale and scroll above. Each layer therefore sits at its own depth (parallax).
// The 16 blended passes collapse into one opaque pass that replays the framebuffer: end_sky.png and end_portal.png are fully opaque, so
// pass 0 (GL_SRC_ALPHA / GL_ONE_MINUS_SRC_ALPHA at alpha 1) replaces the colour and each additive pass adds on top; every pass is written to
// the 8-bit colour buffer, clamped to [0, 1] and rounded to the nearest 1/255 step, before the next one reads it (b81 render81: the port
// summed all 16 and clamped once). Each pass is modulated by the lightmap at the tile's own brightness (TileEntityRendererDispatcher sets it;
// the entity pass keeps the lightmap unit on) and fogged on its own before blending, as fixed-function fog is applied per fragment.
// Eye point (b81 render81, bytecode-read EntityRenderer.orientCamera blt.h(F) and setupCameraTransform blt.a(F, I)): in first person, awake,
// orientCamera calls glTranslatef(0, 0, -0.1) after the roll and before the pitch and yaw turns, so the camera sits 0.1 behind the eye
// along the pitch/yaw view axis; gluPerspective's near plane is 0.05 and ActiveRenderInfo unprojects the viewport centre at winZ 0, so
// the texgen eye is camera + forward * 0.05. Third person and sleeping take the other branches (no 0.1).
// Scan (b81 render81): TileEntity.getMaxRenderDistanceSquared 4096 (aor.n, not overridden by apo) is the only range test, so every portal
// tile of a drawn column counts. Each meshed column (VoxelScene.chunks, a new group on every install) is indexed once with a byte search
// of its block array and re-indexed only when the column is remeshed; the vertex shader then drops cells 64 or more blocks away.
// GLSL is kept to GLSL ES 1.00 with three.js supplying the precision and the WebGL 2 defines: no loops, no uniform arrays (the 16 layers are
// literal constants), no texture reads under a condition.
// 1.7.10 has no end gateway and the end portal frame (render type 26) is a RenderBlocks block, not drawn here.
import * as THREE from "three";
import { pixelTexture } from "./first-person.js";
import { JavaRandom } from "./java-random.js";
import { END_PORTAL } from "./eye-of-ender.js";
import { FOG_PARS } from "./light-material.js";

const f = Math.fround, PLANE = 0.75, MAX_DISTANCE_SQ = 4096, BACK_OFF = 0.1;

// The 16 passes as bmt draws them: texture, depth (f14), texture scale (f15), shade (f16), rotation in degrees, vertex colour bytes.
export const END_PORTAL_LAYERS = Object.freeze((() => {
  const random = new JavaRandom(31100n), out = [];
  for (let i = 0; i < 16; i++) {
    let depth = 16 - i, scale = f(0.0625), shade = f(1 / f(depth + 1));
    if (i === 0) { shade = f(0.1); depth = 65; scale = f(0.125); }
    if (i === 1) scale = f(0.5);
    let r = f(f(random.nextFloat() * 0.5) + f(0.1)), g = f(f(random.nextFloat() * 0.5) + f(0.4)), b = f(f(random.nextFloat() * 0.5) + f(0.5));
    if (i === 0) r = g = b = 1;
    const colour = [r, g, b].map((c) => Math.trunc(f(f(c * shade) * 255)));
    out.push(Object.freeze({ index: i, texture: i === 0 ? "sky" : "portal", depth, scale, shade, rotation: (i * i * 4321 + i * 9) * 2, colour: Object.freeze(colour), blend: i === 0 ? "alpha" : "add" }));
  }
  return out;
})());

// The scroll term: (float) (Minecraft.getSystemTime() % 700000) / 700000f.
export const endPortalScroll = (ms) => f(f(((Math.floor(ms) % 700000) + 700000) % 700000) / f(700000));

// Texture coordinates of pass `layer` at world point `point` (on the portal plane) seen from eye point `eye`, as the GL texgen and texture
// matrix produce them (GL's t, counted from the top row of the image).
export function endPortalUv(layer, eye, point, scroll) {
  const L = END_PORTAL_LAYERS[layer], h = eye[1] - point[1], k = (h + L.depth) / h;
  const s = -(eye[0] + (point[0] - eye[0]) * k) - 0.5, t = -(eye[2] + (point[2] - eye[2]) * k) - 0.5;
  const a = ((L.rotation % 360) * Math.PI) / 180, c = Math.cos(a), n = Math.sin(a);
  return [L.scale * (c * s - n * t + 0.5), L.scale * (n * s + c * t + 0.5) + scroll];
}

// One quad per tile, in the order bmt hands them to the Tessellator: (x, y, z), (x, y, z + 1), (x + 1, y, z + 1), (x + 1, y, z) at y + 0.75.
export const endPortalQuad = (x, y, z) => [[x, y + PLANE, z], [x, y + PLANE, z + 1], [x + 1, y + PLANE, z + 1], [x + 1, y + PLANE, z]];

// One colour-buffer write: clamped to [0, 1], then the nearest 8-bit step (GL's conversion to a normalised fixed-point buffer).
export const framebufferStep = (c) => Math.floor(Math.min(1, Math.max(0, c)) * 255 + 0.5) / 255;

// The pixel the 16 passes leave in the colour buffer, as the shader computes it: `sample(texture, [u, v])` the texel (rgb in [0, 1]) at GL
// texture coordinates, `light` the lightmap texel and `fog(rgb)` the fixed-function fog of one pass.
export function endPortalPixel(eye, point, scroll, sample, light = [1, 1, 1], fog = (c) => c) {
  let sum = [0, 0, 0];
  for (let i = 0; i < 16; i++) {
    const L = END_PORTAL_LAYERS[i], t = sample(L.texture, endPortalUv(i, eye, point, scroll));
    const src = fog([0, 1, 2].map((k) => t[k] * (L.colour[k] / 255) * light[k]));
    sum = src.map((c, k) => framebufferStep(i === 0 ? c : sum[k] + c)); // pass 0 replaces (alpha 1), the rest add
  }
  return sum;
}

// ActiveRenderInfo's object point for the drawn camera: its position plus forward * near (the unprojected viewport centre at winZ 0). In
// first person `look` is the player's { pitch, yaw } (the port's camera angles, YXZ, without the bob or hurt turns): the camera itself
// stands 0.1 behind the eye along that axis, which the port's camera does not do, so the texgen eye backs off here.
export function endPortalEye(camera, look = null, out = new THREE.Vector3()) {
  const fwd = new THREE.Vector3();
  camera.getWorldDirection(fwd);
  camera.getWorldPosition(out).addScaledVector(fwd, camera.near);
  if (look) out.addScaledVector(fwd.set(0, 0, -1).applyEuler(new THREE.Euler(look.pitch, look.yaw, 0, "YXZ")), -BACK_OFF);
  return out;
}

const lit = (x) => { const v = Math.abs(x) < 1e-9 ? 0 : x, t = v.toFixed(9); return t.includes(".") ? t : t + ".0"; };
const vec = (...a) => `vec${a.length}(${a.map(lit).join(",")})`;

// The fragment shader with the 16 layers written out as constants.
export function endPortalFragmentShader() {
  const passes = END_PORTAL_LAYERS.map((L, i) => {
    const a = ((L.rotation % 360) * Math.PI) / 180, uv = `uvOf(d,${lit(L.depth)},${lit(L.scale)},${vec(Math.cos(a), Math.sin(a))})`;
    const src = `applyFog(texture2D(${i === 0 ? "sky" : "portal"},${uv}).rgb*${vec(...L.colour.map((c) => c / 255))}*light)`;
    return i === 0 ? `vec3 sum=fb(${src});` : `sum=fb(sum+${src});`;
  });
  return `uniform sampler2D sky,portal,lightmap;uniform vec3 eye;uniform float scroll;
varying vec3 vWorld;varying vec2 vLight;${FOG_PARS}
vec3 fb(vec3 c){return floor(clamp(c,0.,1.)*255.+.5)/255.;}
vec2 uvOf(vec3 d,float depth,float scale,vec2 cs){float h=-d.y;float k=(h+depth)/h;vec2 a=-(eye.xz+d.xz*k)-.5;vec2 r=vec2(cs.x*a.x-cs.y*a.y,cs.y*a.x+cs.x*a.y)+.5;vec2 uv=scale*r+vec2(0.,scroll);return vec2(uv.x,1.-uv.y);}
void main(){vec3 d=vWorld-eye;vec3 light=texture2D(lightmap,vLight).rgb;
${passes.join("\n")}
gl_FragColor=vec4(sum,1.);}`;
}

export const END_PORTAL_VERTEX_SHADER = `attribute vec3 centre;attribute vec2 lightCoord;uniform vec3 entity;varying vec3 vWorld;varying vec2 vLight;varying float vFogDistance;
void main(){vec3 d=centre-entity;vWorld=(modelMatrix*vec4(position,1.)).xyz;vLight=(lightCoord+8.)/256.;vec4 mv=modelViewMatrix*vec4(position,1.);vFogDistance=length(mv.xyz);
gl_Position=dot(d,d)<${MAX_DISTANCE_SQ}.?projectionMatrix*mv:vec4(2.,2.,2.,1.);}`;

export function endPortalMaterial(lighting, sky, portal) {
  const uniforms = {
    lightmap: lighting.uniforms.lightmap,
    fogColor: lighting.uniforms.fogColor, fogNear: lighting.uniforms.fogNear, fogFar: lighting.uniforms.fogFar, fogDensity: lighting.uniforms.fogDensity,
    sky: { value: sky }, portal: { value: portal },
    eye: { value: new THREE.Vector3() }, entity: { value: new THREE.Vector3() }, scroll: { value: 0 },
  };
  return new THREE.ShaderMaterial({ uniforms, vertexShader: END_PORTAL_VERTEX_SHADER, fragmentShader: endPortalFragmentShader(), depthFunc: THREE.LessEqualDepth });
}

// The end portal cells of one chunk column ({ x, z, blocks } in chunk coordinates, cells at ((lx * 16 + lz) * height + y)), by byte search.
export function portalCellsOfChunk(chunk) {
  const out = [], b = chunk.blocks, height = chunk.height ?? b.length / 256;
  for (let i = b.indexOf(END_PORTAL); i >= 0; i = b.indexOf(END_PORTAL, i + 1)) {
    const col = Math.floor(i / height);
    out.push([chunk.x * 16 + (col >> 4), i % height, chunk.z * 16 + (col & 15)]);
  }
  return out;
}

// The portal tiles of the drawn columns. `meshed` is VoxelScene.chunks (column key `${x},${z}` in blocks -> the installed group); without it
// (a view with no column meshes) every resident chunk is indexed once per chunk object. A column is re-indexed when its group or chunk object
// changes; `update` returns whether the cell list or a brightness changed.
export class EndPortalIndex {
  constructor() { this.columns = new Map(); this.cells = new Map(); }
  update(world, meshed, brightness) {
    const seen = new Set();
    let changed = false;
    const visit = (key, stamp, chunkOf) => {
      let col = this.columns.get(key);
      if (!col || col.stamp !== stamp) {
        const chunk = chunkOf();
        if (!chunk?.blocks) return;
        col = { stamp, cells: portalCellsOfChunk(chunk) };
        this.columns.set(key, col);
      }
      seen.add(key);
      for (const [x, y, z] of col.cells) {
        const k = `${x},${y},${z}`, packed = brightness(x, y, z), was = this.cells.get(k);
        if (!was) { this.cells.set(k, { x, y, z, packed, seen: true }); changed = true; }
        else { was.seen = true; if (was.packed !== packed) { was.packed = packed; changed = true; } }
      }
    };
    if (meshed instanceof Map && typeof world.chunkAt === "function") {
      for (const [key, group] of meshed) visit(key, group, () => { const [bx, bz] = key.split(",").map(Number); return world.chunkAt(bx >> 4, bz >> 4); });
    } else if (world.chunks instanceof Map) for (const [key, chunk] of world.chunks) visit(key, chunk, () => chunk);
    for (const key of this.columns.keys()) if (!seen.has(key)) this.columns.delete(key);
    for (const [k, c] of this.cells) { if (c.seen) c.seen = false; else { this.cells.delete(k); changed = true; } }
    return changed;
  }
}

export class EndPortalRenderer {
  // `view` supplies the lightmap, fog, world brightness and the meshed columns (VoxelScene).
  constructor(scene, view) {
    this.scene = scene;
    this.view = view;
    this.index = new EndPortalIndex();
    const tex = (url) => { const t = pixelTexture(url).clone(); t.needsUpdate = true; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; return t; };
    this.material = endPortalMaterial(view.lighting, tex("/media/1.7.10/environment/end_sky.png"), tex("/media/1.7.10/entity/end_portal.png"));
    this.geometry = new THREE.BufferGeometry();
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
    this.mesh.visible = false;
    scene.add(this.mesh);
  }
  get cells() { return this.index.cells; }
  // `position` is the player's feet; the cull distance is measured from the camera entity (feet + eye height). `look` is the player's
  // { pitch, yaw } in first person (awake), null in third person or asleep: see endPortalEye.
  update(world, position, camera, eyeHeight = 1.62, look = null) {
    const meshedWorld = this.view.world?.chunkAt ? this.view.world : world; // the world the column meshes were built from
    if (this.index.update(meshedWorld, this.view.chunks, (x, y, z) => this.view.brightness(x, y, z))) this.rebuild();
    if (!camera) return;
    const u = this.material.uniforms;
    endPortalEye(camera, look, u.eye.value);
    u.entity.value.set(position.x, position.y + eyeHeight, position.z);
    u.scroll.value = endPortalScroll(Date.now()); // LWJGL Sys.getTime: System.currentTimeMillis on macOS and Linux
  }
  rebuild() {
    const n = this.cells.size, pos = new Float32Array(n * 12), centre = new Float32Array(n * 12), light = new Float32Array(n * 8), index = [];
    let i = 0;
    for (const { x, y, z, packed } of this.cells.values()) {
      endPortalQuad(x, y, z).forEach((v, j) => {
        pos.set(v, (i * 4 + j) * 3);
        centre.set([x + 0.5, y + 0.5, z + 0.5], (i * 4 + j) * 3);
        light.set([packed & 0xffff, (packed >> 16) & 0xffff], (i * 4 + j) * 2);
      });
      index.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3);
      i++;
    }
    this.geometry.dispose();
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    this.geometry.setAttribute("centre", new THREE.BufferAttribute(centre, 3));
    this.geometry.setAttribute("lightCoord", new THREE.BufferAttribute(light, 2));
    this.geometry.setIndex(index);
    this.mesh.geometry = this.geometry;
    this.mesh.visible = n > 0;
  }
}
