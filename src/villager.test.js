import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import * as THREE from "three";
import { EntityWorld, ENTITY_TYPES, setEntityRandom, entityRandom } from "./entities.js";
import { JavaRandom } from "./lighting.js";
import { Survival } from "./survival.js";
import { World, solidBlock, WOODEN_DOOR } from "./world.js";
import { soundPitch, experiencePoints } from "./combat.js";
import { restorePopulationColumns } from "./population-runtime.js";
import { exportJavaSave } from "./region-export.js";
import { readRegion, decodeRegionChunk, regionAddress, regionSlot } from "./region-file.js";
import { chunkFromNbt } from "./chunk-nbt.js";
import { VILLAGER, VILLAGER_TASKS, VILLAGER_SOUNDS, PROFESSIONS, DEFAULT_TEXTURE, villagerTexture, villagerFields, readProfession } from "./villager.js";
import { VILLAGER_SCALE, VILLAGER_ARM_ANGLE, villagerLegAngle } from "./villager-renderer.js";
import { mhCos } from "./lighting.js";

// three's TextureLoader asks the DOM for an <img>; the geometry under test never loads one.
globalThis.document ??= { createElementNS: () => ({ addEventListener() {}, removeEventListener() {}, style: {} }) };
const { MobRenderer } = await import("./mob-renderer.js");

// tools/probes/VillagerProbe.java (tools/verify-villager.mjs): the unchanged EntityVillager (yv), its AI task list,
// EntityAIAvoidEntity, EntityAIOpenDoor, the wooden BlockDoor, ModelVillager and RenderVillager of 1.7.10.
const reference = JSON.parse(readFileSync(new URL("../public/research/villager-reference.json", import.meta.url)));
const f = Math.fround;
const flat = { numericSeed: 1, solid: (x, y, z) => y < 0, get: (x, y, z) => (y < 0 ? 1 : 0), getMeta: () => 0, put() {}, surface: () => 0, spawn: () => ({ x: 64.5, y: 0, z: 64.5 }) };
const far = { x: 64, y: 0, z: 400 };
const NAMES = { EntityAISwimming: "EntityAISwimming" };
// A block map on top of the flat stone floor, with BlockDoor-aware collision (solidBlock reads the door's metadata).
function cellWorld() {
  const cells = new Map();
  const world = {
    numericSeed: 1,
    get: (x, y, z) => cells.get(`${x},${y},${z}`)?.[0] ?? (y < 0 ? 1 : 0),
    getMeta: (x, y, z) => cells.get(`${x},${y},${z}`)?.[1] ?? 0,
    put(x, y, z, b, m = 0) { cells.set(`${x},${y},${z}`, [b, m]); return true; },
    solid(x, y, z) { return solidBlock(this.get(x, y, z), this.getMeta(x, y, z)); },
    surface: () => 0,
    spawn: () => ({ x: 64.5, y: 0, z: 64.5 }),
  };
  return world;
}
// A villager as the probe makes it: yaw 0, Entity.rand = java.util.Random(seed), on the ground plane at (x, 0, z).
function villagerWorld(world, seed, x, z, profession) {
  const ew = new EntityWorld(world, [], () => 0.5), e = ew.create("villager", x, 0, z);
  e.yaw = 0;
  e.profession = profession;
  ew.entities.push(e);
  setEntityRandom(e, new JavaRandom(seed));
  return { ew, e };
}
const idleSounds = (events) => events.filter((x) => x.sound === VILLAGER_SOUNDS.idle);

test("a villager has the 1.7.10 size, health, speed, follow range and eye height", () => {
  const t = ENTITY_TYPES.villager, facts = reference.facts;
  assert.deepEqual([t.width, t.height, t.health, t.movement], [f(facts.width), f(facts.height), facts.maxHealth, facts.speed]);
  assert.deepEqual([VILLAGER.followRange, VILLAGER.talkInterval], [facts.followRange, facts.talkInterval]);
  assert.equal(f(t.height * f(0.85)), f(facts.eyeHeight));
  assert.equal(facts.experienceValue, 0);
  assert.equal(facts.canDespawn, false);
  assert.deepEqual([facts.breakDoors, facts.avoidsWater], [true, true]);
  const e = new EntityWorld(flat, []).create("villager", 64.5, 0, 64.5);
  assert.deepEqual([e.health, e.profession, e.riches, e.growingAge], [facts.health, 0, 0, facts.age]);
});

