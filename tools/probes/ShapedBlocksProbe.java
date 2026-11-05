import java.lang.reflect.*;
import java.lang.reflect.Proxy;
import java.util.*;
import sun.misc.Unsafe;

// Minecraft Java 1.7.10 wood and cobblestone shaped blocks from the unchanged original classes:
// BlockWoodSlab (aoo, ids 126 single and 125 double, BlockSlab alj) with ItemSlab (aeg), BlockFenceGate (ala, id 107),
// BlockTrapDoor (aoe, id 96) and BlockWall (aoi, id 139), plus BlockFence (akz) connection to gates.
// The world is a map-backed ahb double that really dispatches neighbour notifications like World.setBlock does
// (breakBlock, onBlockAdded, the six neighbours with the previous block in x-1, x+1, y-1, y+1, z-1, z+1 order for flag 1;
// setBlockMetadataWithNotify notifies only for flag 1). Redstone is an explicit set of powered cells read by
// isBlockIndirectlyGettingPowered. Drops are real EntityItems. Players are Unsafe-allocated EntityPlayerMP doubles.
public final class ShapedBlocksProbe {
  static Unsafe U;
  static Field field(Class<?> type,String name)throws Exception{for(Class<?> c=type;c!=null;c=c.getSuperclass())try{Field f=c.getDeclaredField(name);f.setAccessible(true);return f;}catch(NoSuchFieldException ignored){}throw new NoSuchFieldException(name);}
  static Unsafe unsafe()throws Exception{Field f=Unsafe.class.getDeclaredField("theUnsafe");f.setAccessible(true);return (Unsafe)f.get(null);}

