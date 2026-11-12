// Batch 51 b51ft: the full onUpdate of the unchanged 1.7.10 EntityGhast (yd) and EntityDragon (xa), so the legacy body turn runs after the action state; see probes/FlyTurnProbe.java.
// Writes public/research/flyturn-b51ft-reference.json, replayed by src/flyturn-b51.test.js.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'flyturn-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function library(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const dir of [path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries'),path.join(os.homedir(),'.gradle/caches')]){
  if(!await exists(dir))continue;const {stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24});const hit=stdout.split('\n').filter(Boolean).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs=await Promise.all(['guava-','log4j-api-','commons-lang3-','authlib-','netty-','commons-io-'].map(library));
const classes=path.join(out,'classes');await rm(classes,{recursive:true,force:true});await mkdir(classes,{recursive:true});
await exec('unzip',['-q','-o',jar,'*.class','-d',classes],{maxBuffer:1<<24});
const probe=path.join(out,'probe');await rm(probe,{recursive:true,force:true});await mkdir(probe,{recursive:true});
const cp=[probe,classes,jar,...libs].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,...['MobMoveProbe','WolfProbe','ModelProbe','BlazeGhastProbe','TerrainProbe','DecorationFeatureProbe','SpringProbe','EndProbe','DragonProbe','FlyTurnProbe'].map(n=>path.join(root,`probes/${n}.java`))],{maxBuffer:1<<24});
const {stdout,stderr}=await exec('java',['-Xmx2g','-cp',cp,'FlyTurnProbe'],{maxBuffer:1<<29});
if(/Exception|Caused by:/.test(stderr))throw new Error(stderr);
const lines=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(JSON.parse);
const scenarios=[];
for(const l of lines){
 if(l.case.endsWith('Start'))scenarios.push({kind:l.case.replace('Start',''),name:l.name,seed:l.seed,yaw:l.yaw,rel:l.rel,rows:[],charging:[],fireballs:[]});
 else{const s=scenarios.at(-1);assert.equal(s.kind,l.case);assert.equal(l.tick,s.rows.length+1);s.rows.push(l.row);if(l.charging!==undefined){s.charging.push(l.charging);s.fireballs.push(l.fireballs);}}
}
assert.equal(scenarios.length,11);for(const s of scenarios)assert.equal(s.rows.length,240);
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={yd:'EntityGhast',xa:'EntityDragon',sr:'EntityFlying',sw:'EntityLiving',sv:'EntityLivingBase'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Unchanged EntityGhast (yd.h(), the full onUpdate with its real EntityFlying motion) on the BlazeGhastProbe world double (stone below y 0, a stub player) and EntityDragon (xa.h()) on the DragonProbe End world double, ticksExisted counted by hand, the constructor-rolled Math.random angles zeroed. Each row: [x, y, z, vx, vy, vz, rotationYaw, rotationPitch, prevRotationYaw, prevRotationPitch, renderYawOffset, prevRenderYawOffset, rotationYawHead, prevRotationYawHead]. Ghast scenarios start at (64.5, 40, 64.5) with a player at rel (dropped for ticks 151..200); dragons start at (0, 128, 0) with yaw.',
 scenarios};
await writeFile(path.join(root,'../public/research/flyturn-b51ft-reference.json'),JSON.stringify(reference)+'\n');
console.log('flyturn b51ft:',scenarios.length,'scenarios,',scenarios.length*240,'rows');