test("VILLAGER_TASKS lists the native task list in order, with its priorities and mutex bits", () => {
  const native = reference.tasks.tasks.map((t) => [t.priority, t.class, t.mutex]);
  assert.deepEqual(VILLAGER_TASKS.map((t) => [t.priority, t.name, t.mutex]), native);
  assert.equal(reference.tasks.targetTasks, 0);
});

test("the live brain runs the tasks that do not need a village, trader or golem, in native order and priority", () => {
  const { ew, e } = villagerWorld(flat, 1, 64.5, 64.5, 0), brain = ew.ai.brain(e);
  const live = VILLAGER_TASKS.filter((t) => t.live !== false).map((t) => [t.priority, t.mutex]);
  assert.deepEqual(brain.tasks.entries.map((x) => [x.priority, x.action.mutex]), live);
  assert.equal(brain.targets.entries.length, 0);
  // EntityAIWander's 0.6 and EntityAIAvoidEntity's 8 blocks, 0.6 / 0.6.
  const wander = reference.tasks.tasks.find((t) => t.class === "EntityAIWander"), avoid = reference.tasks.tasks.find((t) => t.class === "EntityAIAvoidEntity");
  assert.equal(ENTITY_TYPES.villager.ai.wander, wander.params.e);
  assert.deepEqual([avoid.params.f, avoid.params.c, avoid.params.d], [8, 0.6, 0.6]);
  assert.equal(brain.navigator.canPassClosedDoors, true);
  assert.equal(brain.navigator.avoidsWater, true);
  // EntityCreature's block path weight (0), unlike an animal's 10 on grass.
  assert.equal(brain.getBlockPathWeight(64, 0, 64), 0);
});

test("wandering replays the unchanged EntityVillager tick by tick: motion, Entity.rand draws and living sounds", () => {
  assert.equal(reference.wander.length, 3);
  for (const want of reference.wander) {
    const { ew, e } = villagerWorld(flat, want.seed, ...want.start.filter((_, i) => i !== 1), want.profession), p = new Survival({});
    const heard = [];
    let walked = false;
    want.ticks.forEach((row, i) => {
      ew.tick(far, p, 0);
      heard.push(...idleSounds(ew.drain()));
      walked ||= row.running.includes("Wander");
      for (const k of ["x", "y", "z"]) assert.ok(Math.abs(e[k] - row[k]) < 1e-9, `seed ${want.seed} tick ${i} ${k} ${e[k]} ${row[k]}`);
      assert.equal(e.onGround, row.onGround, `seed ${want.seed} tick ${i}`);
      assert.equal(e.limbSwingAmount, f(row.limbSwingAmount), `seed ${want.seed} tick ${i} limb swing`);
    });
    assert.ok(walked);
    const native = want.sounds.filter((s) => s.startsWith(VILLAGER_SOUNDS.idle)).map((s) => s.split("|"));
    assert.deepEqual(heard.map((s) => [s.sound, s.volume, s.pitch]), native.map(([n, v, pitch]) => [n, +v, f(+pitch)]));
    assert.ok(heard.length >= 2);
  }
});

test("a villager runs from a zombie it can see and keeps running: avoid replays tick by tick", () => {
  assert.equal(reference.avoid.length, 2);
  for (const want of reference.avoid) {
    const { ew, e } = villagerWorld(flat, want.seed, 64.5, 64.5, want.profession), z = ew.create("zombie", 64.5, 0, 67), p = new Survival({});
    ew.entities.push(z);
    const ran = new Set();
    want.ticks.forEach((row, i) => {
      // The probe's zombie is scripted: set before the villager ticks, motionless, unharmed by the sun.
      Object.assign(z, { x: want.zombie[i][0], y: 0, z: want.zombie[i][1], vx: 0, vz: 0, health: 20, fire: 0, persistent: true }); // sw.w despawns a mob 336 blocks from the player every tick
      ew.tick(far, p, 0);
      for (const t of ew.ai.brain(e).tasks.running) ran.add(t.action.constructor.name);
      for (const k of ["x", "y", "z"]) assert.ok(Math.abs(e[k] - row[k]) < 1e-9, `${want.mode} tick ${i} ${k} ${e[k]} ${row[k]}`);
    });
    assert.ok(ran.has("AvoidEntity"), want.mode);
    assert.ok(want.ticks.some((r) => r.running.includes("EntityAIAvoidEntity")));
    // It ends well away from where it started (z 64.5 -> 50.8 / 54.9), the zombie being south of it.
    assert.ok(e.z < 56);
  }
});