  static class W extends ahb {
    Map<String,int[]> cells=new HashMap<>(); List<String> writes=new ArrayList<>(); List<String> sounds=new ArrayList<>(); List<String> aux=new ArrayList<>(); List<add> spawned=new ArrayList<>();
    Set<String> power=new HashSet<>();
    W(){super((azc)null,null,(aqo)null,(ahj)null,null);}
    protected apu j(){return null;} protected int p(){return 0;}
    public sa a(int id){return null;}
    static String key(int x,int y,int z){return x+","+y+","+z;}
    int[] cell(int x,int y,int z){int[] c=cells.get(key(x,y,z));return c==null?new int[]{0,0}:c;}
    void put(int x,int y,int z,int id,int meta){cells.put(key(x,y,z),new int[]{id,meta});}
    public aji a(int x,int y,int z){return aji.e(cell(x,y,z)[0]);}
    public int e(int x,int y,int z){return cell(x,y,z)[1];}
    public boolean d(int x,int y,int z,aji b,int meta,int flags){
      aji old=a(x,y,z);int om=e(x,y,z);
      if(old==b&&om==meta)return false;
      writes.add(key(x,y,z)+","+aji.b(b)+","+meta+","+flags);
      if(old!=b)old.a(this,x,y,z,old,om);
      put(x,y,z,aji.b(b),meta);
      if(old!=b)b.b(this,x,y,z);
      if((flags&1)!=0)notifyAround(x,y,z,old);
      return true;
    }
    public boolean f(int x,int y,int z){return d(x,y,z,aji.e(0),0,3);}
    public boolean a(int x,int y,int z,int meta,int flags){
      int[] c=cell(x,y,z);if(c[1]==meta)return false;
      writes.add(key(x,y,z)+","+c[0]+","+meta+","+flags);
      put(x,y,z,c[0],meta);
      if((flags&1)!=0)notifyAround(x,y,z,aji.e(c[0]));
      return true;
    }
    void notifyAround(int x,int y,int z,aji b){
      int[][] o={{-1,0,0},{1,0,0},{0,-1,0},{0,1,0},{0,0,-1},{0,0,1}};
      for(int[] d:o){int nx=x+d[0],ny=y+d[1],nz=z+d[2];if(System.getenv("DBG")!=null)System.err.println("n "+nx+","+ny+","+nz+" "+a(nx,ny,nz).getClass().getName()+" "+aji.b(a(nx,ny,nz)));a(nx,ny,nz).a(this,nx,ny,nz,b);}
    }
    public boolean b(azt box){return true;}
    public boolean a(azt box,sa e){return true;}
    public List a(sa e,azt box){return new ArrayList();}
    public List b(sa e,azt box){return new ArrayList();}
    public List a(Class c,azt box){return new ArrayList();}
    public List a(sa e,azt box,sj s){return new ArrayList();}
    public void g(int x,int y,int z){}
    public void c(int x,int y,int z,aji b){}
    public void d(int x,int y,int z,aji b){notifyAround(x,y,z,b);}
    public void e(int x,int y,int z,aji b){}
    public void a(int x,int y,int z,aji b,int delay){}
    public void c(int t,int x,int y,int z,int d){aux.add("aux "+t+" "+key(x,y,z)+","+d);}
    public void a(yz p,int t,int x,int y,int z,int d){aux.add("aux "+t+" "+key(x,y,z)+","+d);}
    public boolean b(int a,int b,int c,int d,int e,int f){return true;}
    public void a(double x,double y,double z,String s,float v,float p){sounds.add(s);}
    public void a(double x,double y,double z,String s,float v,float p,boolean d){sounds.add(s);}
    public boolean v(int x,int y,int z){return power.contains(key(x,y,z));}
    public aor o(int x,int y,int z){return null;}
    public agy O(){return new agy();}
    public boolean d(sa e){if(e instanceof xk)spawned.add(((xk)e).f());return true;}
  }
  static W world()throws Exception{W w=(W)U.allocateInstance(W.class);w.cells=new HashMap<>();w.writes=new ArrayList<>();w.sounds=new ArrayList<>();w.aux=new ArrayList<>();w.spawned=new ArrayList<>();w.power=new HashSet<>();field(ahb.class,"t").set(w,(aqo)U.allocateInstance(aqq.class));field(ahb.class,"s").set(w,new Random(7));return w;}
  static mw player(float yaw,boolean creative)throws Exception{
    mw p=(mw)U.allocateInstance(mw.class);yw caps=new yw();caps.d=creative;p.bE=caps;p.bm=new yx(p);field(sa.class,"y").setFloat(p,yaw);return p;}
  static adb item(int id){return adb.d(id);}
  static aji block(int id){return aji.e(id);}
  static String q(String s){return "\""+s.replace("\\","\\\\").replace("\"","\\\"")+"\"";}
  static String list(List<String> l){StringBuilder b=new StringBuilder("[");for(int i=0;i<l.size();i++){if(i>0)b.append(',');b.append(q(l.get(i)));}return b.append(']').toString();}
  static String join(List<String> l){return "["+String.join(",",l)+"]";}
  static String num(double d){return d==Math.rint(d)&&Math.abs(d)<1e9?Long.toString((long)d):Double.toString(d);}
  static String stackJson(add s){return s==null?"null":"["+adb.b(s.b())+","+s.b+","+s.k()+"]";}
  static String box(azt b){return b==null?"null":"["+num(b.a)+","+num(b.b)+","+num(b.c)+","+num(b.d)+","+num(b.e)+","+num(b.f)+"]";}
  static String boxLocal(azt b,int x,int y,int z){return b==null?"null":"["+num(b.a-x)+","+num(b.b-y)+","+num(b.c-z)+","+num(b.d-x)+","+num(b.e-y)+","+num(b.f-z)+"]";}
  static String bounds(aji b)throws Exception{
    return "["+num(field(aji.class,"B").getDouble(b))+","+num(field(aji.class,"C").getDouble(b))+","+num(field(aji.class,"D").getDouble(b))+","+num(field(aji.class,"E").getDouble(b))+","+num(field(aji.class,"F").getDouble(b))+","+num(field(aji.class,"G").getDouble(b))+"]";}
  static rg namer(List<String> names){
    return (rg)Proxy.newProxyInstance(rg.class.getClassLoader(),new Class[]{rg.class},(p,m,a)->{
      String n=(String)a[0];names.add(n);
      return Proxy.newProxyInstance(rf.class.getClassLoader(),new Class[]{rf.class},(p2,m2,a2)->{
        if(m2.getName().equals("g"))return n;
        Class<?> r=m2.getReturnType();return r==int.class?0:r==float.class?0F:r==double.class?0D:null;});});}
  static String material(awt m){return m==awt.d?"wood":m==awt.f?"iron":m==awt.s?"glass":m==awt.e?"rock":m==awt.a?"air":"other";}
  static String events(W w){return "{\"writes\":"+list(w.writes)+",\"aux\":"+list(w.aux)+",\"sounds\":"+w.sounds.size()+",\"drops\":"+drops(w)+"}";}
  static String drops(W w){List<String> l=new ArrayList<>();for(add s:w.spawned)l.add(stackJson(s));return join(l);}
  static String cellsJson(W w,int[][] pos){List<String> l=new ArrayList<>();for(int[] p:pos){int[] c=w.cell(p[0],p[1],p[2]);l.add("["+c[0]+","+c[1]+"]");}return join(l);}
  static void fillFloor(W w){for(int x=-4;x<=4;x++)for(int z=-4;z<=4;z++)w.put(x,63,z,1,0);}

