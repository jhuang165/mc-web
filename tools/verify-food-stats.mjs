import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {Survival} from '../src/survival.js';

const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url));
const jar=path.join(root,'research/minecraft-1.7.10.jar'),classes=path.join(root,'research/probe-classes');
const jarBytes=await readFile(jar);
assert.equal(createHash('sha1').update(jarBytes).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
await mkdir(classes,{recursive:true});
await exec('javac',['-cp',jar,'-d',classes,path.join(root,'probes/FoodStatsProbe.java')]);
// Load the unchanged isolated class from a directory alongside our test doubles.
// The complete signed game JAR is not launched or modified.
const {stdout:bytecode}=await exec('unzip',['-p',jar,'zr.class'],{encoding:'buffer'});
await writeFile(path.join(classes,'zr.class'),bytecode);
const {stdout}=await exec('java',['-cp',classes,'FoodStatsProbe']);
const original=stdout.trim().split('\n').map(s=>JSON.parse(s));
const actual=[];
function snapshot(name,p){actual.push({case:name,health:p.health,food:p.food,saturation:p.saturation,exhaustion:p.exhaustion});}
let p=new Survival();snapshot('initial',p);p.exhaust(4);p.tick();snapshot('exact-threshold',p);p.exhaust(.01);p.tick();snapshot('above-threshold',p);
p=new Survival({food:12,saturation:0,inventory:{200:1}});p.eat(200);snapshot('apple',p);
p=new Survival({health:18,food:18});for(let i=0;i<79;i++)p.tick();snapshot('regen-79',p);p.tick();snapshot('regen-80',p);
p=new Survival({health:2,food:0,saturation:0});for(let i=0;i<160;i++)p.tick();snapshot('normal-starvation',p);
assert.equal(actual.length,original.length);
for(let i=0;i<actual.length;i++){assert.equal(actual[i].case,original[i].case);for(const key of ['health','food','saturation','exhaustion'])assert.ok(Math.abs(actual[i][key]-original[i][key])<1e-6,`${actual[i].case}: ${key}: JS ${actual[i][key]}, original ${original[i][key]}`);}
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',class:'zr (FoodStats)',classSha256:createHash('sha256').update(bytecode).digest('hex'),method:'Original unchanged class run against minimal Normal-difficulty world/player test doubles; compared to JS within 1e-6.',cases:original};
await writeFile(path.join(root,'../public/research/foodstats-reference.json'),JSON.stringify(reference,null,2)+'\n');
console.log(`PASS: ${original.length} original-bytecode cases; ${original.length*4} numeric comparisons. No original code is included in the website.`);