test("a villager with no zombie in sight does not run, and a zombie behind a wall is not seen", () => {
  const { ew, e } = villagerWorld(flat, 5, 64.5, 64.5, 0), p = new Survival({}), brain = ew.ai.brain(e);
  const z = ew.create("zombie", 64.5, 0, 90);
  ew.entities.push(z);
  for (let i = 0; i < 60; i++) {
    Object.assign(z, { x: 64.5, y: 0, z: 90, vx: 0, vz: 0, health: 20, fire: 0 });
    ew.tick(far, p, 0);
    assert.ok(!brain.tasks.running.some((t) => t.action.constructor.name === "AvoidEntity"));
  }
});

test("a villager opens a closed wooden door in its path for 20 ticks and closes it: door replays tick by tick", () => {
  assert.equal(reference.door.length, 2);
  for (const want of reference.door) {
    const world = cellWorld();
    for (let z = 56; z <= 72; z++) for (let y = 0; y <= 3; y++) world.put(66, y, z, 1, 0);
    world.put(66, 0, 64, WOODEN_DOOR, 0);
    world.put(66, 1, 64, WOODEN_DOOR, 8);
    const { ew, e } = villagerWorld(world, want.seed, want.start[0], want.start[2], want.profession), p = new Survival({}), brain = ew.ai.brain(e);
    const metas = [], swings = [];
    want.ticks.forEach((row, i) => {
      if (i === want.lead) assert.equal(brain.navigator.tryMoveToXYZ(want.goal[0], 0, want.goal[2], want.speed), want.pathFound);
      ew.tick(far, p, 0);
      swings.push(...ew.drain().filter((x) => x.doorUpdate));
      metas.push(world.getMeta(66, 0, 64));
      for (const k of ["x", "y", "z"]) assert.ok(Math.abs(e[k] - row[k]) < 1e-9, `seed ${want.seed} tick ${i} ${k} ${e[k]} ${row[k]}`);
    });
    assert.deepEqual(metas, want.doorMeta);
    // Aux effect 1003 at the upper half twice (open, close): the event carries both halves for the redraw.
    assert.equal(want.aux.length, 2);
    assert.equal(swings.length, 2);
    for (const s of swings) {
      assert.deepEqual(s.doorUpdate, [[66, 0, 64], [66, 1, 64]]);
      assert.ok(/^random\.door_(open|close)$/.test(s.sound));
      assert.deepEqual(s.position, { x: 66.5, y: 1.5, z: 64.5 });
    }
    assert.ok(e.x > 69, "it walked through the doorway");
    assert.equal(world.getMeta(66, 0, 64), 0, "the door is shut again");
  }
});

test("iron doors and open or missing doors are left alone", () => {
  const world = cellWorld();
  for (let z = 56; z <= 72; z++) for (let y = 0; y <= 3; y++) world.put(66, y, z, 1, 0);
  world.put(66, 0, 64, 98, 0);
  world.put(66, 1, 64, 98, 8);
  const { ew, e } = villagerWorld(world, 4, 62.5, 64.5, 1), p = new Survival({});
  for (let i = 0; i < 80; i++) {
    if (i === 2) ew.ai.brain(e).navigator.tryMoveToXYZ(69.5, 0, 64.5, 0.6);
    ew.tick(far, p, 0);
  }
  assert.equal(world.getMeta(66, 0, 64), 0);
  assert.ok(e.x < 66);
  assert.equal(ew.drain().filter((x) => x.doorUpdate).length, 0);
});

test("sounds: mob.villager.idle, hit and death at volume 1 with the seeded Entity.rand pitch (+0.5 for a child)", () => {
  assert.deepEqual([reference.sounds.idle, reference.sounds.hit, reference.sounds.death, reference.sounds.volume], [VILLAGER_SOUNDS.idle, VILLAGER_SOUNDS.hit, VILLAGER_SOUNDS.death, 1]);
  for (const want of reference.sounds.pitches) assert.equal(soundPitch(new JavaRandom(want.seed), want.child), f(want.pitch), `seed ${want.seed} child ${want.child}`);
  for (const child of [false, true]) {
    const { ew, e } = villagerWorld(flat, 0, 64.5, 0, 0);
    if (child) e.growingAge = -24000;
    ew.damage(e, 1, 60, 64);
    const hit = ew.drain().find((x) => x.sound);
    assert.deepEqual([hit.sound, hit.volume], [VILLAGER_SOUNDS.hit, 1]);
    assert.ok(hit.pitch >= (child ? 1.4 : 0.9) && hit.pitch <= (child ? 1.6 : 1.1));
    // A hit inside the hurt window is silent; once it is over, the killing hit plays the death sound.
    e.hurt = 0;
    ew.damage(e, 100, 60, 64);
    assert.equal(ew.drain().find((x) => x.sound).sound, VILLAGER_SOUNDS.death);
  }
});

