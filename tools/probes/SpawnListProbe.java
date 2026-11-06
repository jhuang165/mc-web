import java.lang.reflect.*;
import java.util.*;

// Unchanged 1.7.10 natural spawning data and behaviour: EnumCreatureType (sx), every BiomeGenBase (ahu.n()) spawn list
// (ahu.a(sx): monster, creature, waterCreature and ambient/cave), BiomeGenBase.getSpawningChance (g()), EntityLiving
// .getMaxSpawnedInChunk (sw.bB()) per EntityList class, the creature types each class counts as (World.countEntities uses
// Class.isAssignableFrom), the Nether fortress (MapGenNetherBridge, atd) and witch hut (MapGenScatteredFeature, atx) lists,
// the java.util.HashMap iteration order of the eligible-chunk map, and seeded replays of SpawnerAnimals.findChunksForSpawning
// (aho.a(mt, ZZZ)) on a constructor-less WorldServer double: a stone/grass terrain with water ponds, a fixed biome per
// chunk, zero sky and block light, full light for EntityAnimal's getFullBlockLightValue, a 31 October calendar and
// NORMAL difficulty. Light 0 makes EntityMob.isValidLightLevel independent of the unseeded entity Random, terrain at
// y >= 64 keeps slimes out (posY < 40 or swamp), and there is no air below y 63 with a solid floor, so bats never pass:
// every outcome then depends only on the seeded World.rand, which the browser port replays.
public class SpawnListProbe {
  static String q(String s) {
    StringBuilder b = new StringBuilder("\"");
    for (char c : s.toCharArray()) { if (c == '"' || c == '\\') b.append('\\'); b.append(c); }
    return b.append('"').toString();
  }
  static Map<Class<?>, String> names = new HashMap<>();
  static String name(Class<?> c) { String n = names.get(c); return n != null ? n : c.getName(); }
  static Field seedField;
  static sun.misc.Unsafe u;
  static long seedOf(Random r) throws Exception { return ((java.util.concurrent.atomic.AtomicLong) u.getObject(r, u.objectFieldOffset(seedField))).get(); }

  static final int[] BIOMES = {4, 27, 21, 5, 2, 14, 3, 12}; // no horses: EntityHorse.onSpawnWithEgg rolls foals (smaller boxes) on the unseeded entity Random
  static int biomeId(int cx, int cz) { return BIOMES[Math.floorMod(cx * 7 + cz * 3, 8)]; }
  static int surface(int x, int z) { return 64 + (((x >> 3) + (z >> 3)) & 3); } // first air block
  static boolean pond(int x, int z) {
    int cx = x >> 4, cz = z >> 4, lx = x & 15, lz = z & 15;
    return Math.floorMod(cx + 2 * cz, 5) == 0 && lx >= 4 && lx <= 11 && lz >= 4 && lz <= 11;
  }
  static int blockId(int x, int y, int z) {
    if (y < 0 || y > 255) return 0;
    int s = surface(x, z);
    if (pond(x, z)) return y < 50 ? 1 : y < 62 ? 9 : 0;
    return y < s - 1 ? 1 : y == s - 1 ? 2 : 0;
  }

