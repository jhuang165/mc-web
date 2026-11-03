import {isCrop,WEB,SAPLING,REEDS,FENCE,RAIL,MOB_SPAWNER,ANVIL} from './world.js';
// Minecraft Java 1.7.10 ItemTool/ItemSword/ItemShears, Block and
// PlayerControllerMP rules. Round each operation at Java float boundaries.
const f = Math.fround;
export function digSpeed(block,tool){
 if(!tool?.kind)return 1;
 if([63,64,65,66,74,82,ANVIL].includes(block)&&tool.kind==='pickaxe')return tool.speed;
 if([67,70,77,78,81].includes(block)&&tool.kind==='axe')return tool.speed;
 if([71,72].includes(block)&&tool.kind==='shears')return block===71?15:2;
 if(tool.kind==='shears')return block===5||block===WEB?15:block===19?5:1;
 // Material.plants (crops, saplings, sugar cane) is an axe material and a 1.5 sword material.
 if(tool.kind==='axe'&&(isCrop(block)||block===SAPLING||block===REEDS))return tool.speed;
 if(tool.kind==='sword')return block===WEB?15:block===5||isCrop(block)||block===39||block===SAPLING||block===REEDS?1.5:1;
 const effective={shovel:[1,2,6,23,24,25,29,30,46,57],axe:[4,7,13,21,39,FENCE,...Array.from({length:8},(_,i)=>31+i)],pickaxe:[3,8,12,14,15,16,17,18,22,26,27,28,40,47,56,58,RAIL,MOB_SPAWNER,ANVIL]};
 // The fence is Material.wood (ItemAxe), the spawner Material.rock (ItemPickaxe) and the rail is
 // in ItemPickaxe's own block set (Material.circuits).
 return effective[tool.kind]?.includes(block)?tool.speed:1;
}
export function canHarvest(block,material,tool){
 if(block===WEB)return tool?.kind==='sword'||tool?.kind==='shears';
 if(block===23||block===46)return tool?.kind==='shovel';
 return material.tier===undefined||tool?.kind==='pickaxe'&&tool.tier>=material.tier;
}
export function miningState(block,material={},tool=null,{underwater=false,onGround=true,efficiency=0,haste=-1,fatigue=-1,aquaAffinity=false}={}){
 const harvest=canHarvest(block,material,tool),hardness=f(material.hardness??1);
 if(!Number.isFinite(hardness)||hardness<0)return{progress:0,harvest:false,speed:0,hardness};
 let speed=f(digSpeed(block,tool));
 if(speed>1&&efficiency>0)speed=f(speed+efficiency*efficiency+1);
 if(haste>=0)speed=f(speed*f(1+f((haste+1)*f(.2))));
 // 1.7.10 fatigue is linear; the later exponential slowdown is different.
 if(fatigue>=0)speed=f(speed*f(1-f((fatigue+1)*f(.2))));
 if(underwater&&!aquaAffinity)speed=f(speed/5);
 if(!onGround)speed=f(speed/5);
 return{harvest,speed,hardness,progress:hardness===0?Infinity:f(f(speed/hardness)/(harvest?30:100))};
}
export function breakTicks(state){if(state.progress>=1)return 0;if(!(state.progress>0))return Infinity;let damage=0,ticks=0;while(damage<1&&ticks<10000000){damage=f(damage+state.progress);ticks++;}return damage>=1?ticks:Infinity;}
export function blockWear(block,material,tool){
 if(!tool?.kind)return 0;
 if(tool.kind==='shears')return block===5||block===39||block===WEB?1:0;
 if(tool.kind==='hoe'||material.hardness===0)return 0;
 return tool.kind==='sword'?2:1;
}
