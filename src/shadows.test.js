import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {SHADOWS,takesShadow,shadowQuads} from './shadows.js';
import {BLOCKS} from './world.js';
import {BRIGHTNESS} from './lighting.js';

const reference=JSON.parse(await readFile(new URL('../public/research/shadow-reference.json',import.meta.url)));
// A floor of `block` at y = 0 with a uniform light level above it.
const floor=(block=3,level=15)=>({get:(x,y,z)=>y===0?block:0,light:()=>level});
const near={x:0.5,y:1.62,z:0.5},f=Math.fround;
const item=(x,y,z)=>({...SHADOWS.item,x,y:y+0.125,z,height:0.25});

test('only blocks that render as normal blocks take a shadow',()=>{
 // Reserved placeholder ids (cactus and sugar cane on another branch) are not probed.
 assert.equal(Object.keys(reference.blocks).length,BLOCKS.filter((b)=>!b.reserved).length-1);
 for(const [id,b] of Object.entries(reference.blocks)){
  assert.equal(takesShadow(+id),!b.air&&b.normal,BLOCKS[id].name);
  if(b.normal)assert.deepEqual(b.bounds,[0,0,0,1,1,1],BLOCKS[id].name);
 }
 assert.equal(takesShadow(0),false);
});

test('an item on the floor: one quad 1/64 above it, faded by its height',()=>{
 const [q,...rest]=shadowQuads(item(0.5,1,0.5),{x:0.5,y:1.125,z:0.5},floor());
 assert.equal(rest.length,0);
 assert.deepEqual([q.x0,q.x1,q.z0,q.z1,q.y],[0,1,0,1,1.015625]);
 // (0.75 opacity - (1.25 - 1) / 2) * 0.5 * brightness 1
 assert.equal(q.alpha,0.3125);
 // The texture spans 2 x 0.15 blocks centred on the entity (u falls with x).
 const size=SHADOWS.item.size;
 assert.equal(q.u0,f(0.5/2/size+0.5));assert.equal(q.u1,f(-0.5/2/size+0.5));
 assert.equal(q.v0,q.u0);assert.equal(q.v1,q.u1);
});

test('viewer distance and block light scale the opacity',()=>{
 const at=(viewer,level=15)=>shadowQuads(item(0.5,1,0.5),viewer,floor(3,level))[0]?.alpha;
 const opacity=f((1-64/256)*0.75);
 assert.equal(at({x:8.5,y:1.125,z:0.5}),f((opacity-0.125)*0.5));
 assert.equal(at({x:16.5,y:1.125,z:0.5}),undefined);
 assert.equal(at(near,3),undefined);
 assert.equal(at(near,4),f((f(0.75*(1-(1.62-1.125)**2/256))-0.125)*0.5*BRIGHTNESS[4]));
});

test('a rising item fades out and leaves the floor unshadowed',()=>{
 const alpha=y=>shadowQuads(item(0.5,y,0.5),near,floor()).reduce((a,q)=>Math.max(a,q.alpha),0);
 assert.ok(alpha(1.5)<alpha(1));
 assert.equal(shadowQuads(item(0.5,2.4,0.5),near,floor()).length,0);
});

test('glass, farmland and chests take no shadow; leaves do',()=>{
 for(const b of [9,29,41])assert.equal(shadowQuads(item(0.5,1,0.5),near,floor(b)).length,0);
 assert.equal(shadowQuads(item(0.5,1,0.5),near,floor(5)).length,1);
});

test('a pig covers every cell its 1.4-block square reaches; a piglet half that',()=>{
 const pig={...SHADOWS.pig,x:1,y:1,z:0.5,height:0.9};
 const cells=e=>shadowQuads(e,near,floor()).map(q=>[q.x0,q.z0]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
 assert.deepEqual(cells(pig),[[0,-1],[0,0],[0,1],[1,-1],[1,0],[1,1]]);
 assert.deepEqual(cells({...pig,height:0.45,child:true}),[[0,0],[1,0]]);
});
