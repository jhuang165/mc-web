import java.lang.reflect.*;
import java.lang.reflect.Proxy;
import java.util.*;
import sun.misc.Unsafe;

// Executes the unchanged 1.7.10 BlockStoneBrick (anw), BlockStoneSlab/BlockSlab (any/alj) with ItemSlab (aeg),
// BlockEndPortalFrame (aku), BlockCauldron (ajw), BlockFlowerPot (ald) and TileEntityFlowerPot (apf) against a
// map-backed World double (no constructor runs) and an Unsafe-allocated EntityPlayerMP double.
public final class StoneUtilityProbe {
  static Unsafe U;
  static Field field(Class<?> type,String name)throws Exception{for(Class<?> c=type;c!=null;c=c.getSuperclass())try{Field f=c.getDeclaredField(name);f.setAccessible(true);return f;}catch(NoSuchFieldException ignored){}throw new NoSuchFieldException(name);}
  static Unsafe unsafe()throws Exception{Field f=Unsafe.class.getDeclaredField("theUnsafe");f.setAccessible(true);return (Unsafe)f.get(null);}

  static class W extends ahb {
    Map<String,int[]> cells=new HashMap<>(); List<String> writes=new ArrayList<>(); List<String> sounds=new ArrayList<>(); List<add> spawned=new ArrayList<>();
    Map<String,aor> tiles=new HashMap<>();
    W(){super((azc)null,null,(aqo)null,(ahj)null,null);}
    protected apu j(){return null;} protected int p(){return 0;}
    public sa a(int id){return null;}
    static String key(int x,int y,int z){return x+","+y+","+z;}
    int[] cell(int x,int y,int z){int[] c=cells.get(key(x,y,z));return c==null?new int[]{0,0}:c;}
    void put(int x,int y,int z,int id,int meta){cells.put(key(x,y,z),new int[]{id,meta});}
    public aji a(int x,int y,int z){return aji.e(cell(x,y,z)[0]);}
    public int e(int x,int y,int z){return cell(x,y,z)[1];}
    public boolean d(int x,int y,int z,aji b,int meta,int flags){put(x,y,z,aji.b(b),meta);writes.add(key(x,y,z)+","+aji.b(b)+","+meta);return true;}
    public boolean f(int x,int y,int z){return d(x,y,z,aji.e(0),0,3);}
    public boolean a(int x,int y,int z,int meta,int flags){put(x,y,z,cell(x,y,z)[0],meta);writes.add(key(x,y,z)+","+cell(x,y,z)[0]+","+meta);return true;}
    public boolean b(azt box){return true;}
    public boolean a(azt box,sa e){return true;}
    public List a(sa e,azt box){return new ArrayList();}
    public List b(sa e,azt box){return new ArrayList();}
    public List a(Class c,azt box){return new ArrayList();}
    public List a(sa e,azt box,sj s){return new ArrayList();}
    public void g(int x,int y,int z){}
    public void c(int x,int y,int z,aji b){}
    public void d(int x,int y,int z,aji b){}
    public void e(int x,int y,int z,aji b){}
    public void a(int x,int y,int z,aji b,int delay){}
    public void c(int t,int x,int y,int z,int d){}
    public boolean b(int a,int b,int c,int d,int e,int f){return true;}
    public void a(double x,double y,double z,String s,float v,float p){sounds.add(s);}
    public void a(double x,double y,double z,String s,float v,float p,boolean d){sounds.add(s);}
    public agy O(){return new agy();}
    public boolean d(sa e){if(e instanceof xk)spawned.add(((xk)e).f());return true;}
    public aor o(int x,int y,int z){return tiles.get(key(x,y,z));}
    public void a(int x,int y,int z,aor t){tiles.put(key(x,y,z),t);}
    public void p(int x,int y,int z){tiles.remove(key(x,y,z));}
  }
  static W world()throws Exception{W w=(W)U.allocateInstance(W.class);w.cells=new HashMap<>();w.writes=new ArrayList<>();w.sounds=new ArrayList<>();w.spawned=new ArrayList<>();w.tiles=new HashMap<>();field(ahb.class,"t").set(w,(aqo)U.allocateInstance(aqq.class));field(ahb.class,"s").set(w,new Random(7));return w;}
  static mw player(float yaw,boolean creative)throws Exception{
    mw p=(mw)U.allocateInstance(mw.class);yw caps=new yw();caps.d=creative;p.bE=caps;p.bm=new yx(p);field(sa.class,"y").setFloat(p,yaw);return p;}
  static adb item(int id){return adb.d(id);}
  static String stackJson(add s){return s==null?"null":"["+adb.b(s.b())+","+s.b+","+s.k()+"]";}
  static String q(String s){return "\""+s+"\"";}
  static String list(List<String> l){StringBuilder b=new StringBuilder("[");for(int i=0;i<l.size();i++){if(i>0)b.append(',');b.append(q(l.get(i)));}return b.append(']').toString();}
  static String num(double d){return d==Math.rint(d)&&Math.abs(d)<1e9?Long.toString((long)d):Double.toString(d);}
  static String box(azt b){return b==null?"null":"["+num(b.a)+","+num(b.b)+","+num(b.c)+","+num(b.d)+","+num(b.e)+","+num(b.f)+"]";}
  static String bounds(aji b)throws Exception{
    return "["+num(field(aji.class,"B").getDouble(b))+","+num(field(aji.class,"C").getDouble(b))+","+num(field(aji.class,"D").getDouble(b))+","+num(field(aji.class,"E").getDouble(b))+","+num(field(aji.class,"F").getDouble(b))+","+num(field(aji.class,"G").getDouble(b))+"]";}
  static rg namer(List<String> names){
    return (rg)Proxy.newProxyInstance(rg.class.getClassLoader(),new Class[]{rg.class},(p,m,a)->{
      String n=(String)a[0];names.add(n);
      return Proxy.newProxyInstance(rf.class.getClassLoader(),new Class[]{rf.class},(p2,m2,a2)->{
        if(m2.getName().equals("g"))return n;
        Class<?> r=m2.getReturnType();return r==int.class?0:r==float.class?0F:r==double.class?0D:null;});});}
  static aji block(int id){return aji.e(id);}

