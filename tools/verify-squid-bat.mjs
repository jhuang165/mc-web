// Records EntitySquid, EntityBat and their water-mob / ambient-creature bases from the unchanged original classes
// (tools/probes/SquidBatProbe.java on the MobMoveProbe world double) in public/research/squid-bat-reference.json;
// src/squid-bat.test.js checks the browser port against it. Needs the same JDK, client JAR and library JARs as
// tools/verify-wolf.mjs (MC_RESEARCH points at the directory holding minecraft-1.7.10.jar).
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'squid-bat-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function library(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const dir of [path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries'),path.join(os.homedir(),'.gradle/caches')]){
  if(!await exists(dir))continue;const {stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24});const hit=stdout.split('\n').filter(Boolean).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs=await Promise.all(['guava-','log4j-api-','commons-lang3-','authlib-'].map(library));
const classes=path.join(out,'classes');await rm(classes,{recursive:true,force:true});await mkdir(classes,{recursive:true});
await exec('unzip',['-q','-o',jar,'*.class','-d',classes],{maxBuffer:1<<24});
const probe=path.join(out,'probe');await mkdir(probe,{recursive:true});
const cp=[probe,classes,...libs].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(root,'probes/MobMoveProbe.java'),path.join(root,'probes/WolfProbe.java'),path.join(root,'probes/ModelProbe.java'),path.join(root,'probes/SquidBatProbe.java')]);
const {stdout}=await exec('java',['-cp',cp,'SquidBatProbe'],{maxBuffer:1<<28});
const lines=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l));
const pick=name=>lines.filter(l=>l.case===name);
const facts=pick('facts')[0],xp=pick('squidXp')[0],squidStart=pick('squidStart'),squidTick=pick('squidTick'),squidSpawn=pick('squidSpawn'),squidDrops=pick('squidDrops'),batStart=pick('batStart'),batTick=pick('batTick'),batWake=pick('batWake'),batHeadYaw=pick('batHeadYaw')[0],batSound=pick('batSound'),batSpawn=pick('batSpawn'),batHurt=pick('batHurt')[0],batNbt=pick('batNbt');
assert.ok(facts&&xp&&batHeadYaw&&batHurt);assert.equal(squidStart.length,2);assert.equal(squidDrops.length,160);assert.equal(batStart.length,4);assert.equal(batTick.length,1600);assert.equal(batWake.length,10);assert.equal(batSound.length,80);assert.equal(batSpawn.length,384);assert.equal(batNbt.length,2);
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={ws:'EntitySquid',wu:'EntityWaterMob',we:'EntityBat',wd:'EntityAmbientCreature',bih:'ModelSquid',bhc:'ModelBat'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Unchanged original classes after Block/Item registration, on the MobMoveProbe world double (stone below y 0, air above) with real new ws(world) and new we(world). The world double adds a water flag (handleMaterialAcceleration), a block-light value, a calendar, a ceiling plane and a closest-player stub. facts: sizes, attribute bases, sounds. squidTick: full ws.h() with the water flag on, then off (air, drowning). squidDrops: ws.b(Z,I). batTick: we.bn() with the h() tail applied by hand (a plain Euler step; collisions are not part of the record). batWake, batHeadYaw, batSound, batSpawn: we.bn(), we.t(), we.by() with an injected calendar. The models (bih, bhc) are bytecode-derived and are not run.',
 facts,squidXp:xp.values,squidStart,squidTick,squidSpawn,squidDrops,batStart,batTick,batWake,batHeadYaw:batHeadYaw.values,batSound,batSpawn,batHurt,batNbt};
await writeFile(path.join(root,'../public/research/squid-bat-reference.json'),JSON.stringify(reference)+'\n');
console.log('squid-bat reference:',squidTick.length,'squid ticks,',squidDrops.length,'drop rows,',batTick.length,'bat ticks,',batSpawn.length,'bat spawn rows,',batSound.length,'bat sound rows');
