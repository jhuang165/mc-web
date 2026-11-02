import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {regionAddress, writeRegion} from './region-file.js';
import {inspectRegion} from './region-inspection.js';

const {cases} = JSON.parse(readFileSync(new URL('../public/research/chunk-nbt-reference.json', import.meta.url)));
test('inspects original chunk payloads at their signed world addresses', async () => {
  for (const c of cases) {
    const {x,z,regionX,regionZ} = regionAddress(c.summary.x,c.summary.z);
    const bytes = writeRegion([{x,z,format:'gzip',compressed:Buffer.from(c.inputGzip,'base64')}]);
    const name = `r.${regionX}.${regionZ}.mca`;
    const report = await inspectRegion(name,bytes,{hasSky:c.hasSky});
    assert.deepEqual(report.chunks,[{slot:x+32*z,x:c.summary.x,z:c.summary.z,entities:0,tileEntities:0,scheduledTicks:c.scheduled.length}]);
    assert.equal(report.states.filter(s=>s.id && s.mapping!=='unregistered').reduce((sum,s)=>sum+s.cells,0),c.summary.sections.reduce((sum,s)=>sum+s[1],0));
    await assert.rejects(inspectRegion(`r.${regionX+1}.${regionZ}.mca`,bytes,{hasSky:c.hasSky}),/slot .*expected chunk/);
  }
});
test('rejects malformed names even for empty regions', async () => {
  for (const name of ['r.0.0.mca\n','other.mca','r.67108864.0.mca']) await assert.rejects(inspectRegion(name,writeRegion([])));
});
