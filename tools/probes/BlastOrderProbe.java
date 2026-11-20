import java.util.*;

// Batch 83 (blastorder83): the order in which Explosion.doExplosionA (agw.a(), executed unchanged) hurts the entities of a mixed list, over REAL chunks (ChunkOrderProbe.CW:
// apx with its 16 vertical entity lists, the unchanged World.getEntitiesWithinAABBExcludingEntity). Each entity is a real class (EntityItem xk, EntityXPOrb sq, EntityArrow zc,
// EntityTNTPrimed xw, EntityEnderCrystal wz, an EntityPlayer yz) whose attackEntityFrom (a(ro, F)) records its index (when it is not dead) and then runs the real one. An ender crystal's
// real wz.a calls World.createExplosion(null, posX, posY, posZ, 6, true) inline; newExplosion here runs that blast's doExplosionA (recorded one level deeper) and returns, so the
// record shows where the nested blast lands in the outer blast's list. Scenes: 3-8 entities in a 7-block cube around a centre near a chunk corner and a slice border, added in a
// random kind order (the player first: he joined before every entity), some moved across a border after they were added (the re-slice of updateEntityWithOptionalForce, as in
// ChunkOrderProbe). Record: {centre, ents: [kind, posX, posY, posZ], ops: [["add", i] | ["move", i, x, y, z]], hits: [[depth, i]]}.
public class BlastOrderProbe {
  static List<int[]> hits = new ArrayList<>();
  static List<sa> ents = new ArrayList<>();
  static int depth = 0;
  // b85 blastprobe85: evs is the full event log of the dragon / hanging / crystal scenes: ["h", depth, i] a hit, ["bd", depth, i] a dragon body hit, ["pt", depth, i, part, damage, healthAfter]
  // an attackEntityFromPart, ["drop", depth, i, itemId, count, x, y, z] an item spawned (World.spawnEntityInWorld) while entity i was being hurt. `cur` is the entity being hurt.
  static List<String> evs = new ArrayList<>();
  static int cur = -1;
  static boolean dmgLog = false; // b86 blastcover86: the "cover" scenes also log the damage a living entity or crystal is passed: ["dmg", depth, i, damage]
  static void hit(sa e, float f) {
    if (!e.K) {
      hits.add(new int[] { depth, ents.indexOf(e) }); cur = ents.indexOf(e); evs.add("[\"h\"," + depth + "," + cur + "]");
      if (dmgLog && (e instanceof sv || e instanceof wz)) evs.add("[\"dmg\"," + depth + "," + cur + "," + num(f) + "]");
    }
  }
  public static class BW extends ChunkOrderProbe.CW {
    // b86 blastcover86: the "cover" scenes' blocks (World.getBlock ahb.a(III), getBlockMetadata ahb.e(III)); every other scene has none, so the exposure rays see air.
    static Map<Long, Object[]> blocks = new HashMap<>();
    static long bkey(int x, int y, int z) { return ((long) (x & 0x3FFFFFF) << 38) | ((long) (y & 0xFFF) << 26) | (z & 0x3FFFFFF); }
    public aji a(int x, int y, int z) { Object[] b = blocks.get(bkey(x, y, z)); return b != null ? (aji) b[0] : super.a(x, y, z); }
    public int e(int x, int y, int z) { Object[] b = blocks.get(bkey(x, y, z)); return b != null ? (Integer) b[1] : super.e(x, y, z); }
    public boolean d(sa e) {
      if (e instanceof xk) { xk k = (xk) e; add st = k.f(); evs.add("[\"drop\"," + depth + "," + cur + "," + adb.b(st.b()) + "," + st.b + "," + num(k.s) + "," + num(k.t) + "," + num(k.u) + "]"); }
      return true;
    }
    public agw a(sa e, double x, double y, double z, float power, boolean flaming, boolean smoking) {
      agw ex = new agw(this, e, x, y, z, power);
      depth++;
      try { ex.a(); } finally { depth--; } // doExplosionA only: the scenes have no blocks for doExplosionB to break
      return ex;
    }
  }
  public static class LItem extends xk { LItem(ahb w, double x, double y, double z) { super(w, x, y, z, new add(adb.d(1))); } public boolean a(ro s, float f) { hit(this, f); return super.a(s, f); } }
  public static class LOrb extends sq { LOrb(ahb w, double x, double y, double z) { super(w, x, y, z, 3); } public boolean a(ro s, float f) { hit(this, f); return super.a(s, f); } }
  public static class LArrow extends zc { LArrow(ahb w, double x, double y, double z) { super(w, x, y, z); } public boolean a(ro s, float f) { hit(this, f); return super.a(s, f); } }
  public static class LTnt extends xw { LTnt(ahb w, double x, double y, double z) { super(w, x, y, z, null); } public boolean a(ro s, float f) { hit(this, f); return super.a(s, f); } }
  public static class LCrystal extends wz { LCrystal(ahb w, double x, double y, double z) { super(w, x, y, z); } public boolean a(ro s, float f) { hit(this, f); return super.a(s, f); } }
  public static class LPlayer extends ChunkOrderProbe.Pl { LPlayer(ahb w) { super(w); } public boolean a(ro s, float f) { hit(this, f); return super.a(s, f); } }

