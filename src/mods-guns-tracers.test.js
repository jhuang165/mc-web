// Guns mod (not 1.7.10): TaCZ tracer rounds (tracers.js), their pack data (pack.js, install.js) and the shot glue (hooks.js).
import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { tracerBox, tracerColor, isTracerRound, GunTracers } from "./mods/guns/tracers.js";
import { taczGun } from "./mods/guns/pack.js";
import { setGunPack, gunPack } from "./mods/guns/install.js";
import { fireShot, TICK } from "./mods/guns/firing.js";
import { GUNS, AKM, M870 } from "./mods/guns/catalog.js";

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);

test("a tracer flies at the bullet speed, trails 0.85 ticks of flight and widens past 3.5 blocks (EntityBulletRenderer)", () => {
  const t = { origin: [0, 0, 0], dir: [1, 0, 0], distance: 100, speed: 250, life: 0.8 };
  assert.equal(tracerBox(t, 0), null); // still in the gun
  assert.equal(tracerBox(t, 0.008), null); // 2 blocks out in its first 5 ticks: hidden
  const a = tracerBox(t, 0.012); // 3 blocks out: L = 0.8 * 3, w = 0.005
  near(a.head[0], 3); near(a.tail[0], 0.6); near(a.width, 0.005);
  const slow = tracerBox({ ...t, speed: 5 }, 0.3); // 1.5 blocks out after 6 ticks: drawn
  near(slow.head[0], 1.5);
  const b = tracerBox(t, 0.2); // 50 blocks out: L = 0.85 * 12.5, w = 0.005 * 50 / 3.5
  near(b.head[0], 50); near(b.head[0] - b.tail[0], 0.85 * 250 / 20); near(b.width, 0.005 * 50 / 3.5);
  assert.equal(tracerBox(t, 0.4), null); // past the hit at 100 blocks
  assert.equal(tracerBox({ ...t, distance: 1000 }, 0.81), null); // its life is over
});

test("in first person a tracer leaves the muzzle and joins the shot's line by 50 blocks", () => {
  const t = { origin: [0, 0, 0], dir: [0, 0, -1], distance: 120, speed: 100, offset: [0.2, -0.1, 0] };
  const a = tracerBox(t, 0.1); // 10 blocks: four fifths of the offset left
  near(a.head[0], 0.16); near(a.head[1], -0.08); near(a.head[2], -10);
  const b = tracerBox(t, 0.6); // 60 blocks: on the line
  near(b.head[0], 0); near(b.head[1], 0);
});

test("tracer colours and the every-nth-round rule", () => {
  assert.equal(tracerColor("#FF8888"), 0xff8888);
  assert.equal(tracerColor("nonsense"), 0xffffff);
  assert.deepEqual([0, 1, 2].map((n) => isTracerRound(0, n)), [true, true, true]);
  assert.deepEqual([0, 1, 2, 3].map((n) => isTracerRound(1, n)), [true, false, true, false]);
  assert.equal(isTracerRound(-1, 0), false);
});

test("the boxes follow their bullets in the scene and go once they land", () => {
  const scene = new THREE.Scene(), tracers = new GunTracers(scene);
  tracers.spawn({ origin: [0, 64, 0], dir: [1, 0, 0], distance: 20, speed: 200, color: "#88FF88" }, 1000);
  tracers.update(1005);
  assert.equal(tracers.live.length, 1); // 1 block out: kept, not drawn
  assert.equal(tracers.live[0].mesh.visible, false);
  tracers.update(1050); // 10 blocks out
  const m = tracers.live[0].mesh;
  assert.equal(m.visible, true);
  near(m.position.x, 10 - 8 / 2, 1e-6); // L = min(0.85 * 10, 0.8 * 10), centred behind the head
  near(m.scale.z, 8, 1e-6);
  assert.equal(m.material.color.getHex(), 0x88ff88);
  tracers.update(1200); // past the hit at 20 blocks
  assert.equal(tracers.live.length, 0);
  assert.equal(tracers.group.children.length, 0);
});

