import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.*;

// Runs the unchanged MobSpawnerBaseLogic (agq) through TileEntityMobSpawner (apj) and
// its anonymous logic (apk), the unchanged EntityList (sg) factory, EntityCaveSpider (xy),
// EntitySpider (yn), EntityMob (yg), EntityCreature (td) and EntityLiving (sw) spawn checks,
// on a constructor-less World double (allocated like SpiderProbe's). No game class is patched.
//
// The world double supplies: getBlock (rule-based stone floor / encased / water), the saved
// sky light and getBlockLightValue_do (one value per scenario), the entity lists of
// getEntitiesWithinAABB / getEntitiesWithinAABBExcludingEntity (the same isAssignableFrom and
// strict intersectsWith filter as Chunk.getEntitiesOfTypeWithinAAAB), spawnEntityInWorld,
// playAuxSFX, addBlockEvent and spawnParticle capture. World.getClosestPlayer,
// getCollidingBoundingBoxes, checkNoEntityCollision, isAnyLiquid, getLightBrightness and
// isThundering are the original methods. World.rand is an LCG-identical java.util.Random whose
// internal state is readable, so every tick records the exact state after the update.
//
// SeededCaveSpider extends EntityCaveSpider only to seed Entity.rand (normally new Random())
// and to log each getCanSpawnHere call (super's result unchanged). It is registered under
// "CaveSpider" in EntityList's name map; the "real" scenarios restore the original class.
public class MobSpawnerProbe {
  static final long MASK = (1L << 48) - 1;
  public static class Lcg extends Random {
    long state; int calls;
    Lcg(long seed) { super(0); state = (seed ^ 0x5DEECE66DL) & MASK; }
    protected int next(int bits) { calls++; state = (state * 0x5DEECE66DL + 0xBL) & MASK; return (int) (state >>> (48 - bits)); }
  }

  static String terrain = "floor"; static int floorY = 19, sky = 0, light = 0;
  static int SX = 8, SY = 20, SZ = 8;
  static List<sa> entities = new ArrayList<>();
  static List<String> attempts = new ArrayList<>(), spawned = new ArrayList<>(), particles = new ArrayList<>(), boxes = new ArrayList<>();
  static int aux = 0, blockEvents = 0;
  static long seedBase = 0; static int seedIndex = 0;

  static boolean solid(int x, int y, int z) {
    if (x == SX && y == SY && z == SZ) return false;
    if (terrain.equals("encased")) return true;
    return y < floorY;
  }
  static boolean water(int x, int y, int z) { return terrain.equals("water") && y >= floorY && y < floorY + 3 && !(x == SX && y == SY && z == SZ); }

  public static class SpawnerWorld extends ahb {
    SpawnerWorld() { super((azc) null, null, (aqo) null, (ahj) null, null); }
    protected apu j() { return null; }
    protected int p() { return 0; }
    public sa a(int id) { return null; }
    public aji a(int x, int y, int z) {
      if (x == SX && y == SY && z == SZ) return aji.e(52);
      return solid(x, y, z) ? aji.e(1) : water(x, y, z) ? aji.e(9) : aji.e(0);
    }
    public boolean d(int x, int y, int z) { return true; }
    public boolean b(int x0, int y0, int z0, int x1, int y1, int z1) { return true; }
    public int b(ahn type, int x, int y, int z) { return type == ahn.a ? sky : 0; }
    public int b(int x, int y, int z, boolean neighbours) { return light; }
    public boolean d(sa e) { entities.add(e); spawned.add("[" + e.s + "," + e.t + "," + e.u + "," + (double) e.y + "]"); return true; }
    public void c(int id, int x, int y, int z, int data) { if (id == 2004 && x == SX && y == SY && z == SZ && data == 0) aux++; }
    public void c(int x, int y, int z, aji block, int id, int data) { blockEvents++; }
    public void a(String name, double x, double y, double z, double vx, double vy, double vz) { particles.add("[\"" + name + "\"," + x + "," + y + "," + z + "]"); }
    public void a(sa entity, String sound, float volume, float pitch) {}
    public List a(Class c, azt box, sj selector) {
      List out = new ArrayList();
      for (sa e : entities) if (c.isAssignableFrom(e.getClass()) && e.C.b(box)) out.add(e);
      boxes.add("[" + box.a + "," + box.b + "," + box.c + "," + box.d + "," + box.e + "," + box.f + "," + out.size() + "]");
      return out;
    }
    public List a(sa exclude, azt box, sj selector) {
      List out = new ArrayList();
      for (sa e : entities) if (e != exclude && e.C.b(box)) out.add(e);
      return out;
    }
  }