  // b86 blastcover86: living mobs (EntityZombie yq, EntityPig wo, EntitySpider yn, EntityCow wh) and the integrated server's player geometry: EntityPlayerMP's constructor
  // (mw.<init>, bytecode-read) sets yOffset L and ySize W to 0 and mw.g() (getEyeHeight) returns 1.62F, so posY is the feet; this EntityPlayer does the same.
  public static class LZombie extends yq { LZombie(ahb w) { super(w); } public boolean a(ro s, float f) { hit(this, f); return super.a(s, f); } }
  public static class LPig extends wo { LPig(ahb w) { super(w); } public boolean a(ro s, float f) { hit(this, f); return super.a(s, f); } }
  public static class LSpider extends yn { LSpider(ahb w) { super(w); } public boolean a(ro s, float f) { hit(this, f); return super.a(s, f); } }
  public static class LCow extends wh { LCow(ahb w) { super(w); } public boolean a(ro s, float f) { hit(this, f); return super.a(s, f); } }
  public static class LMPlayer extends LPlayer { LMPlayer(ahb w) { super(w); L = 0.0f; W = 0.0f; } public float g() { return 1.62f; } }
  public static class LEye extends zd { LEye(ahb w, double x, double y, double z) { super(w, x, y, z); } public boolean a(ro s, float f) { hit(this, f); return super.a(s, f); } }
  public static class LHook extends xe { LHook(ahb w, double x, double y, double z, yz angler) { super(w, x, y, z, angler); } public boolean a(ro s, float f) { hit(this, f); return super.a(s, f); } }
  public static class LDragon extends xa {
    LDragon(ahb w) { super(w); }
    public boolean a(ro s, float f) { if (!K) { cur = ents.indexOf(this); evs.add("[\"bd\"," + depth + "," + cur + "]"); } return super.a(s, f); } // xa.a(ro, F): returns false
    public boolean a(wy part, ro s, float f) {
      cur = ents.indexOf(this);
      boolean r = super.a(part, s, f);
      evs.add("[\"pt\"," + depth + "," + cur + "," + Arrays.asList(bp).indexOf(part) + "," + num(f) + "," + num(aS()) + "," + r + "]");
      return r;
    }
  }
  public static class LPaint extends tb { LPaint(ahb w) { super(w); } public boolean a(ro s, float f) { hit(this, f); return super.a(s, f); } }
  public static class LFrame extends st { LFrame(ahb w) { super(w); } public boolean a(ro s, float f) { hit(this, f); return super.a(s, f); } }
  public static class LKnot extends su { LKnot(ahb w, int x, int y, int z) { super(w, x, y, z); } public boolean a(ro s, float f) { hit(this, f); return super.a(s, f); } }

  static String num(double v) { return Double.toString(v); }
  static String arr(double... v) { StringBuilder b = new StringBuilder("["); for (int i = 0; i < v.length; i++) { if (i > 0) b.append(','); b.append(num(v[i])); } return b.append(']').toString(); }

