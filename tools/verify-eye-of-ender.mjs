// Records unchanged ItemEnderEye (acn), EntityEnderEye (zd), BlockEndPortal (akt) and the frame ring check; see probes/EyeOfEnderProbe.java.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'eye-of-ender-probe');
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
await exec('javac',['-nowarn','-cp',cp,'-d',probe,...['MobMoveProbe','ChickenProbe','DifficultyProbe','CombatProbe','MobSpawnerProbe','WitchProbe','ModelProbe','EyeOfEnderProbe'].map(n=>path.join(root,`probes/${n}.java`))],{maxBuffer:1<<24});
const {stdout}=await exec('java',['-cp',cp,'EyeOfEnderProbe'],{maxBuffer:1<<29});
const records=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(JSON.parse);
const count=c=>records.filter(r=>r.case===c).length;
const expect={direction:1,facts:1,flight:11,dropRoll:1,ring:256,ringValid:1,ringMask:1,use:12,rightClick:7,portalSide:1,portalCollide:1,portalAdded:1,portalDisplay:3};
for(const [c,n] of Object.entries(expect))assert.equal(count(c),n,`records of ${c}`);
assert.equal(records.length,Object.values(expect).reduce((a,b)=>a+b),'no stray records');
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={acn:'ItemEnderEye',zd:'EntityEnderEye',akt:'BlockEndPortal',aku:'BlockEndPortalFrame',apo:'TileEntityEndPortal',add:'ItemStack',ave:'MapGenStructure',aug:'MapGenStronghold',bmt:'TileEntityEndPortalRenderer',p:'Direction',ahb:'World'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Unchanged ItemEnderEye (acn), EntityEnderEye (zd), BlockEndPortal (akt), BlockEndPortalFrame (aku) and ItemStack.tryPlaceItemIntoWorld (add.a) on the WitchProbe world double extended by EyeOfEnderProbe.EW (block map, setBlock/setMeta logs, stub findClosestStructure, stub ray trace, particle/sound/spawn/aux log). direction: Direction offsetX/offsetZ/rotateRight. facts: eye entity size/brightness/render range, item stack size, aku.b per meta, portal/frame bounds/light/opacity/render type/hardness/resistance. flight: zd.moveTowards(a) then onUpdate(h) ticks [x,y,z,vx,vy,vz,yaw,pitch,prevYaw,prevPitch,age,dead] with the first particle row per tick and the end events (EntityItem spawn or aux 2003). dropRoll: moveTowards survive bit per Entity.rand seed. ring: for each of 256 facing assignments (north,south,west,east edge) and each of 12 frames as the last one used, outcome char 9=portal filled, 1=eye placed only, 0=not used. ringValid: assignments that fill. ringMask: [eyeMask,last,used,portalCells] samples on the valid ring. use: onItemUse scenarios. rightClick: onItemRightClick scenarios with a stub stronghold at (1224,64,-312). portalSide: shouldSideBeRendered. portalCollide: onEntityCollidedWithBlock (travelToDimension argument) and collision boxes. portalAdded: onBlockAdded. portalDisplay: randomDisplayTick.',
 records};
await writeFile(path.join(root,'../public/research/eye-of-ender-reference.json'),JSON.stringify(reference)+'\n');
console.log('Original eye of ender records:',records.length,'bytes:',JSON.stringify(reference).length);
