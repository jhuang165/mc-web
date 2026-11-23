import io.netty.buffer.Unpooled;
import java.lang.reflect.Field;
import java.util.*;

// Batch 97 console97 (copy of Console93Probe's world double) evidence on the unchanged 1.7.10 classes (no class is patched or shipped), MobPackets89Probe's world double.
//  spawn   every registered living entity class made as in a fresh world: the S0F (fz(sv), the packet EntityTrackerEntry.func_151260_c builds) written after its id VarInt,
//          exactly as the encoder fa counts it, and the watched entries (DataWatcher te.c(): index, type) that S0F and the S1C of a first watch carry.
//  sizes   the DataWatcher value sizes by type id (0 byte, 1 short, 2 int, 3 float, 4 string, 5 ItemStack, 6 three ints) as te.a(List, et) writes them, from objects written one at a time.
public class Console97Probe {
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

    // b97: what a changed player watcher and changed attributes send (EntityTrackerEntry.b(): S1C of the changed entries, S20 of the dirty attributes), and the armour S04s.
    Field idCounter = sa.class.getDeclaredField("b");
    idCounter.setAccessible(true);
    idCounter.setInt(null, 1);
    yz p = DifficultyProbe.player(u, DifficultyProbe.Player.class);
    MobMoveProbe.set(p, "bm", new yx(p));
    MobMoveProbe.set(p, "i", new com.mojang.authlib.GameProfile(UUID.fromString("11111111-2222-3333-4444-555555555555"), "Steve"));
    EquipmentProbe.place(p, 3.5, 64.0, 7.5);
    te dw = p.z();
    int id = p.y();
    // every entry of the whole watcher: index, type, bytes (header + value)
    for (Object o : dw.c()) {
      tf t = (tf) o;
      System.out.println("{\"case\":\"entry\",\"index\":" + t.a() + ",\"type\":" + t.c() + ",\"bytes\":" + entry(t) + "}");
    }
    System.out.println("{\"case\":\"whole\",\"bytes\":" + size(28, new hw(id, dw, true)) + "}");
    dw.b(); // clear the changed flags
    // one changed entry at a time: S1C(id, dw, false)
    Object[][] changes = { { 0, (byte) 2 }, { 1, (short) 299 }, { 6, 5.0f }, { 7, 8171462 }, { 8, (byte) 1 }, { 9, (byte) 3 }, { 16, (byte) 126 }, { 17, 4.0f }, { 18, 7 } };
    for (Object[] c : changes) {
      dw.b((Integer) c[0], c[1]);
      System.out.println("{\"case\":\"s1c\",\"index\":" + c[0] + ",\"bytes\":" + size(28, new hw(id, dw, false)) + "}");
    }
    // three changed at once (flag, health, air)
    dw.b(0, (byte) 3); dw.b(6, 4.0f); dw.b(1, (short) 298);
    System.out.println("{\"case\":\"s1cMany\",\"indexes\":[0,1,6],\"bytes\":" + size(28, new hw(id, dw, false)) + "}");
    // a changed value written back unchanged marks nothing
    dw.b(0, (byte) 3);
    System.out.println("{\"case\":\"unchanged\",\"hasChanges\":" + dw.a() + "}");
    // S20 of single dirty attributes, with modifiers
    tq attrs = (tq) p.bc();
    for (String name : new String[] { "generic.maxHealth", "generic.movementSpeed" }) {
      for (int mods = 0; mods <= 3; mods++) {
        ti a = attrs.a(name);
        for (java.util.Iterator<?> it = new ArrayList<Object>(a.c()).iterator(); it.hasNext();) a.b((tj) it.next());
        for (int i = 0; i < mods; i++) a.a(new tj(UUID.nameUUIDFromBytes(new byte[] { (byte) i }), "m" + i, 0.1 * (i + 1), 2));
        System.out.println("{\"case\":\"s20\",\"attribute\":\"" + name + "\",\"modifiers\":" + mods + ",\"bytes\":" + size(32, new il(id, new ArrayList<Object>(Collections.singletonList(a)))) + "}");
      }
    }
    // armour S04: an enchanted and a plain piece, slots 1 to 4
    add plain = new add(adb.d(306), 1, 0);
    add ench = new add(adb.d(307), 1, 0);
    ench.a(aft.d, 4); // Protection IV (aft.d)
    System.out.println("{\"case\":\"s04\",\"item\":\"plain iron helmet\",\"slot\":4,\"bytes\":" + size(4, new hz(id, 4, plain)) + "}");
    System.out.println("{\"case\":\"s04\",\"item\":\"Protection IV chestplate\",\"slot\":3,\"bytes\":" + size(4, new hz(id, 3, ench)) + "}");
    // S1E remove effect
    System.out.println("{\"case\":\"s1e\",\"bytes\":" + size(30, new ip(p, 1)) + "}");
    System.out.println("{\"case\":\"s1d\",\"id\":1,\"bytes\":" + size(29, new in(id, new rw(1, 100, 0))) + "}");
  }
}
