const {test}=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const names=["atlas","bestiary","activities","campaign","story","duets","fieldwork","stillwake","engine"];
const scripts=names.map(id=>new vm.Script(fs.readFileSync(path.join(__dirname,"../games/wilderkin",id+".js"),"utf8"),{filename:id+".js"}));
const copy=v=>JSON.parse(JSON.stringify(v));
function load(saved) {
  const records=new Map();
  if(saved)records.set("wilderkin.trail.v3",JSON.stringify(saved));
  const w={localStorage:{getItem:id=>records.get(id)||null,setItem:(id,v)=>records.set(id,v)}};
  const ctx=vm.createContext({window:w});scripts.forEach(s=>s.runInContext(ctx));
  return {g:w.WilderGame,story:w.WilderStory,duets:w.WilderDuets,api:w.WilderGame.stillwake,save:()=>JSON.parse(records.get("wilderkin.trail.v3"))};
}
const ok=r=>assert.ok(r.ok,r.message);
function acquireClues(f) {
  const s=f.g.state;
  assert.ok(!f.api.act("record","rest").ok);
  s.region=0;s.landmark="wild";s.fieldwork.mossbell={complete:true,clues:["trace"],tried:[]};
  assert.ok(!f.api.act("record","ring").ok);ok(f.api.act("record","rest"));
  for(const [region,site,ability,answer] of [[3,"travel","Raftwake","slacken"],[26,"camp","Glowpath","shade"]]){
    s.region=region;s.landmark=site;
    assert.ok(!f.api.act("record",answer).ok);
    s.licenses.push(ability);
    const k=Object.values(f.g.species).find(k=>!k.bonus&&k.ability===ability);
    if(!s.party.some(p=>p.id===k.id))s.party.push({id:k.id,level:5,maxHp:k.baseHp,hp:k.baseHp,xp:0});
    s.landmark=null;assert.ok(!f.api.act("record",answer).ok);
    s.landmark=site;ok(f.api.act("record",answer));
  }
}
function endStory(f){
  const s=f.g.state;s.visited=f.g.regions.map((r,i)=>i);s.crests=Array.from(f.g.wardens);
  s.licenses=[...new Set(f.g.regions.map(r=>r.ability).filter(Boolean))];
  for(const ability of s.licenses){
    const k=Object.values(f.g.species).find(k=>!k.bonus&&k.ability===ability);
    if(!s.party.some(p=>p.id===k.id))s.party.push({id:k.id,level:5,maxHp:k.baseHp,hp:k.baseHp,xp:0});
  }
  const read=id=>{
    for(let n=0;f.story.scene(s,id).status!=="complete"&&n<30;n++){
      const moment=f.story.scene(s,id);ok(f.g.storyStep(id,moment.choices[0]?.id));
    }
    assert.equal(f.story.scene(s,id).status,"complete");
  };
  for(let n=1;n<=30;n++)read("chapter-"+n);
  s.region=149;s.landmark="wild";read("ending");
  assert.ok(f.story.ending(s));
}
function reveal(){
  const f=load();acquireClues(f);
  assert.ok(!f.api.act("reveal").ok);endStory(f);ok(f.api.act("reveal"));return f;
}
test("Stillwake is species 501 with its own art and four unique moves, outside every standard atlas pool",()=>{
  const f=load(),g=f.g,all=Object.values(g.species),normal=all.filter(k=>!k.bonus);
  assert.equal(all.length,501);assert.equal(normal.length,500);
  assert.equal(new Set(g.pools.flat()).size,500);assert.ok(g.pools.flat().every(id=>!g.species[id].bonus));
  const k=g.species.stillwake;assert.ok(k.bonus);assert.deepEqual(copy(g.homes.stillwake),[149]);
  assert.equal(k.skills.length,4);
  const baseSkills=new Set(normal.flatMap(k=>k.skills.map(s=>s.id)));
  assert.ok(k.skills.every(skill=>!baseSkills.has(skill.id)));
  const png=fs.readFileSync(path.join(__dirname,"../games/wilderkin/art/stillwake.png"));
  assert.equal(png.toString("ascii",1,4),"PNG");assert.equal(png.readUInt32BE(16),104);
  assert.equal(f.api.status().revealed,false);assert.ok(!g.startBattle("wild","stillwake").ok);
});
test("the three field observations require their own site, ecology record, field license and carrier; the ending is required",()=>{
  const f=load();acquireClues(f);const {state:s}=f.g;
  assert.equal(f.api.status().marks,3);assert.ok(!f.api.act("reveal").ok);
  assert.ok(!s.seen.includes("stillwake"));endStory(f);
  s.landmark="camp";assert.ok(!f.api.act("reveal").ok);s.landmark="wild";
  ok(f.api.act("reveal"));assert.ok(s.seen.includes("stillwake"));assert.ok(!f.api.act("reveal").ok);
  assert.equal(load(f.save()).api.status().revealed,true);
});
test("a quiet crossing can be solved without battle and its sanctuary oath survives a later invitation",()=>{
  let f=reveal();ok(f.api.act("listen"));
  assert.ok(!f.api.act("answer","tap").ok);assert.equal(f.api.status().peace,0);
  ok(f.api.act("answer","rest"));f=load(f.save());assert.equal(f.api.status().peace,1);
  ok(f.api.act("answer","slacken"));ok(f.api.act("answer","shade"));assert.equal(f.api.status().settled,"peace");
  const old=f.g.state.bag.kinweave;ok(f.api.act("pledge","sanctuary"));
  assert.equal(f.g.state.bag.kinweave,old);assert.equal(f.api.status().recruited,false);
  ok(f.api.act("invite"));assert.equal(f.g.state.bag.kinweave,old-1);
  assert.equal(f.api.status().oath,"sanctuary");assert.equal(f.g.state.party.filter(p=>p.id==="stillwake").length,1);
  assert.ok(!f.api.act("invite").ok);f=load(f.save());
  assert.ok(f.api.status().recruited);assert.equal(f.api.status().settled,"peace");
  assert.equal(f.g.state.party.find(p=>p.id==="stillwake").level,f.g.wildLevel(149));
});
test("the crown, current and lantern phases reward matching different tells and preserve the duet across interruption",()=>{
  let f=reveal();const a=f.api;
  assert.ok(!a.act("challenge",f.g.state.lead).ok);ok(a.act("challenge","cindlet"));
  assert.ok(!a.act("turn","duet").ok);
  const original=f.g.state.party.map(p=>p.hp);
  const phases=new Set();let usedDuet=false,saveChecked=false;
  for(let i=0;!f.api.status().settled&&i<40;i++){
    const b=f.api.status().trial;
    phases.add(b.phase);
    if(!b.open){
      const previous=b.stamina;ok(f.api.act("turn",b.phaseInfo.answer));
      const next=f.api.status().trial;
      if(next&&next.phase===b.phase){assert.ok(next.open);assert.equal(next.stamina,previous);}
    }else{
      if(!saveChecked){
        const old=copy(b);f=load(f.save());assert.deepEqual(copy(f.api.status().trial),old);saveChecked=true;
      }
      if(b.beats>=b.duetCost){
        assert.equal(b.duetName,f.g.duetPair(b.leadId,b.partnerId).name);ok(f.api.act("turn","duet"));usedDuet=true;
      }else ok(f.api.act("turn","strike"));
    }
  }
  assert.equal(phases.size,3);assert.ok(usedDuet);assert.ok(saveChecked);assert.equal(f.api.status().settled,"challenge");
  assert.deepEqual(copy(f.g.state.party.map(p=>p.hp)),copy(original));
  f.g.state.bag.kinweave=0;assert.ok(!f.api.act("pledge","companion").ok);assert.equal(f.api.status().oath,null);
  f.g.state.bag.kinweave=1;ok(f.api.act("pledge","companion"));assert.equal(f.g.state.bag.kinweave,0);assert.equal(f.api.status().oath,"companion");
});
test("a lost or withdrawn challenge preserves research and cannot award a companion",()=>{
  const f=reveal();ok(f.api.act("challenge","dewfin"));
  for(let i=0;f.api.status().trial&&i<15;i++)ok(f.api.act("turn","shade"));
  assert.equal(f.api.status().route,null);assert.equal(f.api.status().settled,null);assert.ok(!f.api.act("invite").ok);
  ok(f.api.act("challenge","dewfin"));ok(f.api.act("withdraw"));ok(f.api.act("listen"));
  assert.equal(f.api.status().peace,0);assert.equal(f.api.status().marks,3);
});
test("a mystery companion cannot substitute for a missing regional species or delay completion of the original collection",()=>{
  const f=load();endStory(f);const g=f.g;
  const all=Object.values(g.species).filter(k=>!k.bonus).map(k=>({id:k.id,level:5,hp:k.baseHp,maxHp:k.baseHp,xp:0}));
  g.state.party=all.slice();assert.equal(g.objective().title,"The trail is yours");
  g.state.party.pop();g.state.party.push({id:"stillwake",level:5,hp:39,maxHp:39,xp:0});
  assert.equal(g.objective().title,"Befriend every Wilderkin");
});
