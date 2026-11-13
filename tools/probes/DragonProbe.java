import java.lang.reflect.*;
import java.security.MessageDigest;
import java.util.*;

// Unchanged 1.7.10 EntityDragon (xa), EntityDragonPart (wy) and EntityEnderCrystal (wz) on the End probe's World double:
//   flight       onLivingUpdate (xa.e) ticks with the entity Random seeded: target selection, yaw/speed integration, ring buffer, part boxes
//   ring         getMovementOffsets (xa.b(int, float)) samples
//   damage       attackEntityFromPart for every part, source and amount
//   explosionParts agw.a() (Explosion.doExplosionA) with the dragon's seven parts listed by getEntitiesWithinAABB (Chunk lists getParts): per-part distance damage
//   crystal      bP: nearest crystal within 32, +1 health per 10 ticks, destroyed crystal = 10 damage to the head
//   collide      collideWithEntities / attackEntitiesInList victims (wing push, head 10 damage)
//   destroy      destroyBlocksInAABB over a block grid (obsidian, end stone, bedrock, glass, stone), with mobGriefing true and false
//   death        onDeathUpdate (xa.aF) for 205 ticks with the xp orbs, world event and createEnderPortal
// Prints one JSON object per line with a "case" key.
public class DragonProbe {
  public static class P extends yz {
    P() { super(null, null); }
    public void a(fj message) {}
    public boolean a(int level, String command) { return false; }
    public r f_() { return null; }
  }
  static String q(String s) { return TerrainProbe.q(s); }
  static Field fd(Class<?> c, String n) throws Exception { return TerrainProbe.field(c, n); }
  static String num(double v) { return Double.toString(v); }
  static String hex(MessageDigest d) { return TerrainProbe.hex(d.digest()); }
  static void putLong(MessageDigest d, long v) { for (int s = 56; s >= 0; s -= 8) d.update((byte) (v >> s)); }

  public static class DW extends EndProbe.W {
    List<sa> ents = new ArrayList<>();
    boolean withParts = false;
    int tick = 0;
    List<String> orbAt = new ArrayList<>();
    List<String> parts = new ArrayList<>(), orbs = new ArrayList<>(), events = new ArrayList<>();
    public List b(sa ex, azt box) {
      List<sa> out = new ArrayList<>();
      for (sa e : ents) {
        boolean meets = e != ex && e.C.d > box.a && e.C.a < box.d && e.C.e > box.b && e.C.b < box.e && e.C.f > box.c && e.C.c < box.f;
        if (meets) out.add(e);
        // Chunk.getEntitiesWithinAABBForEntity lists entity.getParts() that meet the box only inside the same branch: the entity's own box must meet it first
        // (batch 16 read this from apx.a(sa, azt, List, sj); the full chunk/slice gate is replayed in DragonSweepProbe)
        if (withParts && meets && e.at() != null) for (sa part : e.at()) if (part != ex && part.C.d > box.a && part.C.a < box.d && part.C.e > box.b && part.C.b < box.e && part.C.f > box.c && part.C.c < box.f) out.add(part);
      }
      return out;
    }
    public List a(Class c, azt box) {
      List<sa> out = new ArrayList<>();
      for (sa e : ents) if (c.isInstance(e) && e.C.d > box.a && e.C.a < box.d && e.C.e > box.b && e.C.b < box.e && e.C.f > box.c && e.C.c < box.f) out.add(e);
      return out;
    }
    public void a(String name, double x, double y, double z, double a, double b, double c) {
      super.a(name, x, y, z, a, b, c);
      parts.add("[" + DragonProbe.q(name) + "," + num(x) + "," + num(y) + "," + num(z) + "]");
    }
    public void b(int type, int x, int y, int z, int data) { events.add("[" + type + "," + x + "," + y + "," + z + "," + data + "]"); }
    public boolean d(sa e) {
      if (e instanceof sq) { orbs.add(Integer.toString(((sq) e).e())); orbAt.add("[" + tick + "," + ((sq) e).e() + "," + num(e.s) + "," + num(e.t) + "," + num(e.u) + "," + num(e.v) + "," + num(e.w) + "," + num(e.x) + "]"); return true; }
      return super.d(e);
    }
    void clear() throws Exception { resetLogs(); parts.clear(); orbs.clear(); events.clear(); orbAt.clear(); tick = 0; }
  }