  static final double[][] RAYS={{.5,2,.5,.5,-1,.5},{.05,2,.5,.05,-1,.5},{.5,2,.95,.5,-1,.95},{-1,.1,.5,2,.1,.5},{-1,.3,.5,2,.3,.5},{-1,.6,.5,2,.6,.5},{-1,.9,.5,2,.9,.5},{.5,-1,.5,.5,2,.5},{.5,1.2,-1,.5,1.2,2},{-1,1.2,.5,2,1.2,.5},{.5,-1,.1,.5,2,.1},{.1,.1,-1,.1,.1,2},{.5,.1,-1,.5,.1,2},{.9,.1,-1,.9,.1,2},{.5,.9,-1,.5,.9,2},{.1,.9,-1,.1,.9,2},{.9,.9,-1,.9,.9,2}};
  static String rayJson(aji b,W w,int x,int y,int z){
    List<String> out=new ArrayList<>();
    for(double[] r:RAYS){
      azu h=b.a(w,x,y,z,azw.a(x+r[0],y+r[1],z+r[2]),azw.a(x+r[3],y+r[4],z+r[5]));
      out.add(h==null?"null":"["+h.e+","+num(Math.round((h.f.a-x)*1e6)/1e6)+","+num(Math.round((h.f.b-y)*1e6)/1e6)+","+num(Math.round((h.f.c-z)*1e6)/1e6)+"]");
    }
    return join(out);
  }
  static String shape(aji b,W w,int x,int y,int z)throws Exception{
    b.a((ahl)w,x,y,z);
    String bnd=bounds(b);
    List<azt> boxes=new ArrayList<>();b.a(w,x,y,z,azt.a(x-3,y-3,z-3,x+4,y+4,z+4),boxes,(sa)null);
    List<String> col=new ArrayList<>();for(azt a:boxes)col.add(boxLocal(a,x,y,z));
    azt coll=b.a(w,x,y,z),sel=b.g(w,x,y,z);
    return "\"bounds\":"+bnd+",\"collision\":"+join(col)+",\"collisionBox\":"+boxLocal(coll,x,y,z)+",\"selection\":"+boxLocal(sel,x,y,z)+",\"movement\":"+b.b((ahl)w,x,y,z)+",\"rays\":"+rayJson(b,w,x,y,z);
  }

  static final int[] IDS={125,126,96,107,139};
  static float toolSpeed(adb tool,aji b){return tool.a(new add(tool),b);}

  static void props(List<String> out)throws Exception{
    int[] tools={0,268,269,270,271,272,273,274,275,276,277,278,279,256,257,258,359};
    for(int id:IDS){
      aji b=block(id);W w=world();
      List<String> speeds=new ArrayList<>(),harvest=new ArrayList<>();
      for(int t:tools){
        adb it=t==0?null:adb.d(t);
        if(it==null){speeds.add("[0,1]");harvest.add("[0,"+b.o().l()+"]");continue;}
        speeds.add("["+t+","+num(toolSpeed(it,b))+"]");harvest.add("["+t+","+(b.o().l()||it.b(b))+"]");
      }
      adb bi=adb.a(b);
      List<String> sub=new ArrayList<>();
      List<add> stacks=new ArrayList<>();
      if(bi!=null)b.a(bi,b.J(),stacks);
      for(add s:stacks)sub.add(stackJson(s));
      Method sil=null;
      for(Class<?> c=b.getClass();c!=null&&sil==null;c=c.getSuperclass())try{sil=c.getDeclaredMethod("E");}catch(NoSuchMethodException e){}
      sil.setAccessible(true);
      out.add("{\"kind\":\"props\",\"id\":"+id+",\"class\":"+q(b.getClass().getName())+",\"renderType\":"+b.b()+",\"opaque\":"+b.c()+",\"renderNormal\":"+b.d()
        +",\"hardness\":"+num(b.f(w,0,0,0))+",\"explosionResistance\":"+num(b.a((sa)null))+",\"resistanceField\":"+num(field(aji.class,"w").getFloat(b))
        +",\"material\":"+q(material(b.o()))+",\"materialOpaque\":"+b.o().k()+",\"materialSolid\":"+b.o().a()+",\"blocksMovement\":"+b.o().c()+",\"requiresTool\":"+!b.o().l()
        +",\"lightOpacity\":"+field(aji.class,"r").getInt(b)+",\"lightValue\":"+field(aji.class,"t").getInt(b)+",\"useNeighborBrightness\":"+field(aji.class,"u").getBoolean(b)
        +",\"stepSound\":"+q(b.H.b())+",\"stepVolume\":"+num(b.H.c())+",\"stepPitch\":"+num(b.H.d())
        +",\"tab\":"+(b.J()==null?"null":String.valueOf(b.J().a()))+",\"item\":"+(bi==null?-1:adb.b(bi))+",\"itemStack\":"+(bi==null?-1:field(adb.class,"h").getInt(bi))
        +",\"subBlocks\":"+join(sub)+",\"canSilk\":"+sil.invoke(b)+",\"speeds\":"+join(speeds)+",\"harvest\":"+join(harvest)+"}");
    }
  }

