// Guns mod (not 1.7.10): the box models, their first-person hold and animation, and the third-person hold.
import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { GUN_MODELS, gunViewPose, gunViewMatrix, gunMuzzle, gunHeldMatrix, gunArmPose, buildGunMesh, applyGunParts, VIEW_SCALE } from "./mods/guns/model.js";
import { P320, AKM, M870, GUNS, AMMO_45ACP } from "./mods/guns/catalog.js";

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);
const at = (gunId, state, p) => new THREE.Vector3(...p).applyMatrix4(gunViewMatrix(gunId, gunViewPose(gunId, state)));
const HALF_FOV = 35 * Math.PI / 180; // the hand camera's 70 degree field of view

test("each model is a set of real boxes with its muzzle past the barrel", () => {
  for (const [id, model] of Object.entries(GUN_MODELS)) {
    assert.ok(GUNS[id], `model ${id} is a gun`);
    let front = 0;
    for (const [from, to, color, part] of model.boxes) {
      for (let i = 0; i < 3; i++) assert.ok(from[i] < to[i], `${id} box ${from}..${to}`);
      assert.equal(color.length, 3);
      assert.ok(part === undefined || ["mag", "slide", "pump"].includes(part));
      front = Math.min(front, from[2]);
    }
    assert.ok(model.muzzle[2] < front, `${id} muzzle ahead of every box`);
    assert.ok(model.boxes.some((b) => b[3] === (id == M870 ? "pump" : "mag")));
  }
});

test("from the hip the gun sits low right; aimed, its sights line up on the crosshair", () => {
  for (const id of [P320, AKM, M870]) {
    const m = gunMuzzle(id, { aim: 0 });
    assert.ok(m[0] > 0 && m[1] < 0 && m[2] < 0, `${id} hip muzzle ${m}`);
    assert.ok(Math.atan2(m[1], -m[2]) > -HALF_FOV, "the muzzle is on screen");
    // Aimed: the sight line (x 0, y sight) runs along the view axis, ahead of the eye.
    const { sight } = GUN_MODELS[id];
    for (const z of [0, -6]) {
      const p = at(id, { aim: 1 }, [0, sight, z]);
      close(p.x, 0, 1e-12); close(p.y, 0, 1e-12);
      assert.ok(p.z < 0);
    }
    const a = gunMuzzle(id, { aim: 1 });
    close(a[0], 0, 1e-12);
    assert.ok(a[1] < 0 && a[1] > -0.1, "the muzzle sits just under the sight line");
  }
});

test("a shot kicks the model back and up and it settles; the aimed kick is smaller", () => {
  const rest = gunViewPose(AKM, {});
  const shot = gunViewPose(M870, { sinceShot: 0.025 }), aimed = gunViewPose(M870, { sinceShot: 0.025, aim: 1 }), still = gunViewPose(M870, {});
  assert.ok(shot.position[2] > still.position[2] && shot.rotation[0] > still.rotation[0]);
  assert.ok(aimed.rotation[0] - gunViewPose(M870, { aim: 1 }).rotation[0] < shot.rotation[0] - still.rotation[0]);
  assert.deepEqual(gunViewPose(AKM, { sinceShot: 0.7 }), rest);
  // The P320 slide cycles and locks back on an empty magazine; the M870 pump racks after the shot and returns.
  assert.ok(gunViewPose(P320, { sinceShot: 0.02 }).parts.slide > 1);
  assert.equal(gunViewPose(P320, { sinceShot: 0.3 }).parts.slide, 0);
  assert.equal(gunViewPose(P320, { sinceShot: 0.3, empty: true }).parts.slide, 1.8);
  close(gunViewPose(M870, { sinceShot: 0.26 }).parts.pump, 4.5);
  assert.equal(gunViewPose(M870, { sinceShot: 0.5 }).parts.pump, 0);
});

test("reloads lower the gun and swap the magazine; drawing raises it", () => {
  const rest = gunViewPose(AKM, {});
  const mid = gunViewPose(AKM, { reload: { kind: "magazine", t: 0.5 } });
  assert.ok(mid.position[1] < rest.position[1] && mid.rotation[2] > 0);
  assert.equal(mid.parts.mag.visible, false);
  const out = gunViewPose(AKM, { reload: { kind: "magazine", t: 0.3 } }).parts.mag;
  assert.ok(out.visible && out.offset[1] < -5);
  const done = gunViewPose(AKM, { reload: { kind: "magazine", t: 1 } });
  assert.deepEqual(done.parts.mag, { offset: [0, -0, 0], visible: true });
  close(done.position[1], rest.position[1]);
  const loading = gunViewPose(M870, { reload: { kind: "shell", sinceStart: 2, start: 0.67, sinceShell: 0.12, sinceEnd: null } });
  assert.ok(loading.rotation[2] > 30 * Math.PI / 180);
  const ended = gunViewPose(M870, { reload: { kind: "shell", sinceStart: 3, start: 0.67, sinceShell: 1, sinceEnd: 0.3 } });
  close(ended.rotation[2], 0, 1e-12);
  const drawing = gunViewPose(P320, { draw: 0 }), drawn = gunViewPose(P320, { draw: 1 });
  assert.ok(drawing.position[1] < drawn.position[1] - 0.3);
  assert.deepEqual(drawn, gunViewPose(P320, {}));
});

