// Records the unchanged 1.7.10 player hurt rules for PLAYER-01 (hurt-window top-ups and their events, spawn protection and Creative against every
// DamageSource including the outOfWorld exception, the void below y -64, and CombatTracker death messages); see PlayerDamageProbe.java.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'player-damage-probe');
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
await exec('javac',['-nowarn','-cp',cp,'-d',probe,...['MobMoveProbe','ChickenProbe','DifficultyProbe','SuffocationProbe','PlayerDamageProbe'].map(n=>path.join(root,`probes/${n}.java`))],{maxBuffer:1<<24});
const {stdout,stderr}=await exec('java',['-cp',cp,'PlayerDamageProbe'],{maxBuffer:1<<28});
if(stderr.trim())console.error(stderr.trim());
const records=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(JSON.parse);
const count=c=>records.filter(r=>r.case===c).length;
const counts=Object.fromEntries(['hits','protection','void'].map(c=>[c,count(c)]));console.log(counts);
assert.ok(counts.hits>=30&&counts.protection>=70&&counts.void>=9,'probe output');
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={sa:'Entity',sv:'EntityLivingBase',yz:'EntityPlayer',mw:'EntityPlayerMP',ro:'DamageSource',rp:'EntityDamageSource',rn:'CombatTracker',rm:'CombatEntry',fr:'ChatComponentTranslation',blk:'EntityPlayerSP',bdc:'GuiGameOver'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Unchanged original classes on the SuffocationProbe world double (Normal, air everywhere). The player is the real EntityPlayerMP (stub server, profile name Player); its onDeath records only CombatTracker.func_151521_b, the message it broadcasts first. hits: attackEntityFrom calls before the tick, then the tick (player: --field_147101_bU and --hurtResistantTime, then sv.C; zombie: sv.C); events are World.setEntityState statuses, playSoundAtEntity (sound) and playSoundToNearExcept (except). protection: one 4.0 hit per DamageSource. void: Entity.onEntityUpdate at a fixed posY. Not run: client classes; EntityPlayerSP.setPlayerSPHealth (blk.n) and EntityLivingBase.handleHealthUpdate (sv.a(B)) were read with javap (see combat.md).',records};
await writeFile(path.join(root,'../public/research/player-damage-reference.json'),JSON.stringify(reference)+'\n');
console.log('Original player damage records:',records.length);
