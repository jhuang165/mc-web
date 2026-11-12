import { readFileSync } from "node:fs";
import { EntityWorld } from "./entities.js";
import { Survival } from "./survival.js";
import { ItemEntities } from "./item-entities.js";
import { Arrows } from "./bow.js";
import { ExperienceOrbs, newOrb } from "./experience.js";
import { primeTnt, explodeTnt, TNT_Y_OFFSET } from "./explosion.js";
import { entityWalkers, finishEntitySimulation, vehicleTargets, thrownAtVehicleOrHanging } from "./entity-simulation.js";
import { plain } from "./legacy-ai-replay.js";
import { Minecarts } from "./minecarts.js";
import { Boats } from "./boats.js";
import { Hanging } from "./hanging.js";
import { WitchPotions } from "./witch-potions.js";
import { Projectiles, GaussianRandom } from "./projectiles.js";
import { impactPlayerPearl } from "./pearl-player.js";
import { mountMobOnVehicle } from "./vehicle-riders.js";
import { explodeEvent, spawnLoot } from "./living-simulation.js";
import { explodeNonLiving } from "./explosion-simulation.js";
import { JavaRandom } from "./java-random.js";
import { setEntityRandom } from "./entities.js";

// Replays one EntityListProbe record (public/research/entity-list-reference.json, tools/probes/EntityListProbe.java): the unchanged EntityItem, EntityXPOrb,
// EntityTNTPrimed and EntityArrow walked in World.loadedEntityList order, against the walk in EntityWorld.tickMobs (`mobs.walks`, entity-simulation.js
// entityWalkers). The scenarios exist in both list orders to show the order is observable. Row per tick: [entities (creation order) [posY (the feet
// for an arrow), motion, isDead, kind fields], explosions [x, y, z, power], player [xp, xpCooldown], entities spawned in the pass (spawn order)].
// Batch 44 adds minecarts, boats, paintings, potions, snowballs and wither skulls, and a cow riding a cart (the rider updates right after its mount).
export const entityListReference = JSON.parse(readFileSync(new URL("../public/research/entity-list-reference.json", import.meta.url))).cases;
const STONE = 3, PORT_ID = { 1: 3 }, YOFF = { item: 0.125, tnt: TNT_Y_OFFSET };