test("the built model has movable parts and a flash that shows for 50 ms", () => {
  const made = [];
  const mesh = buildGunMesh(AKM, (o) => { const m = new THREE.MeshBasicMaterial(); made.push(o); return m; });
  const { parts, flash } = mesh.userData;
  assert.ok(parts.mag && !parts.slide && !parts.pump);
  assert.equal(new Set(made.map((o) => o.color.join())).size, made.length, "one material per colour");
  assert.ok(made.every((o) => o.map === null));
  assert.equal(flash.visible, false);
  applyGunParts(mesh, gunViewPose(AKM, { reload: { kind: "magazine", t: 0.3 } }), 0.01);
  assert.equal(flash.visible, true);
  assert.ok(parts.mag.position.y < -5);
  applyGunParts(mesh, gunViewPose(AKM, {}), 0.06);
  assert.equal(flash.visible, false);
  // The model's own size, in blocks at the view scale: a pistol, then two long guns.
  const length = (id) => { const b = new THREE.Box3().setFromObject(buildGunMesh(id, () => new THREE.MeshBasicMaterial())); return (b.max.z - b.min.z) * VIEW_SCALE; };
  assert.ok(length(P320) < 0.5 && length(AKM) > 1 && length(M870) > 1);
});

test("third person: the barrel runs along the raised arm with the gun upright", () => {
  const m = gunHeldMatrix(), dir = (v) => new THREE.Vector3(...v).transformDirection(m);
  const barrel = dir([0, 0, -1]), top = dir([0, 1, 0]);
  close(barrel.y, 1); close(top.z, -1); // the arm's +y runs to the hand; its -z faces up once raised
  assert.ok(m.determinant() > 0, "no mirror, so faces keep their winding");
  const arms = gunArmPose([0.2, -0.3]);
  close(arms.rightArm[0], -Math.PI / 2 + 0.2);
  assert.ok(arms.leftArm[1] > arms.rightArm[1], "the left arm reaches across");
});

test("the hooks' view state follows the draw, shots and reload on the clock", async () => {
  const { createGunHooks } = await import("./mods/guns/hooks.js");
  const { Survival, ITEMS, setExtraCrafting } = await import("./survival.js");
  const { CREATIVE_TABS, SEARCH_ORDER } = await import("./creative.js");
  const { setGunsEnabled } = await import("./mods/guns/install.js");
  const opts = { items: ITEMS, combatTab: CREATIVE_TABS[8].items, search: SEARCH_ORDER, setCrafting: setExtraCrafting };
  setGunsEnabled(true, opts);
  try {
    const survival = new Survival({ slots: [{ id: P320, count: 1, damage: 11 }, { id: AMMO_45ACP, count: 30, damage: 0 }] }, "survival");
    const world = { get: () => 0, getMeta: () => 0, solid: () => false };
    let clock = 0;
    const fx = [];
    const hooks = createGunHooks({
      survival, world, mobs: { pick: () => null, attackEntityFrom: () => true }, random: () => 0.5,
      eye: () => ({ origin: [0.5, 63.5, 0.5], dir: [0, 0, -1] }), playerPos: () => ({ x: 0.5, z: 0.5 }),
      sneaking: () => false, moving: () => false, breakBlock() {}, renderHotbar() {}, markUnsaved() {}, toast() {},
      fx: (...a) => fx.push(a), now: () => clock,
    });
    const tick = (n) => { for (let i = 0; i < n; i++) { hooks.tick(); clock += 50; } };
    hooks.tick();
    clock += 100;
    assert.ok(hooks.view().draw > 0.1 && hooks.view().draw < 0.2);
    tick(Math.ceil(GUNS[P320].draw / 0.05) + 1);
    assert.equal(hooks.view().draw, 1);
    hooks.attack(true); hooks.tick(); hooks.attack(false);
    clock += 10;
    close(hooks.view().sinceShot, 0.01);
    // The muzzle smoke comes from the right of the view (east, facing north) and ahead of the eye.
    const [, x, , z] = fx.find((f) => f[0] === "smoke");
    assert.ok(x > 0.5 && z < 0.5 - 0.5);
    assert.equal(hooks.view().empty, true); // the last of 12 rounds
    tick(10);
    assert.equal(hooks.key(19), true);
    clock += 1000;
    const r = hooks.view().reload;
    assert.equal(r.kind, "magazine");
    close(r.t, 1 / GUNS[P320].reload.empty);
    tick(Math.ceil(GUNS[P320].reload.empty / 0.05) + 1);
    assert.equal(hooks.view().reload, null);
    assert.equal(hooks.view().empty, false);
    survival.inventory.current = 1;
    assert.equal(hooks.view(), null);
  } finally {
    setGunsEnabled(false, opts);
  }
});
