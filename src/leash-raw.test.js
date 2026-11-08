import test from 'node:test';import assert from 'node:assert/strict';
import {NBT} from './nbt.js';
import {gearNbtFields,leashRawTag} from './java-mobs.js';
import {gearFieldsFrom} from './horse-gear-live.js';
const tag=(type,value)=>({type,value});
test('an unusable Leash tag survives import, restore sanitising and the export decode unchanged',()=>{
  const leash=tag(NBT.COMPOUND,new Map([['UUIDMost',tag(NBT.LONG,5n)],['X',tag(NBT.STRING,'7')],['Y',tag(NBT.INT,64)]]));
  const mob=new Map([['Leashed',tag(NBT.BYTE,1)],['Leash',leash]]);
  const f=gearNbtFields(mob);
  assert.equal(f.leash.lost,true);
  const kept=gearFieldsFrom({leash:JSON.parse(JSON.stringify(f.leash))});
  assert.equal(kept.leash.lost,true);
  assert.deepEqual(leashRawTag(kept.leash.raw),leash);
});
test('a Leashed mob with no Leash tag has no raw tag to write back',()=>{
  const f=gearNbtFields(new Map([['Leashed',tag(NBT.BYTE,1)]]));
  assert.deepEqual(f.leash,{lost:true});
  assert.equal(leashRawTag(f.leash.raw),null);
});