  static DW world() throws Exception {
    DW w = SpringProbe.world(DW.class, 0, 1);
    w.manager = new aie(ahu.x, 0.0F);
    w.spawned = new ArrayList<>(); w.explosions = new ArrayList<>(); w.blockLog = new StringBuilder();
    w.partDigest = MessageDigest.getInstance("SHA-1");
    w.ents = new ArrayList<>(); w.parts = new ArrayList<>(); w.orbs = new ArrayList<>(); w.events = new ArrayList<>(); w.orbAt = new ArrayList<>();
    aji[] air = new aji[65536]; byte[] meta = new byte[65536];
    for (int cx = -7; cx <= 7; cx++) for (int cz = -7; cz <= 7; cz++) SpringProbe.chunk(w, cx, cz, air.clone(), meta.clone());
    for (int cx = -7; cx <= 7; cx++) for (int cz = -7; cz <= 7; cz++) {
      apx c = w.chunks.get(SpringProbe.G.ck(cx, cz));
      // the blocks array above holds null (air) entries; apx accepts them as air
    }
    return w;
  }

  static xa dragon(DW w, double x, double y, double z, float yaw, long seed) throws Exception {
    xa d = new xa(w);
    fd(sa.class, "Z").set(d, new Random(seed));
    d.b(x, y, z, yaw, 0f);
    return d;
  }
  static yz player(DW w, double x, double y, double z) throws Exception {
    yz p = (yz) TerrainProbe.unsafe.allocateInstance(P.class);
    fd(sa.class, "o").set(p, w);
    fd(sa.class, "s").setDouble(p, x); fd(sa.class, "t").setDouble(p, y); fd(sa.class, "u").setDouble(p, z);
    fd(sa.class, "C").set(p, azt.a(x - 0.3, y, z - 0.3, x + 0.3, y + 1.8, z + 0.3));
    return p;
  }
  static void setHealth(xa d, float h) { d.g(h); }
  static float health(xa d) { return d.aS(); }
  static String box(azt b) { return "[" + num(b.a) + "," + num(b.b) + "," + num(b.c) + "," + num(b.d) + "," + num(b.e) + "," + num(b.f) + "]"; }
  static wy[] partsOf(xa d) { return d.bp; }
  static String boxes(xa d) { StringBuilder s = new StringBuilder("["); for (int i = 0; i < 7; i++) { if (i > 0) s.append(','); s.append(box(d.bp[i].C)); } return s.append(']').toString(); }
  static String state(xa d) {
    return "[" + num(d.s) + "," + num(d.t) + "," + num(d.u) + "," + num(d.y) + "," + num(d.h) + "," + num(d.i) + "," + num(d.bm) + "," + num(d.v) + "," + num(d.w) + "," + num(d.x) + ","
      + num(d.by) + "," + (d.bA ? 1 : 0) + "," + d.bo + "," + num(d.bf()) + "]";
  }
  static float rYaw(xa d) throws Exception { return fd(xa.class, "bf").getFloat(d); }
  static Method priv(String n, Class<?>... t) throws Exception { Method m = xa.class.getDeclaredMethod(n, t); m.setAccessible(true); return m; }

  static void digestState(MessageDigest md, xa d) throws Exception {
    for (double v : new double[] {d.s, d.t, d.u, d.y, d.h, d.i, d.bm, d.v, d.w, d.x, d.by, rYaw(d)}) putLong(md, Double.doubleToLongBits(v));
    md.update((byte) (d.bA ? 1 : 0)); md.update((byte) d.bo);
    for (int i = 0; i < 7; i++) { azt b = d.bp[i].C; for (double v : new double[] {b.a, b.b, b.c, b.d, b.e, b.f}) putLong(md, Double.doubleToLongBits(v)); }
  }

