import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.util.*;

// Batch 43 trackermounts. Runs the unchanged EntityTrackerEntry (my) for a mount and its rider (and a leashed mob) and executes a
// real client copy of each on a client world double (ahb.E true): the S1B attach packet (hx) arrives through the replicated
// NetHandlerPlayClient.handleEntityAttach (bytecode-read: the rider and vehicle are looked up by id, type 0 calls rider.mountEntity(vehicle),
// type 1 on an EntityLiving calls setLeashedToEntity(vehicle, false) or clearLeashed(false, false)), then the client world's update order
// of World.updateEntityWithOptionalForce (mount.onUpdate, then the rider through updateRidden, which ends with the mount's
// updateRiderPosition). Everything else, including Entity.updateRidden, Entity.updateRiderPosition, EntityChicken.updateRiderPosition,
// EntitySkeleton.getYOffset and Entity.mountEntity, is the executed class. The server side places the rider with the executed
// mount.updateRiderPosition. One JSON object per line; see tools/verify-tracker-mounts.mjs.
public class TrackerMountsProbe {
  static sun.misc.Unsafe U;
  static ChickenProbe.World clientWorld;
  static final Map<Integer, sa> clientById = new HashMap<>();
  static final List<sa> clientOrder = new ArrayList<>();
  static final Map<Integer, Integer> indexOf = new HashMap<>();

  // World.getLightBrightness is read by EntityMob.onLivingUpdate (getBrightness)
  public static class MW extends TrackerProbe.CW { public float n(int x, int y, int z) { return 0.5f; } }
  static int cidx(sa c) { for (Map.Entry<Integer, sa> en : clientById.entrySet()) if (en.getValue() == c) return idx(en.getKey()); return -2; }
  static String num(double d) { return Double.toString(d); }
  static Object get(Object o, String n) throws Exception { return MobMoveProbe.field(o.getClass(), n).get(o); }
  static double d(Object o, String n) throws Exception { return MobMoveProbe.d(o, n); }
  static int id(sa e) { return e.y(); }
  static int idx(int entityId) { return entityId < 0 ? -1 : indexOf.getOrDefault(entityId, -2); }

  static boolean sendVel = true; // EntityTracker.trackEntity: the bat and the wither do not send velocity
  interface Make { sa make(ChickenProbe.World w) throws Exception; }
  static Make of(Class<?> c) { return w -> { Constructor<?> k = c.getConstructor(ahb.class); return (sa) k.newInstance(w); }; }

  // the tick's packets as the tests read them: [kind, fields...] with entity ids turned into list indexes
  static String describe(Object p) throws Exception {
    if (p instanceof hx) { hx s = (hx) p; return "[\"attach\"," + s.c() + "," + idx(s.d()) + "," + idx(s.e()) + "]"; }
    String n = p.getClass().getName();
    if (p instanceof fz) return "[\"spawn\"," + idx((Integer) MobMoveProbe.field(fz.class, "a").get(p)) + "," + ((fz) p).f() + "," + ((fz) p).g() + "," + ((fz) p).h() + "," + ((fz) p).i() + "," + ((fz) p).j() + "," + ((fz) p).k() + "]";
    if (p instanceof hf || p instanceof ik || p instanceof ht || p instanceof hy) {
      StringBuilder b = new StringBuilder("[\"" + n + "\"," + idx((Integer) MobMoveProbe.field(p.getClass(), "a").get(p)));
      String f = TrackerProbe.fields(p);
      String rest = f.substring(f.indexOf(',') + 1);
      return b.append(",").append(rest).append("]").toString();
    }
    return "[\"" + n + "\"]";
  }

