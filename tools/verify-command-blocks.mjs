import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';
const exec=promisify(execFile), research=process.env.MC_RESEARCH ?? path.resolve('../tools/research'), jar=path.join(research,'minecraft-1.7.10.jar');
const sha1=createHash('sha1').update(await readFile(jar)).digest('hex');
assert.equal(sha1,'e80d9b3bf5085002218d4be59e668bac718abbc6');
const classes=['akb','agp','bl','bfh'], hashes={};
for(const cls of classes) {
  const {stdout}=await exec('javap',['-classpath',jar,'-c','-p',cls],{maxBuffer:1<<24});
  hashes[cls]=createHash('sha256').update(stdout).digest('hex');
  if(cls==='akb') { assert.match(stdout,/iconst_1\s+30: iand/); assert.match(stdout,/public int a\(ahb\);\s+Code:\s+0: iconst_1/); assert.match(stdout,/agp.a:\(Lahb;\)V/); }
  if(cls==='agp') { assert.match(stdout,/iload_1\s+1: iconst_2/); for(const key of ['Command','SuccessCount','CustomName','TrackOutput','LastOutput','HH:mm:ss']) assert.ok(stdout.includes('// String '+key),key); }
  if(cls==='bl') assert.match(stdout,/String commandBlockOutput/);
  if(cls==='bfh') assert.match(stdout,/sipush\s+32767/);
}
await writeFile('public/research/command-block-reference.json',JSON.stringify({target:'Minecraft Java 1.7.10',clientSha1:sha1,evidence:'javap bytecode assertions; no integrated native server execution',classes:hashes,constants:{originalId:137,internalId:139,triggerBit:1,tickRate:1,permissionLevel:2,maxCommandLength:32767}},null,2)+'\n');
console.log('Command block native bytecode assertions passed (akb/agp/bl/bfh).');
