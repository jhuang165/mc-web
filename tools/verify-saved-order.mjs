// Batch 52 (b52so): runs tools/probes/SavedOrderProbe.java (the unchanged AnvilChunkLoader entity writer and reader plus Chunk.onChunkLoad: the order of World.loadedEntityList after a save and reload)
// and writes public/research/saved-order-reference.json, which src/saved-order-b52.test.js replays against the away run's save and load (src/saved-order.js). Same set-up as verify-away-order.mjs.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'saved-order-probe-run');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function library(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const dir of [path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries'),path.join(os.homedir(),'.gradle/caches')]){
  if(!await exists(dir))continue;const {stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24});const hit=stdout.split('\n').filter(Boolean).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs=await Promise.all(['guava-','log4j-api-','commons-lang3-','authlib-','netty-','gson-','commons-io-'].map(library));
const classes=path.join(out,'classes');await rm(classes,{recursive:true,force:true});await mkdir(classes,{recursive:true});
await exec('unzip',['-q','-o',jar,'*.class','-d',classes],{maxBuffer:1<<24});
const probe=path.join(out,'probe');await mkdir(probe,{recursive:true});
await writeFile(path.join(probe,'GameProfile.java'),'package com.mojang.authlib; public class GameProfile {}\n');
const cp=[probe,classes,...libs].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(probe,'GameProfile.java'),...['MobMoveProbe','PlantProbe','PlayerStepProbe','XpOrbProbe','NbtProbe','MinecartProbe','HangingProbe','EntityListProbe','SavedOrderProbe','ChunkProviderProbe','SavedOrderLoginProbe'].map(n=>path.join(root,`probes/${n}.java`))]);
const {stdout}=await exec('java',['-cp',cp,'SavedOrderProbe'],{maxBuffer:1<<26});
const records=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(JSON.parse);
const cases=records.filter(r=>r.case==='saved-order'),cases2=records.filter(r=>r.case==='saved-order2'),cases3=records.filter(r=>r.case==='saved-order3');
assert.equal(cases.length,7,'7 b52so scenarios');assert.equal(cases2.length,13,'13 b53so scenarios');assert.equal(cases3.length,9,'9 b54so scenarios');
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',
 method:'Batch 52 b52so: the unchanged AnvilChunkLoader writer (Chunk.entityLists, 16 sections each in list order) and reader, then Chunk.onChunkLoad (addLoadedEntities per section 0..15) over EntityListProbe World double; EntityItem, EntityXPOrb, EntityArrow, EntityTNTPrimed and EntityCow added to chunks in a given order, saved, read back; each record has the index order before the save and in loadedEntityList after the load.',
 cases};
await writeFile(path.join(root,'../public/research/saved-order-reference.json'),JSON.stringify(reference)+'\n');
console.log(`${cases.length} saved order scenarios`);
// Batch 53 (b53so): entities that changed section or chunk (the real World.updateEntityWithOptionalForce refiles them) and a mount saved with its rider; replayed by src/saved-order2-b53.test.js.
const reference2={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',
 method:'Batch 53 b53so: SavedOrderProbe scenario2. The b52so set-up plus the unchanged World.updateEntityWithOptionalForce(entity, false) run over every entity in loadedEntityList order after each tick of moves (Chunk.removeEntityAtIndex then Chunk.addEntity when floor(pos/16) differs from the filed cell, with y unclamped against the clamped filed section), EntityMinecartEmpty and EntityCow mounted with Entity.mountEntity (the rider is written with its mount nested under Riding, the mount is skipped, the loader adds the rider and then its mount). specs: kind, y, chunk, index of the mount.',
 cases:cases2};
await writeFile(path.join(root,'../public/research/saved-order2-reference.json'),JSON.stringify(reference2)+'\n');
console.log(`${cases2.length} saved order 2 scenarios`);
// Batch 54 (b54so): the chunk/section check per entity right after its own update, and a mount that carries the player (read back from the player's Riding compound); replayed by src/saved-order3-b54.test.js.
const reference3={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',
 method:'Batch 54 b54so: SavedOrderProbe scenario3. The b53so set-up, but each tick walks loadedEntityList by index and runs the unchanged World.updateEntityWithOptionalForce(entity, false) on an entity right after that entity own moves (a move by another entity, "pusher" p, lands right after p check, so the refile waits for the next pass); the chunks are read back and loaded with the real Chunk.onChunkLoad (apx.c, loadedEntityList = ahb.e; the b52/b53 probes called apx.d, Chunk.onChunkUnload, which appends the same per-section lists to the unloaded list). playerCart: the mount carries the player (a cow stands in, as a player is not in a chunk): the writer skips the mount, the rider Riding compound is read back with EntityList.createEntityFromNBT, forceSpawn and the real World.spawnEntityInWorld after the chunks, as ServerConfigurationManager.initializeConnectionToPlayer does (bytecode-read for the caller, executed for the calls).',
 cases:cases3};
