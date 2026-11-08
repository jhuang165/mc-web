import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {NBT} from './nbt.js';
import {horseNbtFields} from './java-mobs.js';
import {itemStackFromNbt} from './region-import.js';
import {cleanItems} from './horse-gear.js';
import {originalOfLive} from './item-names.js';
// public/research/horse-items-nbt-reference.json: the unchanged EntityHorse.readEntityFromNBT / writeEntityToNBT (tools/probes/HorseItemsProbe.java).
const reference=JSON.parse(readFileSync(new URL('../public/research/horse-items-nbt-reference.json',import.meta.url)));
const t=(type,value)=>({type,value});
test('saved horse Items load into the chest like the unchanged AnimalChest: any count kept, above 64 lowered, unknown ids clear, slots 2..16',()=>{
 let compared=0;
 for(const c of reference.cases){
  const stacks=c.items.map(([slot,id,count,damage])=>new Map([['Slot',t(NBT.BYTE,slot)],['id',t(NBT.SHORT,id)],['Count',t(NBT.BYTE,count)],['Damage',t(NBT.SHORT,damage)]]));
  const tag=new Map([['ChestedHorse',t(NBT.BYTE,c.chested?1:0)],['Type',t(NBT.INT,c.type)],['Items',t(NBT.LIST,{elementType:NBT.COMPOUND,items:stacks})]]);
  const {horse}=horseNbtFields(tag,itemStackFromNbt);
  const items=c.chested&&c.size===17?cleanItems(horse.items)??Array(17).fill(null):[];
  // The port keeps chests only where the type can carry one (horse-live.js); the probe's native size says whether a chest exists.
  const native=c.chest.map((s)=>s&&[s.id,s.count,s.damage]);
  const ours=Array.from({length:c.size},(_,i)=>items[i]?[originalOfLive(items[i].id)?.id,items[i].count,items[i].damage]:null);
  if(c.size===17){assert.deepEqual(ours,native,c.name);compared++;}
  else assert.equal(ours.filter(Boolean).length,0,c.name);
  // writeEntityToNBT lists the non-empty stacks of slots 2..16 in order, counts as held.
  const saved=ours.flatMap((s,i)=>s&&i>=2?[[i,...s]]:[]);
  assert.deepEqual(saved,c.saved.map(([slot,id,count,damage])=>[slot,id,count,damage]),c.name);
 }
 assert.equal(compared,2);
});
test('cleanItems keeps zero and negative counts and lowers a count above the stack limit',()=>{
 assert.deepEqual(cleanItems([{id:1,count:0,damage:0},{id:1,count:-3,damage:-1},{id:1,count:100,damage:2},{id:1.5,count:1},null]),[{id:1,count:0,damage:0},{id:1,count:-3,damage:0},{id:1,count:64,damage:2},null,null]);
});
