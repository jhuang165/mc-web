# Play a Java chunk terrain preview

From the game repository, give the converter a region filename, global chunk X and Z, and a new output path.

```sh
node tools/preview-java-chunk.mjs r.-1.1.mca -1 32 preview.blockworld.json
```

Choose **Import** in the world list and select the output file. Open the new Creative world. The 16×16 terrain patch begins at browser block (64, 64) and preserves Y from 0 through 255. The starting position is on the generated terrain immediately south of the patch. Surrounding terrain comes from Java generator seed 1710.

The converter checks both the region filename and the selected slot's embedded coordinates. It opens the source read-only and requires a fresh output filename. Its report counts unmapped blocks replaced by air and cells with approximate mappings or separate runtime state. Metadata supported directly by the block registry travels with the cell. Entities, tile contents, scheduled work, biome data and original lighting are outside the terrain preview. The browser initializes its own simulation.

The restore regression exercises high metadata-bearing wool, unsupported blocks, clearing generated terrain and a negative source coordinate. Full-fidelity world import remains open.
