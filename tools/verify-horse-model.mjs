// Records the unchanged ModelHorse (bhs) setLivingAnimations on a real EntityHorse (tools/probes/HorseModelProbe.java) in public/research/horse-model-reference.json;
// src/horse-model-b56.test.js replays it against src/horse-model.js. Same JDK and library JARs as tools/verify-horse-rear.mjs.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'horse-model-probe');
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
await exec('javac',['-nowarn','-cp',cp,'-d',probe,...['MobMoveProbe','ModelProbe','HorseProbe','VillagerProbe','ServerPlayerProbe','HorseRearProbe','HorseModelProbe'].map(n=>path.join(root,`probes/${n}.java`))]);
const {stdout}=await exec('java',['-cp',cp,'HorseModelProbe'],{maxBuffer:1<<28});
const rows=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l));
const pose=rows.filter(r=>r.case==='pose'),tail=rows.filter(r=>r.case==='tail');
assert.equal(pose.length,240);assert.equal(tail.length,1);
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',
 method:'Unchanged bhs (ModelHorse). One model instance for all rows (state carries over between rows as in RenderHorse), a real wi (EntityHorse) per row on a client world double with flags 4 (saddled) and 8 (chested), growing age, rider (wi.l), the yaw / pitch / ticksExisted fields and the animation counters bJ..bO / bp written; bhs.a(sv, limbSwing, limbSwingAmount, partial) called; the (c d e f g h) of every ModelRenderer part read back. `tail`: the real wi.h() on a client world double with a logging java.util.Random as the horse\'s own Entity.rand, 600 ticks, every draw (bound:result) and bp per tick. Replayed by src/horse-model-b56.test.js.',
 pose,tail:tail[0]};
await writeFile(path.join(root,'../public/research/horse-model-reference.json'),JSON.stringify(reference)+'\n');
console.log('horse model reference: pose='+pose.length+' tail seed='+tail[0].seed+' hits='+tail[0].hits);