  public static void main(String[] args) throws Exception {
    BW w = world();
    Random rnd = new Random(83);
    String[] kinds = { "item", "orb", "arrow", "tnt", "crystal" };
    double[] corner = { -0.4, -0.1, 0.0, 0.2, 0.5 };
    List<String> out = new ArrayList<>();
    for (int n = 0; n < 400; n++) {
      ChunkOrderProbe.load(-3, 4);
      hits.clear(); ents.clear();
      double cx = 16.0 + corner[rnd.nextInt(corner.length)], cy = 16.0 + corner[rnd.nextInt(corner.length)], cz = 16.0 + corner[rnd.nextInt(corner.length)];
      int count = 3 + rnd.nextInt(6);
      boolean withPlayer = rnd.nextInt(3) != 0;
      List<String> ops = new ArrayList<>(), desc = new ArrayList<>();
      int crystals = 0;
      for (int i = 0; i < count; i++) {
        String kind = i == 0 && withPlayer ? "player" : kinds[rnd.nextInt(kinds.length)];
        if (kind.equals("crystal") && ++crystals > 2) kind = "item";
        double x = cx + (rnd.nextInt(13) - 6) * 0.5, y = cy + (rnd.nextInt(13) - 6) * 0.5, z = cz + (rnd.nextInt(13) - 6) * 0.5;
        if (Math.abs(x - cx) < 0.3 && Math.abs(z - cz) < 0.3) x += 1.25; // keep the eye off the centre
        sa e;
        switch (kind) {
          case "player": { LPlayer p = new LPlayer(w); MobMoveProbe.set(p, "Z", new Random(0)); p.a(yj.a).a(1000.0); p.g(1000.0f); ChunkOrderProbe.place(p, x, y, z); e = p; break; }
          case "item": e = new LItem(w, x, y, z); break;
          case "orb": e = new LOrb(w, x, y, z); break;
          case "arrow": e = new LArrow(w, x, y, z); break;
          case "tnt": e = new LTnt(w, x, y, z); break;
          default: e = new LCrystal(w, x, y, z); break;
        }
        ents.add(e);
        ChunkOrderProbe.spawn(w, e);
        desc.add("[\"" + kind + "\"," + num(e.s) + "," + num(e.t) + "," + num(e.u) + "]");
        ops.add("[\"add\"," + i + "]");
        if (i > 0 && rnd.nextInt(4) == 0) { // move an earlier entity (it re-joins the end of its new cell's list when the cell changes)
          int j = rnd.nextInt(i + 1);
          sa m = ents.get(j);
          double mx = cx + (rnd.nextInt(13) - 6) * 0.5, my = cy + (rnd.nextInt(13) - 6) * 0.5, mz = cz + (rnd.nextInt(13) - 6) * 0.5;
          if (Math.abs(mx - cx) < 0.3 && Math.abs(mz - cz) < 0.3) mx += 1.25;
          ChunkOrderProbe.place(m, mx, my, mz);
          ChunkOrderProbe.reslice(w, m);
          ops.add("[\"move\"," + j + "," + arr(m.s, m.t, m.u) + "]");
        }
      }
      new agw(w, null, cx, cy, cz, 4.0f).a();
      StringBuilder hs = new StringBuilder("[");
      for (int i = 0; i < hits.size(); i++) { if (i > 0) hs.append(','); hs.append('[').append(hits.get(i)[0]).append(',').append(hits.get(i)[1]).append(']'); }
      out.add("{\"case\":\"blast\",\"centre\":" + arr(cx, cy, cz) + ",\"ents\":[" + String.join(",", desc) + "],\"ops\":[" + String.join(",", ops) + "],\"hits\":" + hs.append(']') + "}");
    }
    extra(w, out);
    cover(w, out);
    for (String s : out) System.out.println(s);
  }

  // ---- b85 blastprobe85: dragon, hanging and crystal scenes (cases "dragon", "hang", "crystal"), over the same real chunks and the unchanged agw.a() ----
  static String motion() {
    StringBuilder b = new StringBuilder("[");
    for (int i = 0; i < ents.size(); i++) { sa e = ents.get(i); if (i > 0) b.append(','); b.append(arr(e.v, e.w, e.x)); }
    return b.append(']').toString();
  }
  static void zero() { for (sa e : ents) { e.v = 0; e.w = 0; e.x = 0; } } // the constructors of items, orbs and TNT draw a Math.random motion: the record is the push alone
  static String deadFlags() {
    StringBuilder b = new StringBuilder("[");
    for (int i = 0; i < ents.size(); i++) { if (i > 0) b.append(','); b.append(ents.get(i).K); }
    return b.append(']').toString();
  }
  static double pick(Random rnd, double c, int span, double step) { return c + (rnd.nextInt(2 * span + 1) - span) * step; }
  static void field(Object o, Class<?> c, String n, Object v) throws Exception { java.lang.reflect.Field f = c.getDeclaredField(n); f.setAccessible(true); f.set(o, v); }

