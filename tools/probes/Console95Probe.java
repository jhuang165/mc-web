import io.netty.buffer.Unpooled;
import java.lang.reflect.Field;
import java.util.*;

// Batch 95 console95 (copy of Console93Probe's world double) evidence on the unchanged 1.7.10 classes (no class is patched or shipped), MobPackets89Probe's world double.
//  spawn   every registered living entity class made as in a fresh world: the S0F (fz(sv), the packet EntityTrackerEntry.func_151260_c builds) written after its id VarInt,
//          exactly as the encoder fa counts it, and the watched entries (DataWatcher te.c(): index, type) that S0F and the S1C of a first watch carry.
//  sizes   the DataWatcher value sizes by type id (0 byte, 1 short, 2 int, 3 float, 4 string, 5 ItemStack, 6 three ints) as te.a(List, et) writes them, from objects written one at a time.
public class Console95Probe {
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

    // b95: EntityPlayerMP.func_152339_d (mw.d) on the real class. A non-player entity id is added to destroyedItemsNetCache (bN) and no packet is sent; a player entity
    // sends S13 (hq, one id) through its NetHandlerPlayServer (nh.a) at once and adds nothing to bN. The connection is a real nh over a stand-in ej (stub95/ej.java) that records what
    // ej.a(ft, listeners) is handed.
    Field idCounter = sa.class.getDeclaredField("b");
    idCounter.setAccessible(true);
    idCounter.setInt(null, 1);
    sa pig = InterchangeSpawnProbe.make("Pig", 1);
    mw viewer = (mw) u.allocateInstance(mw.class), other = (mw) u.allocateInstance(mw.class);
    nh net = (nh) u.allocateInstance(nh.class);
    ej manager = new ej();
    java.util.Queue<ft> pending = manager.sent;
    MobMoveProbe.set(net, "a", manager);
    MobMoveProbe.set(net, "b", viewer);
    MobMoveProbe.set(viewer, "a", net);
    MobMoveProbe.set(viewer, "bN", new ArrayList<Object>());
    MobMoveProbe.field(sa.class, "c").setInt(other, 77);
    for (Object[] c : new Object[][] { { "pig", pig }, { "player", other } }) {
      viewer.d((sa) c[1]);
      List<?> bn = (List<?>) MobMoveProbe.field(mw.class, "bN").get(viewer);
      StringBuilder sent = new StringBuilder();
      for (Object p : pending) {
        ft pk = (ft) p;
        sent.append(pk.getClass().getName()).append(":").append(size(19, pk)).append(" ");
      }
      System.out.println("{\"case\":\"removed\",\"entity\":\"" + c[0] + "\",\"queued\":" + bn.size() + ",\"packets\":" + pending.size() + ",\"sent\":\"" + sent.toString().trim() + "\"}");
      bn.clear(); pending.clear();
    }
    // S13 sizes of one id (a player entity) and of the queue's drain
    System.out.println("{\"case\":\"s13\",\"ids\":1,\"bytes\":" + size(19, new hq(new int[] { 77 })) + "}");
  }
}
