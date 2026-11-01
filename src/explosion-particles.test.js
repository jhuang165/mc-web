import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {primeTnt,tickTnt,TNT_Y_OFFSET} from './explosion.js';
import {JavaRandom} from './lighting.js';
import {ExplosionParticles,explosionSprite} from './explosion-particles.js';
const ref=JSON.parse(await readFile(new URL('../public/research/explosion-particles-reference.json',import.meta.url)));
const state=raw=>{const r=new JavaRandom(0);r.seed=BigInt(raw);return r;};
function world(fixture){
  const cells=new Map(),put=(x,y,z,id)=>cells.set(`${x},${y},${z}`,id);
  if(fixture===1)put(11,65,10,3);
  if(fixture===2)put(10,65,10,3);
  if(fixture===3)put(10,64,10,51);
  if(fixture===5)put(11,64,10,53);
  if(fixture===6)put(11,64,10,29);
  if(fixture===7)put(11,64,10,52);
  const get=(x,y,z)=>cells.get(`${x},${y},${z}`)??(y<64?3:0);
  return {get,getMeta:(x,y,z)=>fixture===7&&x===11&&y===64&&z===10?5:0,solid:(x,y,z)=>[3,53,29,52].includes(get(x,y,z))};
}
test('four explosion particle constructors and full lifetimes replay original classes in eight collision fixtures',()=>{
  const records=ref.records.filter(r=>r.case==='particle');assert.equal(records.length,32);
  for(const c of records){
    const r=state(c.math),system=new ExplosionParticles({random:()=>r.nextDouble(),entityRandom:()=>state(c.initial.seed)}),w=world(c.fixture);
    const velocity=c.kind==='largeexplode'?[0.5,0,0]:c.kind==='hugeexplosion'?[1,0,0]:[0.15,0.1,-0.05];
    const p=system.spawn(c.kind,10.5,c.fixture===4?64.01:64.5,10.5,...velocity),q=c.initial;
    const what=c.kind+' fixture '+c.fixture;
    assert.deepEqual([p.x,p.y,p.z,p.mx,p.my,p.mz,p.jx,p.jy,p.scale,p.max,p.r,p.g,p.b,p.width,p.height,p.yOffset],
      [q.x,q.y,q.z,q.vx,q.vy,q.vz,q.jx,q.jy,q.scale,c.max,...q.rgb,q.width,q.height,q.yOffset],what+' constructor');
    assert.deepEqual(p.box,q.box,what+' box');
    const calls=[];
    if(c.kind==='hugeexplosion')system.spawn=(kind,...args)=>calls.push([kind,...args]);
    c.tracks.forEach((expected,t)=>{
      calls.length=0;system.tick(w);
      assert.deepEqual([p.x,p.y,p.z,p.mx,p.my,p.mz,p.age,p.frame,!!p.dead,p.onGround],expected,what+' tick '+t);
      assert.deepEqual(calls,c.events[t],what+' emitter tick '+t);
    });
    assert.equal(system.list.includes(p)||system.emitters.includes(p),false);
  }
});
test('client explosion burst emits original central puff and paired small explosion/smoke calls',()=>{
  const records=ref.records.filter(r=>r.case==='burst');assert.equal(records.length,8);
  for(const c of records){
    const system=new ExplosionParticles({worldRandom:new JavaRandom(19)}),calls=[];
    system.spawn=(kind,...args)=>calls.push([kind,...args]);
    system.burst(10.5,70.5,10.5,c.size,[[10,70,10],[11,70,10],[9,69,10],[11,71,12]],{smoking:c.smoking});
    assert.deepEqual(calls,c.calls,`power ${c.size}, smoking ${c.smoking}`);
  }
});
test('huge explosion emits 48 puffs over eight ticks; per-layer caps and clear remove transient effects',()=>{
  const system=new ExplosionParticles({random:()=>0.5,entityRandom:()=>new JavaRandom(7),limit:10});
  system.spawn('hugeexplosion',0,5,0);
  const spawn=system.spawn.bind(system);let puffs=0;
  system.spawn=(kind,...args)=>{if(kind==='largeexplode')puffs++;return spawn(kind,...args);};
  for(let i=0;i<8;i++)system.tick(world(0));
  assert.equal(puffs,48);assert.equal(system.emitters.length,0);assert.ok(system.list.length<=10);
  for(let i=0;i<15;i++)system.spawn('smoke',0,5,0);
  assert.equal(system.list.filter(p=>p.kind==='smoke').length,10);
  system.clear();assert.equal(system.list.length,0);assert.equal(system.emitters.length,0);
});
test('explosion sprite frames use original UV inset and smoke grows during the first fraction of life',()=>{
  const p={kind:'largeexplode',age:0,max:8,size:1.5};
  assert.deepEqual(explosionSprite(p,0),{u0:0,u1:Math.fround(0.24975),v0:0,v1:Math.fround(0.24975),size:1.5});
  assert.equal(explosionSprite({...p,age:8},1),null);
  const smoke={kind:'smoke',age:0,max:20,scale:2,frame:7};
  assert.equal(explosionSprite(smoke,0).size,0);
  assert.equal(explosionSprite({...smoke,age:2},0).size,Math.fround(0.2));
});


test('primed TNT emits original fuse smoke positions and stops on the explosion tick',()=>{
  const c=ref.records.find(c=>c.case==='tnt-smoke'),e=primeTnt(10.5,65.5,10.5,{fuse:3,random:()=>0});
  [e.vx,e.vy,e.vz]=[0.01,0.2,-0.02];
  c.tracks.forEach((row,t)=>{
    const events=[],at=tickTnt(world(0),e,(...p)=>events.push(['smoke',...p,0,0,0]));
    assert.deepEqual([e.x,e.y+TNT_Y_OFFSET,e.z,e.vx,e.vy,e.vz,e.fuse,!!at],row);
    assert.deepEqual(events,c.events[t]);
  });
});
