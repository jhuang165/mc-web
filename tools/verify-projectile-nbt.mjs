// Records the chunk-save NBT of the in-flight projectiles (tools/probes/ProjectileNbtProbe.java) in
// public/research/projectile-nbt-reference.json and the creeper Fuse/ExplosionRadius behaviour (tools/probes/CreeperNbtProbe.java)
// in public/research/creeper-nbt-reference.json, on the unchanged original classes; src/projectile-nbt.test.js checks them.
// Needs the same JDK, client JAR and library JARs as tools/verify-mob-nbt.mjs.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const PROJECTILE_RECORDS=31;const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'projectile-nbt-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function library(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const dir of [path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries'),path.join(os.homedir(),'.gradle/caches')]){
  if(!await exists(dir))continue;const {stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24});const hit=stdout.split('\n').filter(Boolean).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs=await Promise.all(['guava-','log4j-api-','commons-lang3-','authlib-','commons-io-','gson-'].map(library));
const classes=path.join(out,'classes');await rm(classes,{recursive:true,force:true});await mkdir(classes,{recursive:true});
await exec('unzip',['-q','-o',jar,'*.class','assets/minecraft/lang/en_US.lang','-d',classes],{maxBuffer:1<<24});
const probe=path.join(out,'probe');await mkdir(probe,{recursive:true});
const cp=[probe,classes,...libs].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,...['MobMoveProbe','ModelProbe','HorseProbe','ChickenProbe','CreeperProbe','MobNbtProbe','ProjectileNbtProbe','CreeperNbtProbe'].map(n=>path.join(root,`probes/${n}.java`))]);
const run=async main=>(await exec('java',['-cp',cp,main],{maxBuffer:1<<28})).stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l));
const projectiles=(await run('ProjectileNbtProbe')).filter(l=>l.case==='projectile'),creepers=(await run('CreeperNbtProbe')).filter(l=>l.case==='creeperNbt');
assert.equal(projectiles.length,PROJECTILE_RECORDS,'projectile records');assert.equal(creepers.length,9,'creeper records');
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const describe=async names=>Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}])));
const base={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6'};
await writeFile(path.join(root,'../public/research/projectile-nbt-reference.json'),JSON.stringify({...base,classes:await describe({sg:'EntityList',sa:'Entity',zk:'EntityThrowable',zj:'EntitySnowball',zl:'EntityEgg',zm:'EntityEnderPearl',zo:'EntityPotion',zn:'EntityExpBottle',zc:'EntityArrow',ze:'EntityFireball',zg:'EntityLargeFireball',zi:'EntitySmallFireball',zp:'EntityWitherSkull',zd:'EntityEnderEye',zf:'EntityFireworkRocket',xe:'EntityFishHook'}),
 method:'Unchanged original classes on the HorseProbe/MobMoveProbe world double (tools/probes/ProjectileNbtProbe.java). Each projectile is built with its constructor at (100.5, 64, -20.25) with motion (0.25, -0.5, 1), yaw 37.5, pitch -12.25, and saved with Entity.writeToNBTOptional (sa.c; false for a class without an EntityList id). Named keys of that tag are edited ("in" is the edited tag) and it is loaded with EntityList.createEntityFromNBT (sg.a). nbt is the loaded entity saved again (uncompressed hex); the other fields are its Entity fields.',projectiles})+'\n');
await writeFile(path.join(root,'../public/research/creeper-nbt-reference.json'),JSON.stringify({...base,classes:await describe({sg:'EntityList',xz:'EntityCreeper',agw:'Explosion'}),
 method:'Unchanged EntityCreeper loaded by EntityList.createEntityFromNBT from a saved creeper with named keys edited (tools/probes/CreeperNbtProbe.java on the CreeperProbe world double). fuse/radius are the fields br/bs after loading. ticks run xz.h with the swell state held at 1 until the explosion (no AI); explosion is the createExplosion call [x, y, z, size, smoking]. falls are timeSinceIgnited after xz.b(F).',creepers})+'\n');
console.log('projectile nbt reference:',projectiles.length,'records;',creepers.length,'creeper records');
