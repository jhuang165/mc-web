// Records the unchanged 1.7.10 CombatTracker / DamageSource death messages (batch 19 deaths track): a scenario matrix of falls, combat windows,
// fighting-entity choice and every attacker DamageSource, executed natively on the real EntityPlayerMP; see CombatTrackerProbe.java.
// Replayed by src/combat-tracker.test.js (public/research/combat-tracker-reference.json).
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'combat-tracker-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function library(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const dir of [path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries'),path.join(os.homedir(),'.gradle/caches')]){
  if(!await exists(dir))continue;const {stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24});const hit=stdout.split('\n').filter(Boolean).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs=await Promise.all(['guava-','log4j-api-','commons-lang3-','authlib-1.5','netty-all-','gson-','commons-io-','commons-codec-','jopt-simple-'].map(library));
const classes=path.join(out,'classes');await rm(classes,{recursive:true,force:true});await mkdir(classes,{recursive:true});
await exec('unzip',['-q','-o',jar,'*.class','-d',classes],{maxBuffer:1<<24});
const probe=path.join(out,'probe');await mkdir(probe,{recursive:true});
// The JAR itself is last on the class path so LanguageMap loads assets/minecraft/lang/en_US.lang for the messages.
const cp=[probe,classes,...libs,jar].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,...['MobMoveProbe','ChickenProbe','DifficultyProbe','SuffocationProbe','PlayerDamageProbe','CombatTrackerProbe'].map(n=>path.join(root,`probes/${n}.java`))],{maxBuffer:1<<24});
const {stdout,stderr}=await exec('java',['-cp',cp,'CombatTrackerProbe'],{maxBuffer:1<<28});
if(stderr.trim())console.error(stderr.trim());
const records=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l));
assert.ok(records.length>=150,'probe output: '+records.length);
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={sa:'Entity',sv:'EntityLivingBase',yz:'EntityPlayer',mw:'EntityPlayerMP',ro:'DamageSource',rp:'EntityDamageSource',rq:'EntityDamageSourceIndirect',rn:'CombatTracker',rm:'CombatEntry',fr:'ChatComponentTranslation'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Unchanged original classes on the PlayerDamageProbe world double (Normal, air everywhere, en_US.lang loaded from the jar). The victim is the real EntityPlayerMP (profile name Player; PvP enabled on the stub server). Each record is a list of timed ops (see CombatTrackerProbe.java header): hits go through attackEntityFrom so the real EntityLivingBase.damageEntity feeds CombatTracker.func_94547_a; ticksExisted advances per tick and func_94549_h runs every 20 ticks. preview is CombatTracker.func_151521_b after each hit; message is what EntityPlayerMP.onDeath broadcasts on a fatal hit. Messages are ChatComponentTranslation key, argument texts and the localised text.',records};
await writeFile(path.join(root,'../public/research/combat-tracker-reference.json'),JSON.stringify(reference)+'\n');
console.log('Combat tracker records:',records.length);
