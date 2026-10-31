import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {TILES,blockTile,tileRect} from './block-textures.js';
const source=name=>name.startsWith('chest_')?'entity/chest/normal':'blocks/'+name;
test('every terrain atlas tile is an original texture with an in-bounds atlas region',async()=>{const manifest=JSON.parse(await readFile(new URL('../public/media/1.7.10/provenance.json',import.meta.url)));const files=new Set(manifest.assets.map(a=>a.url));for(let i=0;i<TILES.length;i++){assert.ok(files.has('/media/1.7.10/'+source(TILES[i])+'.png'),TILES[i]);const r=tileRect(i);assert.ok(r.u0>=0&&r.u1<=1&&r.u1>r.u0);assert.ok(r.v0>=0&&r.v1<=1&&r.v1>r.v0);}});
test('logs, workstations, farmland and lit furnaces select distinct original face textures',()=>{assert.equal(TILES[blockTile(4,2)],'log_oak_top');assert.equal(TILES[blockTile(4,0)],'log_oak');assert.equal(TILES[blockTile(13,2)],'crafting_table_top');assert.equal(TILES[blockTile(14,4,true)],'furnace_front_on');assert.equal(TILES[blockTile(14,4,false)],'furnace_front_off');assert.equal(TILES[blockTile(30,2)],'farmland_wet');assert.equal(TILES[blockTile(30,0)],'dirt');for(let stage=0;stage<8;stage++)assert.equal(TILES[blockTile(31+stage,0)],'wheat_stage_'+stage);assert.deepEqual([2,4,0].map(f=>TILES[blockTile(41,f)]),['chest_top','chest_front','chest_side']);});
