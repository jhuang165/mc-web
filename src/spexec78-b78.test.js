// Batch 78 spexec78: single-player effects replayed against the executed 1.7.10 classes (tools/probes/SpExec78Probe.java, SpExec78Milk.java, SpExec78Jukebox.java,
// run by tools/verify-spexec78.mjs into public/research/spexec78-reference.json): EntityThrowable.onImpact of the snowball, egg and ender pearl, the large and small
// fireball impacts, EntityCow / EntityMooshroom.interact (bucket, bowl, shears) and RenderGlobal's aux 1005 record handling, each on a server and a client world.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Projectiles, GaussianRandom, thrownHit } from "./projectiles.js";
import { JavaRandom } from "./lighting.js";
import { impactEnderPearl } from "./ender-pearl.js";
import { Fireballs } from "./fireballs.js";
import { milkCow } from "./buckets.js";
import { mooshroomUse, useBowl, BOWL, MUSHROOM_STEW, SHEARS, BUCKET, MILK_BUCKET, RED_MUSHROOM } from "./mooshroom.js";
import { makeStack } from "./inventory.js";
import { EntityWorld } from "./entities.js";
import { plain } from "./legacy-ai-replay.js";
import { populationBlockMapperReady } from "./population-world.js";
import { setGameRuleSource } from "./game-rules.js";
import { recordAux } from "./multiplayer/client-music.js";

await populationBlockMapperReady;
const ref = JSON.parse(readFileSync(new URL("../public/research/spexec78-reference.json", import.meta.url), "utf8"));
const of = (kind) => ref.records.filter((r) => r.kind === kind);
const num = (s) => Number(s);

test("the reference holds the executed records of all five scopes", () => {
  assert.match(ref.target, /1\.7\.10/);
  assert.equal(of("thrown").length, 18);
  assert.equal(of("pearl").length, 12);
  assert.equal(of("fireball").length, 88);
  assert.equal(of("milk").length, 56);
  assert.equal(of("jukebox").length, 30);
  assert.equal(of("egg-rolls").length, 1);
});

// ---- snowball, egg, pearl ---------------------------------------------------------------------------------------------------------------------------------------

const poofs = (r) => r.events.filter((e) => e.startsWith("particle snowballpoof"));
const portals = (r) => r.events.filter((e) => e.startsWith("particle portal")).map((e) => e.split(" ").slice(2).map(num));
const KIND = { snowball: "snowball", egg: "egg", pearl: "enderPearl" };

test("snowball and egg: eight snowballpoof with zero velocity at the ball, on both worlds", () => {
  for (const r of of("thrown").filter((x) => x.entity !== "pearl")) {
    assert.equal(r.error, null);
    assert.equal(poofs(r).length, 8, r.entity + r.remote);
    for (const p of poofs(r)) assert.deepEqual(p.split(" ").slice(2).map(num), [10.25, 20.5, 30.75, 0, 0, 0]);
    assert.equal(r.dead, !r.remote, "setDead only on the server");
    if (r.remote) { // the client copy of the ball (object-tracker.js) emits exactly those particles
      const pr = new Projectiles(), seen = [];
      pr.sink = (...a) => seen.push(a);
      pr.remote = true;
      pr.clientImpact({ kind: KIND[r.entity], x: 10.25, y: 20.5, z: 30.75 });
      assert.equal(seen.length, 8);
      for (const s of seen) assert.deepEqual(s, ["snowballpoof", 10.25, 20.5, 30.75, 0, 0, 0]);
    }
  }
});

test("snowball damage: 3 to a blaze, 0 to anything else; egg and pearl 0 (the thrown source)", () => {
  for (const r of of("thrown").filter((x) => !x.remote && x.target !== "none")) {
    const a = r.events.find((e) => e.startsWith("attack"));
    const want = num(a.split(" ")[2]);
    if (r.entity === "pearl") { assert.equal(want, 0); continue; } // ender-pearl.js: hooks.hit with amount 0 (below)
    const got = [];
    const victim = { type: r.target }, mobs = { entities: [victim], damage: (e, amount) => { got.push(amount); return true; } };
    thrownHit(mobs, victim, { x: 0, z: 0 }, { kind: KIND[r.entity] });
    assert.deepEqual(got, [want], r.entity + " on " + r.target);
  }
});

