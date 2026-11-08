// Batch 29: oak sapling and leaf random ticks in the Nether and End on the unchanged classes (see the reference method; probes/DimTreeProbe.java). Header of the light-engine3 tool it is built from: (batch 27: seven by seven chunks, ring edits, the real Nether and End providers) driven chunk by chunk (queue length, unloaded neighbours, ChunkProviderServer population with
// Chunk.func_150809_p, enqueueRelightChecks, missing sections) into public/research/light-engine3-reference.json;
// src/native-light-ring.test.js replays it through src/native-light.js. See probes/LightEngine3Probe.java.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'dimtree-probe');
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
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(root,'probes/LightEngine3Probe.java'),path.join(root,'probes/DimTreeProbe.java')],{maxBuffer:1<<24});
const {stdout}=await exec('java',['-cp',cp,'DimTreeProbe'],{maxBuffer:1<<30});
const scenarios=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l));
assert.equal(scenarios.length,2);
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={ahb:'World',apx:'Chunk',apz:'ExtendedBlockStorage',aji:'Block',anj:'BlockSapling',alt:'BlockLeaves',asq:'WorldGenTrees',ard:'WorldGenBigTree'};
const classesInfo={};for(const [c,name] of Object.entries(names))classesInfo[c]={name,sha256:await digest(c)};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:classesInfo,
 method:'Unchanged World/Chunk light code (LightEngine3Probe harness, real WorldProviderHell/End) with oak saplings on dirt pedestals (block light above 15 - d, d in 0, 5, 6, 7, or dark) ticked by the unchanged BlockSapling.updateTick (anj.a) on new Random(seed): per tick event characters (. nothing, m marked, g grown, f restored, d gone), sha256 of the cells the trial changed and the next Random int; and the unchanged BlockLeaves.updateTick (alt.a) over a cube of bit-8 oak leaves around a log. ahb.k at the cell above is recorded. Bytecode-read: BlockSapling reads only ahb.k, BlockLeaves.updateTick only ahb.b (checkChunksExist) and WorldGenTrees a literal 256, no provider call. See probes/DimTreeProbe.java.',
 scenarios};
await writeFile(path.join(root,'../public/research/dimension-tree-reference.json'),JSON.stringify(reference)+'\n');
console.log('scenarios:',scenarios.length,'bytes:',JSON.stringify(reference).length);
