import java.lang.reflect.Field;
import java.util.*;

// Runs the unchanged ItemEnderEye (acn), EntityEnderEye (zd), BlockEndPortal (akt), BlockEndPortalFrame (aku) and
// ItemStack.tryPlaceItemIntoWorld (add.a) of the 1.7.10 JAR on the WitchProbe world double extended with a block map that
// accepts setBlock/setBlockMetadataWithNotify, a stub MapGenStructure lookup (World.findClosestStructure, ahb.b), a stub ray
// trace and an event log. Nothing is patched; Entity.rand and ItemEnderEye's Item.itemRand (adb.g) are seeded java.util.Random.
// Prints one JSON object per line: direction, facts, flight, dropRoll, ring, ringMask, use, rightClick, portal, portalSide,
// portalCollide, portalAdded, portalDisplay.
public class EyeOfEnderProbe {
  public static class EW extends WitchProbe.WW {
    static List<String> log = new ArrayList<>();
    static List<double[]> particles = new ArrayList<>();
    static List<sa> spawned = new ArrayList<>();
    static agt stronghold = null;
    static int[] rayHit = null; // [x, y, z, side] or null
    static boolean rayEntity = false;
    static int resetCount = 0;
    public boolean a(int x, int y, int z, int meta, int flags) {
      int[] c = cells.get(x + "," + y + "," + z);
      cells.put(x + "," + y + "," + z, new int[] { c != null ? c[0] : 0, meta });
      log.add("meta|" + x + "," + y + "," + z + "|" + meta + "|" + flags);
      return true;
    }
    public boolean d(int x, int y, int z, aji block, int meta, int flags) {
      cells.put(x + "," + y + "," + z, new int[] { aji.b(block), meta });
      log.add("setBlock|" + x + "," + y + "," + z + "|" + aji.b(block) + "|" + meta + "|" + flags);
      return true;
    }
    public boolean f(int x, int y, int z) {
      cells.remove(x + "," + y + "," + z);
      log.add("setAir|" + x + "," + y + "," + z);
      return true;
    }
    public void f(int x, int y, int z, aji block) { log.add("outputSignal|" + x + "," + y + "," + z); }
    public agt b(String name, int x, int y, int z) {
      log.add("find|" + name + "|" + x + "," + y + "," + z);
      return name.equals("Stronghold") ? stronghold : null;
    }
    public azu a(azw from, azw to, boolean a, boolean b, boolean c) {
      if (rayEntity) return new azu(new zd(this));
      return rayHit == null ? null : new azu(rayHit[0], rayHit[1], rayHit[2], rayHit[3], azw.a(rayHit[0] + 0.5, rayHit[1] + 0.5, rayHit[2] + 0.5));
    }
    public void a(String name, double x, double y, double z, double vx, double vy, double vz) {
      particles.add(new double[] { x, y, z, vx, vy, vz });
      log.add("particle|" + name + "|" + x + "," + y + "," + z + "|" + vx + "," + vy + "," + vz);
    }
    public void a(sa entity, String sound, float volume, float pitch) { log.add("sound|" + sound + "|" + volume + "|" + pitch); }
    public boolean d(sa entity) { spawned.add(entity); log.add("spawn|" + entity.getClass().getSimpleName() + "|" + entity.s + "," + entity.t + "," + entity.u); return true; }
    public void c(int id, int x, int y, int z, int data) { log.add("aux|" + id + "," + x + "," + y + "," + z + "," + data); }
    public void a(yz player, int id, int x, int y, int z, int data) { log.add("auxPlayer|" + id + "," + x + "," + y + "," + z + "," + data); }
  }

  // An entity whose travelToDimension (sa.b(int)) is recorded instead of running the server.
  public static class Traveller extends zd {
    public Traveller(ahb w) { super(w); }
    public void b(int dimension) { EW.log.add("travel|" + dimension); }
  }

