// Batch 96 entnbt96: what a real EntityPlayerMP writes (tools/probes/Entnbt96Probe.java) -> public/research/entnbt96-reference.json; src/entnbt96-b95.test.js replays it.
// Run: MC_RESEARCH=<tools/research dir> node tools/verify-entnbt96.mjs
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'entnbt96-probe');
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
const cp=[probe,classes,...libs,jar].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,...['MobMoveProbe','ServerPlayerProbe','LevelDatProbe','Entnbt96Probe'].map(n=>path.join(root,`probes/${n}.java`))],{maxBuffer:1<<24});
const {stdout,stderr}=await exec('java',['-cp',cp,'Entnbt96Probe'],{maxBuffer:1<<28});
if(stderr.trim())console.error(stderr.trim().split('\n').slice(0,5).join('\n'));
const rows=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l));
const keep=new Set(['Attributes','ActiveEffects','Motion','AttackTime','SleepTimer','Sleeping','HurtTime']);
const slim=o=>(o||'').split(';').filter(x=>keep.has(x.split('=')[0])).join(';');
const players=rows.filter(r=>r.name&&r.stage).map(({name,stage,live,out})=>({name,stage,live,out:slim(out)})),errors=rows.filter(r=>r.name&&r.error).map(({name,stage,error})=>({name,stage,error})),potions=rows.filter(r=>r.potion).map(({potion,amp,attrs,absorption})=>({potion,amp,attrs,absorption}));
console.log(players.length,potions.length,errors.length);assert.ok(players.length>100&&potions.length>=40);
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',method:'Executed on the unchanged 1.7.10 classes (tools/probes/Entnbt96Probe.java): a real EntityPlayerMP (ServerPlayerProbe.make) loaded with Entity.readFromNBT or given effects with addPotionEffect, ticked with EntityLivingBase.onEntityUpdate (sv.C) and written with Entity.writeToNBT. players: [name, stage, live fields, kept keys of the written compound]; potions: the Attributes list after applying each potion at amplifier 0 and 2. A sleeping load runs on a WorldServer double with one bed block; EntityPlayer.onUpdate (the awake SleepTimer count) is bytecode-read only.',players,potions,errors};
await writeFile(path.join(root,'../public/research/entnbt96-reference.json'),JSON.stringify(reference)+'\n');
console.log(players.length+' rows, '+potions.length+' potions, '+errors.length+' errors');
