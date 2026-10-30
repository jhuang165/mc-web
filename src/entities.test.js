import { test } from "node:test";
import assert from "node:assert/strict";
import { EntityWorld, entityHit, actorCollides } from "./entities.js";
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
    assert.equal(actorCollides(flat, e.x, e.y, e.z, 0.9, 1.4), false);
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
