// Runs tools/probes/LightGapsProbe.java over the unchanged 1.7.10 classes and writes public/research/light-gaps-reference.jsonl
// (batch 74; replayed by src/recheckgaps-b74.test.js). Needs a JDK and MC_RESEARCH with minecraft-1.7.10.jar and libs-1.7.10.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,writeFile,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url));
const research=process.env.MC_RESEARCH||path.join(root,'../../tools/research'),libs=path.join(research,'libs-1.7.10');
const out=path.join(research,'lightgaps-probe'),classes=path.join(out,'classes'),probe=path.join(out,'probe');
await rm(out,{recursive:true,force:true});await mkdir(classes,{recursive:true});await mkdir(probe,{recursive:true});
await exec('unzip',['-q','-o',path.join(research,'minecraft-1.7.10.jar'),'*.class','-d',classes],{maxBuffer:1<<24});
const cp=[probe,classes,...['guava-15.0','log4j-api-2.0-beta9','commons-lang3-3.1','gson-2.2.4'].map(n=>path.join(libs,n+'.jar'))].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(root,'probes/LightGapsProbe.java')],{maxBuffer:1<<24});
const {stdout}=await exec('java',['-cp',cp,'LightGapsProbe'],{maxBuffer:1<<30});
const lines=stdout.trim().split('\n').filter(l=>l.startsWith('{'));
await writeFile(path.join(root,'../public/research/light-gaps-reference.jsonl'),lines.join('\n')+'\n');
console.log('scenario records:',lines.length);