test("egg: a chick with probability 1/8, four of them 1/32 of those, for 256 executed seeds", () => {
  const [rolls] = of("egg-rolls");
  const pr = new Projectiles();
  for (let i = 0; i < 256; i++) {
    const b = { rand: new JavaRandom(i * 2654435761), x: 10.25, y: 20.5, z: 30.75, yaw: 77 };
    assert.equal(pr.layEggs(b), rolls.counts[i], "seed " + i);
  }
  for (const d of rolls.detail.filter((x) => x.count)) {
    pr.events.length = 0;
    pr.layEggs({ rand: new JavaRandom(d.seed), x: 10.25, y: 20.5, z: 30.75, yaw: 77 });
    assert.equal(pr.events.length, 1);
    const [ev] = pr.events;
    assert.equal(ev.chicks, d.count);
    assert.deepEqual([ev.x, ev.y, ev.z, ev.yaw], [d.spawned[0].at[0], d.spawned[0].at[1], d.spawned[0].at[2], d.spawned[0].yaw]);
    assert.equal(d.spawned.length, d.count);
    assert.ok(d.spawned.every((s) => s.age === -24000 && s.pitch === 0));
  }
});

test("pearl particles: 32 portal at y + nextDouble() * 2 with two gaussians, the Entity.rand of the ball (seed 7)", () => {
  const seed7 = of("thrown").filter((r) => r.entity === "pearl");
  for (const r of seed7) {
    const want = portals(r);
    assert.equal(want.length, 32);
    // the client copy
    const seen = [];
    const pr = new Projectiles();
    pr.sink = (n, x, y, z, vx, vy, vz) => seen.push([x, y, z, vx, vy, vz]);
    pr.clientImpact({ kind: "enderPearl", x: 10.25, y: 20.5, z: 30.75, rand: new GaussianRandom(7) });
    assert.deepEqual(seen, want);
    // the server half, impactEnderPearl (no owner: nothing else happens; the hit entity gets the zero-damage thrown attack first)
    const out = [], hit = r.target === "none" ? null : { type: r.target };
    const res = impactEnderPearl({ x: 10.25, y: 20.5, z: 30.75, random: new GaussianRandom(7) }, { world: { remote: r.remote }, owner: null, hit },
      { hit: (t, s) => out.push(["attack", t.type, s.amount, s.source]), particle: (p) => out.push([p.x, p.y, p.z, p.mx, p.my, p.mz]) });
    assert.equal(res.teleported, false);
    const attack = r.events.find((e) => e.startsWith("attack"));
    const outAttacks = out.filter((o) => o[0] === "attack");
    assert.equal(outAttacks.length, attack ? 1 : 0);
    if (attack) assert.deepEqual(outAttacks[0], ["attack", r.target, 0, "thrown"]);
    if (attack) assert.ok(r.events.indexOf(attack) < r.events.findIndex((e) => e.startsWith("particle")), "the hit comes before the particles");
    assert.deepEqual(out.filter((o) => o[0] !== "attack"), want);
  }
});

