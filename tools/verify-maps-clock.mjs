// Records unchanged ItemEnderEye (acn), EntityEnderEye (zd), BlockEndPortal (akt) and the frame ring check; see probes/MapsClockProbe.java.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'maps-clock-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function library(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const dir of [path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries'),path.join(os.homedir(),'.gradle/caches')]){
  if(!await exists(dir))continue;const {stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24});const hit=stdout.split('\n').filter(Boolean).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs=await Promise.all(['guava-','log4j-api-','commons-lang3-','authlib-','commons-io-','gson-','netty-transport-4','netty-common-','netty-buffer-','netty-codec-','netty-handler-4','netty-resolver-'].map(library));
const classes=path.join(out,'classes');await rm(classes,{recursive:true,force:true});await mkdir(classes,{recursive:true});
await exec('unzip',['-q','-o',jar,'*.class','assets/minecraft/lang/en_US.lang','-d',classes],{maxBuffer:1<<24});
const probe=path.join(out,'probe');await rm(probe,{recursive:true,force:true});await mkdir(probe,{recursive:true});
const cp=[probe,classes,...libs].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,...['MobMoveProbe','ChickenProbe','DifficultyProbe','CombatProbe','MobSpawnerProbe','WitchProbe','ModelProbe','MapsClockProbe'].map(n=>path.join(root,`probes/${n}.java`)),...['LWJGLException','opengl/OpenGLException','opengl/DisplayMode'].map(n=>path.join(root,`probes/stubs/org/lwjgl/${n}.java`))],{maxBuffer:1<<24});
const {stdout}=await exec('java',['-cp',cp,'MapsClockProbe'],{maxBuffer:1<<29});
const records=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(JSON.parse);
const count=c=>records.filter(r=>r.case===c).length;
const expect={mapColor:36,blockColor:171,empty:9,emptyStack:1,emptyDimension:1,autoCreate:5,scaling:6,scalingPlain:1,update:8,decor:19,recipe:17,recipeFacts:1,clockFacts:1,clockSettle:9,clockDay:1,clockFrames:30,compassFrames:36};
for(const [c,n] of Object.entries(expect))assert.equal(count(c),n,`records of ${c}`);
assert.equal(records.length,Object.values(expect).reduce((a,b)=>a+b),'no stray records');
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={awv:'MapColor',adh:'ItemMap',acl:'ItemEmptyMap',ayi:'MapData',ayj:'MapData$MapInfo',ayk:'MapData$MapCoord',azq:'MapStorage',afb:'RecipesMapCloning',afc:'RecipesMapExtending',bql:'TextureClock',add:'ItemStack',ahb:'World'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Unchanged MapColor (awv), Block.getMapColor (aji.f), ItemEmptyMap (acl), ItemMap (adh), MapData (ayi/ayj/ayk), MapStorage (azq), RecipesMapCloning (afb), RecipesMapExtending (afc) and TextureClock (bql) on the ChickenProbe/DifficultyProbe world double with a closed-form integer terrain served by a Chunk double (MapsClockProbe.FC). mapColor: awv table with the four shade rgb values. blockColor: aji.f(meta) colour index per original block id and meta plus liquid/opacity. empty: ItemEmptyMap.onItemRightClick at positions (new id, scale 0, centre). emptyStack/emptyDimension: stack handling and dimension. autoCreate: ItemMap.getMapData of a missing map (scale 3 around spawn). scaling: onCreated with map_is_scaling. update: ItemMap.updateMapData calls on the fixed terrain; RLE of the colours after calls 1, 2, 16 and 32 plus dirty column ranges. decor: MapData.updateVisiblePlayers decorations [name,type,x,y,rotation]. recipe: afb/afc matches and results. clockFrames/compassFrames: unchanged bql/bqm with frame lists of 1, 2, 5, 32, 64 and 128 entries (the compass with the world spawn, player position and yaw, plus the item frame direct set a(world,x,z,yaw,false,true)). clock*: TextureClock frame index/angle sequences (world time driven; the GL upload at the end is swallowed after the state is stored). The non-surface clock spin uses Math.random and is bytecode-derived.',
 records};
await writeFile(path.join(root,'../public/research/maps-clock-reference.json'),JSON.stringify(reference)+'\n');
console.log('Original maps and clock records:',records.length,'bytes:',JSON.stringify(reference).length);
