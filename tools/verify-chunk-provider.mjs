// Records the unchanged 1.7.10 server chunk lifecycle (ChunkProviderServer, PlayerManager, PlayerInstance,
// WorldServer.saveAllChunks) and the unload queue's ConcurrentHashMap order; see ChunkProviderProbe.java.
// Requires the pinned client JAR, a JDK and the usual probe libraries.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'chunk-provider-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function library(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const dir of [path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries'),path.join(os.homedir(),'.gradle/caches')]){
  if(!await exists(dir))continue;const {stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24});const hit=stdout.split('\n').filter(Boolean).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs=await Promise.all(['guava-','log4j-api-','commons-lang3-','authlib-','netty-'].map(library));
const classes=path.join(out,'classes');await rm(classes,{recursive:true,force:true});await mkdir(classes,{recursive:true});
await exec('unzip',['-q','-o',jar,'*.class','-d',classes],{maxBuffer:1<<24});
const probe=path.join(out,'probe');await mkdir(probe,{recursive:true});
const cp=[probe,classes,...libs].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(root,'probes/ChunkProviderProbe.java')]);
const {stdout}=await exec('java',['-cp',cp,'ChunkProviderProbe'],{maxBuffer:1<<28});
const records=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(JSON.parse);
assert.deepEqual(records.map(r=>r.name),['wide','square','collide','split',...[0,1,2,3,4,5].map(i=>'cluster'+i),'spawn','walk','teleport','noRespawn','view','save','inhabit']);
const {stderr:version}=await exec('java',['-XshowSettings:properties','-version']);
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={ms:'ChunkProviderServer',mq:'PlayerManager',mr:'PlayerInstance',mt:'WorldServer',apx:'Chunk',apw:'EmptyChunk',agu:'ChunkCoordIntPair',qd:'LongHashMap'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Unchanged ChunkProviderServer constructed over a stub IChunkLoader (stores TerrainPopulated, LightPopulated, InhabitedTime and hasEntities; logs load/save/saveExtra/chunkTick/saveExtraData) and a stub generator (logs provideChunk/populate/recreateStructures). WorldServer, PlayerManager and EntityPlayerMP are allocated without constructors; only the fields these methods read are set; saveLevel is a no-op; the provider has no sky, so Chunk.func_150809_p does no lighting. Ticks run unloadQueuedChunks, totalWorldTime + 1, PlayerManager.updatePlayerInstances in WorldServer.tick order; prepare is MinecraftServer.initialWorldChunkLoad\'s loop. No block-change packets, chunk sending, entity or tile entity code. Set records are Collections.newSetFromMap(ConcurrentHashMap) iteration orders over seeded add/remove/remove-first op lists on the probe JVM ('+(String(version).match(/java\.version = (\S+)/)?.[1]||'unknown')+'). Snapshot fields: loaded = [x, z, flags (1 populated, 2 light populated, 4 modified, 8 hasEntities, 16 loaded), lastSaveTime, inhabitedTime] per chunk in loadedChunks order; queue = unload set order; watchers = [x, z, players, previousWorldTime] in playerInstanceList order; sends = each player\'s loadedChunks (send queue); a null field is unchanged since the previous step.',
 records};
await writeFile(path.join(root,'../public/research/chunk-provider-reference.json'),JSON.stringify(reference)+'\n');
console.log('Original chunk provider records:',records.length,'steps:',records.filter(r=>r.steps).reduce((n,r)=>n+r.steps.length,0));