  static String blockProps(int id)throws Exception{
    aji b=block(id);W w=world();
    return "{\"kind\":\"block\",\"id\":"+id+",\"renderType\":"+b.b()+",\"opaque\":"+b.c()+",\"renderNormal\":"+b.d()
      +",\"hardness\":"+num(b.f(w,0,0,0))+",\"resistanceField\":"+num(field(aji.class,"w").getFloat(b))+",\"explosionResistance\":"+num(b.a((sa)null))
      +",\"lightOpacity\":"+field(aji.class,"r").getInt(b)+",\"lightValue\":"+field(aji.class,"t").getInt(b)+",\"useNeighborBrightness\":"+field(aji.class,"u").getBoolean(b)
      +",\"stepSound\":"+q(b.H.b())+",\"stepVolume\":"+num(b.H.c())+",\"stepPitch\":"+num(b.H.d())+",\"hasComparator\":"+b.M()+",\"tickRate\":"+b.a(w)+"}";
  }
  static String metaRow(int id,int meta)throws Exception{
    aji b=block(id);W w=world();w.put(0,0,0,id,meta);Random r=new Random(1);

    StringBuilder icons=new StringBuilder("[");
    for(int side=0;side<6;side++){if(side>0)icons.append(',');rf ic=b.a(side,meta);icons.append(ic==null?"null":q(ic.g()));}
    icons.append(']');
    b.a((ahl)w,0,0,0);
    String bnd=bounds(b);
    List<azt> boxes=new ArrayList<>();azt mask=azt.a(-8,-8,-8,8,8,8);b.a(w,0,0,0,mask,boxes,(sa)null);
    StringBuilder col=new StringBuilder("[");for(int i=0;i<boxes.size();i++){if(i>0)col.append(',');col.append(box(boxes.get(i)));}col.append(']');
    azt coll=b.a(w,0,0,0);azt sel=b.g(w,0,0,0);
    adb dropped=b.a(meta,r,0);
    StringBuilder rays=new StringBuilder("[");
    double[][] rs={{.5,2,.5,.5,-1,.5},{.05,2,.5,.05,-1,.5},{.5,2,.95,.5,-1,.95},{-1,.1,.5,2,.1,.5},{-1,.3,.5,2,.3,.5},{-1,.6,.5,2,.6,.5},{-1,.9,.5,2,.9,.5},{.5,-1,.5,.5,2,.5}};
    for(int i=0;i<rs.length;i++){
      if(i>0)rays.append(',');
      azu hit=b.a(w,0,0,0,azw.a(rs[i][0],rs[i][1],rs[i][2]),azw.a(rs[i][3],rs[i][4],rs[i][5]));
      rays.append(hit==null?"null":"["+hit.e+","+num(hit.f.a)+","+num(hit.f.b)+","+num(hit.f.c)+"]");
    }
    rays.append(']');
    return "{\"kind\":\"meta\",\"id\":"+id+",\"meta\":"+meta+",\"icons\":"+icons+",\"bounds\":"+bnd+",\"collision\":"+col+",\"collisionBox\":"+box(coll)+",\"selection\":"+box(sel)
      +",\"damageDropped\":"+b.a(meta)+",\"quantity\":"+b.a(r)+",\"item\":"+(dropped==null?-1:adb.b(dropped))+",\"pick\":"+stackJson(b.d(w,0,0,0)!=null?new add(b.d(w,0,0,0),1,b.k(w,0,0,0)):null)
      +",\"comparator\":"+b.g(w,0,0,0,0)+",\"rays\":"+rays+"}";
  }

