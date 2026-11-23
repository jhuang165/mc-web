// Batch 98 entnbt98: Fire, Air, PortalCooldown, Invulnerable and Dimension on generic entities through the real classes (tools/probes/Entnbt98Probe.java, run beside
// the entnbt97 probe classes) -> public/research/entnbt98-reference.json; src/entnbt98-b98.test.js replays it.
// Run: java -cp <probe classes + libs + jar> Entnbt98Probe > out.json (see tools/verify-entnbt97.mjs for the classpath); then: node tools/verify-entnbt98.mjs out.json [player-rows.jsonl]
import {readFile,writeFile} from 'node:fs/promises';import assert from 'node:assert/strict';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url)),o=JSON.parse(await readFile(process.argv[2],'utf8'));
const keep=new Set(['Fire','Air','PortalCooldown','Invulnerable','Dimension']);
const slim=s=>{assert.ok(!s.startsWith('!'),s);return s.split(';').filter(x=>keep.has(x.split('=')[0])).join(';');};
const edge=o.edge.map(r=>{assert.equal(slim(r[2]),slim(r[3]));return [r[0],r[1],slim(r[2])];});
assert.equal(edge.length,960);
// player rows (Entnbt98PlayerProbe output, one JSON object per line): [name, written keys]
const pkeep=new Set(['HealF','Health','foodSaturationLevel','foodExhaustionLevel']);
const players=process.argv[3]?(await readFile(process.argv[3],'utf8')).trim().split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l)).map(r=>{assert.ok(!r.error,r.name);return {name:r.name,out:r.out.split(';').filter(x=>pkeep.has(x.split('=')[0])).join(';')};}):[];
await writeFile(path.join(root,'../public/research/entnbt98-reference.json'),JSON.stringify({target:'Minecraft Java 1.7.10',method:'Executed on the unchanged 1.7.10 classes (Entnbt98Probe): /summon of 20 ids with edge Fire, Air, PortalCooldown, Invulnerable and Dimension tags, written with Entity.writeToNBTOptional and the same after an sg.a reload. Rows: [id, tag, written keys]. players (Entnbt98PlayerProbe): a real EntityPlayerMP loaded with one NaN or infinite food/health value and written again.',edge,players})+'\n');
console.log(edge.length+' rows');
