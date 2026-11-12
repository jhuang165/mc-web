// Batch 49 (firearmor, tag b49fa): records which of armour, Resistance, enchantment protection, absorption and exhaustion each DamageSource goes through on the real EntityPlayerMP (tools/probes/ArmorSourceProbe.java); src/fire-armor-b49.test.js replays it.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'armorsource-probe');
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
await exec('javac',['-nowarn','-cp',cp,'-d',probe,...['MobMoveProbe','ChickenProbe','DifficultyProbe','SuffocationProbe','PlayerDamageProbe','ArmorEnchantmentProbe','ArmorSourceProbe'].map(n=>path.join(root,`probes/${n}.java`)),path.join(root,'probes/held/com/mojang/authlib/GameProfile.java')],{maxBuffer:1<<24});
const {stdout}=await exec('java',['-cp',cp,'ArmorSourceProbe'],{maxBuffer:1<<28});
const records=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(JSON.parse);
assert.ok(records.length>=650,'probe output');
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={yz:'EntityPlayer',mw:'EntityPlayerMP',ro:'DamageSource',sv:'EntityLivingBase',aei:'EnumAction',adb:'Item'};
const reference={tag:'b49fa',target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Batch 49 (firearmor, b49fa): the PlayerDamageProbe double (real EntityPlayerMP, Normal difficulty) runs the unchanged attackEntityFrom (sv.a) for 21 DamageSources (inFire, onFire, lava, inWall, drown, starve, cactus, fall, outOfWorld, generic, magic, wither, anvil, fallingBlock, mob, arrow, fireball, thrown, indirectMagic, thorns, explosion) at amounts 1 and 6, with leather, iron or diamond armour (boots first), Protection, Fire Protection, Feather Falling, Blast Protection or Projectile Protection on every piece, the Resistance potion (amplifier 0, 1, 4), and absorption hearts. EnchantmentHelper.a (static Random) is seeded per record. armor = each piece damage after (null: no piece); exhaustion = FoodStats exhaustion the hit added; absorbed = absorption hearts left. Not run: causePlayerDamage (the double refuses a player attacker with PvP off), bytecode-read as the flag-free mob source.',records};
await writeFile(path.join(root,'../public/research/armor-source-reference.json'),JSON.stringify(reference)+'\n');
console.log('Armor source records:',records.length);