  static final int[] SLAB_META={0,1,3,5};
  static final double[] HIT_Y={0,.25,.5,.5001,.75,1};
  static void slabRows(List<String> out)throws Exception{
    for(int id:new int[]{43,44}){
      aji b=block(id);W w=world();
      for(int meta:SLAB_META)for(int side=0;side<6;side++)for(double hy:HIT_Y)
        out.add("{\"kind\":\"slabPlaced\",\"id\":"+id+",\"meta\":"+meta+",\"side\":"+side+",\"hy\":"+num(hy)+",\"result\":"+b.a(w,0,0,0,side,0.5F,(float)hy,0.5F,meta)+"}");
    }
  }
  static void fillFloor(W w){for(int x=-4;x<=4;x++)for(int z=-4;z<=4;z++)w.put(x,63,z,1,0);}
  static String useItem(W w,add stack,mw p,int x,int y,int z,int side,float hx,float hy,float hz)throws Exception{
    w.writes.clear();w.sounds.clear();
    boolean ok=stack.b().a(stack,p,w,x,y,z,side,hx,hy,hz);
    return ok+","+stack.b+","+list(w.writes)+","+w.sounds.size();
  }
  static void itemSlabRows(List<String> out)throws Exception{
    adb slabItem=adb.a(block(44));
    int[] types={0,1,3,4,5};
    // Floor and pillar clicks: held type H against a pillar at (0,64,0) and a ceiling at (0,66,0).
    for(int h:new int[]{0,1,2,3,4,5,6,7}){
      int[][] clicks={{0,64,0,1,5,5},{0,64,0,2,2,3},{0,64,0,2,2,7},{0,64,0,3,2,3},{0,64,0,3,2,7},{0,64,0,4,2,3},{0,64,0,4,2,7},{0,64,0,5,2,3},{0,64,0,5,2,7},{0,66,0,0,5,5}};
      for(int[] c:clicks){
        W w=world();fillFloor(w);w.put(0,64,0,1,0);w.put(0,66,0,1,0);
        mw p=player(0,false);add st=new add(slabItem,3,h);
        float hy=c[4]==2?(c[5]==3?0.25F:0.75F):0.5F;
        out.add("{\"kind\":\"slabUse\",\"scenario\":\"pillar\",\"held\":"+h+",\"click\":["+c[0]+","+c[1]+","+c[2]+"],\"side\":"+c[3]+",\"hy\":"+num(hy)+",\"result\":["+useItem(w,st,p,c[0],c[1],c[2],c[3],0.5F,hy,0.5F)+"]}");
      }
    }
    // Existing single slab (bottom or top) clicked on every face.
    for(int h:types)for(int t:types)for(int half=0;half<2;half++){
      int[][] clicks={{0,1},{1,1},{2,0},{2,1},{3,0},{3,1},{4,0},{4,1},{5,0},{5,1}};
      for(int[] c:clicks){
        int side=c[0];float hy=side<2?0.5F:(c[1]==0?0.25F:0.75F);
        W w=world();fillFloor(w);w.put(0,64,0,44,t|(half==1?8:0));
        mw p=player(0,false);add st=new add(slabItem,3,h);
        out.add("{\"kind\":\"slabUse\",\"scenario\":\"slab\",\"held\":"+h+",\"existing\":"+(t|(half==1?8:0))+",\"side\":"+side+",\"hy\":"+num(hy)+",\"result\":["+useItem(w,st,p,0,64,0,side,0.5F,hy,0.5F)+"]}");
      }
    }
    for(int h:types)for(int ex:new int[]{0,1,3,8,9}){
      W w=world();fillFloor(w);w.put(0,64,0,43,ex);mw p=player(0,false);add st=new add(slabItem,3,h);
      out.add("{\"kind\":\"slabUse\",\"scenario\":\"double\",\"held\":"+h+",\"existing\":"+ex+",\"side\":1,\"hy\":0.5,\"result\":["+useItem(w,st,p,0,64,0,1,0.5F,0.5F,0.5F)+"]}");
    }
    // Creative: no stack consumed by the world hooks (stack handling is the caller's), editing allowed.
    {W w=world();fillFloor(w);w.put(0,64,0,44,3);mw p=player(0,true);add st=new add(slabItem,1,3);
     out.add("{\"kind\":\"slabUse\",\"scenario\":\"creative\",\"held\":3,\"existing\":3,\"side\":1,\"hy\":0.5,\"result\":["+useItem(w,st,p,0,64,0,1,0.5F,0.5F,0.5F)+"]}");}
  }
  static void blockItemRows(List<String> out)throws Exception{
    for(int id:new int[]{98,120,118,140}){
      adb it=id==118?item(380):id==140?item(390):adb.a(block(id));
      for(int dmg:(id==98?new int[]{0,1,2,3}:new int[]{0})){
        W w=world();fillFloor(w);mw p=player(0,false);add st=new add(it,1,dmg);
        out.add("{\"kind\":\"blockItem\",\"id\":"+id+",\"damage\":"+dmg+",\"itemId\":"+adb.b(it)+",\"result\":["+useItem(w,st,p,0,63,0,1,0.5F,0.5F,0.5F)+"]}");
      }
    }
    for(int yaw=-720;yaw<=720;yaw+=15){
      W w=world();fillFloor(w);mw p=player(yaw,false);add st=new add(adb.a(block(120)),1,0);
      out.add("{\"kind\":\"endFramePlaced\",\"yaw\":"+yaw+",\"result\":["+useItem(w,st,p,0,63,0,1,0.5F,0.5F,0.5F)+"],\"meta\":"+w.e(0,64,0)+"}");
    }
    for(int side=0;side<6;side++){
      W w=world();fillFloor(w);w.put(0,64,0,1,0);mw p=player(0,false);add st=new add(item(380),1,0);
      out.add("{\"kind\":\"cauldronPlaced\",\"side\":"+side+",\"result\":["+useItem(w,st,p,0,64,0,side,0.5F,0.5F,0.5F)+"]}");
    }
  }
  static void cauldronRows(List<String> out)throws Exception{
    aji b=block(118);
    int[] held={-1,325,326,327,280,374};
    for(int h:held)for(int creative=0;creative<2;creative++)for(int level=0;level<4;level++){
      W w=world();w.put(0,64,0,118,level);mw p=player(0,creative==1);
      if(h>=0)p.bm.a[p.bm.c]=new add(item(h),1,0);
      String err="";boolean ret=false;
      try{ret=b.a(w,0,64,0,p,1,0.5F,0.5F,0.5F);}catch(Throwable t){err=t.getClass().getSimpleName();}
      out.add("{\"kind\":\"cauldronUse\",\"held\":"+h+",\"creative\":"+creative+",\"level\":"+level+",\"ret\":"+ret+",\"meta\":"+w.e(0,64,0)+",\"slot\":"+stackJson(p.bm.a[p.bm.c])+",\"spawned\":"+w.spawned.size()+",\"error\":"+q(err)+"}");
    }
    for(int level=0;level<4;level++)for(int burning=0;burning<2;burning++)for(double dy:new double[]{0,.3,.375,.4,.5,.6,.7,.9,1.0}){
      W w=world();w.put(0,64,0,118,level);mw e=player(0,false);
      field(sa.class,"o").set(e,w);field(sa.class,"e").setInt(e,burning==1?100:0);
      field(sa.class,"C").set(e,azt.a(0.2,64+dy,0.2,0.8,64+dy+1.8,0.8));
      b.a(w,0,64,0,(sa)e);
      out.add("{\"kind\":\"cauldronEntity\",\"level\":"+level+",\"burning\":"+burning+",\"dy\":"+num(dy)+",\"meta\":"+w.e(0,64,0)+",\"fire\":"+field(sa.class,"e").getInt(e)+"}");
    }
    for(int level=0;level<4;level++)for(int seed=0;seed<40;seed++){
      W w=world();w.put(0,64,0,118,level);field(ahb.class,"s").set(w,new Random(seed));
      b.l(w,0,64,0);
      out.add("{\"kind\":\"cauldronRain\",\"level\":"+level+",\"seed\":"+seed+",\"meta\":"+w.e(0,64,0)+"}");
    }
  }
  static void potRows(List<String> out)throws Exception{
    ald b=(ald)block(140);
    for(int meta=0;meta<16;meta++){
      aor t=b.a((ahb)world(),meta);
      String item="null";
      if(t instanceof apf){apf a=(apf)t;adb i=a.a();item="["+(i==null?-1:adb.b(i))+","+a.b()+"]";}
      out.add("{\"kind\":\"potTile\",\"meta\":"+meta+",\"tile\":"+item+"}");
    }
    int[][] helds={{-1,0},{37,0},{38,0},{38,1},{38,2},{38,3},{38,4},{38,5},{38,6},{38,7},{38,8},{6,0},{6,1},{6,2},{6,3},{6,4},{6,5},{39,0},{40,0},{81,0},{32,0},{31,0},{31,1},{31,2},{2,0},{1,0},{280,0},{106,0},{175,0},{175,2},{86,0},{18,0},{18,1},{20,0},{54,0}};
    for(int[] h:helds)for(int creative=0;creative<2;creative++)for(int pre:new int[]{0,7}){
      W w=world();w.put(0,64,0,140,pre);mw p=player(0,creative==1);
      aor t=b.a(w,pre);if(t!=null)w.tiles.put("0,64,0",t);
      if(h[0]>=0)p.bm.a[p.bm.c]=new add(item(h[0]),2,h[1]);
      boolean ret=b.a(w,0,64,0,p,1,0.5F,0.5F,0.5F);
      apf a=(apf)w.tiles.get("0,64,0");adb i=a==null?null:a.a();
      out.add("{\"kind\":\"potUse\",\"held\":["+h[0]+","+h[1]+"],\"creative\":"+creative+",\"pre\":"+pre+",\"ret\":"+ret+",\"meta\":"+w.e(0,64,0)+",\"tile\":["+(i==null?-1:adb.b(i))+","+(a==null?0:a.b())+"],\"slot\":"+stackJson(p.bm.a[p.bm.c])+"}");
    }
    {
      W w=world();w.put(0,64,0,140,0);mw p=player(0,false);
      w.tiles.put("0,64,0",b.a(w,0));
      p.bm.a[p.bm.c]=new add(item(37),2,0);
      boolean first=b.a(w,0,64,0,p,1,0.5F,0.5F,0.5F);
      p.bm.a[p.bm.c]=new add(item(38),2,0);
      boolean second=b.a(w,0,64,0,p,1,0.5F,0.5F,0.5F);
      apf a=(apf)w.tiles.get("0,64,0");
      out.add("{\"kind\":\"potTwice\",\"first\":"+first+",\"second\":"+second+",\"meta\":"+w.e(0,64,0)+",\"tile\":["+adb.b(a.a())+","+a.b()+"],\"slot\":"+stackJson(p.bm.a[p.bm.c])+"}");
    }
    for(int meta:new int[]{0,1,2,3,7,9,10,11,13}){
      for(int creative=0;creative<2;creative++){
        W w=world();w.put(0,64,0,140,meta);mw p=player(0,creative==1);
        aor t=b.a(w,meta);if(t!=null)w.tiles.put("0,64,0",t);
        if(creative==1)b.a(w,0,64,0,meta,p);
        b.a(w,0,64,0,block(140),meta);
        List<String> drops=new ArrayList<>();for(add s:w.spawned)drops.add(stackJson(s));
        w.spawned.clear();b.a(w,0,64,0,meta,1.0F,0);
        List<String> harvest=new ArrayList<>();for(add s:w.spawned)harvest.add(stackJson(s));
        adb dropItem=b.a(meta,new Random(1),0);
        out.add("{\"kind\":\"potDrops\",\"meta\":"+meta+",\"creative\":"+creative+",\"breakDrops\":"+list(drops)+",\"harvest\":"+list(harvest)+",\"item\":"+adb.b(dropItem)+"}");
      }
    }
    for(int meta:new int[]{0,7}){W w=world();aor t=b.a(w,meta);if(t!=null)w.tiles.put("0,64,0",t);w.put(0,64,0,140,meta);
      apf a=(apf)w.tiles.get("0,64,0");
      out.add("{\"kind\":\"potPick\",\"meta\":"+meta+",\"pick\":"+stackJson(new add(b.d(w,0,64,0),1,b.k(w,0,64,0)))+",\"damage\":"+b.k(w,0,64,0)+"}");}
  }
  public static void main(String[] args)throws Exception{
    U=unsafe();aji.p();adb.l();{List<String> names=new ArrayList<>();for(int i=1;i<256;i++){aji bb=aji.e(i);if(bb!=null&&aji.b(bb)==i)bb.a(namer(names));}}
    List<String> out=new ArrayList<>();
    for(int id:new int[]{98,43,44,120,118,140})out.add(blockProps(id));
    for(int id:new int[]{98,43,44,120,118,140})for(int m=0;m<16;m++)out.add(metaRow(id,m));
    slabRows(out);itemSlabRows(out);blockItemRows(out);cauldronRows(out);potRows(out);
    out.add("{\"kind\":\"items\",\"stoneBrick\":"+adb.b(adb.a(block(98)))+",\"slab\":"+adb.b(adb.a(block(44)))+",\"endFrame\":"+adb.b(adb.a(block(120)))+",\"cauldron\":"+adb.b(item(380))+",\"flowerPot\":"+adb.b(item(390))+",\"doubleSlab\":"+(adb.a(block(43))==null?-1:adb.b(adb.a(block(43))))+"}");
    for(String s:out)System.out.println(s);
  }
}