  public static class SeededCaveSpider extends xy {
    final long seed;
    public SeededCaveSpider(ahb w) {
      // Consecutive seeds give correlated first draws, so each index is mixed (low 48 bits kept).
      super(w); seed = ((seedBase + seedIndex++) * 0x9E3779B97F4A7C15L) & MASK;
      try { MobMoveProbe.set(this, "Z", new Random(seed)); } catch (Exception e) { throw new RuntimeException(e); }
    }
    public boolean by() {
      boolean ok = super.by();
      attempts.add("{\"seed\":" + seed + ",\"x\":" + s + ",\"y\":" + t + ",\"z\":" + u + ",\"yaw\":" + (double) y + ",\"ok\":" + ok + "}");
      return ok;
    }
  }
  public static class Target extends wo {
    public Target(ahb w) { super(w); }
    public boolean a(ro source, float amount) { return true; }
  }

  // A constructor-less EntityPlayer: getClosestPlayer only reads posX/posY/posZ through
  // Entity.getDistanceSq. EntityPlayerMP's posY is the feet.
  public static class ProbePlayer extends yz {
    ProbePlayer() { super(null, null); }
    public r f_() { return null; }
    public boolean a(int level, String command) { return false; }
    public void a(fj message) {}
  }
  static sun.misc.Unsafe U;
  static Lcg rand;
  static SpawnerWorld world() throws Exception {
    SpawnerWorld w = (SpawnerWorld) U.allocateInstance(SpawnerWorld.class);
    for (Field f : ahb.class.getDeclaredFields())
      if ((f.getType() == List.class || f.getType() == ArrayList.class) && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(w, new ArrayList()); }
    MobMoveProbe.set(w, "C", new qi());
    aqq provider = new aqq();
    Method gen = aqo.class.getDeclaredMethod("a"); gen.setAccessible(true); gen.invoke(provider);
    MobMoveProbe.set(w, "t", provider);
    MobMoveProbe.set(w, "r", rd.c);
    return w;
  }
  static Map<String, Class> names() throws Exception { Field f = sg.class.getDeclaredField("c"); f.setAccessible(true); return (Map<String, Class>) f.get(null); }

  static sa player(double x, double y, double z) throws Exception {
    ProbePlayer p = (ProbePlayer) U.allocateInstance(ProbePlayer.class);
    p.s = x; p.t = y; p.u = z;
    return p;
  }

  static String q(String s) { return "\"" + s + "\""; }

