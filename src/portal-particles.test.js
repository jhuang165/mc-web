import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Fx} from './fx.js';
import {JavaRandom} from './lighting.js';

const reference=JSON.parse(await readFile(new URL('../public/research/portal-particle-reference.json',import.meta.url)));
const raw=seed=>{const r=new JavaRandom(0);r.seed=BigInt(seed);return r;};

test('portal constructors, full lifetimes, scale and light replay unchanged native particles',()=>{
 assert.equal(reference.records.length,8);
 for(const c of reference.records){
  const q=c.initial,math=raw(c.math),rand=raw(q.seed);
  const fx=new Fx({random:()=>math.nextDouble(),entityRandom:()=>rand});
  const p=fx.spawn('portal',...c.args);
  assert.deepEqual([p.x,p.y,p.z,p.mx,p.my,p.mz,p.jx,p.jy,p.scale,p.max,p.gravity,p.r,p.g,p.b,p.width,p.height,p.yOffset,p.box],
    [q.x,q.y,q.z,q.vx,q.vy,q.vz,q.jx,q.jy,q.scale,q.maxAge,q.gravity,...q.rgb,q.width,q.height,q.yOffset,q.box],`constructor ${c.case}`);
  assert.equal(p.noClip,c.noClip);
  assert.equal(math.seed,BigInt(c.mathAfter));assert.equal(rand.seed,BigInt(c.entityAfter));
  const draws=()=>{for(const d of c.draws.filter(d=>d.age===p.age)){
    const sprite=fx.sprite(p,d.partial);
    assert.equal(p.scale,d.scale,`scale ${c.case} age${p.age} partial${d.partial}`);
    assert.equal(sprite.size,Math.fround(Math.fround(0.1)*d.scale));
    assert.equal(fx.brightness(p,d.partial,d.packed),d.light,`light ${c.case} age${p.age}`);
  }};
  draws();
  for(const [i,expected] of c.tracks.entries()){
    fx.step({get(){throw new Error('Portal movement must ignore collision');}},p);
    assert.deepEqual([p.x,p.y,p.z,p.mx,p.my,p.mz,p.age,p.tex,!!p.dead,p.onGround,p.r,p.g,p.b],expected,`tick ${c.case}:${i}`);
    draws();
  }
  assert.equal(p.dead,true);
 }
});

test('portal spawn follows particle settings/range and shares the layer-zero lifetime pool',()=>{
 const fx=new Fx({random:()=>0.5,entityRandom:()=>new JavaRandom(2)});
 fx.setting=2;assert.equal(fx.spawn('portal',0,0,0),null);
 fx.setting=0;fx.viewer=[0,0,0];assert.equal(fx.spawn('portal',17,0,0),null);
 const p=fx.spawn('portal',0,0,0);assert.equal(fx.effects.layers[0][0],p);
 for(let i=0;i<=p.max;i++)fx.effects.tick(null);
 assert.equal(fx.effects.count(),0);
});
