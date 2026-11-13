// Batch 63 (mppvp): EntityPlayer.attackTargetEntityWithCurrentItem on a real EntityPlayerMP victim, run by a real EntityPlayerMP attacker (tools/probes/PvpAttackProbe.java); src/pvp-b63.test.js replays it.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'pvp-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function library(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const dir of [path.join(research,'libs-1.7.10'),path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries'),path.join(os.homedir(),'.gradle/caches')]){
  if(!await exists(dir))continue;const {stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24});const hit=stdout.split('\n').filter(Boolean).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
// authlib is replaced by probes/held/com/mojang/authlib/GameProfile.java (only the profile constructor is used).
const libs=await Promise.all(['guava-','log4j-api-','log4j-core-','commons-lang3-','netty-all-','gson-','commons-io-','commons-codec-','jopt-simple-'].map(library));
const classes=path.join(out,'classes');await rm(out,{recursive:true,force:true});await mkdir(classes,{recursive:true});
await exec('unzip',['-q','-o',jar,'*.class','-d',classes],{maxBuffer:1<<24});
const probe=path.join(out,'probe');await mkdir(probe,{recursive:true});
const cp=[probe,classes,...libs,jar].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,...['MobMoveProbe','ChickenProbe','DifficultyProbe','SuffocationProbe','PlayerDamageProbe','ArmorEnchantmentProbe','ArmorSourceProbe','MobResistProbe','PvpAttackProbe'].map(n=>path.join(root,`probes/${n}.java`)),path.join(root,'probes/held/com/mojang/authlib/GameProfile.java')],{maxBuffer:1<<24});
const {stdout,stderr}=await exec('java',['-cp',cp,'PvpAttackProbe'],{maxBuffer:1<<28});if(process.env.MR_DEBUG)console.error(stderr.split('\n').filter(l=>!/^20/.test(l)).slice(0,15).join('\n'));
const records=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(JSON.parse);
assert.ok(records.length>=60,'probe output');
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={yz:'EntityPlayer',mw:'EntityPlayerMP',ro:'DamageSource',sv:'EntityLivingBase',afv:'EnchantmentHelper'};
const reference={tag:'b63pvp',target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Batch 63 (mppvp): the PlayerDamageProbe double runs the unchanged EntityPlayer.attackTargetEntityWithCurrentItem (yz.r) with a real EntityPlayerMP attacker (held stack in slot 0 with its attribute modifiers applied, optional sprint flag, falling state, yaw) against a real EntityPlayerMP victim (PvP enabled on the server double, no spawn protection, Normal difficulty). hits are applied in order in one tick (hurt window); results lists the victim health after each, the victim hurtResistantTime before (hitWindow) and after (resist), the weapon damage after; victimMotion/attackerMotion are motionX/Y/Z and motionX/Z; armor = the victim armour pieces damage; death is the CombatTracker message when the victim died. EnchantmentHelper.a (static Random) is seeded per record.',records};
await writeFile(path.join(root,'../public/research/pvp-reference.json'),JSON.stringify(reference)+'\n');
console.log('PvP records:',records.length);
