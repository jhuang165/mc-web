// Batch 79 executed checks (tools/probes/SpExec79Probe.java): a calf with a bowl, ender pearl flights through water and lava, a dispenser's fire charge on a server and a client world, on the unchanged 1.7.10 classes.
// Requires the pinned 1.7.10 JAR, JDK and probe libraries; writes public/research/spexec79-reference.json, replayed by src/spexec79-b79.test.js.
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false),researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'spexec79-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function library(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const dir of [path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries'),path.join(os.homedir(),'.gradle/caches'),path.join(research,'libs-1.7.10')]){
  if(!await exists(dir))continue;const {stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24}),hit=stdout.split('\n').filter(f=>/^\d/.test(path.basename(f).slice(prefix.length))).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs=await Promise.all(['guava-','log4j-api-','commons-lang3-','netty-buffer-','netty-common-','netty-transport-','netty-codec-','netty-handler-','netty-resolver-','gson-'].map(library)),classes=path.join(out,'classes');
await rm(classes,{recursive:true,force:true});await mkdir(classes,{recursive:true});await exec('unzip',['-q','-o',jar,'*.class','-d',classes],{maxBuffer:1<<24});
const probe=path.join(out,'probe');await rm(probe,{recursive:true,force:true});await mkdir(probe,{recursive:true});
await writeFile(path.join(probe,'GameProfile.java'),'package com.mojang.authlib; public class GameProfile {}\n');
// Stubs only so that net.minecraft.client.Minecraft (bao) can be allocated without running its constructor (the sound chain record)
const stubs=[['org/lwjgl/opengl','DisplayMode','public DisplayMode(int w,int h){}'],['org/lwjgl/opengl','OpenGLException'],['org/lwjgl','LWJGLException'],['com/mojang/authlib','GameProfileRepository'],['com/mojang/authlib/minecraft','MinecraftSessionService'],['com/mojang/authlib/yggdrasil','YggdrasilAuthenticationService']];
for(const [pkg,name,body] of stubs){const ext=name.endsWith('Exception')?'RuntimeException':'';{await mkdir(path.join(probe,'stubs',pkg),{recursive:true});await writeFile(path.join(probe,'stubs',pkg,name+'.java'),`package ${pkg.replaceAll('/','.')}; public class ${name}${ext?' extends '+ext:''} {${body||''}}\n`);}}
const cp=[probe,classes,...libs].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(probe,'GameProfile.java'),...stubs.map(([pkg,name])=>path.join(probe,'stubs',pkg,name+'.java')),...['MobMoveProbe','PlantProbe','DoorPaneProbe','BedProbe','ClientPredictProbe','SoundSweepProbe','SpSounds76Probe','SpSounds77Probe','ChickenProbe','DifficultyProbe','CombatProbe','MobSpawnerProbe','WitchProbe','ModelProbe','SlimeProbe','MooshroomGolemProbe','SpExec78Milk','SpExec78Jukebox','SpExec78Probe','DispenseProbe','SpDispense77Probe','SpExec79Probe'].map(n=>path.join(root,`probes/${n}.java`)),path.join(root,'probes/netty-doubles/io/netty/util/AttributeKey.java')],{maxBuffer:1<<24});
const {stdout}=await exec('java',['-cp',cp,'SpExec79Probe',process.argv[2]||'all'],{maxBuffer:1<<28}),records=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l));
if(process.argv[2]){console.log(stdout);process.exit(0);}
assert.ok(records.length>=90,'record count '+records.length);
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const classNames={zk:'EntityThrowable',zm:'EntityEnderPearl',zi:'EntitySmallFireball',ze:'EntityFireball',wh:'EntityCow',wm:'EntityMooshroom',akm:'BlockDispenser',kz:'BehaviorFireCharge',sa:'Entity'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(classNames).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'tools/probes/SpExec79Probe.java (SpExec78Milk, DispenseProbe and SpDispense77Probe doubles) on the unchanged classes: EntityCow / EntityMooshroom.interact with a bowl held by a calf; EntityThrowable.onUpdate of an ender pearl flying through still and flowing water and lava over a stone floor with a connected owner; BlockDispenser.updateTick with a fire charge on every facing, on a server and a client world, then the fireball updated three times.',
 records};
const file=path.join(root,'../public/research/spexec79-reference.json');await writeFile(file,JSON.stringify(reference)+'\n');
console.log(`spexec79 records: ${records.length}, ${(await readFile(file)).length} bytes`);
