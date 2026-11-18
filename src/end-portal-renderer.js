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
// The 16 blended passes collapse into one opaque pass: end_sky.png and end_portal.png are fully opaque, so pass 0 replaces the framebuffer
// and the additive passes sum on top (clamped once at the end instead of per pass; at most a 1/255 step of rounding apart). Each pass is
// modulated by the lightmap at the tile's own brightness (TileEntityRendererDispatcher sets it; the entity pass keeps the lightmap unit on)
// and fogged on its own before blending, as fixed-function fog is applied per fragment.
// 1.7.10 has no end gateway and the end portal frame (render type 26) is a RenderBlocks block, not drawn here.
import * as THREE from "three";
import { pixelTexture } from "./first-person.js";
import { JavaRandom } from "./java-random.js";
import { END_PORTAL } from "./eye-of-ender.js";
import { FOG_PARS } from "./light-material.js";

const f = Math.fround, RADIUS = 20, HEIGHT = 12, PLANE = 0.75, MAX_DISTANCE_SQ = 4096;

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

const layerConsts = () => END_PORTAL_LAYERS.map((L) => {
  const a = ((L.rotation % 360) * Math.PI) / 180;
  return { depth: L.depth, scale: L.scale, cos: Math.cos(a), sin: Math.sin(a), colour: new THREE.Vector3(...L.colour.map((c) => c / 255)) };
});

export function endPortalMaterial(lighting, sky, portal) {
  const uniforms = {
    lightmap: lighting.uniforms.lightmap,
    fogColor: lighting.uniforms.fogColor, fogNear: lighting.uniforms.fogNear, fogFar: lighting.uniforms.fogFar, fogDensity: lighting.uniforms.fogDensity,
    sky: { value: sky }, portal: { value: portal },
    eye: { value: new THREE.Vector3() }, entity: { value: new THREE.Vector3() }, scroll: { value: 0 },
    depth: { value: END_PORTAL_LAYERS.map((L) => L.depth) },
    scale: { value: END_PORTAL_LAYERS.map((L) => L.scale) },
    rot: { value: layerConsts().map((l) => new THREE.Vector2(l.cos, l.sin)) },
    colour: { value: layerConsts().map((l) => l.colour) },
  };
  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `attribute vec3 centre;attribute vec2 lightCoord;uniform vec3 entity;varying vec3 vWorld;varying vec2 vLight;varying float vFogDistance;
void main(){vec3 d=centre-entity;vWorld=(modelMatrix*vec4(position,1.)).xyz;vLight=(lightCoord+8.)/256.;vec4 mv=modelViewMatrix*vec4(position,1.);vFogDistance=length(mv.xyz);
gl_Position=dot(d,d)<${MAX_DISTANCE_SQ}.?projectionMatrix*mv:vec4(2.,2.,2.,1.);}`,
    fragmentShader: `precision highp float;uniform sampler2D sky,portal,lightmap;uniform vec3 eye;uniform float scroll;uniform float depth[16];uniform float scale[16];uniform vec2 rot[16];uniform vec3 colour[16];
varying vec3 vWorld;varying vec2 vLight;${FOG_PARS}
void main(){vec3 d=vWorld-eye;float h=-d.y;vec3 light=texture2D(lightmap,vLight).rgb,sum=vec3(0.);
for(int i=0;i<16;i++){float k=(h+depth[i])/h;vec2 a=-(eye.xz+d.xz*k)-.5;vec2 r=vec2(rot[i].x*a.x-rot[i].y*a.y,rot[i].y*a.x+rot[i].x*a.y)+.5;vec2 uv=scale[i]*r+vec2(0.,scroll);
vec3 t=i==0?texture2D(sky,vec2(uv.x,1.-uv.y)).rgb:texture2D(portal,vec2(uv.x,1.-uv.y)).rgb;sum+=applyFog(t*colour[i]*light);}
gl_FragColor=vec4(min(sum,vec3(1.)),1.);}`,
    depthFunc: THREE.LessEqualDepth,
  });
}

export class EndPortalRenderer {
  // `view` supplies the lightmap, fog and world brightness (VoxelScene).
  constructor(scene, view) {
    this.scene = scene;
    this.view = view;
    this.cells = new Map();
    this.frame = 0;
    this.dirty = false;
    const tex = (url) => { const t = pixelTexture(url).clone(); t.needsUpdate = true; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; return t; };
    this.material = endPortalMaterial(view.lighting, tex("/media/1.7.10/environment/end_sky.png"), tex("/media/1.7.10/entity/end_portal.png"));
    this.geometry = new THREE.BufferGeometry();
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
    this.mesh.visible = false;
    scene.add(this.mesh);
  }
  // `position` is the player's feet (the scan centre); the eye point is ActiveRenderInfo's unprojected near-plane centre of the camera as drawn
  // (camera position + forward * near) and the cull distance is measured from the camera entity (feet + eye height).
  update(world, position, camera, eyeHeight = 1.62) {
    if (this.frame++ % 10 === 0) this.scan(world, position);
    if (!camera) return;
    const u = this.material.uniforms, fwd = new THREE.Vector3();
    camera.getWorldDirection(fwd);
    camera.getWorldPosition(u.eye.value).addScaledVector(fwd, camera.near);
    u.entity.value.set(position.x, position.y + eyeHeight, position.z);
    u.scroll.value = endPortalScroll(Date.now()); // LWJGL Sys.getTime: System.currentTimeMillis on macOS and Linux
  }
  scan(world, position) {
    const px = Math.floor(position.x), py = Math.floor(position.y), pz = Math.floor(position.z), seen = new Set();
    for (let x = px - RADIUS; x <= px + RADIUS; x++) for (let z = pz - RADIUS; z <= pz + RADIUS; z++)
      for (let y = Math.max(0, py - HEIGHT); y <= py + HEIGHT; y++) {
        if (world.get(x, y, z) !== END_PORTAL) continue;
        const key = `${x},${y},${z}`, packed = this.view.brightness(x, y, z), was = this.cells.get(key);
        seen.add(key);
        if (was?.packed !== packed) { this.cells.set(key, { x, y, z, packed }); this.dirty = true; }
      }
    for (const key of this.cells.keys()) if (!seen.has(key)) { this.cells.delete(key); this.dirty = true; }
    if (this.dirty) this.rebuild();
  }
  rebuild() {
    this.dirty = false;
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
