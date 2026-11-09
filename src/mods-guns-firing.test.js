// Guns mod (not 1.7.10): damage falloff, spread, the shot trace and the trigger/reload controller.
import test from "node:test";
import assert from "node:assert/strict";
import { damageAt, inaccuracyOf, spreadDirection, traceShot, GunController, fireShot, TICK, roundsPerMinute } from "./mods/guns/firing.js";
import { GUNS, P320, AKM, M870, AMMO_45ACP, AMMO_762X39, AMMO_12G, roundsLeft } from "./mods/guns/catalog.js";

// Seeded LCG so spread tests are repeatable.
const seeded = (seed = 1) => () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);

// A straight corridor along +x: solid blocks at the listed x cells, a mob box [x0, x1] on the axis.
function corridor({ walls = {}, mob = null } = {}) {
  const solid = { ...walls }, broken = [];
  return {
    broken,
    traceBlocks(start, end) {
      const dx = end[0] - start[0];
      if (!(dx > 0)) return null;
      for (let x = Math.floor(start[0]); x <= Math.floor(end[0]); x++) {
        if (solid[x] === undefined) continue;
        const hitX = Math.max(x, start[0]);
        if (hitX > end[0]) break;
        const t = (hitX - start[0]) / dx;
        return { block: [x, 0, 0], vec: start.map((v, i) => v + (end[i] - v) * t), id: solid[x], side: 4 };
      }
      return null;
    },
    pickEntity(origin, dir, maxDistance) {
      if (!mob || dir[0] <= 0) return null;
      const d = (mob.x0 - origin[0]) / dir[0];
      const y = origin[1] + dir[1] * d, z = origin[2] + dir[2] * d;
      if (Math.abs(y) > 0.5 || Math.abs(z) > 0.5 || d > maxDistance) return null;
      return { entity: mob.entity, distance: d };
    },
    breakGlass(block) { broken.push(block); delete solid[block[0]]; },
  };
}

test("damage follows TaCZ distance bands", () => {
  assert.equal(damageAt(GUNS[P320], 5), 10);
  assert.equal(damageAt(GUNS[P320], 20), 10);
  assert.equal(damageAt(GUNS[P320], 21), 7);
  assert.equal(damageAt(GUNS[P320], 200), 5);
  assert.equal(damageAt(GUNS[M870], 10) * 9, 36);
});

test("inaccuracy picks aim, then sneak, then move, then stand", () => {
  const g = GUNS[AKM];
  assert.equal(inaccuracyOf(g), 4.5);
  assert.equal(inaccuracyOf(g, { moving: true }), 5);
  assert.equal(inaccuracyOf(g, { moving: true, sneaking: true }), 2.5);
  assert.equal(inaccuracyOf(g, { sneaking: true, aiming: true }), 0.15);
});

test("spread stays inside the cone and stays a unit vector", () => {
  const random = seeded(7);
  for (const dir of [[1, 0, 0], [0, 1, 0], [0.6, -0.8, 0]]) {
    let widest = 0;
    for (let i = 0; i < 500; i++) {
      const d = spreadDirection(dir, 4.5, random);
      assert.ok(Math.abs(Math.hypot(...d) - 1) < 1e-9);
      const angle = (Math.acos(Math.min(1, d[0] * dir[0] + d[1] * dir[1] + d[2] * dir[2])) * 180) / Math.PI;
      assert.ok(angle <= 4.5 + 1e-6, `angle ${angle}`);
      widest = Math.max(widest, angle);
    }
    assert.ok(widest > 3, "the cone is actually used");
  }
  assert.deepEqual(spreadDirection([0, 0, 1], 0), [0, 0, 1]);
});

test("a shot hits the nearest mob, a wall in front stops it, and misses return null", () => {
  const zombie = { id: "z" };
  const hit = traceShot([0.5, 0, 0], [1, 0, 0], corridor({ mob: { x0: 10, entity: zombie } }));
  assert.equal(hit.entity, zombie);
  assert.ok(Math.abs(hit.distance - 9.5) < 1e-9);
  const blocked = traceShot([0.5, 0, 0], [1, 0, 0], corridor({ walls: { 6: 1 }, mob: { x0: 10, entity: zombie } }));
  assert.equal(blocked.entity, undefined);
  assert.deepEqual(blocked.block, [6, 0, 0]);
  assert.equal(traceShot([0.5, 0, 0], [1, 0, 0], corridor()), null);
  // A mob past the first 32-block segment is still found.
  assert.equal(traceShot([0.5, 0, 0], [1, 0, 0], corridor({ mob: { x0: 70, entity: zombie } })).entity, zombie);
  assert.equal(traceShot([0.5, 0, 0], [1, 0, 0], corridor({ mob: { x0: 200, entity: zombie } })), null); // past RANGE
});