  static void metaRows(List<String> out)throws Exception{
    for(int id:IDS){
      aji b=block(id);
      for(int meta=0;meta<16;meta++){
        W w=world();w.put(0,64,0,id,meta);Random r=new Random(1);
        StringBuilder icons=new StringBuilder("[");
        for(int side=0;side<6;side++){if(side>0)icons.append(',');rf ic=b.a(side,meta);icons.append(ic==null?"null":q(ic.g()));}
        icons.append(']');
        adb dropped=b.a(meta,r,0);
        out.add("{\"kind\":\"meta\",\"id\":"+id+",\"meta\":"+meta+",\"icons\":"+icons+","+shape(b,w,0,64,0)
          +",\"damageDropped\":"+b.a(meta)+",\"quantity\":"+b.a(r)+",\"dropItem\":"+(dropped==null?-1:adb.b(dropped))
          +",\"pick\":"+(b.d(w,0,64,0)==null?"null":stackJson(new add(b.d(w,0,64,0),1,b.k(w,0,64,0))))+"}");
      }
    }
  }

  // Slabs: onBlockPlaced and ItemSlab.onItemUse (wooden slab item with damage = wood type).
  static final double[] HIT_Y={0,.25,.5,.5001,.75,1};
  static void slabRows(List<String> out)throws Exception{
    for(int id:new int[]{125,126}){
      aji b=block(id);W w=world();
      for(int meta:new int[]{0,1,2,3,4,5})for(int side=0;side<6;side++)for(double hy:HIT_Y)
        out.add("{\"kind\":\"slabPlaced\",\"id\":"+id+",\"meta\":"+meta+",\"side\":"+side+",\"hy\":"+num(hy)+",\"result\":"+b.a(w,0,0,0,side,0.5F,(float)hy,0.5F,meta)+"}");
    }
    adb slabItem=adb.a(block(126));
    int[] types={0,1,2,3,4,5};
    for(int h:new int[]{0,1,2,3,4,5,6,7}){
      int[][] clicks={{0,64,0,1,5,5},{0,64,0,2,2,3},{0,64,0,2,2,7},{0,64,0,3,2,3},{0,64,0,3,2,7},{0,64,0,4,2,3},{0,64,0,4,2,7},{0,64,0,5,2,3},{0,64,0,5,2,7},{0,66,0,0,5,5}};
      for(int[] c:clicks){
        W w=world();fillFloor(w);w.put(0,64,0,1,0);w.put(0,66,0,1,0);
        mw p=player(0,false);add st=new add(slabItem,3,h);
        float hy=c[4]==2?(c[5]==3?0.25F:0.75F):0.5F;
        out.add("{\"kind\":\"slabUse\",\"scenario\":\"pillar\",\"held\":"+h+",\"click\":["+c[0]+","+c[1]+","+c[2]+"],\"side\":"+c[3]+",\"hy\":"+num(hy)+",\"result\":["+useItem(w,st,p,c[0],c[1],c[2],c[3],0.5F,hy,0.5F)+"]}");
      }
    }
    for(int h:types)for(int t:types)for(int half=0;half<2;half++){
      int[][] clicks={{0,1},{1,1},{2,0},{2,1},{3,0},{3,1},{4,0},{4,1},{5,0},{5,1}};
      for(int[] c:clicks){
        int side=c[0];float hy=side<2?0.5F:(c[1]==0?0.25F:0.75F);
        W w=world();fillFloor(w);w.put(0,64,0,126,t|(half==1?8:0));
        mw p=player(0,false);add st=new add(slabItem,3,h);
        out.add("{\"kind\":\"slabUse\",\"scenario\":\"slab\",\"held\":"+h+",\"existing\":"+(t|(half==1?8:0))+",\"side\":"+side+",\"hy\":"+num(hy)+",\"result\":["+useItem(w,st,p,0,64,0,side,0.5F,hy,0.5F)+"]}");
      }
    }
    for(int h:types)for(int ex:new int[]{0,1,3,5}){
      W w=world();fillFloor(w);w.put(0,64,0,125,ex);mw p=player(0,false);add st=new add(slabItem,3,h);
      out.add("{\"kind\":\"slabUse\",\"scenario\":\"double\",\"held\":"+h+",\"existing\":"+ex+",\"side\":1,\"hy\":0.5,\"result\":["+useItem(w,st,p,0,64,0,1,0.5F,0.5F,0.5F)+"]}");
    }
    // A stone slab (44) or another wooden type next to the click: the adjacent-cell merge only joins the same block and damage.
    for(int h:new int[]{0,2})for(int[] adj:new int[][]{{44,0},{44,2},{126,0},{126,2},{126,8},{126,10}}){
      W w=world();fillFloor(w);w.put(0,64,0,1,0);w.put(0,65,0,adj[0],adj[1]);mw p=player(0,false);add st=new add(slabItem,3,h);
      out.add("{\"kind\":\"slabUse\",\"scenario\":\"adjacent\",\"held\":"+h+",\"existing\":["+adj[0]+","+adj[1]+"],\"side\":1,\"hy\":0.5,\"result\":["+useItem(w,st,p,0,64,0,1,0.5F,0.5F,0.5F)+"]}");
    }
    {W w=world();fillFloor(w);w.put(0,64,0,126,3);mw p=player(0,true);add st=new add(slabItem,1,3);
     out.add("{\"kind\":\"slabUse\",\"scenario\":\"creative\",\"held\":3,\"existing\":3,\"side\":1,\"hy\":0.5,\"result\":["+useItem(w,st,p,0,64,0,1,0.5F,0.5F,0.5F)+"]}");}
  }
  static String useItem(W w,add stack,mw p,int x,int y,int z,int side,float hx,float hy,float hz)throws Exception{
    w.writes.clear();w.sounds.clear();w.aux.clear();w.spawned.clear();
    boolean ok=stack.b().a(stack,p,w,x,y,z,side,hx,hy,hz);
    return ok+","+stack.b+","+list(w.writes)+","+w.sounds.size();
  }

