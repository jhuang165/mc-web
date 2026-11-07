// Records the unchanged 1.7.10 light engine (World.updateLightByType / computeLightValue, Chunk.generateSkylightMap / relightBlock /
// propagateSkylightOcclusion / func_150804_b recheckGaps) over real Chunk and ExtendedBlockStorage objects into
// public/research/light-engine-reference.json; src/light-engine.test.js replays it. See probes/LightEngineProbe.java.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'lightengine-probe');
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
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(root,'probes/LightEngineProbe.java')],{maxBuffer:1<<24});
const {stdout}=await exec('java',['-cp',cp,'LightEngineProbe'],{maxBuffer:1<<30});
const scenarios=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l));
assert.equal(scenarios.length,18);
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={ahb:'World',apx:'Chunk',apz:'ExtendedBlockStorage',aji:'Block'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Unchanged World (ahb) over a Provider of real Chunk (apx) objects, chunks -2..2. Each scenario: fills (x0,y0,z0,x1,y1,z1,id,meta over air) build 25 chunks, Chunk.generateSkylightMap on each ("generated"), then isTerrainPopulated set and two ticks of Chunk.func_150804_b(false) with isRemote false ("settled"), then per step World.setBlock(flags 2, isRemote true so block callbacks are skipped) followed by one such tick. Snapshots: sha256 of sky bytes, block bytes (x -16..31, z -16..31, y 0..255, x-major then z then y; columns with x&15 = 15 and z&15 = 15, which hold the section-anchoring stone at y 100, are zero-filled) and heightMap shorts (big-endian, same column order), plus a region of hex nibbles (box x0,y0,z0,x1,y1,z1; x, z, y order) on some steps. All scenarios except null-section carry one anchor stone per chunk so sections 4-6 exist.',
 scenarios};
await writeFile(path.join(root,'../public/research/light-engine-reference.json'),JSON.stringify(reference)+'\n');
console.log('Light scenarios:',scenarios.length,'bytes:',JSON.stringify(reference).length);
