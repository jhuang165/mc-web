// Records the unchanged EntityMinecart (xl) display tile accessors and the client EntityMinecartTNT (xv) fuse from the pinned 1.7.10 client
// (tools/probes/CartDisplayProbe.java, on CartsProbe's World double) in public/research/cart-display-reference.json; src/cart-display-b49.test.js replays it.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'cart-display-probe');
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
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(probe,'GameProfile.java'),...['MobMoveProbe','PlantProbe','PlayerStepProbe','NbtProbe','MinecartProbe','CartsProbe','CartDisplayProbe'].map(n=>path.join(root,`probes/${n}.java`))]);
const {stdout}=await exec('java',['-cp',cp,'CartDisplayProbe'],{maxBuffer:1<<26});
const ref=JSON.parse(stdout.trim().split('\n').filter(l=>l.startsWith('{')).pop());
assert.equal(ref.defaults.length,7);assert.equal(ref.clientFuse.ticks.length,90);
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={xl:'EntityMinecart',xv:'EntityMinecartTNT',te:'DataWatcher',boi:'RenderMinecart'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Unchanged EntityMinecart (xl.a(world, x, y, z, type) factory), its display accessors n/p/r/t and setters k/l/m, and EntityMinecartTNT (xv) on CartsProbe.CW. defaults: per cart type 0..6 (4 not built) [tile id, data, offset, has flag, watcher 20, 21, 22]. sequences: setter calls from a fresh cart (step [1 k=setDisplayTile | 2 l=setDisplayTileData | 3 m=setDisplayTileOffset, argument, state]). clientFuse: a TNT cart on a world with isRemote true (E), status byte 10 handed to a(byte) at tick 3, then h() each tick; per tick [fuse before, fuse after, explosions, smoke particles]. No game classes patched.',...ref};
await writeFile(path.join(root,'../public/research/cart-display-reference.json'),JSON.stringify(reference)+'\n');
console.log('cart display reference written');
