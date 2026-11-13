// Shaders for the 1.7.10 fixed-function look. Blocks multiply texture, vertex
// shade x ambient occlusion and the lightmap texel at (block, sky) light;
// entities add RenderHelper.enableStandardItemLighting's two directional
// lights. Colours stay in the game's own (non-linear) space, as in OpenGL.
import * as THREE from "three";
import { lightmap } from "./lighting.js";

THREE.ColorManagement.enabled = false;

// RenderHelper: lights at (0.2, 1, -0.7) and (-0.2, 1, 0.7), diffuse 0.6,
// with a 0.4 light-model ambient.
export const ITEM_LIGHTS = [new THREE.Vector3(0.2, 1, -0.7).normalize(), new THREE.Vector3(-0.2, 1, 0.7).normalize()];

export function createLighting() {
  const data = new Uint8Array(1024),
    texture = new THREE.DataTexture(data, 16, 16, THREE.RGBAFormat);
  // OpenGlHelper's lightmap unit samples with GL_LINEAR, clamped.
  texture.magFilter = texture.minFilter = THREE.LinearFilter;
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = false;
  const lighting = {
    data,
    texture,
    uniforms: {
      lightmap: { value: texture },
      fogColor: { value: new THREE.Vector3(1, 1, 1) },
      fogNear: { value: 40 },
      fogFar: { value: 160 },
      fogDensity: { value: 0 },
    },
    update(sun, flicker, gamma, flash = false, nightVision = 0, dimension = 0) {
      lightmap(sun, flicker, gamma, data, flash, nightVision, dimension);
      texture.needsUpdate = true;
    },
    // CPU lookup of the lightmap for a packed brightness, as 0-1 RGB.
    rgb(packed) {
      const block = Math.min(15, (packed & 0xffff) >> 4), sky = Math.min(15, ((packed >> 16) & 0xffff) >> 4), i = (sky * 16 + block) * 4;
      return [data[i] / 255, data[i + 1] / 255, data[i + 2] / 255];
    },
  };
  lighting.update(1, 0, 0);
  return lighting;
}

// The uv window of an item atlas sprite texture (item-atlas.js sets userData.st), identity for every other texture; written into `out` (a Vector4: scale u, v, offset u, v).
export function applySpriteTransform(texture, out) {
  const st = texture?.userData?.st;
  return st ? out.copy(st) : out.set(1, 1, 0, 0);
}

export const FOG_PARS = `uniform vec3 fogColor;uniform float fogNear,fogFar,fogDensity;varying float vFogDistance;
vec3 applyFog(vec3 c){float f=fogDensity>0.?1.-exp(-fogDensity*vFogDistance):clamp((vFogDistance-fogNear)/(fogFar-fogNear),0.,1.);return mix(c,fogColor,f);}`;

// `centroid` (GLSL ES 3.00, which three.js compiles these to): with MSAA a pixel on a face edge is
// shaded at its centre even when that lies outside the triangle, and the extrapolated UV then
// reads the neighbouring atlas tile, drawing a line along block edges at range.
// Centroid sampling keeps the UV inside the covered part of the face, so it stays inside the tile.
// Chunk geometry: attributes `shade` (face shade x AO) and `lightCoord`
// (packed block and sky brightness, 0-240 each).
// three.js always creates its context with alpha: true (its `alpha: false` only sets the clear alpha), so
// whatever alpha a fragment writes reaches the page compositor. 1.7.10 draws into an opaque window: a cutout
// texel that passes glAlphaFunc(GL_GREATER, 0.1) is fully opaque. Non-blended materials therefore write 1;
// otherwise the 96-254 alphas of mipmapped leaves and plants let the page show through as pale speckles.
// Only blended (`transparent`) materials keep the texel alpha, and three.js keeps destination alpha at 1 there.
// `vertexAlpha` makes `shade` a vec4 whose alpha multiplies the texel's before the
// alpha test (EntityFX colour alpha under glAlphaFunc).
export function worldMaterial(lighting, { map, alphaTest = 0.1, transparent = false, uvTransform = new THREE.Vector4(1, 1, 0, 0), side = THREE.FrontSide, vertexAlpha = false } = {}) {
  const S = vertexAlpha ? "vec4" : "vec3";
  return new THREE.ShaderMaterial({
    uniforms: { ...lighting.uniforms, map: { value: map }, alphaTest: { value: alphaTest }, uvTransform: { value: uvTransform } },
    vertexShader: `attribute ${S} shade;attribute vec2 lightCoord;uniform vec4 uvTransform;centroid varying vec2 vUv;varying ${S} vShade;varying vec2 vLight;varying float vFogDistance;
void main(){vUv=uv*uvTransform.xy+uvTransform.zw;vShade=shade;vLight=(lightCoord+8.)/256.;vec4 mv=modelViewMatrix*vec4(position,1.);vFogDistance=length(mv.xyz);gl_Position=projectionMatrix*mv;}`,
    fragmentShader: `uniform sampler2D map,lightmap;uniform float alphaTest;centroid varying vec2 vUv;varying ${S} vShade;varying vec2 vLight;${FOG_PARS}
void main(){vec4 t=texture2D(map,vUv)${vertexAlpha ? "*vec4(1.,1.,1.,vShade.a)" : ""};if(t.a<=alphaTest)discard;gl_FragColor=vec4(applyFog(t.rgb*vShade.rgb*texture2D(lightmap,vLight).rgb),${transparent ? "t.a" : "1."});}`,
    transparent,
    side,
  });
}

