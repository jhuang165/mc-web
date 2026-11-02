# Inspect a Java 1.7.10 region

Run from the game repository with a region copied from a saved world.

```sh
node tools/inspect-java-region.mjs path/to/region/r.-1.0.mca
```

Pass `--no-sky` before the path for a dimension without sky lighting. The command opens the file read-only and prints a JSON report to stdout after every occupied slot validates. An invalid chunk produces an error on stderr with the slot number and a failing exit code.

The report lists world chunk coordinates and counts of entity, tile-entity and scheduled-tick records. The state histogram counts raw block ID and metadata pairs across those chunks, omitting ordinary air (ID 0, metadata 0). Exact and inexact describe the current block registry's conversion result. Unmapped means the Java ID is registered but lacks a browser mapping. Unregistered includes unknown high IDs from Add nibbles. Gameplay behavior and entity contents require separate verification.

Inspection bounds the input to 64 MiB, each inflated chunk to 16 MiB and cumulative inflated data to 256 MiB. It derives expected coordinates from the filename and slot, then checks the embedded coordinates. WORLD-03e regression coverage uses 14 original chunk payloads packed into region containers. Live import remains open.
