import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { worldMaterial, entityMaterial } from "./light-material.js";

// With MSAA an edge pixel is shaded at its centre even outside the triangle; plain interpolation
// then extrapolates the UV into the next atlas tile and draws lines along block edges at range
// (883 such pixels on a flat emerald floor in the browser check, none with centroid).
test("terrain and entity UVs use centroid interpolation", () => {
  const lighting = { uniforms: { lightmap: { value: null }, fogColor: { value: new THREE.Vector3() }, fogNear: { value: 0 }, fogFar: { value: 1 }, fogDensity: { value: 0 } } };
  for (const m of [worldMaterial(lighting, {}), entityMaterial(lighting, {})]) {
    assert.match(m.vertexShader, /centroid varying vec2 vUv;/);
    assert.match(m.fragmentShader, /centroid varying vec2 vUv;/);
  }
});

// three.js always creates an alpha: true context, so an opaque-pass fragment's alpha reaches the page.
// Mipmapped leaves have 96-254 alphas that pass the 0.1 alpha test; writing them let the page show through
// the canopy as silvery speckles. 1.7.10 renders into an opaque window: a texel that passes is opaque.
test("cutout materials write opaque alpha; only blended ones keep the texel alpha", () => {
  const lighting = { uniforms: { lightmap: { value: null }, fogColor: { value: new THREE.Vector3() }, fogNear: { value: 0 }, fogFar: { value: 1 }, fogDensity: { value: 0 } } };
  for (const make of [worldMaterial, entityMaterial]) {
    const cutout = make(lighting, { map: new THREE.Texture() }), blended = make(lighting, { map: new THREE.Texture(), transparent: true });
    assert.match(cutout.fragmentShader, /if\(t\.a<=alphaTest\)discard;/);
    assert.match(cutout.fragmentShader, /gl_FragColor=vec4\(applyFog\([^;]*\),1\.\);/);
    assert.doesNotMatch(cutout.fragmentShader, /,t\.a\);/);
    assert.match(blended.fragmentShader, /,t\.a\);/);
    assert.equal(blended.transparent, true);
  }
  assert.match(worldMaterial(lighting, { vertexAlpha: true }).fragmentShader, /vShade\.a\)[^]*,1\.\);/);
});
