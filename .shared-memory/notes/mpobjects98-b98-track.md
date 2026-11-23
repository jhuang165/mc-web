# mpobjects98 (batch 98): client predicts a size-0 shears shear; joining snapshot lit stays the live set

## Summary
- **`multiplayer/animal-use.js`** (`predictAnimalUse`): the sheep shear test accepts `held.id === SHEARS` (not just `count(SHEARS) > 0`), and the wear uses `survival.wear(SHEARS, 1, 'held')` so a broken or size-0 pair stays in the hand, as the server (`EntityWorld.shear`, b97). Mooshroom shear wear got the same.
- New test `src/mpobjects98-b98.test.js` (3 tests).

## Evidence
- **Item 1, Port-read plus reasoning (no new bytecode read)**: the joining snapshot's `columns` come from the live world (`chunkViews.columnsFor`) in the Overworld, Nether and End (`snapshotFor`), and native chunk data (S21/S26) is built from the live chunk arrays at the moment the player is added (network handling runs outside the flush), lit lamps/rails being block ids. A live `redstone.lit` is therefore the set matching the columns it ships with; unflushed cells later arrive as a redundant S23 with the shared PlayerInstance flush (harmless, converges). Flushed set would show the client a state older than its own blocks. Left as is, pinned by a test (passes without any fix).
- **Item 2, Port-read**: server `shear` keeps size-0 shears and wears with 'held'; client now matches. Executed record from b97 (`b97mr-sheep-shears-ghost-*`) is the evidence for the native behaviour.

## Verification
- `node --test --test-concurrency=2 src/mpobjects98-b98.test.js`: 3 pass; with animal-use.js reverted: 1 fails (size-0 shear), others pass.
- Neighbours (mpobjects97, corpse79/80, mphorse78, mpanimals61, mpclicks76, mphorseclient77, spexec79): all pass.

## Found wrong in the batch 97 list
- None.

## Follow-ups
- The End snapshot is not pinned by a test (same `snapshotFor` code as the Nether).
- Browser-only: the shear sound and wool appear as before; not viewed.
