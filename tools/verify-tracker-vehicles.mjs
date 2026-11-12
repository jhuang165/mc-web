// Records the tracked vehicles and hanging entities (tools/probes/TrackerVehiclesProbe.java: the unchanged EntityTrackerEntry with a real server EntityBoat, EntityMinecart (the
// xl.a factory), EntityPainting, EntityItemFrame and EntityLeashKnot, and the same classes as the client's entities created like NetHandlerPlayClient does) in
// public/research/tracker-vehicles-reference.json. src/object-tracker-vehicles.test.js replays it. Same jar lookup as the other verify-*.mjs tools.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'tracker-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function library(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const dir of [path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries'),path.join(os.homedir(),'.gradle/caches')]){
  if(!await exists(dir))continue;const {stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24});const hit=stdout.split('\n').filter(Boolean).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs=await Promise.all(['guava-','log4j-api-','commons-lang3-','authlib-','commons-io-','gson-','icu4j-core-mojang-','netty-all-'].map(library));
const classes=path.join(out,'classes');await rm(classes,{recursive:true,force:true});await mkdir(classes,{recursive:true});
await exec('unzip',['-q','-o',jar,'*.class','assets/minecraft/lang/en_US.lang','-d',classes],{maxBuffer:1<<24});
const probe=path.join(out,'probe');await mkdir(probe,{recursive:true});
const cp=[probe,classes,...libs].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,...['MobMoveProbe','ChickenProbe','TrackerProbe','TrackerItemsProbe','TrackerExtrasProbe','TrackerHitsProbe','TrackerVehiclesProbe'].map(n=>path.join(root,`probes/${n}.java`))],{maxBuffer:1<<24});
const {stdout}=await exec('java',['-cp',cp,'TrackerVehiclesProbe'],{maxBuffer:1<<28});
const lines=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l));
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={my:'EntityTrackerEntry',bjb:'NetHandlerPlayClient',fw:'S0EPacketSpawnObject',ga:'S10PacketSpawnPainting',sa:'Entity',xi:'EntityBoat',xl:'EntityMinecart',ss:'EntityHanging',tb:'EntityPainting',st:'EntityItemFrame',su:'EntityLeashKnot'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',
 classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Executed: the unchanged EntityTrackerEntry tracking a real server entity pushed along by the scenario (the world double has no water or rails), and the same class as the client entity made from the packets like NetHandlerPlayClient does (S0E types 1, 10, 71, 77 and S10; bjb.a(fw) zeroes the motion of item frames and knots, truncates their tile with d2i; its Entity.rand reseeded with Random(12345)), ticked with its own onUpdate on a client world double that records spawnParticle calls. The client boat stays the empty-boat client (isBoatEmpty true); bjb.a(S1B) sets it false only for the client player as rider, which is bytecode-read and not run.',
 ...Object.fromEntries(lines.map(l=>[l.case,l]))};
await writeFile(path.join(root,'../public/research/tracker-vehicles-reference.json'),JSON.stringify(reference)+'\n');
console.log('tracker-vehicles:',lines.map(l=>l.case+'='+(l.rows?.length??0)).join(' '));
