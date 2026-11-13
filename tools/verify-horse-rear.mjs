// Records the client copy of a ridden EntityHorse (wi.e(F,F), wi.ac() on a client world double, tools/probes/HorseRearProbe.java) in
// public/research/horse-rear-reference.json; src/horse-rear-b55.test.js checks the browser port against it. Needs the same JDK and library JARs as tools/verify-horse.mjs.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'horse-rear-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function library(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const dir of [path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries'),path.join(os.homedir(),'.gradle/caches')]){
  if(!await exists(dir))continue;const {stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24});const hit=stdout.split('\n').filter(Boolean).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs=await Promise.all(['guava-','log4j-api-','commons-lang3-','authlib-','netty-buffer-','netty-common-','netty-codec-','netty-transport-4','netty-handler-4','netty-resolver-4','gson-','commons-io-','commons-codec-'].map(library));
const classes=path.join(out,'classes');await rm(classes,{recursive:true,force:true});await mkdir(classes,{recursive:true});
await exec('unzip',['-q','-o',jar,'*.class','assets/minecraft/lang/en_US.lang','-d',classes],{maxBuffer:1<<24});
const probe=path.join(out,'probe');await mkdir(probe,{recursive:true});
const cp=[probe,classes,...libs].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(root,'probes/MobMoveProbe.java'),path.join(root,'probes/ModelProbe.java'),path.join(root,'probes/HorseProbe.java'),path.join(root,'probes/VillagerProbe.java'),path.join(root,'probes/ServerPlayerProbe.java'),path.join(root,'probes/HorseRearProbe.java')]);
const {stdout}=await exec('java',['-cp',cp,'HorseRearProbe'],{maxBuffer:1<<28});
const lines=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l));
const pick=name=>lines.filter(l=>l.case===name);
assert.equal(pick('anim').length,3);assert.equal(pick('copy').length,3);assert.equal(pick('buck').length,14);
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',
 method:'Unchanged wi (EntityHorse). anim and copy: wi.h() (onUpdate) on a client world double (ahb.E true) with a client chunk provider that answers a loaded chunk (apx.d), flags of watcher 16 written between ticks. buck: a real EntityPlayerMP (ServerPlayerProbe) mounted on a wild horse, the unchanged vg.e() until it bucks, and mountEntity(null) called directly (yz.a(sa) -> sv.m(sa) dismountEntity), stone cells around the horse. src/horse-rear-b55.test.js replays it.',
 anim:pick('anim'),copy:pick('copy'),buck:pick('buck')};
await writeFile(path.join(root,'../public/research/horse-rear-reference.json'),JSON.stringify(reference)+'\n');
console.log('horse rear reference: anim=3 copy=3 buck=14');
