import java.util.*;

// Batch 78 spexec78: EntityCow.interact (wh.a) and EntityMooshroom.interact (wm.a) on a server and a client world (PlayerControllerMP.interactWithEntitySendPacket
// also runs interactWith on the client copy), built on the MooshroomGolemProbe doubles.
public class SpExec78Milk {
  static void interact(String kind, String mob, adb item, int count, boolean full, boolean creative, int age, int damage, boolean remote) throws Exception {
    MooshroomGolemProbe.reset();
    MobMoveProbe.field(ahb.class, "E").setBoolean(WitchProbe.w, remote);
    WitchProbe.Gamer p = MooshroomGolemProbe.player(creative);
    MooshroomGolemProbe.giveHeld(p, new add(item, count, damage));
    if (full) MooshroomGolemProbe.fill(p);
    sw e = mob.equals("mooshroom") ? MooshroomGolemProbe.mooshroom(3) : MooshroomGolemProbe.cow(3);
    ((rx) e).a(age);
    e.g(10f);
    ChickenProbe.World.spawned.clear(); ChickenProbe.World.sounds.clear();
    boolean r = ((rx) e).a((yz) p);
    System.out.println("{\"kind\":\"milk\",\"case\":\"" + kind + "\",\"mob\":" + SpExec78Probe.q(mob) + ",\"remote\":" + remote + ",\"count\":" + count + ",\"full\":" + full + ",\"creative\":" + creative + ",\"age\":" + age + ",\"damage\":" + damage
      + ",\"result\":" + r + ",\"dead\":" + e.K + ",\"held\":" + MooshroomGolemProbe.stack(p.bm.a[0]) + ",\"inventory\":" + MooshroomGolemProbe.inventory(p) + ",\"spawned\":" + MooshroomGolemProbe.entities()
      + ",\"particles\":" + MooshroomGolemProbe.particles() + ",\"sounds\":" + MooshroomGolemProbe.strings(ChickenProbe.World.sounds) + ",\"mobY\":" + e.t + ",\"mobHeight\":" + e.N + "}");
    MobMoveProbe.field(ahb.class, "E").setBoolean(WitchProbe.w, false);
  }
  static void setup() throws Exception {
    WitchProbe.u = MobMoveProbe.unsafe();
    sun.misc.Unsafe u = WitchProbe.u;
    WitchProbe.w = (WitchProbe.WW) u.allocateInstance(MooshroomGolemProbe.GW.class);
    WitchProbe.WW w = WitchProbe.w;
    DifficultyProbe.w = w;
    MobMoveProbe.set(w, "s", new Random(2));
    MobMoveProbe.set(w, "C", new qi());
    aqq provider = new aqq();
    java.lang.reflect.Method gen = aqo.class.getDeclaredMethod("a"); gen.setAccessible(true); gen.invoke(provider);
    MobMoveProbe.set(w, "t", provider);
    for (java.lang.reflect.Field f : ahb.class.getDeclaredFields())
      if (f.getType() == List.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(w, new ArrayList()); }
    ays info = (ays) u.allocateInstance(ays.class);
    MobMoveProbe.field(ays.class, "g").setLong(info, 1);
    MobMoveProbe.field(ays.class, "x").set(info, new agy());
    MobMoveProbe.field(ahb.class, "x").set(w, info);
    Calendar date = Calendar.getInstance(); date.clear(); date.set(2014, Calendar.JUNE, 1);
    MobMoveProbe.field(ahb.class, "J").set(w, date);
    MobMoveProbe.field(ahb.class, "r").set(w, rd.values()[2]);
    for (java.lang.reflect.Field f : ahb.class.getDeclaredFields()) if (f.getType() == bac.class) { f.setAccessible(true); f.set(w, new bac()); }
    DifficultyProbe.World.chunk = (apx) u.allocateInstance(apx.class);
    DifficultyProbe.World.light = 15;
  }
  static void run() throws Exception {
    setup();
    for (int remote = 0; remote < 2; remote++) for (String mob : new String[] {"mooshroom", "cow"}) {
      boolean r = remote == 1;
      interact("shear", mob, ade.aZ, 1, false, false, 0, 0, r);
      interact("shear", mob, ade.aZ, 1, false, false, 0, 7, r);
      interact("shear", mob, ade.aZ, 1, false, true, 0, 0, r);
      interact("shear", mob, ade.aZ, 1, false, false, -6000, 0, r);
      interact("bowl", mob, ade.z, 1, false, false, 0, 0, r);
      interact("bowl", mob, ade.z, 2, false, false, 0, 0, r);
      interact("bowl", mob, ade.z, 2, true, false, 0, 0, r);
      interact("bowl", mob, ade.z, 2, false, true, 0, 0, r);
      interact("bucket", mob, ade.ar, 1, false, false, 0, 0, r);
      interact("bucket", mob, ade.ar, 3, false, false, 0, 0, r);
      interact("bucket", mob, ade.ar, 3, true, false, 0, 0, r);
      interact("bucket", mob, ade.ar, 1, false, true, 0, 0, r);
      interact("bucket", mob, ade.ar, 1, false, false, -6000, 0, r);
      interact("milk-bucket", mob, ade.aB, 1, false, false, 0, 0, r);
    }
  }
}