test("the living sound rolls every tick and the next one waits 80 ticks (getTalkInterval)", () => {
  const { ew, e } = villagerWorld(flat, 3, 64.5, 0, 0);
  setEntityRandom(e, { nextInt: () => 0, nextFloat: () => 0.5, nextDouble: () => 0.5 });
  e.livingSoundTime = 1;
  ew.talk(e);
  const [s] = ew.drain();
  assert.equal(s.sound, VILLAGER_SOUNDS.idle);
  assert.equal(e.livingSoundTime, -reference.facts.talkInterval);
  assert.equal(s.pitch, 1);
});

test("a villager drops nothing and gives no experience", () => {
  assert.deepEqual([reference.drops.items, reference.drops.experience], [0, 0]);
  for (const growingAge of [0, -24000]) {
    const { ew, e } = villagerWorld(flat, 7, 64.5, 0, 2);
    e.growingAge = growingAge;
    e.fire = 20;
    ew.kill(e);
    assert.equal(ew.drain().filter((x) => x.drop).length, 0);
    for (let i = 0; i < 30; i++) ew.tick(far, new Survival({}), 0);
    assert.equal(ew.drain().filter((x) => x.xp).length, 0);
  }
  assert.equal(experiencePoints({ type: "villager" }, entityRandom({}), entityRandom({})), 0);
});

test("a hurt villager takes no panic run and does not despawn", () => {
  const { ew, e } = villagerWorld(flat, 11, 64.5, 0, 4), p = new Survival({});
  ew.damage(e, 3, 60, 64);
  assert.equal(e.health, 17);
  const brain = ew.ai.brain(e);
  for (let i = 0; i < 200; i++) {
    ew.tick({ x: 64.5, y: 0, z: 1000 }, p, 0);
    assert.ok(!brain.tasks.running.some((t) => t.action.constructor.name === "Panic"));
  }
  assert.equal(ew.entities.includes(e), true);
  assert.ok(e.health > 0);
});

test("profession textures: 0 farmer, 1 librarian, 2 priest, 3 smith, 4 butcher, anything else villager.png", () => {
  assert.deepEqual(PROFESSIONS.map((n) => n + ".png"), Object.values(reference.textures));
  for (const [id, name] of Object.entries(reference.textures)) {
    assert.equal(villagerTexture(+id), "/media/1.7.10/entity/villager/" + name);
    assert.ok(existsSync(new URL("../public" + villagerTexture(+id), import.meta.url)), name);
  }
  assert.equal(DEFAULT_TEXTURE, "/media/1.7.10/entity/villager/" + reference.defaultTexture);
  assert.ok(existsSync(new URL("../public" + DEFAULT_TEXTURE, import.meta.url)));
  for (const odd of [5, 99, -1, 1.5, "1", undefined]) assert.equal(villagerTexture(odd), DEFAULT_TEXTURE);
});

test("professions and riches save, reload and sanitize; the rest of the record is the common mob's", () => {
  const ew = new EntityWorld(flat, []);
  for (const [profession, riches] of [[0, 0], [3, 12], [4, 9999]]) {
    const e = ew.create("villager", 64.5, 0, 64.5);
    Object.assign(e, villagerFields(profession, riches));
    ew.entities.push(e);
  }
  const saved = JSON.parse(JSON.stringify(ew.serialize()));
  assert.deepEqual(saved.map((e) => [e.type, e.profession, e.riches]), [["villager", 0, 0], ["villager", 3, 12], ["villager", 4, 9999]]);
  const back = new EntityWorld(flat, saved);
  assert.deepEqual(back.entities.map((e) => [e.profession, e.riches, e.health]), [[0, 0, 20], [3, 12, 20], [4, 9999, 20]]);
  const odd = new EntityWorld(flat, [{ id: "mob-1", type: "villager", x: 64.5, y: 0, z: 64.5, health: 99, profession: "x", riches: -5 }]);
  assert.deepEqual([odd.entities[0].profession, odd.entities[0].riches, odd.entities[0].health], [0, 0, 20]);
  assert.equal(readProfession(7), 7);
});

