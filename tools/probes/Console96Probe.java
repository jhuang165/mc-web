import io.netty.buffer.Unpooled;
import java.lang.reflect.Field;
import java.util.*;

// Batch 96 console96 (copy of Console93Probe's world double) evidence on the unchanged 1.7.10 classes (no class is patched or shipped), MobPackets89Probe's world double.
//  spawn   every registered living entity class made as in a fresh world: the S0F (fz(sv), the packet EntityTrackerEntry.func_151260_c builds) written after its id VarInt,
//          exactly as the encoder fa counts it, and the watched entries (DataWatcher te.c(): index, type) that S0F and the S1C of a first watch carry.
//  sizes   the DataWatcher value sizes by type id (0 byte, 1 short, 2 int, 3 float, 4 string, 5 ItemStack, 6 three ints) as te.a(List, et) writes them, from objects written one at a time.
public class Console96Probe {
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

    // b96: the packets EntityTrackerEntry.b(mw) sends to a viewer when a player enters his tracked set, on real classes. DifficultyProbe.player builds an EntityPlayer the way
    // the other probes do (real DataWatcher entries from EntityPlayer.entityInit, real attribute map from applyEntityAttributes); the profile and inventory are set by reflection.
    Field idCounter = sa.class.getDeclaredField("b");
    idCounter.setAccessible(true);
    idCounter.setInt(null, 1);
    for (String name : new String[] { "A", "Steve", "Notch_The_Great", "Sixteen_Chars_16" }) {
      for (int held : new int[] { 0, 267 }) {
        yz p = DifficultyProbe.player(u, DifficultyProbe.Player.class);
        MobMoveProbe.set(p, "bm", new yx(p));
        MobMoveProbe.set(p, "i", new com.mojang.authlib.GameProfile(UUID.fromString("11111111-2222-3333-4444-555555555555"), name));
        EquipmentProbe.place(p, 3.5, 64.0, 7.5);
        p.y = 123.4f; p.z = -17.25f;
        if (held != 0) p.bm.a[0] = new add(adb.d(held), 1, 0);
        int s0c = size(12, new gb(p));
        System.out.println("{\"case\":\"s0c\",\"name\":\"" + name + "\",\"held\":" + held + ",\"entityId\":" + p.y() + ",\"bytes\":" + s0c + "}");
        if (name.equals("Steve")) {
          int wh = size(28, new hw(p.y(), p.z(), true));
          int s20 = size(32, new il(p.y(), ((tq) p.bc()).c()));
          int count0 = ((tq) p.bc()).c().size();
          p.c(true);
          int s20sprint = size(32, new il(p.y(), ((tq) p.bc()).c()));
          int s04 = size(4, new hz(p.y(), 0, p.bm.a[0] == null ? new add(adb.d(267), 1, 0) : p.bm.a[0]));
          int s1d = size(29, new in(p.y(), new rw(14, 100000, 0)));
          int s1b = size(27, new hx(0, p, p));
          System.out.println("{\"case\":\"follow\",\"s1cWhole\":" + wh + ",\"s20\":" + s20 + ",\"s20Sprint\":" + s20sprint + ",\"attributes\":" + count0 + ",\"s04Sword\":" + s04 + ",\"s1d\":" + s1d + ",\"s1bAttach\":" + s1b + "}");
        }
        // with a texture property (online mode): name "textures", value 400 chars, signature 684 chars
        if (name.equals("Steve") && held == 0) {
          com.mojang.authlib.GameProfile gp = new com.mojang.authlib.GameProfile(UUID.fromString("11111111-2222-3333-4444-555555555555"), name);
          gp.getProperties().put("textures", new com.mojang.authlib.properties.Property("textures", "v".repeat(400), "s".repeat(684)));
          MobMoveProbe.set(p, "i", gp);
          System.out.println("{\"case\":\"s0cProp\",\"valueLen\":400,\"signatureLen\":684,\"bytes\":" + size(12, new gb(p)) + "}");
        }
      }
    }
  }
}