  static void extra(BW w, List<String> out) throws Exception {
    Random rnd = new Random(85);
    double[] corner = { -0.4, -0.1, 0.0, 0.2, 0.5 };
    // dragon: the body (xa) and its seven parts, with other entities in the same list
    for (int n = 0; n < 300; n++) {
      ChunkOrderProbe.load(-3, 4);
      hits.clear(); ents.clear(); evs.clear(); cur = -1;
      double cx = 16.0 + corner[rnd.nextInt(corner.length)], cy = 16.0 + corner[rnd.nextInt(corner.length)], cz = 16.0 + corner[rnd.nextInt(corner.length)];
      float size = new float[] { 4.0f, 4.0f, 6.0f, 2.0f, 3.0f }[rnd.nextInt(5)];
      int count = 1 + rnd.nextInt(4), at = rnd.nextInt(count);
      List<String> desc = new ArrayList<>(), ops = new ArrayList<>();
      for (int i = 0; i < count; i++) {
        sa e;
        if (i == at) {
          double x = pick(rnd, cx, 20, 0.7), y = pick(rnd, cy, 8, 1.0), z = pick(rnd, cz, 20, 0.7);
          float yaw = rnd.nextInt(24) * 15.0f; long seed = rnd.nextInt(1000); float h0 = new float[] { 200f, 200f, 30f, 3f }[rnd.nextInt(4)];
          LDragon d = new LDragon(w); MobMoveProbe.set(d, "Z", new Random(seed)); d.g(h0);
          ChunkOrderProbe.place(d, x, y, z); d.y = yaw;
          StringBuilder ps = new StringBuilder("[");
          float[][] sizes = { { 3, 3 }, { 5, 3 }, { 2, 2 }, { 2, 2 }, { 2, 2 }, { 4, 2 }, { 4, 3 } }; // xa.e writes these into the parts every tick (wy.N width, wy.M height); the constructor's are 6/8/4
          for (int k = 0; k < 7; k++) {
            d.bp[k].N = sizes[k][0]; d.bp[k].M = sizes[k][1];
            double px = x + (rnd.nextInt(17) - 8) * 0.75, py = y + (rnd.nextInt(13) - 4) * 0.75, pz = z + (rnd.nextInt(17) - 8) * 0.75;
            ChunkOrderProbe.place(d.bp[k], px, py, pz);
            ps.append(k > 0 ? "," : "").append(arr(px, py, pz));
          }
          ps.append("]");
          e = d;
          desc.add("[\"dragon\"," + num(e.s) + "," + num(e.t) + "," + num(e.u) + "," + num(yaw) + "," + num(h0) + "," + seed + "," + ps + "]");
        } else {
          double x = pick(rnd, cx, 6, 0.5), y = pick(rnd, cy, 6, 0.5), z = pick(rnd, cz, 6, 0.5);
          String kind = new String[] { "item", "orb", "tnt", "crystal", "arrow" }[rnd.nextInt(5)];
          switch (kind) { case "item": e = new LItem(w, x, y, z); break; case "orb": e = new LOrb(w, x, y, z); break; case "tnt": e = new LTnt(w, x, y, z); break; case "arrow": e = new LArrow(w, x, y, z); break; default: e = new LCrystal(w, x, y, z); }
          desc.add("[\"" + kind + "\"," + num(e.s) + "," + num(e.t) + "," + num(e.u) + "]");
        }
        ents.add(e); ChunkOrderProbe.spawn(w, e); ops.add("[\"add\"," + i + "]");
      }
      zero(); new agw(w, null, cx, cy, cz, size).a();
      LDragon d = (LDragon) ents.get(at);
      long next = ((Random) MobMoveProbe.field(sa.class, "Z").get(d)).nextLong();
      out.add("{\"case\":\"dragon\",\"centre\":" + arr(cx, cy, cz) + ",\"size\":" + num(size) + ",\"ents\":[" + String.join(",", desc) + "],\"ops\":[" + String.join(",", ops) + "],\"events\":" + evs
        + ",\"motion\":" + motion() + ",\"dead\":" + deadFlags() + ",\"health\":" + num(d.aS()) + ",\"target\":" + arr(d.h, d.i, d.bm) + ",\"next\":\"" + next + "\"}");
    }
    // hanging: paintings, item frames (with and without an item), leash knots with items, crystals, TNT and orbs; the exploder is none, or a primed TNT placed by a survival or a creative player
    String[] hk = { "painting", "frame", "frameItem", "frameNever", "knot", "item", "crystal", "tnt", "orb" };
    for (int n = 0; n < 300; n++) {
      ChunkOrderProbe.load(-3, 4);
      hits.clear(); ents.clear(); evs.clear(); cur = -1;
      double cx = 16.0 + corner[rnd.nextInt(corner.length)], cy = 16.0 + corner[rnd.nextInt(corner.length)], cz = 16.0 + corner[rnd.nextInt(corner.length)];
      if (rnd.nextInt(3) == 0) { cx = 16.5; cz = 16.5; } // a block centre: hanging entities sit 0.5625 from a wall block
      float size = new float[] { 4.0f, 4.0f, 2.0f, 3.0f }[rnd.nextInt(4)];
      int count = 2 + rnd.nextInt(6), crystals = 0;
      List<String> desc = new ArrayList<>(), ops = new ArrayList<>();
      for (int i = 0; i < count; i++) {
        String kind = hk[rnd.nextInt(hk.length)];
        if (kind.equals("crystal") && ++crystals > 1) kind = "item";
        int tx = (int) Math.floor(cx) + rnd.nextInt(7) - 3, ty = (int) Math.floor(cy) + rnd.nextInt(5) - 2, tz = (int) Math.floor(cz) + rnd.nextInt(7) - 3, dir = rnd.nextInt(4);
        sa e;
        switch (kind) {
          case "painting": { LPaint p = new LPaint(w); int art = rnd.nextInt(tc.values().length); p.e = tc.values()[art]; p.b = tx; p.c = ty; p.d = tz; p.a(dir); e = p; desc.add("[\"painting\"," + num(p.s) + "," + num(p.t) + "," + num(p.u) + "," + art + "," + dir + "," + tx + "," + ty + "," + tz + "]"); break; }
          case "frame": case "frameItem": case "frameNever": {
            LFrame f = new LFrame(w); f.b = tx; f.c = ty; f.d = tz; f.a(dir);
            boolean item = !kind.equals("frame"); float chance = kind.equals("frameNever") ? 0.0f : 1.0f;
            int itemId = item ? 1 + rnd.nextInt(3) : 0;
            if (item) f.a(new add(adb.d(itemId)));
            field(f, st.class, "e", chance);
            e = f; desc.add("[\"frame\"," + num(f.s) + "," + num(f.t) + "," + num(f.u) + "," + dir + "," + tx + "," + ty + "," + tz + "," + itemId + "," + num(chance) + "]"); break;
          }
          case "knot": { LKnot k = new LKnot(w, tx, ty, tz); e = k; desc.add("[\"knot\"," + num(k.s) + "," + num(k.t) + "," + num(k.u) + "," + tx + "," + ty + "," + tz + "]"); break; }
          default: {
            double x = pick(rnd, cx, 6, 0.5), y = pick(rnd, cy, 6, 0.5), z = pick(rnd, cz, 6, 0.5);
            if (Math.abs(x - cx) < 0.3 && Math.abs(z - cz) < 0.3) x += 1.25;
            switch (kind) { case "item": e = new LItem(w, x, y, z); break; case "orb": e = new LOrb(w, x, y, z); break; case "tnt": e = new LTnt(w, x, y, z); break; default: e = new LCrystal(w, x, y, z); }
            desc.add("[\"" + kind + "\"," + num(e.s) + "," + num(e.t) + "," + num(e.u) + "]");
          }
        }
        ents.add(e); ChunkOrderProbe.spawn(w, e); ops.add("[\"add\"," + i + "]");
      }
      int who = rnd.nextInt(3); // 0 no exploder, 1 TNT placed by a survival player, 2 TNT placed by a creative player
      sa exploder = null;
      if (who > 0) {
        LPlayer p = new LPlayer(w); MobMoveProbe.set(p, "Z", new Random(0)); p.a(yj.a).a(1000.0); p.g(1000.0f); p.bE.d = who == 2;
        ChunkOrderProbe.place(p, cx + 40, cy, cz); // not in a list: the placer only decides how the hanging entities break
        exploder = new xw(w, cx, cy, cz, p);
      }
      zero(); new agw(w, exploder, cx, cy, cz, size).a();
      out.add("{\"case\":\"hang\",\"centre\":" + arr(cx, cy, cz) + ",\"size\":" + num(size) + ",\"exploder\":" + who + ",\"ents\":[" + String.join(",", desc) + "],\"ops\":[" + String.join(",", ops) + "],\"events\":" + evs
        + ",\"motion\":" + motion() + ",\"dead\":" + deadFlags() + "}");
    }
    // crystal: one to three entities (crystals mostly) on the reach gate (distance / (2 * size) around 1); the recorded motion is the push (eye posY, box 2 x 2 x 2)
    for (int n = 0; n < 300; n++) {
      ChunkOrderProbe.load(-3, 4);
      hits.clear(); ents.clear(); evs.clear(); cur = -1;
      double cx = 16.0 + corner[rnd.nextInt(corner.length)], cy = 16.0 + corner[rnd.nextInt(corner.length)], cz = 16.0 + corner[rnd.nextInt(corner.length)];
      float size = new float[] { 4.0f, 4.0f, 2.0f, 1.0f, 6.0f }[rnd.nextInt(5)];
      int count = 1 + rnd.nextInt(3);
      List<String> desc = new ArrayList<>(), ops = new ArrayList<>();
      for (int i = 0; i < count; i++) {
        double r = 2.0 * size * (0.55 + rnd.nextInt(10) * 0.05); // 0.55 .. 1.0 of the reach, 1.0 exactly on the gate
        double yaw = rnd.nextInt(24) * 15.0 * Math.PI / 180.0, pitch = (rnd.nextInt(13) - 6) * 15.0 * Math.PI / 180.0;
        double x = cx + r * Math.cos(pitch) * Math.cos(yaw), y = cy + r * Math.sin(pitch), z = cz + r * Math.cos(pitch) * Math.sin(yaw);
        x = Math.round(x * 4) / 4.0; y = Math.round(y * 4) / 4.0; z = Math.round(z * 4) / 4.0;
        if (Math.abs(x - cx) < 0.3 && Math.abs(z - cz) < 0.3 && Math.abs(y - cy) < 0.3) x += 1.25;
        int pickKind = i == 0 ? 0 : rnd.nextInt(4); // crystal, item, eye of ender, fishing hook (its angler is no list entry)
        sa e; String kind;
        switch (pickKind) {
          case 1: e = new LItem(w, x, y, z); kind = "item"; break;
          case 2: e = new LEye(w, x, y, z); kind = "eye"; break;
          case 3: { LPlayer ang = new LPlayer(w); MobMoveProbe.set(ang, "Z", new Random(0)); ChunkOrderProbe.place(ang, cx + 40, cy, cz); e = new LHook(w, x, y, z, ang); kind = "hook"; break; }
          default: e = new LCrystal(w, x, y, z); kind = "crystal";
        }
        desc.add("[\"" + kind + "\"," + num(e.s) + "," + num(e.t) + "," + num(e.u) + "]");
        ents.add(e); ChunkOrderProbe.spawn(w, e); ops.add("[\"add\"," + i + "]");
      }
      zero(); new agw(w, null, cx, cy, cz, size).a();
      out.add("{\"case\":\"crystal\",\"centre\":" + arr(cx, cy, cz) + ",\"size\":" + num(size) + ",\"ents\":[" + String.join(",", desc) + "],\"ops\":[" + String.join(",", ops) + "],\"events\":" + evs + ",\"motion\":" + motion() + ",\"dead\":" + deadFlags() + "}");
    }
  }

