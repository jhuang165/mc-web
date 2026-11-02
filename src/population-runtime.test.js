import test from 'node:test';import assert from 'node:assert/strict';
import {World} from './world.js';import {populationBlockMapperReady} from './population-world.js';
import {Survival} from './survival.js';import {EntityWorld} from './entities.js';
import {restorePopulation} from './population-runtime.js';import {restoreStructureEntities,saveStructureEntities} from './structure-simulation.js';import {importedRuntime} from './world-import.js';
await populationBlockMapperReady;
test('generated dungeon loot, spawners and supported animals enter live state exactly once across import/reloads',()=>{
  // Native default-17 has dungeon tiles. Regeneration restores the full generation record,
  // whereas saved empty tiles/entities must remain empty after looting/killing.
  const w=new World('17','java',11),p=new Survival({},'survival'),m=new EntityWorld(w,[]),record={seed:'17',biome:'java',generationVersion:11};
  const first=restorePopulation(record,w,p,m);assert.ok(first.chests>0);assert.ok(first.animals>0);
  const live=restoreStructureEntities(record,w),g=w.generatedStructures.chests[0],key=`${g.x},${g.y},${g.z}`;
  assert.ok(p.chests[key].items.some(Boolean));assert.equal(p.chests[key].facing,g.facing);
  p.chests[key].items.fill(null);m.entities=[];
  const saved=JSON.parse(JSON.stringify({...record,player:p.serialize(),entities:m.serialize(),...saveStructureEntities(live)}));
  const imported={...saved,...importedRuntime(saved)};
  const p2=new Survival(imported.player),m2=new EntityWorld(w,imported.entities);
  assert.equal(restorePopulation(imported,w,p2,m2).fresh,false);assert.equal(p2.chests[key].items.filter(Boolean).length,0);assert.equal(m2.entities.length,0);
  const again=restoreStructureEntities(imported,w);assert.deepEqual(saveStructureEntities(again),saveStructureEntities(live));
});
