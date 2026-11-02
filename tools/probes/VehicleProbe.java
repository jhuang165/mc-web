import java.util.*;
// Unchanged xs/xl/adj and EntityPlayer.mountEntity / EntityLivingBase.dismountEntity.
// Rider overrides only onUpdate (unused here) and fall to record the cart's forwarded fall.
public class VehicleProbe extends MinecartProbe {
  static class Rider extends Target {
    Rider() { super(); }
    float fallen;
    public void h() {}
    protected void b(float distance) { fallen = distance; }
  }
  static class VW extends MW {
    VW() { super(); }
    public List a(azt box) {
      List<azt> out=new ArrayList<>();
      for(int x=(int)Math.floor(box.a);x<Math.floor(box.d+1);x++)
        for(int y=(int)Math.floor(box.b)-1;y<Math.floor(box.e+1);y++)
          for(int z=(int)Math.floor(box.c);z<Math.floor(box.f+1);z++) a(x,y,z).a(this,x,y,z,box,out,null);
      return out;
    }
  }
  static VW vw(int[][] cells) throws Exception {
    MW base = world(cells);
    VW w = (VW)PlantProbe.unsafe.allocateInstance(VW.class);
    for (java.lang.reflect.Field f : ahb.class.getDeclaredFields()) if (!java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(w, f.get(base)); }
    w.cells=base.cells; w.entities=base.entities; w.spawned=base.spawned;
    return w;
  }
  static Rider rider(MW w, float yaw, float forward) throws Exception {
    Rider p=(Rider)PlantProbe.unsafe.allocateInstance(Rider.class);
    PlayerStepProbe.set(p,"o",w); PlayerStepProbe.set(p,"C",azt.a(0,0,0,0,0,0));
    PlayerStepProbe.set(p,"M",0.6f); PlayerStepProbe.set(p,"N",1.8f); PlayerStepProbe.set(p,"L",0f);
    PlayerStepProbe.set(p,"bE",new yw()); PlayerStepProbe.set(p,"Z",new Random(1));
    te watcher=new te(p); PlayerStepProbe.set(p,"af",watcher); watcher.a(0,Byte.valueOf((byte)0)); watcher.a(1,Short.valueOf((short)300));
    p.b(0.5,0.2,0.5); p.y=yaw; p.be=forward;
    return p;
  }
  static String ps(Rider p) { return "["+num(p.s)+","+num(p.t)+","+num(p.u)+","+p.y+","+(p.m!=null)+","+num(p.fallen)+"]"; }
  static String cells(int[][] cells) { StringBuilder s=new StringBuilder("["); for(int[] c:cells) { if(s.length()>1)s.append(','); s.append(Arrays.toString(c)); } return s+"]"; }
  static void travel(String name,int[][] cells,double[] spawn,float yaw,float forward,boolean ridden,int count,boolean two,boolean voidBelow) throws Exception {
    VW w=vw(cells); w.voidBelow=voidBelow;
    xs c=new xs(w,spawn[0],spawn[1],spawn[2]); c.v=spawn[3]; c.x=spawn[4]; PlayerStepProbe.field(sa.class,"c").setInt(c,1); w.entities.add(c);
    xs other=two?new xs(w,4.5,0.5,0.5):null; if(other!=null)w.entities.add(other);
    Rider p=rider(w,yaw,forward); boolean mounted=ridden&&c.c(p); if(ridden)c.ac();
    StringBuilder ticks=new StringBuilder("[");
    for(int t=0;t<count;t++) {
      if(!c.K){ c.S=c.s;c.T=c.t;c.U=c.u;c.A=c.y;c.B=c.z;c.h(); }
      if(other!=null&&!other.K){ other.S=other.s;other.T=other.t;other.U=other.u;other.A=other.y;other.B=other.z;other.h(); }
      if(p.m!=null&&!p.m.K){ c.ac(); p.R=0; }
      if(t>0)ticks.append(','); ticks.append("[").append(state(c)).append(',').append(ps(p)).append(',').append(other==null?"null":state(other)).append(']');
    }
    ticks.append(']');
    String before=ps(p); if(p.m!=null) p.a((sa)null);
    System.out.println("{\"kind\":\"travel\",\"name\":\""+name+"\",\"cells\":"+cells(cells)+",\"spawn\":"+Arrays.toString(spawn)+",\"yaw\":"+yaw+",\"forward\":"+forward+",\"ridden\":"+ridden+",\"two\":"+two+",\"void\":"+voidBelow+",\"mounted\":"+mounted+",\"ticks\":"+ticks+",\"beforeDismount\":"+before+",\"dismount\":"+ps(p)+"}");
  }
  static void placement(int block,int meta,int type) throws Exception {
    VW w=vw(new int[][]{{2,3,4,block,meta}}); Rider p=rider(w,0,0); add stack=new add(adb.d(type==0?328:342),2,0);
    boolean ok=((adj)stack.b()).a(stack,p,w,2,3,4,1,0.5f,0.5f,0.5f);
    xl c=w.spawned.isEmpty()?null:(xl)w.spawned.get(0);
    System.out.println("{\"kind\":\"placement\",\"block\":"+block+",\"meta\":"+meta+",\"type\":"+type+",\"ok\":"+ok+",\"count\":"+stack.b+",\"cart\":"+(c==null?"null":"["+num(c.s)+","+num(c.t)+","+num(c.u)+","+c.m()+"]")+"}");
  }
  static void mountCases() throws Exception {
    VW w=vw(new int[][]{}); xs c=new xs(w,0.5,0.5,0.5); Rider p=rider(w,0,0), q=rider(w,0,0);
    boolean first=c.c(p), second=c.c(q); c.ac();
    System.out.println("{\"kind\":\"mount\",\"first\":"+first+",\"occupied\":"+second+",\"firstRider\":"+(c.l==p)+",\"secondMounted\":"+(q.m!=null)+",\"position\":"+ps(p)+",\"offset\":"+num(c.ae())+"}");
    for(boolean creative:new boolean[]{false,true}) {
      xs e=new xs(w,1.5,0.5,0.5); p.bE.d=creative; w.spawned.clear(); e.a(ro.a((yz)p),5f);
      StringBuilder drops=new StringBuilder("["); for(sa s:w.spawned){if(drops.length()>1)drops.append(',');drops.append(item(s));} drops.append(']');
      System.out.println("{\"kind\":\"break\",\"creative\":"+creative+",\"dead\":"+e.K+",\"drops\":"+drops+"}");
    }
  }
  public static void main(String[] args) throws Exception {
    aji.p(); adb.l(); PlantProbe.unsafe=MobMoveProbe.unsafe(); mountCases();
    int[][] straight=row(66,1,-4,24,0,0);
    travel("straight-forward",col(66,0,-4,24,0,0),new double[]{0.5,0.5,0.5,0,0},0,1,true,80,false,false);
    travel("straight-idle",straight,new double[]{0.5,0.5,0.5,0.3,0},-90,0,true,60,false,false);
    travel("empty-drag",straight,new double[]{0.5,0.5,0.5,0.3,0},-90,0,false,60,false,false);
    travel("reverse-input",straight,new double[]{0.5,0.5,0.5,0,0},-90,-1,true,10,false,false);
    travel("curve-forward",join(row(66,1,-4,-1,0,0),new int[][]{{0,0,0,66,7}},col(66,0,1,10,0,0)),new double[]{-3.5,0.5,0.5,0.3,0},-45,1,true,60,false,false);
    travel("slope-forward",join(row(66,1,-4,-1,0,0),new int[][]{{0,0,0,66,2}},row(1,0,1,10,0,0),row(66,1,1,10,1,0)),new double[]{-3.5,0.5,0.5,0.3,0},-90,1,true,70,false,false);
    travel("ridden-collision",straight,new double[]{0.5,0.5,0.5,0.3,0},-90,1,true,60,true,false);
    travel("fall",new int[][]{},new double[]{0.5,8.5,0.5,0,0},0,0,true,35,false,false);
    travel("void",new int[][]{},new double[]{0.5,-63,0.5,0,0},0,0,true,12,false,true);
    travel("dismount-platform",join(row(1,0,-2,2,0,-1),row(1,0,-2,2,0,0),row(1,0,-2,2,0,1),new int[][]{{0,1,0,66,1}}),new double[]{0.5,1.5,0.5,0,0},0,0,true,1,false,false);
    travel("dismount-blocked",new int[][]{{0,0,0,66,1},{-1,1,-1,1},{-1,1,0,1},{1,1,0,1},{1,1,-1,1},{0,1,-1,1}},new double[]{0.5,0.5,0.5,0,0},0,0,true,1,false,false);
    for(int type:new int[]{0,1}) for(int block:new int[]{0,1,66,27,28,157}) for(int meta:new int[]{0,2}) placement(block,meta,type);
  }
}
