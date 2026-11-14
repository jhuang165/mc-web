// Records the entity half of EntityRenderer.getMouseOver for fireballs (tools/probes/FireballPickProbe.java) in
// public/research/fireball-pick-reference.json; src/projectiles5-b70.test.js replays it through Fireballs.pick.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'fireball-pick-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function library(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const dir of [path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries'),path.join(os.homedir(),'.gradle/caches')]){
  if(!await exists(dir))continue;const {stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24});const hit=stdout.split('\n').filter(Boolean).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs=await Promise.all(['guava-','log4j-api-','commons-lang3-','authlib-1.5'].map(library));
const classes=path.join(out,'classes');await rm(classes,{recursive:true,force:true});await mkdir(classes,{recursive:true});
await exec('unzip',['-q','-o',jar,'*.class','-d',classes],{maxBuffer:1<<24});
const probe=path.join(out,'probe');await mkdir(probe,{recursive:true});
const cp=[probe,classes,...libs].join(path.delimiter);
try{await exec('javac',['-nowarn','-cp',cp,'-d',probe,...['MobMoveProbe','ChickenProbe','DifficultyProbe','EquipmentProbe','PlayerKnockbackProbe','FireballPickProbe'].map(n=>path.join(root,`probes/${n}.java`))],{maxBuffer:1<<24});}
catch(e){console.error(e.stderr);throw e;}
const {stdout}=await exec('java',['-cp',cp,'FireballPickProbe'],{maxBuffer:1<<28});
const records=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(JSON.parse);
assert.equal(records.filter(r=>r.case==='pick').length,2400);assert.equal(records.filter(r=>r.case==='class').length,2);assert.equal(records.filter(r=>r.case==='offgrid').length,1);
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={ze:'EntityFireball',zg:'EntityLargeFireball',zi:'EntitySmallFireball',azt:'AxisAlignedBB',yz:'EntityPlayer',blt:'EntityRenderer'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'The entity half of EntityRenderer.getMouseOver (bytecode-read, composed in the probe) over the real objects it calls: EntityFireball large and small balls (canBeCollidedWith, getCollisionBorderSize, the entity box), AxisAlignedBB addCoord/expand/isVecInside/calculateIntercept, Vec3.distanceTo and a box-intersection getEntitiesWithinAABBExcludingEntity, for a real EntityPlayer viewer. 2400 random scenes of 1-3 balls around the look ray, Survival (reach 3) or Creative (6), with and without a block hit distance (wall). The client mouse state and block ray are not run. The class records give canBeCollidedWith, the border and the box of a ball at (0,10,0).',records};
await writeFile(path.join(root,'../public/research/fireball-pick-reference.json'),JSON.stringify(reference)+'\n');
console.log('Fireball pick records:',records.length);
