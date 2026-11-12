import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'entity-list-probe-run');
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
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(probe,'GameProfile.java'),path.join(root,'probes/MobMoveProbe.java'),path.join(root,'probes/PlantProbe.java'),path.join(root,'probes/PlayerStepProbe.java'),path.join(root,'probes/XpOrbProbe.java'),path.join(root,'probes/NbtProbe.java'),path.join(root,'probes/MinecartProbe.java'),path.join(root,'probes/HangingProbe.java'),path.join(root,'probes/EntityListProbe.java')]);
const {stdout}=await exec('java',['-cp',cp,'EntityListProbe'],{maxBuffer:1<<26});
const records=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(JSON.parse),cases=records.filter(r=>r.case==='entity-list'),launches=records.filter(r=>r.case==='throw-launch');
assert.equal(launches.length,25,'launch x5 views x5 classes');
assert.equal(cases.length,71,'items x6, orbs x3, arrow x2, tnt x4, cart rider x2, carts x2, boat x2, painting x2, potion x2, snowball x2, skull x2, explosion vs cart, boat, potion and snowball x10, thrown at a painting x2, vehicle push on mobs x8, player-thrown balls at a cart, boat or painting x14');
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={sa:'Entity',xk:'EntityItem',xw:'EntityTNTPrimed',zc:'EntityArrow',sq:'EntityXPOrb',wh:'EntityCow',agw:'Explosion',xl:'EntityMinecart',xs:'EntityMinecartEmpty',xi:'EntityBoat',ss:'EntityHanging',tb:'EntityPainting',zo:'EntityPotion',zk:'EntityThrowable',zj:'EntitySnowball',zl:'EntityEgg',zm:'EntityEnderPearl',zn:'EntityExpBottle',yz:'EntityPlayer',yw:'PlayerCapabilities',zp:'EntityWitherSkull',ze:'EntityFireball',agy:'GameRules',ahb:'World'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Unchanged EntityItem, EntityTNTPrimed, EntityArrow, EntityXPOrb, EntityMinecartEmpty, EntityBoat, EntityPainting (the 100-tick onValidSurface check), EntityPotion, EntitySnowball, EntityWitherSkull and EntityCow (AI task list off; a cow can ride a cart) in World.loadedEntityList order on XpOrbProbe.XW. The walk is the 1.7.10 World.updateEntities order: index loop, an entity riding a live mount skipped (its mount updates it right after its own update, through updateRidden), ticksExisted++, onUpdate, then dead entities removed after the pass; an entity spawned during the pass joins the end and ticks in the same pass. Light, spawn (a dropped item gets fixed motion 0, 0.2, 0), entity queries, the entity boxes World.getCollidingBoundingBoxes adds for carts and boats, the game rules (mobGriefing true) and the explosion call are doubled (explosion runs the unchanged Explosion.doExplosionA and records it). Rows are per tick: per entity in creation order x, y, z, motion, isDead and kind fields, explosions, for orb cases the player shell [xp, xpCooldown], and the entities spawned in a pass (the item of a broken painting) in spawn order. Each scenario runs in both list orders to show the order is observable. Batch 45 adds TNT blasts beside a cart, a boat, a thrown potion and a snowball (the unchanged Explosion.doExplosionA), a snowball and a potion thrown at a painting, and carts and boats beside a cow (the cow pushes the vehicle in its own update). Batch 46 adds the EntityThrowable(World, EntityLivingBase) launch of a snowball, egg, ender pearl, potion and experience bottle from a player shell (the entity own Random is unseeded, so the state before the aim is recovered by stepping the LCG back until three nextGaussian draws reproduce the state the constructor left; launches[]), and the same balls thrown by a player shell (Creative or not) at a cart, a boat and a painting. No game classes patched.',cases,launches};
await writeFile(path.join(root,'../public/research/entity-list-reference.json'),JSON.stringify(reference)+'\n');
console.log(`${cases.length} entity list scenarios`);