  public static class S extends mt {
    S() { super(null, null, null, 0, null, null); }
    List<sa> loaded, spawned;
    Map<Long, apx> chunks;
    r spawnPoint;
    ays info;
    public aji a(int x, int y, int z) { return aji.e(blockId(x, y, z)); }
    public int e(int x, int y, int z) { return 0; }
    public ahu a(int x, int z) { return ahu.n()[biomeId(x >> 4, z >> 4)]; }
    public apx e(int cx, int cz) {
      long key = ((long) cx << 32) ^ (cz & 0xffffffffL);
      apx c = chunks.get(key);
      if (c == null) {
        c = new apx(this, cx, cz);
        int top = 0;
        for (int x = 0; x < 16; x++) for (int z = 0; z < 16; z++) for (int y = 255; y >= 0; y--)
          if (blockId(cx * 16 + x, y, cz * 16 + z) != 0) { top = Math.max(top, y); break; }
        try {
          apz[] st = (apz[]) MobMoveProbe.field(apx.class, "u").get(c);
          for (int i = 0; i <= top >> 4; i++) st[i] = new apz(i << 4, true);
        } catch (Exception ex) { throw new RuntimeException(ex); }
        chunks.put(key, c);
      }
      return c;
    }
    public apx d(int x, int z) { return e(x >> 4, z >> 4); }
    public boolean d(int x, int y, int z) { return true; }
    public boolean b(int x0, int y0, int z0, int x1, int y1, int z1) { return true; }
    public r K() { return spawnPoint; }
    public ays N() { return info; }
    public long H() { return 99L; }
    public boolean P() { return false; }
    public boolean Q() { return false; }
    public int b(ahn type, int x, int y, int z) { return 0; }
    public int a(ahn type, int x, int y, int z) { return 0; }
    public int k(int x, int y, int z) { return 0; }
    public int j(int x, int y, int z) { return 15; }
    public float n(int x, int y, int z) { return 0F; }
    public float y() { return 1F; }
    public float b(double x, double y, double z) { return 0F; }
    public Calendar V() { Calendar c = Calendar.getInstance(); c.set(2014, Calendar.OCTOBER, 31); return c; }
    public boolean d(sa e) { loaded.add(e); spawned.add(e); return true; }
    public void a(sa e, String sound, float volume, float pitch) {}
    public void a(double x, double y, double z, String sound, float volume, float pitch) {}
    public void a(String particle, double x, double y, double z, double a, double b, double c) {}
    // spawnRandomCreature: ChunkProviderGenerate.getPossibleCreatures without the witch hut, then WeightedRandom on World.rand.
    public ahx a(sx type, int x, int y, int z) {
      List list = a(x, z).a(type);
      return list == null || list.isEmpty() ? null : (ahx) qv.a(this.s, list);
    }
    public List b(sa entity, azt box) { return a(entity, box, (sj) null); }
    public List a(sa entity, azt box, sj selector) {
      List<sa> out = new ArrayList<>();
      for (sa e : loaded) if (e != entity && e.C.b(box) && (selector == null || selector.a(e))) out.add(e);
      return out;
    }
    public List a(Class cls, azt box) { return a(cls, box, (sj) null); }
    public List a(Class cls, azt box, sj selector) {
      List<sa> out = new ArrayList<>();
      for (sa e : loaded) if (cls.isAssignableFrom(e.getClass()) && e.C.b(box) && (selector == null || selector.a(e))) out.add(e);
      return out;
    }
    public List a(sa entity, azt box) {
      List<azt> out = new ArrayList<>();
      for (int x = (int) Math.floor(box.a); x < (int) Math.floor(box.d + 1); x++)
        for (int y = (int) Math.floor(box.b) - 1; y < (int) Math.floor(box.e + 1); y++)
          for (int z = (int) Math.floor(box.c); z < (int) Math.floor(box.f + 1); z++)
            a(x, y, z).a(this, x, y, z, box, out, entity);
      return out;
    }
  }

