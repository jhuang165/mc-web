import java.util.*;

// Minecraft Java 1.7.10 single-player sound sweep, part 2 (batch 76 spsounds76), from the unchanged original classes on the SoundSweepProbe world double.
//  - bucket: ItemBucket.tryPlaceContainedLiquid (abo.a(ahb,III)) for the water and lava buckets, Overworld and Nether (WorldProvider.isHellWorld), on air, stone and a plant.
//  - throw: onItemRightClick (a(add,ahb,yz)) of the snowball, egg, ender pearl, bottle o' enchanting, splash potion and eye of ender, on a remote and a non-remote world;
//    records World.playSoundAtEntity (the "ent" lines) and the spawn attempts.
//  - use: onItemUse of the fire charge (non-remote world), the hoes, bone meal (aux 2005 only), lily pad item (onItemUse) on grass, sapling and wheat.
// Records (JSON lines): kind bucket / throw / use. No classes patched.
public class SpSounds76Probe {
  static String q(String s) { return SoundSweepProbe.q(s); }

  static SoundSweepProbe.PW world(boolean remote, boolean hell, int[][] setup) throws Exception {
    SoundSweepProbe.PW w = SoundSweepProbe.world(setup);
    MobMoveProbe.field(ahb.class, "E").setBoolean(w, remote);
    Object provider = MobMoveProbe.field(ahb.class, "t").get(w);
    MobMoveProbe.field(aqq.class, "f").setBoolean(provider, hell);
    return w;
  }

  static String all(SoundSweepProbe.PW w) {
    List<String> l = new ArrayList<>();
    for (String e : w.log) if (e.startsWith("sound ") || e.startsWith("ent ") || e.startsWith("aux ")) l.add(q(e));
    return "[" + String.join(",", l) + "]";
  }

  static void buckets() throws Exception {
    int[][][] setups = {{}, {{8, 64, 8, 1, 0}}, {{8, 64, 8, 31, 1}}};
    String[] names = {"air", "stone", "tall-grass"};
    for (int item : new int[] {326, 327}) for (int remote = 0; remote < 2; remote++) for (int hell = 0; hell < 2; hell++) for (int i = 0; i < setups.length; i++) {
      SoundSweepProbe.PW w = world(remote == 1, hell == 1, SoundSweepProbe.s(setups[i].length == 0 ? new int[0][] : setups[i]));
      String err = "null", res = "null";
      try { res = String.valueOf(((abo) adb.d(item)).a(w, 8, 64, 8)); } catch (Throwable t) { err = q(t.toString()); }
      System.out.println("{\"kind\":\"bucket\",\"item\":" + item + ",\"remote\":" + (remote == 1) + ",\"nether\":" + (hell == 1) + ",\"cell\":" + q(names[i]) + ",\"result\":" + res + ",\"error\":" + err + ",\"sounds\":" + all(w) + "}");
    }
  }

  static void throwsRun() throws Exception {
    int[][] items = {{332, 0}, {344, 0}, {368, 0}, {384, 0}, {373, 16421}, {381, 0}};
    for (int[] it : items) for (int remote = 0; remote < 2; remote++) {
      SoundSweepProbe.PW w = world(remote == 1, false, SoundSweepProbe.s());
      MobMoveProbe.field(sa.class, "o").set(DoorPaneProbe.player, w);
      String err = "null";
      add st = new add(adb.d(it[0]), 3, it[1]);
      try { adb.d(it[0]).a(st, w, (yz) DoorPaneProbe.player); } catch (Throwable t) { err = q(t.toString()); }
      System.out.println("{\"kind\":\"throw\",\"item\":" + it[0] + ",\"damage\":" + it[1] + ",\"remote\":" + (remote == 1) + ",\"count\":" + st.b + ",\"error\":" + err + ",\"sounds\":" + all(w) + "}");
    }
  }

  static void uses() throws Exception {
    Object[][] cases = {
      {385, 0, "stone-floor", SoundSweepProbe.s(), 1}, {385, 0, "stone-wall", SoundSweepProbe.s(SoundSweepProbe.c(8, 64, 8, 1, 0)), 3},
      {290, 0, "grass", SoundSweepProbe.s(SoundSweepProbe.c(8, 63, 8, 2, 0)), 1}, {293, 0, "dirt", SoundSweepProbe.s(SoundSweepProbe.c(8, 63, 8, 3, 0)), 1},
      {290, 0, "stone", SoundSweepProbe.s(), 1}, {290, 0, "sand", SoundSweepProbe.s(SoundSweepProbe.c(8, 63, 8, 12, 0)), 1},
      {351, 15, "sapling", SoundSweepProbe.s(SoundSweepProbe.c(8, 63, 8, 2, 0), SoundSweepProbe.c(8, 64, 8, 6, 0)), 1},
      {351, 15, "wheat", SoundSweepProbe.s(SoundSweepProbe.c(8, 63, 8, 60, 7), SoundSweepProbe.c(8, 64, 8, 59, 2)), 1},
      {351, 15, "grass", SoundSweepProbe.s(SoundSweepProbe.c(8, 63, 8, 2, 0)), 1}, {351, 15, "stone", SoundSweepProbe.s(), 1},
      {111, 0, "grass", SoundSweepProbe.s(SoundSweepProbe.c(8, 63, 8, 2, 0)), 1},
      {359, 0, "stone", SoundSweepProbe.s(), 1}, {259, 0, "stone-floor", SoundSweepProbe.s(), 1},
    };
    for (Object[] c : cases) for (int remote = 0; remote < 2; remote++) {
      SoundSweepProbe.PW w = world(remote == 1, false, (int[][]) c[3]);
      MobMoveProbe.field(sa.class, "o").set(DoorPaneProbe.player, w);
      MobMoveProbe.field(sa.class, "y").setFloat(DoorPaneProbe.player, 0f);
      String err = "null", res = "null";
      add st = new add(adb.d((Integer) c[0]), 3, (Integer) c[1]);
      try { res = String.valueOf(adb.d((Integer) c[0]).a(st, (yz) DoorPaneProbe.player, w, 8, (Integer) c[4] == 1 ? 63 : 64, 8, (Integer) c[4], 0.5f, 0.5f, 0.5f)); } catch (Throwable t) { err = q(t.toString()); }
      System.out.println("{\"kind\":\"use\",\"item\":" + c[0] + ",\"damage\":" + c[1] + ",\"scenario\":" + q((String) c[2]) + ",\"remote\":" + (remote == 1) + ",\"result\":" + res + ",\"count\":" + st.b + ",\"error\":" + err + ",\"sounds\":" + all(w) + "}");
    }
  }

  public static void main(String[] args) throws Exception {
    aji.p(); adb.l(); alb.e();
    PlantProbe.unsafe = MobMoveProbe.unsafe();
    DoorPaneProbe.makePlayer();
    buckets();
    throwsRun();
    uses();
  }
}