  static void facts() throws Exception {
    DW w = world();
    xa d = dragon(w, 0, 128, 0, 90f, 5);
    StringBuilder pf = new StringBuilder();
    for (int i = 0; i < 7; i++) { wy p = d.bp[i]; if (i > 0) pf.append(','); pf.append("[" + q(p.b) + "," + num(p.M) + "," + num(p.N) + "," + p.R() + "," + num(p.L) + "]"); }
    System.out.println("{\"case\":\"facts\",\"maxHealth\":" + num(d.aY()) + ",\"health\":" + num(d.aS()) + ",\"width\":" + num(d.M) + ",\"height\":" + num(d.N) + ",\"noClip\":" + fd(sa.class, "X").getBoolean(d)
      + ",\"immuneToFire\":" + fd(sa.class, "ae").getBoolean(d) + ",\"ignoreFrustum\":" + fd(sa.class, "ak").getBoolean(d) + ",\"targetY\":" + num(d.i) + ",\"canBeCollidedWith\":" + d.R()
      + ",\"parts\":[" + pf + "],\"partCount\":" + d.at().length + ",\"growl\":" + q(callStr(d, "t")) + ",\"hit\":" + q(callStr(d, "aT")) + ",\"volume\":" + num(callFloat(d, "bf"))
      + ",\"bo\":" + d.bo + ",\"ringLength\":" + d.bn.length + ",\"ringWidth\":" + d.bn[0].length + "}");
  }
  static String callStr(Object o, String n) throws Exception { Method m = findNoArg(o.getClass(), n); return (String) m.invoke(o); }
  static float callFloat(Object o, String n) throws Exception { Method m = findNoArg(o.getClass(), n); return (Float) m.invoke(o); }
  static Method findNoArg(Class<?> c, String n) throws Exception {
    for (; c != null; c = c.getSuperclass()) for (Method m : c.getDeclaredMethods()) if (m.getName().equals(n) && m.getParameterCount() == 0) { m.setAccessible(true); return m; }
    throw new NoSuchMethodException(n);
  }

  // scenario: players are static (x, y, z) positions put in world.playerEntities.
  static void flight(String name, long seed, float yaw, double[][] players, int full, int digest, boolean tickCount) throws Exception {
    DW w = world();
    xa d = dragon(w, 0, 128, 0, yaw, seed);
    List<yz> ps = new ArrayList<>();
    for (double[] p : players) { yz pl = player(w, p[0], p[1], p[2]); ps.add(pl); ((List) fd(ahb.class, "h").get(w)).add(pl); }
    StringBuilder trace = new StringBuilder(), parts = new StringBuilder();
    MessageDigest md = MessageDigest.getInstance("SHA-1");
    w.clear();
    int total = full + digest;
    for (int t = 0; t < total; t++) {
      if (tickCount) d.aa++;
      d.e();
      if (t < full) {
        if (t > 0) trace.append(',');
        trace.append(state(d));
        if (t < 60) { if (t > 0) parts.append(','); parts.append(boxes(d)); }
      } else digestState(md, d);
    }
    System.out.println("{\"case\":\"flight\",\"name\":" + q(name) + ",\"seed\":" + seed + ",\"yaw\":" + num(yaw) + ",\"players\":" + Arrays.deepToString(players) + ",\"full\":" + full + ",\"digestTicks\":" + digest
      + ",\"trace\":[" + trace + "],\"parts\":[" + parts + "],\"digest\":" + q(hex(md)) + ",\"blockWrites\":" + EndProbe.countEntries(w.blockLog) + "}");
  }

