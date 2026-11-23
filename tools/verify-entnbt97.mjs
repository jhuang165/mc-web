// Batch 97 entnbt97: what a real EntityPlayerMP and mob edge values write (tools/probes/Entnbt97Probe.java, Entnbt97MobProbe.java) -> public/research/entnbt97-reference.json; src/entnbt97-b97.test.js replays it.
// Run: MC_RESEARCH=<tools/research dir> node tools/verify-entnbt97.mjs
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'entnbt97-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function library(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const dir of [path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries'),path.join(os.homedir(),'.gradle/caches')]){
  if(!await exists(dir))continue;const {stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24});const hit=stdout.split('\n').filter(Boolean).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs=await Promise.all(['guava-','log4j-api-','log4j-core-','commons-lang3-','authlib-1.5','netty-all-','gson-','commons-io-','commons-codec-','jopt-simple-'].map(library));
const classes=path.join(out,'classes');
if(!await exists(path.join(classes,'bu.class'))){await mkdir(classes,{recursive:true});await exec('unzip',['-q','-o',jar,'*.class','-d',classes],{maxBuffer:1<<24});}
const probe=path.join(out,'probe');await mkdir(probe,{recursive:true});
const mobNames=['MobMoveProbe','ChickenProbe','ModelProbe','HorseProbe','CreeperProbe','MobNbtProbe','DifficultyProbe','SuffocationProbe','PlayerDamageProbe','CmdChatProbe','CmdArgsProbe','CmdExec83Probe','Summon86Probe','Summon87Probe','Entnbt94Probe','Entnbt97MobProbe'];
const cp=[probe,classes,...libs,jar].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,...['MobMoveProbe','ServerPlayerProbe','LevelDatProbe','Entnbt96Probe','Entnbt97Probe'].map(n=>path.join(root,`probes/${n}.java`))],{maxBuffer:1<<24});
const {stdout,stderr}=await exec('java',['-cp',cp,'Entnbt97Probe'],{maxBuffer:1<<28});
if(stderr.trim())console.error(stderr.trim().split('\n').slice(0,5).join('\n'));
const rows=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l));
await exec('javac',['-nowarn','-cp',cp,'-d',probe,...mobNames.map(n=>path.join(root,`probes/${n}.java`))],{maxBuffer:1<<24});
const mob=await exec('java',['-cp',cp,'Entnbt97MobProbe'],{maxBuffer:1<<28});
const mobJson=JSON.parse(mob.stdout.trim().split('\n').filter(l=>l.startsWith('{"edge"'))[0]),edge=mobJson.edge,leashTicks=mobJson.leashTicks;
const keep=new Set(['Attributes','Motion','SleepTimer','HealF','Health','AbsorptionAmount','foodLevel','foodSaturationLevel','foodExhaustionLevel','foodTickTimer','XpP','XpLevel','XpTotal','Score','abilities','playerGameType']);
const slim=o=>(o||'').split(';').filter(x=>keep.has(x.split('=')[0])).join(';');
const players=rows.filter(r=>r.name).map(r=>r.error?{name:r.name,stage:r.stage,error:r.error}:r.stage?{name:r.name,stage:r.stage,live:r.live,out:slim(r.out)}:{name:r.name,out:slim(r.out),re:slim(r.re)});
console.log(players.length,edge.length);assert.ok(players.length>120&&edge.length>90);
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',method:'Executed on the unchanged 1.7.10 classes. players (tools/probes/Entnbt97Probe.java): a real EntityPlayerMP loaded from richPlayer plus one edit (Entity.readFromNBT / EntityPlayer.readEntityFromNBT) and written with Entity.writeToNBT: [name, kept keys written, kept keys after a second player reloads that]; stage rows tick with EntityLivingBase.onEntityUpdate. edge (tools/probes/Entnbt97MobProbe.java): [name, /summon tag, written compound, after reload, written hex] as entnbt94-reference.json.',players,edge,leashTicks};
await writeFile(path.join(root,'../public/research/entnbt97-reference.json'),JSON.stringify(reference)+'\n');
console.log(players.length+' player rows, '+edge.length+' mob rows');
