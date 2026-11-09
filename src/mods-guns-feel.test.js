// Guns mod (not 1.7.10): recoil curves, aiming, sound scheduling and the SoundBank install of the local TaCZ sounds.
import test from "node:test";
import assert from "node:assert/strict";
import { naturalSpline, recoilCurve, recoilModifier, Recoil, Aim, SoundSchedule, RECOIL, IRON_ZOOM, GUN_SOUNDS } from "./mods/guns/feel.js";
import { installGunSounds, gunSoundEvent } from "./mods/guns/sounds.js";
import { inaccuracyOf, TICK } from "./mods/guns/firing.js";
import { GUNS, P320, AKM, M870, AMMO_12G } from "./mods/guns/catalog.js";

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);
const ticksFor = (s) => Math.round(s / TICK);

test("the natural cubic spline goes through its knots with straight ends", () => {
  const xs = [0, 30, 180, 430, 630, 1030], ys = [0, 1, 1, -0.1, 0.175, 0], f = naturalSpline(xs, ys);
  xs.forEach((x, i) => close(f(x), ys[i]));
  assert.equal(f(-1), null);
  assert.equal(f(1031), null);
  // Second derivative zero at both ends: the curve is locally linear there.
  const d2 = (x, h = 1e-3) => (f(x + h) - 2 * f(x) + f(x - h)) / (h * h);
  close(d2(1e-3 * 2), 0, 1e-4);
  close(d2(1030 - 1e-3 * 2), 0, 1e-4);
  // Collinear knots give back the line.
  const g = naturalSpline([0, 1, 3, 7], [1, 3, 7, 15]);
  for (const x of [0.5, 2, 5.5]) close(g(x), 1 + 2 * x, 1e-9);
});

test("recoil curves start 30 ms in, scale with aiming and add up to TaCZ's kick", () => {
  const f = recoilCurve(RECOIL[AKM].pitch, 1, () => 0);
  close(f(0), 0);
  close(f(30), 0.8); // first keyframe, 30 ms after the shot
  close(f(130), 1.4);
  close(f(630), 0); // recovered at the end
  assert.equal(f(631), null);
  close(recoilModifier(AKM, 0), 1);
  close(recoilModifier(AKM, 1), 1 / Math.sqrt(IRON_ZOOM[AKM]));
  // Frame deltas sum to the curve value; the view ends where it started once the curve is over.
  const r = new Recoil();
  r.kick(M870, 0, 1000, () => 0);
  let pitch = 0, yaw = 0, peak = 0;
  for (let t = 1000; t <= 1800; t += 16) { const [dp, dy] = r.frame(t); pitch += dp; yaw += dy; peak = Math.max(peak, pitch); }
  close(pitch, 0, 1e-9);
  close(yaw, 0, 1e-9);
  assert.ok(peak > 5, `M870 kick ${peak}`);
  assert.equal(r.active, false);
  // A second shot mid-curve restarts from zero but keeps the view where the first left it.
  r.kick(P320, 0, 0, () => 0.5);
  const [a] = r.frame(30);
  r.kick(P320, 0, 30, () => 0.5);
  const [b] = r.frame(60);
  close(a, 1); close(b, 1);
});

test("aiming moves over the gun's aim time, zooms the view and narrows the spread", () => {
  const gun = GUNS[AKM], aim = new Aim();
  aim.held = true;
  for (let i = 0; i < ticksFor(gun.aim) - 1; i++) aim.tick(gun);
  assert.ok(aim.progress < 1);
  aim.tick(gun); aim.tick(gun);
  assert.equal(aim.progress, 1);
  close(aim.fov(AKM), 1 / IRON_ZOOM[AKM]);
  close(inaccuracyOf(gun, { aiming: aim.progress }), gun.inaccuracy.aim);
  close(inaccuracyOf(gun, { aiming: 0.5, sneaking: true }), (gun.inaccuracy.sneak + gun.inaccuracy.aim) / 2);
  close(inaccuracyOf(gun, { aiming: true }), gun.inaccuracy.aim);
  aim.held = false;
  for (let i = 0; i < ticksFor(gun.aim) + 1; i++) aim.tick(gun);
  assert.equal(aim.progress, 0);
  assert.equal(aim.fov(AKM), 1);
  aim.held = true; aim.tick(gun); aim.tick(null);
  assert.equal(aim.progress, 0); // putting the gun away drops the aim
});

test("sound keyframes play on their tick and a tag can be cancelled", () => {
  const s = new SoundSchedule();
  s.add([[0, "a"], [0.1, "b"], [0.12, "c"]], (f) => `x.${f}`, "reload");
  s.add([[0.05, "p"]], (f) => f, "pump");
  assert.deepEqual(s.tick(), ["x.a"]);
  assert.deepEqual(s.tick(), ["p"]);
  assert.deepEqual(s.tick(), ["x.b"]);
  s.cancel("reload");
  assert.deepEqual([s.tick(), s.tick()], [[], []]);
  // Every keyframe names a file the gun's folder ships.
  for (const sounds of Object.values(GUN_SOUNDS))
    for (const v of Object.values(sounds)) for (const k of [].concat(v)) assert.equal(typeof (Array.isArray(k) ? k[1] : k), "string");
});

