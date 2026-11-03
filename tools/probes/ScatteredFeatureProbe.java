import java.lang.reflect.*;
import java.security.MessageDigest;
import java.util.*;

// Unchanged 1.7.10 MapGenScatteredFeature/Start (atx/aty), ComponentScatteredFeaturePieces Feature (aue),
// DesertPyramid (aub), JunglePyramid (auc) + Stones (aud) and SwampHut (auf), with MapGenBase/MapGenStructure
// (aqx/ave), StructureStart (avm), StructureComponent (avk), StructureBoundingBox (asv), WeightedRandomChestContent
// (qx), the level-30 enchanted book and the real EntityWitch (yp). The World is an explicit block-access double:
// synthetic fixtures with a native-faithful World.func_72825_h; chests (aow) and dispensers (apb) are the real
// tile classes. MapGenStructureData persistence is stubbed (loadItemData null, setItemData ignored).
public class ScatteredFeatureProbe {
  static String jstr(String s){return TerrainProbe.q(s);}
  static String key(int x,int y,int z){return x+","+y+","+z;}
  static String stack(add s){
    if(s==null)return "null";
    StringBuilder e=new StringBuilder("[");dq tags=ade.bR.g(s);
    for(int i=0;i<tags.c();i++){if(i>0)e.append(',');dh t=tags.b(i);e.append('[').append(t.e("id")).append(',').append(t.e("lvl")).append(']');}
    return "["+adb.b(s.b())+","+s.b+","+s.k()+","+e+"]]";
  }
  static void put(MessageDigest d,int... a){for(int v:a)for(int s=0;s<32;s+=8)d.update((byte)(v>>s));}
  static int hash2(int x,int z){return (x*73856093)^(z*83492791);}
  static int hash3(int x,int y,int z){return (x*73856093)^(y*19349663)^(z*83492791);}
  // Synthetic fixtures, mirrored in src/scattered-feature-generator.test.js.
  static int fixture(String f,int x,int y,int z){
    if(f.equals("air")||y<0||y>255)return 0;
    if(f.equals("stone"))return y>63?0:1;
    if(f.equals("water"))return y<=50?1:y<=62?9:0;
    // hills: terrain 56..71, sand below sea level 62 with water, grass above, trees (log+leaves) and tall grass.
    int h=54+(hash2(x>>2,z>>2)&31);
    if(y<h-3)return 1;if(y<h)return 3;if(y==h)return h<62?12:2;
    if(h<62)return y<=62?9:0;
    int col=Math.floorMod(hash2(x*3+1,z*5+2),11);
    if(col==0&&y<=h+3)return y<=h+2?17:18;
    if(col==1&&y==h+1)return 31;
    return 0;
  }
  static class Chest extends aow {
    List<String> calls=new ArrayList<>();
    public void a(int slot,add s){calls.add("["+slot+","+stack(s)+"]");super.a(slot,s);}
    public void e(){}
  }
  static class Disp extends apb {
    List<String> calls=new ArrayList<>();
    public void a(int slot,add s){calls.add("["+slot+","+stack(s)+"]");super.a(slot,s);}
    public void e(){}
  }
  static class W extends TerrainProbe.W {
    String fixture;Map<String,aji[]> chunks;Map<String,aji> edits=new HashMap<>();Map<String,aor> tiles=new LinkedHashMap<>();
    MessageDigest calls,writes;int callCount,writeCount;StringBuilder fullWrites;List<String> entities=new ArrayList<>();ahu forced;
    void call(int... a){callCount++;put(calls,a);}
    aji raw(int bx,int by,int bz){
      if(by<0||by>=256||bx< -30000000||bx>=30000000||bz< -30000000||bz>=30000000)return aji.e(0);
      aji edit=edits.get(key(bx,by,bz));if(edit!=null)return edit;
      if(fixture.equals("natural")){aji[] c=chunks.get((bx>>4)+","+(bz>>4));if(c==null)throw new AssertionError("Missing chunk "+(bx>>4)+","+(bz>>4));aji b=c[((bx&15)*16+(bz&15))*256+by];return b==null?aji.e(0):b;}
      return aji.e(fixture(fixture,bx,by,bz));
    }
    public aji a(int bx,int by,int bz){call(0,bx,by,bz);return raw(bx,by,bz);}
    public boolean c(int x,int y,int z){call(1,x,y,z);return a(x,y,z).o()==awt.a;}
    public boolean d(int x,int y,int z,aji b,int meta,int flags){call(2,x,y,z,aji.b(b),meta,flags);if(y<0||y>=256||x< -30000000||x>=30000000||z< -30000000||z>=30000000)return false;
      String k=key(x,y,z);edits.put(k,b);writeCount++;put(writes,x,y,z,aji.b(b),meta,flags);
      if(fullWrites!=null){if(fullWrites.length()>1)fullWrites.append(',');fullWrites.append('[').append(x).append(',').append(y).append(',').append(z).append(',').append(aji.b(b)).append(',').append(meta).append(',').append(flags).append(']');}
      tiles.remove(k);if(b==ajn.ae)tiles.put(k,new Chest());if(b==ajn.z)tiles.put(k,new Disp());return true;
    }
    public ahu a(int x,int z){return forced!=null?forced:manager.a(x,z);}
    public aor o(int x,int y,int z){call(4,x,y,z);return tiles.get(key(x,y,z));}
    // World.func_72825_h as native: scan down while k > 0 for a movement-blocking non-leaf block. The start
    // height (topFilledSegment+15 natively) cannot change the result, so the scan starts at 255.
    public int i(int x,int z){
      call(6,x,z);
      for(int k=255;k>0;k--){aji b=raw(x,k,z);if(b.o().c()&&b.o()!=awt.j)return k+1;}
      return -1;
    }
    public boolean d(sa e){
      call(5,(int)Math.floor(e.s),(int)Math.floor(e.t),(int)Math.floor(e.u));
      if(!(e instanceof yp))throw new AssertionError(e.getClass().getName());
      entities.add("["+jstr("Witch")+","+e.s+","+e.t+","+e.u+","+e.y+","+e.z+"]");return true;
    }
    public ayl a(Class c,String n){return null;}
    public void a(String n,ayl d){}
    String tileList(){StringBuilder s=new StringBuilder("[");
      for(Map.Entry<String,aor> en:tiles.entrySet()){if(s.length()>1)s.append(',');s.append('[').append(jstr(en.getKey())).append(',');
        boolean chest=en.getValue() instanceof Chest;List<String> cl=chest?((Chest)en.getValue()).calls:((Disp)en.getValue()).calls;int n=chest?27:9;
        s.append(jstr(chest?"chest":"dispenser")).append(",[");
        for(int i=0;i<n;i++){if(i>0)s.append(',');s.append(stack(chest?((Chest)en.getValue()).a(i):((Disp)en.getValue()).a(i)));}
        s.append("],[").append(String.join(",",cl)).append(']').append(']');}
      return s.append(']').toString();}
  }
  static W world(long seed,String fixture,boolean flat,ahu forced)throws Exception{
    W w=(W)TerrainProbe.unsafe.allocateInstance(W.class);w.seed=seed;w.fixture=fixture;w.forced=forced;w.edits=new HashMap<>();w.tiles=new LinkedHashMap<>();w.entities=new ArrayList<>();
    w.calls=MessageDigest.getInstance("SHA-1");w.writes=MessageDigest.getInstance("SHA-1");
    Object provider=TerrainProbe.unsafe.allocateInstance(aqq.class);if(flat)TerrainProbe.field(aqo.class,"c").set(provider,ahm.c);
    TerrainProbe.field(ahb.class,"t").set(w,provider);
    for(Field f:ahb.class.getDeclaredFields())if(f.getType()==List.class&&!Modifier.isStatic(f.getModifiers())){f.setAccessible(true);f.set(w,new ArrayList<>());}
    TerrainProbe.set(w,"s",new Random(0));
    w.manager=new aib(seed,ahm.b);w.info=(ays)TerrainProbe.unsafe.allocateInstance(ays.class);TerrainProbe.set(w.info,"a",seed);
    for(Field f:ays.class.getDeclaredFields())if(f.getType()==ahm.class){f.setAccessible(true);f.set(w.info,ahm.b);}
    return w;
  }
  static String bb(asv b){return "["+b.a+","+b.b+","+b.c+","+b.d+","+b.e+","+b.f+"]";}
  static String type(avk p){return p instanceof aub?"TeDP":p instanceof auc?"TeJP":p instanceof auf?"TeSH":null;}
  static String bools(boolean... v){StringBuilder s=new StringBuilder("[");for(int i=0;i<v.length;i++){if(i>0)s.append(',');s.append(v[i]);}return s.append(']').toString();}
  // Same text as JSON.stringify of the JS piece describe().
  static String piece(avk p)throws Exception{
    String type=type(p);if(type==null)throw new AssertionError(p.getClass().getName());
    asv b=p.c();StringBuilder s=new StringBuilder("[");
    s.append(jstr(type)).append(',').append(p.g).append(',').append(p.h).append(',').append(b.a).append(',').append(b.b).append(',').append(b.c).append(',').append(b.d).append(',').append(b.e).append(',').append(b.f);
    for(String n:new String[]{"a","b","c","d"})s.append(',').append(TerrainProbe.get(p,n));
    s.append(',');
    if(p instanceof aub){boolean[] f=(boolean[])TerrainProbe.get(p,"e");s.append(bools(f[0],f[1],f[2],f[3]));}
    else if(p instanceof auc)s.append(bools((Boolean)TerrainProbe.get(p,"e"),(Boolean)TerrainProbe.get(p,"i"),(Boolean)TerrainProbe.get(p,"j"),(Boolean)TerrainProbe.get(p,"k")));
    else s.append(bools((Boolean)TerrainProbe.get(p,"e")));
    return s.append(']').toString();
  }
  static String pieces(avm st)throws Exception{StringBuilder s=new StringBuilder("[");for(Object o:st.b()){if(s.length()>1)s.append(',');s.append(piece((avk)o));}return s.append(']').toString();}
  static Map<Object,Object> map(ave m)throws Exception{return (Map<Object,Object>)TerrainProbe.field(ave.class,"d").get(m);}
  static Random rand(aqx m)throws Exception{return (Random)TerrainProbe.field(aqx.class,"b").get(m);}
  static long populationSeed(long seed,int cx,int cz){Random r=new Random(seed);long a=r.nextLong()/2L*2L+1L,b=r.nextLong()/2L*2L+1L;return (long)cx*a+(long)cz*b^seed;}
  static Object startKey(int x,int z){return ((long)x&0xffffffffL)|(((long)z&0xffffffffL)<<32);}
  static String startList(ave m)throws Exception{
    StringBuilder s=new StringBuilder("[");
    for(Object o:map(m).values()){avm st=(avm)o;if(s.length()>1)s.append(',');
      s.append("{\"chunk\":[").append(st.e()).append(',').append(st.f()).append("],\"bb\":").append(bb(st.a())).append(",\"pieces\":").append(pieces(st)).append('}');}
    return s.append(']').toString();
  }