  // NetHandlerPlayClient (bjb, bytecode-read): S0F creates the client mob at pos / 32; S14 / S18 / S12 as in TrackerProbe.handle; S1B attach
  static void handle(Object p, List<sa> servers, List<Make> makes) throws Exception {
    if (p instanceof fz) {
      fz s = (fz) p;
      int eid = (Integer) MobMoveProbe.field(fz.class, "a").get(p), i = idx(eid);
      sa c = makes.get(i).make(clientWorld);
      TrackerProbe.setI(c, "bZ", s.f()); TrackerProbe.setI(c, "ca", s.g()); TrackerProbe.setI(c, "cb", s.h());
      c.b(s.f() / 32.0, s.g() / 32.0, s.h() / 32.0, (float) (s.l() * 360) / 256.0f, (float) (s.m() * 360) / 256.0f);
      MobMoveProbe.field(sv.class, "aO").setFloat(c, (float) (s.n() * 360) / 256.0f); // rotationYawHead
      TrackerProbe.set(c, "v", (double) ((float) s.i() / 8000.0f)); TrackerProbe.set(c, "w", (double) ((float) s.j() / 8000.0f)); TrackerProbe.set(c, "x", (double) ((float) s.k() / 8000.0f));
      clientById.put(eid, c);
      clientOrder.removeIf(o -> o == clientById.get(eid));
      clientOrder.add(c);
      return;
    }
    if (p instanceof hw) {
      // S1C (bjb.a(hw)): the watched objects update the client's data watcher; only the bat's hanging flag is read back here
      hw s = (hw) p; sa c = clientById.get((Integer) MobMoveProbe.field(hw.class, "a").get(p));
      if (c instanceof we) { Object dw = MobMoveProbe.field(sa.class, "af").get(c); dw.getClass().getMethod("a", List.class).invoke(dw, s.c()); }
      return;
    }
    if (p instanceof hx) {
      hx s = (hx) p;
      sa rider = clientById.get(s.d()), vehicle = clientById.get(s.e());
      if (s.c() == 0) { if (rider != null) rider.a(vehicle); }
      else if (s.c() == 1 && rider instanceof sw) { if (vehicle != null) ((sw) rider).b(vehicle, false); else ((sw) rider).a(false, false); }
      return;
    }
    if (p instanceof hf) {
      hf s = (hf) p; sa c = clientById.get((Integer) MobMoveProbe.field(hf.class, "a").get(p)); if (c == null) return;
      TrackerProbe.setI(c, "bZ", ((Integer) get(c, "bZ")) + s.c()); TrackerProbe.setI(c, "ca", ((Integer) get(c, "ca")) + s.d()); TrackerProbe.setI(c, "cb", ((Integer) get(c, "cb")) + s.e());
      float yaw = s.h() ? (float) (s.f() * 360) / 256.0f : MobMoveProbe.fl(c, "y"), pitch = s.h() ? (float) (s.g() * 360) / 256.0f : MobMoveProbe.fl(c, "z");
      c.a(((Integer) get(c, "bZ")) / 32.0, ((Integer) get(c, "ca")) / 32.0, ((Integer) get(c, "cb")) / 32.0, yaw, pitch, 3);
    } else if (p instanceof ik) {
      ik s = (ik) p; sa c = clientById.get((Integer) MobMoveProbe.field(ik.class, "a").get(p)); if (c == null) return;
      TrackerProbe.setI(c, "bZ", s.d()); TrackerProbe.setI(c, "ca", s.e()); TrackerProbe.setI(c, "cb", s.f());
      c.a(s.d() / 32.0, s.e() / 32.0 + 0.015625, s.f() / 32.0, (float) (s.g() * 360) / 256.0f, (float) (s.h() * 360) / 256.0f, 3);
    } else if (p instanceof ht) {
      ht s = (ht) p; sa c = clientById.get((Integer) MobMoveProbe.field(ht.class, "a").get(p)); if (c == null) return;
      c.e((float) (s.c() * 360) / 256.0f); // setRotationYawHead
    } else if (p instanceof hy) {
      hy s = (hy) p; sa c = clientById.get((Integer) MobMoveProbe.field(hy.class, "a").get(p)); if (c == null) return;
      c.i(s.d() / 8000.0, s.e() / 8000.0, s.f() / 8000.0);
    }
  }

