import test from 'node:test';
import assert from 'node:assert/strict';
import {splitRuntime,joinRuntime} from './chunk-runtime.js';
import {World} from './world.js';
import {Farming} from './farming.js';
test('runtime partitions preserve negative owners, entity order, empty containers and tick tie order',()=>{
 const r={id:'w',player:{health:18,chests:{'-1,70,-17':{items:[]}},furnaces:{'32,65,0':{cook:4}}},
 entities:[{x:33,y:64,z:0,type:'pig'},{x:-1,y:65,z:-17,type:'cow'},{x:34,y:66,z:0,type:'sheep'}],
 drops:[],projectiles:[],arrows:[],tnt:[],farms:[['-1,64,-17',3]],xpOrbs:[],falling:[],spawners:[],minecarts:{version:1,carts:[]},
 fluidTicks:{version:1,time:100,entries:[{x:32,y:65,z:0,block:10,delay:2},{x:-1,y:65,z:-17,block:10,delay:2}]},
 fireTicks:{version:1,time:80,entries:[]},fallingTicks:{version:1,time:20,entries:[]}};
 const {metadata,columns}=splitRuntime(r);
 assert.equal(metadata.entities,undefined);assert.equal(metadata.player.chests,undefined);assert.equal(metadata.fluidTicks,undefined);
 assert.deepEqual(columns.map(c=>[c.x,c.z]).sort(),[[-1,-2],[2,0]].sort());
 const joined=joinRuntime(metadata,columns.reverse());delete joined.runtimeChunked;
 assert.deepEqual(joined,r);assert.equal(r.entities.length,3,'split never mutates live state');
});
test('soil moisture outside the initial lazy edit window survives until its column returns',()=>{
 const w=new World('17','javaStreamed',12);const farm=new Farming(w,[['500,70,-500',3]]);
 assert.equal(farm.fields.get('500,70,-500'),3);
 w.restore([['500,70,-500',30]]);w.streamAround(500,-500);
 farm.observe(500,70,-500);assert.equal(farm.fields.get('500,70,-500'),3);
});
