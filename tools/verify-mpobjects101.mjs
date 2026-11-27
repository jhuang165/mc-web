// Batch 101 mpobjects101: executed S19 (setEntityState) statuses of a real 1.7.10 EntityVillager: records from tools/probes/MpObjects101Probe.java (VillageFightProbe's village double) into
// public/research/mpobjects101-reference.json. Needs the patched classes of verify-villagers100.mjs (run it first, or copy its `classes` and `probe` directories to <research>/mpobjects101-probe).
// Run: MC_RESEARCH=<dir with minecraft-1.7.10.jar> node tools/verify-mpobjects101.mjs
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,cp} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'mpobjects101-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
if(!await exists(path.join(out,'classes'))){const from=path.join(research,'mobrec100-probe');await cp(path.join(from,'classes'),path.join(out,'classes'),{recursive:true});await cp(path.join(from,'probe'),path.join(out,'probe'),{recursive:true});}
async function library(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const dir of [path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries'),path.join(os.homedir(),'.gradle/caches'),path.join(research,'libs-1.7.10')]){
  if(!await exists(dir))continue;const {stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24});const hit=stdout.split('\n').filter(Boolean).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs=await Promise.all(['guava-','log4j-api-','commons-lang3-','authlib-','netty-buffer-','netty-common-','netty-codec-','netty-transport-4','netty-handler-4','netty-resolver-4','gson-','commons-io-','commons-codec-'].map(library));
const classes=path.join(out,'classes'),probe=path.join(out,'probe'),cp_=[probe,classes,...libs].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp_,'-d',probe,path.join(root,'probes/MpObjects101Probe.java')],{maxBuffer:1<<24});
const {stdout}=await exec('java',['--add-opens=java.base/java.util=ALL-UNNAMED','-cp',cp_,'MpObjects101Probe'],{maxBuffer:1<<28});
const records=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l));
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={yv:'EntityVillager',up:'EntityAIVillagerMate',ahb:'World',sv:'EntityLivingBase'};
const classes_=Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}])));
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:classes_,
 method:'Batch 101. VillageFightProbe village double (12-door village for the breeding records) whose World.setEntityState double records [tick, class, status, growing age of the entity (rx.d())]. statuses are S19 (EntityStatus) payloads, in send order.',records};
// the tracker cadence record (tools/probes/TrackerCadence101Probe.java): the unchanged EntityTrackerEntry with MpObjects100Probe's doubles, compiled against copies of the mpobjects100 probe's classes
const tdir=path.join(out,'tracker');
if(!await exists(tdir)){const from=path.join(research,'mpobjects100-probe');await cp(from+'/classes',tdir+'/classes',{recursive:true});await cp(from+'/probe',tdir+'/probe',{recursive:true});}
const tlibs=await Promise.all(['guava-','log4j-api-','commons-lang3-','authlib-','commons-io-','gson-','icu4j-core-mojang-','netty-all-'].map(library));
const tcp=[tdir+'/probe',tdir+'/classes',...tlibs].join(path.delimiter);
await exec('javac',['-nowarn','-cp',tcp,'-d',tdir+'/probe',path.join(root,'probes/TrackerCadence101Probe.java')],{maxBuffer:1<<24});
const t=await exec('java',['-cp',tcp,'TrackerCadence101Probe'],{maxBuffer:1<<28});
const cadence=t.stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l));
reference.method+=' cadence: TrackerCadence101Probe, the real EntityTrackerEntry for a standing item (rows: calls and the packets each sent).';
reference.cadence=cadence;
await writeFile(path.join(root,'../public/research/mpobjects101-reference.json'),JSON.stringify(reference)+'\n');
console.log('b101 records',records.length,'cadence',cadence.length);
