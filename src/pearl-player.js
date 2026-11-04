import {impactEnderPearl} from './ender-pearl.js';

// A browser world has one local player. Saved pearls use its stable local token;
// an ownerless projectile still impacts, but cannot teleport a replacement owner.
export function impactPlayerPearl(state, pearl, hit, hooks = {}) {
 const {world,position,previous,survival,rider,minecarts}=state;
 const owner=pearl.owner==='player'?{
   kind:'playerMP',connected:state.connected!==false,world:state.playerWorld??world,
   riding:!!rider?.vehicle,
   get fallDistance(){return state.fallDistance;},
   set fallDistance(value){state.fallDistance=value;state.landedFall=0;},
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
   damage:(_owner,{amount,source})=>survival.damage(amount,'a fall',false,source),
 });
 if(result.teleported){state.fallDistance=owner.fallDistance;state.landedFall=0;hooks.markUnsaved?.();}
 return result;
}