test("generation records {type:'Villager', profession} become live villagers; Witch records become live witches", () => {
  const ew = new EntityWorld(flat, []);
  const columns = [{ records: { chests: [], animals: [
    { type: "Villager", x: 70.5, y: 4, z: 60.5, profession: 3 }, { type: "Villager", x: 71.5, y: 4, z: 60.5, profession: 0 },
    { name: "Pig", x: 8, y: 4, z: 8, yaw: 0 }, { type: "Witch", x: 9, y: 4, z: 9, yaw: 0, pitch: 0 },
  ], spawners: [], minecartChests: [], pendingTicks: [] } }];
  const out = restorePopulationColumns(columns, { world: flat, survival: { chests: {} }, mobs: ew, spawners: { add() {} }, minecarts: { spawnChest() {} }, fluids: { schedule() {} } });
  assert.equal(out.animals, 4);
  assert.deepEqual(out.unsupported, []);
  assert.deepEqual(ew.entities.filter((e) => e.type === "witch").map((e) => [e.x, e.y, e.z, e.health]), [[9, 4, 9, 26]]);
  const villagers = ew.entities.filter((e) => e.type === "villager");
  assert.deepEqual(villagers.map((e) => [e.profession, e.x, e.y, e.z, e.health]), [[3, 70.5, 4, 60.5, 20], [0, 71.5, 4, 60.5, 20]]);
});

test("the Java export writes Villager with Profession, Riches and Age (no InLove, no Offers)", async () => {
  const w = new World("17", "javaStreamed", 12);
  const r = { id: "v", name: "V", seed: "17", biome: "javaStreamed", generationVersion: 12, mode: "survival", edits: [...w.edits],
    player: new Survival({}, "survival").serialize(), position: { x: 0.5, y: 102, z: 0.5, yaw: 0, pitch: 0 },
    entities: [{ type: "villager", x: 2.5, y: 102, z: 2.5, health: 14, growingAge: -100, profession: 3, riches: 7 }], updated: 1700000000000 };
  const { files, report } = await exportJavaSave(r, { world: w });
  assert.equal(report.unsupportedEntities, 0);
  const cx = Math.floor(2.5 / 16) + w.originX / 16, cz = Math.floor(2.5 / 16) + w.originZ / 16, a = regionAddress(cx, cz);
  const entries = readRegion(files.get(`region/r.${a.regionX}.${a.regionZ}.mca`)), c = chunkFromNbt(await decodeRegionChunk(entries.get(regionSlot(a.x, a.z))));
  const v = c.entities.find((e) => e.get("id").value === "Villager");
  assert.ok(v);
  assert.deepEqual([v.get("Profession").value, v.get("Riches").value, v.get("Age").value, v.get("Health").value], [3, 7, -100, 14]);
  assert.equal(v.has("InLove"), false);
  assert.equal(v.has("Offers"), false);
});