  static String num(double v) { return Double.toString(v); }
  static String num(float v) { return Float.toString(v); }
  static String q(String s) { return s == null ? "null" : "\"" + s + "\""; }
  static Field fd(Class<?> c, String n) throws Exception { return MobMoveProbe.field(c, n); }
  static String strings(List<String> l) {
    StringBuilder s = new StringBuilder("[");
    for (int i = 0; i < l.size(); i++) s.append(i > 0 ? "," : "").append(q(l.get(i)));
    return s.append("]").toString();
  }
  static String doubles(double... v) { StringBuilder s = new StringBuilder("["); for (int i = 0; i < v.length; i++) s.append(i > 0 ? "," : "").append(num(v[i])); return s.append("]").toString(); }
  static String ints(int... v) { StringBuilder s = new StringBuilder("["); for (int i = 0; i < v.length; i++) s.append(i > 0 ? "," : "").append(v[i]); return s.append("]").toString(); }

  static void clear() { WitchProbe.WW.cells.clear(); EW.log.clear(); EW.particles.clear(); EW.spawned.clear(); EW.rayHit = null; EW.rayEntity = false; EW.stronghold = null; }
  static void itemRandom(long seed) throws Exception { fd(adb.class, "g").set(null, new Random(seed)); }

  static zd eye(double x, double y, double z, long seed) throws Exception {
    zd e = new zd(WitchProbe.w, x, y, z);
    MobMoveProbe.set(e, "Z", new Random(seed));
    return e;
  }
  static void moveTowards(zd e, double x, int y, double z) { e.a(x, y, z); }
  static double dField(zd e, String n) throws Exception { return fd(zd.class, n).getDouble(e); }

  // Reflects a block's protected bounds and values.
  static String blockFacts(aji b) throws Exception {
    return "{\"bounds\":" + doubles(fd(aji.class, "B").getDouble(b), fd(aji.class, "C").getDouble(b), fd(aji.class, "D").getDouble(b), fd(aji.class, "E").getDouble(b), fd(aji.class, "F").getDouble(b), fd(aji.class, "G").getDouble(b))
      + ",\"light\":" + b.m() + ",\"opacity\":" + b.k() + ",\"opaque\":" + b.c() + ",\"normal\":" + b.d() + ",\"renderType\":" + b.b() + "}";
  }

  static void flight(String name, double x, double y, double z, double tx, int ty, double tz, long seed, int maxTicks) throws Exception {
    clear();
    zd e = eye(x, y, z, seed);
    moveTowards(e, tx, ty, tz);
    StringBuilder rows = new StringBuilder(), fx = new StringBuilder();
    String start = "{\"target\":" + doubles(dField(e, "a"), dField(e, "b"), dField(e, "c")) + ",\"drops\":" + fd(zd.class, "e").getBoolean(e) + ",\"age\":" + fd(zd.class, "d").getInt(e) + "}";
    int ticks = 0;
    boolean dead = false;
    while (ticks < maxTicks && !dead) {
      EW.particles.clear();
      e.h();
      ticks++;
      dead = fd(sa.class, "K").getBoolean(e);
      rows.append(ticks > 1 ? "," : "").append("[").append(num(e.s)).append(",").append(num(e.t)).append(",").append(num(e.u)).append(",")
        .append(num(e.v)).append(",").append(num(e.w)).append(",").append(num(e.x)).append(",").append(num(e.y)).append(",").append(num(e.z)).append(",")
        .append(num(e.A)).append(",").append(num(e.B)).append(",").append(fd(zd.class, "d").getInt(e)).append(",").append(dead ? 1 : 0).append("]");
      fx.append(ticks > 1 ? "," : "").append(EW.particles.isEmpty() ? "[]" : doubles(EW.particles.get(0)));
    }
    List<String> events = new ArrayList<>();
    for (String l : EW.log) if (!l.startsWith("particle|")) events.add(l);
    System.out.println("{\"case\":\"flight\",\"name\":" + q(name) + ",\"from\":" + doubles(x, y, z) + ",\"to\":" + doubles(tx, ty, tz) + ",\"seed\":" + seed
      + ",\"start\":" + start + ",\"ticks\":" + ticks + ",\"rows\":[" + rows + "],\"particles\":[" + fx + "],\"events\":" + strings(events) + "}");
  }

