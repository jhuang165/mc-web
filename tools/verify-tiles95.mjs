// Runs tools/probes/Tiles95Probe.java on the unchanged 1.7.10 tile entity classes (TileEntity.createAndLoadEntity then writeToNBT for the furnace, note block,
// jukebox, sign, skull, comparator, command block, mob spawner, enchanting table, ender chest and beacon with NBT of every shape) and writes
// public/research/tiles95-reference.json, replayed by src/tiles95-b95.test.js. Needs the pinned JAR (tools/research or MC_RESEARCH), a JDK and the 1.7.10
// libraries (libs-1.7.10 next to the JAR, or MC_PROBE_LIBS). A stub com.mojang.authlib.GameProfile stands in for the skull's profile (no Owner case is run).
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir,readFile,writeFile,access,readdir,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
let research;for(const dir of [process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research'),path.join(root,'../tools/research')].filter(Boolean))if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
const libDir=path.join(research,'libs-1.7.10'),libs=(process.env.MC_PROBE_LIBS?process.env.MC_PROBE_LIBS.split(path.delimiter):(await readdir(libDir)).filter(f=>/^(log4j-api|log4j-core|guava|commons-lang3|gson|commons-io)-/.test(f)).map(f=>path.join(libDir,f)));
const out=path.join(research,'tiles95-probe'),classes=path.join(out,'classes'),probe=path.join(out,'probe'),stub=path.join(out,'stub');
await rm(out,{recursive:true,force:true});await mkdir(classes,{recursive:true});await mkdir(probe,{recursive:true});await mkdir(path.join(stub,'com/mojang/authlib'),{recursive:true});
await exec('unzip',['-q','-o',jar,'*.class','-d',classes],{maxBuffer:1<<24});
await writeFile(path.join(stub,'com/mojang/authlib/GameProfile.java'),'package com.mojang.authlib;public class GameProfile{final java.util.UUID id;final String name;public GameProfile(java.util.UUID i,String n){id=i;name=n;}public String getName(){return name;}public java.util.UUID getId(){return id;}public boolean isComplete(){return id!=null&&name!=null;}}\n');
const cp=[probe,classes,...libs].join(path.delimiter);
await exec('javac',['-nowarn','-d',probe,path.join(stub,'com/mojang/authlib/GameProfile.java')]);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(root,'probes/Tiles95Probe.java')]);
const {stdout}=await exec('java',['-cp',cp,'Tiles95Probe'],{maxBuffer:1<<26}),records=stdout.split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l)).filter(r=>!r.error&&!(r.loaded===false));
assert.ok(records.length>=80,`records ${records.length}`);
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',method:'Unchanged tile entity classes driven through TileEntity.createAndLoadEntity (aor.c) and writeToNBT (aor.b): per case the input compound `in` and the written compound `nbt`, each as {t: tag type, v: value} (primitive values are the tag toString: 3b, 100s, 7, 5L, a quoted string). Blocks and items are registered through aji.p() and adb.l().',records};
await writeFile(path.join(root,'../public/research/tiles95-reference.json'),JSON.stringify(reference)+'\n');
console.log(`Tile records: ${records.length}`);
