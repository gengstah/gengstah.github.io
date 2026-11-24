// Duet roles follow primary affinities. Ordinary matchups use every affinity of the defender.
(() => {
  "use strict";
  const roles=[
    {id:"ward",label:"Cover",terms:["ward","cover","shield"]},
    {id:"mend",label:"Recovery",terms:["mend","heal","healing","recovery"]},
    {id:"relay",label:"Handoff",terms:["relay","handoff","switch"]},
    {id:"lure",label:"Restraint",terms:["lure","restraint","pin"]},
    {id:"mark",label:"Set up",terms:["mark","set up","setup","expose","exposure"]},
    {id:"rush",label:"Breakthrough",terms:["rush","breakthrough","pierce","piercing"]}
  ];
  const fallback=["sprigkit","cindlet","dewfin","mossbell","glimmeray","gustlance"];
  const list=v=>Array.isArray(v)?v:[];
  const clean=text=>String(text??"").trim().toLowerCase().replace(/[-_]+/g," ").replace(/\s+/g," ");
  const byTerm=new Map(roles.flatMap(r=>r.terms.map(t=>[t,r.id])));
  let namedDuets;
  function searchSeed(query) {
    const original=typeof query==="string"?query:"",key=clean(original);
    if(byTerm.has(key))return {role:byTerm.get(key),query:""};
    if(!namedDuets&&window.WilderKinDex&&window.WilderDuets){
      namedDuets=new Map();
      const affinities=Object.keys(window.WilderKinDex.types);
      affinities.forEach((a,i)=>affinities.slice(i).forEach(b=>{
        const pair=window.WilderDuets.score(a,b);
        if(pair)namedDuets.set(clean(pair.name),pair);
      }));
    }
    const duet=namedDuets?.get(key);
    return duet?{role:duet.role,query:duet.name}:{role:"",query:original};
  }
  function create({game,sim=window.WilderSparringBattle.create({game})}) {
    const species=game.species,dex=window.WilderKinDex,kit=window.WilderSparringGear;
    const profile=new Map(),alphabetical=Object.values(species).filter(k=>!k.bonus).sort((a,b)=>a.name.localeCompare(b.name,"en")||a.id.localeCompare(b.id,"en"));
    for(const k of alphabetical){
      const skills=k.skills.filter(s=>!s.trained),signature=window.WilderSparringSignatures?.byId(k.id)||null;
      const data={id:k.id,name:k.name,types:k.types,skills,emberArt:k.emberArt||null,signature};
      const terms=clean([k.id,k.name,...k.types,...skills.map(s=>s.name),data.emberArt?.name,signature?.name].filter(Boolean).join(" "));
      profile.set(k.id,{data,terms,attack:skills.filter(s=>s.kind==="attack")});
    }
    const all=[...profile.keys()];
    let scoredAnchor,scored=new Map(),lastFoe,matchups=new Map();
    const confirmed=new Map();
    function rulesFor(anchor,id) {
      if(scoredAnchor!==anchor){scoredAnchor=anchor;scored=new Map();}
      if(scored.has(id))return scored.get(id);
      const a=species[anchor],candidate=species[id],pair=window.WilderDuets.score(a.type,candidate.type);
      // The Hall notes describe effects under Hall rules, including the switch restriction on a lure.
      const note=window.WilderSparringTeams.scoutDuets(species,[anchor,id])[0];
      const duet={name:pair.name,role:pair.role,label:pair.label,cost:pair.cost,effect:note.detail};
      scored.set(id,duet);return duet;
    }
    function strongest(attacker,defender) {
      let best=null;
      for(const skill of profile.get(attacker).attack){
        const multiplier=dex.effectiveness(skill.type,species[defender].types);
        if(!best||multiplier>best.multiplier||multiplier===best.multiplier&&skill.power>best.power)
          best={id:skill.id,name:skill.name,type:skill.type,multiplier,power:skill.power};
      }
      return best;
    }
    function fit(id,foe) {
      if(!foe)return null;
      if(lastFoe!==foe){lastFoe=foe;matchups=new Map();}
      if(!matchups.has(id))matchups.set(id,{outgoing:strongest(id,foe),incoming:strongest(foe,id)});
      return matchups.get(id);
    }
    function request(o) {
      if(!o||!profile.has(o.anchor)||o.foe&&!profile.has(o.foe)||
          o.role&&o.role!=="all"&&!roles.some(r=>r.id===o.role)||o.catalog!=null&&!Array.isArray(o.catalog))return null;
      const query=clean(o.query);
      return {o,allowed:o.catalog==null?null:new Set(o.catalog),blocked:new Set([o.anchor,...list(o.reserved)]),
        query,queryRole:byTerm.get(query)};
    }
    function candidate(q,id) {
      if(!profile.has(id)||q.blocked.has(id)||q.allowed&&!q.allowed.has(id))return null;
      const {o}=q,p=profile.get(id),duet=rulesFor(o.anchor,id);
      if(o.role&&o.role!=="all"&&o.role!==duet.role||q.queryRole&&q.queryRole!==duet.role)return null;
      if(q.query&&!q.queryRole){
        const terms=p.terms+" "+clean(duet.name);
        if(!terms.includes(q.query))return null;
      }
      return {...p.data,gear:kit.byId(o.gear?.[id]),duet,fit:fit(id,o.foe)};
    }
    function search(options) {
      const q=request(options);
      if(!q)return [];
      const rows=[];
      for(const id of all){
        const row=candidate(q,id);
        if(row)rows.push(row);
      }
      // Natural ordinary affinity, in both directions. Stable ties retain the catalog's name order.
      if(options.foe)rows.sort((a,b)=>b.fit.outgoing.multiplier-a.fit.outgoing.multiplier||a.fit.incoming.multiplier-b.fit.incoming.multiplier);
      return rows;
    }
    function teamOf(lead,others) {
      return [...new Set([lead,...others,...fallback].filter(id=>profile.has(id)))].slice(0,3);
    }
    function build(options,id) {
      const q=request(options),row=q&&candidate(q,id);
      if(!row)return null;
      const foe=options.foe||list(options.rivals).find(k=>profile.has(k))||"mossbell",anchor=options.anchor;
      const left=teamOf(anchor,[id,...list(options.team),...list(options.reserved),...list(options.catalog)]);
      const right=teamOf(foe,list(options.rivals));
      const gear=kit.normalize({left:options.gear,right:options.foeGear},left,right);
      return {row,foe,setup:{left,right,gear,mode:"cpu",rival:"custom"}};
    }
    function exercise(options,id) {
      const context=build(options,id);
      if(!context)return null;
      const {row,foe,setup}=context;
      return {setup,first:0,moves:[],anchor:options.anchor,partner:id,foe,duetId:"duet:"+id,role:row.duet.role,cost:row.duet.cost};
    }
    function bestAttack(pos) {
      return sim.options(pos).filter(m=>m.available&&m.kind==="attack").reduce((a,b)=>b.damage>a.damage?b:a);
    }
    function preview(options,id) {
      const context=build(options,id);
      if(!context)return null;
      const {row,foe,setup}=context,{left,right,gear}=setup;
      const key=JSON.stringify([left,right,gear]);
      let result=confirmed.get(key);
      if(!result){
        // Three pristine opening positions. The comparison does not spend a turn or grant any beats.
        const front=[left[1],left[0],left[2]],opening=sim.start(left,right,0,gear);
        result={foe,ordinary:bestAttack(sim.start(front,right,0,gear)),reply:bestAttack(sim.start(front,right,1,gear)),
          duetMove:sim.forecast(opening,"duet:"+id),candidateHp:opening.sides[0].team[1].maxHp,
          foeHp:opening.sides[1].team[0].maxHp,openingBeats:opening.sides[0].beats,opening};
        if(confirmed.size>=32)confirmed.delete(confirmed.keys().next().value);
        confirmed.set(key,result);
      }
      // An exercise caller can keep or modify its position without changing subsequent previews.
      return {...row,...JSON.parse(JSON.stringify(result))};
    }
    return {roles:roles.map(({id,label})=>({id,label})),search,preview,exercise};
  }
  window.WilderPartnerSearch=Object.freeze({create,searchSeed});
})();
