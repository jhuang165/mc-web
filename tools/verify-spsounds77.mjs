// Sound sweep part 3 (tools/probes/SpSounds77Probe.java): right-click, use, impact and block activation sounds from the unchanged 1.7.10 classes.
// Requires the pinned 1.7.10 JAR, JDK and probe libraries; writes public/research/sound-sweep3-reference.json,
// replayed by src/spsounds77-b77.test.js.
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
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'sound-sweep3-probe');
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
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(probe,'GameProfile.java'),...stubs.map(([pkg,name])=>path.join(probe,'stubs',pkg,name+'.java')),...['MobMoveProbe','PlantProbe','DoorPaneProbe','BedProbe','ClientPredictProbe','SoundSweepProbe','SpSounds76Probe','SpSounds77Probe'].map(n=>path.join(root,`probes/${n}.java`))],{maxBuffer:1<<24});
const {stdout}=await exec('java',['-cp',cp,'SpSounds77Probe'],{maxBuffer:1<<28}),records=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l));
assert.ok(records.length>=200,'record count '+records.length);
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const classNames={abm:'ItemBow',zc:'EntityArrow',aej:'ItemLilyPad',acn:'ItemEnderEye',zd:'EntityEnderEye',zo:'EntityPotion',zn:'EntityExpBottle',wp:'EntitySheep',acx:'ItemFood',adr:'ItemRecord',alr:'TileEntityRecordPlayer',aow:'TileEntityChest',ape:'TileEntityEnderChest',apl:'TileEntityNote',acw:'ItemFlintAndSteel',bma:'RenderGlobal'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(classNames).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'tools/probes/SpSounds77Probe.java on the unchanged classes and the SoundSweepProbe/SpSounds76Probe world double: block activation (doors, trapdoors, gates, levers, buttons, plates, chests, note blocks, jukebox, repeater, comparator, cake), bow release, lily pad, eye of ender (with and without a stronghold), eating and drinking, flint and steel, thrown-entity impacts, sheep shear, arrow hit and the real RenderGlobal.playAuxSFX conversion of every logged aux event (plus 2003 and 2004). Records keep World.playSoundEffect / playSoundAtEntity / aux events on remote and non-remote worlds.',
 records};
const file=path.join(root,'../public/research/sound-sweep3-reference.json');await writeFile(file,JSON.stringify(reference)+'\n');
console.log(`Sound sweep 3 records: ${records.length}, ${(await readFile(file)).length} bytes`);
