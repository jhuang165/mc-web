// Batch 67: records World.activeChunkSet iteration orders (tools/probes/ActiveChunksProbe.java: the unchanged ChunkCoordIntPair `agu` in a real HashSet, filled as ahb.C does) in
// public/research/active-chunks-reference.json. src/serverchunks-b67.test.js replays it through src/multiplayer/server-chunks.js. The order is the running JDK's HashMap order.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),probe=path.join(research,'active-chunks-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
const classes=path.join(probe,'classes');await rm(probe,{recursive:true,force:true});await mkdir(classes,{recursive:true}); // the jar is signed: use unpacked classes
await exec('unzip',['-q','-o',jar,'agu.class','-d',classes]);
await exec('javac',['-nowarn','-cp',classes,'-d',probe,path.join(root,'probes/ActiveChunksProbe.java')],{maxBuffer:1<<24});
const {stdout}=await exec('java',['-cp',[probe,classes].join(path.delimiter),'ActiveChunksProbe'],{maxBuffer:1<<28});
const lines=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l));
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',javaVersion:lines[0].javaVersion,
 method:'Executed: the real ChunkCoordIntPair (agu) in a real java.util.HashSet filled as ahb.C does (clear, then per player the square [-r,r]^2, x outer), iteration order after each tick. Bytecode-read: ahb.C, WorldServer.p() = view distance (oi.s), mt.g iterates the set. JDK HashMap order (javaVersion).',
 ...Object.fromEntries(lines.map(l=>{const {javaVersion,case:c,...rest}=l;return [c,rest];}))};
await writeFile(path.join(root,'../public/research/active-chunks-reference.json'),JSON.stringify(reference)+'\n');
console.log('active-chunks:',lines.map(l=>l.case).join(' '),'java',lines[0].javaVersion);
