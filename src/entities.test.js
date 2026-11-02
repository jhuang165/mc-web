import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { EntityWorld, setEntityRandom, entityHit, actorCollides, ENTITY_TYPES, interpolateRotation, wrapDegrees, nearAngle, mobPose, moveEntityWithHeading, moveEntity, moveFlying, jump, knockBack, addVelocity, aiMoveSpeed } from "./entities.js";
import { Survival } from "./survival.js";
const flat = {
  numericSeed: 123,
  solid: (x, y, z) => y < 0,
  get: (x, y, z) => (y < 0 ? 1 : 0),
  surface: () => 0,
  spawn: () => ({ x: 64.5, y: 0, z: 64.5 }),
};
test("passive spawns are seeded, stand on the surface, and survive reload without duplicate IDs", () => {
  const a = new EntityWorld(flat),
    b = new EntityWorld(flat);
  assert.deepEqual(a.serialize(), b.serialize());
  assert.equal(a.entities.length, 8);
  const c = new EntityWorld(flat, a.serialize());
  assert.equal(c.entities.length, 8);
  assert.equal(new Set(c.entities.map((e) => e.id)).size, 8);
  for (const e of c.entities)
    assert.equal(actorCollides(flat, e.x, e.y, e.z, ENTITY_TYPES[e.type].width, ENTITY_TYPES[e.type].height), false);
});
test("mob boxes use the 1.7.10 setSize dimensions", () => {
  const size = (t) => [ENTITY_TYPES[t].width, ENTITY_TYPES[t].height];
  assert.deepEqual(size("pig"), [0.9, 0.9]);
  assert.deepEqual(size("cow"), [0.9, 1.3]);
  assert.deepEqual(size("zombie"), [0.6, 1.8]);
});
test("entity ray selection respects reach and block occlusion", () => {
  const a = new EntityWorld(flat, [
      { id: "mob-1", type: "pig", x: 64.5, y: 0, z: 66.5, health: 10 },
    ]),
    o = { x: 64.5, y: 0.5, z: 64.5 },
    d = { x: 0, y: 0, z: 1 };
  assert.ok(entityHit(o, d, a.entities[0], 3) < 2);
  assert.equal(a.pick(o, d, 1), null);
  assert.equal(a.pick(o, d, 3, 1), null);
  assert.equal(a.pick(o, d, 3).entity.type, "pig");
});
test("legacy sword damage wears the tool, suppresses duplicate hits, and emits one food drop", () => {
  const a = new EntityWorld(flat, [
      { id: "mob-1", type: "pig", x: 66, y: 0, z: 64, health: 10 },
    ]),
    p = new Survival({ inventory: { 115: 1 } }),
    pig = a.entities[0],
    player = { x: 64, y: 0, z: 64 };
  // Entity.rand: nextInt(3) + 1 + nextInt(1) = 1 porkchop.
  setEntityRandom(pig, { nextInt: () => 0, nextFloat: () => 0.5, nextDouble: () => 0.5, nextGaussian: () => 0 });
  assert.equal(a.attack(pig, 115, p, player), true);
  assert.equal(pig.health, 2);
  assert.equal(p.inventory.main[p.inventory.find(115)].damage, 1);
  assert.equal(a.attack(pig, 115, p, player), false);
  for (let i = 0; i < 10; i++) a.tick(player, p);
  assert.equal(a.attack(pig, 115, p, player), true);
  assert.equal(a.drain().filter((e) => e.drop === 202).length, 1);
  assert.equal(pig.health, 0);
  assert.equal(a.serialize().length, 0);
  // deathTime counts from the next onEntityUpdate.
  assert.equal(pig.death, 0);
  a.tick(player, p);
  assert.equal(pig.death, 1);
  for (let i = 0; i < 20; i++) a.tick(player, p);
  assert.equal(a.entities.length, 0);
});
test("night spawns hostile mobs while daylight does not", () => {
  const a = new EntityWorld(flat, []),
    p = new Survival({ time: 14000 }),
    player = { x: 64, y: 0, z: 64 };
  for (let i = 0; i < 200; i++) a.tick(player, p);
  assert.equal(a.entities.filter((e) => e.type === "zombie").length, 1);
  const b = new EntityWorld(flat, []);
  p.time = 6000;
  for (let i = 0; i < 400; i++) b.tick(player, p);
  assert.equal(b.entities.length, 0);
});
test("nearby zombies damage survival players but not creative players", () => {
  const a = new EntityWorld(flat, [
      { type: "zombie", id: "mob-9", x: 65, y: 0, z: 64, health: 20 },
    ]),
    p = new Survival({ time: 14000 });
  // EntityAIAttackOnCollide needs a path (the zombie must have landed) and the AI looks for tasks every third tick.
  for (let i = 0; i < 6 && p.health === 20; i++) a.tick({ x: 64, y: 0, z: 64 }, p);
  assert.equal(p.health, 17);
  const c = new Survival({ time: 14000 }, "creative");
  for (let i = 0; i < 12; i++) a.tick({ x: 64, y: 0, z: 64 }, c);
  assert.equal(c.health, 20);
});
test('wheat feeds only adult ready cows, consumes one, and breeding creates one persistent calf',()=>{
 const w=new EntityWorld(flat,[{id:'mob-1',type:'cow',x:64,y:0,z:64,health:10},{id:'mob-2',type:'cow',x:65,y:0,z:64,health:10}]),p=new Survival({inventory:{305:3}}),[a,b]=w.entities;
 assert.equal(w.feed(a,309,p),false);assert.equal(w.feed(a,305,p),true);assert.equal(w.feed(a,305,p),false);assert.equal(w.feed(b,305,p),true);assert.equal(p.count(305),1);
 for(let i=0;i<59;i++)w.tick({x:64,y:0,z:70},p,305);assert.equal(w.entities.length,2);w.tick({x:64,y:0,z:70},p,305);assert.equal(w.entities.length,3);const baby=w.entities.find(e=>e.growingAge<0);assert.equal(baby.growingAge,-24000);assert.equal(a.growingAge,6000);assert.equal(w.feed(a,305,p),false);assert.equal(w.feed(baby,305,p),false);assert.equal(w.drain().filter(e=>e.xp).length,1);
 const saved=new EntityWorld(flat,w.serialize());assert.equal(saved.entities.find(e=>e.id===baby.id).growingAge,-24000);assert.equal(saved.entities.find(e=>e.id===a.id).growingAge,6000);
});
test('holding wheat attracts cows and baby hitboxes are half the adult size',()=>{
 const w=new EntityWorld(flat,[{id:'mob-1',type:'cow',x:64,y:0,z:64,health:10}]),p=new Survival({inventory:{305:1}});const c=w.entities[0];for(let i=0;i<5;i++)w.tick({x:68,y:0,z:64},p,305);assert.ok(c.x>64);c.growingAge=-100;assert.equal(entityHit({x:c.x+.3,y:.8,z:60},{x:0,y:0,z:1},c,8),null);
});
test('shears and hoes deal finite bare-hand damage and do not wear on melee hits',()=>{for(const tool of [125,120]){const w=new EntityWorld(flat,[{id:'mob-1',type:'pig',x:64,y:0,z:64,health:10}]),p=new Survival({inventory:{[tool]:1}});w.attack(w.entities[0],tool,p,{x:62,y:0,z:64});assert.equal(w.entities[0].health,9);assert.equal(p.inventory.main[p.inventory.find(tool)].damage,0);}});