test("pearl impact: teleport, dismount, fall reset and 5 fall damage only for a connected owner of this world on the server", () => {
  for (const r of of("pearl")) {
    const log = [];
    const owner = r.owner === "none" ? null : { kind: "playerMP", connected: r.owner !== "disconnected", world: r.owner === "other-world" ? "nether" : "world", riding: r.owner === "riding", fallDistance: 12 };
    const world = { remote: r.remote, id: "world" };
    // the port compares owner.world === world: give the owner the same object unless it lives elsewhere
    if (owner && owner.world === "world") owner.world = world;
    const pearl = { x: 10.25, y: 20.5, z: 30.75, random: new GaussianRandom(7), dead: false };
    const hit = r.owner === "with-hit" ? { type: "zombie" } : null;
    const owner2 = r.owner === "with-hit" ? { kind: "playerMP", connected: true, world, riding: false, fallDistance: 12 } : owner;
    impactEnderPearl(pearl, { world, owner: owner2, hit }, {
      hit: (t) => log.push("attack " + t.type + " 0.0"),
      particle: () => {},
      dismount: () => log.push("mountEntity null"),
      teleport: (_o, x, y, z) => log.push(`setPositionAndUpdate ${x} ${y} ${z}`),
      damage: (_o, d) => { log.push(`attack owner ${d.amount.toFixed(1)} type=${d.source}`); return true; },
    });
    const want = r.events.filter((e) => !e.startsWith("particle")).map((e) => e.replace(/ (source|fire)=.*$/, "").replace(/^attack zombie 0.0 .*/, "attack zombie 0.0"));
    assert.deepEqual(log, want, r.owner + (r.remote ? " remote" : ""));
    assert.equal(pearl.dead, r.dead, r.owner + " dead");
    assert.equal((owner2 ?? { fallDistance: null }).fallDistance, r.fallDistance, r.owner + " fall distance");
  }
});

// ---- fireballs --------------------------------------------------------------------------------------------------------------------------------------------------

const FIRE = 51;
function fireWorld(rec) {
  const solidAbove = rec.target === "block-solid-neighbour";
  return { get: (x, y, z) => (solidAbove && x === 10 && y === 21 && z === 30 ? 1 : 0), set() {} };
}

test("fireball impacts: damage, fire on an entity, the explosion and the fire placed on a block face, server side only", () => {
  for (const r of of("fireball").filter((x) => !x.remote)) {
    setGameRuleSource((n) => (n === "mobGriefing" ? r.mobGriefing : true));
    const events = [];
    const mobs = {
      events: [], world: fireWorld(r), random: Math.random,
      attackEntityFrom: (t, n, src) => { events.push(`attack ${t.type} ${n.toFixed(1)} shooter=${!!src.attacker}`); t.hit = true; return true; },
      ignite: (x, y, z) => events.push(`setBlock ${x},${y},${z} id=${FIRE}`),
    };
    const fb = new Fireballs(mobs);
    const shooter = r.shooter === "blaze" ? { type: "blaze", x: 0, y: 0, z: 0 } : null;
    const ball = { x: 10.25, y: 20.5, z: 30.75, large: r.large, power: 2, owner: shooter, dead: false };
    let hit;
    if (r.target === "zombie") hit = { entity: { type: "zombie", x: 10, y: 20, z: 30 } };
    else if (r.target === "blaze") hit = { entity: { type: "blaze", x: 10, y: 20, z: 30 } };
    else hit = { block: [10, 20, 30], side: { "block-up": 1, "block-down": 0, "block-n": 2, "block-s": 3, "block-w": 4, "block-e": 5, "block-solid-neighbour": 1 }[r.target] };
    fb.impact(ball, hit);
    const got = [];
    for (const e of events) got.push(e);
    for (const e of mobs.events) if (e.explode) got.push(`explosion null ${e.explode.x} ${e.explode.y} ${e.explode.z} ${e.explode.size.toFixed(1)} flaming=${e.explode.flaming} smoking=${e.explode.smoking}`);
    const want = r.events.map((e) => e.replace(/^attack (\w+) ([\d.]+) type=(\w+) source=\w+ direct=(\w+).*$/, (_, who, n, type, direct) => `attack ${who} ${n} shooter=${direct === "shooter"}`))
      .filter((e) => !e.startsWith("setFire")); // setFire is the mob's fire counter (checked below)
    assert.deepEqual(got, want, `${r.large ? "large" : "small"} ${r.target} by ${r.shooter} griefing=${r.mobGriefing}`);
    assert.equal(ball.dead, r.dead);
    if (!r.large && r.target === "zombie") assert.equal(hit.entity.fire, 5 * 20, "setFire(5) on the entity hit by a small fireball");
    setGameRuleSource(null);
  }
});