  // one scenario. Row of the script: mount x y z, mount yaw (renderYawOffset), mount motion (vx vy vz), rider mounted (1) or free (0)
  // and leash (1) of the mount to the rider entity (the holder) when `leash` is set
  interface Script { double[] at(int t); }
  static String run(String name, Make mountMake, Make riderMake, boolean riderFirst, Script script, int n) throws Exception {
    ChickenProbe.World world = (ChickenProbe.World) U.allocateInstance(ChickenProbe.World.class);
    MobMoveProbe.set(world, "s", new Random(2)); MobMoveProbe.set(world, "C", new qi());
    for (Field f : ahb.class.getDeclaredFields()) if (f.getType() == List.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(world, new ArrayList()); }
    MobMoveProbe.set(world, "t", U.allocateInstance(aqq.class));
    clientWorld = (ChickenProbe.World) U.allocateInstance(MW.class);
    MobMoveProbe.set(clientWorld, "s", new Random(2)); MobMoveProbe.set(clientWorld, "C", new qi());
    for (Field f : ahb.class.getDeclaredFields()) if (f.getType() == List.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(clientWorld, new ArrayList()); }
    MobMoveProbe.set(clientWorld, "t", U.allocateInstance(aqq.class));
    MobMoveProbe.field(ahb.class, "E").setBoolean(clientWorld, true);
    clientById.clear(); clientOrder.clear(); indexOf.clear();
    TrackerProbe.chunkLoaded = true;

    sa mount = mountMake.make(world), rider = riderMake.make(world);
    // list order: the mount first (index 0), the rider second (index 1); `riderFirst` makes the rider's tracker entry run first
    List<sa> servers = Arrays.asList(mount, rider);
    List<Make> makes = Arrays.asList(mountMake, riderMake);
    indexOf.put(id(mount), 0); indexOf.put(id(rider), 1);
    for (sa e : servers) {
      // the constructors roll a random yaw (EntityLivingBase: Math.random() * pi * 2): zero every angle so a record is reproducible
      for (String f : new String[]{"y", "z", "A", "B"}) MobMoveProbe.field(sa.class, f).setFloat(e, 0f);
      for (String f : new String[]{"aM", "aN", "aO", "aP"}) MobMoveProbe.field(sv.class, f).setFloat(e, 0f);
      ChickenProbe.clearTasks((sw) e); MobMoveProbe.field(sa.class, "al").setBoolean(e, false); }
    double[] r0 = script.at(0);
    TrackerProbe.NH net = (TrackerProbe.NH) U.allocateInstance(TrackerProbe.NH.class);
    TrackerProbe.TW tw = (TrackerProbe.TW) U.allocateInstance(TrackerProbe.TW.class); tw.mq = (TrackerProbe.MQ) U.allocateInstance(TrackerProbe.MQ.class);
    TrackerProbe.PMP p = (TrackerProbe.PMP) U.allocateInstance(TrackerProbe.PMP.class); p.world = tw; p.a = net;
    MobMoveProbe.field(mw.class, "f").set(p, new ArrayList());
    TrackerProbe.set(p, "s", 0.5); TrackerProbe.set(p, "t", 64.0); TrackerProbe.set(p, "u", 0.5);
    MobMoveProbe.field(sa.class, "af").set(p, new te(p));
    MobMoveProbe.field(sa.class, "as").set(p, se.b);
    my pe = new my(p, 512, 2, false);
    TrackerProbe.watchX = 0; TrackerProbe.watchZ = 0; TrackerProbe.watchRadius = 10; TrackerProbe.watching = true;
    TrackerProbe.sent.clear(); TrackerProbe.queue.clear();
    List players = new ArrayList(); players.add(p);

    place(mount, rider, r0);
    my[] entries = new my[2];
    entries[0] = new my(mount, 80, 3, sendVel);
    entries[1] = new my(rider, 80, 3, true);
    int[] order = riderFirst ? new int[]{1, 0} : new int[]{0, 1};
    List<String> events = new ArrayList<>();
    StringBuilder inputs = new StringBuilder(), client = new StringBuilder();
    for (int i : order) entries[i].b(players); // updatePlayerList at once: spawn (and attach) packets
    int lastLeash = 0;
    for (int t = 0; t < n; t++) {
      double[] r = script.at(t);
      boolean leashNow = r.length > 9 && r[9] != 0;
      if (t > 0) place(mount, rider, r);
      // server leash changes go out at once (EntityLiving.setLeashedToEntity / clearLeashed -> EntityTracker.func_151247_a, bytecode-read)
      if (leashNow != (lastLeash != 0)) {
        if (leashNow) { ((sw) mount).b(rider, false); TrackerProbe.queue.add(new hx(1, mount, rider)); }
        else { ((sw) mount).a(false, false); TrackerProbe.queue.add(new hx(1, mount, null)); }
        lastLeash = leashNow ? 1 : 0;
      }
      for (int i : order) entries[i].a(players);
      pe.a(players);
      boolean flagged = pe.n;
      if (flagged) for (int i : order) entries[i].b(p);
      StringBuilder ev = new StringBuilder();
      for (Object q : TrackerProbe.queue) { if (ev.length() > 0) ev.append(","); ev.append(describe(q)); }
      if (ev.length() > 0) events.add("[" + t + ",[" + ev + "]]");
      inputs.append(t > 0 ? "," : "").append("[");
      for (int k = 0; k < r.length; k++) inputs.append(k > 0 ? "," : "").append(num(r[k]));
      inputs.append("," + num(d(rider, "s")) + "," + num(d(rider, "t")) + "," + num(d(rider, "u")) + "]");
      // the client: packets in order, then the world's update of every client entity (a rider is skipped and updated after its mount)
      List<Object> q = new ArrayList<>(TrackerProbe.queue); TrackerProbe.queue.clear(); TrackerProbe.sent.clear();
      for (Object o : q) handle(o, servers, makes);
      for (sa c : new ArrayList<>(clientOrder)) {
        if (c.m != null) continue;
        tickClient(c);
        if (c.l != null) {
          sa r2 = c.l;
          if (r2.m != c) { r2.m = null; c.l = null; } else tickClient(r2);
        }
      }
      client.append(t > 0 ? "," : "").append("[");
      for (int i = 0; i < 2; i++) {
        sa c = clientById.get(id(servers.get(i)));
        client.append(i > 0 ? "," : "");
        if (c == null) client.append("[0]");
        else client.append("[1," + num(d(c, "s")) + "," + num(d(c, "t")) + "," + num(d(c, "u")) + "," + num(d(c, "p")) + "," + num(d(c, "q")) + "," + num(d(c, "r")) + "," + (c.m == null ? -1 : cidx(c.m)) + "," + MobMoveProbe.b(c, "D") + "," + num(d(c, "v")) + "," + num(d(c, "w")) + "," + num(d(c, "x")) + "," + (c instanceof sw && ((sw) c).bO() != null ? cidx(((sw) c).bO()) : -1) + "," + num(MobMoveProbe.fl(c, "y")) + "," + num(MobMoveProbe.fl(c, "z")) + "," + num(MobMoveProbe.fl(c, "aM")) + "," + num(MobMoveProbe.fl(c, "aO")) + "," + (c instanceof we && ((we) c).bP() ? 1 : 0) + "]");
      }
      client.append("]");
    }
    return "{\"case\":\"" + name + "\",\"n\":" + n + ",\"inputs\":[" + inputs + "],\"events\":[" + String.join(",", events) + "],\"client\":[" + client + "]}";
  }
  static void tickClient(sa c) throws Exception {
    if (c.m != null) c.ab(); else c.h(); // World.updateEntityWithOptionalForce: updateRidden for a rider, else onUpdate
  }
  // the server places the mount (its row), then the rider with the executed updateRiderPosition when it is mounted
  static void place(sa mount, sa rider, double[] r) throws Exception {
    TrackerProbe.place(mount, r[0], r[1], r[2], (float) r[3], 0f, (float) r[3]); TrackerProbe.chunk(mount);
    MobMoveProbe.field(sv.class, "aM").setFloat(mount, (float) r[3]); // renderYawOffset (EntityChicken.updateRiderPosition reads it)
    TrackerProbe.set(mount, "v", r[4]); TrackerProbe.set(mount, "w", r[5]); TrackerProbe.set(mount, "x", r[6]);
    if (mount instanceof we && r.length > 13) ((we) mount).a(r[13] != 0); // EntityBat.setIsBatHanging: the data watcher the tracker sends as S1C
    boolean mounted = r[7] != 0;
    if (mounted && rider.m != mount) rider.a(mount);
    if (!mounted && rider.m != null) { rider.a((sa) null); }
    if (mounted) mount.ac();
    else if (rider.m == null && r.length > 10 && r[8] == 1) { TrackerProbe.place(rider, r[10], r[11], r[12], 0f, 0f, 0f); }
    TrackerProbe.chunk(rider);
  }

