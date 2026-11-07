import {test} from 'node:test';
import assert from 'node:assert/strict';
import {selectLocalPlayer} from './command-selector.js';
const host={name:'@',playerName:'Player',position:()=>({x:0,y:60,z:0}),playerPosition:()=>({x:3,y:60,z:4}),playerMode:()=>1,playerLevel:()=>5};
test('legacy selectors select the local player relative to the command sender, respecting radius, name, mode and level',()=>{
  for(const s of ['@p','@a','@r','@p[r=5]','@p[name=Player,m=1,lm=5,l=5]','@p[3,60,4,0]'])assert.equal(selectLocalPlayer(s,host),'Player',s);
  for(const s of ['@e','@p[r=4]','@p[rm=6]','@p[name=!Player]','@p[m=0]','@p[l=4]','@a[score_points=1]'])assert.equal(selectLocalPlayer(s,host),null,s);
});

import {readFileSync} from 'node:fs';
import {parseIntWithDefault,parseSelectorArguments,selectorScoreMap,selectorDefaults} from './command-selector.js';
const reference=JSON.parse(readFileSync(new URL('../public/research/selector-reference.json',import.meta.url),'utf8')).records;
const of=kind=>reference.filter(r=>r.case===kind);
const TOKEN=/^@([parf])(?:\[([\w=,!-]*)\])?$/;
const sorted=map=>Object.fromEntries([...map].sort(([a],[b])=>a<b?-1:a>b?1:0));

test('the argument parser, score map and parseIntWithDefault replay PlayerSelector.h/a(Map) and MathHelper.parseIntWithDefault from the jar',()=>{
  assert.ok(of('args').length>=60&&of('int').length>100);
  for(const r of of('args')){
    const map=parseSelectorArguments(r.in);
    assert.deepEqual(sorted(map),r.map,`args ${JSON.stringify(r.in)}`);
    assert.deepEqual(sorted(selectorScoreMap(map)),r.scores,`scores ${JSON.stringify(r.in)}`);
  }
  for(const r of of('int'))assert.equal(parseIntWithDefault(r.in,r.default),r.out,`int ${JSON.stringify(r.in)} ${r.default}`);
  for(const r of of('defaults')){const d=selectorDefaults(r.token);assert.deepEqual([d.rm,d.r,d.l,d.lm,d.c],[r.c,r.d,r.e,r.f,r.g],r.token);}
});
test('the token regex agrees with the jar and @e/@f never select',()=>{
  for(const r of of('token'))assert.equal(TOKEN.test(r.in),r.matches,r.in);
  assert.equal(selectLocalPlayer('@e',host),null);assert.equal(selectLocalPlayer('@f',host),null);
  for(const s of ['@p[ r=5]','@p[name=a b]','@p[r=5][m=1]','@p[x=1]x','@P','@p[x=1;y=2]'])assert.equal(selectLocalPlayer(s,host),null,s);
});

