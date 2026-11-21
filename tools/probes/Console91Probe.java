import io.netty.buffer.Unpooled;
import java.lang.reflect.Field;
import java.util.*;

// Batch 91 console91 evidence on the unchanged 1.7.10 classes (no class is patched or shipped), MobPackets89Probe's world double.
//  spawn   every registered living entity class made as in a fresh world: the S0F (fz(sv), the packet EntityTrackerEntry.func_151260_c builds) written after its id VarInt,
//          exactly as the encoder fa counts it, and the watched entries (DataWatcher te.c(): index, type) that S0F and the S1C of a first watch carry.
//  sizes   the DataWatcher value sizes by type id (0 byte, 1 short, 2 int, 3 float, 4 string, 5 ItemStack, 6 three ints) as te.a(List, et) writes them, from objects written one at a time.
public class Console91Probe {
  static int size(int id, ft packet) throws Exception {
    et buf = new et(Unpooled.buffer());
    buf.b(id);
    packet.b(buf);
    return buf.readableBytes();
  }
  static int entry(tf t) throws Exception {
    et buf = new et(Unpooled.buffer());
    te.a(new ArrayList<Object>(Collections.singletonList(t)), buf);
    return buf.readableBytes() - 1; // minus the 127 end byte
  }
  public static void main(String[] args) throws Exception {
    aji.p(); adb.l();
    sun.misc.Unsafe u = MobMoveProbe.unsafe();
    EquipmentProbe.u = u;
    EquipmentProbe.World w = (EquipmentProbe.World) u.allocateInstance(EquipmentProbe.World.class);
    EquipmentProbe.w = w;
    DifficultyProbe.w = w;
    InterchangeSpawnProbe.u = u;
    InterchangeSpawnProbe.w = w;
    MobMoveProbe.set(w, "s", new Random(2));
    MobMoveProbe.set(w, "C", new qi());
    for (Field f : ahb.class.getDeclaredFields())
      if (f.getType() == List.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(w, new ArrayList()); }
    ays info = (ays) u.allocateInstance(ays.class);
    MobMoveProbe.field(ays.class, "g").setLong(info, 1);
    MobMoveProbe.field(ays.class, "x").set(info, new agy());
    MobMoveProbe.field(ahb.class, "x").set(w, info);
    MobMoveProbe.field(ahb.class, "A").set(w, new wc(w));
    DifficultyProbe.World.chunk = (apx) u.allocateInstance(apx.class);
    DifficultyProbe.setDifficulty(2);
    EquipmentProbe.environment(1, 0, 6, 1, false);

    for (String t : new String[] { "", "0123456789abcdef0123456789abcdef0123", "\u00e9\u00e9\u00e9", "\u20ac", new String(new char[200]).replace('\0', 'x') }) {
      et b = new et(Unpooled.buffer());
      b.a(t);
      System.out.println("{\"case\":\"pbstring\",\"chars\":" + t.length() + ",\"utf8\":" + t.getBytes(java.nio.charset.StandardCharsets.UTF_8).length + ",\"bytes\":" + b.readableBytes() + "}");
    }
    List<String> ids = new ArrayList<>();
    Field cf = sg.class.getDeclaredField("c");
    cf.setAccessible(true);
    for (Object k : ((Map) cf.get(null)).keySet()) ids.add((String) k);
    Collections.sort(ids);
    Field idCounter = sa.class.getDeclaredField("b"); // Entity.nextEntityID: S0F's entity id is a VarInt, so keep it below 128 for each class as in console90
    idCounter.setAccessible(true);
    for (String id : ids) {
      idCounter.setInt(null, 1);
      sa e;
      try { e = InterchangeSpawnProbe.make(id, 1); } catch (Throwable x) { continue; }
      if (!(e instanceof sv)) continue;
      StringBuilder entries = new StringBuilder();
      String s0f;
      try {
        for (Object o : e.z().c()) { tf t = (tf) o; entries.append(entries.length() > 0 ? "," : "").append("[").append(t.c()).append(",").append(t.a()).append(",").append(entry(t)).append("]"); }
        s0f = String.valueOf(size(15, new fz((sv) e)));
      } catch (Throwable x) { s0f = "\"error " + x + "\""; }
      System.out.println("{\"case\":\"spawn\",\"id\":\"" + id + "\",\"s0f\":" + s0f + ",\"entries\":[" + entries + "]}");
      // b91: String setters (public, one String parameter, any class of the hierarchy): which one writes a string watcher entry, and the S0F with that entry set (owner 36 chars, name tag 20 chars)
      String probeText = "0123456789abcdef0123456789abcdef0123";
      for (java.lang.reflect.Method m : e.getClass().getMethods()) {
        if (m.getParameterCount() != 1 || m.getParameterTypes()[0] != String.class || java.lang.reflect.Modifier.isStatic(m.getModifiers())) continue;
        try {
          idCounter.setInt(null, 1);
          sa f = InterchangeSpawnProbe.make(id, 1);
          Map<Integer, String> before = new TreeMap<>();
          for (Object o : f.z().c()) { tf t = (tf) o; if (t.c() == 4) before.put(t.a(), (String) t.b()); }
          m.invoke(f, probeText);
          for (Object o : f.z().c()) {
            tf t = (tf) o;
            if (t.c() != 4 || !probeText.equals(t.b())) continue;
            String s0 = String.valueOf(size(15, new fz((sv) f)));
            System.out.println("{\"case\":\"string\",\"id\":\"" + id + "\",\"method\":\"" + m.getDeclaringClass().getSimpleName() + "." + m.getName() + "\",\"index\":" + t.a() + ",\"s0f\":" + s0 + ",\"valueBytes\":" + probeText.length() + "}");
          }
        } catch (Throwable x) { }
      }
      // b91: a changed entry on its own (the S1C of a later tick): index 6 float (health), index 12 int (age) updated through te.b(int, Object); then the same value again
      try {
        idCounter.setInt(null, 1);
        sa f = InterchangeSpawnProbe.make(id, 1);
        te dw = f.z();
        dw.b();
        StringBuilder ch = new StringBuilder();
        for (int[] k : new int[][] { { 6, 3 }, { 12, 2 } }) {
          boolean has = false;
          for (Object o : dw.c()) if (((tf) o).a() == k[0]) has = true;
          if (!has) continue;
          Object v1 = k[1] == 3 ? (Object) Float.valueOf(3.5f) : (Object) Integer.valueOf(-77);
          dw.b(k[0], v1);
          boolean first = dw.a();
          int sz = size(28, new hw(7, dw, false)); // consumes the change list
          dw.b(k[0], v1);
          boolean again = dw.a();
          ch.append(ch.length() > 0 ? "," : "").append("{\"index\":" + k[0] + ",\"changed\":" + first + ",\"s1c\":" + sz + ",\"changedAgain\":" + again + "}");
        }
        System.out.println("{\"case\":\"change\",\"id\":\"" + id + "\",\"changes\":[" + ch + "]}");
      } catch (Throwable x) { }
    }
  }
}
