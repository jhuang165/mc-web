import { readFileSync } from "node:fs";
import { awayEntities } from "./away-entities.js";
import { plain } from "./legacy-ai-replay.js";
import { Weather } from "./weather.js";
import { newOrb } from "./experience.js";
import { setEntityRandom } from "./entities.js";
import { JavaRandom } from "./java-random.js";

// Replays one AwayOrderProbe record (public/research/away-order-reference.json, tools/probes/AwayOrderProbe.java) against the away run's own entity systems:
// awayEntities() (src/away-entities.js) builds the items, orbs, arrows, carts, boats, hanging entities and mobs, and `ents.tick()` is one away tick (the one list walk
// and the drains after it). The records are those of entity-list-reference.json (same row layout, same probe world: a stone floor under y = 0, light 15, a cow with no AI).
export const awayOrderReference = JSON.parse(readFileSync(new URL("../public/research/away-order-reference.json", import.meta.url))).cases;
const STONE = 3, PORT_ID = { 1: 3 };
const texture = (v) => [2477, 1237, 617, 307, 149, 73, 37, 17, 7, 3].findIndex((n) => v >= n) < 0 ? 0 : 10 - [2477, 1237, 617, 307, 149, 73, 37, 17, 7, 3].findIndex((n) => v >= n);
const seven = () => { const r = new JavaRandom(7); return () => r.nextFloat(); }; // Entity.rand of every probe entity: Random(7)

