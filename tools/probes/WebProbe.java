import java.util.*;
// Unchanged BlockWeb, Entity.moveEntity and EntitySpider.setInWeb.
public class WebProbe {
  static class Player extends yz {
    Player() { super(null,null); }
    public r f_() { return null; }
    public void a(fj message) {}
    public boolean a(int level,String command) { return false; }
  }
  static class World extends ChickenProbe.World {
    public aji a(int x,int y,int z) { return y<0 ? aji.e(1) : x==0 && y>=2 && y<=5 && z==0 ? aji.e(30) : aji.e(0); }
  }
  static String state(sa e) throws Exception {
    return "\"x\":"+e.s+",\"y\":"+e.t+",\"z\":"+e.u+",\"vx\":"+e.v+",\"vy\":"+e.w+",\"vz\":"+e.x+",\"fall\":"+e.R+",\"web\":"+MobMoveProbe.b(e,"I");
  }
  public static void main(String[] args) throws Exception {
    aji.p(); adb.l(); sun.misc.Unsafe u=MobMoveProbe.unsafe();
    World w=(World)u.allocateInstance(World.class); MobMoveProbe.set(w,"s",new Random(2)); MobMoveProbe.set(w,"C",new qi()); MobMoveProbe.set(w,"t",u.allocateInstance(aqq.class));
    for(java.lang.reflect.Field field:ahb.class.getDeclaredFields()) if(field.getType()==List.class&&!java.lang.reflect.Modifier.isStatic(field.getModifiers())) {field.setAccessible(true);field.set(w,new ArrayList());}
    aji web=aji.e(30);
    System.out.println("{\"case\":\"facts\",\"hardness\":"+web.f(w,0,2,0)+",\"opacity\":"+web.k()+",\"render\":"+web.b()+",\"opaque\":"+web.c()+",\"normal\":"+web.d()+",\"box\":"+(web.a(w,0,2,0)!=null)+",\"passable\":"+web.b((ahl)w,0,2,0)+",\"blocksMovement\":"+web.o().c()+",\"requiresTool\":"+!web.o().l()+",\"drop\":"+adb.b(web.a(0,new Random(1),0))+"}");
    for(String type:new String[]{"pig","spider","item"}) {
      sa e=type.equals("pig")?MobMoveProbe.spawn(u,w,"pig",0.5,4,0.5,0):type.equals("spider")?new yn(w):new xk(w,0.5,4,0.5,new add(ade.F));
      e.L=0; e.b(0.5,4,0.5); e.R=12;
      for(int tick=0;tick<80;tick++) {
        // Fixed requested velocity isolates moveEntity from movement acceleration and drag.
        e.v=tick<40?.12:1; e.w=-.4; e.x=tick<40?-.08:0;
        e.d(e.v,e.w,e.x);
        System.out.println("{\"case\":\"move\",\"type\":\""+type+"\",\"tick\":"+tick+","+state(e)+"}");
      }
    }
    for(boolean flying:new boolean[]{false,true}) {
      Player e=(Player)u.allocateInstance(Player.class); e.bE=new yw();e.bE.b=flying;e.R=12;
      web.a(w,0,4,0,(sa)e);
      System.out.println("{\"case\":\"player\",\"flying\":"+flying+",\"fall\":"+e.R+",\"web\":"+MobMoveProbe.b(e,"I")+"}");
    }
    // Boundary scan: block collision callbacks shrink the box by 0.001 on each side.
    for(double x:new double[]{-0.452,-0.451,-0.4505,-0.449,0.5,1.449,1.4505,1.451,1.452}) {
      sv e=MobMoveProbe.spawn(u,w,"pig",x,4,0.5,0);e.R=12;e.d(0,0,0);
      System.out.println("{\"case\":\"contact\",\"at\":"+x+","+state(e)+"}");
    }
  }
}
