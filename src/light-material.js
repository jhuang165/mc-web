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
    update(sun, flicker, gamma) {
      lightmap(sun, flicker, gamma, data);
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

const FOG_PARS = `uniform vec3 fogColor;uniform float fogNear,fogFar,fogDensity;varying float vFogDistance;
vec3 applyFog(vec3 c){float f=fogDensity>0.?1.-exp(-fogDensity*vFogDistance):clamp((vFogDistance-fogNear)/(fogFar-fogNear),0.,1.);return mix(c,fogColor,f);}`;

// Chunk geometry: attributes `shade` (face shade x AO) and `lightCoord`
// (packed block and sky brightness, 0-240 each).
export function worldMaterial(lighting, { map, alphaTest = 0.1, transparent = false, uvTransform = new THREE.Vector4(1, 1, 0, 0), side = THREE.FrontSide } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { ...lighting.uniforms, map: { value: map }, alphaTest: { value: alphaTest }, uvTransform: { value: uvTransform } },
    vertexShader: `attribute vec3 shade;attribute vec2 lightCoord;uniform vec4 uvTransform;varying vec2 vUv;varying vec3 vShade;varying vec2 vLight;varying float vFogDistance;
void main(){vUv=uv*uvTransform.xy+uvTransform.zw;vShade=shade;vLight=(lightCoord+8.)/256.;vec4 mv=modelViewMatrix*vec4(position,1.);vFogDistance=length(mv.xyz);gl_Position=projectionMatrix*mv;}`,
    fragmentShader: `uniform sampler2D map,lightmap;uniform float alphaTest;varying vec2 vUv;varying vec3 vShade;varying vec2 vLight;${FOG_PARS}
void main(){vec4 t=texture2D(map,vUv);if(t.a<=alphaTest)discard;gl_FragColor=vec4(applyFog(t.rgb*vShade*texture2D(lightmap,vLight).rgb),t.a);}`,
    transparent,
    side,
  });
}

// Entities, tile entities and held items. `lightCoord` is per material (the
// entity's brightness); `lights` are the item-light directions in the space
// of modelMatrix (world space, or view space for the first-person scene).
export function entityMaterial(lighting, { map = null, color = null, alphaTest = 0.1, transparent = false, side = THREE.FrontSide, fog = true, lights = ITEM_LIGHTS } = {}) {
  const uniforms = {
    lightmap: lighting.uniforms.lightmap,
    ...(fog ? lighting.uniforms : { fogColor: { value: new THREE.Vector3() }, fogNear: { value: 1e6 }, fogFar: { value: 2e6 }, fogDensity: { value: 0 } }),
    map: { value: map },
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
    vertexShader: `uniform vec3 light0,light1;varying vec2 vUv;varying float vDiffuse;varying float vFogDistance;
void main(){vUv=uv;vec3 n=normalize(mat3(modelMatrix)*normal);vDiffuse=min(1.,.4+.6*(max(0.,dot(n,light0))+max(0.,dot(n,light1))));vec4 mv=modelViewMatrix*vec4(position,1.);vFogDistance=length(mv.xyz);gl_Position=projectionMatrix*mv;}`,
    fragmentShader: `uniform sampler2D map,lightmap;uniform vec3 tint;uniform vec4 overlay;uniform vec2 lightCoord;uniform float alphaTest;varying vec2 vUv;varying float vDiffuse;${FOG_PARS}
void main(){vec4 t=vec4(1.);
#ifdef USE_TEXTURE
t=texture2D(map,vUv);
#endif
if(t.a<=alphaTest)discard;vec3 c=t.rgb*tint*vDiffuse*texture2D(lightmap,(lightCoord+8.)/256.).rgb;c=mix(c,overlay.rgb,overlay.a);gl_FragColor=vec4(applyFog(c),t.a);}`,
    transparent,
    side,
  });
  material.setLight = (packed) => material.uniforms.lightCoord.value.set(packed & 0xffff, (packed >> 16) & 0xffff);
  return material;
}