  // ---- b86 blastcover86: exposure (World.getBlockDensity ahb.a(azw, azt), executed through the unchanged agw.a()) with blocks between the blast and the entities ----
  // Palette: native id and the metadata values drawn for it. Doors and double plants are placed as a lower and an upper half.
  static final int[][] PALETTE = {
    { 1, 0 }, { 2, 0 }, { 20, 0 }, { 95, 0, 3, 14 }, { 18, 0, 4, 8 }, { 79, 0 }, { 89, 0 }, { 80, 0 }, { 49, 0 }, { 7, 0 },
    { 8, 0, 1, 3, 7, 8 }, { 9, 0, 2 }, { 10, 0, 4 }, { 11, 0, 3, 8 }, { 51, 0, 5, 15 },
    { 44, 0, 1, 3, 5, 8, 9, 11, 13 }, { 126, 0, 2, 8, 10 }, { 43, 0, 1 },
    { 85, 0 }, { 113, 0 }, { 107, 0, 1, 2, 3, 4, 5, 6, 7 }, { 139, 0, 1 }, { 102, 0 }, { 101, 0 }, { 160, 0, 5, 15 },
    { 64, -1 }, { 71, -1 }, { 175, -2 },
    { 53, 0, 1, 2, 3, 4, 5, 6, 7 }, { 67, 0, 2, 5, 7 }, { 108, 1, 6 }, { 156, 3, 4 },
    { 50, 1, 2, 3, 4, 5 }, { 75, 1, 5 }, { 76, 3, 5 }, { 30, 0 }, { 78, 0, 1, 3, 5, 7 }, { 171, 0, 7 }, { 96, 0, 3, 4, 7, 8, 11, 12, 15 }, { 65, 2, 3, 4, 5 },
    { 54, 2, 3, 4, 5 }, { 146, 2, 5 }, { 130, 2 }, { 88, 0 }, { 60, 0, 7 }, { 116, 0 }, { 81, 0, 5 }, { 92, 0, 3, 6 }, { 145, 0, 1, 2, 3, 5, 10 },
    { 106, 0, 1, 2, 4, 5, 8, 15 }, { 66, 0, 1, 2, 5, 6, 9 }, { 27, 0, 3, 8, 11 }, { 157, 1, 4 }, { 26, 0, 1, 2, 3, 8, 9, 10, 11 },
    { 117, 0, 7 }, { 118, 0, 3 }, { 120, 0, 4, 7 }, { 122, 0 }, { 127, 0, 1, 2, 3, 5, 10, 11 }, { 140, 0 }, { 151, 0 }, { 154, 0, 3 },
    { 70, 0, 1 }, { 72, 0, 1 }, { 147, 0, 3 }, { 77, 1, 2, 3, 4, 9, 12 }, { 143, 1, 4, 10 }, { 93, 0, 5, 10 }, { 149, 0, 7 }, { 69, 1, 3, 5, 6, 7, 8, 13, 14 },
    { 63, 0, 4, 9 }, { 68, 2, 3, 4, 5 }, { 144, 1, 2, 3, 4, 5 }, { 115, 0, 3 }, { 83, 0 }, { 31, 1, 2 }, { 32, 0 }, { 37, 0 }, { 38, 0, 4 }, { 39, 0 }, { 40, 0 },
    { 6, 0, 1, 5 }, { 59, 0, 7 }, { 141, 0, 7 }, { 142, 3 }, { 104, 0, 3, 7 }, { 105, 2, 6 }, { 111, 0 }, { 90, 1, 2 }, { 119, 0 },
    { 29, 0, 1, 3, 8, 9, 13 }, { 33, 2, 4, 10, 12 }, { 34, 0, 1, 3, 8, 9, 12 }, { 132, 0, 1, 2, 4, 6 }, { 131, 0, 2, 4, 7 }, { 55, 0, 15 }, { 28, 0, 3 },
    { 47, 0 }, { 58, 0 }, { 61, 2 }, { 23, 0 }, { 25, 0 }, { 46, 0 }, { 99, 0, 5 }, { 123, 0 }, { 137, 0 }, { 138, 0 }, { 121, 0 }, { 52, 0 }, { 24, 0 }, { 35, 0, 14 },
  };
  static List<String> blockDesc = new ArrayList<>();
  static void put(Random rnd, int[] kind, int x, int y, int z) {
    int id = kind[0];
    if (kind[1] == -1) { // a door: the lower half (facing, open), the upper half (hinge) above it, or a lone half
      int lower = rnd.nextInt(8), upper = 8 | rnd.nextInt(2), form = rnd.nextInt(5);
      if (form != 4) set(id, lower, x, y, z);
      if (form != 3) set(id, upper, x, y + 1, z);
      return;
    }
    if (kind[1] == -2) { set(id, rnd.nextInt(6), x, y, z); if (rnd.nextInt(4) != 0) set(id, 8, x, y + 1, z); return; } // a double plant
    set(id, kind[1 + rnd.nextInt(kind.length - 1)], x, y, z);
  }
  static void set(int id, int meta, int x, int y, int z) {
    long k = BW.bkey(x, y, z);
    if (BW.blocks.containsKey(k)) return;
    BW.blocks.put(k, new Object[] { aji.e(id), meta });
    blockDesc.add("[" + id + "," + meta + "," + x + "," + y + "," + z + "]");
  }
  static void cover(BW w, List<String> out) throws Exception {
    Random rnd = new Random(86);
    double[] corner = { -0.4, -0.1, 0.0, 0.2, 0.5, 0.3125, -0.6875 };
    String[] kinds = { "item", "orb", "arrow", "tnt", "eye", "hook", "zombie", "pig", "babypig", "spider", "cow", "player", "crystal" };
    dmgLog = true;
    // Block bounds are shared fields: the end portal frame (aku) keeps the constructor's full cube until setBlockBoundsForItemRender (g()) or its
    // addCollisionBoxesToList (which ends in g()) runs, then stays 13/16 high. Any world that has rendered the item or collided an entity is in that
    // second state, which is the one the port models; set it once here. (A button with an invalid facing, meta 0/5-7/8/13-15, keeps whatever bounds
    // the last block left, so the palette uses valid facings only.)
    aji.e(120).g();
    for (int n = 0; n < 600; n++) {
      ChunkOrderProbe.load(-3, 4);
      hits.clear(); ents.clear(); evs.clear(); cur = -1; BW.blocks.clear(); blockDesc.clear();
      double cx = 16.0 + corner[rnd.nextInt(corner.length)], cy = 16.0 + corner[rnd.nextInt(corner.length)], cz = 16.0 + corner[rnd.nextInt(corner.length)];
      float size = new float[] { 4.0f, 4.0f, 3.0f, 2.0f, 6.0f }[rnd.nextInt(5)];
      int bx = (int) Math.floor(cx), by = (int) Math.floor(cy), bz = (int) Math.floor(cz);
      int[][] pal = new int[1 + rnd.nextInt(3)][];
      for (int i = 0; i < pal.length; i++) pal[i] = PALETTE[rnd.nextInt(PALETTE.length)];
      int mode = rnd.nextInt(4); // 0 scatter, 1 a wall on one side, 2 a shell around the centre, 3 walls and scatter
      if (mode == 1 || mode == 3) {
        int axis = rnd.nextInt(3), off = (rnd.nextBoolean() ? 1 : -1) * (1 + rnd.nextInt(3)), ha = rnd.nextInt(5), hb = rnd.nextInt(5);
        int gaps = rnd.nextInt(3); // 0 solid, else 1 in (gaps * 3) cells left open
        for (int a = -ha; a <= ha; a++) for (int b = -hb; b <= hb; b++) {
          if (gaps > 0 && rnd.nextInt(gaps * 3) == 0) continue;
          int x = bx, y = by, z = bz;
          if (axis == 0) { x += off; y += a; z += b; } else if (axis == 1) { y += off; x += a; z += b; } else { z += off; x += a; y += b; }
          put(rnd, pal[rnd.nextInt(pal.length)], x, y, z);
        }
      }
      if (mode == 2) {
        int r = 1 + rnd.nextInt(2); double fill = 0.6 + rnd.nextInt(5) * 0.1;
        for (int x = -r; x <= r; x++) for (int y = -r; y <= r; y++) for (int z = -r; z <= r; z++)
          if ((Math.abs(x) == r || Math.abs(y) == r || Math.abs(z) == r) && rnd.nextDouble() < fill) put(rnd, pal[rnd.nextInt(pal.length)], bx + x, by + y, bz + z);
      }
      if (mode == 0 || mode == 3) {
        int count = 10 + rnd.nextInt(50);
        for (int i = 0; i < count; i++) put(rnd, pal[rnd.nextInt(pal.length)], bx + rnd.nextInt(11) - 5, by + rnd.nextInt(9) - 4, bz + rnd.nextInt(11) - 5);
      }
      int count = 2 + rnd.nextInt(5), crystals = 0;
      List<String> desc = new ArrayList<>(), ops = new ArrayList<>();
      for (int i = 0; i < count; i++) {
        String kind = kinds[rnd.nextInt(kinds.length)];
        if (kind.equals("crystal") && (++crystals > 1 || rnd.nextInt(2) == 0)) kind = "item";
        if (kind.equals("player") && i > 0) kind = "zombie"; // the player joined the world before every entity (the port stamps him first, candidate-order.js)
        double r = 2.0 * size * (0.1 + rnd.nextInt(18) * 0.05);
        double yaw = rnd.nextInt(48) * 7.5 * Math.PI / 180.0, pitch = (rnd.nextInt(13) - 6) * 10.0 * Math.PI / 180.0;
        double x = cx + r * Math.cos(pitch) * Math.cos(yaw), y = cy + r * Math.sin(pitch) - (kind.equals("player") || kind.equals("zombie") || kind.equals("cow") ? 1.0 : 0.0), z = cz + r * Math.cos(pitch) * Math.sin(yaw);
        x = Math.round(x * 16) / 16.0; y = Math.round(y * 16) / 16.0; z = Math.round(z * 16) / 16.0;
        if (Math.abs(x - cx) < 0.3 && Math.abs(z - cz) < 0.3) x += 1.25;
        // the port files its player by the eye (candidate-order.js): keep the feet and the eye in one vertical slice
        if (kind.equals("player") && Math.floor(y / 16.0) != Math.floor((y + 1.62f) / 16.0)) y -= 2.0;
        sa e;
        switch (kind) {
          case "item": e = new LItem(w, x, y, z); break;
          case "orb": e = new LOrb(w, x, y, z); break;
          case "arrow": e = new LArrow(w, x, y, z); break;
          case "tnt": e = new LTnt(w, x, y, z); break;
          case "eye": e = new LEye(w, x, y, z); break;
          case "hook": { LPlayer ang = new LPlayer(w); MobMoveProbe.set(ang, "Z", new Random(0)); ChunkOrderProbe.place(ang, cx + 40, cy, cz); e = new LHook(w, x, y, z, ang); break; }
          case "crystal": e = new LCrystal(w, x, y, z); break;
          case "player": { LMPlayer p = new LMPlayer(w); MobMoveProbe.set(p, "Z", new Random(0)); p.a(yj.a).a(1000.0); p.g(1000.0f); ChunkOrderProbe.place(p, x, y, z); e = p; break; }
          default: {
            sv m = kind.equals("zombie") ? new LZombie(w) : kind.equals("spider") ? new LSpider(w) : kind.equals("cow") ? new LCow(w) : new LPig(w);
            if (kind.equals("babypig")) ((rx) m).c(-24000); // EntityAgeable.setGrowingAge: setScaleForAge(true) halves the size
            m.a(yj.a).a(1000.0); m.g(1000.0f);
            ChunkOrderProbe.place(m, x, y, z); e = m;
          }
        }
        desc.add("[\"" + kind + "\"," + num(e.s) + "," + num(e.t) + "," + num(e.u) + "]");
        ents.add(e); ChunkOrderProbe.spawn(w, e); ops.add("[\"add\"," + i + "]");
      }
      zero(); new agw(w, null, cx, cy, cz, size).a();
      out.add("{\"case\":\"cover\",\"centre\":" + arr(cx, cy, cz) + ",\"size\":" + num(size) + ",\"blocks\":[" + String.join(",", blockDesc) + "],\"ents\":[" + String.join(",", desc) + "],\"ops\":[" + String.join(",", ops)
        + "],\"events\":" + evs + ",\"motion\":" + motion() + ",\"dead\":" + deadFlags() + "}");
    }
    dmgLog = false; BW.blocks.clear();
  }
  // ChunkOrderProbe.world() for this subclass (the same fields).
  static BW world() throws Exception {
    ChunkOrderProbe.CW base = ChunkOrderProbe.world();
    BW w = (BW) ChunkOrderProbe.u.allocateInstance(BW.class);
    for (Class<?> c = base.getClass(); c != null && c != Object.class; c = c.getSuperclass())
      for (java.lang.reflect.Field f : c.getDeclaredFields()) {
        if (java.lang.reflect.Modifier.isStatic(f.getModifiers())) continue;
        f.setAccessible(true);
        f.set(w, f.get(base));
      }
    DifficultyProbe.w = w; EquipmentProbe.u = ChunkOrderProbe.u;
    return w;
  }
}