  // Wall (139) and the connection predicates of walls and fences.
  static void connectRows(List<String> out)throws Exception{
    aoi wall=(aoi)block(139);akz fence=(akz)block(85);
    for(int id=0;id<256;id++){
      aji b=block(id);if(b==null)continue;if(id!=0&&b==block(0))continue;
      for(int meta:new int[]{0,8}){
        W w=world();w.put(1,64,0,id,meta);
        out.add("{\"kind\":\"connect\",\"id\":"+id+",\"meta\":"+meta+",\"wall\":"+wall.e((ahl)w,1,64,0)+",\"fence\":"+fence.e((ahl)w,1,64,0)+"}");
      }
    }
    // Gates in every orientation: both connect regardless of facing.
    for(int meta=0;meta<8;meta++){
      W w=world();w.put(1,64,0,107,meta);
      out.add("{\"kind\":\"connectGate\",\"meta\":"+meta+",\"wall\":"+wall.e((ahl)w,1,64,0)+",\"fence\":"+fence.e((ahl)w,1,64,0)+"}");
    }
  }
  static final int[][] ARMS={{0,-1},{0,1},{-1,0},{1,0}}; // north z-1, south z+1, west x-1, east x+1
  static void wallShapes(List<String> out)throws Exception{
    aji b=block(139);
    for(int meta=0;meta<2;meta++)for(int mask=0;mask<16;mask++){
      W w=world();w.put(0,64,0,139,meta);
      for(int i=0;i<4;i++)if((mask>>i&1)!=0)w.put(ARMS[i][0],64,ARMS[i][1],1,0);
      out.add("{\"kind\":\"wallShape\",\"meta\":"+meta+",\"mask\":"+mask+","+shape(b,w,0,64,0)+"}");
    }
    // Mixed neighbours: a gate (closed, open, both axes), a wall, a fence, glass, a stone slab and stairs on the east and north.
    int[][] nbs={{107,0},{107,1},{107,4},{107,5},{139,0},{139,1},{85,0},{20,0},{44,0},{44,8},{53,0},{54,2},{81,0},{86,0},{103,0},{79,0},{8,0}};
    for(int[] nb:nbs){
      for(int dir=0;dir<2;dir++){
        W w=world();w.put(0,64,0,139,0);
        w.put(dir==0?1:0,64,dir==0?0:-1,nb[0],nb[1]);
        out.add("{\"kind\":\"wallShape\",\"meta\":0,\"mask\":-1,\"neighbour\":["+nb[0]+","+nb[1]+"],\"dir\":"+dir+","+shape(b,w,0,64,0)+"}");
      }
    }
    // The block above (a wall cap or air) does not change the bounds but is recorded to prove it.
    for(int up:new int[]{0,1,139,44}){
      W w=world();w.put(0,64,0,139,0);w.put(0,65,0,up,0);w.put(1,64,0,1,0);w.put(-1,64,0,1,0);
      out.add("{\"kind\":\"wallShape\",\"meta\":0,\"mask\":12,\"above\":"+up+","+shape(b,w,0,64,0)+"}");
    }
  }