  static Gamer player(boolean creative, boolean remote) throws Exception {
    Gamer p = (Gamer) DifficultyProbe.player(WitchProbe.u, Gamer.class);
    p.b(2.5, 64.0, -3.5);
    p.L = 1.62f;
    for (String n : new String[] { "p", "q", "r" }) { }
    fd(sa.class, "p").setDouble(p, 2.5); fd(sa.class, "q").setDouble(p, 64.0); fd(sa.class, "r").setDouble(p, -3.5);
    p.y = 25f; p.z = -10f; p.A = 25f; p.B = -10f;
    p.bE.d = creative;
    WitchProbe.w.E = remote;
    return p;
  }
  public static class Gamer extends DifficultyProbe.Player {
    public float g() { return 1.62f; }
  }

  static final int FRAME = 120, PORTAL = 119;
  // The portal room's ring around the interior (cx-1..cx+1, cz-1..cz+1): 3 frames per side, listed north, south, west, east.
  static int[][] ringCells(int cx, int cz) {
    int[][] r = new int[12][];
    for (int i = 0; i < 3; i++) {
      r[i] = new int[] { cx - 1 + i, cz - 2 };
      r[3 + i] = new int[] { cx - 1 + i, cz + 2 };
      r[6 + i] = new int[] { cx - 2, cz - 1 + i };
      r[9 + i] = new int[] { cx + 2, cz - 1 + i };
    }
    return r;
  }
  static void putFrame(int x, int y, int z, int meta) { WitchProbe.WW.cells.put(x + "," + y + "," + z, new int[] { FRAME, meta }); }
  static int metaAt(int x, int y, int z) { int[] c = WitchProbe.WW.cells.get(x + "," + y + "," + z); return c == null ? -1 : c[1]; }
  static int idAt(int x, int y, int z) { int[] c = WitchProbe.WW.cells.get(x + "," + y + "," + z); return c == null ? 0 : c[0]; }

  // Uses an eye of ender on (x, y, z) through ItemStack.tryPlaceItemIntoWorld; returns the result record body.
  static String useAt(int x, int y, int z, int count, boolean creative, boolean remote, long seed, int cx, int cz) throws Exception {
    EW.log.clear();
    Gamer p = player(creative, remote);
    itemRandom(seed);
    add stack = new add(ade.bv, count);
    boolean used = stack.a(p, WitchProbe.w, x, y, z, 1, 0.5f, 1f, 0.5f);
    List<String> events = new ArrayList<>(EW.log);
    StringBuilder filled = new StringBuilder("[");
    int n = 0;
    for (int dx = -2; dx <= 2; dx++) for (int dz = -2; dz <= 2; dz++)
      if (idAt(cx + dx, y, cz + dz) == PORTAL) { filled.append(n++ > 0 ? "," : "").append(ints(cx + dx, y, cz + dz)); }
    filled.append("]");
    return "\"used\":" + used + ",\"count\":" + stack.b + ",\"meta\":" + metaAt(x, y, z) + ",\"filled\":" + filled + ",\"events\":" + strings(events);
  }