  public static void main(String[] args) throws Exception {
    aji.p();
    adb.l();
    U = MobMoveProbe.unsafe(); TrackerProbe.U = U;
    Make pig = of(wo.class), zombie = of(yq.class), chicken = of(wg.class), spider = of(yn.class), skeleton = of(yl.class);
    // rideWalk: a zombie sits on a walking pig, the pig turns, the zombie is dismounted at tick 70 and mounts again at 100
    System.out.println(run("ridePig", pig, zombie, false, t -> {
      double x = 8.5 + (t < 40 ? 0.1 * t : 4 + 0.15 * (t - 40)), yaw = t < 50 ? 0 : 20 + (t - 50) * 2;
      return new double[]{x, 0, 5.5, yaw, 0.1, 0, 0, (t >= 70 && t < 100) ? 0 : 1};
    }, 140));
    // rideChicken: a chicken jockey; the seat uses the chicken's renderYawOffset (it turns from tick 30)
    System.out.println(run("rideChicken", chicken, zombie, false, t -> {
      double x = 8.5 + 0.12 * t, yaw = t < 30 ? 0 : (t - 30) * 4;
      return new double[]{x, 0, 5.5, yaw, 0.12, 0, 0, 1};
    }, 120));
    // rideSpider: a skeleton on a spider (EntitySkeleton.getYOffset -0.5, spider height 0.9, the mount is a wide mob with a different size class)
    System.out.println(run("rideSpider", spider, skeleton, false, t -> {
      double x = 9.3 - 0.07 * t, z = 5.5 + 0.05 * t;
      return new double[]{x, 0, z, 90, -0.07, 0, 0.05, 1};
    }, 120));
    // riderFirst: the rider's tracker entry runs before its mount's, so the attach packet reaches the client before the vehicle exists
    System.out.println(run("riderFirst", pig, zombie, true, t -> new double[]{8.5 + 0.1 * t, 0, 5.5, 0, 0.1, 0, 0, 1}, 100));
    // leash: the pig is leashed to the zombie standing still from tick 10 to tick 70
    System.out.println(run("leash", pig, zombie, false, t -> new double[]{8.5 + 0.08 * t, 0, 5.5, 0, 0.08, 0, 0, 0, 1, (t >= 10 && t < 70) ? 1 : 0, 12.5, 0, 5.5}, 100));
    // The flyers (batch 43 part 2): the executed client class of each, next to a zombie standing still at (20, 0, 20)
    Make ghast = of(yd.class), blaze = of(xx.class), wither = of(xc.class), squid = of(ws.class), bat = of(we.class);
    System.out.println(run("flyGhast", ghast, zombie, false, t -> new double[]{8.5 + (t < 60 ? 0.15 * t : 9), 10 + 0.4 * Math.sin(t / 9.0), 5.5 + (t < 30 ? 0 : 0.05 * (t - 30)), t < 30 ? 0 : (t - 30) * 3, t < 60 ? 0.15 : 0, 0.04 * Math.cos(t / 9.0), t < 30 ? 0 : 0.05, 0, 1, 0, 20, 0, 20}, 140));
    System.out.println(run("flyBlaze", blaze, zombie, false, t -> new double[]{8.5 + 0.06 * t, 3 + (t < 70 ? 0.05 * t : 3.5 - 0.03 * (t - 70)), 5.5, t * 2, 0.06, t < 70 ? 0.05 : -0.03, 0, 0, 1, 0, 20, 0, 20}, 140));
    sendVel = false;
    System.out.println(run("flyWither", wither, zombie, false, t -> new double[]{8.5 + 0.08 * t, 6 + 0.5 * Math.sin(t / 12.0), 5.5, t * 1.5, 0.08, 0.04 * Math.cos(t / 12.0), 0, 0, 1, 0, 20, 0, 20}, 140));
    // the bat: flying, hanging from tick 40 (the data watcher goes out as S1C), flying again from tick 100
    System.out.println(run("flyBat", bat, zombie, false, t -> new double[]{8.5 + (t < 40 ? 0.1 * t : t < 100 ? 4 : 4 + 0.1 * (t - 100)), 9.3 + (t < 40 ? 0.03 * t : t < 100 ? 0 : 0.02 * (t - 100)), 5.5, t * 4, t < 40 ? 0.1 : t < 100 ? 0 : 0.1, t < 40 ? 0.03 : t < 100 ? 0 : 0.02, 0, 0, 1, 0, 20, 0, 20, (t >= 40 && t < 100) ? 1 : 0}, 140));
    sendVel = true;
    System.out.println(run("flySquid", squid, zombie, false, t -> new double[]{8.5 + 0.05 * t, 12 - 0.04 * t, 5.5, t * 2.5, 0.05, -0.04, 0, 0, 1, 0, 20, 0, 20}, 140));
  }
}
