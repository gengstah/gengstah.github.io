// Run with: node --test _tests/wilderkin-expedition.cjs
const {test} = require("node:test");
const assert = require("node:assert/strict");
const {readFileSync} = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const scripts = ["atlas","bestiary","activities","campaign","story","duets","caravans","fieldwork","walking-partner","hollows","trials","growth","stillwake","wardens","opening","sparring-gear","sparring-signatures","sparring-battle","sparring-grove","sparring-library","sparring-teams","cup-rules","cup-notebook","cup-desk","cup-series","sparring","sparring-review","world","engine"].map(name => {
  const filename=path.join(__dirname,"../games/wilderkin",name+".js");
  return new vm.Script(readFileSync(filename,"utf8"),{filename});
});

function load(save,extra=[]) {
  const records = new Map(extra);
  if (save) records.set("wilderkin.trail.v"+JSON.parse(save).version,save);
  const storage = {getItem:key=>records.get(key)??null,setItem:(key,value)=>records.set(key,value)};
  // Map collisions are computed by the shipped world generator. Only the drawing surface is stubbed.
  const document={createElement(){
    const canvas={};
    const noop=()=>{};
    const context={canvas,drawImage:noop,fillRect:noop,putImageData:noop,beginPath:noop,lineTo:noop,
      moveTo:noop,stroke:noop,createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)})};
    canvas.getContext=()=>context;
    return canvas;
  }};
  const ctx = vm.createContext({document,window:{localStorage:storage}});
  scripts.forEach(script=>script.runInContext(ctx));
  const w=ctx.window;
  return {game:w.WilderGame,world:w.WilderWorld,dex:w.WilderKinDex,fair:w.WilderActivities,story:w.WilderStory,save:()=>records.get("wilderkin.trail.v3"),records};
}
const copy = obj=>JSON.parse(JSON.stringify(obj));
function ok(outcome) {assert.ok(outcome.ok,outcome.message);}
const baseParty = () => [["sprigkit",32],["cindlet",28],["dewfin",30]].map(([id,maxHp])=>({id,level:5,maxHp,hp:maxHp,xp:4}));

test("atlas pins and playback preferences survive a reload without changing trail access",()=>{
  const loaded=load(),g=loaded.game;
  assert.ok(!g.access(149).open);
  ok(g.pinRegion(149,"track"));ok(g.pinRegion(2,"save"));ok(g.pinRegion(149,"save"));
  assert.ok(!g.access(149).open);assert.deepEqual(copy(g.state.pins),[149,2]);
  ok(g.cycleMusic());ok(g.cycleAnimationSpeed());
  const old=load(loaded.save()).game;
  assert.equal(old.state.destination,149);assert.equal(old.state.music,2);assert.equal(old.state.animationSpeed,2);
  ok(old.pinRegion(149,"remove"));assert.equal(old.state.destination,null);assert.deepEqual(copy(old.state.pins),[2]);
  assert.equal(old.pinRegion(150,"save").ok,false);
  const restored=load(JSON.stringify({...g.state,pins:[false,-3,2,2,900],destination:149,music:100,animationSpeed:0})).game.state;
  assert.deepEqual(copy(restored.pins),[2]);assert.equal(restored.destination,null);assert.equal(restored.animationSpeed,1);
});

test("legacy in-flight battles and permanent old achievements migrate into a separate save",()=>{
  for(const version of [1,2]) {
    const party=baseParty();
    party[0].hp=17;
    const battle={kind:"warden",activeId:"sprigkit",enemy:{id:"glimmeray",level:10,hp:12,maxHp:46,xp:0},turn:4,log:["Glimmeray used Lunar Surge!"]};
    const original={version,region:2,met:[0,1,2],crests:[0,1],seen:["glimmeray"],positions:{0:{x:11,y:7},2:{x:5,y:5}},party,lead:"sprigkit",battle,wins:3,sound:false,clears:{"firefly-pairs":1}};
    const migrated=load(JSON.stringify(original)), g=migrated.game;
    assert.equal(g.state.region,2);assert.equal(g.state.party[0].hp,17);assert.equal(g.state.battle.turn,4);
    assert.equal(g.state.battle.enemy.hp,12);assert.equal(g.state.sound,false);assert.equal(g.state.positions[2].x,5);
    assert.ok(g.gamePass("firefly-pairs").earned);
    ok(g.useSkill("leaf-flurry"));assert.equal(g.state.crests.length,3);
    assert.equal(migrated.records.get("wilderkin.trail.v"+version),JSON.stringify(original));
    assert.deepEqual(copy(load(migrated.save()).game.state),copy(g.state));
  }
});

