import java.util.*;

// Unchanged Explosion.doExplosionA and the actual non-living target classes.
// XpOrbProbe.XW supplies only blocks, collision boxes and the entity query.
public class ExplosionEntityProbe {
  static class IW extends XpOrbProbe.XW {
    IW() {super();}
    List<sa> spawned = new ArrayList<>();
    List<String> sounds = new ArrayList<>();
    public boolean d(sa e) {spawned.add(e);return true;}
    public boolean f(int x,int y,int z) {put(x,y,z,0,0);return true;}
    public void a(sa e,String sound,float volume,float pitch) {sounds.add(sound);}
    public List a(sa e,azt box,sj selector) {return new ArrayList();}
  }
  static IW ignitionWorld(boolean water,boolean grazing) throws Exception {
    IW w=(IW)PlantProbe.unsafe.allocateInstance(IW.class);
    MobMoveProbe.set(w,"t",PlantProbe.unsafe.allocateInstance(aqq.class));
    MobMoveProbe.set(w,"s",new Random(2)); MobMoveProbe.set(w,"C",new qi());
    for(String name:new String[] {"h","L","u"}) MobMoveProbe.field(ahb.class,name).set(w,new ArrayList());
    w.cells=new HashMap<>();w.entities=new ArrayList<>();w.spawned=new ArrayList<>();w.sounds=new ArrayList<>();
    w.put(1,1,0,46,0); if(water)w.put(0,1,grazing?-1:0,9,0);
    return w;
  }
  public static void main(String[] args) throws Exception {
    aji.p(); adb.l();
    PlantProbe.unsafe = MobMoveProbe.unsafe();
    for(int fire:new int[] {-1,0,1,2,20,300}) for(boolean water:new boolean[] {false,true}) for(boolean shooter:new boolean[] {false,true}) for(boolean grazing:new boolean[] {false,true}) {
      IW w=ignitionWorld(water,grazing);
      zc a=new zc(w,grazing?0.8:0.5,1.5,grazing?-1:0.5);a.v=grazing?0:2;a.w=0;a.x=grazing?1.5:0;
      PlayerStepProbe.field(sa.class,"e").setInt(a,fire);
      PlayerStepProbe.field(sa.class,"Z").set(a,new Random(7));
      sa source=shooter?(sa)PlantProbe.unsafe.allocateInstance(wo.class):null;
      a.c=source;
      a.h();
      boolean primed=w.spawned.size()==1 && w.spawned.get(0) instanceof xw;
      xw t=primed?(xw)w.spawned.get(0):null;
      System.out.println("{\"kind\":\"ignition\",\"fire\":"+fire+",\"water\":"+water+",\"grazing\":"+grazing+",\"shooter\":"+shooter+",\"primed\":"+primed+",\"block\":"+aji.b(w.a(1,1,0))+",\"fuse\":"+(t==null?0:t.a)+",\"placer\":"+(t!=null&&t.e()==source)+",\"sound\":"+w.sounds.contains("game.tnt.primed")+"}");
    }
    for (String kind : new String[] {"arrow", "item", "tnt", "snowball", "egg", "sand"})
      for (int shield = 0; shield < 3; shield++)
        for (float size : new float[] {3f, 4f, 6f}) {
          List<int[]> cells = new ArrayList<>();
          if (shield == 1) for (int y=0;y<5;y++) for (int z=-2;z<3;z++) cells.add(new int[] {1,y,z,1});
          if (shield == 2) cells.add(new int[] {1,1,0,1});
          XpOrbProbe.XW w = XpOrbProbe.world(cells.toArray(new int[0][]));
          double[][] points = {{0.5,1.5,0.5},{1.5,1.5,0.5},{3.0,1.5,0.5},{6.5,1.5,0.5},{8.5,1.5,0.5},{12.5,1.5,0.5},{12.5001,1.5,0.5},{2.5,2.0,1.5}};
          for (int i=0;i<points.length;i++) {
            double[] p=points[i];
            sa e = kind.equals("arrow") ? new zc(w,p[0],p[1],p[2]) : kind.equals("item") ? new xk(w,p[0],p[1],p[2],new add(aji.e(1),1,0)) : kind.equals("snowball") ? new zj(w,p[0],p[1],p[2]) : kind.equals("egg") ? new zl(w,p[0],p[1],p[2]) : kind.equals("sand") ? new xj(w,p[0],p[1],p[2],aji.e(12),0) : new xw(w,p[0],p[1],p[2],null);
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
