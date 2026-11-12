// Batch 50 (mobresist, tag b50mr): records which of armour, Resistance, enchantment protection and absorption each DamageSource goes through on the real EntityZombie, and player-attacker hits on the real EntityPlayerMP with PvP on (tools/probes/MobResistProbe.java); src/mob-resist-b50.test.js replays it.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'mobresist-probe');
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
await exec('javac',['-nowarn','-cp',cp,'-d',probe,...['MobMoveProbe','ChickenProbe','DifficultyProbe','SuffocationProbe','PlayerDamageProbe','ArmorEnchantmentProbe','ArmorSourceProbe','MobResistProbe'].map(n=>path.join(root,`probes/${n}.java`)),path.join(root,'probes/held/com/mojang/authlib/GameProfile.java')],{maxBuffer:1<<24});
const {stdout,stderr}=await exec('java',['-cp',cp,'MobResistProbe'],{maxBuffer:1<<28});if(process.env.MR_DEBUG)console.error(stderr.split('\n').filter(l=>!/^20/.test(l)).slice(0,15).join('\n'));
const records=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(JSON.parse);
assert.ok(records.length>=700,'probe output');
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={yz:'EntityPlayer',mw:'EntityPlayerMP',ro:'DamageSource',sv:'EntityLivingBase',aei:'EnumAction',adb:'Item'};
const reference={tag:'b50mr',target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Batch 50 (mobresist, b50mr): the PlayerDamageProbe double runs the unchanged attackEntityFrom (sv.a) on a real EntityZombie (yq: natural armour 2) for 22 DamageSources (the 21 of b49fa plus causePlayerDamage) at amounts 1 and 6, with leather, iron or diamond armour in the four armour slots, Protection, Fire Protection, Feather Falling, Blast Protection or Projectile Protection on every piece, the Resistance potion (0, 1, 4) and absorption hearts (sv.m). The player rows run the same on the real EntityPlayerMP with PvP enabled on the server double, for a player attacker and a mob attacker. EnchantmentHelper.a (static Random) is seeded per record. armor = each armour piece damage after; absorbed = absorption hearts left (sv.bs).',records};
await writeFile(path.join(root,'../public/research/mob-resist-reference.json'),JSON.stringify(reference)+'\n');
console.log('Armor source records:',records.length);
