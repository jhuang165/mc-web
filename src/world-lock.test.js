import test from 'node:test';import assert from 'node:assert/strict';import {acquireWorldWriter} from './world-lock.js';
test('a second tab cannot write; closing the writer releases browser-owned ownership',async()=>{
 let held=false;const locks={async request(name,options,callback){assert.equal(name,'blockworld.storage.writer');if(held)return callback(null);held=true;try{return await callback({name});}finally{held=false;}}};
 const release=await acquireWorldWriter(locks);await assert.rejects(acquireWorldWriter(locks),/another tab/);release();await new Promise(r=>setImmediate(r));
 const again=await acquireWorldWriter(locks);again();await assert.rejects(acquireWorldWriter(null),/Web Locks/);
});