export function replayAwayOrder(c, { entityRand = true } = {}) {
  const world = plain([]), weather = new Weather();
  const tiles = { furnaces: {}, chests: {}, dispensers: {}, brewing: {}, hoppers: {} };
  const rt = { redstone: { collide() {} }, flush() {}, fluidChanges() {} };
  const ents = awayEntities({ entities: {}, editSequence: 0, ticks: 0, idBase: 1 }, { world, ticking: () => true, entityTicks: () => true, rt, fire: { ignite() {} }, weather, tiles, readStack: (s) => s, maxStack: () => 64 });
  const { items, xp, arrows, minecarts, boats, hanging, mobs } = ents;
  mobs.ai.think = () => {}; // the probe's cow has no AI task list
  mobs.brightnessLevel = () => 15; mobs.isDaytime = () => false;
  mobs.worldRandom = new JavaRandom(2);
  if (entityRand) for (const host of [items, xp]) host.entityRandom = seven;
  else for (const host of [items, xp]) { host.entityRandom = null; const tick = host.tickOne.bind(host), shared = host.random; host.tickOne = (...a) => { const r = (a[1].ownRand ??= new JavaRandom(7)); host.random = () => r.nextFloat(); try { return tick(...a); } finally { host.random = shared; } }; }
  let inPass = false;
  const extras = [];
  // The probe's World.spawnEntityInWorld fixes the motion of an item or orb that spawns after the start (their constructors draw it from Math.random).
  const itemJoined = items.joined, orbJoined = xp.joined;
  items.joined = (e) => { if (inPass) { [e.mx, e.my, e.mz] = [0, 0.2, 0]; extras.push({ at: { kind: "item" }, entity: e }); } itemJoined(e); };
  xp.joined = (e) => { if (inPass) { [e.vx, e.vy, e.vz] = [0, 0.2, 0]; extras.push({ at: { kind: "orb" }, entity: e }); } orbJoined(e); };
  const sets = c.specs.filter((s) => s[0] === "set").map((s) => ({ x: s[1], y: s[2], z: s[3], id: PORT_ID[s[7]] ?? s[7], tick: s[9] }));
  for (const st of sets) if (st.tick < 0) world.put(st.x, st.y, st.z, st.id, 0);
  const hits = c.specs.filter((s) => s[0] === "hit").map((s) => ({ target: s[7], source: s[8], tick: s[9], phase: s[10], amount: s[11] }));
  const made = c.specs.filter((s) => s[0] !== "set" && s[0] !== "wall" && s[0] !== "hit").map((s) => ({ at: { kind: s[0], x: s[1], y: s[2], z: s[3], vx: s[4], vy: s[5], vz: s[6], a: s[7], b: s[8], join: s[9] }, entity: null }));
  for (const m of made) {
    const { kind, x, y, z, vx, vy, vz, a, b } = m.at;
    if (kind === "item") { const it = items.spawn({ id: STONE, count: a, damage: 0 }, x, y, z, { motion: [vx, vy, vz] }); items.items.pop(); it.age = b; m.add = () => { items.items.push(it); items.joined(it); }; m.entity = it; }
    else if (kind === "orb") { const o = newOrb(a, x, y, z, () => 0); [o.vx, o.vy, o.vz] = [vx, vy, vz]; m.add = () => { xp.orbs.push(o); xp.joined(o); }; m.entity = o; }
    else if (kind === "arrow") { const ar = arrows.make({ x, y, z, mx: vx, my: vy, mz: vz, yaw: 0, pitch: 0 }, arrows.rng(), {}); m.add = () => { arrows.list.push(ar); arrows.joined(ar); }; m.entity = ar; }
    else if (kind === "cart") { const k = minecarts.spawnEmpty({ x, y, z }, { seed: 7 }); minecarts.carts.pop(); Object.assign(k, { vx, vz }); m.add = () => { minecarts.carts.push(k); minecarts.joined(k); }; m.entity = k; }
    else if (kind === "boat") { const k = boats.spawnBoat({ x, y, z, yaw: a, vx }, { seed: 7 }); boats.carts.pop(); boats.setPosition(k, x, y, z); k.px = k.x; k.py = k.posY; k.pz = k.z; m.add = () => { boats.carts.push(k); boats.joined(k); }; m.entity = k; }
    else if (kind === "painting") { const p = hanging.createPainting(world, x, y, z, a); p.ticks = b; m.add = () => { hanging.entities.push(p); hanging.joined(p); }; m.entity = p; }
    else if (kind === "cow" || kind === "dcow") {
      const cow = mobs.create("cow", x, y, z); cow.growingAge = 0; cow.onGround = false; setEntityRandom(cow, new JavaRandom(7));
      if (kind === "dcow") { cow.health = a; cow.recentlyHit = b; }
      m.add = () => { mobs.entities.push(cow); }; m.entity = cow;
    } else throw new Error(kind);
  }
  const rows = [], hasOrb = made.some((m) => m.at.kind === "orb"); // the probe's player shell (no pickups here: the orbs are 40 blocks away); the away run has no player
  for (let t = 0; t < c.ticks; t++) {
    for (const st of sets) if (st.tick === t) world.put(st.x, st.y, st.z, st.id, 0);
    for (const m of made) if (m.at.join === t) m.add(); // (the entity exists before it joins: no pass spawn)
    inPass = true; // what joins from here to the end of the tick is a spawn of the pass (the probe's `extras`)
    for (const h of hits) if (h.tick === t && h.phase === 0) mobs.attackEntityFrom(made[h.target].entity, h.amount, { name: "outOfWorld" });
    ents.tick();
    inPass = false;
    inPass = true;
    for (const h of hits) if (h.tick === t && h.phase === 1) mobs.attackEntityFrom(made[h.target].entity, h.amount, { name: "outOfWorld" });
    inPass = false;
    rows.push([made.map(view), [], hasOrb ? [0, 0] : [], extras.map(view)]);
  }
  return rows;
}
function view(m) {
  const e = m.entity, { kind } = m.at;
  if (kind === "item") return [e.x, e.y + 0.125, e.z, e.mx, e.my, e.mz, e.dead ? 1 : 0, e.stack.count, e.age, e.delay];
  if (kind === "orb") return [e.x, e.posY, e.z, e.vx, e.vy, e.vz, e.dead ? 1 : 0, e.color, texture(e.value)];
  if (kind === "cart") return [e.x, e.posY, e.z, e.vx, e.vy, e.vz, e.dead ? 1 : 0, e.yaw, e.pitch];
  if (kind === "boat") return [e.x, e.posY, e.z, e.vx, e.vy, e.vz, e.dead ? 1 : 0, e.yaw, e.timeSinceHit];
  if (kind === "painting") return [e.x, e.y, e.z, 0, 0, 0, e.dead ? 1 : 0];
  if (kind === "cow" || kind === "dcow") return [e.x, e.y, e.z, e.vx, e.vy, e.vz, e.dead || e.death >= 20 ? 1 : 0, e.health];
  return [e.x, e.y, e.z, e.mx, e.my, e.mz, e.dead ? 1 : 0, e.inGround ? 1 : 0, e.pickup];
}
