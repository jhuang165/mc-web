// Batch 91 mobpackets91: records tools/probes/MobPackets91Probe.java (the unchanged EntityTrackerEntry sending a cow's head turn, S1C, S20 and knockback S12 in one gated pass) in
// public/research/mobpackets91-reference.json. Same jar lookup as the other verify-*.mjs tools.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'mobpackets91-probe');
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
await exec('javac',['-nowarn','-cp',cp,'-d',probe,...['MobMoveProbe','ChickenProbe','TrackerProbe','TrackerItemsProbe','TrackerExtrasProbe','MobPackets91Probe'].map(n=>path.join(root,`probes/${n}.java`))],{maxBuffer:1<<24});
const {stdout}=await exec('java',['-cp',cp,'MobPackets91Probe'],{maxBuffer:1<<28});
const rec=JSON.parse(stdout.trim().split('\n').filter(l=>l.startsWith('{'))[0]);
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={my:'EntityTrackerEntry',sv:'EntityLivingBase',sa:'Entity',wh:'EntityCow',hy:'S12PacketEntityVelocity',ht:'S19PacketEntityHeadLook',hw:'S1CPacketEntityMetadata',ik:'S18PacketEntityTeleport'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',
 classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Executed: the unchanged EntityTrackerEntry (my) tracking a real EntityCow on a world double (TrackerItemsProbe.run). At tick 10 the head turns 90 degrees, velocityChanged is set and Speed is added; at 20 only velocityChanged; at 30 only the head. rows are [tick, packets the entry sent in order]. Bytecode-read: S12 is `my.b(new hy(entity))` at 1277, after the head S19 (ht at 1227) and the S1C / S20 pass (my.b() at 1188).',
 case:rec};
await writeFile(path.join(root,'../public/research/mobpackets91-reference.json'),JSON.stringify(reference)+'\n');
console.log('mobpackets91:',rec.rows.map(r=>r[0]+':'+r[1].map(p=>p[0]).join('>')).join(' | '));