  public static void main(String[] args) throws Exception {
    aji.p(); adb.l();
    WitchProbe.u = MobMoveProbe.unsafe();
    sun.misc.Unsafe u = WitchProbe.u;
    WitchProbe.w = (WitchProbe.WW) u.allocateInstance(EW.class);
    WitchProbe.WW w = WitchProbe.w;
    DifficultyProbe.w = w;
    MobMoveProbe.set(w, "s", new Random(2));
    MobMoveProbe.set(w, "C", new qi());
    aqq provider = new aqq();
    java.lang.reflect.Method gen = aqo.class.getDeclaredMethod("a"); gen.setAccessible(true); gen.invoke(provider);
    MobMoveProbe.set(w, "t", provider);
    for (Field f : ahb.class.getDeclaredFields())
      if (f.getType() == List.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(w, new ArrayList()); }
    ays info = (ays) u.allocateInstance(ays.class);
    fd(ays.class, "g").setLong(info, 1);
    fd(ays.class, "x").set(info, new agy());
    fd(ahb.class, "x").set(w, info);
    Calendar date = Calendar.getInstance(); date.clear(); date.set(2014, Calendar.JUNE, 1);
    fd(ahb.class, "J").set(w, date);
    fd(ahb.class, "r").set(w, rd.values()[2]);
    for (Field f : ahb.class.getDeclaredFields()) if (f.getType() == bac.class) { f.setAccessible(true); f.set(w, new bac()); }
    DifficultyProbe.World.chunk = (apx) u.allocateInstance(apx.class);
    DifficultyProbe.World.light = 15;

    // Direction (p): offsetX, offsetZ, rotateRight, as the ring check indexes them.
    System.out.println("{\"case\":\"direction\",\"offsetX\":" + ints(p.a) + ",\"offsetZ\":" + ints(p.b) + ",\"rotateRight\":" + ints(p.g) + "}");

    // Facts.
    {
      zd e = eye(0, 64, 0, 1);
      adb item = ade.bv;
      StringBuilder inRange = new StringBuilder("[");
      double[] ds = { 0, 1000, 4095, 4096, 4097, 100000 };
      for (int i = 0; i < ds.length; i++) inRange.append(i > 0 ? "," : "").append("[").append(num(ds[i])).append(",").append(e.a(ds[i])).append("]");
      inRange.append("]");
      StringBuilder frameBit = new StringBuilder("[");
      for (int m = 0; m < 16; m++) frameBit.append(m > 0 ? "," : "").append(aku.b(m));
      frameBit.append("]");
      System.out.println("{\"case\":\"facts\",\"eye\":{\"width\":" + num(e.M) + ",\"height\":" + num(e.N) + ",\"yOffset\":" + num(e.L) + ",\"shadowSize\":" + num(e.Y())
        + ",\"brightness\":" + num(e.d(0f)) + ",\"brightnessForRender\":" + e.c(0f) + ",\"canAttackWithItem\":" + e.av() + ",\"inRenderRange\":" + inRange + "}"
        + ",\"item\":{\"maxStack\":" + fd(adb.class, "h").getInt(item) + "},\"frameEyeBit\":" + frameBit
        + ",\"portal\":" + blockFacts(ajn.bq) + ",\"frame\":" + blockFacts(ajn.br)
        + ",\"portalHardness\":" + num(fd(aji.class, "v").getFloat(ajn.bq)) + ",\"portalResistance\":" + num(fd(aji.class, "w").getFloat(ajn.bq))
        + ",\"portalQuantity\":" + ajn.bq.a(new Random(1)) + ",\"portalItem\":" + (ajn.bq.d((ahb) w, 0, 0, 0) == null ? "null" : "\"present\"")
        + ",\"portalMaterial\":{\"isLiquid\":" + awt.E.a() + ",\"isSolid\":" + awt.E.b() + ",\"blocksMovement\":" + awt.E.c() + ",\"d\":" + awt.E.d() + "}}");
    }

    // Flights: eye flight over starts and targets (far targets are clamped to 12 blocks plus 8 up; near targets are exact).
    long shatterSeed = 0;
    for (long s = 0; s < 500; s++) if (new Random(s).nextInt(5) == 0) { shatterSeed = s; break; }
    flight("far", 0.5, 65.62, 0.5, 100.0, 40, 0.0, 1, 120);
    flight("near", 10.0, 70.0, -5.0, 13.0, 64, -8.0, 2, 120);
    flight("farNegative", -250.3, 80.1, 312.9, -1400.0, 64, 1500.0, 3, 120);
    flight("withinOne", 3.7, 64.9, 3.7, 3.0, 64, 3.0, 4, 120);
    flight("above", 0.0, 100.0, 0.0, 0.0, 64, 0.0, 5, 120);
    flight("eastFar", 40.25, 12.5, -80.75, 4000.0, 70, -80.0, 6, 120);
    flight("northFar", -3.0, 200.0, 10.0, -3.0, 64, -2000.0, 7, 120);
    flight("southWest", 100000.5, 30.0, -100000.5, 99000.0, 20, -99000.0, 8, 120);
    flight("shatter", 0.5, 65.62, 0.5, 100.0, 40, 0.0, shatterSeed, 120);
    flight("shatterNear", 10.0, 70.0, -5.0, 13.0, 64, -8.0, shatterSeed, 120);
    flight("survive", 0.5, 65.62, 0.5, 100.0, 40, 0.0, 2, 120);

    // The 80% rule: the draw that moveTowards makes from Entity.rand, per seed.
    {
      StringBuilder bits = new StringBuilder();
      int survive = 0;
      for (long s = 0; s < 400; s++) {
        clear();
        zd e = eye(0, 64, 0, s);
        moveTowards(e, 50.0, 64, 0.0);
        boolean d = fd(zd.class, "e").getBoolean(e);
        bits.append(d ? '1' : '0');
        if (d) survive++;
      }
      System.out.println("{\"case\":\"dropRoll\",\"seeds\":400,\"bits\":\"" + bits + "\",\"survive\":" + survive + "}");
    }

    // Ring: which facing assignments (north, south, west, east edge, 4^4) fill the portal when the last frame gets its eye.
    // Every other frame already has an eye; the chosen frame (0..11) gets it through ItemStack.tryPlaceItemIntoWorld.
    {
      int cx = 10, cy = 40, cz = 20;
      int[][] ring = ringCells(cx, cz);
      List<Integer> valid = new ArrayList<>(), full = new ArrayList<>();
      for (int assign = 0; assign < 256; assign++) {
        int[] m = { assign & 3, (assign >> 2) & 3, (assign >> 4) & 3, (assign >> 6) & 3 };
        StringBuilder bits = new StringBuilder();
        for (int last = 0; last < 12; last++) {
          clear();
          for (int i = 0; i < 12; i++) putFrame(ring[i][0], cy, ring[i][1], m[i / 3] + (i == last ? 0 : 4));
          Gamer p = player(false, false);
          itemRandom(1);
          add stack = new add(ade.bv, 1);
          boolean used = stack.a(p, WitchProbe.w, ring[last][0], cy, ring[last][1], 1, 0.5f, 1f, 0.5f);
          int portals = 0;
          for (int dx = -1; dx <= 1; dx++) for (int dz = -1; dz <= 1; dz++) if (idAt(cx + dx, cy, cz + dz) == PORTAL) portals++;
          bits.append(used ? (portals == 9 ? '9' : portals == 0 ? '1' : 'x') : '0');
        }
        if (bits.indexOf("9") >= 0) valid.add(assign);
        if (bits.toString().equals("999999999999")) full.add(assign);
        System.out.println("{\"case\":\"ring\",\"assign\":" + assign + ",\"facing\":" + ints(m) + ",\"outcome\":\"" + bits + "\"}");
      }
      System.out.println("{\"case\":\"ringValid\",\"partial\":" + valid + ",\"full\":" + full + "}");

      // Eye masks on the valid ring: 400 seeded samples (a quarter with every other eye present, the rest with each eye missing at 12%).
      int[] ok = new int[4];
      int vi = full.get(0);
      int[] m = { vi & 3, (vi >> 2) & 3, (vi >> 4) & 3, (vi >> 6) & 3 };
      Random pick = new Random(99);
      StringBuilder rows = new StringBuilder();
      for (int n = 0; n < 400; n++) {
        int mask = 4095, last = pick.nextInt(12);
        if (n % 4 != 0) for (int b = 0; b < 12; b++) if (pick.nextInt(100) < 12) mask &= ~(1 << b);
        mask &= ~(1 << last);
        clear();
        for (int i = 0; i < 12; i++) putFrame(ring[i][0], cy, ring[i][1], m[i / 3] + (((mask >> i) & 1) != 0 ? 4 : 0));
        Gamer p = player(false, false);
        itemRandom(1);
        add stack = new add(ade.bv, 1);
        boolean used = stack.a(p, WitchProbe.w, ring[last][0], cy, ring[last][1], 1, 0.5f, 1f, 0.5f);
        int portals = 0;
        for (int dx = -1; dx <= 1; dx++) for (int dz = -1; dz <= 1; dz++) if (idAt(cx + dx, cy, cz + dz) == PORTAL) portals++;
        rows.append(n > 0 ? "," : "").append(ints(mask, last, used ? 1 : 0, portals));
      }
      System.out.println("{\"case\":\"ringMask\",\"facing\":" + ints(m) + ",\"rows\":[" + rows + "]}");

      // Rings broken in other ways with every eye present but the used one: a missing frame, a frame of stone, and diagonal
      // rotations of the interior; each uses the eye on frame `last`.
      String[] names = { "missing-north-middle", "stone-in-ring", "interior-stone", "ring-one-higher", "full-valid", "eye-already" };
      for (int c = 0; c < names.length; c++) {
        clear();
        int last = 4;
        for (int i = 0; i < 12; i++) putFrame(ring[i][0], cy, ring[i][1], m[i / 3] + (i == last ? 0 : 4));
        if (c == 0) WitchProbe.WW.cells.remove(ring[1][0] + "," + cy + "," + ring[1][1]);
        if (c == 1) WitchProbe.WW.cells.put(ring[8][0] + "," + cy + "," + ring[8][1], new int[] { 1, 0 });
        if (c == 2) WitchProbe.WW.cells.put(cx + "," + cy + "," + cz, new int[] { 1, 0 });
        if (c == 3) putFrame(ring[10][0], cy + 1, ring[10][1], m[3] + 4);
        if (c == 3) WitchProbe.WW.cells.remove(ring[10][0] + "," + cy + "," + ring[10][1]);
        if (c == 5) putFrame(ring[last][0], cy, ring[last][1], m[last / 3] + 4);
        System.out.println("{\"case\":\"use\",\"name\":" + q(names[c]) + ",\"creative\":false,\"remote\":false,\"count\":3," + useAt(ring[last][0], cy, ring[last][1], 3, false, false, 11, cx, cz).replaceFirst("^", "") + "}");
      }
    }

    // Use on blocks: survival/creative/remote on a lone frame; a plain block; the particle draw.
    {
      int cx = 0, cy = 64, cz = 0;
      for (int c = 0; c < 6; c++) {
        clear();
        String name = new String[] { "lone-frame-survival", "lone-frame-creative", "lone-frame-remote", "stone", "air", "lone-frame-meta-3" }[c];
        if (c == 3) WitchProbe.WW.cells.put("0,64,0", new int[] { 1, 0 });
        else if (c != 4) putFrame(0, 64, 0, c == 5 ? 3 : 2);
        boolean creative = c == 1, remote = c == 2;
        System.out.println("{\"case\":\"use\",\"name\":" + q(name) + ",\"creative\":" + creative + ",\"remote\":" + remote + ",\"count\":2," + useAt(0, 64, 0, 2, creative, remote, 5, cx, cz) + "}");
        WitchProbe.w.E = false;
      }
    }

    // Right click in the air (ItemEnderEye.onItemRightClick, aco-like): target present or not, ray target, creative, remote.
    {
      String[] names = { "survival-miss", "creative-miss", "remote", "no-stronghold", "ray-frame", "ray-stone", "ray-entity" };
      for (int c = 0; c < names.length; c++) {
        clear();
        EW.stronghold = c == 3 ? null : new agt(1224, 64, -312);
        if (c == 4) { EW.rayHit = new int[] { 3, 63, 4, 1 }; putFrame(3, 63, 4, 2); }
        if (c == 5) { EW.rayHit = new int[] { 3, 63, 4, 1 }; WitchProbe.WW.cells.put("3,63,4", new int[] { 1, 0 }); }
        if (c == 6) EW.rayEntity = true;
        boolean creative = c == 1, remote = c == 2;
        Gamer p = player(creative, remote);
        itemRandom(21);
        adb item = ade.bv;
        add stack = new add(item, 5);
        add back = ade.bv.a(stack, WitchProbe.w, p);
        String eyeState = "null";
        for (sa s : EW.spawned) if (s instanceof zd) {
          zd e = (zd) s;
          eyeState = "{\"pos\":" + doubles(e.s, e.t, e.u) + ",\"target\":" + doubles(dField(e, "a"), dField(e, "b"), dField(e, "c")) + ",\"drops\":" + fd(zd.class, "e").getBoolean(e) + "}";
        }
        System.out.println("{\"case\":\"rightClick\",\"name\":" + q(names[c]) + ",\"creative\":" + creative + ",\"remote\":" + remote + ",\"player\":" + doubles(p.s, p.t, p.u) + ",\"count\":" + stack.b
          + ",\"sameStack\":" + (back == stack) + ",\"eye\":" + eyeState + ",\"events\":" + strings(EW.log) + "}");
        WitchProbe.w.E = false;
      }
    }

    // End portal block: sides drawn against stone/air neighbours, collisions, onBlockAdded, display tick.
    {
      clear();
      StringBuilder sides = new StringBuilder("[");
      aji portal = ajn.bq;
      for (int neighbour = 0; neighbour < 2; neighbour++) {
        for (int side = 0; side < 6; side++) {
          clear();
          int dx = side == 4 ? 1 : side == 5 ? -1 : 0, dy = side == 0 ? 1 : side == 1 ? -1 : 0, dz = side == 2 ? 1 : side == 3 ? -1 : 0;
          WitchProbe.WW.cells.put("5,5,5", new int[] { PORTAL, 0 });
          if (neighbour == 1) WitchProbe.WW.cells.put((5 + dx) + "," + (5 + dy) + "," + (5 + dz), new int[] { 1, 0 });
          portal.a((ahl) w, 5, 5, 5);
          sides.append(sides.length() > 1 ? "," : "").append("[" + neighbour + "," + side + "," + portal.a((ahl) w, 5 + dx, 5 + dy, 5 + dz, side) + "]");
        }
      }
      sides.append("]");
      System.out.println("{\"case\":\"portalSide\",\"rows\":" + sides + ",\"note\":\"rows are [neighbour(0 air,1 stone), side, shouldSideBeRendered(world, neighbour x/y/z, side)]\"}");
      clear();
      List<String> collide = new ArrayList<>();
      for (int c = 0; c < 4; c++) {
        clear();
        Traveller t = new Traveller(w);
        WitchProbe.w.E = c == 3;
        if (c == 1) fd(sa.class, "l").set(t, new zd(w));
        if (c == 2) fd(sa.class, "m").set(t, new zd(w));
        portal.a((ahb) w, 5, 5, 5, t);
        collide.add(new String[] { "free", "riding", "ridden", "remote" }[c] + ":" + (EW.log.isEmpty() ? "none" : EW.log.get(0)));
        WitchProbe.w.E = false;
      }
      List<sa> none = new ArrayList<>();
      java.util.List boxes = new ArrayList();
      portal.a((ahb) w, 5, 5, 5, azt.a(0, 0, 0, 10, 10, 10), boxes, null);
      System.out.println("{\"case\":\"portalCollide\",\"entity\":" + strings(collide) + ",\"collisionBoxes\":" + boxes.size() + "}");

      // onBlockAdded: skipped while the dragon-fight flag is set; outside the overworld the block is replaced by air.
      List<String> added = new ArrayList<>();
      for (int c = 0; c < 4; c++) {
        clear();
        int dim = c < 2 ? 0 : 1;
        fd(aqo.class, "i").setInt(w.t, dim);
        akt.a = (c % 2) == 1;
        portal.b((ahb) w, 5, 5, 5);
        added.add("dimension=" + dim + ",flag=" + akt.a + ":" + (EW.log.isEmpty() ? "none" : EW.log.get(0)));
      }
      akt.a = false; fd(aqo.class, "i").setInt(w.t, 0);
      System.out.println("{\"case\":\"portalAdded\",\"rows\":" + strings(added) + "}");

      for (long seed : new long[] { 1, 2, 3 }) {
        clear();
        portal.b((ahb) w, 7, 64, -3, new Random(seed));
        System.out.println("{\"case\":\"portalDisplay\",\"seed\":" + seed + ",\"particle\":" + strings(EW.log) + "}");
      }
    }
  }
}