  static void ring() throws Exception {
    DW w = world();
    xa d = dragon(w, 3, 100, -4, 20f, 11);
    for (int t = 0; t < 150; t++) d.e();
    StringBuilder out = new StringBuilder();
    int[] ns = {0, 1, 5, 7, 10, 12, 14, 16, 62, 63, 64, 70};
    float[] ps = {0f, 0.25f, 0.5f, 1f};
    for (int n : ns) for (float p : ps) {
      double[] r = d.b(n, p);
      if (out.length() > 0) out.append(',');
      out.append("[" + n + "," + num(p) + "," + num(r[0]) + "," + num(r[1]) + "," + num(r[2]) + "]");
    }
    // a dead dragon samples with partial 0
    setHealth(d, 0f);
    StringBuilder dead = new StringBuilder();
    for (int n : new int[] {5, 10}) { double[] r = d.b(n, 0.5f); if (dead.length() > 0) dead.append(','); dead.append("[" + n + "," + num(r[0]) + "," + num(r[1]) + "," + num(r[2]) + "]"); }
    System.out.println("{\"case\":\"ring\",\"index\":" + d.bo + ",\"samples\":[" + out + "],\"dead\":[" + dead + "]}");
  }

  static void damage() throws Exception {
    String[] names = {"head", "body", "tail1", "tail2", "tail3", "wing1", "wing2"};
    yz pl = null;
    float[] amounts = {1f, 4f, 10f, 20f};
    String[] sources = {"player", "explosion", "generic", "mob"};
    for (int part = 0; part < 7; part++) for (String src : sources) for (float a : amounts) {
      DW w = world();
      xa d = dragon(w, 10, 100, -6, 135f, 77 + part);
      for (int t = 0; t < 3; t++) d.e();
      yz p = player(w, 4, 100, 4);
      ro source = src.equals("player") ? ro.a(p) : src.equals("explosion") ? ro.a((agw) null) : src.equals("mob") ? ro.a((sv) d) : ro.k;
      float before = d.aS();
      double tx = d.h, ty = d.i, tz = d.bm;
      boolean res = d.a(d.bp[part], source, a);
      System.out.println("{\"case\":\"damage\",\"part\":" + part + ",\"source\":" + q(src) + ",\"amount\":" + num(a) + ",\"result\":" + res + ",\"healthBefore\":" + num(before) + ",\"healthAfter\":" + num(d.aS()) + ",\"hurtTime\":" + d.ax
        + ",\"yaw\":" + num(d.y) + ",\"posY\":" + num(d.t) + ",\"target\":[" + num(d.h) + "," + num(d.i) + "," + num(d.bm) + "],\"targetChanged\":" + (tx != d.h || ty != d.i || tz != d.bm) + ",\"rand\":" + q("" + ((Random) fd(sa.class, "Z").get(d)).nextLong()) + "}");
    }
    // the main entity is not hittable
    DW w = world();
    xa d = dragon(w, 0, 100, 0, 0f, 3);
    float before = d.aS();
    boolean r = d.a(ro.k, 5f);
    System.out.println("{\"case\":\"damageMain\",\"result\":" + r + ",\"healthAfter\":" + num(d.aS()) + ",\"healthBefore\":" + num(before) + "}");
    // two hits inside the invulnerability window: the second needs more damage than the first
    DW w2 = world();
    xa d2 = dragon(w2, 0, 100, 0, 0f, 3);
    yz p2 = player(w2, 1, 100, 1);
    StringBuilder seq = new StringBuilder();
    float[][] hits = {{6f}, {4f}, {9f}, {9f}};
    for (float[] h : hits) { boolean rr = d2.a(d2.bq, ro.a(p2), h[0]); if (seq.length() > 0) seq.append(','); seq.append("[" + num(h[0]) + "," + rr + "," + num(d2.aS()) + "," + d2.ax + "]"); }
    System.out.println("{\"case\":\"hurtWindow\",\"seq\":[" + seq + "]}");
  }