const near = (a, b, eps = 1e-4) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);
const zombie = (extra = {}) => new EntityWorld(flat, [{ id: "mob-1", type: "zombie", x: 64, y: 0, z: 64, health: 20, ...extra }]);
test("interpolateRotation takes the short way round like RendererLivingEntity (boh.a)", () => {
  assert.equal(interpolateRotation(170, -170, 0.5), 180);
  assert.equal(interpolateRotation(-170, 170, 0.5), -180);
  assert.equal(interpolateRotation(10, 50, 0), 10);
  assert.equal(interpolateRotation(10, 50, 1), 50);
  assert.equal(interpolateRotation(350, 10, 0.25), 355);
  assert.equal(wrapDegrees(540), -180);
  assert.equal(wrapDegrees(-190), 170);
  assert.equal(wrapDegrees(180), -180);
  assert.equal(nearAngle(10, 350), 370);
  assert.equal(nearAngle(350, 10), -10);
});
test("mobPose interpolates position, limb swing, age and the death roll as doRender does", () => {
  const e = { x: 10, y: 4, z: -2, px: 8, py: 4, pz: -2, age: 7, growingAge: 0, death: 0, prevRenderYawOffset: 0, renderYawOffset: 0, prevRotationYawHead: 0, rotationYawHead: 0, prevRotationPitch: 0, rotationPitch: 0, limbSwing: 10, limbSwingAmount: 0.5, prevLimbSwingAmount: 0.3 };
  const pose = mobPose(e, 0.25);
  near(pose.x, 8.5);
  near(pose.z, -2);
  near(pose.limbSwing, 10 - 0.5 * 0.75);
  near(pose.limbSwingAmount, 0.35);
  near(pose.age, 7.25);
  assert.equal(pose.death, 0);
  assert.equal(mobPose({ ...e, growingAge: -10 }, 0.25).limbSwing, Math.fround(9.625 * 3));
  assert.equal(mobPose({ ...e, limbSwingAmount: 1.5, prevLimbSwingAmount: 1.5 }, 1).limbSwingAmount, 1);
  near(mobPose({ ...e, death: 11 }, 0.5).death, Math.sqrt(0.84) * 90, 1e-3);
  assert.equal(mobPose({ ...e, death: 20 }, 0.9).death, 90);
});
test("spawned and loaded mobs start with every prev field equal, so nothing lerps from the origin", () => {
  const w = zombie({ yaw: 1 }), e = w.entities[0], pose = mobPose(e, 0.5);
  assert.deepEqual([pose.x, pose.y, pose.z], [64, 0, 64]);
  near(pose.bodyYaw, (-180) / Math.PI, 1e-4);
  assert.equal(pose.headYaw, 0);
  assert.equal(pose.limbSwing, 0);
  const baby = new EntityWorld(flat, []).create("cow", 5, 6, 7);
  assert.deepEqual([baby.px, baby.py, baby.pz], [5, 6, 7]);
  const saved = w.serialize()[0];
  for (const key of ["px", "rotationYaw", "renderYawOffset", "limbSwing", "bodyTicks", "gait"]) assert.ok(!(key in saved), key);
  const old = new EntityWorld(flat, [{ ...saved, gait: 12 }]).entities[0];
  assert.equal(old.px, 64);
  assert.equal(old.limbSwing, 0);
});
test("tick keeps lastTickPos and eases limbSwingAmount toward four times the travel", () => {
  const w = zombie(), e = w.entities[0], player = { x: 64, y: 0, z: 70 }, survival = new Survival();
  // The AI no longer moves a mob on its first tick (no path yet), so a knockback-style push drives the motion.
  // Sunlight ignition can otherwise trigger a hurt swing on tick two, outside this interpolation fixture.
  w.day = false;
  e.vz = 0.1;
  w.tick(player, survival);
  assert.equal(e.pz, 64);
  assert.ok(e.z > 64.05);
  near(mobPose(e, 0.5).z, 64 + (e.z - 64) / 2, 1e-6);
  const travel = Math.fround(e.z - 64);
  near(e.limbSwingAmount, Math.fround(Math.fround(travel * 4) * 0.4), 1e-6);
  assert.equal(e.prevLimbSwingAmount, 0);
  assert.equal(e.limbSwing, e.limbSwingAmount);
  const first = e.limbSwingAmount, z1 = e.z;
  w.tick(player, survival);
  assert.equal(e.prevLimbSwingAmount, first);
  assert.equal(e.pz, z1);
  const target = Math.min(Math.fround(Math.fround(e.z - z1) * 4), 1);
  near(e.limbSwingAmount, Math.fround(first + Math.fround(Math.fround(target - first) * 0.4)), 1e-6);
  w.attack(e, 0, survival, { x: 64, y: 0, z: 60 });
  assert.equal(e.limbSwingAmount, 1.5);
});
test("a turning mob swings its body through the wrapped angle and lags its head when idle", () => {
  const w = zombie({ yaw: (-170 * Math.PI) / 180 }), e = w.entities[0];
  assert.equal(e.rotationYaw, 170);
  // EntityMoveHelper turns rotationYaw (here by 20 degrees, past the wrap); a moving mob's
  // body takes it at once and the lerp goes the short way round.
  e.prevRotationYaw = e.rotationYaw;
  e.prevRenderYawOffset = e.renderYawOffset;
  e.px = e.x;
  e.x += 0.1;
  e.rotationYaw = 190;
  w.turnBody(e);
  near(e.renderYawOffset, 190, 1e-3);
  near(e.prevRenderYawOffset, 170, 1e-3);
  near(mobPose(e, 0.5).bodyYaw, 180, 1e-3);
  // EntityBodyHelper: standing still, the body trails the head by up to 75 degrees,
  // then catches up over ten more ticks. (The head is turned by EntityLookHelper in ai.js.)
  const idle = zombie().entities[0], helper = zombie();
  idle.rotationYaw = idle.rotationYawHead = 90;
  helper.turnBody(idle);
  near(idle.rotationYawHead, 90, 1e-4);
  near(idle.renderYawOffset, 15, 1e-4);
  for (let i = 0; i < 20; i++) helper.turnBody(idle);
  near(idle.renderYawOffset, 90, 1e-3);
});

