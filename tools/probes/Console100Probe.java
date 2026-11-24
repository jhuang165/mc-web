import io.netty.buffer.Unpooled;
import java.lang.reflect.Field;
import java.util.*;

// Batch 100 console100 (copy of Console97Probe's world double) evidence on the unchanged 1.7.10 classes (no class is patched or shipped).
//  mob  for a zombie, horse, villager and wolf made as in a fresh world: the S0F, the whole-watcher S1C and the whole watched-attribute S20 a viewer gets on entering the tracked set,
//       the dirty set the constructor left (what the first gated pass sends), then the packets of later changes as EntityTrackerEntry.b() writes them (S1C of the changed entries only,
//       S20 of the dirty set), and an S04 of a held sword. `bytes` = id VarInt + payload as the encoder fa counts it.
public class Console100Probe {
  public static class RealPlayer extends yz {
    RealPlayer(ahb w, com.mojang.authlib.GameProfile g) { super(w, g); }
    public void a(fj message) {}
    public boolean a(int level, String command) { return false; }
    public r f_() { return null; }
  }
  static int size(int id, ft packet) throws Exception {
    et buf = new et(Unpooled.buffer());
    buf.b(id);
    packet.b(buf);
    return buf.readableBytes();
  }
  static tq map(sa e) { return (tq) ((sv) e).bc(); }
  static String names(Collection<?> set) {
    List<String> n = new ArrayList<>();
    for (Object o : set) n.add(((tn) o).a().a());
    Collections.sort(n);
    StringBuilder b = new StringBuilder("[");
    for (String s : n) b.append(b.length() > 1 ? "," : "").append('"').append(s).append('"');
    return b.append(']').toString();
  }
  // the S20 `il(id, tq.b())` of the dirty set, then the set cleared (func_111190_b); -1 when it is empty (nothing is sent)
  static String dirty(sa e) throws Exception {
    Collection<?> set = map(e).b();
    String r = set.isEmpty() ? "{\"bytes\":-1,\"names\":[]}" : "{\"bytes\":" + size(32, new il(e.y(), new ArrayList<Object>(set))) + ",\"names\":" + names(set) + "}";
    set.clear();
    return r;
  }
  static void out(String s) { System.out.println(s); }
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

    Field idCounter = sa.class.getDeclaredField("b");
    idCounter.setAccessible(true);
    for (int eid0 : new int[] { 1, 200, 70000 }) {
      idCounter.setInt(null, eid0);
      yz p = DifficultyProbe.player(u, DifficultyProbe.Player.class);
      MobMoveProbe.set(p, "bm", new yx(p));
      MobMoveProbe.set(p, "i", new com.mojang.authlib.GameProfile(UUID.fromString("11111111-2222-3333-4444-555555555555"), "Steve"));
      EquipmentProbe.place(p, 3.5, 64.0, 7.5);
      MobMoveProbe.field(sa.class, "c").setInt(p, eid0);
      int eid = p.y();
      te dw = p.z();
      String s0c = String.valueOf(size(12, new gb(p)));
      int s0cProps = ((com.mojang.authlib.GameProfile) MobMoveProbe.field(yz.class, "i").get(p)).getProperties().size();
      String whole = String.valueOf(size(28, new hw(eid, dw, true)));
      String s20whole = String.valueOf(size(32, new il(eid, ((tq) p.bc()).c())));
      String first = dirty(p); // what DifficultyProbe's setup left in the dirty set (the first gated pass)
      dw.b();
      sa boat = InterchangeSpawnProbe.make("Boat", 1);
      String s1bRide = String.valueOf(size(27, new hx(0, p, boat)));
      String s1bDismount = String.valueOf(size(27, new hx(0, p, null)));
      String s0a = String.valueOf(size(10, new hp(p, 4, 64, 7)));
      String anim = "[" + size(11, new gc(p, 0)) + "," + size(11, new gc(p, 2)) + "," + size(11, new gc(p, 4)) + "," + size(11, new gc(p, 5)) + "]";
      p.v = 0.1; p.w = 0.42; p.x = -0.1; // motion (sa.v/w/x), as after a knockback
      String s12 = String.valueOf(size(18, new hy(p)));
      p.v = 9.0; // clamped to 3.9
      String s12big = String.valueOf(size(18, new hy(p)));
      p.c(true); // sprint on: movementSpeed gets the sprint modifier
      String sprint = dirty(p);
      p.c(false);
      String sprintOff = dirty(p);
      out("{\"case\":\"player\",\"entityId\":" + eid + ",\"s0c\":" + s0c + ",\"profileProperties\":" + s0cProps + ",\"s1cWhole\":" + whole + ",\"s20whole\":" + s20whole + ",\"first\":" + first
        + ",\"s1bRide\":" + s1bRide + ",\"s1bDismount\":" + s1bDismount + ",\"s0a\":" + s0a + ",\"s0b\":" + anim + ",\"s12\":" + s12 + ",\"s12Clamped\":" + s12big
        + ",\"sprintOn\":" + sprint + ",\"sprintOff\":" + sprintOff + "}");
    }
    // the real EntityPlayer constructor (yz(world, profile)): the dirty attribute set it leaves, which the first gated pass of a tracker entry sends
    try {
      RealPlayer r = new RealPlayer(w, new com.mojang.authlib.GameProfile(UUID.fromString("11111111-2222-3333-4444-555555555555"), "Steve"));
      String names0 = names(map(r).c());
      String dirty0 = dirty(r);
      out("{\"case\":\"real\",\"watched\":" + names0 + ",\"first\":" + dirty0 + ",\"s0c\":" + size(12, new gb(r)) + ",\"s1cWhole\":" + size(28, new hw(r.y(), r.z(), true)) + "}");
    } catch (Throwable t) {
      Throwable c = t; while (c.getCause() != null) c = c.getCause();
      out("{\"case\":\"real\",\"error\":\"" + c.toString().replace("\"", "'") + "\"}");
    }
  }
}
