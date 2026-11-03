import java.lang.reflect.*;
import java.util.*;

// Records the unchanged ChunkProviderGenerate.provideChunk structure-search pass
// with map features enabled. The provider itself decides the generator order.
// World terrain is generated natively; native start maps and World.rand are emitted
// for replay by src/structure-population.test.js.
public class StructurePopulationProbe {
  static final List<String> ORDER = new ArrayList<>();
  static class M extends asw { public void a(apu p, ahb w, int x, int z, aji[] b) { ORDER.add("mineshaft"); super.a(p,w,x,z,b); } }
  static class V extends avn { public void a(apu p, ahb w, int x, int z, aji[] b) { ORDER.add("village"); super.a(p,w,x,z,b); } }
  static class S extends aug { public void a(apu p, ahb w, int x, int z, aji[] b) { ORDER.add("stronghold"); super.a(p,w,x,z,b); } }
  static class T extends atx { public void a(apu p, ahb w, int x, int z, aji[] b) { ORDER.add("scatteredFeature"); super.a(p,w,x,z,b); } }
  static class W extends SpringProbe.G {
    public ahu a(int x, int z) { return manager.a(x, z); }
    public ayl a(Class c, String name) { return null; }
    public void a(String name, ayl data) {}
  }
  static String q(String s) { return TerrainProbe.q(s); }
  static String list(Collection<?> values) { StringJoiner out = new StringJoiner(",", "[", "]"); for (Object v : values) out.add(v instanceof String ? q((String)v) : String.valueOf(v)); return out.toString(); }
  static String type(Object o) {
    if (o instanceof asw) return "mineshaft";
    if (o instanceof avn) return "village";
    if (o instanceof aug) return "stronghold";
    if (o instanceof atx) return "scatteredFeature";
    return null;
  }
  static Map<?,?> starts(Object generator) throws Exception {
    for (Class<?> c = generator.getClass(); c != null; c = c.getSuperclass())
      for (Field f : c.getDeclaredFields()) if (Map.class.isAssignableFrom(f.getType())) { f.setAccessible(true); Object value = f.get(generator); if (value instanceof Map) return (Map<?,?>)value; }
    throw new NoSuchFieldException("structure map on " + generator.getClass());
  }
  static void run(long seed, int chunkX, int chunkZ) throws Exception {
    TerrainProbe.resetMesa();
    W world = SpringProbe.world(W.class, seed, 0L);
    TerrainProbe.W biomeWorld = TerrainProbe.world(seed, ahm.b);
    world.manager = biomeWorld.manager; world.info = biomeWorld.info;
    TerrainProbe.set(world.info, "a", seed);
    for (Field f : ays.class.getDeclaredFields()) if (f.getType() == ahm.class) { f.setAccessible(true); f.set(world.info, ahm.b); }
    TerrainProbe.set(world, "s", new Random(0L));
    aqz provider = new aqz(world, seed, true);
    TerrainProbe.set(provider, "w", new M()); TerrainProbe.set(provider, "v", new V());
    TerrainProbe.set(provider, "u", new S()); TerrainProbe.set(provider, "x", new T());
    ORDER.clear();
    provider.d(chunkX, chunkZ); // native terrain, caves, ravines, then four map start searches
    Map<String,Object> structures = new LinkedHashMap<>();
    for (Field f : aqz.class.getDeclaredFields()) {
      if (!ave.class.isAssignableFrom(f.getType())) continue;
      f.setAccessible(true); Object value = f.get(provider); String name = type(value);
      if (name == null) continue;
      Map<?,?> map = starts(value); List<String> keys = new ArrayList<>();
      for (Object start : map.values()) { avm s = (avm)start; keys.add("["+s.e()+","+s.f()+"]"); }
      structures.put(name, "{\"size\":" + map.size() + ",\"keys\":" + list(keys) + "}");
    }
    StringJoiner fields = new StringJoiner(",", "{", "}");
    for (Map.Entry<String,Object> e : structures.entrySet()) fields.add(q(e.getKey()) + ":" + e.getValue());
    System.out.println("{\"kind\":\"search\",\"seed\":" + q(""+seed) + ",\"chunk\":["+chunkX+","+chunkZ+"],\"searchOrder\":"+list(ORDER)+",\"structures\":"+fields+",\"worldNextLong\":"+q(""+((Random)TerrainProbe.get(world,"s")).nextLong())+"}");
  }
  public static void main(String[] args) throws Exception {
    Field f = sun.misc.Unsafe.class.getDeclaredField("theUnsafe"); f.setAccessible(true); TerrainProbe.unsafe = (sun.misc.Unsafe)f.get(null); aji.p();
    run(0L, 0, 0);
    run(0L, -19, 18);
    run(17L, -25, 5);
    run(17L, -4, -55);
    run(17L, 10, -53);
  }
}
