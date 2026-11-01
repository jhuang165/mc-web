import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spiderAttack, spiderDrops, spiderLegs, spiderFindsPlayer } from "./spider.js";
import { EntityWorld, ENTITY_TYPES, moveEntityWithHeading, setEntityRandom } from "./entities.js";
import { Survival, ITEMS, craftingResult } from "./survival.js";
import { makeStack } from "./inventory.js";
import { JavaRandom } from "./lighting.js";
const ref = JSON.parse(await readFile(new URL('../public/research/spider-reference.json', import.meta.url)));
const cases = name => ref.records.filter(r => r.case === name);
const near = (a,b,label) => assert.ok(Math.abs(a-b)<1e-6, `${label}: ${a} != ${b}`);
const flat = { numericSeed:123, solid:(x,y,z)=>y<0, get:(x,y,z)=>y<0?1:0, surface:()=>0, spawn:()=>({x:64,y:0,z:64}) };
const random = seed => new JavaRandom(seed);
test('spider constructor facts agree with the unchanged EntitySpider', () => {
  const r=cases('facts')[0], t=ENTITY_TYPES.spider;
  for(const key of ['width','height','health','damage']) near(t[key],r[key],key);
  near(t.movement,r.speed,'speed'); assert.equal(r.poisonAllowed,false);
  assert.equal(spiderFindsPlayer(.499),true); assert.equal(spiderFindsPlayer(.5),false);
  const food=cases('food')[0]; assert.equal(ITEMS[326].food,food.hunger); near(ITEMS[326].saturation,food.saturation,'saturation');
});
test('600 seeded original spider string/eye drop rolls', () => {
  for(const r of cases('drops')) assert.deepEqual(spiderDrops(r.player,random(r.seed)),{string:r.string,eye:r.eye},JSON.stringify(r));
});
test('4,800 original attack boundary, daylight and leap cases', () => {
  for(const r of cases('attack')) {
    const e={x:64,y:0,z:64,vx:.2,vy:-.1,vz:-.3,attack:0,onGround:r.ground};
    const result=spiderAttack(e,{x:67,y:0,z:68,height:.9},r.distance,r.light,random(r.seed));
    assert.equal(result==='forget',!r.target); assert.equal(result==='hit',r.hits===1); assert.equal(e.attack,r.cooldown);
    for(const key of ['vx','vy','vz'])near(e[key],r[key],key);
  }
});
test('40 ModelSpider poses use the original eight leg rotations', () => {
  for(const r of cases('pose'))spiderLegs(r.swing,r.amount).forEach((leg,i)=>leg.forEach((a,j)=>near(a,r.legs[i][j],`leg ${i} axis ${j}`)));
});
test('120 original ladder/climbing physics steps, floor and six-block wall', () => {
  for(const wall of [false,true]) {
    const w={...flat,solid:(x,y,z)=>y<0||(wall&&z>=2&&y<6)};w.get=(x,y,z)=>w.solid(x,y,z)?3:0;
    const ew=new EntityWorld(w,[]),e=ew.create('spider',0,0,0);e.onGround=true;
    for(const r of cases('climb').filter(r=>r.wall===wall)) {
      e.vx=0;e.vz=.22;
      moveEntityWithHeading(w,e,ENTITY_TYPES.spider.width,ENTITY_TYPES.spider.height,0);e.climbing=e.collidedH;
      for(const key of ['y','z','vy','vz'])near(e[key],r[key],`${wall} ${r.tick} ${key}`);
      assert.equal(e.climbing,r.climbing);
    }
  }
});
test('spider aggression uses light, provocation and creative immunity; does not burn in sunlight', () => {
  const ew=new EntityWorld(flat,[],()=>.5),e=ew.create('spider',64,0,65),p={x:64,y:0,z:64};ew.entities.push(e);
  const s=new Survival({slots:[],time:6000});ew.lightAt=()=>15;
  for(let i=0;i<25;i++)ew.tick(p,s);
  assert.equal(s.health,20);assert.equal(e.spiderTarget,false);assert.equal(e.health,16);
  ew.damage(e,1,64,64);ew.tick(p,s);assert.equal(e.spiderTarget,true);
  e.spiderTarget=false;e.revenge=0;ew.lightAt=()=>0;ew.tick(p,s);assert.equal(e.spiderTarget,true);
  s.mode='creative'; // Survival uses creative getter over mode.
  ew.tick(p,s);assert.equal(e.spiderTarget,false);
});
test('night spawns and save reload preserve spider health and clear transient aggression', () => {
  const ew=new EntityWorld(flat,[]),s=new Survival({slots:[],time:14000}),p={x:64,y:0,z:64};
  for(let i=0;i<260;i++)ew.tick(p,s);
  const e=ew.entities.find(e=>e.type==='spider');assert.ok(e);e.health=9;e.spiderTarget=true;e.climbing=true;
  const loaded=new EntityWorld(flat,ew.serialize()).entities.find(e=>e.type==='spider');
  assert.equal(loaded.health,9);assert.equal(loaded.spiderTarget,false);assert.equal(loaded.climbing,false);
});
test('spider kill supplies string, recent player hits permit eyes and five XP', () => {
  const zero={nextInt:()=>0,nextFloat:()=>0,nextDouble:()=>0.5,nextGaussian:()=>0};
  const ew=new EntityWorld(flat,[],()=>0),e=ew.create('spider',64,0,64);ew.entities.push(e);setEntityRandom(e,zero);
  ew.damage(e,20,63,64);for(let i=0;i<20;i++)ew.deathUpdate(e,ENTITY_TYPES.spider);const events=ew.drain();assert.equal(events.find(e=>e.xp)?.xp,5);assert.equal(events.find(e=>e.drop===326)?.count,1);
  const env=new EntityWorld(flat,[],()=>0),other=env.create('spider',64,0,64);env.entities.push(other);setEntityRandom(other,zero);env.damage(other,20,63,64,false);
  assert.equal(env.drain().some(e=>e.drop===326),false);
});
test('four string craft white wool in both grids; eyes consume and always poison', () => {
  assert.deepEqual(craftingResult(Array(4).fill(makeStack(321)),2),makeStack(19));
  const grid=Array(9).fill(null);for(const i of [1,2,4,5])grid[i]=makeStack(321);assert.deepEqual(craftingResult(grid,3),makeStack(19));
  const s=new Survival({slots:[makeStack(326,2)],food:10});
  // Food consumption is shared with all ItemFood (32 ticks in main.js).
  assert.equal(s.eat(326,()=>.99999),true);assert.equal(s.held.count,1);assert.equal(s.food,12);assert.deepEqual(s.effects.serialize(),[{id:19,duration:100,amplifier:0}]);
});

