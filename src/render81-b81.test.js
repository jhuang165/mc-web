// Batch 81 render81: the end portal shader (per-pass framebuffer writes, constant layers, GLSL ES 1.00 structure), the first-person 0.1
// back-off of its eye point, the column index that replaces the 20 x 12 scan, the wither's pitch reaching its skulls and the skull's
// Rotation through import, save and load.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as THREE from "three";
import {
  END_PORTAL_LAYERS, endPortalUv, endPortalPixel, framebufferStep, endPortalFragmentShader, END_PORTAL_VERTEX_SHADER, endPortalMaterial, endPortalEye,
  EndPortalIndex, portalCellsOfChunk,
} from "./end-portal-renderer.js";
import { tokenize, parseShader, runShader } from "./glsl-mini.js";
import { END_PORTAL } from "./eye-of-ender.js";
import { WorldChunk } from "./world.js";
import { EntityWorld } from "./entities.js";
import { Survival } from "./survival.js";
import { mobPose } from "./entities.js";
import { witherPose } from "./wither-boss.js";
import { WitherSkulls } from "./wither-boss-mobs.js";
import { javaProjectileFromNbt, javaProjectileToNbt } from "./java-projectiles.js";
import { decodeNbt, NBT } from "./nbt.js";

const rnd = (() => { let s = 12345; return () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648); })();
// A 16 x 16 opaque texture, nearest filtering and repeat wrap; `glT` counts rows from the top of the image (GL's t as bmt uses it).
const image = (seed) => Array.from({ length: 256 }, (_, i) => [0, 1, 2].map((k) => ((i * 37 + k * 101 + seed * 13) % 256) / 255));
const IMG = { sky: image(1), portal: image(2) };
const texel = (img, u, glT) => { const m = (v) => ((Math.floor(v * 16) % 16) + 16) % 16; return img[m(glT) * 16 + m(u)]; };
const lighting = { uniforms: { lightmap: { value: null }, fogColor: { value: new THREE.Color() }, fogNear: { value: 0 }, fogFar: { value: 1 }, fogDensity: { value: 0 } } };

