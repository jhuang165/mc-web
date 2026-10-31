import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {World,CARROTS,POTATOES,isCrop,isPlant,opaqueCube,ticksRandomly} from './world.js';
import {CARROT,POTATO,BAKED_POTATO,POISONOUS_POTATO,rootDrops,zombieRareDrop,cropItem} from './crops.js';
import {Farming,cropDrops} from './farming.js';
import {ITEMS,Survival} from './survival.js';
import {makeStack} from './inventory.js';
import {EntityWorld} from './entities.js';
import {TILES,blockTile} from './block-textures.js';
import {itemTexture} from './first-person.js';
import {SMELT_EXPERIENCE} from './experience.js';
const reference=JSON.parse(await readFile(new URL('../public/research/crops-reference.json',import.meta.url)));
const ids={141:CARROTS,142:POTATOES,391:CARROT,392:POTATO,393:BAKED_POTATO,394:POISONOUS_POTATO,295:309,296:305};
function farm(){const w=new World('Roots','meadow',2);for(let x=19;x<=21;x++)for(let z=19;z<=21;z++){w.set(x,40,z,30);for(let y=41;y<64;y++)w.set(x,y,z,0);}return {w,f:new Farming(w)};}
const flat={numericSeed:123,solid:(x,y,z)=>y<0,get:(x,y,z)=>y<0?1:0,surface:()=>0,spawn:()=>({x:64,y:0,z:64})};