  // One scenario: a fresh spawner, `ticks` calls of TileEntityMobSpawner.updateEntity.
  static void scenario(String name, String entityId, boolean real, boolean remote, int difficulty, String ter, int skyLight, int blockLight,
      double[] playerPos, String[] crowd, long worldSeed, int ticks, int blockEventTick) throws Exception {
    terrain = ter; sky = skyLight; light = blockLight;
    entities.clear(); seedBase = worldSeed * 1000; seedIndex = 0;
    Map<String, Class> map = names(); Class original = map.get("CaveSpider");
    if (!real) map.put("CaveSpider", SeededCaveSpider.class);
    SpawnerWorld w = world();
    rand = new Lcg(worldSeed); MobMoveProbe.set(w, "s", rand);
    MobMoveProbe.set(w, "E", remote);
    MobMoveProbe.set(w, "r", rd.values()[difficulty]);
    List players = (List) MobMoveProbe.field(ahb.class, "h").get(w);
    if (playerPos != null) players.add(player(playerPos[0], playerPos[1], playerPos[2]));
    StringBuilder crowdOut = new StringBuilder();
    if (crowd != null) for (String c : crowd) {
      String[] p = c.split(":"); double x = Double.parseDouble(p[1]), y = Double.parseDouble(p[2]), z = Double.parseDouble(p[3]);
      sa e = p[0].equals("cave") ? (real ? new xy(w) : new SeededCaveSpider(w)) : new yn(w);
      e.b(x, y, z, 0f, 0f); entities.add(e);
      crowdOut.append(crowdOut.length() > 0 ? "," : "").append("{\"type\":").append(q(p[0].equals("cave") ? "cave_spider" : "spider")).append(",\"x\":").append(e.s).append(",\"y\":").append(e.t).append(",\"z\":").append(e.u).append("}");
    }
    seedIndex = 0;
    apj tile = new apj(); MobMoveProbe.set(tile, "b", w); tile.c = SX; tile.d = SY; tile.e = SZ;
    agq logic = tile.a(); logic.a(entityId);
    StringBuilder rows = new StringBuilder();
    for (int t = 0; t < ticks; t++) {
      attempts.clear(); spawned.clear(); particles.clear(); boxes.clear(); aux = 0; blockEvents = 0; rand.calls = 0;
      if (t == blockEventTick) tile.c(1, 0);
      tile.h();
      rows.append(rows.length() > 0 ? "," : "").append("{\"t\":").append(t).append(",\"delay\":").append(logic.b);
      if (rand.calls > 0) rows.append(",\"state\":").append(q(Long.toString(rand.state))).append(",\"calls\":").append(rand.calls);
      if (remote) rows.append(",\"rot\":").append(logic.c).append(",\"prev\":").append(logic.d).append(",\"particles\":").append(particles);
      if (!boxes.isEmpty()) rows.append(",\"boxes\":").append(boxes);
      if (!attempts.isEmpty()) rows.append(",\"attempts\":").append(attempts);
      if (!spawned.isEmpty()) rows.append(",\"spawned\":").append(spawned);
      if (aux > 0) rows.append(",\"aux\":").append(aux);
      if (blockEvents > 0) rows.append(",\"blockEvents\":").append(blockEvents);
      rows.append("}");
    }
    map.put("CaveSpider", original);
    dh nbt = new dh(); logic.b(nbt);
    System.out.println("{\"case\":\"scenario\",\"name\":" + q(name) + ",\"entityId\":" + q(entityId) + ",\"real\":" + real + ",\"remote\":" + remote
      + ",\"difficulty\":" + difficulty + ",\"terrain\":" + q(ter) + ",\"floorY\":" + floorY + ",\"sky\":" + skyLight + ",\"light\":" + blockLight
      + ",\"spawner\":[" + SX + "," + SY + "," + SZ + "],\"player\":" + (playerPos == null ? "null" : "[" + playerPos[0] + "," + playerPos[1] + "," + playerPos[2] + "]")
      + ",\"crowd\":[" + crowdOut + "],\"worldSeed\":" + worldSeed + ",\"blockEventTick\":" + blockEventTick + ",\"nbt\":" + q(nbt.toString().replace("\"", "\\\"")) + ",\"ticks\":[" + rows + "]}");
  }