  static void explosionParts() throws Exception {
    for (int part = 0; part < 7; part++) for (float size : new float[] {4f, 6f}) for (double lift : new double[] {0.0, 2.5}) {
      DW w = world();
      w.withParts = true;
      xa d = dragon(w, 10, 100, -6, 135f, 177 + part);
      for (int t = 0; t < 3; t++) d.e();
      w.ents.add(d);
      azt b = d.bp[part].C;
      double cx = (b.a + b.d) / 2 + 1.5, cy = b.b + lift, cz = (b.c + b.f) / 2;
      float before = d.aS();
      double tx = d.h, ty = d.i, tz = d.bm;
      agw boom = new agw(w, null, cx, cy, cz, size);
      boom.a();
      System.out.println("{\"case\":\"explosionParts\",\"part\":" + part + ",\"size\":" + num(size) + ",\"lift\":" + num(lift) + ",\"center\":[" + num(cx) + "," + num(cy) + "," + num(cz) + "],\"boxes\":" + boxes(d)
        + ",\"healthBefore\":" + num(before) + ",\"healthAfter\":" + num(d.aS()) + ",\"hurtTime\":" + d.ax + ",\"target\":[" + num(d.h) + "," + num(d.i) + "," + num(d.bm) + "],\"targetChanged\":" + (tx != d.h || ty != d.i || tz != d.bm)
        + ",\"rand\":" + q("" + ((Random) fd(sa.class, "Z").get(d)).nextLong()) + "}");
    }
  }

  static void crystal() throws Exception {
    // heal: one crystal at distance, ticks 0..299; crystals outside 32 are ignored; a destroyed crystal strikes the head for 10
    for (int variant = 0; variant < 4; variant++) {
      DW w = world();
      xa d = dragon(w, 0, 100, 0, 0f, 101 + variant);
      setHealth(d, variant == 3 ? 195f : 100f);
      double[][] cs = variant == 0 ? new double[][] {{8, 100, 8}} : variant == 1 ? new double[][] {{40, 100, 40}, {-20, 90, 5}} : variant == 2 ? new double[][] {{12, 105, 0}, {5, 100, 5}, {-6, 100, 2}} : new double[][] {{5, 100, 5}};
      List<wz> crystals = new ArrayList<>();
      for (double[] c : cs) { wz e = new wz(w, c[0], c[1], c[2]); crystals.add(e); w.ents.add(e); }
      StringBuilder tr = new StringBuilder();
      String destroyed = "null";
      Method bP = priv("bP");
      for (int t = 0; t < 300; t++) {
        d.aa++;
        if (variant >= 2 && t == 120) {
          wz heal = (wz) fd(xa.class, "bC").get(d);
          if (heal != null) { fd(sa.class, "K").setBoolean(heal, true); destroyed = "[" + t + "," + crystals.indexOf(heal) + "]"; }
        }
        bP.invoke(d); // updateDragonEnderCrystal alone: the dragon stays where it is
        wz heal = (wz) fd(xa.class, "bC").get(d);
        if (t > 0) tr.append(',');
        tr.append("[" + num(d.aS()) + "," + crystals.indexOf(heal) + "," + d.ax + "]");
      }
      System.out.println("{\"case\":\"crystal\",\"variant\":" + variant + ",\"crystals\":" + Arrays.deepToString(cs) + ",\"destroyed\":" + destroyed + ",\"trace\":[" + tr + "]}");
    }
  }

  static void collide() throws Exception {
    // victims: zombies placed around the wings, head and body. The wing push and the head attack are recorded as velocity / health changes.
    DW w = world();
    xa d = dragon(w, 0.25, 100, 0.5, 0f, 21);
    for (int t = 0; t < 2; t++) d.e();
    double[][] spots = {{4.5, 100, 0}, {-4.5, 100, 0.5}, {0, 101, 6}, {0, 100, -5}, {1, 100, 2}, {20, 100, 0}, {5, 98.5, 1}, {-5.5, 99, 2}};
    for (int i = 0; i < spots.length; i++) {
      DW w2 = world();
      xa dr = dragon(w2, 0.25, 100, 0.5, 0f, 21);
      for (int t = 0; t < 2; t++) dr.e();
      yq z = new yq(w2);
      z.b(spots[i][0], spots[i][1], spots[i][2], 0f, 0f);
      w2.ents.add(z);
      float h0 = z.aS();
      int ax0 = dr.ax;
      dr.e();
      System.out.println("{\"case\":\"collide\",\"spot\":" + Arrays.toString(spots[i]) + ",\"hurtTime\":" + ax0 + ",\"velocity\":[" + num(z.v) + "," + num(z.w) + "," + num(z.x) + "],\"healthBefore\":" + num(h0) + ",\"healthAfter\":" + num(z.aS())
        + ",\"head\":" + box(dr.bq.C) + ",\"wing1\":" + box(dr.bv.C) + ",\"wing2\":" + box(dr.bw.C) + ",\"body\":" + box(dr.br.C) + "}");
    }
    // with hurtTime > 0 the wings and the head do nothing
    DW w3 = world();
    xa d3 = dragon(w3, 0.25, 100, 0.5, 0f, 21);
    for (int t = 0; t < 2; t++) d3.e();
    yq z3 = new yq(w3); z3.b(4.5, 100, 0, 0f, 0f); w3.ents.add(z3);
    d3.ax = 5;
    d3.e();
    System.out.println("{\"case\":\"collideHurt\",\"velocity\":[" + num(z3.v) + "," + num(z3.w) + "," + num(z3.x) + "],\"health\":" + num(z3.aS()) + "}");
  }