  // Fence connections to gates and fence collision are probed through BlockFence itself.
  static void fenceRows(List<String> out)throws Exception{
    aji b=block(85);
    for(int mask=0;mask<16;mask++){
      W w=world();w.put(0,64,0,85,0);
      for(int i=0;i<4;i++)if((mask>>i&1)!=0)w.put(ARMS[i][0],64,ARMS[i][1],107,i<2?0:1);
      out.add("{\"kind\":\"fenceGate\",\"mask\":"+mask+","+shape(b,w,0,64,0)+"}");
    }
  }

  // Gate: shapes per meta and orientation, placement from yaw, activation, redstone, support.
  static void gateRows(List<String> out)throws Exception{
    aji b=block(107);adb gi=adb.a(b);
    for(int k=-16;k<=16;k++){
      float yaw=k*22.5f;
      W w=world();fillFloor(w);mw p=player(yaw,false);add st=new add(gi,3,0);
      out.add("{\"kind\":\"gatePlaced\",\"yaw\":"+num(yaw)+",\"result\":["+useItem(w,st,p,0,63,0,1,0.5F,1F,0.5F)+"],\"meta\":"+w.e(0,64,0)+"}");
    }
    for(float yaw:new float[]{44.9f,45.0f,45.1f,134.9f,135.1f,-45.1f,-44.9f,0.01f,89.99f,359.9f,-0.01f}){
      W w=world();fillFloor(w);mw p=player(yaw,false);add st=new add(gi,3,0);
      out.add("{\"kind\":\"gatePlaced\",\"yaw\":"+num(yaw)+",\"result\":["+useItem(w,st,p,0,63,0,1,0.5F,1F,0.5F)+"],\"meta\":"+w.e(0,64,0)+"}");
    }
    // Clicked face: only the top and sides of a stone block; support below the target cell.
    for(int side=0;side<6;side++){
      W w=world();fillFloor(w);w.put(0,64,0,1,0);mw p=player(0,false);add st=new add(gi,3,0);
      out.add("{\"kind\":\"gateSide\",\"side\":"+side+",\"result\":["+useItem(w,st,p,0,64,0,side,0.5F,0.5F,0.5F)+"],\"cells\":"+cellsJson(w,new int[][]{{0,64,0},{0,65,0},{1,64,0},{-1,64,0},{0,64,1},{0,64,-1},{0,63,0}})+"}");
    }
    int[][] below={{0,0},{1,0},{20,0},{18,0},{85,0},{44,0},{44,8},{53,0},{78,0},{79,0},{8,0},{9,0},{12,0},{126,0},{126,8},{96,0},{107,0},{139,0},{102,0},{101,0},{64,0},{54,2},{81,0}};
    for(int[] bm:below){
      W w=world();w.put(0,62,0,1,0);w.put(0,63,0,bm[0],bm[1]);mw p=player(0,false);add st=new add(gi,3,0);
      out.add("{\"kind\":\"gateSupport\",\"below\":["+bm[0]+","+bm[1]+"],\"canPlace\":"+b.c(w,0,64,0)+",\"result\":["+useItem(w,st,p,0,63,0,1,0.5F,1F,0.5F)+"]}");
    }
    int[][] occ={{0,0},{1,0},{8,0},{9,0},{31,1},{37,0},{78,0},{78,3},{20,0},{106,0},{107,0},{139,0}};
    for(int[] bm:occ){
      W w=world();fillFloor(w);w.put(0,64,0,bm[0],bm[1]);mw p=player(0,false);add st=new add(gi,3,0);
      out.add("{\"kind\":\"gateOccupied\",\"block\":["+bm[0]+","+bm[1]+"],\"result\":["+useItem(w,st,p,0,63,0,1,0.5F,1F,0.5F)+"],\"cells\":"+cellsJson(w,new int[][]{{0,64,0},{0,65,0}})+"}");
    }
    // Activation: every metadata with players facing each way.
    for(int meta=0;meta<8;meta++)for(int k=0;k<4;k++){
      float yaw=k*90f;
      W w=world();w.put(0,64,0,107,meta);mw p=player(yaw,false);
      boolean r=b.a(w,0,64,0,(yz)p,1,0.5F,0.5F,0.5F);
      out.add("{\"kind\":\"gateUse\",\"meta\":"+meta+",\"yaw\":"+num(yaw)+",\"result\":"+r+",\"after\":"+w.e(0,64,0)+",\"events\":"+events(w)+"}");
    }
    for(float yaw:new float[]{44.9f,45.1f,134.9f,135.1f,-44.9f,-45.1f,225f,-135.1f,720f,-720f,13f,-170f})for(int meta:new int[]{0,1,2,3}){
      W w=world();w.put(0,64,0,107,meta);mw p=player(yaw,false);
      boolean r=b.a(w,0,64,0,(yz)p,1,0.5F,0.5F,0.5F);
      out.add("{\"kind\":\"gateUse\",\"meta\":"+meta+",\"yaw\":"+num(yaw)+",\"result\":"+r+",\"after\":"+w.e(0,64,0)+",\"events\":"+events(w)+"}");
    }
    // Redstone: neighbour change with and without power, powered/unpowered source block as the changed block.
    int[] changed={1,55,69,76,77,0,107};
    for(int meta=0;meta<8;meta++)for(int pw=0;pw<2;pw++)for(int ch:changed){
      W w=world();w.put(0,64,0,107,meta);if(pw==1)w.power.add(W.key(0,64,0));
      b.a(w,0,64,0,aji.e(ch));
      out.add("{\"kind\":\"gatePower\",\"meta\":"+meta+",\"powered\":"+(pw==1)+",\"changed\":"+ch+",\"after\":"+w.e(0,64,0)+",\"events\":"+events(w)+"}");
    }
    // Support removed: a gate does not pop off.
    for(int[] bm:new int[][]{{0,0},{20,0}}){
      W w=world();w.put(0,63,0,1,0);w.put(0,64,0,107,2);w.d(0,63,0,aji.e(bm[0]),bm[1],3);
      out.add("{\"kind\":\"gateSupportRemoved\",\"below\":["+bm[0]+","+bm[1]+"],\"cells\":"+cellsJson(w,new int[][]{{0,63,0},{0,64,0}})+",\"events\":"+events(w)+"}");
    }
  }

