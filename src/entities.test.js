import { test } from "node:test";
import assert from "node:assert/strict";
import { EntityWorld, entityHit, actorCollides, ENTITY_TYPES, interpolateRotation, wrapDegrees, nearAngle, mobPose } from "./entities.js";
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
  assert.equal(a.attack(pig, 115, p, player), true);
  assert.equal(pig.health, 2);
  assert.equal(p.inventory.main[p.inventory.find(115)].damage, 1);
  assert.equal(a.attack(pig, 115, p, player), false);
  for (let i = 0; i < 10; i++) a.tick(player, p);
  assert.equal(a.attack(pig, 115, p, player), true);
  assert.equal(a.drain().filter((e) => e.drop === 202).length, 1);
  assert.ok(pig.death > 0);
  assert.equal(a.serialize().length, 0);
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
  a.tick({ x: 64, y: 0, z: 64 }, p);
  assert.equal(p.health, 17);
  const c = new Survival({ time: 14000 }, "creative");
  a.tick({ x: 64, y: 0, z: 64 }, c);
  assert.equal(c.health, 20);
});
test('wheat feeds only adult ready cows, consumes one, and breeding creates one persistent calf',()=>{
 const w=new EntityWorld(flat,[{id:'mob-1',type:'cow',x:64,y:0,z:64,health:10},{id:'mob-2',type:'cow',x:65,y:0,z:64,health:10}]),p=new Survival({inventory:{305:3}}),[a,b]=w.entities;
 assert.equal(w.feed(a,309,p),false);assert.equal(w.feed(a,305,p),true);assert.equal(w.feed(a,305,p),false);assert.equal(w.feed(b,305,p),true);assert.equal(p.count(305),1);
 for(let i=0;i<59;i++)w.tick({x:64,y:0,z:70},p,305);assert.equal(w.entities.length,2);w.tick({x:64,y:0,z:70},p,305);assert.equal(w.entities.length,3);const baby=w.entities.find(e=>e.growingAge<0);assert.equal(baby.growingAge,-24000);assert.equal(a.growingAge,6000);assert.equal(w.feed(a,305,p),false);assert.equal(w.feed(baby,305,p),false);assert.equal(w.drain().filter(e=>e.xp).length,1);
 const saved=new EntityWorld(flat,w.serialize());assert.equal(saved.entities.find(e=>e.id===baby.id).growingAge,-24000);assert.equal(saved.entities.find(e=>e.id===a.id).growingAge,6000);
});
test('holding wheat attracts cows and baby hitboxes are half the adult size',()=>{
 const w=new EntityWorld(flat,[{id:'mob-1',type:'cow',x:64,y:0,z:64,health:10}]),p=new Survival({inventory:{305:1}});const c=w.entities[0];w.tick({x:68,y:0,z:64},p,305);assert.ok(c.x>64);c.growingAge=-100;assert.equal(entityHit({x:c.x+.3,y:.8,z:60},{x:0,y:0,z:1},c,8),null);
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
  w.tick(player, survival);
  assert.equal(e.pz, 64);
  near(e.z, 64.09);
  near(mobPose(e, 0.5).z, 64.045);
  near(e.limbSwingAmount, 0.4 * 0.36, 1e-6);
  assert.equal(e.prevLimbSwingAmount, 0);
  assert.equal(e.limbSwing, e.limbSwingAmount);
  const first = e.limbSwingAmount, z1 = e.z;
  w.tick(player, survival);
  assert.equal(e.prevLimbSwingAmount, first);
  near(e.limbSwingAmount, Math.fround(first + Math.fround(Math.fround(0.36 - first) * 0.4)), 1e-6);
  assert.equal(e.pz, z1);
  w.attack(e, 0, survival, { x: 64, y: 0, z: 60 });
  assert.equal(e.limbSwingAmount, 1.5);
});
test("a turning mob swings its body through the wrapped angle and lags its head when idle", () => {
  const w = zombie({ yaw: (-170 * Math.PI) / 180 }), e = w.entities[0];
  assert.equal(e.rotationYaw, 170);
  const a = (170 * Math.PI) / 180;
  w.tick({ x: 64 + 10 * Math.sin(a), y: 0, z: 64 + 10 * Math.cos(a) }, new Survival());
  near(e.rotationYaw, 190, 1e-3);
  near(e.renderYawOffset, 190, 1e-3);
  near(e.prevRenderYawOffset, 170, 1e-3);
  near(mobPose(e, 0.5).bodyYaw, 180, 1e-3);
  // EntityBodyHelper: standing still, the body trails the head by up to 75 degrees,
  // then catches up over ten more ticks.
  const idle = zombie().entities[0], helper = zombie();
  idle.yaw = -Math.PI / 2;
  helper.turnBody(idle);
  near(idle.rotationYawHead, 90, 1e-4);
  near(idle.renderYawOffset, 15, 1e-4);
  for (let i = 0; i < 20; i++) helper.turnBody(idle);
  near(idle.renderYawOffset, 90, 1e-3);
});
