import { readFileSync } from "node:fs";
import { EntityWorld } from "./entities.js";
import { Survival } from "./survival.js";
import { ItemEntities } from "./item-entities.js";
import { Arrows } from "./bow.js";
import { ExperienceOrbs, newOrb } from "./experience.js";
import { primeTnt, explodeTnt, TNT_Y_OFFSET } from "./explosion.js";
import { entityWalkers, finishEntitySimulation } from "./entity-simulation.js";
import { plain } from "./legacy-ai-replay.js";

// Replays one EntityListProbe record (public/research/entity-list-reference.json, tools/probes/EntityListProbe.java): the unchanged EntityItem, EntityXPOrb,
// EntityTNTPrimed and EntityArrow walked in World.loadedEntityList order, against the walk in EntityWorld.tickMobs (`mobs.walks`, entity-simulation.js
// entityWalkers). The scenarios exist in both list orders to show the order is observable. Row per tick: [entities (creation order) [posY (the feet
// for an arrow), motion, isDead, kind fields], explosions [x, y, z, power], player [xp, xpCooldown]].
export const entityListReference = JSON.parse(readFileSync(new URL("../public/research/entity-list-reference.json", import.meta.url))).cases;
const STONE = 3, YOFF = { item: 0.125, tnt: TNT_Y_OFFSET };

export function replayEntityList(c, onBoom = null) {
  const ew = new EntityWorld(plain([]), [], () => 0.5);
  ew.brightnessLevel = () => 15; // the probe world's light
  ew.isDaytime = () => false;
  ew.ai.player.unticked = true;
  const world = ew.world, rand = () => 0.5;
  const items = new ItemEntities(rand), arrows = new Arrows(), xpOrbs = new ExperienceOrbs([], rand), primed = [], booms = [];
  const survival = new Survival({}, "survival"), player = { x: 0.5, y: 0, z: 0.5, health: 20, alive: true, width: 0.6, height: 1.8, isPlayer: true };
  let xp = 0;
  const hooks = { explodeTnt: (x, y, z, power, who) => { booms.push([x, y, z, power]); explodeTntAll(world, primed, who.exploder, x, y, z, power); items.explode(world, x, y, z, power); onBoom?.(items); }, maxStack: () => 64 };
  const state = { world, items, arrows, primed, xpOrbs, projectiles: { balls: [], drain: () => [], reap() {}, tickEffects() {} }, mobs: ew, survival, position: player };
  const ctx = { state, hooks };
  ew.walks = entityWalkers(() => ctx);
  items.joined = (e) => ew.joined(e, "item"); arrows.joined = (e) => ew.joined(e, "arrow"); xpOrbs.joined = (e) => ew.joined(e, "orb");
  const made = c.specs.map((s) => {
    const [kind, x, y, z, vx, vy, vz, a, b, join] = s, at = { kind, x, y, z, vx, vy, vz, a, b, join };
    return { at, entity: null };
  });
  // `build` makes the entity as its constructor does (it exists before it joins the list); `join` is World.spawnEntityInWorld.
  const build = (m) => {
    const { kind, x, y, z, vx, vy, vz, a, b } = m.at;
    if (kind === "item") { const it = items.spawn({ id: STONE, count: a, damage: 0 }, x, y, z, { motion: [vx, vy, vz] }); items.items.pop(); it.age = b; m.add = () => { items.items.push(it); items.joined(it); }; m.entity = it; }
    else if (kind === "orb") { const o = newOrb(a, x, y, z, () => 0); [o.vx, o.vy, o.vz] = [vx, vy, vz]; m.add = () => { xpOrbs.orbs.push(o); xpOrbs.joined(o); }; m.entity = o; }
    else if (kind === "tnt") { const t = primeTnt(x, y, z, { fuse: a, random: () => 0 }); [t.vx, t.vy, t.vz] = [vx, vy, vz]; m.add = () => { primed.push(t); ew.joined(t, "tnt"); }; m.entity = t; }
    else if (kind === "arrow") { const ar = arrows.make({ x, y, z, mx: vx, my: vy, mz: vz, yaw: 0, pitch: 0 }, arrows.rng(), {}); m.add = () => { arrows.list.push(ar); arrows.joined(ar); }; m.entity = ar; }
    else throw new Error(kind);
  };
  for (const m of made) build(m);
  const rows = [];
  for (let t = 0; t < c.ticks; t++) {
    for (const m of made) if (m.at.join === t) m.add();
    booms.length = 0;
    ew.tickMobs(player, survival);
    finishEntitySimulation(state, hooks);
    if (xpOrbs.orbs.length || made.some((m) => m.at.kind === "orb")) { xp += xpOrbs.collect({ x: 0.5, y: 0, z: 0.5 }); }
    rows.push([made.map((m) => view(m, primed)), booms.map((b) => [...b]), made.some((m) => m.at.kind === "orb") ? [xp, xpOrbs.cooldown] : []]);
  }
  return rows;
}
function explodeTntAll(world, primed, exploder, x, y, z, power) { for (const e of primed) if (e !== exploder) explodeTnt(world, e, x, y, z, power); }
// EntityXPOrb.getTextureByXP (sq.f): the icon index of the value.
const texture = (v) => [2477, 1237, 617, 307, 149, 73, 37, 17, 7, 3].findIndex((n) => v >= n) < 0 ? 0 : 10 - [2477, 1237, 617, 307, 149, 73, 37, 17, 7, 3].findIndex((n) => v >= n);
function view(m, primed) {
  const e = m.entity;
    const { kind } = m.at, y = e.posY ?? e.y + (YOFF[kind] ?? 0);
  if (kind === "item") return [e.x, y, e.z, e.mx, e.my, e.mz, e.dead ? 1 : 0, e.stack.count, e.age, e.delay];
  if (kind === "tnt") return [e.x, y, e.z, e.vx, e.vy, e.vz, !primed.includes(e) && e.fuse < 0 ? 1 : 0, e.fuse];
  if (kind === "orb") return [e.x, e.posY, e.z, e.vx, e.vy, e.vz, e.dead ? 1 : 0, e.color, texture(e.value)];
  return [e.x, e.y, e.z, e.mx, e.my, e.mz, e.dead ? 1 : 0, e.inGround ? 1 : 0, e.pickup];
}

/** First difference between a record and a replay: [tick, entity index, field] or null. */
export function entityListDivergence(c, rows) {
  for (let t = 0; t < c.ticks; t++) {
    const want = c.rows[t], got = rows[t];
    for (let i = 0; i < want[0].length; i++) {
      const a = want[0][i], b = got[0][i];
      for (let k = 0; k < a.length; k++) if (!Object.is(a[k] + 0, (b?.[k] ?? NaN) + 0)) return [t, i, k, a[k], b?.[k]];
    }
    if (JSON.stringify(want[1]) !== JSON.stringify(got[1])) return [t, "booms", want[1], got[1]];
    if (JSON.stringify(want[2]) !== JSON.stringify(got[2])) return [t, "player", want[2], got[2]];
  }
  return null;
}
