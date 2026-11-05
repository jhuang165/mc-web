import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {World,BLOCKS,isPlant,ticksRandomly,opaqueCube,blockBounds} from './world.js';
import {fromOriginal} from './block-registry.js';
import {signSolid} from './signs.js';
import {Farming} from './farming.js';
import {ITEMS} from './survival.js';
import {TILES,blockTile} from './block-textures.js';
import {populationDrops} from './population-content.js';
import {PUMPKIN_STEM,MELON_STEM,CAKE,ITEM_CAKE,stemTick,stemFertilized,stemCanFertilize,stemDrops,stemBounds,stemColor,stemDirection,stemSupported,cakeBounds,cakeEat,cakeSupported,cakePlacement,popDrops} from './stems-cake.js';
const ref=JSON.parse(await readFile(new URL('../public/research/stem-cake-reference.json',import.meta.url)));
const rows=c=>ref.rows.filter(r=>r.case===c);
assert.equal(ref.clientSha1,'e80d9b3bf5085002218d4be59e668bac718abbc6');
const internal=id=>fromOriginal(id,0).id;
const cells=flat=>{const out=[];for(let i=0;i<flat.length;i+=5)out.push(flat.slice(i,i+5));return out;};
const inner=([x,y,z,b,m])=>[x,y,z,internal(b),m];
const scripted=rolls=>{const q=rolls.map(r=>[...r]);return {nextInt:n=>{const [bound,v]=q.shift();assert.equal(n,bound);return v;},left:()=>q.length};};
const grid=()=>{const m=new Map();return {m,get:(x,y,z)=>m.get(`${x},${y},${z}`)?.[0]??0,getMeta:(x,y,z)=>m.get(`${x},${y},${z}`)?.[1]??0,set(x,y,z,b,meta=0){m.set(`${x},${y},${z}`,[b,meta]);},solid:()=>false};};
const farmland=(wet)=>wet?30:29,moisture=w=>(x,y,z)=>w.get(x,y,z)===30?7:0;

