import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Minecarts } from './minecarts.js';
import { solidBlock, RAIL, WATER } from './world.js';
const ref = JSON.parse(await readFile(process.env.MC_VEHICLE_REFERENCE || new URL('../public/research/vehicle-reference.json', import.meta.url)));
const num = x => x === '-0' ? -0 : x;
function world(c) {
  const map = new Map(c.cells.map(([x,y,z,id,m=0])=>[`${x},${y},${z}`,[{1:3,66:RAIL,9:WATER}[id]??0,m]]));
  const cell=(x,y,z)=>map.get(`${x},${y},${z}`)??[y<0&&!c.void?3:0,0];
  return {get:(x,y,z)=>cell(x,y,z)[0],getMeta:(x,y,z)=>cell(x,y,z)[1],solid:(x,y,z)=>solidBlock(...cell(x,y,z))};
}
function cartState(m,w,c) {
  const xyz=p=>p?[p.x,p.y,p.z]:null;
  return [c.x,c.posY,c.z,c.vx,c.vy,c.vz,c.onGround,c.yaw,c.pitch,c.dead,c.damage,c.rolling,c.rollingDir,c.inWeb,c.bb[1],c.fire,
    xyz(m.railPos(w,c.x,c.posY,c.z)),xyz(m.railPosAhead(w,c.x,c.posY,c.z,Math.fround(.3))),xyz(m.railPosAhead(w,c.x,c.posY,c.z,-Math.fround(.3)))];
}
const normalize=x=>Array.isArray(x)?x.map(normalize):num(x);
const nativeCart=s=>normalize(s).map((v,i)=>[7,8,10].includes(i)?Math.fround(v):v);
const ps=p=>[p.x,p.y,p.z,p.yaw,!!p.vehicle,p.fallen];
for (const c of ref.cases.filter(c=>c.kind==='travel')) test(`native empty cart: ${c.name}`,()=>{
  const w=world(c), m=new Minecarts(), [x,y,z,vx,vz]=c.spawn;
  const a=m.spawnEmpty({x,y,z}); Object.assign(a,{vx,vz});
  const b=c.two?m.spawnEmpty({x:4.5,y:.5,z:.5}):null;
  const p={x:.5,y:.2,z:.5,yaw:c.yaw,moveForward:c.forward,fallen:0,fall(n){this.fallen=n;}};
  if(c.ridden) assert.equal(m.mount(a,p),c.mounted);
  for(const [t, [as,expected,bs]] of c.ticks.entries()) {
    m.tick(w);
    if(p.vehicle&&!p.vehicle.dead)m.updateRiderPosition(a);
    assert.deepEqual(cartState(m,w,a),nativeCart(as),`${c.name} tick ${t}`);
    assert.deepEqual(ps(p),normalize(expected),`${c.name} rider ${t}`);
    if(b)assert.deepEqual(cartState(m,w,b),nativeCart(bs),`${c.name} second ${t}`);
  }
  assert.deepEqual(ps(p),normalize(c.beforeDismount));
  if(p.vehicle)m.dismount(w,p);
  assert.deepEqual(ps(p),normalize(c.dismount));
});
test('native empty mount offset, occupied cart and break drops',()=>{
 const c=ref.cases.find(c=>c.kind==='mount'),m=new Minecarts(),a=m.spawnEmpty({x:.5,y:.5,z:.5}),p={yaw:0,fallen:0},q={};
 assert.equal(m.mount(a,p),c.first); assert.equal(m.mount(a,q),false); assert.equal(!!q.vehicle,c.secondMounted);
 assert.equal(a.rider===p,c.firstRider);
 const other=state();other.minecarts=m;other.rider=q;
 assert.equal(dispatchVehicleAction(other,captureVehicleAction({cartId:a.id})).handled,c.occupied);
 assert.equal(m.getMountedYOffset(),c.offset); assert.deepEqual(ps(p),c.position);
 for(const c of ref.cases.filter(c=>c.kind==='break')){
  const a=m.spawnEmpty({x:1.5,y:.5,z:.5});m.attack(a,5,{creative:c.creative});assert.equal(a.dead,c.dead);
  const drops=m.drain();assert.equal(drops.length,c.drops.length);
  for(const [i,d] of drops.entries()) assert.deepEqual([d.stack.id,d.stack.count,d.stack.damage,d.x,d.posY,d.z,d.delay],[366,...c.drops[i].slice(1,6),c.drops[i][9]]);
 }
});

