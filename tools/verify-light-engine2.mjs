// Records the unchanged 1.7.10 light engine driven chunk by chunk (queue length, unloaded neighbours, ChunkProviderServer population with
// Chunk.func_150809_p, enqueueRelightChecks, missing sections) into public/research/light-engine2-reference.json;
// src/native-light.test.js replays it through src/native-light.js. See probes/LightEngine2Probe.java.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'lightengine2-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function library(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const dir of [path.join(research,'libs-1.7.10'),path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries'),path.join(os.homedir(),'.gradle/caches')]){
  if(!await exists(dir))continue;const {stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24});const hit=stdout.split('\n').filter(Boolean).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs=await Promise.all(['guava-','log4j-api-','commons-lang3-','gson-'].map(library));
const classes=path.join(out,'classes');await rm(classes,{recursive:true,force:true});await mkdir(classes,{recursive:true});
await exec('unzip',['-q','-o',jar,'*.class','-d',classes],{maxBuffer:1<<24});
const probe=path.join(out,'probe');await rm(probe,{recursive:true,force:true});await mkdir(probe,{recursive:true});
const cp=[probe,classes,...libs].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(root,'probes/LightEngine2Probe.java')],{maxBuffer:1<<24});
const {stdout}=await exec('java',['-cp',cp,'LightEngine2Probe'],{maxBuffer:1<<30});
const scenarios=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l));
assert.equal(scenarios.length,9);
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={ahb:'World',apx:'Chunk',apz:'ExtendedBlockStorage',aji:'Block'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Unchanged World (ahb) over a LinkedHashMap provider of real Chunk (apx) objects in chunks -2..2 (x, z -32..47). Each scenario replays ops: queue n (World.lightUpdateBlockList = new int[n]), gen cx cz (new Chunk from the fills over air, then generateSkylightMap), load cx cz (gen, then Chunk.populateChunk(provider, provider, cx, cz) where the provider populate is ChunkProviderServer.populate: func_150809_p, then the chunk decoration list through World.setBlock flag 2; a decoration at x, z belongs to chunk ((x - 8) >> 4, (z - 8) >> 4)), terrain (isTerrainPopulated on every loaded chunk), tick (per loaded chunk in load order: enqueueRelightChecks then func_150804_b(false), isRemote false), reset (resetRelightChecks on every loaded chunk), set x y z id meta (World.setBlock flag 2, isRemote true), snap label (sha256 of World.getSavedLightValue sky bytes and block bytes over x, z -32..47 and y 0..255, x-major then z then y, and World.getHeightValue big-endian shorts in the same column order; unloaded chunks read sky 15, block 0, height 0). Fills are x0,y0,z0,x1,y1,z1,id,meta; decorations x,y,z,id,meta in order.',
 scenarios};
await writeFile(path.join(root,'../public/research/light-engine2-reference.json'),JSON.stringify(reference)+'\n');
console.log('Light engine 2 scenarios:',scenarios.length,'bytes:',JSON.stringify(reference).length);
