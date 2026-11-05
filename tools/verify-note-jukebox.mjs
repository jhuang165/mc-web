// Records the unchanged BlockNote, TileEntityNote, BlockJukebox, ItemRecord, EntityCreeper.onDeath and GuiIngame record text;
// see tools/probes/NoteJukeboxProbe.java and public/research/note-jukebox.md.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'note-jukebox-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function library(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const dir of [path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries'),path.join(os.homedir(),'.gradle/caches')]){
  if(!await exists(dir))continue;const {stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24});const hit=stdout.split('\n').filter(Boolean).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs=await Promise.all(['guava-','log4j-api-','commons-lang3-'].map(library));
const classes=path.join(out,'classes');await rm(classes,{recursive:true,force:true});await mkdir(classes,{recursive:true});
await exec('unzip',['-q','-o',jar,'*.class','-d',classes],{maxBuffer:1<<24});
const probe=path.join(out,'probe');await mkdir(probe,{recursive:true});
await writeFile(path.join(probe,'GameProfile.java'),'package com.mojang.authlib; public class GameProfile {}\n');
const cp=[probe,classes,...libs].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(probe,'GameProfile.java'),...['MobMoveProbe','PlantProbe','PlayerStepProbe','NbtProbe','MinecartProbe','ChickenProbe','NoteJukeboxProbe'].map(n=>path.join(root,`probes/${n}.java`))]);
const {stdout}=await exec('java',['-cp',cp,'NoteJukeboxProbe'],{maxBuffer:1<<27});
const cases=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(JSON.parse);
const count=k=>cases.filter(c=>c.case===k).length;
assert.equal(count('facts'),2);assert.equal(count('trigger'),69);assert.equal(count('instruments'),1);assert.equal(count('event'),6);assert.equal(count('click'),4);assert.equal(count('redstone'),2);assert.equal(count('note-nbt'),11);
assert.equal(count('disc'),12);assert.equal(count('empty'),1);assert.equal(count('eject'),72);assert.equal(count('jukebox-nbt'),4);assert.equal(count('jukebox-legacy'),8);assert.equal(count('creeper'),5);assert.equal(count('hud'),1);assert.equal(count('note-colour'),1);
// The lang strings the HUD message and the tooltips come from (the unchanged en_US.lang in the JAR).
const lang=(await exec('unzip',['-p',jar,'assets/minecraft/lang/en_US.lang'],{maxBuffer:1<<24})).stdout.split('\n').filter(l=>/^(record\.nowPlaying|tile\.jukebox\.name|tile\.musicBlock\.name|item\.record\.)/.test(l)).map(l=>l.replace(/\r$/,''));
// The two crafting recipes come from the unchanged CraftingManager registry already recorded in recipe-registry-reference.json.
const registry=JSON.parse(await readFile(path.join(root,'../public/research/recipe-registry-reference.json'),'utf8'));
const recipes=registry.crafting.filter(r=>r.declaredOutput&&(r.declaredOutput.id===25||r.declaredOutput.id===84)).map(r=>({index:r.index,type:r.type,width:r.width,height:r.height,ingredients:r.ingredients.map(i=>i&&[i.id,i.damage]),output:[r.declaredOutput.id,r.declaredOutput.count,r.declaredOutput.damage]}));
assert.equal(recipes.length,2);
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={amj:'BlockNote',apl:'TileEntityNote',alq:'BlockJukebox',alr:'BlockJukebox$TileEntityJukebox',adr:'ItemRecord',xz:'EntityCreeper',bbv:'GuiIngame',bkl:'EntityNoteFX',qh:'MathHelper'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Unchanged BlockNote (amj), TileEntityNote (apl), BlockJukebox (alq), TileEntityJukebox (alr), ItemRecord (adr) and EntityCreeper.onDeath (xz.a(ro)) on a MobMoveProbe.ProbeWorld subclass with map-backed blocks and tile entities that records addBlockEvent, playSoundEffect, spawnParticle, playAuxSFX, playRecord, setBlockMetadataWithNotify and spawned EntityItems. `trigger`: TileEntityNote.triggerNote [apl.a(ahb,III)] for 23 materials below and 3 blocks above (air, stone, and id 8) for every note: events are [x,y,z,block,instrument,note]. `event`: BlockNote.onBlockEventReceived for instruments 0-5 and notes 0-24, with the played sound [name,x,y,z,volume,pitch] and the note particle [name,x,y,z,vx,vy,vz]. `click`: right clicks (changePitch then trigger) and left clicks. `redstone`: onNeighborBlockChange with a power sequence. `disc`: ItemRecord facts and ItemRecord.onItemUse; `eject`: BlockJukebox.onBlockActivated and breakBlock for seeded world.rand with the item entity position and pickup delay (item motion is Math.random, not recorded). `creeper`: EntityCreeper.onDeath for five damage sources over 240 seeds, as [disc id or -1, item entities]. `hud`: GuiIngame record text [recordPlayingUpFor, partialTicks, alpha, rgb] using java.awt.Color.HSBtoRGB as the client does (alpha is drawn only above 8; GuiIngame bytecode: 60 ticks, translate(width/2, height-68), x = -width/2, y = -4, rgb 0xFFFFFF when not a record, text shadowed). `note-colour`: EntityNoteFX colour from MathHelper.sin. No game classes patched.',
 lang,recipes,cases};
await writeFile(path.join(root,'../public/research/note-jukebox-reference.json'),JSON.stringify(reference)+'\n');
console.log(`${cases.length} note/jukebox records (${[...new Set(cases.map(c=>c.case))].map(k=>k+' '+count(k)).join(', ')})`);