import { Survival, ITEMS, craftingResult } from './survival.js';
import { PlayerMotion } from './player-movement.js';
import { createPlayerRider, captureVehicleAction, dispatchVehicleAction, placeHeldMinecart, moveRidingPlayer, finishVehicleTick, restorePlayerVehicle } from './vehicle-simulation.js';
import { capturePlayerAction, dispatchPlayerAction } from './player-actions.js';
function state(w=world({cells:[[0,0,0,66,1]]})) {
 const s={world:w,minecarts:new Minecarts(),survival:new Survival({},'survival'),rider:createPlayerRider(),position:{x:.5,y:1,z:.5},previous:{},velocity:{x:0,y:0,z:0},motion:new PlayerMotion(),yaw:0,screen:'playing'};
 s.survival.protection=0;
 return s;
}
for(const c of ref.cases.filter(c=>c.kind==='placement'))test(`native cart item: ${c.type}/${c.block}/${c.meta}`,()=>{
 const s=state();s.minecarts=new Minecarts({rails:{66:'rail',27:'golden',28:'detector',157:'activator'}});
 s.world={get:()=>c.block,getMeta:()=>c.meta};
 s.survival.inventory.main[0]={id:c.type===0?366:450,count:2,damage:0};
 const result=placeHeldMinecart(s,{target:{block:[2,3,4]}});
 assert.equal(result.branch==='place-minecart',c.ok);assert.equal(s.survival.held.count,c.count);
 const a=s.minecarts.carts[0];assert.deepEqual(a?[a.x,a.posY,a.z,a.type]:null,c.cart);
});
test('SIM-01 placement/mount/dismount actions use current state and survive JSON',()=>{
 const s=state();s.survival.inventory.main[0]={id:366,count:1,damage:0};
 const action=JSON.parse(JSON.stringify(capturePlayerAction({place:true,heldTool:366,target:{block:[0,0,0],adjacent:[0,1,0]}})));
 assert.equal(dispatchPlayerAction(s,action).branch,'place-minecart');assert.equal(s.survival.held,null);
 const c=s.minecarts.carts[0],mount=JSON.parse(JSON.stringify(captureVehicleAction({cartId:c.id})));
 assert.equal(dispatchVehicleAction(s,mount).branch,'mount-minecart');assert.equal(s.rider.vehicle,c);
 assert.equal(dispatchVehicleAction(s,{...mount,cartId:999}).branch,'missing-cart');
 const trace=[];const old={...s.position};
 const movement=moveRidingPlayer(s,{forward:1,strafe:0,sneak:false,jump:true},{trace:a=>trace.push(a)});
 assert.equal(s.flying,false);assert.equal(s.fallDistance,0);assert.deepEqual(s.previous,old);assert.equal(movement.sneakOnGround,true);
 assert.equal(s.rider.moveForward,Math.fround(.98));
 moveRidingPlayer(s,{sneak:true},{trace:a=>trace.push(a)});
 assert.equal(s.rider.vehicle,null);assert.equal(c.rider,null);assert.equal(trace[0].dismount,true);
 assert.equal(dispatchVehicleAction(s,{...mount,sneak:true}).branch,'occupied-or-sneaking-minecart');
 assert.equal(c.rider,null);
});
test('Creative placement keeps stack; chest cart recipe/placement/container never mounts',()=>{
 const s=state();s.survival.mode='creative';s.survival.inventory.main[0]={id:450,count:1,damage:0};
 assert.equal(ITEMS[450].stack,1);assert.equal(craftingResult([{id:41,count:1,damage:0},null,{id:366,count:1,damage:0},null],2).id,450);
 placeHeldMinecart(s,{target:{block:[0,0,0]}});assert.equal(s.survival.held.count,1);
 let container;dispatchVehicleAction(s,captureVehicleAction({cartId:1,heldTool:450}),{openContainer:c=>container=c});
 assert.equal(container.rows,3);assert.equal(s.rider.vehicle,null);
});
test('rider fall damage, environmental death, break and legacy/occupied saves',()=>{
 const s=state(world({cells:[]})),c=s.minecarts.spawnEmpty({x:.5,y:8.5,z:.5});
 dispatchVehicleAction(s,captureVehicleAction({cartId:c.id}));
 for(let t=0;t<35;t++){moveRidingPlayer(s,{forward:0});s.minecarts.tick(s.world);finishVehicleTick(s);}
 assert.equal(s.survival.health,15);assert.equal(s.rider.fallDistance,0);
 const json=JSON.parse(JSON.stringify(s.minecarts.toJSON()));
 assert.equal(json.carts[0].type,0);assert.equal(json.carts[0].rider,true);
 const back=state(s.world);back.minecarts=Minecarts.fromJSON(json);restorePlayerVehicle(back);
 assert.equal(back.rider.vehicle.type,0);assert.deepEqual(back.position,s.position);
 back.survival.health=0;finishVehicleTick(back);assert.equal(back.rider.vehicle,null);assert.equal(back.minecarts.carts[0].rider,null);
 const old=Minecarts.fromJSON({version:1,carts:[{x:.5,y:.5,z:.5}]});assert.equal(old.carts[0].type,1);
 s.minecarts.attack(c,5);finishVehicleTick(s);assert.equal(s.rider.vehicle,null);
});
test('finite viewport stops ridden carts at the edge and dismounts inside it',()=>{
 const w=world({cells:[]});w.inside=()=>true;
 const s=state(w),c=s.minecarts.spawnEmpty({x:127.4,y:2.5,z:.5});c.vx=.4;
 dispatchVehicleAction(s,captureVehicleAction({cartId:c.id}));
 for(let t=0;t<5;t++){moveRidingPlayer(s,{forward:0});s.minecarts.tick(w);finishVehicleTick(s);}
 assert.equal(c.x,128-Math.fround(Math.fround(.98)/2));assert.equal(c.vx,0);assert.equal(s.position.x,c.x);
 dispatchVehicleAction(s,captureVehicleAction({dismount:true}));assert.ok(s.position.x<=127.69);assert.ok(s.position.z>=.31);
});
test('F5 biped riding pose bends and spreads both legs while retaining held-item arm use',async()=>{
 const {bipedPose}=await import('./player-renderer.js');
 const sitting=bipedPose({riding:true,swing:-10000,heldRight:1});
 assert.equal(sitting.rightLeg.rot[0],-Math.fround(Math.fround(Math.PI)*Math.fround(2/5)));
 assert.equal(sitting.leftLeg.rot[0],sitting.rightLeg.rot[0]);
 assert.equal(sitting.rightLeg.rot[1],-sitting.leftLeg.rot[1]);assert.ok(sitting.rightArm.rot[0]<0);
});

