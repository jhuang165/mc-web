// Records unchanged EntitySlime (ym), its tick, split, drops, spawn rules and ModelSlime (bie); see probes/SlimeProbe.java.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'slime-probe');
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
const probe=path.join(out,'probe');await rm(probe,{recursive:true,force:true});await mkdir(probe,{recursive:true});
const cp=[probe,classes,...libs].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,...['MobMoveProbe','ChickenProbe','DifficultyProbe','CombatProbe','MobSpawnerProbe','WitchProbe','ModelProbe','SlimeProbe'].map(n=>path.join(root,`probes/${n}.java`))],{maxBuffer:1<<24});
const {stdout}=await exec('java',['-cp',cp,'SlimeProbe'],{maxBuffer:1<<29});
const records=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(JSON.parse);
const count=c=>records.filter(r=>r.case===c).length;
const expect={facts:1,jumpDelay:1,split:4,splitAlive:1,drops:4,xp:1,chunkRandom:1,spawn:1,spawnFacts:1,spawnChunk:8,attack:1,think:22};
for(const [c,n] of Object.entries(expect))assert.equal(count(c),n,`records of ${c}`);
assert.equal(records.filter(r=>r.model).length,1);
assert.equal(records.length,Object.values(expect).reduce((a,b)=>a+b)+1,'no stray records');
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={ym:'EntitySlime',yb:'IMob',sw:'EntityLiving',sv:'EntityLivingBase',apx:'Chunk',bie:'ModelSlime',bot:'RenderSlime',ahb:'World'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Unchanged EntitySlime (ym) on the WitchProbe world double with a chunk per coordinate (SlimeProbe.SW). facts: constructor/setSize results per size; jumpDelay: getJumpDelay (bR) for seeded Entity.rand; split: setDead (B) at 0 health, children size, offset, yaw; drops: dropFewItems; xp: getExperiencePoints; chunkRandom: Chunk.getRandomWithSeed(987234911).nextInt(10) grids of world seeds; spawn: getCanSpawnHere (by) rows [difficulty,size,swamp,moonPhase,blockLight,y,bits over entity seeds 0..23]; spawnChunk: rows by chunk of bits over entity seeds; attack: onCollideWithPlayer; think: onUpdate (h) ticks [x,y,z,vx,vy,vz,yaw,head,onGround,squishAmount,squishFactor,prevSquishFactor,jumpDelay,jumping,moveForward,moveStrafing,health,dead]. Landing particles come from World.spawnParticle (world double records them).',
 render:{texture:'textures/entity/slime/slime.png',shadowSize:0.25,model:'ModelSlime (bie): bie(16) is the body, bie(0) the translucent outer shell rendered as a second pass with SRC_ALPHA/ONE_MINUS_SRC_ALPHA blending',squish:'RenderSlime.preRenderCallback (bot.a(ym,F)): f4 = (prevSquishFactor + (squishFactor - prevSquishFactor) * partial) / (size * 0.5 + 1); f5 = 1 / (f4 + 1); glScalef(f5 * size, size / f5, f5 * size)'},
 records};
await writeFile(path.join(root,'../public/research/slime-reference.json'),JSON.stringify(reference)+'\n');
console.log('Original slime records:',records.length,'bytes:',JSON.stringify(reference).length);