// `without`: "lootInTurn" (batch 48: death loot spawns at the drain after the walk), "throwTargets" (batch 46: the player's balls miss carts and boats); leave one batch 45 behaviour out to show a record needs it: "blast" (a blast reaches only items, as before), "mobPush" (the vehicles do not push mobs in the walk).
export function replayEntityList(c, onBoom = null, without = null) {
  const ew = new EntityWorld(plain([]), [], () => 0.5);
  ew.brightnessLevel = () => 15; // the probe world's light
  ew.isDaytime = () => false;
  ew.ai.player.unticked = true;
  ew.ai.think = () => {}; // the probe's cow has no AI task list (EntityLiving.updateAITasks switched off)
  const world = ew.world, rand = () => 0.5;
  const items = new ItemEntities(rand), arrows = new Arrows(), xpOrbs = new ExperienceOrbs([], rand), primed = [], booms = [], extras = [];
  const minecarts = new Minecarts(), boats = new Boats(), hanging = new Hanging({ random: () => new JavaRandom(1) });
  ew.potions = new WitchPotions(ew, rand);
  if (c.specs.some((q) => q[0] === "pthrow" && q[7] === 4)) ew.potions.projectiles.rng = () => new GaussianRandom(2); // EntityExpBottle.onImpact draws from World.rand, which is Random(2) in the probe
  const projectiles = new Projectiles(rand); // the player's own thrown balls: only the pthrow scenarios put any in
  projectiles.clientParticles = true; projectiles.tickEffects = () => {};
  const hasOrb = c.specs.some((q) => q[0] === "orb"), survival = new Survival({}, "survival"), hasMp = c.specs.some((q) => q[0] === "pthrow" && q[8] === 2), player = { x: hasOrb ? 0.5 : hasMp ? 0 : 1e5, y: 0, z: hasMp ? 0 : 0.5, health: 20, alive: true, width: 0.6, height: 1.8, isPlayer: true };
  let xp = 0, inPass = false;
  const explode = (x, y, z, power, who) => { booms.push([x, y, z, power]); if (without === "blast") items.explode(world, x, y, z, power, who?.exploder ?? who); else explodeNonLiving(state, x, y, z, power, who?.exploder ?? who, false, drop); onBoom?.(items); };
  // Entity.entityDropItem(stack, 0) and a broken cart's drops: an item that joins the end of the list in the pass (the probe's World.spawnEntityInWorld fixes its sideways motion).
  const drop = (d) => items.spawn(d.stack, d.x, d.posY, d.z, { delay: d.delay, motion: [0, 0.2, 0] });
  const hooks = {
    explodeTnt: (x, y, z, power, who) => { explode(x, y, z, power, who); explodeTntAll(world, primed, who.exploder, x, y, z, power); },
    maxStack: () => 64, carts: { drop }, boats: { drop }, hangingActive: () => true, hangingDrop: drop,
    mobExplosion: (ev) => explodeEvent(ev, (x, y, z, size, options) => explode(x, y, z, size, options)),
    // the player's snowballs, eggs and pearls (main.js projectileTargets / projectileHit / projectilePearlImpact): the carts, boats and hanging entities are the targets
    projectileTargets: (st) => without === "throwTargets" ? vehicleTargets(st).filter((t) => st.hanging.entities.includes(t.ref)) : vehicleTargets(st), // "throwTargets": the old targets, hanging only
    projectileHit: (e, ball) => thrownAtVehicleOrHanging(state, e, hooks, { player: true, creative: !!ball.creative }),
    // EntityEgg.onImpact's chicks (main.js projectileEvent): the chick joins the list in the thrown entity's own turn, like World.spawnEntityInWorld (the probe's chick has Random(7))
    projectileEvent: (h) => { if (!h.sound) for (let i = 0; i < h.chicks; i++) { const chick = ew.hatch(h.x, h.y, h.z, h.yaw); setEntityRandom(chick, new JavaRandom(7)); extras.push({ at: { kind: "cow" }, entity: chick }); } },
    projectilePearlImpact: ({ pearl, hit }) => impactPlayerPearl({ world, position: player, survival, minecarts }, pearl, hit, { hit: (e) => thrownAtVehicleOrHanging(state, e, hooks, { player: true, creative: !!pearl.creative }), particle: () => {} }),
  };
  const state = { world, items, arrows, primed, xpOrbs, projectiles, mobs: ew, survival, position: player,
    minecarts, boats, hanging, velocity: { x: 0, z: 0 }, alive: false };
  const ctx = { state, hooks };
  // Entity.rand is Random(7) on every item and orb of the probe: their push out of the floor (a drop spawned at a mob's feet sits half in it) draws from their own generator, not a shared one.
  for (const host of [items, xpOrbs]) { const tick = host.tickOne.bind(host), shared = host.random; host.tickOne = (...a) => { const r = (a[1].ownRand ??= new JavaRandom(7)); host.random = () => r.nextFloat(); try { return tick(...a); } finally { host.random = shared; } }; }
  // Batch 48 (EntityWorld.flushLoot): a death's drops and orbs join the list in the dying cow's own turn; the probe's World.spawnEntityInWorld fixes their sideways motion. World.rand is Random(2) there.
  ew.worldRandom = new JavaRandom(2);
  if (without !== "lootInTurn") ew.spawnLoot = (evs) => { const n = items.items.length; spawnLoot({ xpOrbs, items }, evs); for (const it of items.items.slice(n)) [it.mx, it.my, it.mz] = [0, 0.2, 0]; };
  ew.walks = entityWalkers(() => ctx);
  if (without === "mobPush") for (const w of ew.walks.values()) delete w.pushMob;
  items.joined = (e) => { ew.joined(e, "item"); if (inPass) extras.push({ at: { kind: "item" }, entity: e }); };
  arrows.joined = (e) => ew.joined(e, "arrow"); xpOrbs.joined = (e) => { ew.joined(e, "orb"); if (inPass) { [e.vx, e.vy, e.vz] = [0, 0.2, 0]; extras.push({ at: { kind: "orb" }, entity: e }); } }; // an orb spawned in the pass (a bottle's): the probe fixes its motion (EntityXPOrb draws it from Math.random)
  minecarts.joined = (e) => ew.joined(e, "cart"); boats.joined = (e) => ew.joined(e, "boat"); hanging.joined = (e) => ew.joined(e, "hanging");
  const sets = c.specs.filter((s) => s[0] === "set").map((s) => ({ x: s[1], y: s[2], z: s[3], id: PORT_ID[s[7]] ?? s[7], tick: s[9] }));
  for (const st of sets) if (st.tick < 0) world.put(st.x, st.y, st.z, st.id, 0);
  const made = c.specs.filter((s) => s[0] !== "set" && s[0] !== "wall").map((s) => {
    const [kind, x, y, z, vx, vy, vz, a, b, join, seed] = s, at = { kind, x, y, z, vx, vy, vz, a, b, join, seed };
    return { at, entity: null };
  });
  // `build` makes the entity as its constructor does (it exists before it joins the list); `join` is World.spawnEntityInWorld.
  const build = (m) => {
    const { kind, x, y, z, vx, vy, vz, a, b } = m.at;
    if (kind === "item") { const it = items.spawn({ id: STONE, count: a, damage: 0 }, x, y, z, { motion: [vx, vy, vz] }); items.items.pop(); it.age = b; m.add = () => { items.items.push(it); items.joined(it); }; m.entity = it; }
    else if (kind === "orb") { const o = newOrb(a, x, y, z, () => 0); [o.vx, o.vy, o.vz] = [vx, vy, vz]; m.add = () => { xpOrbs.orbs.push(o); xpOrbs.joined(o); }; m.entity = o; }
    else if (kind === "tnt") { const t = primeTnt(x, y, z, { fuse: a, random: () => 0 }); [t.vx, t.vy, t.vz] = [vx, vy, vz]; m.add = () => { primed.push(t); ew.joined(t, "tnt"); }; m.entity = t; }
    else if (kind === "arrow") { const ar = arrows.make({ x, y, z, mx: vx, my: vy, mz: vz, yaw: 0, pitch: 0 }, arrows.rng(), {}); m.add = () => { arrows.list.push(ar); arrows.joined(ar); }; m.entity = ar; }
    else if (kind === "cart") { const k = minecarts.spawnEmpty({ x, y, z }, { seed: 7 }); minecarts.carts.pop(); Object.assign(k, { vx, vz }); m.add = () => { minecarts.carts.push(k); minecarts.joined(k); }; m.entity = k; }
    else if (kind === "boat") { const k = boats.spawnBoat({ x, y, z, yaw: a, vx }, { seed: 7 }); boats.carts.pop(); boats.setPosition(k, x, y, z); k.px = k.x; k.py = k.posY; k.pz = k.z; m.add = () => { boats.carts.push(k); boats.joined(k); }; m.entity = k; }
    else if (kind === "painting") {
      const p = hanging.createPainting(world, x, y, z, a); p.ticks = b; // the tile, the facing and EntityHanging's private 100-tick counter
      m.add = () => { hanging.entities.push(p); hanging.joined(p); }; m.entity = p;
    }
    else if (kind === "potion" || kind === "snowball") {
      const flat = Math.hypot(vx, vz), yaw = Math.fround((Math.atan2(vx, vz) * 180) / Math.PI), pitch = Math.fround((Math.atan2(vy, flat) * 180) / Math.PI), rng = ew.potions.projectiles.rng();
      const ball = { kind, damage: a, owner: null, x, y, z, px: x, py: y, pz: z, mx: vx, my: vy, mz: vz, yaw, pitch, prevYaw: yaw, prevPitch: pitch, ticks: 0, rand: rng, random: rng, dead: false };
      const list = kind === "potion" ? ew.potions.projectiles.balls : ew.golemBalls.projectiles.balls;
      m.add = () => { list.push(ball); ew.joined(ball, kind === "potion" ? "potion" : "golemBall"); }; m.entity = ball;
    }
    else if (kind === "pthrow") { // a snowball (0), egg (1), ender pearl (2) or potion (3) the player threw, from the listed point (the launch is its own record); b = Creative thrower
      const flat = Math.hypot(vx, vz), yaw = Math.fround((Math.atan2(vx, vz) * 180) / Math.PI), pitch = Math.fround((Math.atan2(vy, flat) * 180) / Math.PI), rng = new GaussianRandom(m.at.seed ?? 7); // Entity.rand: Random(7), or the spec's seed (the egg's hatch roll)
      const ball = { kind: ["snowball", "egg", "enderPearl", "potion", "expBottle"][a], damage: 32732, owner: a >= 3 || b === 2 ? "player" : null, creative: b === 1, thrower: b === 2, x, y, z, px: x, py: y, pz: z, mx: vx, my: vy, mz: vz, yaw, pitch, prevYaw: yaw, prevPitch: pitch, ticks: 0, rand: rng, random: rng, dead: false };
      const list = a >= 3 ? ew.potions.projectiles.balls : projectiles.balls;
      m.add = () => { list.push(ball); ew.joined(ball, a >= 3 ? "potion" : "thrown"); }; m.entity = ball;
    }
    else if (kind === "skull") { const sk = ew.skulls.launch({ owner: null, x, y, z, exact: [vx, vy, vz] }); ew.skulls.list.pop(); m.add = () => { ew.skulls.list.push(sk); ew.joined(sk, "skull"); }; m.entity = sk; }
    else if (kind === "dcow") { // batch 48: a cow with `a` health and recentlyHit `b`, falling from where it is listed (dies on landing)
      const cow = ew.create("cow", x, y, z); cow.growingAge = 0; cow.onGround = false; cow.health = a; cow.recentlyHit = b; setEntityRandom(cow, new JavaRandom(7));
      m.add = () => { ew.entities.push(cow); }; m.entity = cow;
    }
    else if (kind === "cow") {
      const cow = ew.create("cow", x, y, z); cow.growingAge = 0; cow.onGround = false; setEntityRandom(cow, new JavaRandom(7));
      m.add = () => { ew.entities.push(cow); }; m.entity = cow;
    }
    else throw new Error(kind);
  };
  for (const m of made) build(m);
  // Entity.mountEntity: a cow (spec field b = 1 + the index of its vehicle) sits on a cart or boat before the first tick.
  for (const m of made) if (m.at.kind === "cow" && m.at.b) {
    const v = made[m.at.b - 1].entity;
    if (!mountMobOnVehicle(v, m.entity, () => 0)) throw new Error("mount refused");
  }
  const rows = [], detail = c.name.startsWith("pthrow"); // the pthrow records carry the cart's and boat's damage and rolling
  for (let t = 0; t < c.ticks; t++) {
    for (const st of sets) if (st.tick === t) world.put(st.x, st.y, st.z, st.id, 0);
    for (const m of made) if (m.at.join === t) m.add();
    booms.length = 0;
    inPass = true;
    ew.tickMobs(player, survival);
    finishEntitySimulation(state, hooks);
    if (without === "lootInTurn") { const n = items.items.length; spawnLoot({ xpOrbs, items }, ew.drain()); for (const it of items.items.slice(n)) [it.mx, it.my, it.mz] = [0, 0.2, 0]; } // the drain after the walk, as before batch 48
    inPass = false;
    if (hasOrb) { xp += xpOrbs.collect({ x: 0.5, y: 0, z: 0.5 }); }
    rows.push([made.map((m) => view(m, primed, detail, player, survival)), booms.map((b) => [...b]), hasOrb ? [xp, xpOrbs.cooldown] : [], extras.map((m) => view(m, primed, detail, player, survival))]);
  }
  return rows;
}
function explodeTntAll(world, primed, exploder, x, y, z, power) { for (const e of primed) if (e !== exploder) explodeTnt(world, e, x, y, z, power); }
// EntityXPOrb.getTextureByXP (sq.f): the icon index of the value.
const texture = (v) => [2477, 1237, 617, 307, 149, 73, 37, 17, 7, 3].findIndex((n) => v >= n) < 0 ? 0 : 10 - [2477, 1237, 617, 307, 149, 73, 37, 17, 7, 3].findIndex((n) => v >= n);
function view(m, primed, detail = false, player = null, survival = null) {
  const e = m.entity;
    const { kind } = m.at, y = e.posY ?? e.y + (YOFF[kind] ?? 0);
  if (kind === "item") return [e.x, y, e.z, e.mx, e.my, e.mz, e.dead ? 1 : 0, e.stack.count, e.age, e.delay];
  if (kind === "tnt") return [e.x, y, e.z, e.vx, e.vy, e.vz, !primed.includes(e) && e.fuse < 0 ? 1 : 0, e.fuse];
  if (kind === "orb") return [e.x, e.posY, e.z, e.vx, e.vy, e.vz, e.dead ? 1 : 0, e.color, texture(e.value)];
  if (kind === "cart") return [e.x, e.posY, e.z, e.vx, e.vy, e.vz, e.dead ? 1 : 0, e.yaw, e.pitch, ...(detail ? [e.damage, e.rolling, e.rollingDir] : [])];
  if (kind === "boat") return [e.x, e.posY, e.z, e.vx, e.vy, e.vz, e.dead ? 1 : 0, e.yaw, e.timeSinceHit, ...(detail ? [e.damage] : [])];
  if (kind === "painting") return [e.x, e.y, e.z, 0, 0, 0, e.dead ? 1 : 0];
  if (kind === "pthrow" && m.at.b === 2) return [e.x, e.y, e.z, e.mx, e.my, e.mz, e.dead ? 1 : 0, player.x, player.y, player.z, 20 - survival.health]; // a pearl of a real EntityPlayerMP thrower: where it stands afterwards and the damage it took
  if (kind === "potion" || kind === "snowball" || kind === "pthrow") return [e.x, e.y, e.z, e.mx, e.my, e.mz, e.dead ? 1 : 0];
  if (kind === "skull") return [e.x, e.y, e.z, e.vx, e.vy, e.vz, e.dead ? 1 : 0, e.blue ? 1 : 0];
  if (kind === "cow" || kind === "dcow") return [e.x, e.y, e.z, e.vx, e.vy, e.vz, e.dead || e.death >= 20 ? 1 : 0, e.health]; // setDead at deathTime 20 (the port lets the mob leave in reap)
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
    if (want[3].length !== got[3].length) return [t, "spawned", want[3].length, got[3].length];
    for (let i = 0; i < want[3].length; i++) for (let k = 0; k < want[3][i].length; k++) if (!Object.is(want[3][i][k] + 0, (got[3][i]?.[k] ?? NaN) + 0)) return [t, "spawned " + i, k, want[3][i][k], got[3][i]?.[k]];
  }
  return null;
}
