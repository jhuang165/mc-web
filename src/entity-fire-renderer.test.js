import {test} from 'node:test';
import assert from 'node:assert/strict';
import {entityFireLayers} from './entity-fire-renderer.js';
import {PlayerBody} from './player-renderer.js';
import {stuckArrowPlacements} from './stuck-arrows.js';
test('entity fire uses the native alternating, mirrored, narrowing stack of quads',()=>{
  const q=entityFireLayers(.6,1.8,1.62);
  assert.equal(q.length,5);
  assert.deepEqual(q.map(l=>l.sprite),[0,1,0,1,0]);
  assert.deepEqual(q.map(l=>l.flip),[true,true,false,false,true]);
  assert.ok(q[1].half<q[0].half&&q[1].bottom>q[0].bottom&&q[1].z>q[0].z);
});
test('player lifetimes allocate nonzero ids for stable stuck-arrow layouts instead of every player using id zero',()=>{
  const p=new PlayerBody(), q=new PlayerBody();
  assert.ok(p.entityId>0&&q.entityId>p.entityId);
  const id=p.entityId,a=stuckArrowPlacements(id,3);
  p.tick({position:{x:0,y:1,z:0},previous:{x:0,y:1,z:0},yaw:0,pitch:0});
  assert.equal(p.entityId,id); assert.deepEqual(stuckArrowPlacements(id,3),a);
  assert.notDeepEqual(stuckArrowPlacements(q.entityId,3),a);
  p.reset({x:0,y:1,z:0},0,0); assert.ok(p.entityId>q.entityId);
});
