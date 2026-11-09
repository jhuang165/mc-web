// Records the generation-time fallen-button and powered-TNT neighbour chains from the unchanged BlockButton (ajs, anx, aon) and BlockTNT (aob)
// inside the RedstoneProbe World/Chunk harness (tools/probes/NeighborChainProbe.java) in public/research/neighbor-chains-reference.json;
// src/native-neighbor-world.test.js replays it through the structure population world. Run with MC_RESEARCH=<tools/research>.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import os from 'node:os';import {fileURLToPath} from 'node:url';import path from 'node:path';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'neighbor-chains-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function library(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const dir of [path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries'),path.join(os.homedir(),'.gradle/caches')]){
  if(!await exists(dir))continue;const {stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24});const hit=stdout.split('\n').filter(Boolean).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs=await Promise.all(['guava-','log4j-api-','log4j-core-','commons-lang3-','gson-','commons-io-','netty-all-','authlib-','icu4j-core-mojang-'].map(p=>library(p).catch(()=>null))).then(a=>a.filter(Boolean));
const classes=path.join(out,'classes');await rm(classes,{recursive:true,force:true});await mkdir(classes,{recursive:true});
await exec('unzip',['-q','-o',jar,'*.class','-d',classes],{maxBuffer:1<<24});
const probe=path.join(out,'probe');await rm(probe,{recursive:true,force:true});await mkdir(probe,{recursive:true});
const cp=[probe,classes,...libs].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(root,'probes/RedstoneProbe.java'),path.join(root,'probes/NeighborChainProbe.java')],{maxBuffer:1<<24});
const {stdout}=await exec('java',['-cp',cp,'NeighborChainProbe'],{maxBuffer:1<<28});
const line=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l))[0];
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={ajs:'BlockButton',anx:'BlockButtonStone',aon:'BlockButtonWood',aob:'BlockTNT',xw:'EntityTNTPrimed'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Unchanged BlockButton.onNeighborBlockChange and BlockTNT.onBlockAdded / onNeighborBlockChange in the RedstoneProbe World/Chunk harness; spawnEntityInWorld records the EntityItem or EntityTNTPrimed.',
 cases:line.cases};
await writeFile(path.join(root,'../public/research/neighbor-chains-reference.json'),JSON.stringify(reference)+'\n');
console.log('neighbour chains:',line.cases.length,'cases');