test("crafting, medicine, revival and invitations consume supplies atomically",()=>{
  const {game:g}=load();
  const bag=()=>copy(g.state.bag);
  const opening=bag();
  ok(g.craft("kinweave"));assert.equal(g.state.bag.reed,opening.reed-2);
  assert.equal(g.state.bag.sap,opening.sap-1);assert.equal(g.state.bag.kinweave,opening.kinweave+1);
  ok(g.gather());const harvested=bag();assert.ok(!g.gather().ok);assert.deepEqual(bag(),harvested);
  assert.ok(!g.useItem("tonic","sprigkit").ok);assert.deepEqual(bag(),harvested);
  ok(g.startBattle("wild","mossbell"));assert.ok(!g.useItem("kinweave").ok);assert.deepEqual(bag(),harvested);
  ok(g.useSkill("trail-feint"));ok(g.useItem("balm","sprigkit"));assert.equal(g.state.bag.balm,harvested.balm-1);
  ok(g.useSkill("trail-feint"));ok(g.useItem("kinweave"));assert.equal(g.state.bag.kinweave,harvested.kinweave-1);
  assert.ok(g.state.party.some(p=>p.id==="mossbell"));assert.ok(g.state.forageReady);
  assert.ok(!g.useItem("sparkseed","sprigkit").ok);
  const save=copy(g.state);
  save.party.find(p=>p.id==="dewfin").hp=0;
  save.bag.kinweave=0;
  const wounded=load(JSON.stringify(save)).game;
  ok(wounded.startBattle("wild",wounded.pools[0].find(id=>!wounded.state.party.some(p=>p.id===id))));
  ok(wounded.useItem("sparkseed","dewfin"));assert.equal(wounded.state.bag.sparkseed,0);
  assert.equal(wounded.state.party.find(p=>p.id==="dewfin").hp,15);
  ok(wounded.useSkill("trail-feint"));ok(wounded.useSkill("trail-feint"));
  assert.ok(!wounded.recruit().ok);assert.ok(wounded.state.battle);
  assert.deepEqual(copy(load(JSON.stringify(wounded.state)).game.state.battle),copy(wounded.state.battle));
});

function readScene(loaded,id,finished,meter) {
  const {game,story}=loaded;
  for(let line=0;!finished() && line<100;line++) {
    const scene=story.scene(game.state,id);
    const choice=scene?.choices?.[0]?.id;
    if(meter.words!=null) meter.words+=[scene.text,...scene.choices.map(c=>c.label)].join(" ").trim().split(/\s+/).length;
    ok(game.storyStep(id,choice));meter.lines++;
  }
  assert.ok(finished(),id+" must reach its conclusion");
}

test("a veteran with all crests can recover all missing dispatches and reach the ending",()=>{
  const {game:g}=load();
  const veteran={version:2,party:baseParty(),region:148,visited:[0,1,2,148],crests:copy(g.wardens),met:copy(g.wardens)};
  for(const id of Object.keys(g.species).filter(id=>g.species[id].ability)) {
    if(!veteran.party.some(p=>g.species[p.id].ability===g.species[id].ability)) {
      const maxHp=g.species[id].baseHp+45;
      veteran.party.push({id,level:20,hp:maxHp,maxHp,xp:0});
    }
  }
  const loaded=load(JSON.stringify(veteran),[["wilderkin.trail.v3","{broken"]]), live=loaded.game;
  assert.equal(live.state.region,148);assert.equal(live.state.crests.length,30);
  assert.ok(live.state.refit);ok(live.heal());assert.equal(live.state.refit,0);
  assert.ok(live.team().every(p=>p.level===live.wildLevel(148)));
  assert.equal(live.objective().title,"Recover the missing dispatch");
  const meter={lines:0};
  for(const i of live.wardens) {
    const ordinal=live.regions[i].ordinal;
    ok(live.travel(live.objective().target));
    readScene(loaded,"chapter-"+(ordinal+1),()=>loaded.story.chapterDone(live.state,ordinal),meter);
  }
  readScene(loaded,"ending",()=>loaded.story.ending(live.state),meter);
  assert.ok(loaded.story.ending(live.state));
});

