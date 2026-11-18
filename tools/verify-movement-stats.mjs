// Records EntityPlayer.addMovementStat (yz.k) and addMountedMovementStat (yz.l) on a real EntityPlayerMP (tools/probes/MovementStatProbe.java) in
// public/research/movement-stats-reference.json: the movement statistics and the FoodStats exhaustion of walking, sprinting, jumping, swimming, diving,
// ladders and riding, on the unchanged original classes. src/movement-stat.test.js replays it. Needs the same JDK, client JAR and library JARs as
// tools/verify-player-riding.mjs.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'movement-stat-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function library(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const dir of [path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries'),path.join(os.homedir(),'.gradle/caches')]){
  if(!await exists(dir))continue;const {stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24});const hit=stdout.split('\n').filter(Boolean).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs=await Promise.all(['guava-','log4j-api-','log4j-core-','commons-lang3-','authlib-','commons-io-','gson-','netty-'].map(library));
const classes=path.join(out,'classes');await rm(classes,{recursive:true,force:true});await mkdir(classes,{recursive:true});
await exec('unzip',['-q','-o',jar,'*.class','assets/minecraft/lang/en_US.lang','-d',classes],{maxBuffer:1<<24});
const probe=path.join(out,'probe');await mkdir(probe,{recursive:true});
const cp=[probe,classes,...libs].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,...['MobMoveProbe','ServerPlayerProbe','MovementStatProbe'].map(n=>path.join(root,`probes/${n}.java`))],{maxBuffer:1<<24});
const lines=(await exec('java',['-cp',cp,'MovementStatProbe'],{maxBuffer:1<<28})).stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l));
const moves=lines.filter(l=>l.case==='move'),direct=lines.filter(l=>l.case==='direct'),mounted=lines.filter(l=>l.case==='mounted');
assert.ok(moves.length>=300&&direct.length>=26&&mounted.length===10,`${moves.length} ${direct.length} ${mounted.length}`);
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={yz:'EntityPlayer',mw:'EntityPlayerMP',sv:'EntityLivingBase',sa:'Entity',zr:'FoodStats',pp:'StatList',qh:'MathHelper'};
const classInfo=Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}])));
await writeFile(path.join(root,'../public/research/movement-stats-reference.json'),JSON.stringify({target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:classInfo,
 method:'Unchanged original classes (tools/probes/MovementStatProbe.java). A real EntityPlayerMP (ServerPlayerProbe) with a recording StatisticsFile moves through the EntityPlayer movement path on a world double (stone floor, a still-water pool, a ladder column): handleWaterMovement, the jump (or the in-water rise of onLivingUpdate, port-read), the jumpMovementFactor of onLivingUpdate (port-read), then the unchanged moveEntityWithHeading, which ends in addMovementStat (yz.k) with the move. `move` rows are those ticks; `direct` rows call yz.k with a chosen delta and state; `mounted` rows call yz.l with p.ridingEntity of each vehicle class. ex* are FoodStats.foodExhaustionLevel; stats are every [statId, amount] EntityPlayerMP.addStat passed on.',
 moves,direct,mounted})+'\n');
console.log('movement stats reference:',moves.length,'moves',direct.length,'direct',mounted.length,'mounted');