  public static void main(String[] args) throws Exception {
    aji.p(); adb.l();
    U = MobMoveProbe.unsafe();
    double cx = SX + 0.5, cy = SY + 0.5, cz = SZ + 0.5;
    double[] near = {cx + 3, SY - 1, cz + 2};
    // Facts: EntityCaveSpider constructor, attributes, onSpawnWithEgg RNG use and poison.
    SpawnerWorld w = world(); Lcg wr = new Lcg(5); MobMoveProbe.set(w, "s", wr);
    xy cave = new xy(w); yn spider = new yn(w);
    System.out.println("{\"case\":\"facts\",\"width\":" + (double) cave.M + ",\"height\":" + (double) cave.N + ",\"health\":" + cave.a(yj.a).e()
      + ",\"speed\":" + cave.a(yj.d).e() + ",\"damage\":" + cave.a(yj.e).e() + ",\"followRange\":" + cave.a(yj.b).e()
      + ",\"poisonAllowed\":" + cave.d(new rw(19, 100)) + ",\"spiderWidth\":" + (double) spider.M + ",\"spiderHealth\":" + spider.a(yj.a).e() + "}");
    for (int d = 0; d < 4; d++) {
      MobMoveProbe.set(w, "r", rd.values()[d]);
      for (boolean isCave : new boolean[]{true, false}) {
        Target target = new Target(w);
        yn attacker = isCave ? new xy(w) : new yn(w);
        boolean hit = attacker.n(target);
        rw effect = target.b(rv.u);
        System.out.println("{\"case\":\"poison\",\"difficulty\":" + d + ",\"cave\":" + isCave + ",\"hit\":" + hit + ",\"duration\":" + (effect == null ? 0 : effect.b())
          + ",\"amplifier\":" + (effect == null ? -1 : effect.c()) + "}");
      }
    }
    MobMoveProbe.set(w, "r", rd.c);
    for (boolean isCave : new boolean[]{true, false}) {
      yn e = isCave ? new xy(w) : new yn(w); Lcg er = new Lcg(77); MobMoveProbe.set(e, "Z", er);
      e.b(8.5, 20, 8.5, 0f, 0f); wr.calls = 0; Object data = e.a((sy) null);
      System.out.println("{\"case\":\"egg\",\"cave\":" + isCave + ",\"worldCalls\":" + wr.calls + ",\"entityCalls\":" + er.calls + ",\"returnsNull\":" + (data == null) + "}");
    }
    // RenderCaveSpider (bnf) needs LWJGL/GSON to construct; its 0.7F shadow and model scale and
    // texture path are read from bytecode in tools/verify-mob-spawner.mjs instead.

    String[] crowd6 = new String[6], crowd5edge = new String[6], spiders6 = new String[6];
    for (int i = 0; i < 6; i++) {
      crowd6[i] = "cave:" + (cx - 3 + i) + ":" + (SY - 1) + ":" + (cz + 3);
      spiders6[i] = "spider:" + (cx - 3 + i) + ":" + (SY - 1) + ":" + (cz + 3);
      crowd5edge[i] = i < 5 ? crowd6[i] : null;
    }
    // Box from SX - 8 to SX + 9: a 0.7-wide cave spider at SX + 9 + 0.35f touches the max face
    // (not counted, strict intersectsWith); the other at SX - 8 - 0.3 overlaps by 0.05.
    String touching = "cave:" + (SX + 9 + (double) 0.35f) + ":" + (SY - 1) + ":" + cz, overlapping = "cave:" + (SX - 8 - 0.3) + ":" + (SY - 1) + ":" + cz;
    crowd5edge[5] = touching;
    String[] crowdOver = crowd5edge.clone(); crowdOver[5] = overlapping;
    // Players: posY of EntityPlayerMP is the feet. Distance from the centre (8.5, 20.5, 8.5).
    double[] edge = {cx + 16, cy, cz}, inside = {cx + 15.99, cy, cz};
    scenario("dark-open", "CaveSpider", false, false, 2, "floor", 0, 0, near, null, 1, 1800, -1);
    scenario("player-at-16", "CaveSpider", false, false, 2, "floor", 0, 0, edge, null, 2, 60, -1);
    scenario("player-at-15.99", "CaveSpider", false, false, 2, "floor", 0, 0, inside, null, 3, 260, -1);
    scenario("no-player", "CaveSpider", false, false, 2, "floor", 0, 0, null, null, 4, 40, -1);
    scenario("lit-15", "CaveSpider", false, false, 2, "floor", 0, 15, near, null, 5, 60, -1);
    scenario("block-light-4", "CaveSpider", false, false, 2, "floor", 0, 4, near, null, 6, 900, -1);
    scenario("sky-light-15", "CaveSpider", false, false, 2, "floor", 15, 0, near, null, 7, 900, -1);
    scenario("crowded-6", "CaveSpider", false, false, 2, "floor", 0, 0, near, crowd6, 8, 900, -1);
    scenario("crowd-edge-touching", "CaveSpider", false, false, 2, "floor", 0, 0, near, crowd5edge, 9, 700, -1);
    scenario("crowd-edge-overlapping", "CaveSpider", false, false, 2, "floor", 0, 0, near, crowdOver, 10, 300, -1);
    scenario("spiders-not-counted", "CaveSpider", false, false, 2, "floor", 0, 0, near, spiders6, 11, 700, -1);
    scenario("encased", "CaveSpider", false, false, 2, "encased", 0, 0, near, null, 12, 80, -1);
    scenario("water", "CaveSpider", false, false, 2, "water", 0, 0, near, null, 13, 80, -1);
    scenario("peaceful", "CaveSpider", false, false, 0, "floor", 0, 0, near, null, 14, 60, -1);
    scenario("easy", "CaveSpider", false, false, 1, "floor", 0, 0, near, null, 15, 400, -1);
    scenario("real-class", "CaveSpider", true, false, 2, "floor", 0, 0, near, null, 16, 1200, -1);
    scenario("real-crowded", "CaveSpider", true, false, 3, "floor", 0, 0, near, crowd6, 17, 300, -1);
    scenario("spider-spawner-counts-cave", "Spider", true, false, 2, "floor", 0, 0, near, crowd6, 18, 300, -1);
    scenario("spider-spawner", "Spider", true, false, 2, "floor", 0, 0, near, null, 19, 1200, -1);
    scenario("unknown-id", "NoSuchMob", true, false, 2, "floor", 0, 0, near, null, 20, 40, -1);
    scenario("client", "CaveSpider", false, true, 2, "floor", 0, 0, near, null, 21, 260, 120);
    scenario("client-out-of-range", "CaveSpider", false, true, 2, "floor", 0, 0, edge, null, 22, 30, -1);
  }
}
