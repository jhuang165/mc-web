import io.netty.buffer.Unpooled;
import java.lang.reflect.Field;
import java.util.*;

// Batch 93 console93 (extends Console92Probe) evidence on the unchanged 1.7.10 classes (no class is patched or shipped), MobPackets89Probe's world double.
//  spawn   every registered living entity class made as in a fresh world: the S0F (fz(sv), the packet EntityTrackerEntry.func_151260_c builds) written after its id VarInt,
//          exactly as the encoder fa counts it, and the watched entries (DataWatcher te.c(): index, type) that S0F and the S1C of a first watch carry.
//  sizes   the DataWatcher value sizes by type id (0 byte, 1 short, 2 int, 3 float, 4 string, 5 ItemStack, 6 three ints) as te.a(List, et) writes them, from objects written one at a time.
public class Console93Probe {
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

    Field idCounter = sa.class.getDeclaredField("b"); // Entity.nextEntityID: keep the entity id a one-byte VarInt
    idCounter.setAccessible(true);
    // b93: the command block minecart's watcher strings. The real calls: CommandBlockLogic.setCommand (agp.a(String)), setLastOutput (agp.b(fj)), then xo.e() (watchers 23 and 24).
    String[] commands = { "", "say hi", "0123456789", new String(new char[127]).replace('\0', 'c'), new String(new char[128]).replace('\0', 'c'), "\u00e9\u20ac" };
    String[] outputs = { null, "[12:00:00] Hello", new String(new char[100]).replace('\0', 'o') };
    for (String cmd : commands) for (String out : outputs) {
      idCounter.setInt(null, 1);
      sa e = InterchangeSpawnProbe.make("MinecartCommandBlock", 1);
      te dw = e.z();
      agp logic = ((xn) e).e();
      logic.a(cmd);
      if (out != null) logic.b(new fq(out));
      dw.b();
      logic.e();
      String w24 = (String) dw.e(24) == null ? "" : dw.e(24);
      System.out.println("{\"case\":\"cmdcart\",\"commandChars\":" + cmd.length() + ",\"commandUtf8\":" + cmd.getBytes(java.nio.charset.StandardCharsets.UTF_8).length + ",\"watch23\":" + js(dw.e(23)) + ",\"watch24\":" + js(w24)
        + ",\"watch24Utf8\":" + w24.getBytes(java.nio.charset.StandardCharsets.UTF_8).length + ",\"s1cWhole\":" + size(28, new hw(7, dw, true)) + "}");
    }
    // the entity as created: the two empty strings, and a changed 23 / 24 on their own (the S1C a later command change sends)
    {
      idCounter.setInt(null, 1);
      sa e = InterchangeSpawnProbe.make("MinecartCommandBlock", 1);
      te dw = e.z();
      dw.b(22, Byte.valueOf((byte) 1)); // a fresh cart's watcher reports no change, so its entries keep the new-entry flag until one change makes te.b() walk them: make one, then drain the list
      dw.b();
      dw.b(23, "say hi");
      int only23 = size(28, new hw(7, dw, false));
      dw.b(24, "null");
      int both = size(28, new hw(7, dw, false));
      idCounter.setInt(null, 1);
      sa g = InterchangeSpawnProbe.make("MinecartCommandBlock", 1);
      te dg = g.z();
      dg.b(22, Byte.valueOf((byte) 1));
      dg.b();
      dg.b(24, "null");
      int only24 = size(28, new hw(7, dg, false));
      System.out.println("{\"case\":\"cmdchange\",\"only23\":" + only23 + ",\"only24\":" + only24 + ",\"fresh\":" + size(28, new hw(7, ((sa) InterchangeSpawnProbe.make("MinecartCommandBlock", 1)).z(), true)) + "}");
    }
    // b93: S13PacketDestroyEntities (hq): the id count byte and the ints
    for (int n : new int[] { 0, 1, 2, 5, 127, 128 }) {
      int[] ids = new int[n];
      System.out.println("{\"case\":\"s13\",\"ids\":" + n + ",\"bytes\":" + size(19, new hq(ids)) + "}");
    }
  }
  static String js(Object o) { return o == null ? "null" : "\"" + String.valueOf(o).replace("\\", "\\\\").replace("\"", "\\\"") + "\""; }
}