// Batch 57 (b57dp): fixed-function lighting with glColorMaterial(AMBIENT_AND_DIFFUSE) gives the vertex colour C * (0.4 + 0.6 * sum of the lights' N.L) clamped to 1 AFTER the glColor C
// is multiplied in (executed RenderHelper calls: display-pixel-reference.json), so a tinted face lit above 1 reads min(1, C * lit), not C * min(1, lit). `vDiffuse` is the unclamped
// factor (at most 1.37, capped at 2 so the unlit replacements in hanging-renderer.js and player-renderer.js still match) and the fragment clamps it with the tint.
// Entities, tile entities and held items. `lightCoord` is per material (the
// entity's brightness); `lights` are the item-light directions in the space
// of modelMatrix (world space, or view space for the first-person scene).
export function entityMaterial(lighting, { map = null, color = null, alphaTest = 0.1, transparent = false, side = THREE.FrontSide, fog = true, lights = ITEM_LIGHTS } = {}) {
  const uniforms = {
    lightmap: lighting.uniforms.lightmap,
    ...(fog ? lighting.uniforms : { fogColor: { value: new THREE.Vector3() }, fogNear: { value: 1e6 }, fogFar: { value: 2e6 }, fogDensity: { value: 0 } }),
    map: { value: map },
    mapST: { value: applySpriteTransform(map, new THREE.Vector4()) },
    tint: { value: new THREE.Vector3(...(color ?? [1, 1, 1])) },
    overlay: { value: new THREE.Vector4(0, 0, 0, 0) },
    lightCoord: { value: new THREE.Vector2(0, 240) },
    light0: { value: lights[0] },
    light1: { value: lights[1] },
    alphaTest: { value: alphaTest },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    defines: map ? { USE_TEXTURE: "" } : {},
    vertexShader: `uniform vec3 light0,light1;uniform vec4 mapST;centroid varying vec2 vUv;varying float vDiffuse;varying float vFogDistance;
void main(){vUv=uv*mapST.xy+mapST.zw;vec3 n=normalize(mat3(modelMatrix)*normal);vDiffuse=min(2.,.4+.6*(max(0.,dot(n,light0))+max(0.,dot(n,light1))));vec4 mv=modelViewMatrix*vec4(position,1.);vFogDistance=length(mv.xyz);gl_Position=projectionMatrix*mv;}`,
    fragmentShader: `uniform sampler2D map,lightmap;uniform vec3 tint;uniform vec4 overlay;uniform vec2 lightCoord;uniform float alphaTest;centroid varying vec2 vUv;varying float vDiffuse;${FOG_PARS}
void main(){vec4 t=vec4(1.);
#ifdef USE_TEXTURE
t=texture2D(map,vUv);
#endif
if(t.a<=alphaTest)discard;vec3 c=t.rgb*min(vec3(1.),tint*vDiffuse)*texture2D(lightmap,(lightCoord+8.)/256.).rgb;c=mix(c,overlay.rgb,overlay.a);gl_FragColor=vec4(applyFog(c),${transparent ? "t.a" : "1."});}`,
    transparent,
    side,
  });
  // Item sprites are cells of the item atlas (item-atlas.js): whoever assigns uniforms.map.value (an item frame swapping its content) moves the uv window with it.
  let current = map;
  Object.defineProperty(uniforms.map, "value", { get: () => current, set: (v) => { current = v; applySpriteTransform(v, uniforms.mapST.value); }, enumerable: true, configurable: true });
  material.setLight = (packed) => material.uniforms.lightCoord.value.set(packed & 0xffff, (packed >> 16) & 0xffff);
  return material;
}
