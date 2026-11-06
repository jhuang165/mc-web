// Records player knockback, and potion attribute values, from the unchanged 1.7.10 classes (tools/probes/PlayerKnockbackProbe.java) in
// public/research/player-knockback-reference.json; src/player-knockback.test.js replays it through src/player-knockback.js.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'player-knockback-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function library(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const dir of [path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries'),path.join(os.homedir(),'.gradle/caches')]){
  if(!await exists(dir))continue;const {stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24});const hit=stdout.split('\n').filter(Boolean).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs=await Promise.all(['guava-','log4j-api-','commons-lang3-','authlib-1.5'].map(library));
const classes=path.join(out,'classes');await rm(classes,{recursive:true,force:true});await mkdir(classes,{recursive:true});
await exec('unzip',['-q','-o',jar,'*.class','-d',classes],{maxBuffer:1<<24});
const probe=path.join(out,'probe');await mkdir(probe,{recursive:true});
const cp=[probe,classes,...libs].join(path.delimiter);
try{await exec('javac',['-nowarn','-cp',cp,'-d',probe,...['MobMoveProbe','ChickenProbe','DifficultyProbe','EquipmentProbe','PlayerKnockbackProbe'].map(n=>path.join(root,`probes/${n}.java`))],{maxBuffer:1<<24});}
catch(e){console.error(e.stderr);throw e;}
const {stdout}=await exec('java',['-cp',cp,'PlayerKnockbackProbe'],{maxBuffer:1<<28});
const records=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(JSON.parse);
const count=c=>records.filter(r=>r.case===c).length;
const counts=Object.fromEntries(['melee','golem','arrow','blast','attrs'].map(c=>[c,count(c)]));
console.log(counts);
for(const [c,n] of Object.entries(counts))assert.ok(n>0,c);
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={sv:'EntityLivingBase',yz:'EntityPlayer',yg:'EntityMob',yq:'EntityZombie',wt:'EntityIronGolem',zc:'EntityArrow',agw:'Explosion',ro:'DamageSource',afv:'EnchantmentHelper',rv:'Potion',rw:'PotionEffect'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Unchanged original classes on the DifficultyProbe/EquipmentProbe world double (Difficulty Normal) with a real EntityPlayer (the DifficultyProbe construction). melee: EntityMob.attackEntityAsMob of a zombie (bare hand, sword, Knockback I and II) then a second hit inside the hurt window; offsets are attacker minus player in blocks, motion0 the player motion before, yaw the zombie rotationYaw in degrees. golem: EntityIronGolem.attackEntityAsMob. arrow: EntityArrow.onUpdate flying into the player (Punch 0-2, with and without a shooter entity). blast: Explosion.doExplosionA at the offset with a living exploder and with none. attrs: generic.movementSpeed and generic.attackDamage of the player under the potion effects. The player has 1000 health so that no hit kills (EntityPlayer.onDeath replaces the motion with the death throw, which Survival does not model). Coincident attackers draw Math.random and are not recorded.',records};
await writeFile(path.join(root,'../public/research/player-knockback-reference.json'),JSON.stringify(reference)+'\n');
console.log('Player knockback records:',records.length);