// --- ModelVillager (bik) and RenderVillager (bpa) ---
const model = reference.model, parts = model.parts;
function entity(extra = {}) {
  return { id: "v", type: "villager", x: 0, y: 0, z: 0, px: 0, py: 0, pz: 0, renderYawOffset: 0, prevRenderYawOffset: 0, rotationYawHead: 0, prevRotationYawHead: 0,
    rotationPitch: 0, prevRotationPitch: 0, limbSwing: 0, limbSwingAmount: 0, prevLimbSwingAmount: 0, age: 0, death: 0, hurt: 0, growingAge: 0, profession: 0, ...extra };
}
function renderer() {
  const uniforms = { lightmap: { value: null }, fogColor: { value: new THREE.Vector3() }, fogNear: { value: 0 }, fogFar: { value: 1 }, fogDensity: { value: 0 } };
  return new MobRenderer(new THREE.Scene(), { lighting: { uniforms }, brightness: () => 0 });
}
function restRig(extra) {
  const view = renderer(), e = entity(extra);
  view.update([e], 0, 1);
  const rig = view.rigs.get(e.id);
  for (const g of [...rig.limbs, rig.neck]) g.rotation.set(0, 0, 0);
  rig.root.updateMatrixWorld(true);
  return { rig, view };
}
// The boxes ModelVillager draws at rest: setRotationAngles moves the arms' point to (0, 3, -1) and tilts them -0.75; the nose
// is a child of the head (its point is relative to the head's). Model pixels map to (x, 24 - y, -z) / 16 times the 0.9375 scale.
function expectedBoxes() {
  const out = [];
  const add = (p, point, angle) => {
    const m = new THREE.Matrix4().makeTranslation(...point).multiply(new THREE.Matrix4().makeRotationX(angle));
    for (const b of p.boxes) {
      const box = new THREE.Box3();
      for (const x of [b.from[0] - b.grow, b.to[0] + b.grow]) for (const y of [b.from[1] - b.grow, b.to[1] + b.grow]) for (const z of [b.from[2] - b.grow, b.to[2] + b.grow]) {
        const v = new THREE.Vector3(x, y, z).applyMatrix4(m);
        box.expandByPoint(new THREE.Vector3((v.x / 16) * VILLAGER_SCALE, ((24 - v.y) / 16) * VILLAGER_SCALE + 1 / 128, (-v.z / 16) * VILLAGER_SCALE));
      }
      out.push({ box, uv: b.uv, size: p.texture });
    }
  };
  add(parts["bik.a"], parts["bik.a"].point, 0);
  add(parts["bik.a"].children[0], [0, -2, 0], 0);
  add(parts["bik.b"], parts["bik.b"].point, 0);
  add(parts["bik.c"], [0, 3, -1], VILLAGER_ARM_ANGLE);
  add(parts["bik.d"], parts["bik.d"].point, 0);
  add(parts["bik.e"], parts["bik.e"].point, 0);
  return out;
}
const near = (a, b) => a.min.distanceTo(b.min) < 1e-6 && a.max.distanceTo(b.max) < 1e-6;
const show = (b) => `[${b.min.toArray().map((v) => +(v * 16).toFixed(3))}]..[${b.max.toArray().map((v) => +(v * 16).toFixed(3))}]`;

test("the villager rig draws ModelVillager's nine boxes at the recorded places and texture offsets", () => {
  assert.equal(model.class, "bik");
  const { rig } = restRig(), actual = [];
  rig.root.traverse((o) => {
    if (!o.isMesh || o.geometry.type !== "BoxGeometry") return;
    const uv = o.geometry.attributes.uv;
    let u = Infinity, v = -Infinity;
    for (let i = 0; i < uv.count; i++) { u = Math.min(u, uv.getX(i)); v = Math.max(v, uv.getY(i)); }
    actual.push({ box: new THREE.Box3().setFromObject(o), u, v });
  });
  const expected = expectedBoxes();
  assert.equal(expected.length, 9);
  assert.equal(actual.length, expected.length);
  const left = [...actual];
  for (const want of expected) {
    const i = left.findIndex((have) => near(have.box, want.box));
    assert.ok(i >= 0, `no drawn box at ${show(want.box)}; drawn: ${left.map((h) => show(h.box)).join(" ")}`);
    const [have] = left.splice(i, 1), [w, h] = want.size;
    assert.deepEqual([Math.round(have.u * w), Math.round((1 - have.v) * h)], want.uv, `texture offset of ${show(want.box)}`);
  }
});

test("RenderVillager scales by 0.9375, halved for a child, and the legs swing at half the biped's 1.4 amplitude", () => {
  assert.equal(VILLAGER_SCALE, f(0.9375));
  const { rig, view } = restRig();
  assert.equal(rig.root.scale.x, 0.9375);
  assert.equal(rig.scale, VILLAGER_SCALE);
  const child = renderer();
  child.update([entity({ growingAge: -24000 })], 0, 1);
  assert.equal(child.rigs.get("v").root.scale.x, 0.46875);
  assert.equal(rig.limbs.length, 2);
  for (const [swing, amount] of [[0, 0], [1.3, 0.6], [4.2, 1]]) {
    assert.equal(villagerLegAngle(swing, amount, 0), f(f(f(mhCos(f(swing * f(0.6662))) * f(1.4)) * f(amount)) * f(0.5)));
    assert.equal(villagerLegAngle(swing, amount, 1), f(f(f(mhCos(f(f(swing * f(0.6662)) + f(3.1415927))) * f(1.4)) * f(amount)) * f(0.5)));
  }
  const walking = renderer();
  walking.update([entity({ limbSwing: 1.3, limbSwingAmount: 0.6, prevLimbSwingAmount: 0.6 })], 0, 1);
  const legs = walking.rigs.get("v").limbs.map((l) => l.rotation.x);
  assert.ok(Math.abs(legs[0] + legs[1]) < 1e-6 && Math.abs(legs[0]) > 0.01);
  assert.equal(view.rigs.size, 1);
});