test("shots break glass and panes and keep going, up to four of them", () => {
  const zombie = { id: "z" };
  // This game's internal ids: glass 9, glass pane 100, stained glass 140, stained glass pane 141.
  const panes = corridor({ walls: { 3: 9, 4: 100, 5: 140, 6: 141 }, mob: { x0: 10, entity: zombie } });
  assert.equal(traceShot([0.5, 0, 0], [1, 0, 0], panes).entity, zombie);
  assert.deepEqual(panes.broken.map((b) => b[0]), [3, 4, 5, 6]);
  const many = corridor({ walls: { 2: 9, 3: 9, 4: 9, 5: 9, 6: 9 }, mob: { x0: 10, entity: zombie } });
  const stopped = traceShot([0.5, 0, 0], [1, 0, 0], many);
  assert.deepEqual(stopped.block, [6, 0, 0]);
  assert.equal(many.broken.length, 4);
  const stone = corridor({ walls: { 3: 1 } });
  assert.deepEqual(traceShot([0.5, 0, 0], [1, 0, 0], stone).block, [3, 0, 0]);
  assert.equal(stone.broken.length, 0);
});

// Controller harness: a held gun stack and an inventory of ammo counts.
function harness(id, { damage = 0, ammo = 0, creative = false } = {}) {
  const stack = { id, count: 1, damage }, inv = { [GUNS[id].ammo]: ammo };
  const ctx = {
    held: stack, slot: 0, creative,
    count: (a) => inv[a] ?? 0,
    take: (a, n) => { if ((inv[a] ?? 0) < n) return false; inv[a] -= n; return true; },
  };
  const c = new GunController();
  const run = (ticks) => { const out = []; for (let i = 0; i < ticks; i++) out.push(...c.tick(ctx)); return out; };
  return { stack, inv, ctx, c, run };
}
const shots = (events) => events.filter((e) => e.type === "shot").length;
const ticksFor = (seconds) => Math.ceil(seconds / TICK - 1e-9);

test("drawing waits draw_time, then semi fires once per press", () => {
  const { c, run, stack } = harness(P320);
  c.press();
  const draw = run(ticksFor(GUNS[P320].draw));
  assert.equal(draw[0].type, "draw");
  assert.equal(shots(draw), 0); // holding the trigger through the draw does not fire
  c.release(); c.press();
  assert.equal(shots(run(40)), 1);
  c.release(); c.press();
  assert.equal(shots(run(40)), 1);
  assert.equal(roundsLeft(stack), 10);
});

test("automatic fire keeps TaCZ's rounds per minute in game ticks", () => {
  const { c, run, stack } = harness(AKM);
  run(ticksFor(GUNS[AKM].draw));
  c.press();
  assert.equal(shots(run(20)), 10); // 600 rpm = 10 per second
  assert.equal(roundsLeft(stack), 20);
  c.release();
  assert.equal(c.toggleMode(stack), "semi");
  c.press();
  assert.equal(shots(run(20)), 1);
  assert.equal(c.toggleMode({ id: P320 }), null); // single-mode guns do not toggle
});

test("fire rates between whole ticks average out", () => {
  const { c, run, stack } = harness(AKM, { creative: true });
  GUNS[AKM].rpm = 450; // P320's rate on an automatic gun
  try {
    run(ticksFor(GUNS[AKM].draw));
    c.press();
    assert.equal(shots(run(40)), 15); // 450 rpm = 7.5 per second
    assert.equal(roundsLeft(stack), 15);
  } finally { GUNS[AKM].rpm = 600; }
});

// Shot times, in seconds: the tick each fired on plus its offset inside that tick (TaCZ LocalPlayerShoot's timer).
function shotTimes(rpm, ticks, adjust) {
  const { c, ctx } = harness(AKM, { creative: true });
  const before = GUNS[AKM].rpm, beforeAdjust = GUNS[AKM].rpmAdjust;
  GUNS[AKM].rpm = rpm; GUNS[AKM].rpmAdjust = adjust;
  try {
    for (let i = 0; i < ticksFor(GUNS[AKM].draw); i++) c.tick(ctx);
    c.press();
    const times = [];
    for (let i = 0; i < ticks; i++) for (const e of c.tick(ctx)) if (e.type === "shot") times.push(i * TICK + e.at);
    return times;
  } finally { GUNS[AKM].rpm = before; GUNS[AKM].rpmAdjust = beforeAdjust; }
}
const gaps = (times) => times.slice(1).map((t, i) => t - times[i]);

test("shots between whole ticks keep even gaps inside their ticks", () => {
  for (const rpm of [450, 750, 900]) {
    const times = shotTimes(rpm, 60);
    assert.equal(times[0], 0); // a fresh trigger pull fires at once
    for (const g of gaps(times)) assert.ok(Math.abs(g - 60 / rpm) < 1e-9, `${rpm} rpm gap ${g}`);
  }
  assert.deepEqual(shotTimes(600, 10).map((t) => Math.round(t / TICK * 1e6) / 1e6), [0, 2, 4, 6, 8]); // still whole ticks
});

