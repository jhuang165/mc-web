import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;

// The unchanged CommandSummon (bu.b(ac, String[])) run with a stand-in command sender on the HorseProbe world double that records spawnEntityInWorld.
// CommandSummon makes the entity with EntityList.createEntityFromNBT (sg.a) and then calls setLocationAndAngles (sa.b(DDDFF)), which adds yOffset (sa.L) to
// the y it is given; every Riding compound is made, placed and spawned the same way. Probed here: the placement of a minecart and a boat (posY and box
// against the command y), and the hanging entities with Direction/Dir values inside and outside 0..3 (the entity that results, or the failure message).
// One JSON object per line:
//   summon {name, args, messages [text], spawned [{id, x, y, z, minY, maxY, yaw, yOffset, direction (ss.e, hanging only), tile [a, b, c, d], nbt (hex of sa.e)}]}
public class SummonProbe {
  static HorseProbe.World W;
  static List<sa> spawned = new ArrayList<>();
  static List<String> messages = new ArrayList<>();
  public static class SW extends HorseProbe.World {
    public boolean d(sa e) { spawned.add(e); return true; }
  }
  public static class Sender implements ac {
    public String b_() { return "Probe"; }
    public fj c_() { return null; }
    public void a(fj m) { messages.add(m.c()); }
    public boolean a(int l, String c) { return true; }
    public r f_() { return new r(10, 64, 10); }
    public ahb d() { return W; }
  }
  static String q(String s) { return s == null ? "null" : "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"") + "\""; }
  static String hex(dh t) throws Exception { return LevelDatProbe.hex(t); }

  static void run(String name, String... args) throws Exception {
    spawned.clear(); messages.clear();
    String error = null;
    try { new bu().b(new Sender(), args); } catch (Throwable e) { error = e.getClass().getSimpleName() + (e.getCause() != null ? ":" + e.getCause().getClass().getSimpleName() : ""); }
    StringBuilder s = new StringBuilder("{\"case\":\"summon\",\"name\":" + q(name) + ",\"args\":[");
    for (int i = 0; i < args.length; i++) s.append(i > 0 ? "," : "").append(q(args[i]));
    s.append("],\"messages\":[");
    for (int i = 0; i < messages.size(); i++) s.append(i > 0 ? "," : "").append(q(messages.get(i)));
    s.append("],\"error\":" + q(error) + ",\"spawned\":[");
    for (int i = 0; i < spawned.size(); i++) {
      sa e = spawned.get(i);
      dh t = new dh();
      boolean wrote = e.d(t);
      if (!wrote) e.e(t);
      s.append(i > 0 ? "," : "").append("{\"id\":" + q(sg.b(e)) + ",\"x\":" + e.s + ",\"y\":" + e.t + ",\"z\":" + e.u + ",\"minY\":" + e.C.b + ",\"maxY\":" + e.C.e
        + ",\"minX\":" + e.C.a + ",\"maxX\":" + e.C.d + ",\"minZ\":" + e.C.c + ",\"maxZ\":" + e.C.f + ",\"yaw\":" + e.y + ",\"yOffset\":" + e.L);
      if (e instanceof ss) {
        ss h = (ss) e;
        String valid;
        try { valid = String.valueOf(h.e()); } catch (Throwable x) { valid = q(x.getClass().getSimpleName()); }
        s.append(",\"direction\":" + h.a + ",\"tile\":[" + h.a + "," + h.b + "," + h.c + "," + h.d + "],\"surface\":" + valid);
      }
      s.append(",\"nbt\":\"" + hex(t) + "\"}");
    }
    s.append("]}");
    System.out.println(s);
  }

  public static void main(String[] args) throws Exception {
    aji.p(); adb.l();
    sun.misc.Unsafe u = MobMoveProbe.unsafe();
    W = (SW) u.allocateInstance(SW.class);
    HorseProbe.W = W;
    MobMoveProbe.set(W, "s", new Random(2));
    MobMoveProbe.set(W, "C", new qi());
    for (Field f : ahb.class.getDeclaredFields())
      if (f.getType() == List.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(W, new ArrayList()); }
    MobMoveProbe.set(W, "t", u.allocateInstance(aqq.class));
    LevelDatProbe.u = u;
    ays info = new ays(new ahj(17L, ahk.b, true, false, ahm.b), "Probe");
    MobMoveProbe.field(ahb.class, "x").set(W, info);

    run("cart", "MinecartRideable", "10.5", "64", "10.5");
    run("cart-tag", "MinecartRideable", "10.5", "64", "10.5", "{}");
    run("chest-cart", "MinecartChest", "20.5", "70", "-4.5");
    run("boat", "Boat", "10.5", "64", "10.5");
    run("boat-tag", "Boat", "10.5", "64", "10.5", "{}");
    run("zombie-on-cart", "Zombie", "10.5", "64", "10.5", "{Riding:{id:MinecartRideable}}");
    run("item", "Item", "10.5", "64", "10.5", "{Item:{id:1,Count:1}}");
    run("tnt", "PrimedTnt", "10.5", "64", "10.5", "{Fuse:80}");
    for (int d : new int[] {0, 1, 2, 3, 4, 5, 127, -1, 128})
      run("painting-direction-" + d, "Painting", "10.5", "64", "10.5", "{Direction:" + d + "b,TileX:10,TileY:64,TileZ:10,Motive:\"Kebab\"}");
    for (int d : new int[] {0, 1, 2, 3, 4})
      run("painting-dir-" + d, "Painting", "10.5", "64", "10.5", "{Dir:" + d + "b,TileX:10,TileY:64,TileZ:10,Motive:\"Kebab\"}");
    run("painting-none", "Painting", "10.5", "64", "10.5", "{TileX:10,TileY:64,TileZ:10,Motive:\"Kebab\"}");
    run("painting-direction-int", "Painting", "10.5", "64", "10.5", "{Direction:5,TileX:10,TileY:64,TileZ:10,Motive:\"Kebab\"}");
    for (int d : new int[] {0, 1, 2, 3, 4, 5})
      run("frame-direction-" + d, "ItemFrame", "10.5", "64", "10.5", "{Direction:" + d + "b,TileX:10,TileY:64,TileZ:10}");
    run("knot", "LeashKnot", "10.5", "64", "10.5", "{TileX:10,TileY:64,TileZ:10}");
  }
}
