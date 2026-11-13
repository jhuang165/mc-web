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
const cases4=login.stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(JSON.parse);
assert.equal(cases4.length,10,'10 b56so scenarios');
const reference4={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',
 method:'Batch 56 b56so: SavedOrderLoginProbe. The unchanged ChunkProviderServer (ms) over a loader that reads each chunk with the real AnvilChunkLoader reader from NBT the real writer made, MinecraftServer.initialWorldChunkLoad (25 x 25 chunks round the spawn), then ServerConfigurationManager.playerLoggedIn: the real World.spawnEntityInWorld(EntityPlayerMP) (ahb.d), the real PlayerManager.addPlayer (mq.a), and the mount read from the first Riding compound (EntityList.createEntityFromNBT, forceSpawn, spawnEntityInWorld). The caller sequence is bytecode-read (oi.c(mw), oi initializeConnectionToPlayer). after: entity indices (x = chunk x * 16 + 1 + 0.5 * index; -1 the player) in loadedEntityList order.',
 cases:cases4};
await writeFile(path.join(root,'../public/research/saved-order4-reference.json'),JSON.stringify(reference4)+'\n');
console.log(`${cases4.length} saved order 4 scenarios`);