test("the fragment shader is GLSL ES 1.00 without loops, arrays, precision statements or conditional texture reads", () => {
  const src = endPortalFragmentShader();
  for (const s of [src, END_PORTAL_VERTEX_SHADER]) {
    const tokens = tokenize(s); // throws on loops, if, precision, #, bit operators, %, ES 3.00 words, texture()
    assert.ok(tokens.length > 50);
    assert.equal(tokens.filter((t) => t.k === "int").length, 0, "every numeric literal is a float literal");
    let depth = 0;
    for (const t of tokens) { if (t.v === "(" || t.v === "{") depth++; if (t.v === ")" || t.v === "}") depth--; assert.ok(depth >= 0); }
    assert.equal(depth, 0, "balanced brackets");
  }
  const frag = parseShader(src), vert = parseShader(END_PORTAL_VERTEX_SHADER);
  assert.deepEqual(Object.keys(frag.functions).sort(), ["applyFog", "fb", "main", "uvOf"]);
  // The textures are read at the top level of main, one statement per pass; nothing is behind a ternary.
  assert.equal((src.match(/texture2D\(/g) || []).length, 17);
  assert.ok(!/\?[^;]*texture2D/.test(src));
  // Every uniform the shaders declare is in the material (three.js's own matrices aside), and every material uniform is declared.
  const material = endPortalMaterial(lighting, null, null), own = new Set(["modelMatrix", "modelViewMatrix", "projectionMatrix"]);
  const declared = new Set([...frag.globals, ...vert.globals].filter((g) => g.q === "uniform").map((g) => g.name));
  assert.deepEqual([...declared].sort(), Object.keys(material.uniforms).sort());
  assert.ok([...declared].every((n) => !own.has(n)));
  // Varyings match by name and type; the vertex shader writes each.
  const vary = (p) => Object.fromEntries(p.globals.filter((g) => g.q === "varying").map((g) => [g.name, g.type]));
  assert.deepEqual(vary(frag), vary(vert));
  assert.equal(material.uniforms.depth, undefined, "the layers are constants, not uniform arrays");
});

test("the checker refuses what WebGL1 or a mediump-only GPU could reject", () => {
  const ok = "uniform vec3 eye;void main(){gl_FragColor=vec4(eye,1.);}";
  assert.doesNotThrow(() => runShader(ok, { eye: [1, 2, 3] }));
  for (const bad of [
    "precision highp float;" + ok, "#version 300 es\n" + ok, "uniform vec3 eye[16];void main(){gl_FragColor=vec4(eye[0],1.);}",
    "uniform vec3 eye;void main(){vec3 s=eye;for(int i=0;i<4;i++){s=s+eye;}gl_FragColor=vec4(s,1.);}",
    "uniform vec3 eye;void main(){if(eye.x>0.){gl_FragColor=vec4(eye,1.);}}", "uniform vec3 eye;void main(){gl_FragColor=vec4(eye,1);}",
    "uniform vec3 eye;void main(){gl_FragColor=vec4(eye.xy,1.);}", "uniform sampler2D t;void main(){gl_FragColor=texture(t,vec2(0.));}",
  ]) assert.throws(() => runShader(bad, { eye: [1, 2, 3], t: () => [0, 0, 0, 1] }), undefined, bad);
});

test("the shader source, run, leaves the pixel of 16 framebuffer passes; each pass is clamped and rounded to 8 bits", () => {
  // Unfogged at full light, texel k/255 times colour c/255 never lands on a rounding tie (2kc is even, 255 times an odd number is odd),
  // so the shader and the replay agree exactly. Fogged and dimmed, a sum within float error of a tie may round the other way and carry.
  const src = endPortalFragmentShader();
  let differsFromOneClamp = 0, ties = 0;
  for (let n = 0; n < 300; n++) {
    const eye = [rnd() * 200 - 100, 64 + rnd() * 30, rnd() * 200 - 100], point = [Math.floor(eye[0] + rnd() * 20 - 10) + rnd(), 60.75, Math.floor(eye[2] + rnd() * 20 - 10) + rnd()];
    const scroll = rnd(), fogged = n % 3 === 0, light = fogged ? [0.9, 0.85, 0.7] : [1, 1, 1], fogColor = [0.6, 0.7, 0.9], dist = 5 + rnd() * 40, fogF = fogged ? Math.min(1, Math.max(0, (dist - 10) / 30)) : 0;
    const fog = (c) => c.map((x, k) => x * (1 - fogF) + fogColor[k] * fogF);
    const seen = [], tex = (name) => (uv) => { seen.push(uv); return [...texel(IMG[name], uv[0], 1 - uv[1]), 1]; };
    const glsl = runShader(src, {
      sky: tex("sky"), portal: tex("portal"), lightmap: () => [...light, 1],
      eye, scroll, vWorld: point, vLight: [0.5, 0.5], fogColor, fogNear: fogged ? 10 : 1e9, fogFar: fogged ? 40 : 2e9, fogDensity: 0, vFogDistance: dist,
    }).outputs.gl_FragColor;
    // The texture coordinates agree with bmt's texgen (endPortalUv) to float precision; GL's t is 1 - the sampler's v.
    assert.equal(seen.length, 16);
    seen.forEach(([u, v], i) => { const [s, t] = endPortalUv(i, eye, point, scroll); assert.ok(Math.abs(u - s) < 1e-6 && Math.abs(1 - v - t) < 1e-6, `uv ${n}/${i}`); });
    // With the same texels the shader's 16 writes are the JS replay's (the shader's colours are 9-digit literals).
    let pass = 0;
    const js = endPortalPixel(eye, point, scroll, (t) => texel(IMG[t], seen[pass][0], 1 - seen[pass++][1]), light, fog);
    const off = Math.max(...js.map((c, k) => Math.abs(c - glsl[k])));
    assert.ok(off < 1e-12 || (fogged && off < 3.5 / 255), `sample ${n}: ${glsl} vs ${js}`);
    if (off >= 1e-12) ties++;
    assert.equal(glsl[3], 1);
    assert.ok(js.every((c) => Number.isInteger(Math.round(c * 255)) && Math.abs(c * 255 - Math.round(c * 255)) < 1e-9), "a colour-buffer value");
    // The old port: sum the 16 sources, clamp once.
    let sum = [0, 0, 0];
    END_PORTAL_LAYERS.forEach((L, i) => { const t = texel(IMG[L.texture], ...endPortalUv(i, eye, point, scroll)); sum = sum.map((s, k) => s + fog([0, 1, 2].map((j) => t[j] * (L.colour[j] / 255) * light[j]))[k]); });
    if (sum.some((s, k) => Math.abs(Math.min(1, s) - js[k]) > 0.5 / 255)) differsFromOneClamp++;
  }
  assert.ok(ties <= 5, `${ties} near-tie samples`);
  assert.ok(differsFromOneClamp > 0, "per-pass rounding is visible against a single clamp");
});

test("the 8-bit writes: pass 0 replaces, later passes saturate at 255", () => {
  assert.equal(framebufferStep(0.5 / 255 - 1e-9), 0);
  assert.equal(framebufferStep(0.5 / 255), 1 / 255);
  assert.equal(framebufferStep(1.7), 1);
  assert.equal(framebufferStep(-0.2), 0);
  const white = endPortalPixel([0.5, 70, 0.5], [0.3, 60.75, 0.6], 0, () => [1, 1, 1]);
  let sum = [0, 0, 0];
  END_PORTAL_LAYERS.forEach((L) => { sum = sum.map((x, k) => Math.min(1, x + L.colour[k] / 255)); });
  assert.deepEqual(white, sum.map(framebufferStep)); // white texels: each pass adds its layer colour
  assert.ok(white.some((c) => c === 1), "a channel saturates at 255 and stays there");
  const black = endPortalPixel([0.5, 70, 0.5], [0.3, 60.75, 0.6], 0, () => [0, 0, 0]);
  assert.deepEqual(black, [0, 0, 0]);
  const skyOnly = endPortalPixel([0.5, 70, 0.5], [0.3, 60.75, 0.6], 0, (t) => (t === "sky" ? [1, 1, 1] : [0, 0, 0]));
  assert.deepEqual(skyOnly, END_PORTAL_LAYERS[0].colour.map((c) => c / 255));
});

test("the vertex shader runs: the 64-block cull from the camera entity and the fog distance", () => {
  const I = new THREE.Matrix4().toArray();
  const run = (centre) => runShader(END_PORTAL_VERTEX_SHADER, { centre, lightCoord: [240, 0], entity: [0, 0, 0], position: [1, 2, 3], modelMatrix: I, modelViewMatrix: I, projectionMatrix: I, vWorld: [0, 0, 0], vLight: [0, 0], vFogDistance: 0 },
    { position: "vec3", modelMatrix: "mat4", modelViewMatrix: "mat4", projectionMatrix: "mat4" }).outputs;
  assert.deepEqual(run([63.9, 0, 0]).gl_Position, [1, 2, 3, 1]);
  assert.deepEqual(run([64, 0, 0]).gl_Position, [2, 2, 2, 1]); // TileEntityRendererDispatcher: distance squared < 4096
  assert.deepEqual(run([0, 0, 0]).vLight, [248 / 256, 8 / 256]);
  assert.equal(run([0, 0, 0]).vFogDistance, Math.hypot(1, 2, 3));
});

// EntityRenderer.orientCamera (first person, awake): glTranslatef(0, 0, -0.1), glRotatef(pitch, 1, 0, 0), glRotatef(yaw + 180, 0, 1, 0);
// gluPerspective(..., 0.05, ...); ActiveRenderInfo unprojects the viewport centre at winZ 0. Native yaw = 180 - port yaw, pitch = -port pitch.
test("the texgen eye is 0.05 ahead of a camera 0.1 behind the eye in first person, and the camera's near point otherwise", () => {
  for (let n = 0; n < 40; n++) {
    const yaw = rnd() * 7 - 3.5, pitch = rnd() * 3 - 1.5, eyeAt = new THREE.Vector3(rnd() * 100, 70 + rnd(), rnd() * 100);
    const cam = new THREE.PerspectiveCamera(70, 1.5, 0.05, 400);
    cam.position.copy(eyeAt); cam.rotation.set(pitch, yaw, 0, "YXZ"); cam.updateMatrixWorld();
    const yawN = 180 - (yaw * 180) / Math.PI, pitchN = (-pitch * 180) / Math.PI, deg = Math.PI / 180;
    const mv = new THREE.Matrix4().makeTranslation(0, 0, -0.1).multiply(new THREE.Matrix4().makeRotationX(pitchN * deg)).multiply(new THREE.Matrix4().makeRotationY((yawN + 180) * deg));
    const native = new THREE.Vector3(0, 0, -0.05).applyMatrix4(mv.clone().invert()).add(eyeAt);
    assert.ok(endPortalEye(cam, { pitch, yaw }).distanceTo(native) < 1e-9, `first person ${n}`);
    const fwd = new THREE.Vector3(); cam.getWorldDirection(fwd);
    assert.ok(endPortalEye(cam, null).distanceTo(eyeAt.clone().addScaledVector(fwd, 0.05)) < 1e-9, `third person ${n}`);
  }
});

const chunkWith = (cx, cz, cells, height = 256) => {
  const c = new WorldChunk(cx, cz, height);
  for (const [x, y, z] of cells) c.blocks[((x & 15) * 16 + (z & 15)) * height + y] = END_PORTAL;
  return c;
};

test("the portal index: every portal tile of the meshed columns, indexed once per column mesh", () => {
  const a = chunkWith(-4, 2, [[-60, 30, 40], [-59, 30, 41], [-49, 255, 47]]), b = chunkWith(3, 3, [[60, 30, 60]]), empty = new WorldChunk(0, 0);
  assert.deepEqual(portalCellsOfChunk(a), [[-60, 30, 40], [-59, 30, 41], [-49, 255, 47]]);
  const chunks = new Map([["-4,2", a], ["3,3", b], ["0,0", empty]]), world = { chunkAt: (x, z) => chunks.get(`${x},${z}`) ?? null };
  const g = { a: {}, b: {}, e: {} }, meshed = new Map([["-64,32", g.a], ["48,48", g.b], ["0,0", g.e]]);
  let light = 15 << 20, scans = 0;
  const idx = new EndPortalIndex(), bright = () => light;
  const realIndexOf = Uint8Array.prototype.indexOf;
  Uint8Array.prototype.indexOf = function (...args) { if (args.length === 1 || args[1] === 0) scans++; return realIndexOf.apply(this, args); };
  try {
    assert.equal(idx.update(world, meshed, bright), true);
    assert.deepEqual([...idx.cells.keys()].sort(), ["-49,255,47", "-59,30,41", "-60,30,40", "60,30,60"]); // 60 blocks out: beyond the old 20 x 12 window
    assert.equal(scans, 3);
    assert.equal(idx.update(world, meshed, bright), false, "nothing changed");
    assert.equal(scans, 3, "no rescan while the meshes stand");
    light = 7 << 20;
    assert.equal(idx.update(world, meshed, bright), true, "a brightness change rebuilds");
    assert.equal(idx.cells.get("60,30,60").packed, 7 << 20);
    b.blocks.fill(0); meshed.set("48,48", {}); // the column is edited and remeshed
    assert.equal(idx.update(world, meshed, bright), true);
    assert.equal(scans, 4, "only the remeshed column is searched again");
    assert.equal(idx.cells.has("60,30,60"), false);
    meshed.delete("-64,32"); // the column leaves the window
    assert.equal(idx.update(world, meshed, bright), true);
    assert.equal(idx.cells.size, 0);
  } finally { Uint8Array.prototype.indexOf = realIndexOf; }
  // A view without column meshes indexes the resident chunks.
  const plain = new EndPortalIndex();
  assert.equal(plain.update({ chunks }, null, bright), true);
  assert.equal(plain.cells.size, 3);
});

test("the scene hands the renderer its meshed columns and main passes the first-person look", () => {
  const scene = readFileSync(new URL("./scene.js", import.meta.url), "utf8"), main = readFileSync(new URL("./main.js", import.meta.url), "utf8");
  assert.match(scene, /this\.chunks = new Map\(\)/);
  assert.match(main, /endPortalRenderer\?\.update\(world, position, scene\.camera, PHYSICS\.eye, thirdPersonView === 0 && !bedSleep\.sleeping \? \{ pitch, yaw \} : null\)/);
});

// The wither's rotationPitch is EntityLookHelper's (xc never writes sv.z; bytecode-read), and EntityFireball's constructor copies it into the skull.
test("the wither aims its head with the look helper's pitch, which its skulls and ModelWither's centre head take", () => {
  const flat = { numericSeed: 1, solid: (x, y, z) => y < 0, get: (x, y, z) => (y < 0 ? 1 : 0), surface: () => 0, spawn: () => ({ x: 64.5, y: 0, z: 64.5 }), set() { return true; } };
  const w = new EntityWorld(flat, [], () => 0.5); w.difficulty = 2; w.isDaytime = () => false;
  const e = w.spawnWither(64.5, 1, 64.5, 0); e.invul = 0;
  const cow = w.create("cow", 64.5, 0, 50.5); cow.noAI = true; w.entities.push(cow);
  const launched = [], launch = w.skulls.launch.bind(w.skulls);
  w.skulls.launch = (o) => { const b = launch(o); launched.push({ owner: o.owner?.rotationPitch, yaw: o.owner?.rotationYaw, b: { yaw: b.yaw, pitch: b.pitch } }); return b; };
  const p = { x: 64.5, y: 0, z: 90.5, alive: true, width: 0.6, height: 1.8, eyeHeight: 1.62 }, s = new Survival({});
  let pitched = false;
  for (let i = 0; i < 120; i++) { w.tick(p, s); w.drain(); if (Math.abs(e.rotationPitch) > 1) pitched = true; }
  assert.ok(pitched, "the wither looks down at the cow");
  assert.ok(launched.some((l) => Math.abs(l.b.pitch) > 1), "a skull starts with the wither's pitch");
  for (const l of launched) assert.deepEqual([l.b.yaw, l.b.pitch], [Math.fround(l.yaw), Math.fround(l.owner)]);
  e.rotationPitch = e.prevRotationPitch = 25;
  const pose = mobPose(e, 0.5);
  assert.equal(pose.headPitch, 25);
  assert.equal(witherPose({ age: 0, headYaw: 0, headPitch: pose.headPitch, bodyYaw: 0 }).head0.rot[0], Math.fround(25 / 57.295776));
});

test("a wither skull keeps its Rotation: native import, the browser save and load (readFromNBT: prev raw, current mod 360)", async () => {
  const ref = JSON.parse(readFileSync(new URL("../public/research/projectile-nbt-reference.json", import.meta.url), "utf8"));
  const bytes = (hex) => Uint8Array.from(hex.match(/../g).map((x) => parseInt(x, 16)));
  const mobs = { entities: [], random: () => 0.5, world: { get: () => 0 } }, skulls = new WitherSkulls(mobs);
  const natives = ref.projectiles.filter((p) => p.id === "WitherSkull" && p.loaded);
  assert.ok(natives.length);
  for (const p of natives) {
    const { record } = javaProjectileFromNbt(decodeNbt(bytes(p.nbt)).tag.value, {});
    skulls.load([record]);
    assert.deepEqual([skulls.list[0].yaw, skulls.list[0].pitch], [Math.fround(p.yaw), Math.fround(p.pitch)], "the executed load");
  }
  skulls.load([{ kind: "witherSkull", x: 1, y: 2, z: 3, vx: 0.1, vy: 0, vz: 0, rotation: [370.5, -400] }]);
  const b = skulls.list[0];
  assert.deepEqual([b.yaw, b.pitch, b.prevYaw, b.prevPitch], [Math.fround(10.5), Math.fround(-40), 370.5, -400]);
  b.yaw = Math.fround(123.25); b.pitch = Math.fround(-12.5);
  const saved = skulls.serialize(0);
  assert.deepEqual(saved[0].rotation, [123.25, -12.5]);
  skulls.load(saved);
  assert.deepEqual([skulls.list[0].yaw, skulls.list[0].pitch], [123.25, -12.5]);
  // The export writes it as Entity.writeToNBT's Rotation (two floats) over the exporter's record yaw/pitch.
  const out = javaProjectileToNbt("fireballs", saved[0]);
  assert.equal(out.id, "WitherSkull");
  assert.deepEqual(out.fields.Rotation.value, { elementType: NBT.FLOAT, items: [123.25, -12.5] });
  assert.equal(javaProjectileToNbt("fireballs", { kind: "witherSkull", vx: 0, vy: 0, vz: 0 }).fields.Rotation, undefined);
  // b82 fireext82: every fireball writes Entity's Rotation (this line used to expect none for a ghast fireball)
  assert.deepEqual(javaProjectileToNbt("fireballs", { kind: "fireball", vx: 0, vy: 0, vz: 0, rotation: [1, 2] }).fields.Rotation.value, { elementType: NBT.FLOAT, items: [1, 2] });
  skulls.load([{ kind: "witherSkull", x: 1, y: 2, z: 3, vx: 0.1, vy: 0, vz: 0 }]);
  assert.deepEqual([skulls.list[0].yaw, skulls.list[0].pitch], [0, 0], "an older save has no rotation");
});

test("a world export then import keeps the wither skull's rotation", async () => {
  const { World } = await import("./world.js");
  const { exportJavaSave } = await import("./region-export.js");
  const { readRegion, decodeRegionChunk, regionSlot, regionAddress } = await import("./region-file.js");
  const { chunkFromNbt } = await import("./chunk-nbt.js");
  const { nbtGet } = await import("./nbt-get.js");
  const w = new World("17", "javaStreamed", 12), player = new Survival({}, "survival").serialize();
  const fireballs = [{ kind: "witherSkull", x: -6, y: 102.5, z: -2.5, vx: 0.3, vy: 0, vz: 0.1, ax: 0, ay: 0, az: 0, dimension: 0, rotation: [-71.5, 22.25] }];
  const { files } = await exportJavaSave({ id: "r81", name: "R81", seed: "17", biome: "javaStreamed", generationVersion: 12, mode: "survival", edits: [], player,
    position: { x: -0.5, y: 102, z: -0.5, yaw: 0, pitch: 0 }, updated: 1700000000000, fireballs }, { world: w });
  const cx = -1 + w.originX / 16, cz = -1 + w.originZ / 16, a = regionAddress(cx, cz);
  const chunk = chunkFromNbt(await decodeRegionChunk(readRegion(files.get(`region/r.${a.regionX}.${a.regionZ}.mca`)).get(regionSlot(a.x, a.z))));
  const skull = chunk.entities.find((e) => nbtGet(e, "id", NBT.STRING, "") === "WitherSkull");
  assert.ok(skull);
  const { record } = javaProjectileFromNbt(skull, { shiftX: -w.originX, shiftZ: -w.originZ });
  assert.deepEqual(record.rotation, [-71.5, 22.25]);
});
