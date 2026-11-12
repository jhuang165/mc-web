import java.lang.reflect.Field;
import java.util.*;

// Batch 53 (digfinish): ItemInWorldManager (mx) run on the PlayerDamageProbe double. The real EntityPlayerMP (survival, real
// inventory, real Block.getPlayerRelativeBlockHardness) owns a real mx. The ops are the C07 packets of NetHandlerPlayServer
// (status 0 = mx.a(x,y,z,face), status 2 = mx.a(x,y,z), then the handler's S23 resend when the cell is not air, status 1 = mx.c)
// plus the server tick (mx.a()) and edits of the world double. Every step records the packets the world double saw.
//   partial|id|x|y|z|v   World.destroyBlockInWorldPartially (v -1 clears the cracks)
//   aux|2001|data        World.playAuxSFXAtEntity of the block break
//   remove|id            World.setBlockToAir at the dug cell (ItemInWorldManager.removeBlock)
//   S23|x|y|z|id         the handler's S23PacketBlockChange resend after status 2
public class DigFinishProbe {
  public static class DWorld extends PlayerDamageProbe.World {
    static List<String> log = new ArrayList<>();
    static Map<Long, Integer> meta = new HashMap<>();
    public int e(int x, int y, int z) { Integer m = meta.get(key(x, y, z)); return m == null ? 0 : m; }
    public void d(int id, int x, int y, int z, int v) { log.add("partial|" + v + "|" + x + "|" + y + "|" + z); }
    public boolean a(yz p, int x, int y, int z, int side) { return false; }
    public void a(yz p, int ev, int x, int y, int z, int data) { log.add("aux|" + ev + "|" + data); }
    public boolean f(int x, int y, int z) {
      Integer id = cells.get(key(x, y, z));
      log.add("remove|" + (id == null ? 0 : id));
      cells.remove(key(x, y, z));
      return id != null && id != 0;
    }
    static long key(int x, int y, int z) { return SuffocationProbe.World.key(x, y, z); }
  }
  static mx m; static mw p; static DWorld dw;
  static String num(float v) { return Float.toString(v); }
  static int cur() throws Exception { return MobMoveProbe.field(mx.class, "i").getInt(m); }
  static void setup(int ground) throws Exception {
    DWorld.cells.clear(); DWorld.meta.clear(); DWorld.log.clear();
    p = (mw) PlayerDamageProbe.prepare("player", 64.5, 5.0, 64.5, PlayerDamageProbe.setup());
    MobMoveProbe.set(p, "o", dw);
    m = new mx(dw);
    MobMoveProbe.set(m, "b", p);
    MobMoveProbe.set(m, "c", ahk.b);
    PlayerDamageProbe.u.putObject(p, PlayerDamageProbe.u.objectFieldOffset(MobMoveProbe.field(mw.class, "c")), m);
    MobMoveProbe.field(sa.class, "D").setBoolean(p, ground != 0); // onGround
  }
  static void tool(int id) throws Exception {
    yx inv = (yx) MobMoveProbe.field(yz.class, "bm").get(p);
    inv.a[0] = id > 0 ? new add(adb.d(id), 1, 0) : null; inv.c = 0;
  }
  static int cell(int x, int y, int z) { return DWorld.cells.getOrDefault(DWorld.key(x, y, z), 0); }
  static String ev() { StringBuilder s = new StringBuilder("["); for (String e : DWorld.log) s.append(s.length() == 1 ? "" : ",").append("\"").append(e).append("\""); DWorld.log.clear(); return s + "]"; }
  // One op: t, s:x:y:z, f:x:y:z, a:x:y:z, set:x:y:z:id[:meta], ground:0|1, tool:id. Returns the step JSON.
  static String op(String o) throws Exception {
    String[] s = o.split(":");
    int x = s.length > 3 ? Integer.parseInt(s[1]) : 0, y = s.length > 3 ? Integer.parseInt(s[2]) : 0, z = s.length > 3 ? Integer.parseInt(s[3]) : 0;
    DWorld.log.clear();
    switch (s[0]) {
      case "t": m.a(); break;
      case "s": m.a(x, y, z, 1); break;
      case "f":
        m.a(x, y, z);
        if (dw.a(x, y, z).o() != awt.a) DWorld.log.add("S23|" + x + "|" + y + "|" + z + "|" + cell(x, y, z));
        break;
      case "a": m.c(x, y, z); break;
      case "set": DWorld.cells.put(DWorld.key(x, y, z), Integer.parseInt(s[4])); DWorld.meta.put(DWorld.key(x, y, z), s.length > 5 ? Integer.parseInt(s[5]) : 0); break;
      case "ground": MobMoveProbe.field(sa.class, "D").setBoolean(p, s[1].equals("1")); break;
      case "tool": tool(Integer.parseInt(s[1])); break;
      default: throw new IllegalArgumentException(o);
    }
    return "{\"op\":\"" + o + "\",\"cur\":" + cur() + ",\"events\":" + ev() + "}";
  }
  static boolean detail = false;
  static String rate(int x, int y, int z) { aji b = dw.a(x, y, z); if (b.o() == awt.a) return "null"; float r = b.a(p, dw, x, y, z); return Float.isInfinite(r) ? "\"Infinity\"" : num(r); }
  // Runs of "t" fold into one step {o:"t",n,e:["j:event"...]} (partial cracks only counted) unless `detail`.
  static void run(String name, int block, int tool, int ground, String... ops) throws Exception {
    setup(ground); tool(tool);
    DWorld.cells.put(DWorld.key(10, 5, 10), block);
    StringBuilder steps = new StringBuilder();
    int run = 0, partials = 0; StringBuilder runEv = new StringBuilder();
    for (int i = 0; i <= ops.length; i++) {
      String o = i < ops.length ? ops[i] : "end";
      if (!detail && o.equals("t")) {
        DWorld.log.clear(); m.a(); run++;
        for (String e : DWorld.log) { if (e.startsWith("partial")) partials++; else runEv.append(runEv.length() == 0 ? "" : ",").append("\"").append(run).append(":").append(e).append("\""); }
        DWorld.log.clear();
        continue;
      }
      if (run > 0) {
        steps.append(steps.length() == 0 ? "" : ",").append("{\"o\":\"t\",\"n\":").append(run).append(",\"p\":").append(partials).append(",\"e\":[").append(runEv).append("],\"c\":").append(cell(10, 5, 10)).append(",\"cur\":").append(cur()).append("}");
        run = 0; partials = 0; runEv.setLength(0);
      }
      if (i == ops.length) break;
      String r = rate(10, 5, 10);
      String st = op(o);
      steps.append(steps.length() == 0 ? "" : ",").append("{\"r\":").append(r).append(",\"s\":").append(st).append(",\"c\":").append(cell(10, 5, 10)).append(",\"ra\":").append(rate(10, 5, 10)).append("}");
    }
    System.out.println("{\"case\":\"dig\",\"name\":\"" + name + "\",\"block\":" + block + ",\"tool\":" + tool + ",\"ground\":" + ground + ",\"steps\":[" + steps + "]}");
  }
  static String[] seq(String first, int ticks, String... rest) {
    List<String> l = new ArrayList<>(); l.add(first);
    for (int i = 0; i < ticks; i++) l.add("t");
    l.addAll(Arrays.asList(rest));
    return l.toArray(new String[0]);
  }
  static String[] cat(String[] a, String... b) { String[] r = Arrays.copyOf(a, a.length + b.length); System.arraycopy(b, 0, r, a.length, b.length); return r; }
  static String[] ticks(int n) { String[] r = new String[n]; Arrays.fill(r, "t"); return r; }
  public static void main(String[] args) throws Exception {
    PlayerDamageProbe.init();
    dw = (DWorld) PlayerDamageProbe.u.allocateInstance(DWorld.class);
    for (Class<?> c = ahb.class; c != null && c != Object.class; c = c.getSuperclass())
      for (Field f : c.getDeclaredFields()) if (!java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(dw, f.get(PlayerDamageProbe.w)); }
    PlayerDamageProbe.w = dw; DifficultyProbe.w = dw; SuffocationProbe.w = dw;
    // Finish after k server ticks, for blocks, tools and ground: ground is set again before the finish (the server reads the player as it is then).
    int[] blocks = { 3, 2, 1, 4, 5, 12, 18, 20, 49, 87, 31, 50, 7 }; // dirt grass stone cobble planks sand leaves glass obsidian netherrack tall grass torch bedrock
    int[] tools = { 0, 270, 257, 278 };
    for (int b : blocks) for (int t : tools) for (int g : new int[] { 1, 0 }) {
      for (int k : new int[] { 0, 1, 2, 3, 4, 5, 8, 12, 17, 20, 25, 30, 40, 60, 100, 160 }) {
        // run on until the delayed destroy breaks (up to 400 ticks), or stop at once if it broke on the finish
        run("finish-k" + k, b, t, 1, cat(cat(seq("s:10:5:10", k, "ground:" + g, "f:10:5:10"), ticks(400))));
      }
    }
    // Block swapped under the dig: started on A, B at the cell when the finish arrives.
    int[][] swaps = { { 1, 3 }, { 3, 1 }, { 1, 31 }, { 1, 0 }, { 3, 49 }, { 1, 7 }, { 12, 1 }, { 31, 1 }, { 50, 3 } };
    for (int[] sw : swaps) for (int k : new int[] { 2, 10, 30, 60, 160 })
      run("swap-" + sw[0] + "-" + sw[1] + "-k" + k, sw[0], 0, 1, cat(seq("s:10:5:10", k, "set:10:5:10:" + sw[1], "f:10:5:10"), ticks(300)));
    // Finish at another cell than the dig start, finish with no start, finish after abort.
    run("finish-other-cell", 3, 0, 1, cat(seq("s:10:5:10", 10, "set:11:5:10:3", "f:11:5:10"), ticks(2)));
    run("finish-no-start", 3, 0, 1, "f:10:5:10", "t", "t");
    run("finish-after-abort", 3, 0, 1, cat(seq("s:10:5:10", 10, "a:10:5:10", "f:10:5:10"), ticks(2)));
    // The cell turns into air while digging (the cracks clear), and a second start while a delayed break waits.
    run("air-while-digging", 3, 0, 1, cat(seq("s:10:5:10", 5, "set:10:5:10:0", "t", "t"), "f:10:5:10"));
    run("restart-during-delay", 3, 0, 1, cat(seq("s:10:5:10", 3, "f:10:5:10", "t", "t", "s:10:5:10"), ticks(300)));
    run("double-finish", 3, 0, 1, cat(seq("s:10:5:10", 3, "f:10:5:10", "f:10:5:10"), ticks(300)));
    // Instant blocks and the start of the dig.
    run("start-tall-grass", 31, 0, 1, "s:10:5:10", "t");
    run("start-torch", 50, 0, 1, "s:10:5:10", "t");
    run("start-air", 0, 0, 1, "s:10:5:10", "t", "t", "f:10:5:10");
    run("start-bedrock", 7, 0, 1, "s:10:5:10", "t", "t", "f:10:5:10");
    // Cracks over time on stone with an iron pickaxe (the tick path records a partial step each time the tenth changes).
    detail = true;
    run("cracks-stone", 1, 257, 1, cat(seq("s:10:5:10", 40, "f:10:5:10")));
    detail = false;
    // Tool switched between start and finish; hand to pickaxe.
    run("tool-swap", 1, 0, 1, cat(seq("s:10:5:10", 20, "tool:257", "f:10:5:10"), ticks(300)));
  }
}