test('root harvests replay every original-class age/seed fixture, including poisonous potatoes',()=>{
  let poison=0;
  for(const row of reference.rows.filter(r=>r.case==='drops')){
    const rolls=[...row.rolls],actual=rootDrops(ids[row.block],row.age,n=>{const [bound,value]=rolls.shift();assert.equal(n,bound);return value;});
    const totals=new Map();for(const [id,count]of row.drops)totals.set(ids[id],(totals.get(ids[id])||0)+count);
    assert.deepEqual(actual,[...totals].map(([id,count])=>({id,count})));assert.equal(rolls.length,0);
    poison+=actual.some(d=>d.id===POISONOUS_POTATO)?1:0;
  }
  assert.ok(poison>0);
});
test('root stage textures replay the original icon indices',()=>{
  for(const row of reference.rows.filter(r=>r.case==='icons'))for(let age=0;age<8;age++)assert.equal(TILES[blockTile(ids[row.block],0,false,age)],`${row.block===141?'carrots':'potatoes'}_stage_${row.stages[age]}`);
});
test('growth and mixed-crop spacing replay original-class random bounds and stages',()=>{
  const {w,f}=farm();let grown=0;
  for(const row of reference.rows.filter(r=>r.case==='growth')){
    const block=ids[row.block];for(let x=19;x<=21;x++)for(let z=19;z<=21;z++)w.set(x,41,z,row.mixed?31:block);
    w.set(20,41,20,block,true,row.age);const rolls=[...row.rolls];
    f.grow(20,41,20,1,()=>{const [bound,n]=rolls.shift();assert.equal(Math.floor(25/f.growthRate(20,41,20))+1,bound);return(n+.5)/bound;});
    assert.equal(w.getMeta(20,41,20),row.after);assert.equal(rolls.length,0);grown+=row.after>row.age?1:0;
  }
  assert.ok(grown>0);
});
test('bone meal replays original two-to-five-stage increases and stops at maturity',()=>{
  const {w,f}=farm();for(const row of reference.rows.filter(r=>r.case==='bonemeal')){
    w.set(20,41,20,ids[row.block],true,row.age);
    const roll=row.rolls[0];f.fertilize(20,41,20,()=>{assert.equal(roll[0],4);return(roll[1]+.5)/4;});
    assert.equal(w.getMeta(20,41,20),row.after);
  }
});
test('carrots and potatoes plant on farmland, remain non-solid, and keep their ages after reload',()=>{
  const {w,f}=farm();for(const [x,item,block]of [[20,CARROT,CARROTS],[21,POTATO,POTATOES]]){
    assert.ok(f.plant(x,40,20,item));assert.equal(f.plant(x,40,20,item),false);
    assert.ok(isCrop(block)&&isPlant(block)&&ticksRandomly(block));assert.equal(opaqueCube(block),false);assert.equal(w.solid(x,41,20),false);
    f.fertilize(x,41,20,()=>.9);assert.equal(w.getMeta(x,41,20),5);
  }
  w.set(19,40,20,2);assert.equal(f.plant(19,40,20,CARROT),false);assert.equal(f.plant(19,40,20,BAKED_POTATO),false);
  const restored=new World('Roots','meadow',2);restored.restore([...w.edits]);const next=new Farming(restored,f.serialize());
  assert.equal(restored.get(20,41,20),CARROTS);assert.equal(restored.getMeta(20,41,20),5);assert.equal(restored.getMeta(21,41,20),5);
  assert.ok(next.grow(20,41,20,1,()=>0));assert.equal(restored.getMeta(20,41,20),6);
  assert.deepEqual(cropDrops(POTATOES,()=>0,7),[{id:POTATO,count:4},{id:POISONOUS_POTATO,count:1}]);assert.equal(cropItem(CARROTS),CARROT);
});
test('original food values, item textures and baked-potato furnace output are connected',()=>{
  for(const row of reference.rows.filter(r=>r.case==='food')){
    const item=ITEMS[ids[row.id]];assert.equal(item.food,row.food);assert.equal(Math.fround(item.saturation),Math.fround(row.saturation));assert.equal(SMELT_EXPERIENCE[item.id]||0,row.xp);
    assert.equal(itemTexture(item.id),`/media/1.7.10/items/${item.texture}.png`);
  }
  const p=new Survival({slots:[]}),f=p.furnace('0,0,0');f.items=[makeStack(POTATO,2),makeStack(301),null];
  for(let i=0;i<400;i++)p.tickFurnaces();
  assert.deepEqual(f.items[2],makeStack(BAKED_POTATO,2));assert.equal(f.items[0],null);
});
test('pigs accept only the original breeding item and produce a persistent piglet',()=>{
  for(const row of reference.rows.filter(r=>r.case==='pig')){
    const w=new EntityWorld(flat,[]),pig=w.create('pig',64,0,64),p=new Survival({slots:[makeStack(ids[row.id],2)]});w.entities.push(pig);
    assert.equal(w.feed(pig,ids[row.id],p),row.breeds);
  }
  const w=new EntityWorld(flat,[]),p=new Survival({slots:[makeStack(CARROT,3)]});const a=w.create('pig',64,0,64),b=w.create('pig',65,0,64);w.entities.push(a,b);
  assert.ok(w.feed(a,CARROT,p)&&w.feed(b,CARROT,p));assert.equal(p.count(CARROT),1);
  for(let i=0;i<60;i++)w.tick({x:64,y:0,z:70},p,CARROT);
  assert.equal(w.entities.length,3);const baby=w.entities.find(e=>e.growingAge<0);assert.equal(baby.type,'pig');assert.equal(baby.growingAge,-24000);assert.equal(a.growingAge,6000);
  assert.equal(w.feed(baby,CARROT,p),false);assert.equal(w.feed(a,CARROT,p),false);
  const loaded=new EntityWorld(flat,w.serialize());assert.equal(loaded.entities.find(e=>e.id===baby.id).growingAge,-24000);
});
test('holding carrots tempts pigs while wheat does not',()=>{
  const p=new Survival({slots:[makeStack(CARROT),makeStack(305)]});for(const item of [CARROT,305]){
    const w=new EntityWorld(flat,[]),pig=w.create('pig',64,0,64);w.entities.push(pig);
    for(let i=0;i<6;i++)w.tick({x:68,y:0,z:64},p,item);
    assert.equal(w.ai.brain(pig).tasks.running.some(t=>t.action.constructor.name==='Tempt'),item===CARROT);
  }
});
test('zombie rare-drop boundary rolls require recent player damage and select iron, carrots or potatoes',()=>{
  assert.equal(zombieRareDrop(0,()=>{throw Error('must not roll');}),0);
  for(const [pick,id]of [302,CARROT,POTATO].entries()){const rolls=[4,pick];assert.equal(zombieRareDrop(100,n=>{assert.equal(n,rolls.length===2?200:3);return rolls.shift();}),id);}
  assert.equal(zombieRareDrop(100,()=>5),0);
  const w=new EntityWorld(flat,[]);w.random=()=>0;const z=w.create('zombie',64,0,64);w.entities.push(z);
  w.damage(z,30,63,64);assert.equal(w.drain().find(e=>e.drop===302)?.count,1);
  const unhit=w.create('zombie',64,0,64);w.entities.push(unhit);w.hazard(unhit,30);assert.equal(w.drain().some(e=>e.drop===302),false);
});
test('zombie player-hit eligibility expires after 100 ticks and is not restored from saves',()=>{
  const w=new EntityWorld(flat,[],()=>.99),z=w.create('zombie',64,0,64),p=new Survival({time:14000},'creative');w.entities.push(z);
  w.damage(z,1,63,64);assert.equal(z.recentlyHit,100);
  const loaded=new EntityWorld(flat,w.serialize());assert.equal(loaded.entities[0].recentlyHit,0);
  for(let i=0;i<100;i++)w.tick({x:70,y:0,z:70},p);
  assert.equal(z.recentlyHit,0);w.drain();w.random=()=>0;w.hazard(z,30);
  assert.equal(w.drain().some(e=>[302,CARROT,POTATO].includes(e.drop)),false);
});
