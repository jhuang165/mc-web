// Records the 1.7.10 cape inputs from the unchanged EntityPlayerSP (tools/probes/CapeChaseProbe.java): EntityPlayer.onUpdate's chasing
// position (and cameraYaw / distanceWalkedModified) over scripted position changes, written to public/research/cape-reference.json and
// replayed by src/cape-b70.test.js. Needs the pinned 1.7.10 JAR, a JDK and the probe libraries (see verify-client-predict.mjs).
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false),researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'cape-probe-run');
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
// Stubs only so that net.minecraft.client.Minecraft (bao) can be allocated without running its constructor
const stubs=[['org/lwjgl/opengl','DisplayMode','public DisplayMode(int w,int h){}'],['org/lwjgl/opengl','OpenGLException'],['org/lwjgl','LWJGLException'],['com/mojang/authlib','GameProfileRepository'],['com/mojang/authlib/minecraft','MinecraftSessionService'],['com/mojang/authlib/yggdrasil','YggdrasilAuthenticationService']];
for(const [pkg,name,body] of stubs){const ext=name.endsWith('Exception')?'RuntimeException':'';await mkdir(path.join(probe,'stubs',pkg),{recursive:true});await writeFile(path.join(probe,'stubs',pkg,name+'.java'),`package ${pkg.replaceAll('/','.')}; public class ${name}${ext?' extends '+ext:''} {${body||''}}\n`);}
const cp=[probe,classes,...libs].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(probe,'GameProfile.java'),...stubs.map(([pkg,name])=>path.join(probe,'stubs',pkg,name+'.java')),...['MobMoveProbe','PlantProbe','PlayerStepProbe','CapeChaseProbe'].map(n=>path.join(root,`probes/${n}.java`))],{maxBuffer:1<<24});
const {stdout}=await exec('java',['-cp',cp,'CapeChaseProbe'],{maxBuffer:1<<26}),cases=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l));
assert.equal(cases.length,5);
for(const c of cases)assert.ok(c.data.ticks.length>0&&c.data.ticks.every(t=>!t.error),'probe error '+JSON.stringify(c.data.ticks.find(t=>t.error)));
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={sa:'Entity',sv:'EntityLivingBase',yz:'EntityPlayer',blk:'EntityPlayerSP',blg:'AbstractClientPlayer',bop:'RenderPlayer',bhm:'ModelBiped'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Unchanged EntityPlayerSP allocated without its constructor (as PlayerStepProbe), flying so no gravity, run through the real EntityPlayer.onUpdate (yz.h: EntityLivingBase.onUpdate, onLivingUpdate, then the chasing position update). The position is written to a scripted target before each tick; each row records lastTickPos, the position after the tick, the previous and current chasing position, prevCameraYaw/cameraYaw, prevDistanceWalkedModified/distanceWalkedModified and the motion after the tick.',
 cases};
await writeFile(path.join(root,'../public/research/cape-reference.json'),JSON.stringify(reference)+'\n');
console.log(`${cases.length} cape cases`);
