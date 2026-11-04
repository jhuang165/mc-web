import test from 'node:test';
import assert from 'node:assert/strict';
import {Chunk} from './chunk-store.js';
import {World} from './world.js';
import {chunkToNbt} from './chunk-nbt.js';
import {encodeRegionChunk,writeRegion} from './region-file.js';
import {previewJavaChunk} from './chunk-preview.js';

test('a negative-coordinate chunk restores as a playable full-height terrain patch', async () => {
  const chunk=new Chunk(-1,32);
  chunk.setBlockState(15,255,0,35,14);
  chunk.setBlockState(0,0,0,137);
  const file=writeRegion([await encodeRegionChunk(chunkToNbt(chunk),{x:31,z:0})]);
  const {record,report}=await previewJavaChunk('r.-1.1.mca',file,-1,32);
  const world=new World(record.seed,record.biome,record.generationVersion);
  world.restore(JSON.parse(JSON.stringify(record.edits)));
  assert.equal(world.get(79,255,64),19);
  assert.equal(world.getMeta(79,255,64),14);
  assert.equal(world.get(64,0,64),139);
  assert.equal(world.get(70,10,70),0);
  assert.equal(report.omittedBlocks,0);
  assert.equal(record.mode,'creative');
  await assert.rejects(previewJavaChunk('r.0.1.mca',file,-1,32),/belongs/);
  await assert.rejects(previewJavaChunk('r.-1.1.mca',file,-2,32),/absent/);
});
