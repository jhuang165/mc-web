// Records the unchanged AchievementList (pc), Achievement (pb) and exploreAllBiomes set (ahu.n); see probes/StatsProbe.java.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'stats-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function library(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const dir of [path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries'),path.join(os.homedir(),'.gradle/caches')]){
  if(!await exists(dir))continue;const {stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24});const hit=stdout.split('\n').filter(Boolean).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs=await Promise.all(['guava-','log4j-api-','commons-lang3-','authlib-','commons-io-'].map(library));
const classes=path.join(out,'classes');await rm(classes,{recursive:true,force:true});await mkdir(classes,{recursive:true});
await exec('unzip',['-q','-o',jar,'*.class','assets/minecraft/lang/*','-d',classes],{maxBuffer:1<<24});
const probe=path.join(out,'probe');await rm(probe,{recursive:true,force:true});await mkdir(probe,{recursive:true});
const cp=[probe,classes,...libs].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(root,'probes/StatsProbe.java')],{maxBuffer:1<<24});
const {stdout}=await exec('java',['-cp',cp,'StatsProbe'],{maxBuffer:1<<29});
const records=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(JSON.parse);
const of=c=>records.filter(r=>r.case===c);
const stats=of('stat'),eggs=of('egg');
assert.equal(of('lists').length,1);assert.equal(of('array').length,4);assert.equal(of('format').length,4);assert.equal(of('uuid').length,1);
assert.equal(records.length,stats.length+eggs.length+10,'no stray records');
assert.ok(stats.length>500,'stat count');assert.ok(eggs.length>20,'egg count');
const lang={};
for(const line of (await exec('unzip',['-p',jar,'assets/minecraft/lang/en_US.lang'],{maxBuffer:1<<24})).stdout.split('\n')){
 const i=line.indexOf('=');if(i>0&&/^(stat\.|gui\.stats|gui\.done|entity\.[^=]*\.name=|multiplayer\.downloadingStats)/.test(line))lang[line.slice(0,i)]=line.slice(i+1).replace(/\r$/,'');
}
for(const r of of('lists')[0].general)assert.ok(lang[r]!==undefined,'name '+r);
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={pp:'StatList',ph:'StatBase',pe:'StatBasic',pf:'StatCrafting',pq:'StatFileWriter',pg:'StatisticsFile',sh:'EntityEggInfo',sg:'EntityList',bej:'GuiStats',beq:'GuiStats$StatsItem',bek:'GuiStats$StatsBlock',ben:'GuiStats$StatsItems',bem:'GuiStats$StatsGeneral',bep:'GuiStats$StatsMobsList',yz:'EntityPlayer',mw:'EntityPlayerMP',nh:'NetHandlerPlayServer',xe:'EntityFishHook',aax:'SlotCrafting',aak:'SlotFurnace',add:'ItemStack',oi:'ServerConfigurationManager'};
// Bytecode-read constants (javap -c -p of bej, beq, bek, ben, bem, bep, bcm in the unchanged JAR); values are literals in the class files.
const screen={listTop:32,listBottomMargin:64,listWidth:220,scrollbarDx:124,titleY:20,
 buttons:{done:{id:0,dx:4,dyFromBottom:28,width:150,height:20},tabs:{y:52,width:80,height:20,general:{id:1,dx:-160},blocks:{id:2,dx:-80},items:{id:3,dx:0},mobs:{id:4,dx:80}}},
 general:{slotHeight:10,nameDx:2,valueRight:215,evenColor:0xFFFFFF,oddColor:0x909090},
 itemLists:{slotHeight:20,headerHeight:20,columnDx:[115,165,215],sortArrowDx:[79,129,179],sortClick:[[79,115],[129,165],[179,215]],itemSlotDx:40,valueDy:5,
  headerIconU:{blocks:[18,36,54],items:[72,18,36]},headerIconV:18,iconSize:18,tooltipOffset:{x:12,y:-12},tooltipBackground:0xC0000000,
  columns:{blocks:['stat.crafted','stat.used','stat.mined'],items:['stat.depleted','stat.crafted','stat.used']}},
 mobs:{slotHeight:'fontHeight*4',nameDx:-8,killColors:{none:0x606060,some:0x909090}},
 sort:'click column c: if c!=o then o=c,p=-1; else if p==-1 then p=1; else o=-1,p=0. comparator: null stat last; differing values -> (va-vb)*p; else id difference'};
