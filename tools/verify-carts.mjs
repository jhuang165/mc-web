// Records the unchanged EntityMinecartFurnace (xq), EntityMinecartTNT (xv) and EntityMinecartHopper (xr) from the pinned 1.7.10
// client (tools/probes/CartsProbe.java, on MinecartProbe's World double) in public/research/carts-reference.json;
// src/carts.test.js replays it.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'carts-probe');
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
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(probe,'GameProfile.java'),...['MobMoveProbe','PlantProbe','PlayerStepProbe','NbtProbe','MinecartProbe','CartsProbe'].map(n=>path.join(root,`probes/${n}.java`))]);
const {stdout}=await exec('java',['-cp',cp,'CartsProbe'],{maxBuffer:1<<26});
const cases=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(JSON.parse);
assert.equal(cases.length,30,'cart cases');
{ // sanity: the recorded behaviour the port relies on
  const by=Object.fromEntries(cases.map(c=>[c.name,c])), boom=n=>by[n].ticks.flatMap(t=>t[2]), drops=n=>by[n].ticks.flatMap(t=>t[4]).map(i=>i[0]);
  assert.equal(boom('tnt-activator').length,1,'activator rail ignites the TNT cart');
  assert.ok(!drops('tnt-kill-explosion').includes(46),'explosion kill drops no TNT block');
  assert.ok(by['hopper-above'].ticks.some(t=>t[1][1]===4),'hopper picks up (cooldown 4)');
}
const byName=Object.fromEntries(cases.map(c=>[c.name,c]));

const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={xl:'EntityMinecart',xq:'EntityMinecartFurnace',xv:'EntityMinecartTNT',xr:'EntityMinecartHopper',xp:'EntityMinecartContainer',api:'TileEntityHopper',xk:'EntityItem',ahb:'World',boi:'RenderMinecart',box:'RenderTntMinecart'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Unchanged EntityMinecartFurnace (xq), EntityMinecartTNT (xv) and EntityMinecartHopper (xr) on MinecartProbe.MW extended by CartsProbe.CW: createExplosion (ahb.a(sa,DDDFZ)) and spawnParticle only record (x, y, z, power / name, x, y, z), the entity queries (ahb.a(Class,azt,sj), ahb.a(sa,azt,sj)) read the probe entity list, getTileEntity is null (no inventory above the hopper cart; the inventory branch is the shared hopper code verified in hopper-reference.json). Each cart: rand = new Random(1000), entityId 1, motion set after construction; furnace fuel (private xq.c) and pushX/pushZ (xq.a/b), the TNT fuse (private xv.a) and the hopper slots/cooldown (xr.b) are set by the case. Each tick: scheduled attackEntityFrom with a named DamageSource (generic, inFire, lava, explosion) and interactFirst (xq.c(player), an Unsafe-allocated EntityPlayerSP with an InventoryPlayer holding the case stack), then lastTickPos/prevRotation and onUpdate (xl.h). Per tick: the MinecartProbe.state fields, the type fields (furnace [fuel, pushX, pushZ, lit], TNT [fuse], hopper [enabled, cooldown, five slots [id, count, damage]]), explosions [x, y, z, power], particles [name, x, y, z], spawned EntityItems (drops and spill), live item entities [alive, count, x, y, z] and the interact result [handled, held count]. nbt/nbtEnd are Entity.writeToNBT before the first and after the last tick (UUIDs removed). Item entities are EntityItem(world, x, y, z, stack) with motion zeroed (box bottom = y - 0.125). Spawned EntityItem motion is Math.random() for entityDropItem items. No game classes patched.',
 cases};
await writeFile(path.join(root,'../public/research/carts-reference.json'),JSON.stringify(reference)+'\n');
console.log(`${cases.length} cart cases, ${cases.reduce((n,c)=>n+c.ticks.length,0)} ticks`);
