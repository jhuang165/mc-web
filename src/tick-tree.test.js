import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {World,SAND,WATER} from './world.js';import {Fluids} from './fluids.js';import {Fire} from './fire.js';import {FallingBlocks} from './falling.js';
import {TickTree,attachTickTree,TICK_UPDATES_CAP,tickUpdatesTake} from './tile-ticks.js';
const reference=JSON.parse(fs.readFileSync(new URL('../public/research/tile-ticks-reference.json',import.meta.url)));
// A source over a plain array: the creation id is the position in the native TreeSet's insertion (the probe's `before` order).
const arraySource=(name,list,log)=>({name,begin(){},head:()=>list[0],delay:(e)=>e.t,p:(e)=>e.p,id:(e)=>e.id,take:()=>list.shift(),run:(e)=>log.push(e)});
test('TickTree takes the unchanged WorldServer.tickUpdates result from mixed-kind lists: same shared cap, same order, same remainder',()=>{
 for(const c of reference.cases.filter(k=>k.kind==='tick')){
  const kinds={8:'fluid',9:'fluid',10:'fluid',11:'fluid',12:'falling',13:'falling',122:'falling',145:'falling',51:'fire'},lists={fluid:[],fire:[],falling:[],redstone:[]};
  c.before.forEach((a,id)=>lists[kinds[a[0]]??'redstone'].push({a,t:a[4],p:a[5],id}));
  for(const l of Object.values(lists))l.sort((x,y)=>x.t-y.t||x.p-y.p||x.id-y.id);
  const log=[],tree=new TickTree().attach(Object.entries(lists).map(([n,l])=>arraySource(n,l,log)));
  const taken=tree.takeDue(c.all),left=Object.values(lists).flat().sort((x,y)=>x.t-y.t||x.p-y.p||x.id-y.id).map(e=>e.a);
  const flat=tickUpdatesTake(c.before.map((a,id)=>({a,t:a[4],p:a[5],id})),c.all);
  assert.deepEqual(taken.map(x=>x.e.a),flat.taken.map(e=>e.a),`order ${c.index}`);
  assert.deepEqual(left,c.remaining,`left ${c.index}`);assert.ok(taken.length<=TICK_UPDATES_CAP);
 }
});
const world=()=>{const w=new World('tt');for(let x=0;x<8;x++)for(let z=0;z<3;z++)w.set(x,59,z,1,false);return w;};
test('live lists share one creation counter: equal time and priority run in request order across kinds, and the cap is shared',()=>{
 const w=world(),fl=new Fluids(w),fi=new Fire(w,{weather:()=>({})}),fa=new FallingBlocks(w),log=[];
 const tree=attachTickTree({fluids:fl,fire:fi,falling:fa});
 for(const [n,s] of [['fluids',fl],['fire',fi],['falling',fa]]){const r=s.run.bind(s);s.run=(e)=>{log.push(n);return r(e)};}
 w.set(1,60,1,SAND,false);fa.enqueue(1,60,1,SAND,2,0);w.set(2,60,1,WATER,false);fl.enqueue(2,60,1,WATER,2,0);w.set(3,60,1,51,false);fi.schedule(3,60,1,2,0);
 tree.tick({x:0,z:0});assert.deepEqual(log,[]);tree.tick({x:0,z:0});
 assert.deepEqual(log,['falling','fluids','fire']);
 // shared cap: 700 fluid + 700 falling due at once leave 400 for the next tick
 const w2=world(),f2=new Fluids(w2),a2=new FallingBlocks(w2),t2=attachTickTree({fluids:f2,falling:a2});let ran=0;
 for(const s of [f2,a2]){s.run=()=>{ran++;return 0;};}
 for(let i=0;i<700;i++){f2.enqueue(i%30,60+Math.floor(i/30),1,WATER,1,0);a2.enqueue(i%30,100+Math.floor(i/30),1,SAND,1,0);}
 t2.tick({x:0,z:0});assert.equal(ran,1000);t2.tick({x:0,z:0});assert.equal(ran,1400);
});
test('creation ids survive a save: the lists save n only while one tree runs, an older save without n still loads',()=>{
 const w=world(),fl=new Fluids(w),fa=new FallingBlocks(w);
 assert.equal(fl.save().entries.some(e=>'n' in e),false);
 const tree=attachTickTree({fluids:fl,falling:fa});
 w.set(2,60,1,WATER,false);fa.enqueue(1,60,1,SAND,5,0);fl.enqueue(2,60,1,WATER,5,0);fa.enqueue(3,60,1,SAND,5,0);
 const sf=fl.save(),sa=fa.save();assert.deepEqual([sa.entries.map(e=>e.n),sf.entries.map(e=>e.n)],[[0,2],[1]]);
 const fl2=new Fluids(w),fa2=new FallingBlocks(w);fl2.load(JSON.parse(JSON.stringify(sf)));fa2.load(JSON.parse(JSON.stringify(sa)));
 attachTickTree({fluids:fl2,falling:fa2});
 const order=[...fa2.pending.values(),...fl2.pending.values()].sort((a,b)=>a.id-b.id).map(e=>e.x);assert.deepEqual(order,[1,2,3]);
 const old=new Fluids(w);old.load({version:1,time:0,entries:[{x:2,y:60,z:1,block:WATER,delay:3}]});assert.equal(old.pending.size,1);attachTickTree({fluids:old});assert.equal(old.save().entries[0].n,0);
});
test('a shared-tree tick leaves the standalone systems alone: fluids and fire tick exactly as before with no tree',()=>{
 const w=world(),fl=new Fluids(w);fl.enqueue(2,60,1,WATER,1,0);assert.equal(fl.save().entries[0].n,undefined);fl.tick();assert.equal(fl.pending.size,0);
});
import {createRedstoneRuntime} from './redstone-runtime.js';import {ForeignTicks} from './tile-ticks.js';
import {fromOriginal} from './block-registry.js';
// A repeater chain (lever, dust, repeater, lamp) run through the shared tree matches the same chain run through the runtime's own tick, tick for tick.
const build=(wired)=>{
 const world=new World('tt-rs','meadow'),O=[20,20,20];
 for(let x=-1;x<=8;x++)for(let y=-1;y<=3;y++)for(let z=-1;z<=3;z++)world.put(O[0]+x,O[1]+y,O[2]+z,0,0,false);
 const game={sound(){},drop(){},primeTnt(){},markUnsaved(){},player:()=>null,mobs:()=>null,items:()=>[],arrows:()=>[],orbs:()=>[],primed:()=>[]};
 const rt=createRedstoneRuntime({world,scene:{updateBlocks(){},setMovingBlocks(){}},game}),[x,y,z]=O;
 for(let i=0;i<8;i++)rt.redstone.setBlock(x+i,y,z+1,1,0,3);
 rt.redstone.setBlock(x,y+1,z+1,69,5,3);rt.redstone.setBlock(x+1,y+1,z+1,55,0,3);rt.redstone.setBlock(x+2,y+1,z+1,93,1,3);rt.redstone.setBlock(x+3,y+1,z+1,55,0,3);rt.redstone.setBlock(x+4,y+1,z+1,123,0,3);
 rt.flush();rt.use(x,y+1,z+1);
 const fl=new Fluids(world),tree=wired?attachTickTree({fluids:fl,redstone:rt}):null;
 const snap=()=>{const o=[];for(let i=0;i<8;i++)o.push(world.get(x+i,y+1,z+1));return o.join();};
 return {rt,tree,snap,step:()=>wired?tree.tick({x:0,z:0}):rt.tick()};
};
test('redstone runs inside the shared tree: a lever, repeater and lamp line changes tick for tick as with the runtime tick',()=>{
 const a=build(false),b=build(true),seen=[];
 for(let i=0;i<12;i++){a.step();b.step();seen.push(a.snap());assert.equal(b.snap(),a.snap(),`tick ${i+1}`);}
 assert.ok(new Set(seen).size>1,'the line changed');
});
test('foreign ticks join the tree: a due foreign fluid entry runs in creation order with the live lists, and is taken once',()=>{
 const w=world(),fl=new Fluids(w),ran=[];w.set(3,60,1,WATER,false);
 const env={version:1,time:0,entries:[{i:8,x:3,y:60,z:1,t:2,p:0},{i:54,x:2,y:60,z:1,t:2,p:0}]};
 const ft=new ForeignTicks(env,(x,y,z)=>w.get(x,y,z),{fluid:(x,y,z)=>ran.push(['foreign',x])});let now=0;
 const tree=attachTickTree({fluids:fl,foreign:ft,now:()=>now});
 const r=fl.run.bind(fl);fl.run=(e)=>{ran.push(['live',e.x]);return r(e)};
 w.set(5,60,1,WATER,false);fl.enqueue(5,60,1,WATER,2,0);
 for(now=1;now<=3;now++)tree.tick({x:0,z:0});
 assert.deepEqual(ran,[['foreign',3],['live',5]]);assert.equal(env.entries.length,0);
});
import {tileTickRows} from './tile-ticks.js';
test('tileTickRows orders equal time and priority across kinds by the saved creation id n, and by list order without it',()=>{
 const f={x:1,y:60,z:1,block:WATER,delay:3,n:5},a={x:2,y:60,z:1,block:SAND,delay:3,n:2};
 const rows=tileTickRows({fluidTicks:[{order:0,value:f}],fallingTicks:[{order:0,value:a}]});assert.deepEqual(rows.map(r=>r.x),[2,1]);
 const old=tileTickRows({fluidTicks:[{order:0,value:{...f,n:undefined}}],fallingTicks:[{order:0,value:{...a,n:undefined}}]});assert.deepEqual(old.map(r=>r.x),[1,2]);
});
test('redstone pending ticks save the shared creation id n while a tree runs: reload and export keep cross-kind order; an older save without n loads',()=>{
 const a=build(true),live=a.rt.redstone;
 const fl=a.tree.sources.find(s=>s.name==='fluids').sys;
 // redstone asks first (id 0), a fluid second (id 1), redstone third (id 2), all due at the same time and priority
 live.scheduleBlockUpdate(30,30,30,55,5,0);fl.world.set(2,60,1,WATER,false);fl.enqueue(2,60,1,WATER,5,0);live.scheduleBlockUpdate(31,30,30,55,5,0);
 const saved=JSON.parse(JSON.stringify(live.save())),mine=saved.pending.filter(t=>t[0]>=30&&t[1]===30);
 assert.deepEqual(mine.map(t=>[t[6],t[7]]),[[mine[0][6],mine[0][6]],[mine[1][6],mine[1][6]]]);
 const fe=fl.save().entries.find(e=>e.x===2&&e.y===60);assert.ok(mine[0][7]<fe.n&&fe.n<mine[1][7]);
 const rows=tileTickRows({redstoneTicks:mine.map((t,i)=>({order:i,value:{x:t[0],y:t[1],z:t[2],id:t[3],delay:5,priority:0,n:t[7]}})),fluidTicks:[{order:0,value:{...fe,delay:5}}]});
 assert.deepEqual(rows.map(r=>r.x),[30,2,31]);
 const b=build(false);assert.equal(b.rt.redstone.save().pending.every(t=>t.length===7),true);
 const legacy=JSON.parse(JSON.stringify(saved));legacy.pending=legacy.pending.map(t=>t.slice(0,7));
 const c=build(false);assert.equal(c.rt.redstone.restore(legacy),true);assert.equal(c.rt.redstone.pending.size,legacy.pending.length);
 const d=build(false);d.rt.redstone.restore(JSON.parse(JSON.stringify(saved)));assert.equal([...d.rt.redstone.pending.values()].find(e=>e.x===30)?.n,mine[0][7]);
});
test('fire edits reach the redstone engine inside the run (world.set is the funnel), fluid edits (world.put) reach it per run through observers.step and batched without it',()=>{
 // Fire: the first run burns a wool support, the second run in the same tick already finds the dust above it gone, with no observer at all.
 const a=build(true),rt=a.rt,w=rt.redstone.world,fl=a.tree.sources.find(s=>s.name==='fluids').sys;
 const fi=new Fire(w,{weather:()=>({})}),tree=attachTickTree({fluids:fl,fire:fi,redstone:rt});
 rt.redstone.setBlock(24,20,23,35,0,3);rt.redstone.setBlock(24,21,23,55,0,3);rt.flush();assert.notEqual(w.get(24,21,23),0);
 for(const x of [22,23])w.put(x,22,22,51,0,false);
 const seen=[];let n=0;fi.run=()=>{n++;if(n===1)fi.L.setAir(24,20,23);else seen.push(w.get(24,21,23));};
 for(const x of [22,23])fi.schedule(x,22,22,1,0);
 tree.tick({x:0,z:0});assert.deepEqual([n,seen],[2,[0]]);
 // Fluids: two water ticks in a row; the engine hears about each change before the next run with `step`, only after both runs without it.
 const order=(withStep)=>{
  const b=build(true),r=b.rt,wb=r.redstone.world,f=b.tree.sources.find(s=>s.name==='fluids').sys,log=[];
  const ext=r.redstone.external.bind(r.redstone);r.redstone.external=(x,y,z,o)=>{log.push('external');ext(x,y,z,o);};
  const run=f.run.bind(f);f.run=(e)=>{log.push('run');return run(e)};
  for(const x of [22,25]){wb.put(x,22,22,WATER,0,false);f.enqueue(x,22,22,WATER,1,0);}
  b.tree.tick({x:0,z:0},withStep?{step:(name,c)=>r.fluidChanges(c),fluids:(c)=>r.fluidChanges(c)}:{fluids:(c)=>r.fluidChanges(c)});
  return log.join();
 };
 const per=order(true),batch=order(false);
 assert.match(per,/^run,external(,external)*,run,external/);assert.match(batch,/^run,run,external/);
});
test('TickTree replays the unchanged tickUpdates on consecutive world times: a backlog above 1000 spills from call to call in native order (2 sequence scenarios, 6 calls each)',()=>{
 const seqs=reference.cases.filter(k=>k.kind==='sequence');assert.equal(seqs.length,2);
 for(const c of seqs){
  const kinds={8:'fluid',12:'falling',51:'fire',93:'redstone'},lists={fluid:[],fire:[],falling:[],redstone:[]};let now=0;
  c.before.forEach((a,id)=>lists[kinds[a[0]]].push({a,t:a[4],p:a[5],id}));
  for(const l of Object.values(lists))l.sort((x,y)=>x.t-y.t||x.p-y.p||x.id-y.id);
  const src=(n,l)=>({name:n,begin(){},head:()=>l[0],delay:(e)=>e.t-now,p:(e)=>e.p,id:(e)=>e.id,take:()=>l.shift(),run(){}});
  const tree=new TickTree().attach(Object.entries(lists).map(([n,l])=>src(n,l)));
  let capped=0;
  c.calls.forEach((call,i)=>{
   now=call.time-c.time;const taken=tree.tick();
   const left=Object.values(lists).flat().sort((x,y)=>x.t-y.t||x.p-y.p||x.id-y.id).map(e=>[e.a[0],e.a[1],e.a[2],e.a[3],e.a[4]-now,e.a[5]]); // the probe dumps delays from the call's own time
   assert.deepEqual(left,call.remaining,`sequence ${c.index} call ${i}`);assert.ok(taken<=TICK_UPDATES_CAP);
   if(taken===TICK_UPDATES_CAP)capped++;
  });
  assert.ok(capped>=2,'the cap spilled at least twice');
 }
});
