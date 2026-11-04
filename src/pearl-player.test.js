import test from 'node:test';
import assert from 'node:assert/strict';
import {impactPlayerPearl} from './pearl-player.js';
import {Survival} from './survival.js';
import {JavaRandom} from './java-random.js';
import {Projectiles} from './projectiles.js';
import {tickEntitySimulation} from './entity-simulation.js';
import {Fx} from './fx.js';

function fixture(mode='survival'){
 const survival=new Survival({},mode);survival.protection=0;
 return {world:{},position:{x:1,y:60,z:2},previous:{x:0,y:60,z:1},survival,
   rider:{vehicle:null},fallDistance:12,landedFall:8,velocity:{x:0.2,y:-0.4,z:0.1}};
}
const ball=(owner='player')=>({x:9,y:70,z:11,owner,random:new JavaRandom(4),dead:false});

test('live pearl impact teleports synchronously, resets interpolation/fall and applies real fall damage',()=>{
 const state=fixture(),pearl=ball(),order=[],velocity={...state.velocity};
 const damage=state.survival.damage.bind(state.survival);
 state.survival.damage=(...args)=>{assert.equal(state.fallDistance,0);assert.equal(state.landedFall,0);order.push('damage');return damage(...args);};
 const result=impactPlayerPearl(state,pearl,{id:'target'},{hit:()=>order.push('hit'),particle:()=>order.push('particle'),
   teleport:({from,to})=>{order.push('teleport');assert.deepEqual(from,{x:1,y:60,z:2});assert.deepEqual(to,{x:9,y:70,z:11});},markUnsaved:()=>order.push('save')});
 assert.equal(result.teleported,true);assert.equal(result.damaged,true);assert.equal(pearl.dead,true);
 assert.equal(state.survival.health,15);assert.equal(state.survival.lastDamage,'a fall');
 assert.deepEqual(state.position,{x:9,y:70,z:11});assert.deepEqual(state.previous,state.position);
 assert.deepEqual(state.velocity,velocity);
 assert.equal(order[0],'hit');assert.equal(order.filter(x=>x==='particle').length,32);
 assert.deepEqual(order.slice(33),['teleport','damage','save']);
});

test('live pearl dismounts before teleport and leaves hurt-window/Creative rules to Survival',()=>{
 const state=fixture();state.rider.vehicle={rider:state.rider};let dismounts=0;
 state.minecarts={dismount(world,rider){assert.equal(world,state.world);dismounts++;rider.vehicle.rider=null;rider.vehicle=null;}};
 assert.equal(impactPlayerPearl(state,ball(),null).teleported,true);assert.equal(dismounts,1);
 assert.deepEqual([state.rider.x,state.rider.y,state.rider.z],[9,70,11]);
 const creative=fixture('creative');assert.equal(impactPlayerPearl(creative,ball(),null).damaged,false);assert.equal(creative.survival.health,20);
 const hurt=fixture();hurt.survival.damage(4,'a fall');assert.equal(impactPlayerPearl(hurt,ball(),null).damaged,true);assert.equal(hurt.survival.health,15,'only the extra point is applied');
 const spawn=fixture();spawn.survival.protection=60;impactPlayerPearl(spawn,ball(),null);assert.equal(spawn.survival.health,20);
});

test('ownerless, disconnected and cross-world pearls still impact without teleporting the local player',()=>{
 for(const kind of ['ownerless','disconnected','cross-world']){
   const state=fixture();if(kind==='disconnected')state.connected=false;if(kind==='cross-world')state.playerWorld={};
   const pearl=ball(kind==='ownerless'?undefined:'player');if(kind==='ownerless')delete pearl.owner;
   const result=impactPlayerPearl(state,pearl,null);
   assert.equal(result.teleported,false,kind);assert.equal(pearl.dead,true,kind);
   assert.deepEqual(state.position,{x:1,y:60,z:2});assert.equal(state.fallDistance,12);assert.equal(state.survival.health,20);
 }
});

test('the live entity tick routes a real pearl collision through player damage and the portal pool before arrows',()=>{
 const state=fixture(),fx=new Fx({random:()=>0.5,entityRandom:()=>new JavaRandom(1)});
 state.world={get:(x,y,z)=>x===5&&y===11&&z===4?3:0,solid(x,y,z){return !!this.get(x,y,z);}};
 Object.assign(state.position,{x:5,y:10,z:6});
 const projectiles=new Projectiles(()=>0.5),pearl=projectiles.throwEnderPearl(state.position,0,0);
 const tick={...state,items:{tick(){},collect(){return[];}},primed:[],projectiles,mobs:null,
   arrows:{tick(){assert.equal(state.survival.health,15);assert.deepEqual(state.position,{x:pearl.x,y:pearl.y,z:pearl.z});},collect(){return false;}},width:0.6,height:1.8};
 tickEntitySimulation(tick,{projectilePearlImpact:({pearl,hit})=>impactPlayerPearl(state,pearl,hit,{
   particle:p=>fx.spawn('portal',p.x,p.y,p.z,p.mx,p.my,p.mz),
 })});
 assert.equal(projectiles.balls.length,0);assert.equal(fx.effects.layers[0].length,32);
 assert.equal(state.fallDistance,0);assert.equal(state.survival.health,15);
});
