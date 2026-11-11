// Batch 43 (mounts): same setup as verify-tracker.mjs, runs TrackerMountsProbe. Original header: records EntityTrackerEntry behaviour (tools/probes/TrackerProbe.java runs the unchanged class my with test doubles for the player,
// its network handler and the chunk watcher) plus bytecode-read facts of EntityTracker (mn), PlayerManager (mq), the client packet
// handler (bjb), the entity base (sa, sv) and the integrated player list (bsw) in public/research/tracker-reference.json.
// src/entity-tracker.test.js replays the scenarios against the browser port. Same jar lookup as the other verify-*.mjs tools.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'tracker-mounts-probe');
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
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(root,'probes/MobMoveProbe.java'),path.join(root,'probes/ChickenProbe.java'),path.join(root,'probes/TrackerProbe.java'),path.join(root,'probes/TrackerMountsProbe.java')],{maxBuffer:1<<24});
const {stdout}=await exec('java',['-cp',cp,'TrackerMountsProbe'],{maxBuffer:1<<28});
const lines=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l));
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={my:'EntityTrackerEntry',hx:'S1BPacketEntityAttach',sa:'Entity',sv:'EntityLivingBase',sw:'EntityLiving',wg:'EntityChicken',wo:'EntityPig',yq:'EntityZombie',yl:'EntitySkeleton',yn:'EntitySpider',bjb:'NetHandlerPlayClient'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',
 classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Executed: the unchanged EntityTrackerEntry (my) for a mount and a rider, the client copies (EntityPig, EntityChicken, EntitySpider, EntityZombie, EntitySkeleton) with Entity.mountEntity, Entity.updateRidden, Entity.updateRiderPosition, EntityChicken.updateRiderPosition, EntityLiving.setLeashedToEntity/clearLeashed and onUpdate, on a client world double. Bytecode-read: NetHandlerPlayClient.handleEntityAttach (bjb.a(hx)) dispatch, the world update order (mount, then rider through updateRidden), and the tracker sending S1B(1) at setLeashedToEntity/clearLeashed.',
 attachRule:'EntityTrackerEntry.sendLocationToAllClients: S1B(0, entity, entity.ridingEntity) when ridingEntity differs from the last one sent (field w, null at the start) or while riding every 60th tick (ticks % 60 == 0); tryStartWachingThis sends S1B(0) when riding and S1B(1) when an EntityLiving is leashed. Both are bytecode-read from my.',
 cases:Object.fromEntries(lines.map(l=>[l.case,l]))};
await writeFile(path.join(root,'../public/research/tracker-mounts-reference.json'),JSON.stringify(reference)+'\n');
console.log('tracker mounts:',lines.map(l=>l.case+'='+l.n).join(' '));
