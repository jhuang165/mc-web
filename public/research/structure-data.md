# Structure data in Java saves (generation versions 14 and 15)

`src/structure-data.js` writes and reads `data/Mineshaft.dat`, `Village.dat`, `Stronghold.dat` and `Temple.dat` (gzip `MapGenStructureData`, key order and tag order from `structure-nbt.js`). Full 1.7.10 parity is not claimed.

## Export (`region-export.js`)
- Versions 14 (finite) and 15 (streamed): the four `MapGenStructure` range-8 searches (`StructurePopulation.searchChunk`) run over exactly the exported chunks in native coordinates (local key plus world origin), x outer and z inner, in the order mineshaft, village, stronghold, scatteredFeature. Generators use the same numeric seed (`w.javaSeed`, else `javaSeed(record.seed)`) and the biome manager of `ChunkProviderGenerate(seed, JAVA_LANDSCAPES[biome])`, which is what generation builds. Start existence does not depend on terrain, so no world is generated.
- Versions 8-13: unchanged; no data files are written (the old export never wrote Mineshaft data) unless the record carries imported `structureData`, which is then re-exported as is.
- `report.structureData` gives generated/imported counts and files.

## Import (`region-import.js`)
`importJavaRegionArea(regions, {structureData: [{filename, bytes}]})` parses each `*.dat` with `structure-nbt.js` tag readers, counts starts and ids (`report.structures.unknownIds`, e.g. `Fortress`), lists corrupt files in `invalid` and never throws on them. The gzip bytes are kept in `record.structureData` (`{Name: base64}`) only when the imported area is aligned with the generator frame (otherwise coordinates would not match the browser world; `kept:false`).

Decision: merge, native precedence. On export, imported start compounds are kept as raw tags (unknown ids and pieces survive unchanged), regenerated starts are added only for keys the file lacks; versions 8-13 re-export the imported files unchanged. Merge order is imported first, then new starts, in `HashMap` key order.

## Native evidence
`node tools/verify-structure-data.mjs` (needs the research JAR as in `verify-structure-nbt.mjs`) compiles `tools/probes/StructureDataExportProbe.java`, which runs the unchanged `ChunkProviderGenerate.provideChunk` over a rectangle of chunks and saves each private `MapGenStructureData` with `CompressedStreamTools`. It requires the gunzipped JS files to be byte-identical and writes `structure-data-reference.json` (4 worlds, 16 files: 4 Mineshaft, 3 Village, 1 Stronghold, 3 Temple starts). Seed 17 with x -7..13, z -58..-50 holds all of village, stronghold, temple and mineshafts. Result: all 16 files equal after gunzip. Gzip bytes themselves differ in header/compressor details and are not compared.

`src/structure-data.test.js` replays the reference for v14 and v15, checks that v8-13 write nothing, import counting with an unknown Fortress start and a corrupt file, round trips export to import to export, and a full `exportJavaSave`.

## Limits
- Saves record starts only; piece contents are not in a save-folder chunk NBT here. Exports keep the standing limit that Java regenerates beyond provided columns.
- Streamed v15 exports search the exported columns exactly like finite; streaming's per-cell generation order is not modelled (start existence is order independent).
- Unaligned imports drop structure data (reported). HashMap order is modelled for Java 8+ only.
