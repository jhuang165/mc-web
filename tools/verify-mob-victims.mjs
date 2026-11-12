// Batch 51 (mobvictims, tag b51mv): records the real EntitySkeleton (normal and wither), EntityPigZombie (anger, call for help) and EntityWither (Invul phase, armoured half, undead attackers) as victims of the 22 b50mr DamageSources, armour, Resistance and absorption (tools/probes/MobVictimProbe.java); src/mob-victims-b51.test.js replays it.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'mobvictim-probe');
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
await exec('javac',['-nowarn','-cp',cp,'-d',probe,...['MobMoveProbe','ChickenProbe','DifficultyProbe','SuffocationProbe','PlayerDamageProbe','ArmorEnchantmentProbe','ArmorSourceProbe','MobResistProbe','MobVictimProbe'].map(n=>path.join(root,`probes/${n}.java`)),path.join(root,'probes/held/com/mojang/authlib/GameProfile.java')],{maxBuffer:1<<24});
const {stdout,stderr}=await exec('java',['-cp',cp,'MobVictimProbe'],{maxBuffer:1<<28});if(process.env.MR_DEBUG)console.error(stderr.split('\n').filter(l=>!/^20/.test(l)).slice(0,15).join('\n'));
const records=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(JSON.parse);
assert.ok(records.length>=1500,'probe output');
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={yz:'EntityPlayer',mw:'EntityPlayerMP',ro:'DamageSource',sv:'EntityLivingBase',aei:'EnumAction',adb:'Item'};
const reference={tag:'b51mv',target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Batch 51 (mobvictims, b51mv): the PlayerDamageProbe double runs the unchanged attackEntityFrom on a real EntitySkeleton (yl, type 0 and 1), EntityPigZombie (yh) and EntityWither (xc) for the 22 DamageSources of b50mr, with armour, Resistance and absorption (skeleton, wither skeleton, pigman), the wither at Invul 220 / 1 / 0 and health 100 / 300 / 151 / 150 / 20 with undead (zombie) and non-undead (spider) attackers, two hits inside the hurt window, and the pigman call for help with neighbours at 6, 31, 36 and 36 blocks. Each step records accepted, health, absorption (sv.bs), hurtResistantTime, hurtTime, lastDamage, getAITarget, entityToAttack, the pigman anger level, the wither Invul, armoured state, bv and bu.',records};
await writeFile(path.join(root,'../public/research/mob-victims-reference.json'),JSON.stringify(reference)+'\n');
console.log('Armor source records:',records.length);
