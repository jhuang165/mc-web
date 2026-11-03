import java.io.*;
import java.lang.reflect.*;
import java.util.*;

// Unchanged native structure data as a server saves it (1.7.10): the real ChunkProviderGenerate.provideChunk
// (terrain, caves, ravines, then the four MapGenStructure range-8 searches) is called for a rectangle of chunks,
// x outer / z inner, with the private MapGenStructureData of each generator read afterwards. Emits the gzip
// data/<Name>.dat bytes (CompressedStreamTools.writeCompressed of the named root, as MapStorage.saveData
// writes them), the raw uncompressed bytes and the start keys in file order.
// STRUCTURE_DATA_SCENARIOS = seed:x0:x1:z0:z1 (one world per JVM; native class statics make a second run differ).
public class StructureDataExportProbe {
  static final String[] GENERATORS = {"mineshaft", "village", "stronghold", "scatteredFeature"};
  static final String[] DATA_NAMES = {"Mineshaft", "Village", "Stronghold", "Temple"};
  static String q(String s) { return TerrainProbe.q(s); }

  public static void main(String[] args) throws Exception {
    Field uf = sun.misc.Unsafe.class.getDeclaredField("theUnsafe"); uf.setAccessible(true); TerrainProbe.unsafe = (sun.misc.Unsafe)uf.get(null); aji.p(); adb.l();
    String[] f = System.getenv("STRUCTURE_DATA_SCENARIOS").split(":");
    long seed = Long.parseLong(f[0]); int x0 = Integer.parseInt(f[1]), x1 = Integer.parseInt(f[2]), z0 = Integer.parseInt(f[3]), z1 = Integer.parseInt(f[4]);
    ahm type = ahm.b;
    TerrainProbe.resetMesa(); StructureNbtProbe.DW w = SpringProbe.world(StructureNbtProbe.DW.class, seed, 0L);
    w.carts = new ArrayList<>(); w.animals = new ArrayList<>(); w.manager = new aib(seed, type);
    w.info = (ays)TerrainProbe.unsafe.allocateInstance(ays.class); TerrainProbe.set(w.info, "a", seed);
    for (Field fl : ays.class.getDeclaredFields()) if (fl.getType() == ahm.class) { fl.setAccessible(true); fl.set(w.info, type); }
    aqz gen = new aqz(w, seed, true); w.halo = new aqz(w, seed, false);
    ave[] g = {new StructurePopulationWorldProbe.M(), new StructurePopulationWorldProbe.V(), new StructurePopulationWorldProbe.S(), new StructurePopulationWorldProbe.T()};
    TerrainProbe.set(gen, "w", g[0]); TerrainProbe.set(gen, "v", g[1]); TerrainProbe.set(gen, "u", g[2]); TerrainProbe.set(gen, "x", g[3]);
    int n = 0;
    for (int x = x0; x <= x1; x++) for (int z = z0; z <= z1; z++) { gen.d(x, z); n++; }
    StringJoiner gz = new StringJoiner(",", "{", "}"), raw = new StringJoiner(",", "{", "}"), keys = new StringJoiner(",", "{", "}");
    for (int i = 0; i < 4; i++) {
      avj d = StructureNbtProbe.data(g[i]); dh root = StructureNbtProbe.root(d);
      gz.add(q(DATA_NAMES[i]) + ":" + q(StructureNbtProbe.b64(du.a(root))));
      raw.add(q(DATA_NAMES[i]) + ":" + q(StructureNbtProbe.b64(StructureNbtProbe.raw(root))));
      keys.add(q(DATA_NAMES[i]) + ":" + StructureNbtProbe.keyList(d.a()));
    }
    System.out.println("{\"seed\":" + q("" + seed) + ",\"range\":[" + x0 + "," + x1 + "," + z0 + "," + z1 + "],\"chunks\":" + n + ",\"gzip\":" + gz + ",\"raw\":" + raw + ",\"keys\":" + keys + "}");
  }
}