test("a small fireball on a blaze does nothing (isImmuneToFire is checked first); the large one still hurts and explodes", () => {
  for (const r of of("fireball").filter((x) => !x.remote && x.target === "blaze")) {
    if (r.large) assert.ok(r.events[0].startsWith("attack blaze 6.0"));
    else assert.deepEqual(r.events, []);
  }
});

test("a fire resistance potion refuses fireball damage (isFireDamage), whichever of the two source types it has", () => {
  const w = new EntityWorld(plain([]));
  const z = w.create("zombie", 0.5, 70, 0.5);
  w.entities.push(z);
  z.effects = [{ id: 12, amplifier: 0, duration: 600 }];
  const before = z.health;
  assert.equal(w.attackEntityFrom(z, 5, { from: { x: 5, z: 0 }, name: "fireball", fireball: true, attacker: null, entity: { x: 5, y: 70, z: 0 } }), false);
  assert.equal(z.health, before);
});

// ---- milk, bowl, shears -----------------------------------------------------------------------------------------------------------------------------------------

const NATIVE = { 281: BOWL, 282: MUSHROOM_STEW, 325: BUCKET, 335: MILK_BUCKET, 359: SHEARS, 40: RED_MUSHROOM };
const ITEM = { shear: 359, bowl: 281, bucket: 325, "milk-bucket": 335 };
function mockPlayer(r) {
  const inv = { main: new Array(36).fill(null), current: 0, get held() { return this.main[this.current]; } };
  inv.main[0] = makeStack(NATIVE[ITEM[r.case]], r.count, r.damage);
  if (r.full) for (let i = 1; i < 36; i++) inv.main[i] = makeStack(1, 64);
  const p = {
    creative: r.creative, inventory: inv, worn: 0,
    get held() { return inv.held; },
    add(id, n) { const i = inv.main.findIndex((s) => !s); if (i < 0) return 0; inv.main[i] = makeStack(id, n); return n; },
    wear(id, n) { inv.main[0].damage += n; p.worn++; },
  };
  return p;
}
const snapshot = (p) => p.inventory.main.map((s, i) => (s ? [i, s.id, s.count, s.damage ?? 0] : null)).filter(Boolean);
const wantInventory = (r) => r.inventory.map(([i, id, c, d]) => [i, NATIVE[id] ?? id, c, d]);

test("bucket and bowl on a cow or a mooshroom: results, stacks and the dropped bucket match the executed interact", () => {
  for (const r of of("milk").filter((x) => !x.remote && (x.case === "bucket" || x.case === "bowl" || x.case === "milk-bucket"))) {
    const p = mockPlayer(r), drops = [];
    let result = false;
    const moo = r.mob === "mooshroom", growingAge = r.age;
    if (moo) { const use = mooshroomUse(p.held?.id, growingAge); if (use === "bowl") result = useBowl(p, makeStack); }
    if (!result) result = milkCow(p, { drop: (s) => drops.push(s) });
    assert.equal(result, r.result, `${r.case} ${r.mob} n${r.count} full=${r.full} creative=${r.creative} age=${r.age}`);
    assert.deepEqual(snapshot(p), wantInventory(r), `${r.case} ${r.mob} n${r.count} full=${r.full} creative=${r.creative} inventory`);
    const dropped = r.spawned.filter((s) => s.item).map((s) => NATIVE[s.item[0]]);
    assert.deepEqual(drops.map((s) => s.id), dropped, "the milk bucket a full inventory drops");
  }
});

test("cows ignore shears and calves can be milked; a baby mooshroom is not sheared", () => {
  for (const r of of("milk").filter((x) => !x.remote && x.case === "shear" && (x.mob === "cow" || x.age < 0))) {
    assert.equal(r.result, false);
    assert.equal(r.dead, false);
    const p = mockPlayer(r);
    if (r.mob === "mooshroom") assert.equal(mooshroomUse(SHEARS, r.age), null); // a calf: no shearing, no bowl
    assert.equal(milkCow(p), false);
  }
});

