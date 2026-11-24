// The trail owns one copy of each claimed fitting across the whole career roster.
(() => {
  "use strict";
  const groupData=[
    {id:"camp",name:"Trail kit",ids:["opening-pennant","last-stitch","relay-bell"]},
    {id:"crest",name:"Crest kit",ids:["mender-wrap","seam-hook","prism-lens"]}
  ];
  const details=[
    ["opening-pennant","Opening Pennant","Lead at the opening of an ordinary encounter.","Start with one extra duet beat."],
    ["last-stitch","Lifeline Stitch","Take a lethal enemy hit from more than 1 HP.","Hold at 1 HP."],
    ["relay-bell","Relay Bell","Switch directly to the holder with room left on the beat meter.","Gain one extra duet beat."],
    ["mender-wrap","Mender’s Wrap","Use an ordinary guard with an injured, conscious traveling reserve.","Heal the reserve missing the largest share of its HP by one fifth of its maximum, rounded up."],
    ["seam-hook","Seam Hook","Strike an exposed foe when extra damage would land.","Raise the opening's strike multiplier from 1.5 to 2."],
    ["prism-lens","Prism Lens","Use an ordinary strike the foe resists.","Treat the affinity as neutral for this strike."]
  ];
  const items=Object.freeze(details.map(([id,label,trigger,effect])=>Object.freeze({id,name:window.WilderSparringGear?.byId(id)?.name||label,
    group:groupData.find(g=>g.ids.includes(id)).id,trigger,effect})));
  const lookup=new Map(items.map(i=>[i.id,i])),byId=id=>lookup.get(id)||null;
  const empty=()=>({claimed:[],gear:{}});
  const object=value=>value!==null&&Object.prototype.toString.call(value)==="[object Object]";
  function restore(raw,state){
    const clean=empty();if(!object(raw)||!Array.isArray(raw.claimed))return clean;
    clean.claimed=groupData.filter(g=>raw.claimed.includes(g.id)&&(g.id==="camp"||state.crests.length)).map(g=>g.id);
    if(!object(raw.gear))return clean;
    const used=new Set();
    for(const {id} of state.party){
      const item=byId(Object.hasOwn(raw.gear,id)?raw.gear[id]:null);
      if(item&&clean.claimed.includes(item.group)&&!used.has(item.id)){clean.gear[id]=item.id;used.add(item.id);}
    }
    return clean;
  }
  function describe(state,loaner=false){
    const kit=state.trailFittings??empty(),atCamp=state.landmark==="camp",inBattle=!!state.battle||loaner;
    return {gear:{...kit.gear},atCamp,inBattle,groups:groupData.map(g=>{
      const claimed=kit.claimed.includes(g.id),eligible=g.id==="camp"||state.crests.length>0;
      const reason=claimed?"Already claimed.":!eligible?"Earn your first Warden crest.":inBattle?"Finish the current encounter.":!atCamp?"Visit a trail camp.":"";
      return {...g,ids:g.ids.slice(),claimed,eligible,available:!reason,reason};
    }),items:items.map(i=>({...i,claimed:kit.claimed.includes(i.group),
      holder:Object.keys(kit.gear).find(id=>kit.gear[id]===i.id)||null}))};
  }
  function plan(state,assignments){
    const no=message=>({ok:false,message});
    if(state.battle)return no("Finish this encounter before changing fittings.");
    if(!object(assignments))return no("Choose owned companions and claimed fittings.");
    const current=state.trailFittings||empty(),gear={...current.gear},used=new Set(),owned=new Set(state.party.map(p=>p.id));
    for(const [id,item] of Object.entries(assignments)){
      if(!owned.has(id)||item!==null&&(!byId(item)||!current.claimed.includes(byId(item).group)||used.has(item)))
        return no("Choose different claimed fittings for owned companions.");
      if(item!==null)used.add(item);
    }
    for(const id of Object.keys(gear))if(Object.hasOwn(assignments,id)||used.has(gear[id]))delete gear[id];
    for(const [id,item] of Object.entries(assignments))if(item!==null)gear[id]=item;
    const changes=state.party.map(({id})=>({id,before:current.gear[id]||null,after:gear[id]||null})).filter(c=>c.before!==c.after);
    return {ok:true,gear,changes};
  }
  function apply(state,assignments){
    const p=plan(state,assignments);if(p.ok){state.trailFittings??=empty();state.trailFittings.gear=p.gear;}
    return p;
  }
  function rosterGear(state){
    const gear=state.trailFittings?.gear||{};
    return Object.fromEntries(state.team.filter(id=>Object.hasOwn(gear,id)).map(id=>[id,gear[id]]));
  }
  function fight(state){
    const gear=rosterGear(state);
    return Object.keys(gear).length?{gear,spent:[]}:null;
  }
  function restoreFight(state,raw){
    if(!object(raw)||!object(raw.gear)||!Array.isArray(raw.spent))return null;
    const gear=rosterGear(state),ids=Object.keys(gear),equipped=Object.values(gear);
    if(!ids.length||Object.keys(raw.gear).length!==ids.length||!ids.every(id=>raw.gear[id]===gear[id])||
      raw.spent.length>ids.length||new Set(raw.spent).size!==raw.spent.length||!raw.spent.every(id=>equipped.includes(id)))return null;
    return {gear,spent:raw.spent.slice()};
  }
  window.WilderTrailFittings=Object.freeze({items,byId,empty,restore,describe,plan,apply,fight,restoreFight});
})();
