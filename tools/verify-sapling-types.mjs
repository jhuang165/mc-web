// Records BlockSapling.func_149878_d growth (all six sapling types, 1x1 / 2x2 / L / mixed layouts, the oak big-tree roll)
// and BlockOldLeaf/BlockNewLeaf drops per metadata from the unchanged original classes
// (tools/probes/SaplingTypesProbe.java on top of TreeProbe's fake World) into public/research/sapling-types-reference.json;
// src/sapling-types.test.js replays it. Same prerequisites as tools/verify-trees.mjs.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'sapling-types-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function library(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const dir of [path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries'),path.join(os.homedir(),'.gradle/caches')]){
  if(!await exists(dir))continue;const {stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24});const hit=stdout.split('\n').filter(Boolean).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs=await Promise.all(['guava-','log4j-api-','commons-lang3-'].map(library));
const classes=path.join(out,'classes');await rm(classes,{recursive:true,force:true});await mkdir(classes,{recursive:true});
await exec('unzip',['-q','-o',jar,'*.class','-d',classes],{maxBuffer:1<<24});
const probe=path.join(out,'probe');await mkdir(probe,{recursive:true});
const cp=[probe,classes,...libs].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(root,'probes/TreeProbe.java'),path.join(root,'probes/SaplingTypesProbe.java')]);
const {stdout}=await exec('java',['-cp',cp,'SaplingTypesProbe'],{maxBuffer:1<<27});
const facts=JSON.parse(stdout);
assert.ok(facts.rows.length>=1000&&facts.grew>300);
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={anj:'BlockSapling',ard:'WorldGenBigTree',asq:'WorldGenTrees',are:'WorldGenForest',asn:'WorldGenTaiga2',asa:'WorldGenMegaPineTree',arz:'WorldGenMegaJungle',ask:'WorldGenSavannaTree',asi:'WorldGenCanopyTree',amh:'BlockNewLeaf',aml:'BlockOldLeaf'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Unchanged BlockSapling.func_149878_d (anj.d) on TreeProbe\'s fake World (original block ids; cells x, z, metadata are saplings planted on the fixture; the call is made at (0, ground + 1, 0)); state is the sha256 of every changed cell as x,y,z,id,meta in x/y/z order, sets the number of setBlock calls, next the following Random.nextInt(1000000). Block ids are the original ones (6 sapling, 17/162 logs, 18/161 leaves, 106 vine, 127 cocoa). Evidence kind: probe.',
 ...facts};
await writeFile(path.join(root,'../public/research/sapling-types-reference.json'),JSON.stringify(reference)+'\n');
console.log('rows',facts.rows.length,'grew',facts.grew);