  static S world(long seed, int sx, int sy, int sz) throws Exception {
    S w = (S) u.allocateInstance(S.class);
    MobMoveProbe.set(w, "t", u.allocateInstance(aqq.class));
    MobMoveProbe.field(ahb.class, "s").set(w, new Random(seed));
    MobMoveProbe.set(w, "C", new qi());
    MobMoveProbe.field(ahb.class, "r").set(w, rd.c);
    MobMoveProbe.field(ahb.class, "h").set(w, new ArrayList());
    MobMoveProbe.field(ahb.class, "L").set(w, new ArrayList());
    MobMoveProbe.field(ahb.class, "e").set(w, new ArrayList());
    ays info = (ays) u.allocateInstance(ays.class);
    MobMoveProbe.field(ays.class, "b").set(info, ahm.b);
    w.info = info;
    w.loaded = (List<sa>) MobMoveProbe.field(ahb.class, "e").get(w); // loadedEntityList, which countEntities reads
    w.spawned = new ArrayList<>(); w.chunks = new HashMap<>();
    w.spawnPoint = new r(sx, sy, sz);
    return w;
  }
  static SpawnEggProbe.P player(S w, double x, double y, double z) throws Exception {
    SpawnEggProbe.P p = (SpawnEggProbe.P) u.allocateInstance(SpawnEggProbe.P.class);
    MobMoveProbe.set(p, "o", w); MobMoveProbe.set(p, "Z", new Random(5)); MobMoveProbe.set(p, "C", azt.a(0, 0, 0, 0, 0, 0));
    MobMoveProbe.set(p, "bE", new yw());
    MobMoveProbe.set(p, "s", x); MobMoveProbe.set(p, "t", y); MobMoveProbe.set(p, "u", z);
    return p;
  }
  static String list(List l) throws Exception {
    StringBuilder b = new StringBuilder("[");
    for (Object o : l) {
      ahx e = (ahx) o;
      if (b.length() > 1) b.append(',');
      b.append("[" + q(name(e.b)) + "," + MobMoveProbe.field(qw.class, "a").getInt(e) + "," + e.c + "," + e.d + "]");
    }
    return b.append("]").toString();
  }
  static String entity(sa e) throws Exception {
    StringBuilder b = new StringBuilder("[" + q(name(e.getClass())) + "," + e.s + "," + e.t + "," + e.u + "," + e.y);
    String extra = "";
    if (e instanceof wp) extra = "fleece:" + ((wp) e).bZ();
    if (e instanceof yq) extra = "child:" + ((yq) e).f() + ",villager:" + ((yq) e).cb();
    if (e instanceof rx) extra += (extra.isEmpty() ? "" : ",") + "age:" + ((rx) e).d();
    if (e.m != null) extra += ",riding:" + name(e.m.getClass());
    return b.append("," + q(extra) + "]").toString();
  }

