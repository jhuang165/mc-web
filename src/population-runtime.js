// Generation records enter live state once. Saved empty inventories/entities are authoritative.
import {hasSavedStructures} from './structure-simulation.js';
import {newChest,CHEST} from './chest.js';
import {itemFromOriginal} from './region-import.js';
import {makeStack} from './inventory.js';
import {ENTITY_TYPES} from './entities.js';
import {villagerFields} from './villager.js';
import {DISPENSER} from './dispenser-piston.js';
import {newDispenser} from './dispenser-container.js';
import {FLOWER_POT,setPotContents,potPlantOf} from './stone-utility.js';
const ANIMALS={Pig:'pig',Cow:'cow',MushroomCow:'mooshroom',Sheep:'sheep',Chicken:'chicken',Wolf:'wolf',EntityHorse:'horse'};
// Dungeon chests whose block is still a chest; an existing tile (even an emptied one) is never overwritten.
function restoreChests(list,world,survival){
  let chests=0;
  for(const c of list??[]){
    if(world.get(c.x,c.y,c.z)!==CHEST)continue;
    const key=`${c.x},${c.y},${c.z}`;
    if(survival.chests[key])continue;
    const tile=newChest(c.facing);
    for(const s of c.items){const m=itemFromOriginal(s.id,s.damage);if(!m)throw new Error(`Unmapped dungeon loot ${s.id}:${s.damage}`);
      tile.items[s.slot]=makeStack(m.id,s.count,m.damage,s.stored);}
    survival.chests[key]=tile;chests++;
  }
  return chests;
}
// Jungle-temple trap dispensers (nine slots): same once-only rule as chests, an existing container is never overwritten.
function restoreDispensers(list,world,survival){
  let n=0;
  for(const c of list??[]){
    if(world.get(c.x,c.y,c.z)!==DISPENSER)continue;
    const key=`${c.x},${c.y},${c.z}`;
    survival.dispensers??={};
    if(survival.dispensers[key])continue;
    const tile=newDispenser();
    for(const s of c.items){const m=itemFromOriginal(s.id,s.damage);if(!m)throw new Error(`Unmapped dispenser loot ${s.id}:${s.damage}`);
      tile.items[s.slot]=makeStack(m.id,s.count,m.damage,s.stored);}
    survival.dispensers[key]=tile;n++;
  }
  return n;
}
// Swamp-hut flower pots: the plant BlockFlowerPot's tile entity holds, unless a pot record already exists.
function restorePots(list,world){
  let n=0;
  for(const p of list??[]){
    if(world.get(p.x,p.y,p.z)!==FLOWER_POT||world.pots?.has(`${p.x},${p.y},${p.z}`)||!potPlantOf(p.id,p.damage))continue;
    setPotContents(world,p.x,p.y,p.z,p);n++;
  }
  return n;
}
function restoreAnimals(list,mobs,unsupported){
  let animals=0;
  for(const a of list??[]){
    // Village records are {type:'Villager',x,y,z,profession}; animals are {name,...,yaw,fleece} (yaw 0 for a villager, as spawned).
    if(a.type==='Villager'&&ENTITY_TYPES.villager){const e=mobs.create('villager',a.x,a.y,a.z);Object.assign(e,villagerFields(a.profession,0));mobs.entities.push(e);animals++;continue;}
    // Swamp-hut records are {type:'Witch',x,y,z} (scattered-feature-generator.js); EntityWitch spawns with the defaults.
    if(a.type==='Witch'&&ENTITY_TYPES.witch){mobs.entities.push(mobs.create('witch',a.x,a.y,a.z));animals++;continue;}
    const type=ANIMALS[a.name];if(!type||!ENTITY_TYPES[type]){unsupported.push(a.name??a.type);continue;}
    const e=mobs.create(type,a.x,a.y,a.z);e.yaw=Math.fround(a.yaw*Math.PI/180);
    if(type==='sheep')e.color=a.fleece;
    mobs.entities.push(e);animals++;
  }
  return animals;
}
export function restorePopulation(record,world,survival,mobs){
  const g=world.generatedStructures;
  if(world.generationVersion<11||!g||hasSavedStructures(record))return {fresh:false,animals:0,chests:0,unsupported:[]};
  const unsupported=[];
  const chests=restoreChests(g.chests,world,survival),animals=restoreAnimals(g.animals,mobs,unsupported);
  const dispensers=restoreDispensers(g.dispensers,world,survival),pots=restorePots(g.pots,world);
  return {fresh:true,animals,chests,dispensers,pots,unsupported};
}
// Streamed worlds (version 13): `columns` is World.claimFreshColumns(), each column handed over once.
// Spawners, chest minecarts and generation-time liquid ticks go to the runtimes the caller passes.
export const LIQUIDS=new Set([8,9,10,11]);
export function restorePopulationColumns(columns,{world,survival,mobs,spawners,minecarts,fluids}){
  const total={columns:columns.length,animals:0,chests:0,dispensers:0,pots:0,spawners:0,carts:0,ticks:0,unsupported:[]};
  for(const {records:r} of columns){
    total.chests+=restoreChests(r.chests,world,survival);
    total.animals+=restoreAnimals(r.animals,mobs,total.unsupported);
    total.dispensers+=restoreDispensers(r.dispensers,world,survival);total.pots+=restorePots(r.pots,world);
    for(const s of r.spawners){spawners.add(s);total.spawners++;}
    for(const c of r.minecartChests){minecarts.spawnChest(c);total.carts++;}
    for(const t of r.pendingTicks)if(LIQUIDS.has(t.id)){fluids.schedule(t.x,t.y,t.z,t.delay);total.ticks++;}
  }
  return total;
}
