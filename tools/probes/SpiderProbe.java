import java.util.*;
// Original EntitySpider attack/drop/ladder rules; override only light and the
// outgoing damage sink. No game classes are patched or shipped.
public class SpiderProbe {
  static class World extends ChickenProbe.World {}
  static class Spider extends yn {
    float light; int hits; boolean water;
    Spider(ahb w) { super(w); }
    public boolean M() { return water; }
    public float d(float partial) { return light; }
    public boolean n(sa target) { hits++; return true; }
    void attack(sa target, float distance) { super.a(target, distance); }
    void drops(boolean player, int looting) { super.b(player, looting); }
  }
  public static void main(String[] args) throws Exception {
    aji.p(); adb.l();
    sun.misc.Unsafe u=MobMoveProbe.unsafe(); World w=(World)u.allocateInstance(World.class);
    MobMoveProbe.set(w,"s",new Random(2)); MobMoveProbe.set(w,"C",new qi());
    MobMoveProbe.set(w,"t",u.allocateInstance(aqq.class));
    for(java.lang.reflect.Field f:ahb.class.getDeclaredFields()) if(f.getType()==List.class&&!java.lang.reflect.Modifier.isStatic(f.getModifiers())) {f.setAccessible(true); f.set(w,new ArrayList());}
    Spider base=new Spider(w);
    System.out.println("{\"case\":\"facts\",\"width\":"+base.M+",\"height\":"+base.N+",\"health\":"+base.a(yj.a).e()+",\"speed\":"+base.a(yj.d).e()+",\"damage\":"+base.a(yj.e).e()+",\"poisonAllowed\":"+base.d(new rw(19,100))+"}");
    for(int seed=0;seed<300;seed++) for(boolean player:new boolean[]{false,true}) {
      Spider e=new Spider(w); MobMoveProbe.set(e,"Z",new Random(seed)); World.spawned.clear(); e.drops(player,0);
      int string=0,eye=0;
      for(Object o:World.spawned) {add s=((xk)o).f(); if(s.b()==ade.F)string+=s.b; if(s.b()==ade.bp)eye+=s.b;}
      System.out.println("{\"case\":\"drops\",\"seed\":"+seed+",\"player\":"+player+",\"string\":"+string+",\"eye\":"+eye+"}");
    }
    for(int seed=0;seed<100;seed++) for(float light:new float[]{0.49f,0.5f,0.51f,1f}) for(float distance:new float[]{1.99f,2f,2.01f,4f,5.99f,6f}) for(boolean ground:new boolean[]{false,true}) {
      Spider e=new Spider(w); e.light=light; e.b(64.0,0.0,64.0); e.D=ground; e.v=0.2; e.x=-0.3; e.w=-0.1; e.bm=base; base.b(67.0,0.0,68.0);
      MobMoveProbe.set(e,"Z",new Random(seed)); e.attack(base,distance);
      System.out.println("{\"case\":\"attack\",\"seed\":"+seed+",\"light\":"+light+",\"distance\":"+distance+",\"ground\":"+ground+",\"target\":"+(e.bm!=null)+",\"hits\":"+e.hits+",\"cooldown\":"+e.aB+",\"vx\":"+e.v+",\"vy\":"+e.w+",\"vz\":"+e.x+"}");
    }
    // ModelSpider.setRotationAngles, without an OpenGL renderer.
    big model=new big();
    for(int i=0;i<40;i++) {float swing=i*0.37f,amount=(i%5)*0.25f; model.a(swing,amount,0,30,-15,0.0625f,base);
      bix[] legs={model.d,model.e,model.f,model.g,model.h,model.i,model.j,model.k}; StringBuilder rows=new StringBuilder();
      for(bix leg:legs)rows.append(rows.length()>0?",":"").append("[").append(leg.g).append(',').append(leg.h).append(']');
      System.out.println("{\"case\":\"pose\",\"swing\":"+swing+",\"amount\":"+amount+",\"legs\":["+rows+"]}");
    }
    for(boolean wall:new boolean[]{false,true}) {
      MobMoveProbe.step=wall?6:0; Spider e=new Spider(w); e.b(0.0,0.0,0.0); e.D=true;
      for(int i=0;i<60;i++) {e.v=0; e.x=0.22; e.e(0,0); e.a(e.E);
        System.out.println("{\"case\":\"climb\",\"wall\":"+wall+",\"tick\":"+i+",\"y\":"+e.t+",\"z\":"+e.u+",\"vy\":"+e.w+",\"vz\":"+e.x+",\"climbing\":"+e.bZ()+"}");}
    }
    MobMoveProbe.step=0;
    Spider swimmer=new Spider(w);swimmer.water=true;swimmer.y=0;swimmer.b(0.0,10.0,0.0);
    for(int i=0;i<40;i++) {swimmer.e(0,0.8f*0.98f);
      System.out.println("{\"case\":\"swim\",\"tick\":"+i+",\"y\":"+swimmer.t+",\"z\":"+swimmer.u+",\"vy\":"+swimmer.w+",\"vz\":"+swimmer.x+"}");}
    acx eye=(acx)ade.bp;
    System.out.println("{\"case\":\"food\",\"hunger\":"+eye.g(new add(eye))+",\"saturation\":"+eye.h(new add(eye))+"}");
  }
}