  // destroyBlocksInAABB (xa.a(azt)) over fixed boxes.
  static void destroy() throws Exception {
    aji[] kinds = {ajn.b, ajn.Z, ajn.bs, ajn.h, ajn.w /* glass */, ajn.a};
    int[][] ids = new int[kinds.length][];
    Method m = priv("a", azt.class);
    double[][] boxes = {{0.2, 100.2, 0.2, 2.8, 102.8, 2.8}, {10.5, 100, 10.5, 12.5, 101.5, 12.5}, {20, 100, 20, 21, 101, 21}, {30.1, 100.1, 30.1, 31.9, 100.9, 31.9}};
    for (boolean grief : new boolean[] {true, false}) for (int pattern = 0; pattern < 4; pattern++) for (double[] b : boxes) {
      DW w = world();
      fd(ahb.class, "C");
      w.rules.a("mobGriefing", grief ? "true" : "false");
      xa d = dragon(w, 0, 100, 0, 0f, 5 + pattern);
      StringBuilder grid = new StringBuilder();
      for (int x = (int) Math.floor(b[0]) - 1; x <= (int) Math.floor(b[3]) + 1; x++) for (int y = (int) Math.floor(b[1]) - 1; y <= (int) Math.floor(b[4]) + 1; y++) for (int z = (int) Math.floor(b[2]) - 1; z <= (int) Math.floor(b[5]) + 1; z++) {
        int k = Math.abs(x * 31 + y * 17 + z * 7 + pattern * 13) % (pattern == 0 ? 2 : 6);
        if (pattern == 3 && (x + y + z) % 3 != 0) k = 5;
        w.d(x, y, z, kinds[k], 0, 0);
        if (grid.length() > 0) grid.append(',');
        grid.append("[" + x + "," + y + "," + z + "," + aji.b(kinds[k]) + "]");
      }
      w.clear();
      boolean r = (Boolean) m.invoke(d, azt.a(b[0], b[1], b[2], b[3], b[4], b[5]));
      // read back: blocks after
      StringBuilder after = new StringBuilder();
      for (int x = (int) Math.floor(b[0]) - 1; x <= (int) Math.floor(b[3]) + 1; x++) for (int y = (int) Math.floor(b[1]) - 1; y <= (int) Math.floor(b[4]) + 1; y++) for (int z = (int) Math.floor(b[2]) - 1; z <= (int) Math.floor(b[5]) + 1; z++) {
        if (after.length() > 0) after.append(',');
        after.append(aji.b(w.a(x, y, z)));
      }
      System.out.println("{\"case\":\"destroy\",\"grief\":" + grief + ",\"pattern\":" + pattern + ",\"box\":" + Arrays.toString(b) + ",\"grid\":[" + grid + "],\"result\":" + r + ",\"after\":[" + after + "],\"particles\":[" + String.join(",", w.parts) + "],\"nextLong\":" + q("" + ((Random) fd(sa.class, "Z").get(d)).nextLong()) + "}");
    }
    // slowed flag from real ticks: a wall of stone in front of the head and body
    DW w = world();
    xa d = dragon(w, 0.25, 100, 0.5, 0f, 33);
    for (int x = -8; x <= 8; x++) for (int y = 96; y <= 106; y++) for (int z = -3; z <= 3; z++) w.d(x, y, z, (x + y + z) % 5 == 0 ? ajn.Z : ajn.b, 0, 0);
    w.clear();
    StringBuilder tr = new StringBuilder();
    for (int t = 0; t < 12; t++) { d.e(); if (t > 0) tr.append(','); tr.append("[" + state(d) + "," + EndProbe.countEntries(w.blockLog) + "]"); }
    System.out.println("{\"case\":\"destroyTicks\",\"trace\":[" + tr + "],\"writeSha1\":" + q(EndProbe.blockLogHash(w)) + "}");
  }

