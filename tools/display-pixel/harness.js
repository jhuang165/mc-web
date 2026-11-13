// Batch 57 (b57dp) browser harness: renders one flat quad per case with the port's real entityMaterial (the display, drop, item frame and held-item material), the real lightmap texture
// (createLighting) and display-light.js shadeDisplay, then reads the centre pixel. tools/verify-display-pixel-render.mjs drives it in headless Chrome (audio muted) and records the
// result in public/research/display-pixel-render.json; src/display-pixel-b57.test.js compares it with the native formulas.
import * as THREE from "three";
import { createLighting, entityMaterial, ITEM_LIGHTS } from "/src/light-material.js";
import { shadeDisplay } from "/src/display-light.js";

const SIZE = 8;
const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, alpha: false });
renderer.setSize(SIZE, SIZE, false);
renderer.setPixelRatio(1);
renderer.setClearColor(0x000000, 1);
document.body.appendChild(renderer.domElement);
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
camera.position.z = 2;
camera.updateMatrixWorld(true);
const lighting = createLighting();

function quad(normal) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
  g.setAttribute("normal", new THREE.Float32BufferAttribute([...normal, ...normal, ...normal, ...normal], 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  return g;
}

// case: { texel: [r, g, b] 0..255, packed: block | sky << 16 (the lightmap coordinates, 16 per light level), brightness: the glColor multiplier shadeDisplay applies (1 = none),
//         tint: [r, g, b] base tint (default white), normal: [x, y, z] in the space of the lights, view: null (world-fixed lights) or { pitch, yaw } three camera angles (held item),
//         lightmap: [sun, flicker, gamma] of lighting.update }
window.__measure = (cases) => cases.map((c) => {
  if (c.lightmap) lighting.update(c.lightmap[0], c.lightmap[1], c.lightmap[2]);
  const tex = new THREE.DataTexture(new Uint8Array([...c.texel, 255]), 1, 1, THREE.RGBAFormat);
  tex.magFilter = tex.minFilter = THREE.NearestFilter; tex.needsUpdate = true;
  let lights = ITEM_LIGHTS;
  if (c.view) {
    const cam = new THREE.PerspectiveCamera();
    cam.rotation.set(c.view.pitch, c.view.yaw, 0, "YXZ");
    cam.updateMatrixWorld(true);
    lights = ITEM_LIGHTS.map((l) => l.clone().transformDirection(cam.matrixWorldInverse)); // FirstPerson.render
  }
  const material = entityMaterial(lighting, { map: tex, fog: false, lights, ...(c.tint ? { color: c.tint } : {}) });
  material.setLight(c.packed);
  if (c.brightness !== undefined && c.brightness !== 1) shadeDisplay(material, c.brightness);
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(quad(c.normal), material));
  renderer.clear();
  renderer.render(scene, camera);
  const gl = renderer.getContext(), px = new Uint8Array(4);
  gl.readPixels(SIZE >> 1, SIZE >> 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  material.dispose(); tex.dispose();
  return { ...c, pixel: [px[0], px[1], px[2]], lightmapRgb: [...lighting.data.slice(((c.packed >> 20) * 16 + ((c.packed & 0xffff) >> 4)) * 4, ((c.packed >> 20) * 16 + ((c.packed & 0xffff) >> 4)) * 4 + 3)] };
});
window.__ready = true;
