// Per-dimension rendering state (WorldProvider facts, dimensions.js): the light brightness table, the sky mode, the fog colour,
// the fixed celestial angle. Pure functions plus two small appliers used by scene.js.
import * as THREE from "three";
import { BRIGHTNESS } from "./lighting.js";
import { lightBrightnessTable, endFogColor, providerOf, NETHER, END } from "./dimensions.js";

const OVERWORLD_TABLE = BRIGHTNESS.slice();
// WorldProvider.lightBrightnessTable: BRIGHTNESS is a shared const array (ai, mobs and shadows read it), so it is rewritten in place.
export function setBrightnessTable(dimension = 0) {
  const t = dimension ? lightBrightnessTable(providerOf(dimension).ambient) : OVERWORLD_TABLE;
  for (let i = 0; i < 16; i++) BRIGHTNESS[i] = t[i];
}
// WorldProvider.calculateCelestialAngle: Hell 0.5 and the End 0.0 whatever the time; null leaves the world time in charge.
export const fixedAngle = (dimension = 0) => providerOf(dimension).fixedAngle;
// WorldProvider.getFogColor for the dimensions that replace the Overworld's (null: keep providerFogColor).
export function providerFog(dimension = 0, angle = 0) {
  if (dimension === NETHER) return providerOf(NETHER).fog.slice(); // (0.2, 0.03, 0.03)
  if (dimension === END) return endFogColor(angle);
  return null;
}
// RenderGlobal.renderSky/renderClouds: Hell draws no sky and no clouds, the End draws end_sky.png six times (radius 100, UV 0..16,
// colour 0x282828), no sun/moon/stars; clouds are drawn only where provider.isSurfaceWorld (the Overworld).
export function applyDimensionRender(scene, world) {
  const d = world?.dimension ?? 0;
  scene.dimension = d;
  setBrightnessTable(d);
  scene.clouds.mesh.visible = scene.clouds.depth.visible = d === 0;
  scene.sky.setDimension?.(d);
}
const f = Math.fround;
export const endSkyColor = [f(0x28 / 255), f(0x28 / 255), f(0x28 / 255)];
export function buildEndSky(texture) {
  const group = new THREE.Group();
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  const g = new THREE.BufferGeometry(), s = 100;
  g.setAttribute("position", new THREE.Float32BufferAttribute([-s, -s, -s, s, -s, -s, s, -s, s, -s, -s, s], 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 16, 0, 16, 16, 0, 16], 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  const material = new THREE.MeshBasicMaterial({ map: texture, color: 0x282828, side: THREE.DoubleSide, depthTest: false, depthWrite: false, fog: false });
  // RenderGlobal.renderSky: face i is rotated (none, 90 x, -90 x, 180 x, 90 z, -90 z) before its quad at y = -100.
  const rotations = [[0, 0, 0], [Math.PI / 2, 0, 0], [-Math.PI / 2, 0, 0], [Math.PI, 0, 0], [0, 0, Math.PI / 2], [0, 0, -Math.PI / 2]];
  for (const r of rotations) { const m = new THREE.Mesh(g, material); m.rotation.set(...r); m.renderOrder = 1; group.add(m); }
  return group;
}
