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
  static void hit(sa e) { if (!e.K) hits.add(new int[] { depth, ents.indexOf(e) }); }
  public static class BW extends ChunkOrderProbe.CW {
    public agw a(sa e, double x, double y, double z, float power, boolean flaming, boolean smoking) {
      agw ex = new agw(this, e, x, y, z, power);
      depth++;
      try { ex.a(); } finally { depth--; } // doExplosionA only: the scenes have no blocks for doExplosionB to break
      return ex;
    }
  }
  public static class LItem extends xk { LItem(ahb w, double x, double y, double z) { super(w, x, y, z, new add(adb.d(1))); } public boolean a(ro s, float f) { hit(this); return super.a(s, f); } }
  public static class LOrb extends sq { LOrb(ahb w, double x, double y, double z) { super(w, x, y, z, 3); } public boolean a(ro s, float f) { hit(this); return super.a(s, f); } }
  public static class LArrow extends zc { LArrow(ahb w, double x, double y, double z) { super(w, x, y, z); } public boolean a(ro s, float f) { hit(this); return super.a(s, f); } }
  public static class LTnt extends xw { LTnt(ahb w, double x, double y, double z) { super(w, x, y, z, null); } public boolean a(ro s, float f) { hit(this); return super.a(s, f); } }
  public static class LCrystal extends wz { LCrystal(ahb w, double x, double y, double z) { super(w, x, y, z); } public boolean a(ro s, float f) { hit(this); return super.a(s, f); } }
  public static class LPlayer extends ChunkOrderProbe.Pl { LPlayer(ahb w) { super(w); } public boolean a(ro s, float f) { hit(this); return super.a(s, f); } }

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
    for (String s : out) System.out.println(s);
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
