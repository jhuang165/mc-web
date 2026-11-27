// b101 credit101: indirect kill credit. A kill by a mob riding a mob (spider jockey) is the shooter's: the arrow's source entity (ro.j()) is the skeleton, not the spider.
// Bytecode-read (javap -c -p, 1.7.10 jar):
//   rq("arrow", arrow, shooter): j() is the shooter (zc.h passes zc.c), so credit, death message, killed-by stat and revenge use the skeleton (yl), never its mount.
//   xz.a(ro) (EntityCreeper.onDeath): `ro.j() instanceof yl` drops record_13 + nextInt(12); yl is EntitySkeleton for the wither skeleton too (type 1), by melee or by arrow.
//   yq.a(sv) (EntityZombie.onKillEntity) is inherited by yh (EntityPigZombie declares none): a pigman's kill of a villager converts it as a zombie's does.
//   ze.a(ro, F): the puncher (ro.j(), when an sv) becomes the ball's shooter field; zg.a / zi.a then hit with ro.a(ze, shooter): a deflected ball hurts a player as "fireball" by the puncher.
//   rv.a(sv, sv, int, double): a thrower -> sv.a(ro.b(target, thrower), n) (indirectMagic with the thrower as j()), the thrower may be the target itself.
import { test } from "node:test";
import assert from "node:assert/strict";
import { EntityWorld } from "./entities.js";
import { World } from "./world.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { Survival } from "./survival.js";
import { langReady } from "./chat-component.js";
import { DISC_FIRST } from "./note-jukebox-content.js";
import { WitchPotions } from "./witch-potions.js";
import { revengeOf } from "./revenge-target.js";
import { STAT } from "./stats.js";

await langReady;
const key = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const ew = () => new EntityWorld(new World("b101-credit", "meadow"), []);
const put = (w, type) => { const e = w.create(type, 0.5, 10, 0.5); w.entities.push(e); return e; };
const discs = (w) => w.events.filter((e) => e.drop >= DISC_FIRST && e.drop < DISC_FIRST + 12).length;
const arrowOf = (a) => ({ attacker: a.type, shooter: a, projectile: true, directArrow: true, name: "mob", player: false }); // bow.js damageTarget's source
const meleeOf = (a) => ({ attacker: a, name: "mob", player: false }); // entities.js hitMob's source

test("credit101: a creeper's disc follows any EntitySkeleton source entity: melee or arrow, skeleton or wither skeleton, a jockey's too", () => {
  const w = ew();
  const kill = (type, source) => { const a = put(w, type), c = put(w, "creeper"); w.events.length = 0; c.health = 1; w.attackEntityFrom(c, 5, source(a)); return discs(w); };
  assert.equal(kill("skeleton", arrowOf), 1);
  assert.equal(kill("skeleton", meleeOf), 1);
  assert.equal(kill("wither_skeleton", arrowOf), 1);
  assert.equal(kill("wither_skeleton", meleeOf), 1);
  assert.equal(kill("zombie", meleeOf), 0);
  const jockey = put(w, "skeleton"), spider = put(w, "spider"); jockey.ridingEntity = spider; spider.riddenBy = jockey;
  const c = put(w, "creeper"); w.events.length = 0; c.health = 1; w.attackEntityFrom(c, 5, arrowOf(jockey));
  assert.equal(discs(w), 1, "the arrow's entity is the rider, whatever it sits on");
});

test("credit101: a pigman's kill of a villager converts it on Hard (EntityZombie.onKillEntity is inherited)", () => {
  const w = ew(); w.difficulty = 3;
  const p = put(w, "pigman"), v = put(w, "villager"); v.health = 1;
  w.attackEntityFrom(v, 5, meleeOf(p));
  assert.ok(w.entities.some((e) => e.type === "zombie" && e.villager), "a zombie villager replaces it");
  assert.ok(!w.entities.includes(v));
});

test("credit101: a jockey skeleton's arrow gives the victim mob no player credit, and the revenge target is the skeleton, not the spider", () => {
  const w = ew();
  const jockey = put(w, "skeleton"), spider = put(w, "spider"); jockey.ridingEntity = spider; spider.riddenBy = jockey;
  const z = put(w, "zombie"); z.health = 100;
  w.attackEntityFrom(z, 3, arrowOf(jockey));
  assert.equal(z.recentlyHit ?? 0, 0);
  assert.equal(revengeOf(z), jockey, "setRevengeTarget(skeleton)");
  assert.notEqual(revengeOf(z), spider);
});

// ---- the player's own splash / deflected ball name him ----
test("credit101: a player's harming splash on himself is indirectMagic by himself (Potion.affectEntity: causeIndirectMagicDamage(target, thrower))", () => {
  const w = ew(), s = new Survival(), potions = new WitchPotions(w);
  s.health = 20; s.protection = 0;
  const player = { x: 70.5, y: 10, z: 70.5, alive: true };
  potions.impact({ x: 70.5, y: 10.5, z: 70.5, damage: 16396, owner: "player", hit: "player" }, player, s);
  assert.ok(s.health < 20, "the splash hurt him");
  const entry = s.combat.entries.at(-1);
  assert.equal(entry.src.type, "indirectMagic");
  assert.equal(entry.src.entity.self, true);
});

function server(names) {
  const world = new World("b101-credit");
  for (let x = 30; x <= 100; x++) for (let z = 30; z <= 100; z++) for (let y = 9; y <= 30; y++) world.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const sim = new DedicatedSimulation({}, { world, mobs: true, gameMode: "survival" });
  sim.mobs.mobs.entities.length = 0;
  const ps = names.map((name, i) => { const p = sim.addPlayer("p" + i, name, key(i + 1)); p.position.copy({ x: 64.5 + i * 2, y: 10, z: 64.5 }); p.previous.copy(p.position); return p; });
  for (let i = 0; i < 3; i++) sim.tick();
  for (const p of ps) p.survival.protection = 0;
  return { sim, ps };
}
function deflectedHit({ pvp = true } = {}) {
  const { sim, ps: [a, v] } = server(["Puncher", "Victim"]);
  sim.pvp = pvp; v.survival.health = 1;
  const fb = sim.mobs.mobs.fireballs, ball = fb.launch({ large: true, owner: null, x: v.position.x, y: 11, z: v.position.z, exact: [1, 0, 0] });
  Object.assign(ball, { owner: "player", punchedBy: a });
  const view = sim.mobs.views.get(v.id).view;
  fb.impact(ball, { entity: { player: true, view } });
  sim.serverSurvival.settle(v);
  return { sim, a, v };
}

test("credit101: a deflected ghast ball that hits another player is fireball by the puncher: message, killer, playerKills", () => {
  const { sim, a, v } = deflectedHit();
  assert.equal(v.dead, true);
  const death = sim.events.find((e) => e.type === "death");
  assert.match(JSON.stringify(death.component), /death\.attack\.fireball/);
  assert.match(JSON.stringify(death.component), /Puncher/);
  assert.equal(death.killer, a.id);
  assert.equal(a.stats.get(STAT.playerKills), 1);
});

test("credit101: with PvP off a deflected ball's hit on another player is refused (mw.a(ro, F): a player source entity)", () => {
  const { v } = deflectedHit({ pvp: false });
  assert.equal(v.survival.health, 1);
});