test("pack guns carry their bullet speed, tracer interval and colour, else their round's colour", () => {
  const entry = (bullet, display = {}) => ({
    index: { name: "x", type: "rifle" },
    data: { ammo: "tacz:762x39", ammo_amount: 30, bullet: { damage: 5, ...bullet } },
    display: { model: "m", texture: "t", slot: "tacz:gun/slot/ak47", ...display },
  });
  const ak = taczGun("ak47", entry({ speed: 250, life: 0.8, tracer_count_interval: 0 }, { ammo: { tracer_color: "#FF8888" } }));
  assert.deepEqual(ak.pack.tracer, { speed: 250, life: 0.8, interval: 0, color: "#FF8888" });
  const plain = taczGun("ak47", entry({}));
  assert.deepEqual(plain.pack.tracer, { speed: 250, life: 10, interval: -1, color: null });
  const raw = {
    index: {}, lang: {},
    guns: { m4a1: { ...entry({ speed: 300, tracer_count_interval: 2 }), data: { ...entry({ speed: 300, tracer_count_interval: 2 }).data, ammo: "tacz:556x45" } } },
    ammo: { "556x45": { index: { name: "y", stack_size: 60 }, display: { slot: "s", tracer_color: "#FFFF88" } } },
  };
  setGunPack(raw);
  try {
    const g = gunPack().guns.find((x) => x.key === "m4a1");
    assert.deepEqual(g.pack.tracer, { speed: 300, life: 10, interval: 2, color: "#FFFF88" });
  } finally { setGunPack(null); }
});

test("every pellet records its flight for a tracer, hit or miss", () => {
  const ctx = { origin: [0.5, 64, 0.5], dir: [1, 0, 0], random: () => 0.5, traceBlocks: () => null, pickEntity: () => null, breakGlass() {} };
  const out = fireShot(GUNS[M870], ctx);
  assert.equal(out.paths.length, GUNS[M870].pellets);
  assert.ok(out.paths.every((p) => p.distance === 128 && Math.abs(Math.hypot(...p.dir) - 1) < 1e-9));
});

test("a shot sends one tracer from the muzzle per pellet", async () => {
  const { createGunHooks } = await import("./mods/guns/hooks.js");
  const { Survival, ITEMS, setExtraCrafting } = await import("./survival.js");
  const { CREATIVE_TABS, SEARCH_ORDER } = await import("./creative.js");
  const { setGunsEnabled } = await import("./mods/guns/install.js");
  const opts = { items: ITEMS, combatTab: CREATIVE_TABS[8].items, search: SEARCH_ORDER, setCrafting: setExtraCrafting };
  setGunsEnabled(true, opts);
  try {
    const survival = new Survival({ slots: [{ id: AKM, count: 1, damage: 0 }] }, "survival");
    const world = { get: () => 0, getMeta: () => 0, solid: () => false };
    const mobs = { pick: () => null, attackEntityFrom: () => false };
    const sent = [];
    const hooks = createGunHooks({
      survival, world, mobs, random: () => 0.5, eye: () => ({ origin: [0.5, 64, 0.5], dir: [1, 0, 0] }), playerPos: () => ({ x: 0.5, z: 0.5 }),
      sneaking: () => false, moving: () => false, breakBlock() {}, renderHotbar() {}, markUnsaved() {}, toast() {}, tracer: (t) => sent.push(t),
    });
    for (let i = 0; i < Math.ceil(GUNS[AKM].draw / TICK) + 1; i++) hooks.tick();
    hooks.attack(true); hooks.tick(); hooks.attack(false);
    assert.equal(sent.length, 1);
    const [t] = sent;
    assert.deepEqual(t.origin, [0.5, 64, 0.5]);
    assert.equal(t.distance, 128);
    assert.equal(t.speed, 250); // no pack: the white rifle-speed default
    assert.equal(t.color, "#FFFFFF");
    near(t.offset[0], 0, 1e-9); // the muzzle sits beside and below the eye line, not ahead of it
    assert.ok(Math.hypot(...t.offset) > 0);
  } finally {
    setGunsEnabled(false, opts);
  }
});
