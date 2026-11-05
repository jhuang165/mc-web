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
