import java.util.*;

// Unchanged Explosion.doExplosionA and the actual non-living target classes.
// XpOrbProbe.XW supplies only blocks, collision boxes and the entity query.
public class ExplosionEntityProbe {
  public static void main(String[] args) throws Exception {
    aji.p(); adb.l();
    PlantProbe.unsafe = MobMoveProbe.unsafe();
    for (String kind : new String[] {"arrow", "item", "tnt"})
      for (int shield = 0; shield < 3; shield++)
        for (float size : new float[] {3f, 4f, 6f}) {
          List<int[]> cells = new ArrayList<>();
          if (shield == 1) for (int y=0;y<5;y++) for (int z=-2;z<3;z++) cells.add(new int[] {1,y,z,1});
          if (shield == 2) cells.add(new int[] {1,1,0,1});
          XpOrbProbe.XW w = XpOrbProbe.world(cells.toArray(new int[0][]));
          double[][] points = {{0.5,1.5,0.5},{1.5,1.5,0.5},{3.0,1.5,0.5},{6.5,1.5,0.5},{8.5,1.5,0.5},{12.5,1.5,0.5},{12.5001,1.5,0.5},{2.5,2.0,1.5}};
          for (int i=0;i<points.length;i++) {
            double[] p=points[i];
            sa e = kind.equals("arrow") ? new zc(w,p[0],p[1],p[2]) : kind.equals("item") ? new xk(w,p[0],p[1],p[2],new add(aji.e(1),1,0)) : new xw(w,p[0],p[1],p[2],null);
            // Constructors use yOffset differently; force posY to the listed point.
            e.b(p[0],p[1],p[2]);
            e.v=0.01;e.w=-0.02;e.x=0.03;
            if (e instanceof zc && i%2==1) PlayerStepProbe.field(zc.class,"i").setBoolean(e,true);
            w.entities.add(e);
          }
          new agw(w,null,0.5,1.5,0.5,size).a();
          StringBuilder targets = new StringBuilder();
          for (sa e : w.entities) {
            if (targets.length()>0) targets.append(',');
            targets.append('[').append(e.s).append(',').append(e.t).append(',').append(e.u).append(',')
              .append(e.v).append(',').append(e.w).append(',').append(e.x).append(',')
              .append(e instanceof xk ? PlayerStepProbe.field(xk.class,"e").getInt(e) : 0).append(',').append(e.K).append(',')
              .append(e instanceof zc && PlayerStepProbe.field(zc.class,"i").getBoolean(e)).append(']');
          }
          StringBuilder blocks = new StringBuilder();
          for (int[] c : cells) {if(blocks.length()>0) blocks.append(',');blocks.append('[').append(c[0]).append(',').append(c[1]).append(',').append(c[2]).append(",1]");}
          System.out.println("{\"kind\":\""+kind+"\",\"shield\":"+shield+",\"size\":"+size+",\"cells\":["+blocks+"],\"targets\":["+targets+"]}");
        }
  }
}
