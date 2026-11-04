import java.lang.reflect.Field;
import java.util.*;

// Executes unchanged 1.7.10 MerchantRecipe / MerchantRecipeList operations.
public class VillagerTradingProbe {
  static add stack(int id,int count,int damage){return new add(adb.d(id),count,damage);}
  static agn recipe(int buy,int qty,int buyB,int qtyB,int sell,int result){
    return new agn(stack(buy,qty,0),buyB<0?null:stack(buyB,qtyB,0),stack(sell,result,0));
  }
  static String jsonStack(add s){return s==null?"null":"{\"id\":"+adb.b(s.b())+",\"count\":"+s.b+",\"damage\":"+s.c+",\"tag\":"+(s.d==null?"null":"{\"CustomName\":\""+s.d.j("CustomName")+"\"}")+"}";}
  static String jsonRecipe(agn r)throws Exception{
    Field uses=agn.class.getDeclaredField("d"),max=agn.class.getDeclaredField("e");uses.setAccessible(true);max.setAccessible(true);
    return "{\"buy\":"+jsonStack(r.a())+",\"buyB\":"+jsonStack(r.b())+",\"sell\":"+jsonStack(r.d())+",\"uses\":"+uses.getInt(r)+",\"maxUses\":"+max.getInt(r)+",\"disabled\":"+r.g()+"}";
  }
  static int index(ago offers,add first,add second,int preferred){agn found=offers.a(first,second,preferred);return found==null?-1:offers.indexOf(found);}
  static String replacement(int oldA,int oldB,int newA,int newB,int output)throws Exception{
    ago offers=new ago();offers.a(recipe(265,oldA,388,oldB,264,1));offers.a(recipe(265,newA,388,newB,output,1));
    agn kept=(agn)offers.get(0);return "{\"size\":"+offers.size()+",\"buyCount\":"+kept.a().b+",\"buyBCount\":"+kept.b().b+",\"outputId\":"+adb.b(kept.d().b())+"}";
  }
  public static void main(String[] args)throws Exception{
    aji.p();adb.l();
    System.out.println("{\"kind\":\"matching\",\"results\":["+
      index(list(),stack(265,5,1),null,0)+","+ // item identity ignores damage; first matching slot
      index(list(),stack(265,2,0),null,0)+","+ // insufficient input
      index(list(),stack(265,5,0),stack(388,1,0),0)+","+ // optional second input required
      index(list(),stack(265,5,0),null,1)+","+ // positive index checks only that slot
      index(list(),stack(265,5,0),null,-1)+","+ // negative index scans in order
      index(list(),taggedStack(265,3,0,"other"),null,0)+"]}"); // matching ignores stack NBT

    agn r=recipe(265,3,388,2,264,1);dh persistedTag=new dh();persistedTag.a("CustomName","tagged input");r.a().d=persistedTag;StringBuilder uses=new StringBuilder("[");
    for(int i=1;i<=7;i++){r.f();if(i>1)uses.append(',');uses.append("{\"uses\":"+i+",\"disabled\":"+r.g()+"}");}uses.append(']');
    r.a(3);String increased=jsonRecipe(r);boolean disabledAfterIncrease=r.g();r.h();String forced=jsonRecipe(r);agn roundTrip=new agn(r.i());
    System.out.println("{\"kind\":\"recipeUse\",\"afterUses\":"+uses+",\"afterIncrease\":"+increased+",\"disabledAfterIncrease\":"+disabledAfterIncrease+",\"afterForceDisable\":"+forced+",\"nbtRoundTrip\":"+jsonRecipe(roundTrip)+"}");
    System.out.println("{\"kind\":\"replacement\",\"rows\":["+replacement(2,5,3,4,264)+","+replacement(2,5,1,4,264)+","+replacement(2,5,3,4,265)+","+singleReplacement()+"]}");
    System.out.println("{\"kind\":\"preference\",\"results\":["+preference(recipe(265,2,388,5,264,1),recipe(265,3,388,4,264,1))+","+preference(recipe(265,3,388,4,264,1),recipe(265,2,388,5,264,1))+","+preference(recipe(265,2,388,5,264,1),recipe(265,2,388,5,264,1))+","+preference(recipe(265,2,-1,0,264,1),recipe(265,2,-1,0,264,1))+","+preference(recipe(265,2,-1,0,265,1),recipe(265,3,-1,0,264,1))+"]}");
  }
  static boolean preference(agn candidate,agn old){return candidate.b(old);}
  static String singleReplacement()throws Exception{ago offers=new ago();offers.a(recipe(265,2,-1,0,264,1));offers.a(recipe(265,3,-1,0,264,1));agn kept=(agn)offers.get(0);return "{\"size\":"+offers.size()+",\"buyCount\":"+kept.a().b+",\"buyBCount\":0,\"outputId\":"+adb.b(kept.d().b())+"}";}
  static add taggedStack(int id,int count,int damage,String name){add s=stack(id,count,damage);dh tag=new dh();tag.a("CustomName",name);s.d=tag;return s;}
  static ago list(){ago list=new ago();list.add(recipe(265,3,-1,0,264,1));list.add(recipe(265,5,388,1,266,1));return list;}
}