  static void death() throws Exception {
    for (int variant = 0; variant < 2; variant++) {
      DW w = world();
      int[] pos = variant == 0 ? new int[] {0, 0} : new int[] {37, -22};
      xa d = dragon(w, pos[0] + 0.5, 100, pos[1] + 0.5, 30f, 9);
      for (int t = 0; t < 5; t++) d.e();
      // chunks for the portal build need the chunk provider double (d(II) on the world's chunk provider); install like EndProbe.exitPortal
      final DW fw = w;
      fd(ahb.class, "v").set(w, Proxy.newProxyInstance(DragonProbe.class.getClassLoader(), new Class<?>[] {apu.class}, (proxy, method, a) -> method.getName().equals("d") && a != null && a.length == 2 ? fw.e((Integer) a[0], (Integer) a[1]) : null));
      setHealth(d, 0f);
      Method aF = priv("aF");
      w.clear();
      StringBuilder tr = new StringBuilder(), orbs = new StringBuilder(), ev = new StringBuilder();
      int particleStart = 0;
      StringBuilder pp = new StringBuilder();
      for (int t = 1; t <= 205; t++) {
        w.tick = t;
        if (!d.K) {
          aF.invoke(d);
          d.e();
        }
        int n = w.orbs.size();
        if (t > 1) tr.append(',');
        tr.append("[" + t + "," + fd(xa.class, "bB").getInt(d) + "," + num(d.s) + "," + num(d.t) + "," + num(d.u) + "," + num(d.y) + "," + num(d.w) + "," + (d.K ? 1 : 0) + "," + n + "," + w.events.size() + "," + w.parts.size() + "," + EndProbe.countEntries(w.blockLog) + "]");
      }
      System.out.println("{\"case\":\"death\",\"variant\":" + variant + ",\"start\":" + Arrays.toString(pos) + ",\"trace\":[" + tr + "],\"orbs\":[" + String.join(",", w.orbs) + "],\"orbAt\":[" + String.join(",", w.orbAt) + "],\"events\":[" + String.join(",", w.events) + "],\"particles\":[" + String.join(",", w.parts) + "],"
        + "\"portalWrites\":" + EndProbe.countEntries(w.blockLog) + ",\"portalSha1\":" + q(EndProbe.blockLogHash(w)) + ",\"portalFlagAfter\":" + fd(akt.class, "a").getBoolean(null) + "}");
    }
  }

  public static void main(String[] args) throws Exception {
    Field uf = sun.misc.Unsafe.class.getDeclaredField("theUnsafe");
    uf.setAccessible(true);
    TerrainProbe.unsafe = (sun.misc.Unsafe) uf.get(null);
    aji.p();
    adb.l();
    facts();
    flight("circle-a", 1L, 0f, new double[0][], 200, 1800, true);
    flight("circle-b", 20260101L, 123.5f, new double[0][], 120, 1500, true);
    flight("circle-c", -7L, -90f, new double[0][], 60, 3000, true);
    flight("player-near", 5L, 40f, new double[][] {{12, 70, 8}}, 200, 1200, true);
    flight("player-far", 8L, 200f, new double[][] {{-40, 64, 35}, {10, 70, 90}}, 150, 1500, true);
    ring();
    damage();
    explosionParts();
    crystal();
    collide();
    destroy();
    death();
  }
}
