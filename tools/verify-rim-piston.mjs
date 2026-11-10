// Batch 41 (ringpiston): runs the unchanged 1.7.10 World.getBlock, ChunkProviderServer.provideChunk and BlockPistonBase.canExtend over an
// unloaded chunk (probes/RimPistonProbe.java) and writes public/research/rim-piston-reference.json. Needs the pinned client JAR and a JDK.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'rim-piston-probe');
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
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(root,'probes/RimPistonProbe.java')]);
const {stdout}=await exec('java',['-cp',cp,'RimPistonProbe'],{maxBuffer:1<<26});
const scenes=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(JSON.parse);
assert.deepEqual(scenes.map(r=>r.name),['generated','saved','providerEmpty']);
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={ahb:'World',ms:'ChunkProviderServer',app:'BlockPistonBase',apx:'Chunk',apw:'EmptyChunk'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Executed (not just read): unchanged World.getBlock (ahb.a), ChunkProviderServer.provideChunk (ms.d) / loadChunk (ms.c) and BlockPistonBase.canExtend (app.h) over a constructor-less WorldServer, a stub IChunkLoader and a stub generator (logs L load, G generate, P populate). Piston at (14, 63, 5) facing +x; the line runs along the top of a stone block in chunks (0,0) and (1,0), so a loaded stone chunk (1,0) makes the 13-cell line too long (canExtend false) and air makes it true. ChunkProviderServer.loadChunkOnProvideRequest (field a) defaults to true; scene providerEmpty sets it false.',
 scenes};
await writeFile(path.join(root,'../public/research/rim-piston-reference.json'),JSON.stringify(reference,null,1)+'\n');
console.log(JSON.stringify(scenes,null,1));