  // 1. Start biome choice: every BiomeGenBase registry slot, several seeds and chunk positions.
  static void startChoice()throws Exception{
    ahu[] biomes=ahu.n();StringBuilder rows=new StringBuilder("[");
    for(long seed:new long[]{0,8675309,-123456789})for(int[] c:new int[][]{{0,0},{5,-9},{-13,22},{1874990,-1874990},{3,3},{-1,-1},{7,-4},{-9,15},{21,-30},{100,-100},{-64,64},{2,11}})
      for(int slot=0;slot<biomes.length;slot++){
        if(biomes[slot]==null)continue;
        W w=world(seed,"air",false,biomes[slot]);long rs=(seed*31+c[0]*7+c[1])*0x9E3779B97F4A7C15L+slot*0xBF58476D1CE4E5B9L;Random r=new Random(rs);
        aty st=new aty(w,r,c[0],c[1]);if(rows.length()>1)rows.append(',');
        rows.append('[').append(slot).append(',').append(c[0]).append(',').append(c[1]).append(',').append(jstr(""+seed)).append(',').append(pieces(st)).append(',').append(bb(st.a())).append(',').append(jstr(""+r.nextLong())).append(',').append(jstr(""+rs)).append(']');
      }
    System.out.println("{\"kind\":\"startChoice\",\"rows\":"+rows+"]}");
  }
  // 2. MapGenBase driver over native world biomes and the real temple predicate, plus func_143030_a queries.
  static void starts(long seed,String label,int[][] centers)throws Exception{
    W w=world(seed,"stone",false,null);atx m=new atx();StringBuilder after=new StringBuilder("["),cs=new StringBuilder("[");
    for(int[] c:centers){m.a((apu)null,w,c[0],c[1],(aji[])null);if(after.length()>1)after.append(',');after.append(jstr(""+rand(m).nextLong()));if(cs.length()>1)cs.append(',');cs.append('[').append(c[0]).append(',').append(c[1]).append(']');}
    StringBuilder keys=new StringBuilder("["),queries=new StringBuilder("[");Random q=new Random(seed^0x5eed);int hits=0,total=0;
    for(Object o:map(m).values()){avm st=(avm)o;if(keys.length()>1)keys.append(',');keys.append('[').append(st.e()).append(',').append(st.f()).append(']');
      asv b=((avk)st.b().getFirst()).c();int mx=(b.a+b.d)/2,my=(b.b+b.e)/2,mz=(b.c+b.f)/2;
      List<int[]> pts=new ArrayList<>(Arrays.asList(new int[]{mx,my,mz},new int[]{b.a,b.b,b.c},new int[]{b.d,b.e,b.f},new int[]{b.a-1,my,mz},new int[]{mx,b.e+1,mz},new int[]{mx,b.b-1,mz},new int[]{b.d+1,my,b.f}));
      for(int i=0;i<12;i++)pts.add(new int[]{b.a-4+q.nextInt(b.d-b.a+9),b.b-3+q.nextInt(b.e-b.b+7),b.c-4+q.nextInt(b.f-b.c+9)});
      for(int[] p:pts){boolean r=m.a(p[0],p[1],p[2]);total++;if(r)hits++;if(queries.length()>1)queries.append(',');queries.append('[').append(p[0]).append(',').append(p[1]).append(',').append(p[2]).append(',').append(r).append(']');}}
    System.out.println("{\"kind\":\"starts\",\"label\":"+jstr(label)+",\"worldSeed\":"+jstr(""+seed)+",\"centers\":"+cs+"],\"randomAfter\":"+after+"],\"keys\":"+keys+"],\"starts\":"+startList(m)+",\"swampQueries\":"+queries+"]}");
  }
  static int[][] coverage(asv b){List<int[]> l=new ArrayList<>();
    for(int cx=Math.floorDiv(b.a-23+15,16);cx<=Math.floorDiv(b.d-8,16);cx++)for(int cz=Math.floorDiv(b.c-23+15,16);cz<=Math.floorDiv(b.f-8,16);cz++)l.add(new int[]{cx,cz});
    return l.toArray(new int[0][]);}
  static ahu biomeFor(String kind)throws Exception{ahu[] b=ahu.n();return b[kind.equals("TeJP")?21:kind.equals("TeSH")?6:2];}
  // First Random seed >= base whose start has the wanted piece orientation.
  static long findSeed(String kind,int mode,long base,int cx,int cz)throws Exception{
    W w=world(0,"air",false,biomeFor(kind));
    for(long s=base;;s++){avm st=new aty(w,new Random(s),cx,cz);if(((avk)st.b().getFirst()).g==mode)return s;}
  }
  // 3. Population by MapGenStructure.generateStructuresInChunk, injecting a forced-biome start.
  static void populate(long seed,String fixture,boolean flat,String kind,int mode,int cx,int cz,int fullLimit,int[] counter)throws Exception{
    long startSeed=findSeed(kind,mode,seed*13+cx,cx,cz);
    W w=world(seed,fixture,flat,biomeFor(kind));avm st=new aty(w,new Random(startSeed),cx,cz);
    atx m=new atx();m.a((apu)null,w,cx+500,cz+500,(aji[])null);map(m).clear();map(m).put(startKey(cx,cz),st);
    String initial=pieces(st);String startBox=bb(st.a());StringBuilder rows=new StringBuilder("[");
    for(int[] c:coverage(st.a())){
      w.calls=MessageDigest.getInstance("SHA-1");w.writes=MessageDigest.getInstance("SHA-1");w.callCount=0;w.writeCount=0;w.entities=new ArrayList<>();w.fullWrites=counter[0]<fullLimit?new StringBuilder("["):null;
      Random r=new Random(populationSeed(seed,c[0],c[1]));boolean ok=m.a(w,r,c[0],c[1]);
      if(rows.length()>1)rows.append(',');
      rows.append("{\"chunk\":[").append(c[0]).append(',').append(c[1]).append("],\"result\":").append(ok).append(",\"writeCount\":").append(w.writeCount).append(",\"writesSha1\":").append(jstr(TerrainProbe.hex(w.writes.digest())))
        .append(",\"callCount\":").append(w.callCount).append(",\"callsSha1\":").append(jstr(TerrainProbe.hex(w.calls.digest()))).append(",\"entities\":[").append(String.join(",",w.entities)).append("],\"pieces\":").append(pieces(st)).append(",\"nextLong\":").append(jstr(""+r.nextLong()));
      if(w.fullWrites!=null&&w.writeCount>0){counter[0]++;rows.append(",\"writes\":").append(w.fullWrites).append(']');}
      rows.append('}');
    }
    System.out.println("{\"kind\":\"populate\",\"worldSeed\":"+jstr(""+seed)+",\"fixture\":"+jstr(fixture)+",\"flat\":"+flat+",\"type\":"+jstr(kind)+",\"mode\":"+mode+",\"chunk\":["+cx+","+cz+"],\"startSeed\":"+jstr(""+startSeed)+",\"initial\":"+initial+",\"startBox\":"+startBox+",\"chunks\":"+rows+"],\"tiles\":"+w.tileList()+"}");
  }
  // 4. Direct piece calls over arbitrary (partial, thin, Y-limited) boxes sharing one RNG stream and the once-only flags.
  static void partial(long seed,String fixture,String kind,int mode,int cx,int cz)throws Exception{
    long startSeed=findSeed(kind,mode,seed*17+cz,cx,cz);
    W w=world(seed,fixture,false,biomeFor(kind));avm st=new aty(w,new Random(startSeed),cx,cz);avk p=(avk)st.b().getFirst();
    asv pb=p.c();String initial=pieces(st);Random box=new Random(seed*101+mode),r=new Random(seed*7+mode);StringBuilder rows=new StringBuilder("[");
    List<asv> boxes=new ArrayList<>();
    boxes.add(new asv(pb.a,pb.b,pb.c,pb.d,200,pb.f).b==0?null:new asv(pb.a,pb.b,pb.c,pb.d,200,pb.f)); // placeholder replaced below
    boxes.clear();
    asv noGround=new asv(pb.a-1,70,pb.c-1,pb.d+1,300,pb.f+1);boxes.add(noGround); // excludes Y 64: feature pieces fail without adjusting
    for(int i=0;i<9;i++){
      int x0=pb.a-2+box.nextInt(pb.d-pb.a+5),z0=pb.c-2+box.nextInt(pb.f-pb.c+5);
      int x1=x0+box.nextInt(9),z1=z0+box.nextInt(9);
      int y0=pb.b-6+box.nextInt(12),y1=y0+1+box.nextInt(30);
      if(i%3==0){y0=1;y1=512;}
      asv b=new asv(x0,z0,x1,z1);b.b=y0;b.e=y1;boxes.add(b);
    }
    boxes.add(new asv(pb.a-16,1,pb.c-16,pb.d+16,512,pb.f+16));
    for(asv b:boxes){
      w.calls=MessageDigest.getInstance("SHA-1");w.writes=MessageDigest.getInstance("SHA-1");w.callCount=0;w.writeCount=0;w.entities=new ArrayList<>();
      boolean ok=p.a(w,r,b);
      if(rows.length()>1)rows.append(',');
      rows.append("{\"bb\":").append(bb(b)).append(",\"result\":").append(ok).append(",\"writeCount\":").append(w.writeCount).append(",\"writesSha1\":").append(jstr(TerrainProbe.hex(w.writes.digest())))
        .append(",\"callCount\":").append(w.callCount).append(",\"callsSha1\":").append(jstr(TerrainProbe.hex(w.calls.digest()))).append(",\"entities\":[").append(String.join(",",w.entities)).append("],\"piece\":").append(piece(p)).append('}');
    }
    System.out.println("{\"kind\":\"pieces\",\"worldSeed\":"+jstr(""+seed)+",\"fixture\":"+jstr(fixture)+",\"type\":"+jstr(kind)+",\"mode\":"+mode+",\"chunk\":["+cx+","+cz+"],\"startSeed\":"+jstr(""+startSeed)+",\"pieceSeed\":"+jstr(""+(seed*7+mode))+",\"initial\":"+initial+",\"calls\":"+rows+"],\"tiles\":"+w.tileList()+",\"nextLong\":"+jstr(""+r.nextLong())+"}");
  }
  static void config()throws Exception{
    StringBuilder mats=new StringBuilder("[");for(int id=0;id<256;id++){aji b=aji.e(id);if(id>0)mats.append(',');mats.append('[').append(id).append(',').append(b.o()==awt.a).append(',').append(b.o().c()).append(',').append(b.o()==awt.j).append(']');}
    StringBuilder ids=new StringBuilder("{");String[] names={"a","A","L","U","W","Y","e","f","r","aJ","ai","bp","bL","ad","bF","bz","ar","bC","bD","af","bd","aV","at","F","aR","au","z","ae"};
    for(String n:names){if(ids.length()>1)ids.append(',');ids.append(jstr(n)).append(':').append(aji.b((aji)TerrainProbe.field(ajn.class,n).get(null)));}
    StringBuilder loot=new StringBuilder("{");
    String[][] tables={{"desert","aub","i"},{"jungle","auc","l"},{"dispenser","auc","m"}};
    for(String[] t:tables){if(loot.length()>1)loot.append(',');loot.append(jstr(t[0])).append(":[");boolean first=true;
      for(qx row:(qx[])TerrainProbe.field(Class.forName(t[1]),t[2]).get(null)){if(!first)loot.append(',');first=false;add st=(add)TerrainProbe.get(row,"b");loot.append('[').append(stack(st)).append(',').append(TerrainProbe.get(row,"c")).append(',').append(TerrainProbe.get(row,"d")).append(',').append(TerrainProbe.get(row,"a")).append(',').append(st.e()).append(']');}
      loot.append(']');}
    loot.append('}');
    StringBuilder lever=new StringBuilder("[");for(int i=0;i<16;i++){if(i>0)lever.append(',');lever.append(alv.b(i));}lever.append(']');
    StringBuilder spawn=new StringBuilder("[");for(Object o:new atx().b()){ahx e=(ahx)o;if(spawn.length()>1)spawn.append(',');spawn.append('[').append(jstr(e.b.getName())).append(',').append(TerrainProbe.get(e,"a")).append(',').append(e.c).append(',').append(e.d).append(']');}spawn.append(']');
    ahu[] bs=ahu.n();int swamp=-1,jungle=-1,hills=-1;for(int i=0;i<bs.length;i++){if(bs[i]==ahu.u)swamp=i;if(bs[i]==ahu.J)jungle=i;if(bs[i]==ahu.K)hills=i;}
    Object plain=TerrainProbe.unsafe.allocateInstance(aqq.class),flat=TerrainProbe.unsafe.allocateInstance(aqq.class);TerrainProbe.field(aqo.class,"c").set(flat,ahm.c);
    System.out.println("{\"kind\":\"config\",\"materials\":"+mats+"],\"blocks\":"+ids+"},\"loot\":"+loot+",\"directionX\":"+Arrays.toString(p.a).replace(" ","")+",\"directionZ\":"+Arrays.toString(p.b).replace(" ","")+",\"leverInvert\":"+lever+",\"averageGroundLevel\":{\"default\":"+((aqo)plain).i()+",\"flat\":"+((aqo)flat).i()+"},\"spawnList\":"+spawn+",\"slots\":{\"swamp\":"+swamp+",\"jungle\":"+jungle+",\"jungleHills\":"+hills+"}}");
  }
  public static void main(String[] args)throws Exception{
    Field uf=sun.misc.Unsafe.class.getDeclaredField("theUnsafe");uf.setAccessible(true);TerrainProbe.unsafe=(sun.misc.Unsafe)uf.get(null);aji.p();adb.l();
    config();startChoice();
    for(long seed:new long[]{0,8675309,-123456789,17}){
      int[][] centers=new int[24*24][];for(int i=0;i<centers.length;i++)centers[i]=new int[]{(i/24-12)*17,(i%24-12)*17};
      starts(seed,"grid",centers);
    }
    int[] counter={0};int fullLimit=Integer.parseInt(args.length>0?args[0]:"1000");
    String[] kinds={"TeDP","TeJP","TeSH"};
    int[][] spots={{3,-2},{-7,-11},{0,0},{-1,5},{40,33},{-30,-45},{12,-1},{-20,8}};
    int k=0;
    for(String kind:kinds)for(int mode=0;mode<4;mode++){
      int[] s=spots[(k++)%spots.length];
      populate(8675309,"stone",false,kind,mode,s[0],s[1],fullLimit,counter);
      populate(mode*3+1,"hills",mode%2==1,kind,mode,spots[(k+3)%spots.length][0],spots[(k+3)%spots.length][1],0,counter);
      if(mode%2==0)populate(-123456789L+mode,"water",false,kind,mode,spots[(k+5)%spots.length][0],spots[(k+5)%spots.length][1],0,counter);
      partial(mode+5,"hills",kind,mode,s[0],s[1]);
      partial(mode*11-3,"stone",kind,mode,spots[(k+1)%spots.length][0],spots[(k+1)%spots.length][1]);
      partial(mode+40,"air",kind,mode,spots[(k+2)%spots.length][0],spots[(k+2)%spots.length][1]);
    }
  }
}
