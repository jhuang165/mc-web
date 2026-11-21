import io.netty.buffer.Unpooled;
import java.lang.reflect.Field;
import java.util.*;

// Batch 90 console90 evidence on the unchanged 1.7.10 classes (no class is patched or shipped), MobPackets89Probe's world double.
//  spawn   every registered living entity class made as in a fresh world: the S0F (fz(sv), the packet EntityTrackerEntry.func_151260_c builds) written after its id VarInt,
//          exactly as the encoder fa counts it, and the watched entries (DataWatcher te.c(): index, type) that S0F and the S1C of a first watch carry.
//  sizes   the DataWatcher value sizes by type id (0 byte, 1 short, 2 int, 3 float, 4 string, 5 ItemStack, 6 three ints) as te.a(List, et) writes them, from objects written one at a time.
public class Console90Probe {
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

    List<String> ids = new ArrayList<>();
    Field cf = sg.class.getDeclaredField("c");
    cf.setAccessible(true);
    for (Object k : ((Map) cf.get(null)).keySet()) ids.add((String) k);
    Collections.sort(ids);
    for (String id : ids) {
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
    }
  }
}