// --- 1.7.10 mob motion: replay of tools/probes/MobMoveProbe.java (verify-mobmove.mjs) ---
const mobmove = JSON.parse(await readFile(new URL("../public/research/mobmove-reference.json", import.meta.url)));
const stepWorld = (step) => ({ ...flat, solid: (x, y, z) => y < 0 || (step > 0 && z >= 2 && y < step), get: (x, y, z) => (y < 0 || (step > 0 && z >= 2 && y < step) ? 1 : 0) });
// One onLivingUpdate tick as the probe runs it: prevPos, optional jump, setAIMoveSpeed,
// moveForward * 0.98, moveEntityWithHeading, then the limbSwingAmount tail.
const probeTick = (ew, e, speed, hop) => {
  const t = ENTITY_TYPES[e.type];
  e.px = e.x; e.pz = e.z;
  if (hop) jump(e);
  e.aiMoveSpeed = e.moveForward = speed;
  e.moveForward = Math.fround(e.moveForward * Math.fround(0.98));
  moveEntityWithHeading(ew.world, e, t.width, t.height, e.moveForward);
  ew.swingLimbs(e);
};
const row = (e) => ({ x: e.x, y: e.y, z: e.z, vx: e.vx, vy: e.vy, vz: e.vz, onGround: e.onGround, collidedH: e.collidedH, limbSwingAmount: e.limbSwingAmount, limbSwing: e.limbSwing });
const sameRow = (label, got, want) => {
  for (const k of Object.keys(want)) {
    if (typeof want[k] === "boolean") assert.equal(got[k], want[k], `${label} ${k}`);
    else if (k.startsWith("limbSwing")) assert.equal(got[k], Math.fround(want[k]), `${label} ${k}`); // Java floats
    else near(got[k], want[k], 1e-12 * Math.max(1, Math.abs(want[k])));
  }
};
test("mob motion matches the unchanged 1.7.10 classes: walks, hops, walls and knockback", () => {
  assert.equal(mobmove.cases.length, 18);
  const kinds = {};
  for (const c of mobmove.cases) {
    kinds[c.case] = (kinds[c.case] || 0) + 1;
    const ew = new EntityWorld(stepWorld(c.case === "hop" ? 1 : c.case === "wall" ? 2 : 0), []),
      start = c.case === "hop" || c.case === "wall" ? [64, 0, 0.5] : [64, 0, 64],
      e = ew.create(c.type, ...start);
    e.knockbackResistance = 0;
    e.rotationYaw = c.yaw || 0;
    const label = `${c.case} ${c.type} ${c.multiplier ?? c.attacker}`;
    if (c.case === "knockback") {
      const speed = aiMoveSpeed(e, 1);
      for (let i = 0; i < 10; i++) probeTick(ew, e, speed, false);
      assert.deepEqual([e.x, e.z].map((v) => Math.fround(v)), c.start.map((v) => Math.fround(v)));
      assert.ok(knockBack(e, c.attacker[0], c.attacker[1]));
      sameRow(label + " hit", row(e), { ...c.ticks[0], onGround: e.onGround, collidedH: e.collidedH, limbSwingAmount: e.limbSwingAmount, limbSwing: e.limbSwing, x: e.x, y: e.y, z: e.z });
      c.ticks.slice(1).forEach((want, i) => {
        probeTick(ew, e, 0, false);
        sameRow(`${label} tick ${i}`, row(e), want);
      });
    } else {
      const speed = c.case === "walk" ? aiMoveSpeed(e, c.multiplier) : aiMoveSpeed(e, 1);
      assert.equal(speed, Math.fround(c.speed), label);
      c.ticks.forEach((want, i) => {
        probeTick(ew, e, speed, c.case === "hop" && e.collidedH && e.onGround);
        sameRow(`${label} tick ${i}`, row(e), want);
      });
    }
  }
  assert.deepEqual(kinds, { walk: 9, hop: 2, wall: 1, knockback: 6 });
});
test("settled limbSwingAmount of a walking pig is about 0.54 and a panicking pig about 0.84", () => {
  const settled = (type, m) => mobmove.cases.find((c) => c.case === "walk" && c.type === type && c.multiplier === m && !c.yaw).ticks.at(-1).limbSwingAmount;
  near(settled("pig", 1), 0.54, 0.005);
  near(settled("pig", 1.25), 0.843, 0.005);
  near(settled("cow", 1), 0.345, 0.005);
  assert.ok(settled("cow", 2) > 0.999);
  near(settled("zombie", 1), 0.457, 0.005);
});
test("aiMoveSpeed multiplies the attribute, and baby zombies get the +50% modifier", () => {
  assert.equal(aiMoveSpeed({ type: "pig" }, 1), 0.25);
  assert.equal(aiMoveSpeed({ type: "pig" }, 1.25), Math.fround(0.3125));
  assert.equal(aiMoveSpeed({ type: "cow", growingAge: 0 }, 2), Math.fround(Math.fround(0.2) * 2));
  assert.equal(aiMoveSpeed({ type: "zombie", growingAge: 0 }, 1), Math.fround(0.23));
  const base = Math.fround(0.23);
  assert.equal(aiMoveSpeed({ type: "zombie", growingAge: -1 }, 1), Math.fround(base + base * 0.5));
  assert.equal(aiMoveSpeed({ type: "cow", growingAge: -1 }, 1), Math.fround(0.2));
});
test("jump gives 0.42 upward and knockBack halves motion, adds 0.4 away from the attacker, and caps vy at 0.4", () => {
  const e = { x: 0, y: 0, z: 0, vx: 0.2, vy: 0.1, vz: -0.2, knockbackResistance: 0 };
  assert.ok(knockBack(e, 3, 0));
  near(e.vx, 0.1 - Math.fround(0.4), 1e-9);
  assert.equal(e.vy, 0.4000000059604645); // 0.05 + 0.4 is capped
  near(e.vz, -0.1, 1e-9);
  const up = { x: 0, y: 0, z: 0, vx: 0, vy: 0.9, vz: 0, knockbackResistance: 0 };
  knockBack(up, 0, 4);
  assert.equal(up.vy, 0.4000000059604645);
  jump(up);
  assert.equal(up.vy, Math.fround(0.42));
  const guarded = { x: 0, y: 0, z: 0, vx: 1, vy: 0, vz: 0, knockbackResistance: 1 };
  assert.equal(knockBack(guarded, 2, 0), false);
  assert.equal(guarded.vx, 1);
  const coincident = { x: 5, y: 0, z: 5, vx: 0, vy: 0, vz: 0, knockbackResistance: 0 };
  let n = 0;
  knockBack(coincident, 5, 5, () => [0.9, 0.1, 0.6, 0.1, 0.9][n++ % 5] );
  assert.ok(Math.hypot(coincident.vx, coincident.vz) > 0.39);
  addVelocity(coincident, 1, 2, 3);
  assert.ok(coincident.vy > 2);
});
test("moveFlying uses the MathHelper sine table, and ground friction scales acceleration with the cube of slipperiness", () => {
  const e = { vx: 0, vz: 0, rotationYaw: 90 };
  moveFlying(e, 0, 1, 0.1);
  near(e.vx, -0.1, 1e-6);
  near(e.vz, 0, 1e-6);
  // 0.6 slipperiness -> friction 0.546, a = speed * 0.16277136 / 0.546^3
  const m = { x: 64, y: 0, z: 64, vx: 0, vy: 0, vz: 0, rotationYaw: 0, onGround: true, aiMoveSpeed: 0.25, inWater: false, fallDistance: 0 };
  moveEntityWithHeading(flat, m, 0.9, 0.9, 0.245);
  near(m.vz, 0.245 * 0.25 * 0.16277136 / (0.546 ** 3) * 0.546, 1e-6);
});
test("a mob falls with gravity 0.08 and 0.98 drag, takes ceil(distance - 3) damage and is stopped by walls", () => {
  const w = new EntityWorld(flat, [{ id: "mob-1", type: "pig", x: 64, y: 8, z: 64, health: 10 }]), e = w.entities[0], s = new Survival();
  for (let i = 0; i < 40 && !e.onGround; i++) w.tick({ x: 64, y: 0, z: 200 }, s);
  assert.equal(e.y, 0);
  assert.equal(e.fallDistance, 0);
  assert.equal(e.health, 10 - Math.ceil(8 - 3));
  const c = moveEntity(stepWorld(2), { x: 64, y: 0, z: 1, vx: 0, vy: 0, vz: 0, onGround: true, fallDistance: 0 }, 0.9, 0.9, 0, 0, 1);
  assert.equal(c, 0);
});
