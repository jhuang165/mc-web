// Generation records enter live state once. Saved empty inventories/entities are authoritative.
import {hasSavedStructures} from './structure-simulation.js';
import {newChest,CHEST} from './chest.js';
import {itemFromOriginal} from './region-import.js';
import {makeStack} from './inventory.js';
import {ENTITY_TYPES} from './entities.js';
const ANIMALS={Pig:'pig',Cow:'cow',Sheep:'sheep',Chicken:'chicken'};
export function restorePopulation(record,world,survival,mobs){
  const g=world.generatedStructures;
  if(world.generationVersion<11||!g||hasSavedStructures(record))return {fresh:false,animals:0,chests:0,unsupported:[]};
  let animals=0,chests=0;const unsupported=[];
  for(const c of g.chests??[]){
    if(world.get(c.x,c.y,c.z)!==CHEST)continue;
    const key=`${c.x},${c.y},${c.z}`;
    // Existing tile state is never overwritten, including an explicitly empty inventory.
    if(survival.chests[key])continue;
    const tile=newChest(c.facing);
    for(const s of c.items){const m=itemFromOriginal(s.id,s.damage);if(!m)throw new Error(`Unmapped dungeon loot ${s.id}:${s.damage}`);
      tile.items[s.slot]=makeStack(m.id,s.count,m.damage,s.stored);}
    survival.chests[key]=tile;chests++;
  }
  for(const a of g.animals??[]){
    const type=ANIMALS[a.name];if(!type||!ENTITY_TYPES[type]){unsupported.push(a.name);continue;}
    const e=mobs.create(type,a.x,a.y,a.z);e.yaw=Math.fround(a.yaw*Math.PI/180);
    if(type==='sheep')e.color=a.fleece;
    mobs.entities.push(e);animals++;
  }
  return {fresh:true,animals,chests,unsupported};
}