import { importedRuntime } from './world-import.js';
import { tickMinecartSimulation, pickMinecart } from './structure-simulation.js';
test('browser export/import retains one valid empty rider, ignores chest markers and malformed motion',()=>{
 const payload=importedRuntime({minecarts:{version:1,carts:[
 {x:1,y:2,z:3,type:1,rider:true},{x:4,y:5,z:6,type:0,rider:true,motion:[1],rotation:[]},
 {x:7,y:8,z:9,type:0,rider:true},{x:NaN,y:1,z:1,type:0,rider:true}]}});
 assert.equal(payload.minecarts.carts.length,3);assert.equal(payload.minecarts.carts[0].rider,undefined);
 const s=state();s.minecarts=Minecarts.fromJSON(JSON.parse(JSON.stringify(payload.minecarts)));restorePlayerVehicle(s);
 assert.equal(s.rider.vehicle,s.minecarts.carts[1]);assert.equal(s.minecarts.carts[2].rider,null);
 assert.deepEqual([s.rider.vehicle.vx,s.rider.vehicle.vy,s.rider.vehicle.vz],[0,0,0]);
 const raw=Minecarts.fromJSON({carts:[{x:1,y:2,z:3,type:0,motion:[1],rotation:[]}]});assert.equal(raw.carts[0].vx,0);assert.equal(raw.carts[0].yaw,0);
});
test('live cart tick excludes its rider while walking player pushes retain current coordinates; picking skips own cart',()=>{
 const s=state(),c=s.minecarts.spawnEmpty({x:.5,y:.5,z:.5});
 dispatchVehicleAction(s,captureVehicleAction({cartId:c.id}));
 moveRidingPlayer(s,{forward:1});tickMinecartSimulation({...s,width:.6,height:1.8});finishVehicleTick(s);
 assert.equal(s.position.x,c.x);assert.equal(s.velocity.x,0);assert.equal(s.velocity.z,0);
 assert.equal(pickMinecart(s.minecarts,{x:.5,y:1,z:.5},{x:0,y:-1,z:0},3,3,c),null);
 dispatchVehicleAction(s,captureVehicleAction({dismount:true}));Object.assign(s.position,{x:c.x+.6,y:0,z:c.z+.2});
 const before=c.vx;tickMinecartSimulation({...s,width:.6,height:1.8});assert.notEqual(c.vx,before);
});
test('vehicle capture rejects non-JSON IDs and paused/dead item actions cannot place',()=>{
 assert.throws(()=>captureVehicleAction({cartId:1n}),TypeError);
 assert.throws(()=>captureVehicleAction({heldTool:NaN}),TypeError);
 const s=state();s.survival.inventory.main[0]={id:366,count:1,damage:0};
 const action=capturePlayerAction({place:true,heldTool:366,target:{block:[0,0,0]}});
 s.screen='paused';assert.equal(dispatchPlayerAction(s,action).skipped,true);assert.equal(s.minecarts.carts.length,0);
 s.screen='playing';s.survival.health=0;assert.equal(dispatchPlayerAction(s,action).skipped,true);assert.equal(s.survival.held.count,1);
});
test('ridden body keeps free yaw and clears walking limb swing despite cart travel',async()=>{
 const {PlayerBody}=await import('./player-renderer.js');const body=new PlayerBody();
 body.limbSwingAmount=.8;
 body.tick({previous:{x:1,y:1,z:1},position:{x:1.4,y:1,z:1},yaw:0,pitch:0,riding:true});
 assert.equal(body.limbSwingAmount,0);assert.equal(body.rotationYaw,180);assert.equal(body.renderYawOffset,180);
});
