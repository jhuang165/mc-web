import java.util.*;
// Batch 87: ItemBoat.onItemRightClick [abj.a] against every non-living entity kind, built with the native
// client constructors (bjb.handleSpawnObject's choices) and positioned with Entity.setPosition [sa.b(d,d,d)].
// The world is the BoatProbe map world: World.getEntitiesWithinAABBExcludingEntity [ahb.b(sa, azt)] lists live
// entities whose box meets the query, getCollidingBoundingBoxes [ahb.a(sa, azt)] adds entity.getBoundingBox [J] and
// boat.getCollisionBox(entity) [xi.h]. The rider is in the entity list, so its own box takes part in the box check.
// Each record gives the entity's native canBeCollidedWith [R], collisionBorderSize [af], yOffset [L], size, posY and
// box, then the item count and the spawned boat. tools/verify-boat-entities.mjs writes
// public/research/boat-entity-reference.json; src/boatcheck87-b87.test.js replays it.
public class BoatEntityProbe extends BoatProbe {
  static String box(azt b) { return "[" + num(b.a) + "," + num(b.b) + "," + num(b.c) + "," + num(b.d) + "," + num(b.e) + "," + num(b.f) + "]"; }
  static sa make(String kind, BW w, Rider p) throws Exception {
    switch (kind) {
      case "item": return new xk(w, 0, 0, 0, new add(adb.d(264), 1, 0));
      case "orb": return new sq(w, 0, 0, 0, 3);
      case "arrow": return new zc(w, 0, 0, 0);
      case "snowball": return new zj(w, 0, 0, 0);
      case "eye": return new zd(w, 0, 0, 0);
      case "hook": return new xe(w, 0, 0, 0, p);
      case "large-fireball": return new zg(w, 0, 0, 0, 0, 0, 1);
      case "small-fireball": return new zi(w, 0, 0, 0, 0, 0, 1);
      case "wither-skull": return new zp(w, 0, 0, 0, 0, 0, 1);
      case "falling": return new xj(w, 0, 0, 0, aji.e(12), 0);
      case "tnt": return new xw(w, 0, 0, 0, null);
      case "crystal": return new wz(w, 0, 0, 0);
      case "boat": return new xi(w, 0, 0, 0);
      case "cart": return new xm(w, 0, 0, 0);
      default: throw new IllegalArgumentException(kind);
    }
  }
  static Rider looker(BW w, double[] pos, float pitch, float yaw) throws Exception {
    Rider p = rider(w, yaw, 0); p.b(pos[0], pos[1], pos[2]); p.z = pitch; p.B = pitch; p.A = yaw; p.S = pos[0]; p.T = pos[1]; p.U = pos[2]; p.p = pos[0]; p.q = pos[1]; p.r = pos[2];
    w.entities.add(p);
    return p;
  }
  static void use(String name, BW w, Rider p, sa e) throws Exception {
    int before = w.spawned.size();
    add stack = new add(adb.d(333), 2, 0);
    add result = ((abj) stack.b()).a(stack, w, p);
    sa b = w.spawned.size() > before ? w.spawned.get(w.spawned.size() - 1) : null;
    String ent = e == null ? "null" : "{\"class\":\"" + e.getClass().getSimpleName() + "\",\"collide\":" + e.R() + ",\"border\":" + e.af() + ",\"yOffset\":" + e.L + ",\"size\":[" + e.M + "," + e.N + "],\"pos\":[" + num(e.s) + "," + num(e.t) + "," + num(e.u) + "],\"box\":" + box(e.C)
      + ",\"bounding\":" + (e.J() == null ? "null" : box(e.J())) + "}";
    System.out.println("{\"name\":\"" + name + "\",\"player\":[" + num(p.s) + "," + num(p.t) + "," + num(p.u) + "," + p.z + "," + p.y + "],\"traceStart\":"
      + (w.traceStart == null ? "null" : "[" + num(w.traceStart[0]) + "," + num(w.traceStart[1]) + "," + num(w.traceStart[2]) + "]") + ",\"entity\":" + ent + ",\"count\":" + result.b + ",\"boat\":"
      + (b == null ? "null" : "[" + num(b.s) + "," + num(b.t) + "," + num(b.u) + "," + b.y + "," + box(b.C) + "]") + "}");
  }
  // Puts the entity's box bottom at `bottom` (posY = bottom + yOffset), centred on x/z.
  static void kind(String name, String kind, double x, double bottom, double z) throws Exception {
    BW w = bw(new int[][] {{2, 1, 4, 9, 0}}); Rider p = looker(w, new double[] {2.5, 3, 4.5}, 90, 0);
    sa e = make(kind, w, p); e.b(x, bottom + e.L, z); w.entities.add(e);
    use(name, w, p, e);
  }
  static void knot(String name, int x, int y, int z) throws Exception {
    BW w = bw(new int[][] {{2, 1, 4, 9, 0}}); Rider p = looker(w, new double[] {2.5, 3, 4.5}, 90, 0);
    sa e = new su(w, x, y, z); w.entities.add(e);
    use(name, w, p, e);
  }
  public static void main(String[] args) throws Exception {
    aji.p(); adb.l(); PlantProbe.unsafe = MobMoveProbe.unsafe();
    // Looking straight down from (2.5, 3, 4.5) at water (2, 1, 4): the trace start ends at (2.5, 2, 4.5); the boat
    // spawns at (2.5, 2.3, 4.5) with box y [2, 2.6], shrunk [2.1, 2.5].
    { BW w = bw(new int[][] {{2, 1, 4, 9, 0}}); use("none", w, looker(w, new double[] {2.5, 3, 4.5}, 90, 0), null); }
    // The player's own box takes part in the boat's box check (feet 2.2 inside the shrunk boat box).
    { BW w = bw(new int[][] {{3, 1, 4, 9, 0}}); use("own-player-box", w, looker(w, new double[] {3.5, 2.2, 4.5}, 90, 0), null); }
    String[] kinds = {"item", "orb", "arrow", "snowball", "eye", "hook", "large-fireball", "small-fireball", "wither-skull", "falling", "tnt", "crystal", "boat", "cart"};
    for (String k : kinds) {
      sa probe = make(k, bw(new int[][] {}), rider(bw(new int[][] {}), 0, 0));
      double h = probe.N;
      // Box top at 2.05: the trace start (y 2) lies inside the box grown by 0.1 but the box stays below the shrunk boat box.
      kind(k + "-at-start", k, 2.5, 2.05 - h, 4.5);
      // Box bottom at 2.2 beside the start: it meets the shrunk boat box only.
      kind(k + "-in-boat-box", k, 3.05 + probe.M / 2 - 0.2, 2.2, 4.5);
      // Box top at 1.05: only a 1.0 border reaches the trace start.
      kind(k + "-border-1", k, 2.5, 1.05 - h, 4.5);
      // Far below the start inside the 5-block look box: nothing.
      kind(k + "-clear", k, 2.5, -1.5 - h, 4.5);
    }
    knot("knot-at-start", 2, 1, 4);
    knot("knot-beside", 2, 1, 6);
  }
}