test('stem ticks replay the original random bounds, growth rate and ageing',()=>{
  let aged=0;
  for(const r of rows('tick')){
    const stem=internal(r.block),w=grid();
    for(let dx=-2;dx<=2;dx++)for(let dz=-2;dz<=2;dz++)w.set(20+dx,39,20+dz,farmland(r.wet),r.wet?7:0);
    w.set(20,40,20,stem,r.age);
    if(r.layout==='row'||r.layout==='rowcol')w.set(19,40,20,stem,0);
    if(r.layout==='rowcol')w.set(20,40,21,stem,0);
    if(r.layout==='diag')w.set(19,40,19,stem,0);
    const rand=scripted(r.rolls),out=stemTick(w,20,40,20,rand,{light:r.light,moisture:moisture(w)});
    assert.deepEqual(out,cells(r.writes).map(inner),JSON.stringify(r));assert.equal(rand.left(),0);
    aged+=out.length;
  }
  assert.ok(aged>0);
});
test('a full-grown stem puts its fruit on a free dirt, grass or farmland cell and not beside another fruit',()=>{
  let placed=0;
  for(const r of rows('fruit')){
    const stem=internal(r.block),w=grid(),g=r.ground===60?30:internal(r.ground);
    for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)w.set(20+dx,39,20+dz,dx||dz?g:30,7);
    w.set(20,40,20,stem,7);
    if(r.occupied==='west'||r.occupied==='west-and-north')w.set(19,40,20,3);
    if(r.occupied==='west-and-north')w.set(20,40,19,3);
    if(r.occupied==='fruit-east')w.set(21,40,20,r.block===104?67:81);
    const rand=scripted(r.rolls),out=stemTick(w,20,40,20,rand,{light:15,moisture:moisture(w)});
    assert.deepEqual(out,cells(r.writes).map(inner),JSON.stringify(r));assert.equal(rand.left(),0);
    placed+=out.length;
  }
  assert.ok(placed>0);
});
test('bone meal, seed drops, neighbour pops, bounds, colour and connected direction replay the original',()=>{
  for(const r of rows('bonemeal')){
    assert.equal(stemCanFertilize(r.age),r.can);
    if(!r.can){assert.deepEqual(r.writes,[]);continue;}
    const rand=scripted(r.rolls);assert.equal(stemFertilized(r.age,rand),r.writes[4]);assert.equal(rand.left(),0);
  }
  for(const r of rows('drops')){
    const rand=scripted(r.rolls),got=stemDrops(internal(r.block),r.age,n=>rand.nextInt(n)),seeds=r.drops.reduce((n,[,c])=>n+c,0);
    assert.equal(got.reduce((n,d)=>n+d.count,0),seeds);assert.ok(got.every(d=>d.id===(r.block===104?361:362)));assert.equal(rand.left(),0);
  }
  for(const r of rows('pop')){
    const w=grid();w.set(20,39,20,r.below?internal(r.below):0,0);w.set(20,40,20,internal(r.block),r.age);
    const drops=popDrops(w,20,40,20,()=>0);
    assert.equal(drops!==null,r.writes.length>0);assert.equal(stemSupported(w,20,40,20),r.below===60);
  }
  const at={west:[-1,0],east:[1,0],north:[0,-1],south:[0,1]};
  for(const r of rows('stem')){
    const w=grid(),stem=internal(r.block);w.set(20,40,20,stem,r.age);
    if(r.fruit!=='none')w.set(20+at[r.fruit][0],40,20+at[r.fruit][1],r.block===104?67:81);
    assert.deepEqual(stemBounds(r.age).map(Number),r.bounds.map(Math.fround));
    assert.equal(stemColor(r.age),r.color);assert.equal(stemDirection(w,20,40,20,stem),r.direction);assert.equal(r.collision,null);
  }
});
test('cake bounds per bite, eating food stats and the removal after the seventh slice replay the original',()=>{
  for(const r of rows('cake-bounds')){
    assert.deepEqual(cakeBounds(r.meta),r.bounds.map(Math.fround));
    assert.deepEqual(r.selected.map((v,i)=>i===1||i===4?v-64:v),r.bounds);
  }
  for(const r of rows('eat')){
    const w=grid();w.set(0,64,0,CAKE,r.meta);
    const s={creative:r.creative,food:r.food,saturation:Math.fround(r.saturation)},res=cakeEat(s,w,0,64,0);
    assert.equal(s.food,r.foodAfter,JSON.stringify(r));assert.equal(Math.fround(s.saturation),Math.fround(r.saturationAfter));
    assert.equal(res.ate,r.writes.length>0);
    if(res.ate)assert.deepEqual(r.writes,res.next===null?[0,64,0,0,0]:[0,64,0,92,res.next]);
  }
});
test('cake support is the original block below, placement follows ItemReed, and the cake drops nothing',()=>{
  let checked=0;
  for(const r of rows('support')){
    const mapped=fromOriginal(r.id,0);if(!mapped?.exact||r.id>=104&&r.id<=105)continue;
    const id=mapped.id,w=grid();w.set(0,63,0,id);
    assert.equal(cakeSupported(w,0,64,0),r.stay,`block ${r.id}`);assert.equal(signSolid(id),r.stay,`signSolid ${r.id}`);checked++;
  }
  assert.ok(checked>100);
  for(const r of rows('cake-pop')){
    const w=grid();w.set(0,63,0,r.below?internal(r.below):0);w.set(0,64,0,CAKE,2);
    assert.equal(popDrops(w,0,64,0)!==null,r.writes.length>0);assert.deepEqual(popDrops(w,0,64,0)??[],[]);
  }
  for(const r of rows('place').filter(x=>!x.creative&&x.ground!==78)){
    const w=grid();w.set(0,64,0,r.ground?internal(r.ground):0);
    const cell=cakePlacement(w,{block:[0,64,0],adjacent:[0,65,0]},b=>b===0);
    assert.deepEqual(cell?[...cell,92,0]:[],r.writes,`ground ${r.ground}`);
  }
  assert.deepEqual(rows('cake-drop')[0],{case:'cake-drop',quantity:0,item:null});
  assert.equal(populationDrops(CAKE,0,()=>0).length,0);
  assert.equal(rows('items')[0].cakeStack,1);assert.equal(rows('items')[0].milkContainer,325);
});
test('stems and cake are wired into blocks, items, textures and farming',()=>{
  for(const id of [PUMPKIN_STEM,MELON_STEM])assert.ok(isPlant(id)&&ticksRandomly(id)&&!opaqueCube(id));
  assert.ok(!BLOCKS[CAKE].reserved);
  assert.equal(ITEMS[ITEM_CAKE].stack,1);assert.equal(ITEMS[161],undefined);assert.equal(ITEMS[343].craftContainer,340);
  assert.deepEqual(blockBounds({getMeta:()=>3,get:()=>CAKE},0,0,0).map(Math.fround),cakeBounds(3));
  assert.equal(TILES[blockTile(CAKE,1,false,2)],'cake_inner');assert.equal(TILES[blockTile(CAKE,2,false,0)],'cake_top');assert.equal(TILES[blockTile(CAKE,1,false,0)],'cake_side');
  assert.equal(TILES[blockTile(PUMPKIN_STEM,0,false,0)],'pumpkin_stem_disconnected');
  const w=new World('Stems','meadow',2);for(let x=19;x<=21;x++)for(let z=19;z<=21;z++){w.set(x,40,z,30);for(let y=41;y<64;y++)w.set(x,y,z,0);}
  const f=new Farming(w);assert.ok(f.plant(20,40,20,361));assert.equal(w.get(20,41,20),PUMPKIN_STEM);assert.ok(f.plant(21,40,20,362));assert.equal(w.get(21,41,20),MELON_STEM);
  assert.ok(f.fertilize(20,41,20,()=>0));assert.equal(w.getMeta(20,41,20),2);assert.ok(f.fertilize(20,41,20,()=>.99));assert.equal(w.getMeta(20,41,20),7);assert.equal(f.fertilize(20,41,20),false);
});
