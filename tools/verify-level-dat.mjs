// Records level.dat (the WorldInfo Data compound) and the singleplayer player as the unchanged 1.7.10 classes write and
// read them (tools/probes/LevelDatProbe.java on the MobMoveProbe world double) in public/research/level-dat-reference.json;
// src/level-dat.test.js checks the level.dat/player import and the Java ZIP export against it. Needs the same JDK,
// client JAR and library JARs as tools/verify-mob-nbt.mjs.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'level-dat-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function library(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const dir of [path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries'),path.join(os.homedir(),'.gradle/caches')]){
  if(!await exists(dir))continue;const {stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24});const hit=stdout.split('\n').filter(Boolean).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs=await Promise.all(['guava-','log4j-api-','commons-lang3-','authlib-','commons-io-','gson-','netty-'].map(library));
const classes=path.join(out,'classes');await rm(classes,{recursive:true,force:true});await mkdir(classes,{recursive:true});
await exec('unzip',['-q','-o',jar,'*.class','assets/minecraft/lang/en_US.lang','-d',classes],{maxBuffer:1<<24});
const probe=path.join(out,'probe');await mkdir(probe,{recursive:true});
const cp=[probe,classes,...libs].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,...['MobMoveProbe','LevelDatProbe'].map(n=>path.join(root,`probes/${n}.java`))]);
const {stdout}=await exec('java',['-cp',cp,'LevelDatProbe'],{maxBuffer:1<<28});
const lines=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l));
const group=c=>lines.filter(l=>l.case===c);
const names={ays:'WorldInfo',ahj:'WorldSettings',ahk:'WorldSettings$GameType',ahm:'WorldType',agy:'GameRules',yz:'EntityPlayer',yx:'InventoryPlayer',zr:'FoodStats',yw:'PlayerCapabilities',sv:'EntityLivingBase',sa:'Entity',rw:'PotionEffect'};
const digest=async c=>createHash('sha256').update((await exec('unzip',['-p',jar,c+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',
 classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Unchanged original classes (tools/probes/LevelDatProbe.java). settings: new WorldInfo(WorldSettings, name) written with WorldInfo.cloneNBTCompound(player) (ays.a(dh)), the Data compound of level.dat; reread is the same written again after new WorldInfo(Data). read: hand-made Data compounds loaded with WorldInfo(NBTTagCompound) and written again. player: an EntityPlayer subclass built with the real constructor, loaded with Entity.readFromNBT (sa.f) from input and saved with Entity.writeToNBT (sa.e); the other fields are its state after loading (slots/armor are [itemId, count, damage]; effects [id, duration, amplifier, ambient]; food [level, saturation, exhaustion, timer]; abilities [invulnerable, flying, mayfly, instabuild, mayBuild]; xp [level, total, progress]). Hex is uncompressed NBT; LastPlayed is zeroed and UUIDMost/UUIDLeast are the probe\'s 1/2.',
 worldTypes:group('worldType'),parseWorldType:group('parseWorldType'),gameRules:group('gameRules')[0].written,ruleValues:group('ruleValue'),
 players:group('player'),settings:group('settings'),reads:group('read')};
assert.equal(reference.players.length,16,'player records');assert.equal(reference.settings.length,5,'settings records');
await writeFile(path.join(root,'../public/research/level-dat-reference.json'),JSON.stringify(reference)+'\n');
console.log('level.dat reference:',reference.players.length,'players',reference.settings.length,'settings',reference.reads.length,'reads');