test("fire_mode_adjust changes a mode's rounds per minute", () => {
  assert.equal(roundsPerMinute({ rpm: 350, rpmAdjust: { auto: 300 } }, "auto"), 650); // FN FAL
  assert.equal(roundsPerMinute({ rpm: 350, rpmAdjust: { auto: 300 } }, "semi"), 350);
  assert.equal(roundsPerMinute({ rpm: 300, rpmAdjust: { semi: -400 } }, "semi"), 300); // not positive: TaCZ's 300
  assert.equal(roundsPerMinute({ rpm: 600 }, "auto"), 600);
  for (const g of gaps(shotTimes(350, 40, { auto: 300 }))) assert.ok(Math.abs(g - 60 / 650) < 1e-9);
});

test("an empty gun clicks once per press, then a magazine reload takes ammo", () => {
  const { c, run, stack, ctx, inv } = harness(AKM, { damage: 30, ammo: 20 });
  run(ticksFor(GUNS[AKM].draw));
  c.press();
  const dry = run(10);
  assert.equal(shots(dry), 0);
  assert.equal(dry.filter((e) => e.type === "empty").length, 1);
  c.release();
  assert.equal(c.startReload(ctx), true);
  assert.equal(c.startReload(ctx), false); // already reloading
  const before = run(ticksFor(GUNS[AKM].reload.empty) - 1);
  assert.equal(before.some((e) => e.type === "reloaded"), false);
  const done = run(1);
  assert.equal(done.find((e) => e.type === "reloaded").rounds, 20);
  assert.equal(roundsLeft(stack), 20);
  assert.equal(inv[AMMO_762X39], 0);
  assert.equal(c.startReload(ctx), false); // no ammo left
});

test("a tactical reload is shorter and adds the chamber round, no ammo does not reload, creative reloads free", () => {
  const a = harness(P320, { damage: 4, ammo: 60 });
  a.run(ticksFor(GUNS[P320].draw));
  assert.equal(a.c.startReload(a.ctx), true);
  assert.equal(a.run(ticksFor(GUNS[P320].reload.tactical)).some((e) => e.type === "reloaded"), true);
  assert.equal(a.inv[AMMO_45ACP], 55);
  assert.equal(roundsLeft(a.stack), 13);
  assert.equal(a.c.startReload(a.ctx), false); // full
  const b = harness(P320, { damage: 4 });
  b.run(ticksFor(GUNS[P320].draw));
  assert.equal(b.c.startReload(b.ctx), false);
  const cr = harness(P320, { damage: 12, creative: true });
  cr.run(ticksFor(GUNS[P320].draw));
  assert.equal(cr.c.startReload(cr.ctx), true);
  cr.run(ticksFor(GUNS[P320].reload.empty));
  assert.equal(roundsLeft(cr.stack), 12);
});

test("switching slots cancels a reload and redraws", () => {
  const { c, run, ctx, stack } = harness(P320, { damage: 12, ammo: 12 });
  run(ticksFor(GUNS[P320].draw));
  c.startReload(ctx);
  run(10);
  ctx.slot = 1;
  assert.equal(run(1)[0].type, "draw");
  assert.equal(c.reload, null);
  assert.equal(roundsLeft(stack), 0);
});

test("the shotgun loads shell by shell and the trigger interrupts it", () => {
  const { c, run, ctx, stack, inv } = harness(M870, { damage: 5, ammo: 3 });
  run(ticksFor(GUNS[M870].draw));
  assert.equal(c.startReload(ctx), true);
  const first = run(ticksFor(GUNS[M870].reload.start));
  assert.equal(first.filter((e) => e.type === "shell").length, 1);
  run(ticksFor(GUNS[M870].reload.perShell));
  assert.equal(roundsLeft(stack), 2);
  c.press(); // fire with two shells in
  assert.equal(c.reload, null);
  assert.equal(shots(run(1)), 1);
  assert.equal(inv[AMMO_12G], 1);
  c.release();
  run(ticksFor(60 / GUNS[M870].rpm));
  c.startReload(ctx);
  const rest = run(40);
  assert.equal(rest.filter((e) => e.type === "shell").length, 1); // only one shell left in the inventory
  assert.equal(rest.filter((e) => e.type === "reloaded").length, 1);
  assert.equal(roundsLeft(stack), 2);
});