// Sender at (0,60,0); the player stands at (3,60,4): distance squared 25 (floats, ints from floor(x), floor(y+0.5), floor(z)).
const at=(p,extra={})=>({...host,playerPosition:()=>p,...extra});
test('radius, rm, positional and explicit coordinates follow findPlayers (r<=0 means unlimited, float distance, int multiply overflow)',()=>{
  assert.equal(selectLocalPlayer('@p[r=5]',host),'Player');assert.equal(selectLocalPlayer('@p[r=4]',host),null);
  assert.equal(selectLocalPlayer('@p[r=0]',host),'Player',"r=0 is unlimited, not zero range");
  assert.equal(selectLocalPlayer('@p[r=-3]',host),'Player');
  assert.equal(selectLocalPlayer('@p[rm=5]',host),'Player');assert.equal(selectLocalPlayer('@p[rm=6]',host),null);assert.equal(selectLocalPlayer('@p[rm=0]',host),'Player');
  assert.equal(selectLocalPlayer('@p[r=x]',host),'Player',"unparseable r keeps the default 0");
  assert.equal(selectLocalPlayer('@p[3,60,4,0]',host),'Player');assert.equal(selectLocalPlayer('@p[3,60,4,1]',host),'Player');assert.equal(selectLocalPlayer('@p[0,60,0,5]',host),'Player');assert.equal(selectLocalPlayer('@p[0,60,0,4]',host),null);
  assert.equal(selectLocalPlayer('@p[x=3,y=60,z=4,r=0]',host),'Player');assert.equal(selectLocalPlayer('@p[x=100,r=10]',host),null);
  assert.equal(selectLocalPlayer('@p[x=1.5,r=1]',host),null,"1.5 is not an int, x keeps the sender's 0");
  // the player's block is floor(x), floor(y+0.5), floor(z): (3.9, 60.5, 4.9) is (3, 61, 4)
  const high=at({x:3.9,y:60.5,z:4.9});
  assert.equal(selectLocalPlayer('@p[x=3,y=61,z=4,r=1]',high),'Player');assert.equal(selectLocalPlayer('@p[x=3,y=60,z=4,r=0,rm=1]',high),'Player');assert.equal(selectLocalPlayer('@p[x=3,y=61,z=4,rm=1]',high),null);
  // r*r wraps as a Java int: 46341*46341 overflows to a negative number, so every player is beyond it
  assert.equal(selectLocalPlayer('@p[r=46341]',host),null);assert.equal(selectLocalPlayer('@p[r=46340]',host),'Player');
  assert.equal(selectLocalPlayer('@p[r=100000]',host),'Player',"100000*100000 wraps to 1410065408");
});
test('name and team compare case-insensitively with ! negation; unknown teams and empty values behave like findPlayers',()=>{
  assert.equal(selectLocalPlayer('@p[name=player]',host),'Player');assert.equal(selectLocalPlayer('@p[name=PLAYER]',host),'Player');
  assert.equal(selectLocalPlayer('@p[name=!player]',host),null);assert.equal(selectLocalPlayer('@p[name=!Other]',host),'Player');
  assert.equal(selectLocalPlayer('@p[name=]',host),null);assert.equal(selectLocalPlayer('@p[name=!]',host),'Player');
  const board={teamOf:n=>n==='Player'?{name:'Red'}:null,objective:()=>null,score:()=>({value:0})};
  const teamed=at({x:3,y:60,z:4},{scoreboard:board}),solo=at({x:3,y:60,z:4},{scoreboard:{...board,teamOf:()=>null}});
  assert.equal(selectLocalPlayer('@p[team=red]',teamed),'Player');assert.equal(selectLocalPlayer('@p[team=!red]',teamed),null);assert.equal(selectLocalPlayer('@p[team=blue]',teamed),null);assert.equal(selectLocalPlayer('@p[team=!blue]',teamed),'Player');
  assert.equal(selectLocalPlayer('@p[team=]',solo),'Player',"team= selects players without a team");assert.equal(selectLocalPlayer('@p[team=]',teamed),null);assert.equal(selectLocalPlayer('@p[team=!]',teamed),'Player');
  assert.equal(selectLocalPlayer('@p[team=red]',host),null,"no scoreboard: the empty team name");
});
test('mode, level and score arguments: -1 mode means any, lm only applies above 0, bad numbers keep defaults',()=>{
  assert.equal(selectLocalPlayer('@p[m=1]',host),'Player');assert.equal(selectLocalPlayer('@p[m=0]',host),null);assert.equal(selectLocalPlayer('@p[m=-1]',host),'Player');assert.equal(selectLocalPlayer('@p[m=x]',host),'Player');assert.equal(selectLocalPlayer('@p[m=9]',host),null);
  assert.equal(selectLocalPlayer('@p[lm=5]',host),'Player');assert.equal(selectLocalPlayer('@p[lm=6]',host),null);assert.equal(selectLocalPlayer('@p[lm=-9]',host),'Player');assert.equal(selectLocalPlayer('@p[l=5]',host),'Player');assert.equal(selectLocalPlayer('@p[l=4]',host),null);assert.equal(selectLocalPlayer('@p[l=-1]',host),null);
  const values={points:7};
  const board={teamOf:()=>null,objective:n=>n in values?{name:n}:null,score:(p,o)=>({value:values[o.name]})};
  const h=at({x:3,y:60,z:4},{scoreboard:board});
  for(const [s,ok] of [['@p[score_points=7]',1],['@p[score_points=6]',0],['@p[score_points_min=7]',1],['@p[score_points_min=8]',0],['@p[score_points_min=1,score_points=9]',1],['@p[score_nope=0]',0],['@p[score_points=x]',0],['@p[score_points_min=x]',1],['@p[score_points=99999999999]',0]])assert.equal(selectLocalPlayer(s,h),ok?'Player':null,s);
});
test('@r with count 0 selects nobody, a negative count throws like subList; @p and @a ignore c for the single player',()=>{
  assert.equal(selectLocalPlayer('@r[c=1]',host),'Player');assert.equal(selectLocalPlayer('@r[c=5]',host),'Player');assert.equal(selectLocalPlayer('@r[c=0]',host),null);
  assert.throws(()=>selectLocalPlayer('@r[c=-1]',host),RangeError);assert.throws(()=>selectLocalPlayer('@r[r=1,c=-2]',host),RangeError,'the count is checked before any filter');
  for(const s of ['@p[c=0]','@p[c=-1]','@p[c=3]','@a[c=0]','@a[c=-1]','@a[c=2]'])assert.equal(selectLocalPlayer(s,host),'Player',s);
  assert.equal(selectLocalPlayer('@r[c=x]',host),'Player');
});
