import java.lang.reflect.Field;
import java.util.*;

// The entity half of EntityRenderer.getMouseOver (blt.a(F), bytecode-read, composed here) with the real 1.7.10 objects it calls: EntityFireball (ze) and its
// large (zg) and small (zi) balls, canBeCollidedWith (R), getCollisionBorderSize (af), the entity box (sa.C), AxisAlignedBB.addCoord/expand/isVecInside/
// calculateIntercept (azt), Vec3.distanceTo (azw), and the world's getEntitiesWithinAABBExcludingEntity (PlayerKnockbackProbe.W: box intersection).
// The viewer is a real EntityPlayer. The block hit is a distance (MovingObjectPosition.hitVec distance, or -1 for none), the client's mouse state is not run.
// A record is: eye, look, creative, wall, balls [x,y,z,large], and the picked ball index (-1 none) with its intercept distance.
public class FireballPickProbe {
  static String num(double v) { return Double.toString(v); }
  static void place(sa e, double x, double y, double z) throws Exception { MobMoveProbe.method(sa.class, "b", double.class, double.class, double.class).invoke(e, x, y, z); }

  public static void main(String[] args) throws Exception {
    aji.p(); adb.l();
    sun.misc.Unsafe u = MobMoveProbe.unsafe();
    PlayerKnockbackProbe.setup();
    PlayerKnockbackProbe.W w = PlayerKnockbackProbe.w;
    Random rnd = new Random(5);
    List<String> ctr = new ArrayList<>();
    int total = 2400;
    for (int n = 0; n < total; n++) {
      PlayerKnockbackProbe.W.targets.clear();
      yz p = PlayerKnockbackProbe.player();
      double px = 0.5 + rnd.nextInt(3) * 0.37, pz = 0.5 + rnd.nextInt(3) * 0.21, py = 64.0 + rnd.nextInt(2) * 0.5;
      place(p, px, py + 1.62, pz); // setPosition: the box is built from posY - yOffset
      double yaw = Math.toRadians(rnd.nextInt(36) * 10 + rnd.nextInt(2) * 3.5), pitch = Math.toRadians(rnd.nextInt(13) * 10 - 60 + rnd.nextInt(2) * 2.5);
      double lx = -Math.sin(yaw) * Math.cos(pitch), ly = Math.sin(pitch), lz = Math.cos(yaw) * Math.cos(pitch);
      boolean creative = rnd.nextInt(3) == 0;
      double eyeY = py + 1.62;
      int nb = 1 + rnd.nextInt(3);
      List<sa> balls = new ArrayList<>(); StringBuilder bs = new StringBuilder();
      for (int i = 0; i < nb; i++) {
        boolean large = rnd.nextInt(4) != 0;
        double d = 0.3 + rnd.nextDouble() * 3.6, side = (rnd.nextDouble() * 3.4) - 1.7, up = (rnd.nextDouble() * 4.2) - 2.4;
        if (rnd.nextInt(8) == 0) { d = rnd.nextDouble() * 0.6; side *= 0.2; up *= 0.2; } // around the eye
        // a point on the look ray, moved sideways along the horizontal perpendicular and up
        double sx = Math.cos(yaw), sz = Math.sin(yaw);
        double x = px + lx * d + sx * side, y = eyeY + ly * d + up - 0.5, z = pz + lz * d + sz * side;
        sa b = large ? new zg(w, x, y, z, 0, 0, 0.1) : new zi(w, x, y, z, 0, 0, 0.1);
        place(b, x, y, z);
        balls.add(b); PlayerKnockbackProbe.W.targets.add(b);
        bs.append(i > 0 ? "," : "").append("[").append(num(x)).append(",").append(num(y)).append(",").append(num(z)).append(",").append(large ? 1 : 0).append("]");
      }
      double wall = rnd.nextInt(3) == 0 ? 0.4 + rnd.nextDouble() * 3.0 : -1;
      // blt.a(F): d0 = block reach, d1 = d0; creative 6/6, else d1 = min(d1, 3); a block hit sets d1 to its distance
      double d0 = creative ? 6.0 : 3.0, d1 = d0;
      if (wall >= 0) d1 = wall;
      azw start = azw.a(px, eyeY, pz);
      azw end = start.c(lx * d0, ly * d0, lz * d0);
      azt viewerBox = (azt) MobMoveProbe.field(sa.class, "C").get(p);
      List list = w.b(p, viewerBox.a(lx * d0, ly * d0, lz * d0).b(1.0, 1.0, 1.0));
      double d2 = d1; sa pointed = null; double pickDist = -1; boolean haveBlock = wall >= 0;
      for (Object o : list) {
        sa e = (sa) o;
        if (!e.R()) continue;
        float f = e.af();
        azt grown = ((azt) MobMoveProbe.field(sa.class, "C").get(e)).b(f, f, f);
        azu mop = grown.a(start, end);
        if (grown.a(start)) {
          if (0.0D < d2 || d2 == 0.0D) { pointed = e; pickDist = mop == null ? 0.0 : start.d(mop.f); d2 = 0.0; }
        } else if (mop != null) {
          double d3 = start.d(mop.f);
          if (d3 < d2 || d2 == 0.0D) { pointed = e; pickDist = d3; d2 = d3; }
        }
      }
      int index = -1;
      if (pointed != null && (d2 < d1 || !haveBlock)) { index = balls.indexOf(pointed); } else pickDist = -1;
      // the same ball over the block reach for a block hit exactly at d1: the strict d2 < d1 is part of the loop above
      ctr.add("{\"case\":\"pick\",\"eye\":[" + num(px) + "," + num(eyeY) + "," + num(pz) + "],\"look\":[" + num(lx) + "," + num(ly) + "," + num(lz) + "],\"creative\":" + creative
        + ",\"wall\":" + num(wall) + ",\"balls\":[" + bs + "],\"candidates\":" + list.size() + ",\"picked\":" + index + ",\"distance\":" + num(index >= 0 ? pickDist : -1) + "}");
    }
    // classes: canBeCollidedWith and collision border per class, the box a ball gets
    for (boolean large : new boolean[] { true, false }) {
      sa b = large ? new zg(w, 0.0, 10.0, 0.0, 0, 0, 0.1) : new zi(w, 0.0, 10.0, 0.0, 0, 0, 0.1);
      place(b, 0.0, 10.0, 0.0);
      azt box = (azt) MobMoveProbe.field(sa.class, "C").get(b);
      ctr.add("{\"case\":\"class\",\"large\":" + large + ",\"canBeCollidedWith\":" + b.R() + ",\"border\":" + num(b.af()) + ",\"box\":[" + num(box.a) + "," + num(box.b) + "," + num(box.c) + "," + num(box.d) + "," + num(box.e) + "," + num(box.f) + "]}");
    }
    { // an off-grid ball: the entity box is exact in doubles (setPosition subtracts the float half-width)
      sa b = new zg(w, 2.2264096211885223, 64.50595325901381, 3.0610483814567804, 0, 0, 0.1);
      place(b, 2.2264096211885223, 64.50595325901381, 3.0610483814567804);
      azt box = (azt) MobMoveProbe.field(sa.class, "C").get(b);
      ctr.add("{\"case\":\"offgrid\",\"box\":[" + num(box.a) + "," + num(box.b) + "," + num(box.c) + "," + num(box.d) + "," + num(box.e) + "," + num(box.f) + "]}");
    }
    for (String s : ctr) System.out.println(s);
  }
}