await writeFile(path.join(root,'../public/research/saved-order3-reference.json'),JSON.stringify(reference3)+'\n');
console.log(`${cases3.length} saved order 3 scenarios`);
// Batch 56 (b56so): the loaded-entity order of a native login (spawn grid, the player's chunk, the view square, the player's mount) and the chain below a mount that carries the player; replayed by src/saved-order4-b56.test.js.
const login=await exec('java',['-cp',cp,'SavedOrderLoginProbe'],{maxBuffer:1<<26});
const cases4=login.stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(JSON.parse).filter(r=>r.case==='saved-order4');
assert.equal(cases4.length,10,'10 b56so scenarios');
const reference4={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',
 method:'Batch 56 b56so: SavedOrderLoginProbe. The unchanged ChunkProviderServer (ms) over a loader that reads each chunk with the real AnvilChunkLoader reader from NBT the real writer made, MinecraftServer.initialWorldChunkLoad (25 x 25 chunks round the spawn), then ServerConfigurationManager.playerLoggedIn: the real World.spawnEntityInWorld(EntityPlayerMP) (ahb.d), the real PlayerManager.addPlayer (mq.a), and the mount read from the first Riding compound (EntityList.createEntityFromNBT, forceSpawn, spawnEntityInWorld). The caller sequence is bytecode-read (oi.c(mw), oi initializeConnectionToPlayer). after: entity indices (x = chunk x * 16 + 1 + 0.5 * index; -1 the player) in loadedEntityList order.',
 cases:cases4};
await writeFile(path.join(root,'../public/research/saved-order4-reference.json'),JSON.stringify(reference4)+'\n');
console.log(`${cases4.length} saved order 4 scenarios`);
// Batch 57 (b57so): the Nether and End logins (no spawn grid), the Overworld with nobody logged in, a mob riding the mount the player takes, and non-mob entities high above the world; replayed by src/saved-order-b57.test.js.
const cases5=login.stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(JSON.parse).filter(r=>r.case==='saved-order5');
assert.equal(cases5.length,10,'10 b57so scenarios');
const reference5={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',
 method:'Batch 57 b57so: SavedOrderLoginProbe, same set-up as b56so with three switches. nether: no initialWorldChunkLoad (MinecraftServer.g runs its loop for dimension 0 only: bytecode-read, the level index is 0 and never incremented), so only the player chunk and the view square load; away: the grid loads and nobody logs in; stale: a cow in a cart whose rider slot the player then takes (Entity.mountEntity does not clear the old rider link: bytecode-read; EntityBoat.interactFirst lets a non-player rider be taken over, EntityMinecartEmpty refuses): the writer saves the cow with the cart nested and skips the ridden cart, the login reads the player Riding too. high: EntityItem, EntityBoat, EntityFallingBlock, EntityTNTPrimed, EntityArrow, EntityXPOrb and EntityMinecartEmpty at y from -20 to 4000 through the real writer and reader. after: entity indices (x = chunk x * 16 + 1 + 0.5 * index; -1 the player) in loadedEntityList order.',
 cases:cases5};
await writeFile(path.join(root,'../public/research/saved-order5-reference.json'),JSON.stringify(reference5)+'\n');
console.log(`${cases5.length} saved order 5 scenarios`);
// Batch 58 (b58so): the chunks the player's movement loads after the login append to loadedEntityList in load order (PlayerManager.updateMountedMovingPlayer); replayed by src/savedorder6-b58.test.js.
const cases6=login.stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(JSON.parse).filter(r=>r.case==='saved-order6');
assert.equal(cases6.length,4,'4 b58so scenarios');
const reference6={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',
 method:'Batch 58 b58so: SavedOrderLoginProbe, the b57so set-up without the spawn grid, then the real PlayerManager.updateMountedMovingPlayer (mq.d) after the player position is set to `move`: a PlayerInstance, which loads its chunk through the unchanged ChunkProviderServer, for each chunk of the new view square that is not watched (x outer, z inner). after: entity indices (x = chunk x * 16 + 1 + 0.5 * index) in loadedEntityList order. away-falling: nobody logged in, the spawn grid, EntityFallingBlock among the kinds.',
 cases:cases6};
await writeFile(path.join(root,'../public/research/saved-order6-reference.json'),JSON.stringify(reference6)+'\n');
console.log(`${cases6.length} saved order 6 scenarios`);
// Batch 59 (b59so): the player walks away and back with chunk unloading (ChunkProviderServer.unloadChunksIfNotNearSpawn, unloadQueuedChunks, World.updateEntities' removeAll); replayed by src/savedorder7-b59.test.js.
const cases7=login.stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(JSON.parse).filter(r=>r.case==='saved-order7');
assert.equal(cases7.length,4,'4 b59so scenarios');
const reference7={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',
 method:'Batch 59 b59so: SavedOrderLoginProbe, the b58so set-up (no spawn grid), then the real PlayerManager.updateMountedMovingPlayer along `path` (far away, then back); after each step the real ChunkProviderServer.unloadQueuedChunks (ms.d: Chunk.onChunkUnload hands the entity lists to World.unloadEntities) and the removeAll World.updateEntities does. A chunk the player re-enters is read from its saved NBT and appends to loadedEntityList. Spawn rule (ms.b, bytecode-read): a chunk is queued when its centre is more than 128 blocks from the spawn on an axis, or always when the provider cannot respawn (nether case). after: entity indices in loadedEntityList order.',
 cases:cases7};
await writeFile(path.join(root,'../public/research/saved-order7-reference.json'),JSON.stringify(reference7)+'\n');
console.log(`${cases7.length} saved order 7 scenarios`);