test('darkness allows contact damage with a 20-tick cooldown and original step events', () => {
  const ew=new EntityWorld(flat,[],()=>.5),e=ew.create('spider',64,0,56),s=new Survival({slots:[],food:0,time:14000}),p={x:64,y:0,z:64};
  ew.entities.push(e);ew.lightAt=()=>0;
  for(let i=0;i<60;i++)ew.tick(p,s);
  assert.ok(ew.drain().some(event=>event.sound==='mob.spider.step'&&event.volume===.15));
  assert.ok(s.health<20);assert.ok(e.attack>0&&e.attack<=20);
  s.hurtTicks=0;const health=s.health;e.attack=20;
  e.x=p.x;e.y=p.y;e.z=p.z+1;e.vx=e.vy=e.vz=0;
  ew.tick(p,s);assert.equal(s.health,health);
});

test('40 original legacy spider swimming steps use 0.02 acceleration', () => {
  const ew=new EntityWorld(flat,[]),e=ew.create('spider',0,10,0);e.inWater=true;
  for(const r of cases('swim')) {
    moveEntityWithHeading(flat,e,ENTITY_TYPES.spider.width,ENTITY_TYPES.spider.height,Math.fround(Math.fround(.8)*Math.fround(.98)));
    for(const key of ['y','z','vy','vz'])near(e[key],r[key],`${r.tick} ${key}`);
  }
});