test("shearing a mooshroom: a cow with its health and angles, 5 red mushrooms at +1.3, large explosion at half the height, the shear sound and one use of wear", () => {
  const records = of("milk").filter((x) => !x.remote && x.case === "shear" && x.mob === "mooshroom" && x.age === 0);
  assert.equal(records.length, 3);
  for (const r of records) {
    const w = new EntityWorld(plain([]));
    const fx = [];
    w.fx = { spawn: (...a) => fx.push(a) };
    const moo = w.create("mooshroom", 64.5, 0, 64.5);
    moo.yaw = 33; moo.pitch = 12; moo.health = 10;
    w.entities.push(moo);
    const p = mockPlayer(r);
    assert.equal(w.mooshroomInteract(moo, p), r.result);
    const cow = w.entities.find((e) => e.type === "cow");
    const [nc] = r.spawned;
    assert.ok(cow && cow.x === nc.at[0] && cow.z === nc.at[2] && cow.y === nc.at[1]);
    assert.equal(cow.yaw, nc.yaw);
    assert.equal(cow.pitch, nc.pitch);
    assert.equal(cow.health, nc.health);
    assert.equal(moo.health, 0, "the mooshroom is dead (setDead)");
    const drops = w.events.filter((e) => e.drop === RED_MUSHROOM);
    const items = r.spawned.filter((s) => s.item);
    assert.equal(drops.length, items.length);
    for (const [i, d] of drops.entries()) { assert.equal(d.count, items[i].item[1]); assert.equal(d.position.y + d.offsetY, items[i].at[1]); }
    assert.deepEqual(fx, r.particles.map(([n, x, y, z]) => [n, x, y, z, 0, 0, 0]));
    const sound = w.events.find((e) => e.sound);
    assert.equal(`${sound.sound}|${sound.volume.toFixed(1)}|${sound.pitch.toFixed(1)}`, r.sounds[0]);
    assert.equal(p.worn, r.creative ? 0 : 1, "shears wear unless Creative");
    assert.equal(p.held.damage, r.held[2], "the shears' damage after the click");
  }
});

// ---- jukebox ----------------------------------------------------------------------------------------------------------------------------------------------------

test("the jukebox HUD: ItemRecord.getRecord misses for 'records.<name>' so the client never shows a Now playing line", () => {
  const [l] = of("jukebox-lookup");
  assert.equal(l.byRecordsName, false);
  assert.equal(l.byName, true);
  for (const c of of("jukebox")) for (const rp of c.replay) assert.ok(!rp.client.some((e) => /message/.test(e)), "no HUD message in " + c.name);
  const calls = [];
  const mp = { play: (item, x, y, z) => calls.push([item, x, y, z]) };
  recordAux({ id: 1005, x: 8, y: 64, z: 8, data: 2256 }, mp);
  assert.equal(calls.length, 1, "the aux event still plays the disc");
});

test("aux 1005 starts the disc on insert and stops it on eject, stopping the previous sound of the same cell first", () => {
  for (const c of of("jukebox").filter((x) => !x.remote && x.name.startsWith("insert-"))) {
    assert.equal(c.result, true);
    assert.deepEqual(c.sets, [[8, 64, 8, 84, 1]]);
    assert.equal(c.world[0], "aux 1005 8,64,8," + c.name.slice(7));
    assert.match(c.replay[0].client[0], /^play minecraft:records\.\w+ vol=4\.0 pitch=1\.0 @8\.0,64\.0,8\.0$/);
  }
  for (const c of of("jukebox").filter((x) => !x.remote && x.name.startsWith("eject-"))) {
    assert.deepEqual(c.world, ["aux 1005 8,64,8,0"]);
    assert.deepEqual(c.replay[0].client, []);
  }
  for (const s of of("jukebox-client")) for (const st of s.steps) assert.equal(st.error, null);
});