  public static void main(String[] args) throws Exception {
    aji.p();
    adb.l();
    u = MobMoveProbe.unsafe();
    seedField = Random.class.getDeclaredField("seed");
    for (String f : new String[] {"c", "d", "e", "f", "g"}) {
      Map m = (Map) MobMoveProbe.field(sg.class, f).get(null);
      if (!m.isEmpty() && m.keySet().iterator().next() instanceof Class && m.values().iterator().next() instanceof String)
        for (Object k : m.keySet()) names.put((Class<?>) k, (String) m.get(k));
    }
    // creature types in values() order
    StringBuilder t = new StringBuilder("{\"case\":\"types\",\"types\":[");
    for (sx type : sx.values()) {
      if (t.charAt(t.length() - 1) != '[') t.append(',');
      String mat = type.c() == awt.a ? "air" : type.c() == awt.h ? "water" : "other";
      t.append("{\"name\":" + q(type.name()) + ",\"class\":" + q(type.a().getName()) + ",\"max\":" + type.b() + ",\"material\":" + q(mat) + ",\"peaceful\":" + type.d() + ",\"animal\":" + type.e() + "}");
    }
    System.out.println(t.append("]}"));
    // biomes
    // `index` is the slot in the biome array (the chunk's biome byte); `id` the biome's own biomeID field (slot 161 holds 160).
    ahu[] all = ahu.n();
    for (int i = 0; i < all.length; i++) {
      ahu b = all[i];
      if (b == null) continue;
      StringBuilder o = new StringBuilder("{\"case\":\"biome\",\"index\":" + i + ",\"id\":" + b.ay + ",\"name\":" + q(b.af) + ",\"class\":" + q(b.getClass().getName()) + ",\"chance\":" + b.g());
      for (sx type : sx.values()) o.append("," + q(type.name()) + ":" + list(b.a(type)));
      System.out.println(o.append("}"));
    }
    // per EntityList class: getMaxSpawnedInChunk and the types it counts as
    S w0 = world(1, 0, 64, 0);
    TreeMap<String, Class<?>> sorted = new TreeMap<>();
    for (Map.Entry<Class<?>, String> e : names.entrySet()) sorted.put(e.getValue(), e.getKey());
    for (Map.Entry<String, Class<?>> e : sorted.entrySet()) {
      Class<?> c = e.getValue();
      StringBuilder o = new StringBuilder("{\"case\":\"entity\",\"name\":" + q(e.getKey()) + ",\"class\":" + q(c.getName()) + ",\"counts\":[");
      boolean first = true;
      for (sx type : sx.values()) if (type.a().isAssignableFrom(c)) { o.append((first ? "" : ",") + q(type.name())); first = false; }
      o.append("]");
      if (sw.class.isAssignableFrom(c) && !Modifier.isAbstract(c.getModifiers())) {
        try { sw l = (sw) c.getConstructor(ahb.class).newInstance(w0); o.append(",\"maxInChunk\":" + l.bB()); }
        catch (Throwable ex) { o.append(",\"maxInChunk\":null"); }
      }
      System.out.println(o.append("}"));
    }
    System.out.println("{\"case\":\"structures\",\"fortress\":" + list(new atd().b()) + ",\"witchHut\":" + list(new atx().b()) + "}");
    // HashMap<ChunkCoordIntPair, Boolean> key order as findChunksForSpawning fills it for one player.
    for (int[] pc : new int[][] {{0, 0}, {5, -3}, {-100, 37}, {1000, -2000}, {-1, -1}}) {
      HashMap<agu, Boolean> m = new HashMap<>();
      for (int dx = -8; dx <= 8; dx++) for (int dz = -8; dz <= 8; dz++) {
        boolean edge = dx == -8 || dx == 8 || dz == -8 || dz == 8;
        agu k = new agu(dx + pc[0], dz + pc[1]);
        if (!edge) m.put(k, false); else if (!m.containsKey(k)) m.put(k, true);
      }
      StringBuilder o = new StringBuilder("{\"case\":\"order\",\"player\":[" + pc[0] + "," + pc[1] + "],\"keys\":[");
      boolean first = true;
      for (agu k : m.keySet()) { o.append((first ? "" : ",") + "[" + k.a + "," + k.b + "," + (m.get(k) ? 1 : 0) + "]"); first = false; }
      System.out.println(o.append("]}"));
    }
    // canCreatureTypeSpawnAtLocation on the replay terrain: one column string per type, '1' where allowed, y 46..70.
    for (int[] col : new int[][] {{8, 8}, {3, 3}, {20, 9}, {-7, 14}, {6, 70}}) {
      StringBuilder o = new StringBuilder("{\"case\":\"location\",\"x\":" + col[0] + ",\"z\":" + col[1]);
      for (sx type : sx.values()) {
        StringBuilder s = new StringBuilder();
        for (int y = 46; y <= 70; y++) s.append(aho.a(type, w0, col[0], y, col[1]) ? '1' : '0');
        o.append("," + q(type.name()) + ":" + q(s.toString()));
      }
      System.out.println(o.append("}"));
    }
    // seeded findChunksForSpawning replays
    Object[][] scenarios = {
      {"near", 1L, 8.5, 70.0, 8.5, 0, 64, 0, 120, 40},
      {"far", 42L, 300.5, 70.0, -199.5, 0, 64, 0, 160, 50},
      {"negative", 7L, -1000.5, 72.0, 517.5, -1000, 66, 520, 80, 1},
    };
    for (Object[] sc : scenarios) {
      S w = world((Long) sc[1], (Integer) sc[5], (Integer) sc[6], (Integer) sc[7]);
      w.h.add(player(w, (Double) sc[2], (Double) sc[3], (Double) sc[4]));
      aho spawner = new aho();
      int ticks = (Integer) sc[8], every = (Integer) sc[9];
      StringBuilder o = new StringBuilder("{\"case\":\"replay\",\"name\":" + q((String) sc[0]) + ",\"seed\":" + sc[1] + ",\"player\":[" + sc[2] + "," + sc[3] + "," + sc[4] + "],\"spawn\":[" + sc[5] + "," + sc[6] + "," + sc[7] + "],\"ticks\":" + ticks + ",\"animalsEvery\":" + every + ",\"steps\":[");
      for (int tick = 0; tick < ticks; tick++) {
        w.spawned.clear();
        int total = spawner.a(w, true, true, tick % every == 0);
        StringBuilder sp = new StringBuilder("[");
        for (sa e : w.spawned) { if (sp.length() > 1) sp.append(','); sp.append(entity(e)); }
        o.append((tick == 0 ? "" : ",") + "{\"total\":" + total + ",\"seed\":" + q(Long.toString(seedOf(w.s))) + ",\"spawned\":" + sp + "]}");
      }
      System.out.println(o.append("]}"));
    }
  }
}
