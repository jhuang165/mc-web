// Batch 71 mpchunks: runs tools/probes/ChunkViewProbe.java (the unchanged PlayerManager mq, PlayerInstance mr and S21 gx, with tiny stub world / provider / chunk / net handler classes) and
// writes public/research/chunk-view-reference.json. src/mpchunks71-b71.test.js replays it through src/multiplayer/server-chunk-view.js.
// The jar's libraries are found in tools/research/libs-1.7.10; netty-buffer and netty-common (any 4.x) come from MC_NETTY (a path list) or the Gradle minecraft cache.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),probe=path.join(research,'chunkview-probe'),libDir=path.join(research,'libs-1.7.10');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
const libs=(await readdir(libDir)).filter(f=>f.endsWith('.jar')&&!f.includes('sources')).map(f=>path.join(libDir,f));
let netty=(process.env.MC_NETTY||'').split(path.delimiter).filter(Boolean);
if(!netty.length){const base=path.join(os.homedir(),'.gradle/caches/minecraft/libraries/io/netty');for(const n of ['netty-buffer','netty-common']){const d=path.join(base,n);if(!await exists(d))throw new Error('Set MC_NETTY to netty-buffer and netty-common jars.');const v=(await readdir(d))[0];netty.push(path.join(d,v,`${n}-${v}.jar`));}}
const classes=path.join(probe,'classes');await rm(probe,{recursive:true,force:true});await mkdir(classes,{recursive:true}); // the jar is signed: use unpacked classes
await exec('unzip',['-q','-o',jar,'-d',classes],{maxBuffer:1<<26});
const cp=[probe,classes,...libs,...netty].join(path.delimiter);
await exec('javac',['-nowarn','-cp',[classes,...libs].join(path.delimiter),'-d',probe,path.join(root,'probes/ChunkViewProbe.java')],{maxBuffer:1<<24});
const {stdout}=await exec('java',['-cp',cp,'ChunkViewProbe'],{maxBuffer:1<<28});
const lines=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l));
const pairs=f=>{const o=[];for(let i=0;i<f.length;i+=2)o.push([f[i],f[i+1]]);return o;};
const fix=c=>c.case==='constants'?c:{...c,queue:pairs(c.queue),steps:c.steps.map(s=>({...s,queue:pairs(s.queue)}))};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',javaVersion:lines[0].javaVersion,
 method:'Executed: the real PlayerManager (mq: addPlayer, updatePlayerInstances, the spiral reorder, removePlayer through PlayerInstance mr and a real S21 gx) with stub world/provider/chunk/net handler. `queue` is EntityPlayerMP.loadedChunks (pairs, in order), `unload` the S21 packets sent [x, z, groundUp, mask] in order. Bytecode-read: EntityPlayerMP.onUpdate (mw.h) sends up to gz.c() = 5 populated columns per S26 tick.',
 constants:lines[0],cases:Object.fromEntries(lines.slice(1).map(c=>[c.case,fix(c)]))};
await writeFile(path.join(root,'../public/research/chunk-view-reference.json'),JSON.stringify(reference)+'\n');
console.log('chunk-view:',lines.map(l=>l.case).join(' '),'java',lines[0].javaVersion);