test("installGunSounds adds the TaCZ files to the base and live tables once", async () => {
  const bank = { ready: Promise.resolve(), base: { files: {}, events: {} }, manifest: { files: { x: {} }, events: {} } };
  let loads = 0;
  const load = async (url) => { loads++; return url === "/mods/tacz/index.json" ? { guns: [], sounds: ["ak47/ak47_shoot", "dry_fire"] } : { packs: [{ namespace: "test", sounds: ["melee/draw"] }] }; };
  assert.equal(await installGunSounds(bank, load), true);
  assert.equal(await installGunSounds(bank, load), true);
  assert.equal(loads, 4);
  for (const t of [bank.base, bank.manifest]) {
    assert.deepEqual(t.files["mods/tacz/ak47/ak47_shoot"], { url: "/mods/tacz/pack/assets/tacz/tacz_sounds/ak47/ak47_shoot.ogg" });
    assert.deepEqual(t.events[gunSoundEvent("dry_fire")], { category: "player", sounds: ["mods/tacz/dry_fire"] });
    assert.deepEqual(t.files["mods/lrtactical/test/melee/draw"], { url: "/mods/lrtactical/test/assets/test/tacz_sounds/melee/draw.ogg" });
    assert.deepEqual(t.events[gunSoundEvent("test:melee/draw")], { category: "player", sounds: ["mods/lrtactical/test/melee/draw"] });
  }
  const missing = { ready: Promise.resolve(), base: { files: {}, events: {} }, manifest: { files: {}, events: {} } };
  assert.equal(await installGunSounds(missing, async () => null), false); // not fetched: silent guns
});

test("the glue aims on use, kicks the view, plays the gun's sounds and shows effects", async () => {
  const { createGunHooks } = await import("./mods/guns/hooks.js");
  const { Survival, ITEMS, setExtraCrafting } = await import("./survival.js");
  const { CREATIVE_TABS, SEARCH_ORDER } = await import("./creative.js");
  const { setGunsEnabled } = await import("./mods/guns/install.js");
  setGunsEnabled(true, { items: ITEMS, combatTab: CREATIVE_TABS[8].items, search: SEARCH_ORDER, setCrafting: setExtraCrafting });
  try {
    const survival = new Survival({ slots: [{ id: M870, count: 1, damage: 3 }, { id: AMMO_12G, count: 10, damage: 0 }] }, "survival");
    const blocks = new Map([["8,63,0", 1]]); // a stone wall ahead
    const world = { get: (x, y, z) => blocks.get(`${x},${y},${z}`) ?? 0, getMeta: () => 0, solid(x, y, z) { return this.get(x, y, z) !== 0; } };
    const mobs = { pick: () => null, attackEntityFrom: () => true };
    const sounds = [], fx = [], blockHits = [], crosshair = [];
    let clock = 0;
    const hooks = createGunHooks({
      survival, world, mobs, random: () => 0.5, eye: () => ({ origin: [0.5, 63.5, 0.5], dir: [1, 0, 0] }), playerPos: () => ({ x: 0.5, z: 0.5 }),
      sneaking: () => false, moving: () => false, breakBlock() {}, renderHotbar() {}, markUnsaved() {}, toast() {},
      sound: (e) => sounds.push(e), fx: (name) => fx.push(name), blockHit: (b, side) => blockHits.push([b, side]),
      crosshair: (v) => crosshair.push(v), now: () => clock,
    });
    const tick = (n) => { for (let i = 0; i < n; i++) { hooks.tick(); clock += 50; } };
    tick(ticksFor(GUNS[M870].draw));
    assert.deepEqual(sounds.splice(0), ["guns.m870/m870_draw"]);
    // Use aims: the crosshair hides, the zoom reaches the iron sights.
    assert.equal(hooks.aimHold(true), true);
    tick(ticksFor(GUNS[M870].aim) + 1);
    assert.deepEqual(crosshair, [false]);
    close(hooks.fov(), 1 / IRON_ZOOM[M870]);
    hooks.attack(true); tick(1); hooks.attack(false);
    assert.deepEqual(sounds.splice(0), ["guns.m870/m870_shoot"]);
    assert.ok(fx.includes("flame") && fx.includes("smoke"));
    assert.ok(blockHits.length >= 9 && blockHits.every(([b, side]) => b.join() === "8,63,0" && side === 4)); // the west face
    const [kick] = hooks.frame(); // 50 ms after the shot, on the way up to the first 5.5 degree keyframe
    assert.ok(kick > 0, "the view kicks up");
    tick(ticksFor(0.7));
    assert.deepEqual(sounds.splice(0), ["guns.m870/m870_bolt_in", "guns.m870/m870_bolt_out", "guns.m870/12_gauge_shotgun_shell_drop"]);
    // A shell reload: the intro, one shell-in per shell, then the end; the trigger stops it.
    assert.equal(hooks.key(19), true);
    tick(ticksFor(GUNS[M870].reload.start) + 1);
    assert.equal(sounds[0], "guns.m870/m870_reload_start_twist");
    assert.ok(sounds[1].startsWith("guns.m870/m870_reload_loop_shellin_"));
    hooks.attack(true); tick(1); hooks.attack(false);
    assert.ok(sounds.includes("guns.m870/m870_shoot"));
    hooks.aimHold(false);
    tick(ticksFor(GUNS[M870].aim) + 1);
    assert.deepEqual(crosshair, [false, true]);
    assert.equal(hooks.fov(), 1);
    // Empty magazine: dry fire.
    survival.inventory.held.damage = GUNS[M870].magazine;
    sounds.length = 0;
    tick(20);
    hooks.attack(true); tick(1); hooks.attack(false);
    assert.ok(sounds.includes("guns.dry_fire"));
    // Not a gun: use is vanilla again.
    survival.inventory.current = 1;
    assert.equal(hooks.aimHold(true), false);
  } finally {
    setGunsEnabled(false, { items: ITEMS, combatTab: CREATIVE_TABS[8].items, search: SEARCH_ORDER, setCrafting: setExtraCrafting });
  }
});
