// Runs tools/probes/RimLightProbe.java over the unchanged 1.7.10 classes (a loaded chunk set growing ring by ring, per-chunk light digests)
// and writes public/research/rim-light-reference.json (batch 31; replayed by src/rim-light.test.js through src/native-light.js).
// Needs a JDK and MC_RESEARCH with minecraft-1.7.10.jar and libs-1.7.10.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url));
const research=process.env.MC_RESEARCH||path.join(root,'../../tools/research'),libs=path.join(research,'libs-1.7.10');
const jar=path.join(research,'minecraft-1.7.10.jar');
const out=path.join(research,'rimlight-probe'),classes=path.join(out,'classes'),probe=path.join(out,'probe');
await rm(out,{recursive:true,force:true});await mkdir(classes,{recursive:true});await mkdir(probe,{recursive:true});
await exec('unzip',['-q','-o',jar,'*.class','-d',classes],{maxBuffer:1<<24});
const cp=[probe,classes,...['guava-15.0','log4j-api-2.0-beta9','commons-lang3-3.1','gson-2.2.4'].map(n=>path.join(libs,n+'.jar'))].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(root,'probes/RimLightProbe.java')],{maxBuffer:1<<24});
const {stdout}=await exec('java',['-Xmx3g','-cp',cp,'RimLightProbe'],{maxBuffer:1<<30});
const raw=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l));
// the spiral and x-major scenarios of one seed share their terrain: stored once
const terrains={},scenarios=raw.map(({fills,decorations,...rest})=>{const id=String(rest.case).split("-")[1];if(terrains[id])assert.deepEqual(terrains[id],{fills,decorations});else terrains[id]={fills,decorations};return {...rest,terrain:id};});
const hash=async f=>createHash('sha256').update(await readFile(f)).digest('hex');
await writeFile(path.join(root,'../public/research/rim-light-reference.json'),JSON.stringify({jarSha1:createHash('sha1').update(await readFile(jar)).digest('hex'),probeSha256:await hash(path.join(root,'probes/RimLightProbe.java')),terrains,scenarios}));
console.log('scenarios:',scenarios.length);
