// Batch 100 (copy of verify-tracker-items.mjs): executed tracker records for a null-item EntityItem and the iron golem rose status (tools/probes/MpObjects100Probe.java). Original: records the tracked non-living entities (tools/probes/TrackerItemsProbe.java: the unchanged EntityTrackerEntry with real server EntityItem,
// EntityXPOrb, EntityArrow, EntitySnowball, EntityFallingBlock and EntityTNTPrimed, and the same classes as the client's entities created
// like NetHandlerPlayClient does) plus the bytecode-read EntityTracker.addEntityToTracker table, in public/research/tracker-items-reference.json.
// src/object-tracker.test.js replays the scenarios against the browser port. Same jar lookup as the other verify-*.mjs tools.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'mpobjects100-probe');
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
await exec('javac',['-nowarn','-cp',cp,'-d',probe,...['MobMoveProbe','ChickenProbe','TrackerProbe','TrackerItemsProbe','MpObjects100Probe'].map(n=>path.join(root,`probes/${n}.java`))],{maxBuffer:1<<24});
const {stdout}=await exec('java',['-cp',cp,'MpObjects100Probe'],{maxBuffer:1<<28});
const lines=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l));
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={my:'EntityTrackerEntry',xk:'EntityItem',wt:'EntityIronGolem',gt:'S19PacketEntityStatus',hw:'S1CPacketEntityMetadata',fw:'S0EPacketSpawnObject',et:'PacketBuffer',te:'DataWatcher',fa:'MessageSerializer',ej:'NetworkManager'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',
 classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Executed: the unchanged EntityTrackerEntry tracking a real EntityItem with a null-item stack (and a feather control) and a real EntityIronGolem; every packet written through the real PacketBuffer. Bytecode-read: MessageSerializer.encode has no catch, NetworkManager.exceptionCaught disconnects with disconnect.genericReason; WorldServer.setEntityState = EntityTracker.func_151248_b(entity, S19) = EntityTrackerEntry.func_151261_b.',
 ...Object.fromEntries(lines.map(l=>[l.case,l]))};
await writeFile(path.join(root,'../public/research/mpobjects100-reference.json'),JSON.stringify(reference)+'\n');
console.log('mpobjects100:',lines.map(l=>l.case).join(' '));