// A repeatable expert route through actual progression actions. The player seeks useful affinities,
// uses kit shortcuts, declares each expedition at its landmark and still collects every species.
function playCampaign(itinerary) {
  const collector=itinerary==="Collector", specialist=itinerary==="Specialist",naturalist=itinerary==="Naturalist";
  const loaded=load(), {game:g,dex,fair,story,world}=loaded;
  const s=()=>g.state, party=id=>s().party.find(p=>p.id===id);
  const meter={visits:0,landmarks:0,charted:0,formed:0,foes:0,skills:0,swaps:0,items:0,rests:0,crafts:0,captures:0,gathers:0,lines:0,words:0,passes:0,tiles:0,fieldActions:0,enrollments:0,leaderChanges:0};
  const ids=Object.keys(g.species).filter(id=>!g.species[id].bonus);
  assert.equal(g.regions.length,150);assert.equal(new Set(g.regions.map(r=>r.name)).size,150);
  assert.equal(ids.length,500);assert.equal(new Set(ids.map(id=>g.species[id].name)).size,500);
  assert.equal(new Set(g.pools.flat()).size,500);assert.equal(g.wardens.length,30);
  assert.equal(new Set(g.wardens.map(i=>g.regions[i].warden)).size,30);
  assert.ok(fair.games.length>=20 && fair.quests.length>=30);assert.equal(dex.effectiveness("Arc",["Vane","Tide"]),2.25);
  assert.ok(!g.travel(149).ok && !g.startBattle("wild","unknown").ok && !g.awardGame(fair.games[0].id).ok);
  assert.ok(!g.startBattle("warden").ok && !g.unlockGame(fair.games[0].id).ok);
  const distanceCache=new Map();
  function walkTo(goal) {
    const i=s().region,region=world.regions[i],start=s().positions[i]||region.spawn;
    const key=[i,start.x,start.y,goal.x,goal.y].join("/");
    if(!distanceCache.has(key)) {
      const queue=[[start.x,start.y,0]], seen=new Set();
      for(let j=0;j<queue.length;j++) {
        const [x,y,steps]=queue[j], cell=x+","+y;
        if(seen.has(cell))continue;
        seen.add(cell);
        if(x===goal.x && y===goal.y) {distanceCache.set(key,steps);break;}
        for(const [dx,dy] of [[0,-1],[0,1],[-1,0],[1,0]]) {
          if(world.walkable(i,x+dx,y+dy))queue.push([x+dx,y+dy,steps+1]);
        }
      }
    }
    assert.ok(distanceCache.has(key),region.name+" must have a walkable route to "+goal.label);
    meter.tiles+=distanceCache.get(key);
    assert.ok(g.setPosition(goal.x,goal.y));meter.landmarks++;
  }
  function site(kind) {
    walkTo(world.regions[s().region].sites.find(l=>l.id===kind));assert.ok(g.visitSite(kind));
  }
  function rest() {site("camp");ok(g.heal());meter.rests++;}
  function craft(id) {ok(g.craft(id));meter.crafts++;}
  function gather() {if(s().forageReady){ok(g.gather());meter.gathers++;}}
  function train(id) {
    if(!s().team.includes(id)) {
      const weakest=g.team().sort((a,b)=>a.level-b.level)[0];
      ok(g.enlist(id,weakest.id));meter.enrollments++;
    }
    if(s().lead!==id){ok(g.setLead(id));meter.leaderChanges++;}
  }
  function attacks(p,enemy) {
    return g.species[p.id].skills.filter(s=>s.kind!=="heal").map(skill=>{
      const guarded=g.state.battle && g.foeIntent().guarding;
      const strength=(skill.power+(p.level-5)*.47)*dex.effectiveness(skill.type,g.species[enemy].types);
      return {skill,score:strength*(guarded?(skill.kind==="guard"?1.4:.55):1)};
    }).sort((a,b)=>b.score-a.score);
  }
  function ready(enemy) {
    const eligible=s().party.filter(p=>p.hp>p.maxHp*.6);
    const ranked=eligible.map(p=>({p,score:attacks(p,enemy)[0].score*Math.sqrt(p.hp/p.maxHp)})).sort((a,b)=>b.score-a.score);
    train(ranked[0].p.id);
  }
  function fight() {
    meter.formed++;meter.foes+=s().battle.remaining.length+1;
    for(let action=0;s().battle && action<200;action++) {
      const b=s().battle, active=party(b.activeId),enemy=b.enemy.id;
      const options=attacks(active,enemy);
      const rivals=g.team().filter(p=>p.id!==active.id && p.hp>p.maxHp*.48);
      const replacement=rivals.map(p=>({id:p.id,score:attacks(p,enemy)[0].score})).sort((a,b)=>b.score-a.score)[0];
      if(replacement && (replacement.score>options[0].score*1.8 || active.hp<active.maxHp*.16)) {
        ok(g.swap(replacement.id));meter.swaps++;
      } else if(active.hp<active.maxHp*.3 && s().bag.tonic && g.foeIntent().charged) {
        ok(g.useItem("tonic",active.id));meter.items++;
      } else {ok(g.useSkill(options[0].skill.id));meter.skills++;}
    }
    assert.equal(s().battle,null,"formation stalled");
  }
  const crossed=new Set();
  for(const [i,r] of g.regions.entries()) {
    if(i>0) assert.ok(r.wildLevel>g.regions[i-1].wildLevel);
    if(r.ability) {
      assert.ok(s().licenses.includes(r.ability));const gate=g.access(i);
      assert.equal(g.species[gate.carrier].ability,r.ability);
      if(!crossed.has(r.ability)) {
        const alternate=JSON.parse(loaded.save());
        alternate.licenses=alternate.licenses.filter(a=>a!==r.ability);
        assert.ok(!load(JSON.stringify(alternate)).game.travel(i).ok,r.name+" needs licensed training");
        alternate.licenses.push(r.ability);
        alternate.party=alternate.party.filter(p=>g.species[p.id].ability!==r.ability);
        const branch=load(JSON.stringify(alternate)).game;
        assert.ok(!branch.travel(i).ok,r.name+" still needs a registered carrier");
      }
      crossed.add(r.ability);
    }
    ok(g.travel(i));meter.visits++;assert.equal(s().region,i);
    if(!s().visited.includes(i+1) && i+1<150) assert.ok(!g.travel(i+1).ok);
    rest();gather();
    for(const [slot,id] of g.pools[i].entries()) {
      if(party(id)) continue;
      const ability=g.species[id].ability;
      const newCarrier=ability && !s().party.some(p=>g.species[p.id].ability===ability);
      const localAdmission=fair.games.some(game=>game.region===i && g.gamePass(game.id).requirements.some(r=>r.label.startsWith("Befriend")&&!r.done));
      if(!collector && !newCarrier && !localAdmission && !((!specialist || i%3===0) && slot===i%g.pools[i].length)) continue;
      if(!s().bag.kinweave){gather();craft("kinweave");}
      if(g.team().every(p=>p.hp<p.maxHp*.55))rest();
      train(g.team().sort((a,b)=>b.hp-a.hp)[0].id);
      site("wild");ok(g.startBattle("wild",id));assert.equal(s().battle.enemy.level,r.wildLevel);
      // A vent-scale opponent can heal once while the party is preparing a Kinweave.
      for(let feints=0;feints<4&&!g.captureStatus().available;feints++){
        ok(g.useSkill("trail-feint"));meter.skills++;
      }
      ok(g.recruit());meter.captures++;
    }
    const requests=fair.quests.filter(q=>q.region===i);
    if(requests.length)site("activities");
    for(const request of requests) ok(g.questAction(request.id));
    if(naturalist && i>=3){
      assert.equal(g.filePassage().ok,false);
      for(const kin of g.sightings().slice(0,3)){
        walkTo(kin);const d=g.study(kin.species);
        ok(g.observe(kin.species,d.clues[0].id));ok(g.observe(kin.species,"try-"+d.variant));
      }
    }
    for(let leg=g.expedition().completed;!g.expedition().done && leg<20;leg++) {
      if(naturalist && i>=3 && g.passageReport().requirements.every(r=>r.done))break;
      const job=g.expedition();
      site(job.targetSite);
      if(s().forageReady && (s().bag.ore<3 || s().bag.sap<6 || s().bag.reed<4)) gather();
      if(s().bag.tonic<2 && s().bag.sap>=3 && s().bag.ore>=1)craft("tonic");
      const valid=()=>g.expedition().choices.filter(c=>c.available).sort((a,b)=>a.foes-b.foes);
      if(specialist && valid()[0].foes) {
        const shortcut=job.choices.find(c=>c.cost && c.foes<valid()[0].foes);
        const item=Object.keys(shortcut?.cost || {})[0], recipe=g.items[item]?.recipe;
        if(recipe && s().bag[item]<shortcut.cost[item] && Object.entries(recipe).every(([mat,n])=>s().bag[mat]>=n))craft(item);
      }
      if(valid()[0].foes) {
        rest();ready(job.focus);site(job.targetSite);
      }
      ok(g.expeditionAction(valid()[0].id));
      if(s().battle) fight();else meter.fieldActions++;
      assert.equal(g.expedition().completed,leg+1,"lost at "+r.name+" leg "+leg);
      meter.charted++;
    }
    if(naturalist && i>=3){
      site("travel");ok(g.filePassage());assert.equal(g.filePassage().ok,false);
      assert.ok(g.passageReport().filed && !g.expedition().done);
    }else assert.ok(g.expedition().done);
    for(const ability of Object.keys(dex.abilities)) {
      const l=g.license(ability);if(l.region!==i)continue;
      assert.ok(!g.claimLicense(ability).ok);
      readScene(loaded,"lesson-"+ability,()=>story.hasLesson(s(),ability),meter);
      while(g.license(ability).requirements.some(r=>r.label.startsWith("Win two")&&!r.done)) {
        rest();ready(g.pools[i][0]);site("wild");ok(g.startBattle("wild",g.pools[i][0]));fight();
      }
      ok(g.claimLicense(ability));
    }
    for(const activity of fair.games.filter(g=>g.region===i)) {
      assert.ok(!g.awardGame(activity.id).ok);
      if(!s().crafted.balm)craft("balm");
      while(g.gamePass(activity.id).requirements.some(r=>r.label.startsWith("Win two")&&!r.done)) {
        rest();ready(g.pools[i][0]);site("wild");ok(g.startBattle("wild",g.pools[i][0]));fight();
      }
      site("activities");ok(g.unlockGame(activity.id));meter.passes++;
      // The separate activity suite wins the boards. Here the real admission and reward APIs are exercised.
      ok(g.awardGame(activity.id));ok(g.awardGame(activity.id));
    }
    if(i>0)assert.ok(!g.awardGame(fair.games[0].id).ok,"permanent passes are regional");
    if(r.warden) {
      readScene(loaded,"chapter-"+(r.ordinal+1),()=>story.chapterDone(s(),r.ordinal),meter);
      rest();site("warden");ok(g.meetWarden());ready(g.pools[i][0]);ok(g.startBattle("warden"));
      assert.deepEqual(copy(load(loaded.save()).game.state.battle),copy(s().battle));
      fight();assert.ok(s().crests.includes(i),"Warden trial at "+r.name);
      if(specialist && i===0)console.log("First crest:",JSON.stringify(meter));
    }
  }
  assert.equal(crossed.size,6);assert.equal(s().visited.length,150);assert.equal(s().crests.length,30);
  if(naturalist)assert.equal(s().reports.length,147);
  if (collector) assert.equal(s().party.length,500);
  assert.equal(s().team.length,6);assert.equal(s().passes.length,fair.games.length);
  readScene(loaded,"ending",()=>Boolean(story.ending(s())),meter);
  assert.equal(g.objective().title,collector?"The trail is yours":"Befriend every Wilderkin");
  for(const q of fair.quests) {
    const p=fair.progress(q,s());
    if(!collector && p.current<p.total)continue;
    assert.equal(p.current,p.total,q.name);
    ok(g.questAction(q.id));assert.ok(!g.questAction(q.id).ok);
  }
  assert.deepEqual(copy(load(loaded.save()).game.state),copy(s()));
  console.log(itinerary+" itinerary:",JSON.stringify(meter));
  // This route proves reachability. A human reader's time solving wildlife clues isn't measured.
  if(naturalist)return;
  const turns=meter.skills+meter.swaps+meter.items;
  const support=meter.rests+meter.gathers+meter.crafts+meter.leaderChanges+meter.enrollments+meter.captures+meter.visits;
  // 1.102 s was measured keydown-to-ready for 32 normal attack/counter cycles in the canvas.
  // The non-combat walking cost is the click-to-walk throttle over the actual shortest paths.
  // Other seconds are player-profiling assumptions; fair boards, bond errands, losses, breaks
  // and time spent browsing the optional codex are excluded. Quicker combat input is possible.
  const movement=meter.tiles*.125;
  const model=(input,leg,location,service,wpm)=>(movement+turns*(1.102+input)+meter.charted*leg+
    meter.landmarks*location+support*service+meter.words*60/wpm)/3600;
  console.log(itinerary+" model in hours:",{
    animationAndWalking:(movement/3600+turns*1.102/3600).toFixed(1),
    quick:model(.8,4,1,1,300).toFixed(1),deliberate:model(4.8,15,3,3,220).toFixed(1),
    exploratory:model(6.5,21,4,4,180).toFixed(1)
  });
}

test("collect every species and crest, complete 150 commissions and reach the ending",()=>playCampaign("Collector"));
test("a smaller specialist roster can finish the campaign and earn all field licenses",()=>playCampaign("Specialist"));

test("a regular roster and regional preparations reach the ending",()=>playCampaign("Regular"));
test("a naturalist reaches the ending through 147 wildlife reports while retaining the optional commissions",()=>playCampaign("Naturalist"));
