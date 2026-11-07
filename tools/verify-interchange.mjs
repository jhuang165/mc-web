// Records InterchangeProbe (spider jockey skeleton gear, leader zombie/pigman Attributes) and InterchangeMountProbe (more player mounts) from the
// unchanged 1.7.10 classes into public/research/interchange-reference.json; src/interchange.test.js replays it. Needs a JDK and the research folder.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'interchange-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function library(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const dir of [path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries'),path.join(os.homedir(),'.gradle/caches')]){
  if(!await exists(dir))continue;const {stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24});const hit=stdout.split('\n').filter(Boolean).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs=await Promise.all(['guava-','log4j-api-','commons-lang3-','authlib-','commons-io-','gson-','netty-'].map(library));
const classes=path.join(out,'classes');await rm(classes,{recursive:true,force:true});await mkdir(classes,{recursive:true});
await exec('unzip',['-q','-o',jar,'*.class','assets/minecraft/lang/en_US.lang','-d',classes],{maxBuffer:1<<24});
const probe=path.join(out,'probe');await mkdir(probe,{recursive:true});
const cp=[probe,classes,...libs].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,...['MobMoveProbe','ChickenProbe','DifficultyProbe','EquipmentProbe','LevelDatProbe','PlayerRidingProbe','InterchangeProbe','InterchangeMountProbe'].map(n=>path.join(root,`probes/${n}.java`))],{maxBuffer:1<<24});
const run=async c=>(await exec('java',['-cp',cp,c],{maxBuffer:1<<28})).stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l));
const records=[...await run('InterchangeProbe'),...await run('InterchangeMountProbe')];
const counts={};for(const r of records)counts[r.case]=(counts[r.case]||0)+1;
console.log(counts);
assert.equal(counts.spiderJockeyGearUnrecovered??0,0,'every jockey skeleton seed recovered');
assert.ok(counts.spiderJockeyGear>=120&&counts.leader>=40&&counts.playerRiding===7);
assert.ok(records.some(r=>r.case==='leader'&&r.leader));
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={sa:'Entity',yn:'EntitySpider',yq:'EntityZombie',yh:'EntityPigZombie',yl:'EntitySkeleton',sg:'EntityList',tj:'AttributeModifier'};
await writeFile(path.join(root,'../public/research/interchange-reference.json'),JSON.stringify({target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',counts,
 classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Unchanged original classes (tools/probes/InterchangeProbe.java, InterchangeMountProbe.java). spiderJockeyGear: yn.a(sy) spawns the rider skeleton with its own unseeded Entity.rand; the probe recovers the skeleton Random seed by running its LCG backwards from the post-call state until a replay of yl.a(sy) with a counting Random reproduces the draw count, final state and gear. leader: yq/yh.a(sy) at maximum local difficulty, the sa.e NBT (Attributes with Modifiers) and the sa.f read-back. playerRiding: PlayerRidingProbe.run on more mounts.',records})+'\n');
console.log('interchange reference:',records.length,'records');
