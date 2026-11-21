import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// b89 lead: DimensionLive.arrive deletes record.transit before launch runs, so launch must read the trip from tripArrival.
test('launch takes the away-run idle ticks from the saved trip, not the deleted record.transit', () => {
  const main = readFileSync(new URL('./main.js', import.meta.url), 'utf8');
  const launch = main.slice(main.indexOf('async function launch('));
  assert.match(launch, /awayIdle = !world\.dimension && tripArrival \? dims\.takeIdle\(\) : null;/);
  const arrive = readFileSync(new URL('./dimension-live.js', import.meta.url), 'utf8');
  assert.match(arrive, /const t = record\.transit; delete record\.transit;/);
});
