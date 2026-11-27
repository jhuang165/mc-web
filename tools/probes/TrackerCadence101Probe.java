import java.util.*;

// Batch 101 mpobjects101. When does the real EntityTrackerEntry (my) re-test the players for a standing EntityItem? The entry is built as EntityTracker.addEntityToTracker does (new my(e, 64, 20, true),
// then my.b(playerList)), then my.a(playerList) is EntityTrackerEntry.updatePlayerList, the call EntityTracker.updateTrackedEntities makes every tick. Doubles are MpObjects100Probe's (TrackerProbe's player,
// chunk watcher and network handler). One JSON line: the packets each call sent. The player starts 300 blocks away; after the first list pass it walks into range; further list calls send nothing until my.b(player).
public class TrackerCadence101Probe {
  public static void main(String[] args) throws Exception {
    aji.p();
    adb.l();
    TrackerItemsProbe.U = MobMoveProbe.unsafe();
    MobMoveProbe.ProbeWorld.exact = true;
    MpObjects100Probe.server = (ChickenProbe.World) TrackerItemsProbe.world(MpObjects100Probe.SW100.class, false);
    TrackerProbe.PMP p = MpObjects100Probe.player(300.5, 0.5);
    TrackerProbe.sent.clear(); TrackerProbe.queue.clear();
    List players = new ArrayList(); players.add(p);
    xk e = new xk(MpObjects100Probe.server, 4.5, 1.0, 4.5, new add(ade.G, 1));
    MpObjects100Probe.entry = new my(e, 64, 20, true);
    StringBuilder rows = new StringBuilder();
    MpObjects100Probe.entry.b(players); // addEntityToTracker: the player is out of range
    rows.append("[\"create\"," + MpObjects100Probe.drain() + "]");
    MpObjects100Probe.entry.a(players); rows.append(",[\"tick1(first pass, still out of range)\"," + MpObjects100Probe.drain() + "]");
    TrackerProbe.set(p, "s", 0.5); TrackerProbe.set(p, "u", 0.5); // the player stands 5 blocks from the item, nobody told the entry
    for (int t = 2; t <= 8; t++) { MpObjects100Probe.entry.a(players); rows.append(",[\"tick" + t + "\"," + MpObjects100Probe.drain() + "]"); }
    MpObjects100Probe.entry.b(p); // updatePlayerEntity (what EntityTracker.addPlayer, sendChunkEntities and a player entry's own 4-block move call)
    rows.append(",[\"updatePlayerEntity\"," + MpObjects100Probe.drain() + "]");
    System.out.println("{\"case\":\"itemCadence\",\"rows\":[" + rows + "]}");
  }
}