const mining={mineBlock:'Block.harvestBlock (aji.a and overrides): C[id]+1, only when the block was removed and canHarvestBlock',craftItem:'ItemStack.onCrafting(world,player,amount): D[id]+amount (SlotCrafting aax.b, SlotFurnace aak.b)',useItem:'ItemStack.tryPlaceItemIntoWorld / hitEntity / onBlockDestroyed success: E[id]+1',breakItem:'ItemStack.damageItem breaking a stack: F[id]+1'};
const triggers={playOneMinute:'EntityPlayer.onUpdate every tick (server side)',walkOneCm:'addMovementStat on ground: round(horizontal*100)',swimOneCm:'in water: round(horizontal*100)',diveOneCm:'head in water: round(distance*100)',climbOneCm:'on ladder, moving up: round(dy*100)',flyOneCm:'in air: round(horizontal*100) only when > 25',fallOneCm:'EntityPlayer.fall: round(distance*100) when distance >= 2',
 mountedOneCm:'addMountedMovementStat: round(distance*100) by vehicle class (minecart, boat, pig, horse)',jump:'EntityPlayer.jump',drop:'EntityPlayer.dropPlayerItem per dropped stack',damageTaken:'EntityPlayer.attackEntityFrom: round(amount*10) before invulnerability frames',damageDealt:'attackTargetEntityWithCurrentItem: round(hp lost*10)',
 deaths:'EntityPlayerMP.onDeath (also entityKilledBy of the last attacker)',mobKills:'addToPlayerScore for a non-player victim',playerKills:'addToPlayerScore for a player victim',killEntity:'EntityPlayer.onKillEntity: the victim egg info kill stat',leaveGame:'ServerConfigurationManager.playerLoggedOut',fishCaught:'EntityFishHook: fish',junkFished:'EntityFishHook: junk',treasureFished:'EntityFishHook: treasure',animalsBred:'EntityAIMate.spawnBaby / EntityAnimal.procreate'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'StatsProbe loads the unchanged StatList (pp) and reads every registered StatBase (pp.b, ph.e id, formatter ph.b) by reflection, the general/items/blocks lists (pp.c/d/e), the per-item arrays pp.C..F after block merging, the EntityList egg infos in HashMap order (sg.a) and formatter samples. screen, mining and triggers are literals read from the GuiStats and player class bytecode. lang is en_US.lang from the JAR.',
 screen,mining,triggers,lang,records};
await writeFile(path.join(root,'../public/research/stats-reference.json'),JSON.stringify(reference)+'\n');
console.log('Original stat records:',records.length,'stats:',stats.length,'eggs:',eggs.length,'bytes:',JSON.stringify(reference).length);

// src/stats-data.js: the generated tables stats.js ports (kept in sync by stats.test.js against the reference JSON).
const lists=of('lists')[0],array=n=>Object.fromEntries(of('array').find(a=>a.name===n).entries);
const keys=Object.keys(lang).filter(k=>/^stat\.|^gui\.stats$|^gui\.done$/.test(k)||eggs.some(e=>k==='entity.'+e.name+'.name'));
const data={
 general:lists.general.map(id=>[id,stats.find(s=>s.id===id).format,stats.find(s=>s.id===id).local]),
 mine:array('mineBlock'),craft:array('craftItem'),use:array('useItem'),break:array('breakItem'),
 blocks:lists.blocks.map(id=>+id.split('.').pop()),items:lists.items.map(id=>+id.split('.').pop()),
 eggs:eggs.map(e=>[e.id,e.name,e.kills,e.killedBy]),
 // StatList.allStats (pp.b) registration order of this run with the achievements last (what StatList.init gives when StatList initialises first, as in the commands-b13 allStats record; the StatsProbe's own bootstrap constructs them early); the craftItem run follows a HashSet of Items (identity hash), so it varies between JVM runs.
 order:[...stats.filter(s=>!s.id.startsWith('achievement.')),...stats.filter(s=>s.id.startsWith('achievement.'))].map(s=>s.id),
 uuid:of('uuid')[0].offline,
 lang:Object.fromEntries(keys.map(k=>[k,lang[k]]))};
await writeFile(path.join(root,'../src/stats-data.js'),'// Generated by tools/verify-stats.mjs from the unchanged 1.7.10 StatList (pp); do not edit by hand.\nexport const STAT_DATA = '+JSON.stringify(data)+';\n');
console.log('src/stats-data.js written');
