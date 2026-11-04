// Unchanged BlockCauldron.onBlockActivated behavior for leather armor washing.
// Requires the pinned 1.7.10 JAR, a JDK and vanilla probe libraries.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, writeFile, access, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=(p)=>access(p).then(()=>true,()=>false);
const dirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);let research;
for(const dir of dirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'cauldron-wash-probe'),sha='e80d9b3bf5085002218d4be59e668bac718abbc6';
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),sha);
async function library(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const dir of [path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries'),path.join(os.homedir(),'.gradle/caches')]){
  if(!await exists(dir))continue;const{stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24}),hit=stdout.split('\n').filter(Boolean).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs=await Promise.all(['guava-','log4j-api-','commons-lang3-','netty-all-'].map(library)),classes=path.join(out,'classes');
await rm(classes,{recursive:true,force:true});await mkdir(classes,{recursive:true});await exec('unzip',['-q','-o',jar,'*.class','-d',classes],{maxBuffer:1<<24});
const probe=path.join(out,'probe');await mkdir(probe,{recursive:true});const cp=[probe,classes,...libs].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(root,'probes/StoneUtilityProbe.java'),path.join(root,'probes/CauldronWashProbe.java')]);
const{stdout}=await exec('java',['-cp',cp,'CauldronWashProbe'],{maxBuffer:1<<26}),rows=stdout.trim().split('\n').filter(x=>x.startsWith('{')).map(JSON.parse);
assert.equal(rows.filter(r=>r.kind==='wash').length,128);assert.equal(rows.filter(r=>r.kind==='nonLeather').length,8);assert.equal(rows.length,136);
const srg=await readFile(path.join(research,'joined-1.7.10.srg'),'utf8'),classesRef={};
for(const[id,name]of Object.entries({ajw:'BlockCauldron',abb:'ItemArmor'}))classesRef[id]={name,sha256:createHash('sha256').update((await exec('unzip',['-p',jar,id+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex')};
const reference={target:'Minecraft Java 1.7.10',clientSha1:sha,srgSha256:createHash('sha256').update(srg).digest('hex'),classes:classesRef,
 method:'Unchanged BlockCauldron.onBlockActivated and ItemArmor hasColor/getColor/setColor over a native map-backed World double. Cases cover each leather armor piece with no color, black, 0x123456 and the default tan color at water levels 0-3 in Survival and Creative; non-leather armor is checked at every level/mode. Captures return value, remaining water metadata, held-stack color/count and world writes.',counts:{wash:128,nonLeather:8},rows};
const file=path.join(root,'../public/research/cauldron-wash-reference.json');await writeFile(file,JSON.stringify(reference)+'\n');
console.log('Unchanged Java cauldron wash records:',rows.length,'cases');
