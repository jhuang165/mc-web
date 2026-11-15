// Sound sweep (tools/probes/SoundSweepProbe.java): place, break and step sounds from the unchanged 1.7.10 classes.
// Requires the pinned 1.7.10 JAR, JDK and probe libraries; writes public/research/sound-sweep-reference.json,
// replayed by src/spsounds-b75.test.js.
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
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'sound-sweep-probe');
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
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(probe,'GameProfile.java'),...stubs.map(([pkg,name])=>path.join(probe,'stubs',pkg,name+'.java')),...['MobMoveProbe','PlantProbe','DoorPaneProbe','BedProbe','ClientPredictProbe','SoundSweepProbe'].map(n=>path.join(root,`probes/${n}.java`))],{maxBuffer:1<<24});
const {stdout}=await exec('java',['-cp',cp,'SoundSweepProbe'],{maxBuffer:1<<28}),records=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l));
// Keep the file small: drop null errors and the particle-half marker; a break or step record that equals the one for metadata 0 is implied.
{const seen=new Map();for(const r of records){delete r.after;if(r.error==='null')delete r.error;
 if(r.kind==='place'){delete r.count;const k=r.item+'/'+r.scenario,sig=JSON.stringify([r.result,r.sounds,r.diff.map(c=>[c[0],c[1],c[2],c[3]])]);if(r.damage===0)seen.set(k,sig);else if(seen.get(k)===sig)r.drop=true;}
 if(r.kind==='break'){const k=r.id,sig=JSON.stringify(r.sounds);if(r.meta===0)seen.set(k,sig);else if(seen.get(k)===sig)r.drop=true;}}
 records.splice(0,records.length,...records.filter(r=>!r.drop));}
const count=k=>records.filter(r=>r.kind===k).length;
assert.ok(count('break')>=170&&count('step')>=300&&count('place')>=500,'record counts '+JSON.stringify(records.reduce((a,r)=>(a[r.kind]=(a[r.kind]||0)+1,a),{})));
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const classNames={bma:'RenderGlobal',abh:'ItemBlock',abi:'ItemReed',aec:'ItemSnow',aeg:'ItemSlab',sa:'Entity',aji:'Block',adw:'ItemSeeds'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(classNames).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'tools/probes/SoundSweepProbe.java on the unchanged classes: place = Item.onItemUse for every registered item (damage 0..15 below id 256, 0 and 3 above) in ten click scenarios on a client-flagged world double, logging World.playSoundEffect; break = RenderGlobal.playAuxSFX type 2001 for every block id and metadata, logging the PositionedSoundRecord handed to the sound handler; step = Entity.func_145780_a for every block, plain and under a snow layer. Records keep sound name, volume, pitch (and position).',
 records};
const file=path.join(root,'../public/research/sound-sweep-reference.json');await writeFile(file,JSON.stringify(reference)+'\n');
console.log(`Sound sweep records: ${records.length}, ${(await readFile(file)).length} bytes`);
