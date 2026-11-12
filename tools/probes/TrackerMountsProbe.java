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
  public static class MW extends TrackerProbe.CW {
    public float n(int x, int y, int z) { return 0.5f; }
    // batch 44 (bosstracker): the squid case swims through a slab of still water (x >= 11, y 0..9) so the wet branch of EntitySquid.onLivingUpdate runs
    static boolean slab = false;
    boolean wet(int x, int y, int z) { return slab && x >= 11 && y >= 0 && y < 10; }
    public aji a(int x, int y, int z) { return wet(x, y, z) ? aji.e(9) : super.a(x, y, z); }
    public int e(int x, int y, int z) { return 0; }
    // batch 45 (dragonclient): what the client copy asks its world for, in call order (the wing flap, the living sound, the puffs); the server world is not an MW
    static final List<String> log = new ArrayList<>();
    static boolean logOn = false;
    public void a(sa e, String name, float vol, float pitch) { if (logOn && clientSide && e instanceof xa) log.add("[\"at\",\"" + name + "\"," + e.s + "," + e.t + "," + e.u + "," + vol + "," + pitch + "]"); }
    public void a(double x, double y, double z, String name, float vol, float pitch, boolean delay) { if (logOn && clientSide && name.startsWith("mob.enderdragon")) log.add("[\"snd\",\"" + name + "\"," + x + "," + y + "," + z + "," + vol + "," + pitch + "]"); }
    public void a(String name, double x, double y, double z, double vx, double vy, double vz) { if (logOn && clientSide && (name.equals("largeexplode") || name.equals("hugeexplosion"))) log.add("[\"fx\",\"" + name + "\"," + x + "," + y + "," + z + "]"); }
    boolean clientSide = false;
    // batch 49 (dragonclient): World.getEntitiesWithinAABB(Class, box) on the client world: the client crystals whose box meets `box`, in the chunk walk's order
    // (chunk x, chunk z, then the y slice; bytecode-read from ahb.a(Class, azt, sj), the double has no chunk lists of its own)
    public List a(Class c, azt box) {
      List<sa> out = new ArrayList<>();
      for (sa e : clientOrder) {
        if (!c.isInstance(e) || e.K) continue;
        azt b = e.C;
        if (b.d > box.a && b.a < box.d && b.e > box.b && b.b < box.e && b.f > box.c && b.c < box.f) out.add(e);
      }
      out.sort(Comparator.comparingInt((sa e) -> (int) Math.floor(e.s / 16.0)).thenComparingInt(e -> (int) Math.floor(e.u / 16.0)).thenComparingInt(e -> (int) Math.floor(e.t / 16.0)));
      return out;
    }
  }
  // batch 49: the client's Entity.rand with a draw counter and the last raw value, so the replay can follow the stream draw for draw
  static class CR extends Random {
    long count; int last;
    CR(long seed) { super(seed); }
    protected int next(int bits) { count++; last = super.next(bits); return last; }
  }
  static CR dragonRand;
  static boolean b49 = false; // the b49dc cases: the client world counts ticksExisted like World.updateEntityWithOptionalForce, and crystal destroys reach the client
  static List<double[]> crystalSpec = new ArrayList<>(); // server ender crystals { x, y, z, dieTick (-1: never) }
  static final List<sa> crystalClients = new ArrayList<>(); // the client copy of crystalSpec[i], null until its spawn packet arrives
  static String crystalsJson() { StringBuilder b = new StringBuilder("["); for (int i = 0; i < crystalSpec.size(); i++) { double[] c = crystalSpec.get(i); b.append(i > 0 ? "," : "").append("[" + num(c[0]) + "," + num(c[1]) + "," + num(c[2]) + "," + (int) c[3] + "]"); } return b.append("]").toString(); }
  static int crystalIdx(Object c) { for (int i = 0; i < crystalClients.size(); i++) if (crystalClients.get(i) == c) return i; return -1; }
  static boolean dragonRange = false; // EntityTracker.trackEntity: the dragon is tracked at 160 blocks
  static int cidx(sa c) { for (Map.Entry<Integer, sa> en : clientById.entrySet()) if (en.getValue() == c) return idx(en.getKey()); return -2; }
  static String num(double d) { return Double.toString(d); }
  static Object get(Object o, String n) throws Exception { return MobMoveProbe.field(o.getClass(), n).get(o); }
  static double d(Object o, String n) throws Exception { return MobMoveProbe.d(o, n); }
  static int id(sa e) { return e.y(); }
  static int idx(int entityId) { return entityId < 0 ? -1 : indexOf.getOrDefault(entityId, -2); }

  static final List<Integer> dragonPartIds = new ArrayList<>();
  static boolean serverSquidTick = false; // the squid case ticks the server entity's onEntityUpdate (EntityWaterMob's air, so S1C goes out every tick out of the water)
  static boolean serverMW = false; // the server world sees the same water slab
  static String squidInit = "0"; // EntitySquid.rotationVelocity as the constructor rolled it (the client's Entity.rand is not seeded)
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
    if (p instanceof fw) { // NetHandlerPlayClient.handleSpawnObject (bjb.a(fw), bytecode-read): type 51 is new EntityEnderCrystal(world, x / 32, y / 32, z / 32); then serverPos, rotation and the entity id
      fw s = (fw) p; int eid = s.c();
      wz c = new wz(clientWorld, s.d() / 32.0, s.e() / 32.0, s.f() / 32.0);
      TrackerProbe.setI(c, "bZ", s.d()); TrackerProbe.setI(c, "ca", s.e()); TrackerProbe.setI(c, "cb", s.f());
      MobMoveProbe.field(sa.class, "z").setFloat(c, (float) (s.j() * 360) / 256.0f); MobMoveProbe.field(sa.class, "y").setFloat(c, (float) (s.k() * 360) / 256.0f);
      c.d(eid);
      clientById.put(eid, c); clientOrder.add(c);
      Integer k = indexOf.get(eid); if (k != null && k >= 2) { while (crystalClients.size() <= k - 2) crystalClients.add(null); crystalClients.set(k - 2, c); }
      return;
    }
    if (p instanceof Integer) { // S13 (destroy): WorldClient.removeEntityFromWorld -> World.removeEntity -> setDead
      sa c = clientById.remove((Integer) p);
      if (c != null) { c.B(); clientOrder.remove(c); }
      return;
    }
    if (p instanceof fz) {
      fz s = (fz) p;
      int eid = (Integer) MobMoveProbe.field(fz.class, "a").get(p), i = idx(eid);
      sa c = makes.get(i).make(clientWorld);
      TrackerProbe.setI(c, "bZ", s.f()); TrackerProbe.setI(c, "ca", s.g()); TrackerProbe.setI(c, "cb", s.h());
      c.b(s.f() / 32.0, s.g() / 32.0, s.h() / 32.0, (float) (s.l() * 360) / 256.0f, (float) (s.m() * 360) / 256.0f);
      MobMoveProbe.field(sv.class, "aO").setFloat(c, (float) (s.n() * 360) / 256.0f); // rotationYawHead
      if (c instanceof ws || c instanceof xa) { if (c instanceof xa) { dragonRand = new CR(77); MobMoveProbe.set(c, "Z", dragonRand); } else MobMoveProbe.set(c, "Z", new Random(77)); if (c instanceof ws) squidInit = num(MobMoveProbe.fl(c, "by")); }
      if (c instanceof xa) { // NetHandlerPlayClient.handleSpawnMob (bytecode-read): each part's id moves by (packet id - the dragon's own id)
        sa[] parts = ((xa) c).at(); int delta = eid - c.y();
        for (sa part : parts) part.d(part.y() + delta);
        dragonPartIds.clear(); for (sa part : parts) dragonPartIds.add(part.y());
      }
      TrackerProbe.set(c, "v", (double) ((float) s.i() / 8000.0f)); TrackerProbe.set(c, "w", (double) ((float) s.j() / 8000.0f)); TrackerProbe.set(c, "x", (double) ((float) s.k() / 8000.0f));
      clientById.put(eid, c);
      if (s.c() != null) { Object dw = MobMoveProbe.field(sa.class, "af").get(c); dw.getClass().getMethod("a", List.class).invoke(dw, s.c()); } // the spawn packet's data watcher list
      clientOrder.removeIf(o -> o == clientById.get(eid));
      clientOrder.add(c);
      return;
    }
    if (p instanceof hw) {
      // S1C (bjb.a(hw)): the watched objects update the client's data watcher; only the bat's hanging flag is read back here
      hw s = (hw) p; sa c = clientById.get((Integer) MobMoveProbe.field(hw.class, "a").get(p));
      if (c != null) { Object dw = MobMoveProbe.field(sa.class, "af").get(c); dw.getClass().getMethod("a", List.class).invoke(dw, s.c()); }
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
    ((MW) clientWorld).clientSide = true; MW.logOn = true; MW.log.clear();
    clientById.clear(); clientOrder.clear(); indexOf.clear(); crystalClients.clear();
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
    entries[0] = new my(mount, dragonRange ? 160 : 80, 3, sendVel);
    entries[1] = new my(rider, 80, 3, true);
    // batch 49: the server's ender crystals, tracked as EntityTracker.trackEntity does: range 256, frequency Integer.MAX_VALUE, no velocity (bytecode-read, mn.a(sa))
    List<my> cEntries = new ArrayList<>(); List<Integer> cDie = new ArrayList<>(); List<sa> cServer = new ArrayList<>();
    for (int k = 0; k < crystalSpec.size(); k++) {
      double[] cs = crystalSpec.get(k);
      wz cr = new wz(world, cs[0], cs[1], cs[2]);
      TrackerProbe.chunk(cr);
      indexOf.put(id(cr), 2 + k); cServer.add(cr); cDie.add((int) cs[3]);
      cEntries.add(new my(cr, 256, Integer.MAX_VALUE, false));
    }
    StringBuilder dc = new StringBuilder();
    int[] order = riderFirst ? new int[]{1, 0} : new int[]{0, 1};
    List<String> events = new ArrayList<>();
    StringBuilder inputs = new StringBuilder(), client = new StringBuilder(), extra = new StringBuilder(), more = new StringBuilder(), fx = new StringBuilder();
    for (int i : order) entries[i].b(players); // updatePlayerList at once: spawn (and attach) packets
    for (my ce : cEntries) ce.b(players);
    int lastLeash = 0;
    List<Object> pendingDestroy = new ArrayList<>();
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
      if (mount instanceof xa && r.length > 14) ((xa) mount).g((float) r[14]); // the server's health (data watcher 6 -> S1C)
      if (serverSquidTick && mount instanceof ws) { mount.C(); }
      for (int k = 0; k < cEntries.size(); k++) if (cDie.get(k) == t && cEntries.get(k) != null) { cEntries.get(k).a(); cEntries.set(k, null); } // the crystal blows up: setDead, untracked, S13 to the watchers
      for (int i : order) entries[i].a(players);
      for (my ce : cEntries) if (ce != null) ce.a(players);
      pe.a(players);
      boolean flagged = pe.n;
      if (flagged) { for (int i : order) entries[i].b(p); for (my ce : cEntries) if (ce != null) ce.b(p); }
      StringBuilder ev = new StringBuilder();
      for (Object q : TrackerProbe.queue) { if (ev.length() > 0) ev.append(","); ev.append(describe(q)); }
      if (ev.length() > 0) events.add("[" + t + ",[" + ev + "]]");
      inputs.append(t > 0 ? "," : "").append("[");
      for (int k = 0; k < r.length; k++) inputs.append(k > 0 ? "," : "").append(num(r[k]));
      inputs.append("," + num(d(rider, "s")) + "," + num(d(rider, "t")) + "," + num(d(rider, "u")) + "]");
      // the client: packets in order, then the world's update of every client entity (a rider is skipped and updated after its mount)
      List<Object> q = new ArrayList<>(TrackerProbe.queue); TrackerProbe.queue.clear(); TrackerProbe.sent.clear();
      // batch 50 (trackerids): an S13 is not sent at once. EntityTrackerEntry.a() (setDead -> untrackEntity -> removeFromWatchingList) adds the id to EntityPlayerMP.destroyedItemsNetCache
      // (mw.bN) and the player's own update (mw.h, which runs in World.updateEntities before EntityTracker.updateTrackedEntities, bytecode-read: MinecraftServer.v calls
      // WorldServer.tick, updateEntities, then mn.a) sends it at the start of the NEXT tick. So a destroy queued at tick t reaches the client ahead of tick t+1's other packets.
      List<Object> destroyNow = new ArrayList<>(), keep = new ArrayList<>();
      for (Object o : q) (o instanceof Integer ? destroyNow : keep).add(o);
      for (Object o : pendingDestroy) handle(o, servers, makes);
      pendingDestroy.clear(); pendingDestroy.addAll(destroyNow);
      for (Object o : keep) handle(o, servers, makes);
      for (sa c : new ArrayList<>(clientOrder)) {
        if (c.m != null) continue;
        tickClient(c);
        if (c.l != null) {
          sa r2 = c.l;
          if (r2.m != c) { r2.m = null; c.l = null; } else tickClient(r2);
        }
      }
      if (b49 && mount instanceof xa) { // the dragon copy's crystal target (bC), health, ticksExisted, the draw count and last raw value of its Entity.rand, then each crystal copy: [innerRotation, isDead] or [-1]
        xa dg = (xa) clientById.get(id(mount));
        StringBuilder cc = new StringBuilder();
        for (int k = 0; k < cEntries.size(); k++) { sa x = k < crystalClients.size() ? crystalClients.get(k) : null; cc.append(k > 0 ? "," : "").append(x == null ? "[-1]" : "[" + ((wz) x).a + "," + (x.K ? 1 : 0) + "]"); }
        dc.append(t > 0 ? "," : "").append("[" + crystalIdx(MobMoveProbe.field(xa.class, "bC").get(dg)) + "," + num(((sv) dg).aS()) + "," + dg.aa + "," + dragonRand.count + "," + dragonRand.last + ",[" + cc + "]]");
      }
      client.append(t > 0 ? "," : "").append("[");
      for (int i = 0; i < 2; i++) {
        sa c = clientById.get(id(servers.get(i)));
        client.append(i > 0 ? "," : "");
        if (c == null) client.append("[0]");
        else client.append("[1," + num(d(c, "s")) + "," + num(d(c, "t")) + "," + num(d(c, "u")) + "," + num(d(c, "p")) + "," + num(d(c, "q")) + "," + num(d(c, "r")) + "," + (c.m == null ? -1 : cidx(c.m)) + "," + MobMoveProbe.b(c, "D") + "," + num(d(c, "v")) + "," + num(d(c, "w")) + "," + num(d(c, "x")) + "," + (c instanceof sw && ((sw) c).bO() != null ? cidx(((sw) c).bO()) : -1) + "," + num(MobMoveProbe.fl(c, "y")) + "," + num(MobMoveProbe.fl(c, "z")) + "," + num(MobMoveProbe.fl(c, "aM")) + "," + num(MobMoveProbe.fl(c, "aO")) + "," + (c instanceof we && ((we) c).bP() ? 1 : 0) + "]");
      }
      client.append("]");
      extra.append(t > 0 ? "," : "").append(extraOf(clientById.get(id(mount)), t == n - 1));
      more.append(t > 0 ? "," : "").append(moreOf(clientById.get(id(mount))));
      if (!MW.log.isEmpty()) { fx.append(fx.length() > 0 ? "," : "").append("[" + t + ",[" + String.join(",", MW.log) + "]]"); MW.log.clear(); }
    }
    return "{\"case\":\"" + name + "\",\"n\":" + n + ",\"squidInit\":" + squidInit + ",\"inputs\":[" + inputs + "],\"events\":[" + String.join(",", events) + "],\"client\":[" + client + "],\"extra\":[" + extra + "],\"more\":[" + more + "],\"fx\":[" + fx + "],\"crystals\":" + crystalsJson() + ",\"dc\":[" + dc + "],\"partIds\":" + dragonPartIds + "}";
  }
  // batch 44: the boss and squid fields of the client entity. Squid: squidPitch, prevSquidPitch, squidYaw, prevSquidYaw, squidRotation,
  // prevSquidRotation, tentacleAngle, lastTentacleAngle (bp..bw), then the six private fields (bx..bC). Dragon: prevAnimTime (bx), animTime (by),
  // ringBufferIndex (bo), getMovementOffsets(n, 1) for n 0..24 and (n, 0.37) for n 0, 6, 13 as [yaw, y, z], and on the last tick the whole ring (n 0..63).
  static String extraOf(sa c, boolean last) throws Exception {
    if (c instanceof ws) {
      StringBuilder b = new StringBuilder("[");
      String[] names = {"bp", "bq", "br", "bs", "bt", "bu", "bv", "bw", "bx", "by", "bz", "bA", "bB", "bC"};
      for (int i = 0; i < names.length; i++) b.append(i > 0 ? "," : "").append(num(MobMoveProbe.fl(c, names[i])));
      return b.append("]").toString();
    }
    if (c instanceof xa) {
      xa d = (xa) c;
      StringBuilder b = new StringBuilder("[" + num(MobMoveProbe.fl(c, "bx")) + "," + num(MobMoveProbe.fl(c, "by")) + "," + d.bo);
      for (int n = 0; n <= 24; n++) for (double v : d.b(n, 1.0f)) b.append(",").append(num(v));
      for (int n : new int[]{0, 6, 13}) for (double v : d.b(n, 0.37f)) b.append(",").append(num(v));
      if (last) for (int n = 0; n < 64; n++) for (double v : d.b(n, 1.0f)) b.append(",").append(num(v));
      return b.append("]").toString();
    }
    return "[]";
  }
  // batch 45: the client copy's own health (EntityLivingBase.getHealth), the dragon's deathTicks (bB), its seven parts (position and box) and the squid's air
  static String moreOf(sa c) throws Exception {
    if (c instanceof xa) {
      xa d = (xa) c; StringBuilder b = new StringBuilder("[" + num(((sv) c).aS()) + "," + MobMoveProbe.field(xa.class, "bB").getInt(c));
      for (sa part : d.at()) b.append(",").append(num(part.s)).append(",").append(num(part.t)).append(",").append(num(part.u)).append(",").append(num(part.C.a)).append(",").append(num(part.C.b)).append(",").append(num(part.C.c)).append(",").append(num(part.C.d)).append(",").append(num(part.C.e)).append(",").append(num(part.C.f));
      return b.append("]").toString();
    }
    // b52dc: the client squid's air and what EntitySquid.onLivingUpdate's isRemote half writes: squidPitch / prev, squidYaw / prev, squidRotation / prev, tentacleAngle / prev,
    // randomMotionSpeed, rotateSpeed (bp..bz; the swim vector bA..bC is the server's and stays 0 here)
    if (c instanceof ws) {
      StringBuilder b = new StringBuilder("[" + ((sv) c).ar());
      for (String n : new String[]{"bp", "bq", "br", "bs", "bt", "bu", "bv", "bw", "bx", "bz"}) b.append(",").append(num(MobMoveProbe.fl(c, n)));
      return b.append("]").toString();
    }
    return "[]";
  }
  static void tickClient(sa c) throws Exception {
    if (b49) c.aa++; // World.updateEntityWithOptionalForce: ++ticksExisted, then onUpdate
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
    // batch 44 bosstracker: a squid that dips into a still water slab (wet branch, flow push) and leaves it again, the client's own rotation and tentacle fields
    MW.slab = true; MobMoveProbe.ProbeWorld.water = true;
    System.out.println(run("swimSquid", squid, zombie, false, t -> new double[]{8.5 + 0.06 * t, 12 - 0.05 * t + (t > 100 ? 0.12 * (t - 100) : 0), 5.5, t * 2, 0.06, -0.05 + (t > 100 ? 0.12 : 0), 0, 0, 1, 0, 20, 0, 20}, 160));
    MW.slab = false; MobMoveProbe.ProbeWorld.water = false;
    // the Ender Dragon (EntityDragon.onLivingUpdate's client branch: wing animation, the ring buffer, the interpolation): it flies on a wide loop, its yaw wraps past 180
    Make dragon = of(xa.class);
    dragonRange = true;
    System.out.println(run("flyDragon", dragon, zombie, false, t -> {
      double yaw = ((t * 3 + 100) % 360) - 180, a = t / 25.0;
      return new double[]{8.5 + 30 * Math.sin(a), 70 + 6 * Math.sin(t / 10.0), 5.5 + 30 * (1 - Math.cos(a)), yaw, 30 * Math.cos(a) / 25.0, 0.6 * Math.cos(t / 10.0) / 10.0, 30 * Math.sin(a) / 25.0, 0, 1, 0, 20, 0, 20};
    }, 180));
    dragonRange = true;
    // batch 45 dragonclient: the dragon dies (the server health goes to 0 at tick 60; S1C carries it) and the client copy runs EntityDragon.onDeathUpdate
    System.out.println(run("dragonDeath", dragon, zombie, false, t -> {
      double a = t / 25.0;
      return new double[]{8.5 + 30 * Math.sin(a), 70, 5.5 + 30 * (1 - Math.cos(a)), (t * 3 + 100) % 360 - 180, 30 * Math.cos(a) / 25.0, 0, 30 * Math.sin(a) / 25.0, 0, 1, 0, 20, 0, 20, 0, t < 60 ? 200 : 0};
    }, 300));
    // batch 49 dragonclient (b49dc): the client dragon copy's crystal search (EntityDragon.updateDragonEnderCrystal, bP, run by onLivingUpdate on both sides): the
    // nearest EntityEnderCrystal copy within 32 blocks of its box on a nextInt(10) == 0 roll, +1 health every 10th ticksExisted with a target, the target let go once its copy is
    // dead (the server's attack on the head is under !isRemote). The crystals are real server wz tracked at range 256, their copies real wz from the S0E type 51 packet.
    // The server dragon (health 150, never ticked) only feeds the tracker; the client's own health climbs while a crystal is in reach.
    b49 = true; TrackerProbe.queueDestroy = true; dragonRange = true;
    crystalSpec = new ArrayList<>();
    System.out.println(run("b49dc0", dragon, zombie, false, t -> new double[]{8.5 + 0.2 * t, 70, 5.5, 90, 0.2, 0, 0, 0, 1, 0, 20, 0, 20, 0, 150}, 80));
    crystalSpec = new ArrayList<>(Collections.singletonList(new double[]{28.5, 66, 5.5, 50}));
    System.out.println(run("b49dc1", dragon, zombie, false, t -> new double[]{8.5 + 0.2 * t, 70, 5.5, 90, 0.2, 0, 0, 0, 1, 0, 20, 0, 20, 0, 150}, 80));
    crystalSpec = new ArrayList<>(Arrays.asList(new double[]{-20.5, 66, 5.5, -1}, new double[]{62.5, 70, 5.5, -1}));
    System.out.println(run("b49dc2", dragon, zombie, false, t -> new double[]{8.5 + 0.5 * t, 70, 5.5, 90, 0.5, 0, 0, 0, 1, 0, 20, 0, 20, 0, 150}, 80));
    b49 = false; TrackerProbe.queueDestroy = false; crystalSpec = new ArrayList<>();
    dragonRange = false;
    // the squid's air: out of the water the server ticks its air down (EntityWaterMob.onEntityUpdate: a dirtied data watcher, S1C every tick), the client counts its own
    serverSquidTick = true;
    System.out.println(run("squidAir", squid, zombie, false, t -> new double[]{8.5 + 0.02 * t, 12, 5.5, t, 0.02, 0, 0, 0, 1, 0, 20, 0, 20}, 340));
    serverSquidTick = false;
  }
}
