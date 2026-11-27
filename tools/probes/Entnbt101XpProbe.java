import java.util.*;
// Batch 101 entnbt101: EntityPlayer.addExperience (yz.v) with an Infinity XpP, through the real classes: [start level, XpTotal, written XpLevel, XpP, XpTotal, Score] after v(10).
public class Entnbt101XpProbe {
  public static void main(String[] argv) throws Throwable {
    aji.p(); adb.l();
    LevelDatProbe.u = MobMoveProbe.unsafe();
    LevelDatProbe.world = (LevelDatProbe.W) LevelDatProbe.u.allocateInstance(LevelDatProbe.W.class);
    { java.lang.reflect.Field jf = net.minecraft.server.MinecraftServer.class.getDeclaredField("j"); jf.setAccessible(true);
      LevelDatProbe.u.putObject(LevelDatProbe.u.staticFieldBase(jf), LevelDatProbe.u.staticFieldOffset(jf), LevelDatProbe.u.allocateInstance(ServerPlayerProbe.Server.class)); }
    MobMoveProbe.set(LevelDatProbe.world, "C", new qi()); MobMoveProbe.set(LevelDatProbe.world, "s", new Random(2)); MobMoveProbe.set(LevelDatProbe.world, "t", LevelDatProbe.u.allocateInstance(aqq.class));
    for (java.lang.reflect.Field f : ahb.class.getDeclaredFields())
      if (f.getType() == java.util.List.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(LevelDatProbe.world, new ArrayList()); }
    { java.lang.invoke.MethodHandles.Lookup l = java.lang.invoke.MethodHandles.privateLookupIn(mw.class, java.lang.invoke.MethodHandles.lookup());
      Entnbt96Probe.tick = l.findSpecial(sv.class, "C", java.lang.invoke.MethodType.methodType(void.class), mw.class); }
    int[][] starts = {{3, 77}, {306783399, 77}, {306783400, 77}, {306783401, 77}, {-5, 77}, {-2, 77}, {-1, 77}, {0, 77}, {2147483646, 77}, {2147483647, 77}, {400000000, 77}, {700000000, 77}};
    for (int[] s : starts) {
      try {
        ServerPlayerProbe.PM p = ServerPlayerProbe.make(LevelDatProbe.world, "xp" + s[0]);
        dh t = LevelDatProbe.richPlayer();
        t.a("XpP", Float.POSITIVE_INFINITY); t.a("XpLevel", s[0]); t.a("XpTotal", s[1]);
        p.f(t);
        p.v(10);
        dh out = new dh(); p.e(out);
        System.out.println("{\"start\":" + s[0] + ",\"total\":" + s[1] + ",\"level\":" + out.f("XpLevel") + ",\"xpp\":\"" + out.h("XpP") + "\",\"xptotal\":" + out.f("XpTotal") + ",\"score\":" + out.f("Score") + "}");
      } catch (Throwable x) { Throwable c = x; while (c.getCause() != null) c = c.getCause(); System.out.println("{\"start\":" + s[0] + ",\"error\":\"" + c + "\"}"); }
    }
  }
}