  // Trap door: shapes per meta, placement metadata, support, activation, redstone and pop-off.
  static void trapRows(List<String> out)throws Exception{
    aoe b=(aoe)block(96);adb ti=adb.a(b);
    for(int side=0;side<6;side++)for(double hy:HIT_Y)for(int meta:new int[]{0}){
      W w=world();
      out.add("{\"kind\":\"trapPlaced\",\"side\":"+side+",\"hy\":"+num(hy)+",\"result\":"+b.a(w,0,0,0,side,0.5F,(float)hy,0.5F,meta)+"}");
    }
    // Item placement against every kind of clicked block, every side, three hit heights.
    int[][] clicked={{1,0},{20,0},{18,0},{44,0},{44,8},{126,0},{126,8},{53,0},{53,4},{89,0},{85,0},{139,0},{54,2},{102,0},{79,0},{78,3},{12,0},{3,0},{107,0},{96,0},{125,0},{43,0},{64,0},{81,0},{86,0},{103,0},{8,0},{9,0},{5,0}};
    for(int[] c:clicked)for(int side=0;side<6;side++)for(double hy:new double[]{.25,.75}){
      W w=world();fillFloor(w);w.put(0,64,0,c[0],c[1]);mw p=player(0,false);add st=new add(ti,3,0);
      out.add("{\"kind\":\"trapUse\",\"clicked\":["+c[0]+","+c[1]+"],\"side\":"+side+",\"hy\":"+num(hy)+",\"canPlaceOnSide\":"+b.d(w,0,64,0,side)+",\"result\":["+useItem(w,st,p,0,64,0,side,0.5F,(float)hy,0.5F)+"]}");
    }
    // The support predicate on the cell a trap door would occupy beside a block.
    for(int id=0;id<256;id++){
      aji sb=block(id);if(sb==null)continue;if(id!=0&&sb==block(0))continue;
      for(int meta:new int[]{0,8}){
        W w=world();w.put(1,64,0,id,meta);
        out.add("{\"kind\":\"trapSupport\",\"block\":["+id+","+meta+"],\"canPlaceOnSide\":"+b.d(w,0,64,0,5)+"}");
      }
    }
    // Activation, setOpen, pop-off and redstone for every metadata.
    for(int meta=0;meta<16;meta++){
      W w=world();w.put(0,64,0,96,meta);mw p=player(0,false);
      boolean r=b.a(w,0,64,0,(yz)p,1,0.5F,0.5F,0.5F);
      out.add("{\"kind\":\"trapUseBlock\",\"meta\":"+meta+",\"result\":"+r+",\"after\":"+w.e(0,64,0)+",\"events\":"+events(w)+"}");
      for(int open=0;open<2;open++){
        W w2=world();w2.put(0,64,0,96,meta);b.a(w2,0,64,0,open==1);
        out.add("{\"kind\":\"trapSetOpen\",\"meta\":"+meta+",\"open\":"+(open==1)+",\"after\":"+w2.e(0,64,0)+",\"events\":"+events(w2)+"}");
      }
    }
    // Neighbour changes: support on the attached side present or absent, with and without power.
    int[][] supports={{1,0},{0,0},{20,0},{44,0},{44,8},{53,0},{89,0}};
    int[][] sideOff={{0,0,1},{0,0,-1},{1,0,0},{-1,0,0}}; // meta&3: 0 attached to z+1 side wall (support at z+1)... recorded by the probe, not assumed
    for(int meta:new int[]{0,1,2,3,4,5,8,12})for(int[] sup:supports)for(int pw=0;pw<2;pw++)for(int ch:new int[]{1,55,76}){
      // Place the support at all four horizontal cells, then take the changed block from the cell the trap door's meta names.
      for(int dir=0;dir<4;dir++){
        W w=world();w.put(0,64,0,96,meta);
        // only the cell in direction dir holds the candidate support; the other three are air
        int[] o=sideOff[dir];w.put(o[0],64,o[2],sup[0],sup[1]);
        if(pw==1)w.power.add(W.key(0,64,0));
        b.a(w,0,64,0,aji.e(ch));
        out.add("{\"kind\":\"trapNeighbour\",\"meta\":"+meta+",\"support\":["+sup[0]+","+sup[1]+"],\"dir\":"+dir+",\"powered\":"+(pw==1)+",\"changed\":"+ch+",\"cells\":"+cellsJson(w,new int[][]{{0,64,0}})+",\"events\":"+events(w)+"}");
      }
    }
  }

