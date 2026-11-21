import {impactEnderPearl} from './ender-pearl.js';

// A browser world has one local player. Saved pearls use its stable local token;
// an ownerless projectile still impacts, but cannot teleport a replacement owner.
export function impactPlayerPearl(state, pearl, hit, hooks = {}) {
 const {world,position,previous,survival,rider,minecarts}=state;
 const owner=pearl.owner==='player'?{
   kind:'playerMP',connected:state.connected!==false,world:state.playerWorld??world,
   riding:!pearl.ownerBody&&!!rider?.vehicle,
   // b92 credit92 (zm.a, nh.a(DDDFF)): a pearl thrown by a body since removed moves the new player through the open connection, but the fall reset and the 5 fall damage hit the old entity
   get fallDistance(){return pearl.ownerBody?0:state.fallDistance;},
   set fallDistance(value){if(pearl.ownerBody)return;state.fallDistance=value;state.landedFall=0;},
 }:null;
 const result=impactEnderPearl(pearl,{world,owner,hit},{
   hit:(target,source)=>hooks.hit?.(target,source),
   particle:p=>hooks.particle?.(p),
   dismount:()=>minecarts.dismount(world,rider),
   teleport:(_owner,x,y,z)=>{
     const from={x:position.x,y:position.y,z:position.z},to={x,y,z};
     Object.assign(position,to);if(previous)Object.assign(previous,to);
     if(rider)Object.assign(rider,to);
     hooks.teleport?.({from,to});
   },
   damage:(_owner,{amount,source})=>pearl.ownerBody?false:survival.damage(amount,'a fall',false,source),
 });
 if(result.teleported){if(!pearl.ownerBody){state.fallDistance=owner.fallDistance;state.landedFall=0;}hooks.markUnsaved?.();}
 return result;
}
