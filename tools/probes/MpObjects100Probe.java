import io.netty.buffer.ByteBuf;
import io.netty.buffer.Unpooled;
import java.lang.reflect.Field;
import java.util.*;

// Batch 100 mpobjects100. Runs the unchanged EntityTrackerEntry (my) with
//  1. a real EntityItem (xk) whose stack has a null item (what a jukebox ejects for a Record int that names no item): the packets the entry sends a watching player
//     (S0E spawn object, S1C metadata), each one written through the real PacketBuffer (et) the way MessageSerializer (fa) writes it on the wire; and a feather as control.
//  2. a real EntityIronGolem (wt): wt.a(boolean) (setHoldingRose) calls World.setEntityState(golem, 11); WorldServer (mt).a(sa, byte) is `getEntityTracker().b(sa, new gt(sa, byte))`
//     (bytecode-read), i.e. EntityTrackerEntry.b(ft) = sendPacketToAllAssociatedPlayers; the world double does exactly that with the real entry.
// Doubles (player, network handler, world) are TrackerProbe's / TrackerItemsProbe's. One JSON object per line.
public class MpObjects100Probe {
  static ChickenProbe.World server;
  static my entry;
  public static class SW100 extends TrackerItemsProbe.SW {
    public void a(sa e, byte b) { entry.b(new gt(e, b)); } // WorldServer.setEntityState: tracker.func_151248_b -> entry.func_151261_b
  }
  static String encode(ft p) {
    ByteBuf buf = Unpooled.buffer();
    try { p.b(new et(buf)); return "\"ok:" + buf.readableBytes() + "\""; }
    catch (Throwable t) { return "\"" + t.getClass().getName() + ":" + buf.readableBytes() + "\""; }
  }
  static String fmt(Object p) throws Exception {
    String enc = p instanceof ft ? encode((ft) p) : "null";
    if (p instanceof fw) { fw s = (fw) p; return "[\"S0E\"," + s.d() + "," + s.e() + "," + s.f() + "," + s.l() + "," + s.m() + "," + enc + "]"; }
    if (p instanceof gt) return "[\"S19\"," + MobMoveProbe.field(gt.class, "a").getInt(p) + "," + MobMoveProbe.field(gt.class, "b").getByte(p) + "," + enc + "]";
    if (p instanceof hw) { hw s = (hw) p; StringBuilder b = new StringBuilder("[\"S1C\"," + s.d() + ",["); boolean f = true; for (Object o : s.c()) { tf w = (tf) o; b.append(f ? "" : ",").append("[" + w.c() + "," + w.a() + "," + TrackerItemsProbe.watchValue(w.b()) + "]"); f = false; } return b + "]," + enc + "]"; }
    return "[\"" + p.getClass().getName() + "\"," + enc + "]";
  }
  static TrackerProbe.PMP player(double px, double pz) throws Exception {
    TrackerProbe.chunkLoaded = true;
    TrackerProbe.NH net = (TrackerProbe.NH) TrackerItemsProbe.U.allocateInstance(TrackerProbe.NH.class);
    TrackerProbe.TW tw = (TrackerProbe.TW) TrackerItemsProbe.U.allocateInstance(TrackerProbe.TW.class); tw.mq = (TrackerProbe.MQ) TrackerItemsProbe.U.allocateInstance(TrackerProbe.MQ.class);
    TrackerProbe.PMP p = (TrackerProbe.PMP) TrackerItemsProbe.U.allocateInstance(TrackerProbe.PMP.class); p.world = tw; p.a = net;
    MobMoveProbe.field(mw.class, "f").set(p, new ArrayList<>());
    MobMoveProbe.field(sa.class, "af").set(p, new te(p));
    MobMoveProbe.field(sa.class, "as").set(p, se.b);
    TrackerProbe.set(p, "s", px); TrackerProbe.set(p, "t", 0.0); TrackerProbe.set(p, "u", pz);
    MobMoveProbe.field(sa.class, "C").set(p, azt.a(px - 0.3, 0, pz - 0.3, px + 0.3, 1.8, pz + 0.3));
    MobMoveProbe.field(sa.class, "o").set(p, server);
    TrackerProbe.watchX = 0; TrackerProbe.watchZ = 0; TrackerProbe.watchRadius = 10; TrackerProbe.watching = true;
    return p;
  }
  static String drain() throws Exception {
    List<Object> q = new ArrayList<>(TrackerProbe.queue); TrackerProbe.queue.clear(); TrackerProbe.sent.clear();
    StringBuilder b = new StringBuilder();
    for (Object o : q) b.append(b.length() > 0 ? "," : "").append(fmt(o));
    return "[" + b + "]";
  }
  static String ghostCase(String name, add stack) throws Exception {
    server = (ChickenProbe.World) TrackerItemsProbe.world(SW100.class, false);
    TrackerProbe.PMP p = player(0.5, 0.5);
    TrackerProbe.sent.clear(); TrackerProbe.queue.clear();
    List players = new ArrayList(); players.add(p);
    xk e = new xk(server, 4.5, 1.0, 4.5, stack);
    entry = new my(e, 64, 20, true);
    entry.b(players); // EntityTracker.addEntityToTracker -> updatePlayerEntity: the spawn packets
    String spawn = drain();
    StringBuilder ticks = new StringBuilder();
    for (int t = 1; t <= 3; t++) { entry.a(players); ticks.append(t > 1 ? "," : "").append(drain()); }
    return "{\"case\":\"" + name + "\",\"spawn\":" + spawn + ",\"ticks\":[" + ticks + "]}";
  }
  static String golemCase() throws Exception {
    server = (ChickenProbe.World) TrackerItemsProbe.world(SW100.class, false);
    TrackerProbe.PMP p = player(0.5, 0.5);
    TrackerProbe.sent.clear(); TrackerProbe.queue.clear();
    List players = new ArrayList(); players.add(p);
    wt g = new wt(server);
    TrackerProbe.place(g, 4.5, 0.0, 4.5, 0f, 0f, 0f); TrackerProbe.chunk(g);
    entry = new my(g, 80, 3, true);
    entry.b(players);
    String spawn = drain();
    StringBuilder calls = new StringBuilder();
    boolean[] seq = {true, false, true, true, false};
    for (int i = 0; i < seq.length; i++) {
      g.a(seq[i]);
      calls.append(i > 0 ? "," : "").append("[" + seq[i] + "," + MobMoveProbe.field(wt.class, "bs").getInt(g) + "," + drain() + "]");
    }
    // an idle tracker pass sends no status
    entry.a(players);
    String idle = drain();
    return "{\"case\":\"golemRose\",\"spawn\":" + spawn + ",\"calls\":[" + calls + "],\"idle\":" + idle + "}";
  }
  public static void main(String[] args) throws Exception {
    aji.p();
    adb.l();
    TrackerItemsProbe.U = MobMoveProbe.unsafe();
    MobMoveProbe.ProbeWorld.exact = true;
    System.out.println(ghostCase("ghostItem", new add((adb) null, 1, 0)));
    System.out.println(ghostCase("featherItem", new add(ade.G, 1)));
    System.out.println(golemCase());
  }
}