test("shotgun pellets sum per mob with the headshot multiplier", () => {
  const zombie = { id: "z" };
  const world = corridor({ mob: { x0: 5.5, entity: zombie } });
  const out = fireShot(GUNS[M870], { ...world, origin: [0.5, 0, 0], dir: [1, 0, 0], random: seeded(3), aiming: false, isHead: () => false });
  // At 5 blocks a 3.65 degree cone stays inside the half-block-wide box, so every pellet lands.
  assert.equal(out.hits.length, 1);
  assert.equal(out.hits[0].amount, 36);
  assert.equal(out.impacts.length, 9);
  const head = fireShot(GUNS[P320], { ...corridor({ mob: { x0: 5.5, entity: zombie } }), origin: [0.5, 0, 0], dir: [1, 0, 0], random: seeded(3), aiming: true, isHead: () => true });
  assert.deepEqual([head.hits[0].amount, head.hits[0].head], [10 * 1.75, true]);
});

test("the main.js glue reloads from the inventory, credits the player and breaks glass in the way", async () => {
  const { createGunHooks } = await import("./mods/guns/hooks.js");
  const { Survival, ITEMS, setExtraCrafting } = await import("./survival.js");
  const { CREATIVE_TABS, SEARCH_ORDER } = await import("./creative.js");
  const { setGunsEnabled } = await import("./mods/guns/install.js");
  setGunsEnabled(true, { items: ITEMS, combatTab: CREATIVE_TABS[8].items, search: SEARCH_ORDER, setCrafting: setExtraCrafting });
  try {
    const survival = new Survival({ slots: [{ id: AKM, count: 1, damage: 30 }, { id: AMMO_762X39, count: 10, damage: 0 }, { id: AMMO_762X39, count: 25, damage: 0 }] }, "survival");
    const blocks = new Map([["5,63,0", 9]]); // a glass block between the player and the zombie
    const world = {
      get: (x, y, z) => blocks.get(`${x},${y},${z}`) ?? 0, getMeta: () => 0,
      solid(x, y, z) { return this.get(x, y, z) !== 0; },
    };
    const zombie = { type: "zombie", x: 10.5, y: 63, z: 0.5, health: 20 }, hits = [], broken = [];
    const mobs = {
      pick: (o, d, max) => { const t = (zombie.x - 0.3 - o.x) / d.x; return t > 0 && t <= max ? { entity: zombie, distance: t } : null; },
      attackEntityFrom: (e, amount, source) => { hits.push({ e, amount, source }); e.health -= amount; return true; },
    };
    let renders = 0, eyeY = 63.8; // chest height, below the zombie's eye line (63 + 1.8 * 0.85)
    const hooks = createGunHooks({
      survival, world, mobs, random: () => 0, eye: () => ({ origin: [0.5, eyeY, 0.5], dir: [1, 0, 0] }), playerPos: () => ({ x: 0.5, z: 0.5 }),
      sneaking: () => true, moving: () => false, breakBlock: (p) => { broken.push(p); blocks.delete(p.join(",")); },
      renderHotbar: () => renders++, markUnsaved() {}, toast() {},
    });
    const tick = (n) => { for (let i = 0; i < n; i++) hooks.tick(); };
    tick(ticksFor(GUNS[AKM].draw));
    assert.equal(hooks.key(19), true); // R
    tick(ticksFor(GUNS[AKM].reload.empty));
    assert.equal(roundsLeft(survival.inventory.held), 30);
    assert.equal(survival.inventory.count(AMMO_762X39), 5); // 30 of 35 rounds, from both stacks
    assert.equal(hooks.key(34), true); // G: semi
    assert.equal(hooks.attack(true), true);
    tick(1);
    hooks.attack(false);
    assert.deepEqual(broken, [[5, 63, 0]]);
    assert.equal(hits.length, 1);
    assert.equal(hits[0].source.player, true); // XP and loot credit
    assert.equal(hits[0].source.from, undefined); // rifles do not knock back
    assert.equal(hits[0].amount, 9);
    assert.equal(roundsLeft(survival.inventory.held), 29);
    assert.ok(renders > 0);
    eyeY = 64.5; // head height: TaCZ's 1.5x
    tick(ticksFor(60 / GUNS[AKM].rpm));
    hooks.attack(true); tick(1); hooks.attack(false);
    assert.equal(hits[1].amount, 9 * 1.5);
    tick(ticksFor(60 / GUNS[AKM].rpm));
    zombie.health = 20; // the first two shots killed it
    assert.equal(hooks.tap(), true); // a click without pointer lock: one trigger pull
    tick(3);
    assert.equal(hits.length, 3);
    assert.equal(hooks.controller.trigger, false);
    survival.inventory.current = 1; // ammo in hand: vanilla input again
    assert.equal(hooks.attack(true), false);
    assert.equal(hooks.key(19), false);
  } finally {
    setGunsEnabled(false, { items: ITEMS, combatTab: CREATIVE_TABS[8].items, search: SEARCH_ORDER, setCrafting: setExtraCrafting });
  }
});