  static void wallItemRows(List<String> out)throws Exception{
    adb wi=adb.a(block(139));
    for(int dmg:new int[]{0,1,2}){
      W w=world();fillFloor(w);mw p=player(0,false);add st=new add(wi,3,dmg);
      out.add("{\"kind\":\"wallUse\",\"damage\":"+dmg+",\"result\":["+useItem(w,st,p,0,63,0,1,0.5F,1F,0.5F)+"],\"meta\":"+w.e(0,64,0)+"}");
    }
    for(int side=0;side<6;side++){
      W w=world();fillFloor(w);w.put(0,64,0,1,0);mw p=player(0,false);add st=new add(wi,3,1);
      out.add("{\"kind\":\"wallSide\",\"side\":"+side+",\"result\":["+useItem(w,st,p,0,64,0,side,0.5F,0.5F,0.5F)+"]}");
    }
    int[] mets={0,1,2};
    out.add("{\"kind\":\"wallItem\",\"item\":"+adb.b(wi)+",\"names\":"+list(Arrays.asList(aoi.a))+"}");
  }

  // Block breaking: harvest drops for survival and creative (ItemInWorldManager order).
  static void breakRows(List<String> out)throws Exception{
    for(int id:IDS)for(int meta=0;meta<(id==139?3:id==125?8:16);meta++)for(int creative=0;creative<2;creative++){
      aji b=block(id);W w=world();w.put(0,64,0,id,meta);mw p=player(0,creative==1);
      b.a(w,0,64,0,meta,(yz)p);
      boolean flag=w.f(0,64,0);if(flag)b.b(w,0,64,0,meta);
      if(creative==0&&flag)b.b(w,0,64,0,meta,0);
      out.add("{\"kind\":\"break\",\"id\":"+id+",\"meta\":"+meta+",\"creative\":"+(creative==1)+",\"drops\":"+drops(w)+"}");
    }
  }

  static void items(List<String> out)throws Exception{
    List<String> l=new ArrayList<>();
    for(int id:IDS){adb it=adb.a(block(id));l.add("["+id+","+(it==null?-1:adb.b(it))+"]");}
    out.add("{\"kind\":\"items\",\"blockItems\":"+join(l)+"}");
  }

  public static void main(String[] args)throws Exception{
    U=unsafe();aji.p();adb.l();{List<String> names=new ArrayList<>();for(int i=1;i<256;i++){aji bb=aji.e(i);if(bb!=null&&aji.b(bb)==i)bb.a(namer(names));}}
    List<String> out=new ArrayList<>();
    props(out);metaRows(out);slabRows(out);connectRows(out);wallShapes(out);fenceRows(out);gateRows(out);trapRows(out);wallItemRows(out);breakRows(out);items(out);
    for(String s:out)System.out.println(s);
  }
}
