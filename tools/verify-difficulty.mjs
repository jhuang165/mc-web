// Records the unchanged 1.7.10 difficulty rules; see DifficultyProbe.java.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'difficulty-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function library(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const dir of [path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries'),path.join(os.homedir(),'.gradle/caches')]){
  if(!await exists(dir))continue;const {stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24});const hit=stdout.split('\n').filter(Boolean).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
// authlib supplies GameProfile for the EntityPlayer constructor.
const libs=await Promise.all(['guava-','log4j-api-','commons-lang3-','authlib-1.5'].map(library));
const classes=path.join(out,'classes');await rm(classes,{recursive:true,force:true});await mkdir(classes,{recursive:true});
await exec('unzip',['-q','-o',jar,'*.class','-d',classes],{maxBuffer:1<<24});
const probe=path.join(out,'probe');await mkdir(probe,{recursive:true});
const cp=[probe,classes,...libs].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,...['MobMoveProbe','ChickenProbe','DifficultyProbe'].map(n=>path.join(root,`probes/${n}.java`))],{maxBuffer:1<<24});
const {stdout}=await exec('java',['-cp',cp,'DifficultyProbe'],{maxBuffer:1<<28});
const records=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(JSON.parse);
const count=c=>records.filter(r=>r.case===c).length;
assert.deepEqual(Object.fromEntries(['local','spider','potion','player','starve','exhaust','zombieHit','zombieSpawn','reinforce'].map(c=>[c,count(c)])),
 {local:256,spider:1800,potion:8,player:224,starve:28,exhaust:12,zombieHit:480,zombieSpawn:2400,reinforce:720});
assert.ok(records.some(r=>r.case==='spider'&&r.effect===14)&&records.some(r=>r.case==='reinforce'&&r.spawned));
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={rd:'EnumDifficulty',ahb:'World',yz:'EntityPlayer',zr:'FoodStats',sv:'EntityLivingBase',sw:'EntityLiving',yn:'EntitySpider',yo:'EntitySpider$GroupData',yq:'EntityZombie',rv:'Potion',rw:'PotionEffect'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Unchanged original classes on the MobMoveProbe/ChickenProbe world double, which supplies one chunk (inhabited time), WorldInfo (world time, game rules), uniform light, a floor below y 0 and a particle log. local: World.func_147462_b. spider: EntitySpider.onSpawnWithEgg(null) with seeded World.rand and Entity.rand. potion: EntityLivingBase.updatePotionEffects for 120 ticks after addPotionEffect(id, MAX_VALUE, amplifier), with the swirls it spawns. player: EntityPlayer.attackEntityFrom up to damageEntity per DamageSource. starve/exhaust: FoodStats.onUpdate with food 0 for 400 ticks, and one exhausted tick at food 10. zombieHit: EntityZombie.attackEntityAsMob with and without fire. zombieSpawn: EntityZombie.onSpawnWithEgg(null) with the reinforcement base set to 0. reinforce: EntityZombie.attackEntityFrom from a spider at 2 blocks, per light level and reinforcement chance.',records};
await writeFile(path.join(root,'../public/research/difficulty-reference.json'),JSON.stringify(reference)+'\n');
console.log('Original difficulty records:',records.length);
