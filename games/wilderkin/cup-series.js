// The registered six, sealed opposing trio and public move tapes belong to the tournament.
(() => {
  "use strict";
  const empty=()=>({v:1,cabinet:{},entry:null});
  const distinct=(ids,valid,min,max)=>Array.isArray(ids)&&ids.length>=min&&ids.length<=max&&new Set(ids).size===ids.length&&[...ids].every(valid);
  const known=(species,id)=>typeof id==="string"&&Object.hasOwn(species,id)&&!species[id].bonus;
  const captain=(rules,id)=>rules.captains.find(c=>c.id===id);
  const cloneKit=gear=>({left:{...gear.left},right:{...gear.right}});
  const flat=m=>({left:m.setup.left.slice(),right:m.setup.right.slice(),first:m.first,human:0,gear:cloneKit(m.setup.gear),moves:m.moves.slice()});
  function seal(e,rules){
    if(!e.locked||rules.score(e.rounds).done)return [];
    return rules.commit(e.captain,e.roster,e.rounds,e.gear)?.team.slice()||[];
  }
  function makeMatch(c,number,t){
    return {cupOpponent:c.name,gameNumber:number,setup:{mode:"cpu",rival:c.id,left:t.left.slice(),right:t.right.slice(),gear:cloneKit(t.gear)},
      first:t.first,moves:t.moves.slice(),handoff:false};
  }
  function sheet(s,species,min=0){
    if(!s||!distinct(s.roster,id=>known(species,id),min,6))return null;
    const kit=window.WilderSparringGear.validate({left:s.gear??{}},s.roster,[]);
    return kit?{roster:s.roster.slice(),gear:kit.left}:null;
  }
  function restore(raw,{species}) {
    const clean=empty();if(!raw||raw.v!==1)return clean;
    const sim=window.WilderSparringBattle.create({species}),rules=window.WilderCupRules.create({species,sim});
    for(const c of rules.captains){
      const item=raw.cabinet?.[c.id],win=sheet(item,species,6);
      if(!win)continue;
      const films=rules.validateHistory(c.id,win.roster,win.gear,item.rounds);
      if(!films||rules.score(films).winner!==0)continue;
      win.rounds=films;
      clean.cabinet[c.id]=win;
    }
    const saved=raw.entry;if(!saved)return clean;
    const c=captain(rules,saved.captain),locked=saved.locked===true,reg=sheet(saved,species,locked?6:0);
    if(!reg||(!c&&locked))return clean;
    const e={captain:c?.id||null,...reg,locked,picks:[],rounds:[],match:null,sealed:[]};clean.entry=e;
    if(!locked)return clean;
    // An interrupted or malformed final bout cannot invalidate an earlier completed bout.
    let rounds=Array.isArray(saved.rounds)?saved.rounds.slice(0,3):[];
    const originalLength=rounds.length;
    while(rounds.length){
      const valid=rules.validateHistory(c.id,e.roster,e.gear,rounds);
      if(valid){e.rounds=valid;break;}
      rounds=rounds.slice(0,-1);
    }
    const score=rules.score(e.rounds);
    if(score.done){
      if(score.winner===0)clean.cabinet[c.id]={...reg,rounds:e.rounds};
      return clean;
    }
    e.sealed=seal(e,rules);
    if(originalLength!==e.rounds.length)return clean;
    if(distinct(saved.picks,id=>e.roster.includes(id),0,3))e.picks=saved.picks.slice();
    const m=saved.match,s=m?.setup;
    if(s&&Array.isArray(m.moves)){
      const tape={left:s.left,right:s.right,gear:s.gear,first:m.first,moves:m.moves};
      const held=rules.validateMatch(c.id,e.roster,e.gear,e.rounds,tape);
      if(held&&held.pos.phase!=="done"){
        e.match=makeMatch(c,e.rounds.length+1,held.tape);e.picks=e.match.setup.left.slice();
      }
    }
    return clean;
  }
  function create({game,sim,row,image,show,render,notify,read,save,startFight}) {
    const species=game.species,rules=window.WilderCupRules.create({species,sim}),cup=()=>read()||empty(),entry=()=>cup().entry;
    const name=id=>species[id].name;
    const button=(id,label,value,detail="",extra={})=>row("cup-series-"+id,label,value,detail,extra);
    const link=(label,path,detail="",extra={})=>button("open",label,path,detail,extra);
    const group=(title,rows,columns=1)=>({title,rows,columns});
    const field=()=>entry()?.match||null,closed=e=>rules.score(e.rounds).done;
    let film=null;
    const reviewRow=(id,label,...args)=>row(id,id==="spar-review-leave"?(film?.back==="cup:cabinet"?"Return to Cup cabinet":"Return to the Cup desk"):label,...args);
    const reviewer=window.WilderSparringReview.create({game,row:reviewRow,image,read:()=>film?.tape||null,
      go:(screen,value)=>show(screen==="sparring-review"?film.path+":"+(value||"p0"):film.back,"replace")});
    const update=e=>save({...cup(),entry:e});
    // The desk may change a draft or a bring order. Only resolved combat can change official rounds.
    function write(s){
      const previous=entry();
      if(!s||previous?.match)return false;
      if(previous?.locked&&!closed(previous)){
        if(s.captain!==previous.captain||!s.locked||!distinct(s.picks,id=>previous.roster.includes(id),0,3))return false;
        update({...previous,picks:s.picks.slice()});return true;
      }
      const c=captain(rules,s.captain),locked=s.locked===true,reg=sheet(s,species,locked?6:0);
      if(!reg||(!c&&locked))return false;
      const e={captain:c?.id||null,...reg,locked,picks:[],rounds:[],match:null,sealed:[]};
      if(locked){
        e.sealed=seal(e,rules);if(e.sealed.length!==3)return false;
        if(distinct(s.picks,id=>e.roster.includes(id),0,3))e.picks=s.picks.slice();
      }
      update(e);return true;
    }
    function start(ids) {
      const e=entry();if(!e||!e.locked||e.match||closed(e)||!distinct(ids,id=>e.roster.includes(id),3,3)||e.sealed.length!==3)return false;
      const c=captain(rules,e.captain),gear={left:rules.selectGear(ids,e.gear),right:rules.selectGear(e.sealed,c.gear)};
      const m=makeMatch(c,e.rounds.length+1,{left:ids,right:e.sealed,gear,first:rules.first(e.rounds.length),moves:[]});
      if(!sim.start(m.setup.left,m.setup.right,m.first,m.setup.gear))return false;
      update({...e,picks:ids.slice(),match:m});startFight(m);return true;
    }
    function finish(m,winner,conceded) {
      const e=entry();if(!e||e.match!==m)return false;
      const next={...e,match:null,picks:[],rounds:[...e.rounds,{...flat(m),winner,conceded}]};
      next.sealed=seal(next,rules);
      const r=cup(),score=rules.score(next.rounds);
      const cabinet=score.done&&score.winner===0?{...r.cabinet,[e.captain]:{roster:e.roster.slice(),gear:{...e.gear},rounds:next.rounds}}:r.cabinet;
      save({...r,cabinet,entry:next});return true;
    }
    function saveTurn(m,p) {
      if(field()!==m)return false;
      if(p.phase==="done")return finish(m,p.winner,false);
      update({...entry(),match:m});return true;
    }
    function cabinet() {
      const records=cup().cabinet;
      return {title:"Cup cabinet",kicker:"LANTERN CUP",sections:rules.captains.flatMap(c=>{
        const win=records[c.id];
        if(!win)return [{title:c.name,text:"Win a series against this captain to record your six."}];
        const team=group(c.name+" · cleared",win.roster.map(id=>({label:name(id),image:image(id),detail:win.gear[id]?window.WilderSparringGear.byId(win.gear[id]).name:"Winning roster"})),3);
        const films=(win.rounds||[]).flatMap((t,i)=>t.conceded?[]:[link("Replay bout "+(i+1),"cup:archive:"+c.id+":"+i,t.winner===0?"Win":t.winner===1?"Loss":"Draw")]);
        return films.length?[team,group("Winning series films",films)]:[team];
      }).concat(group("Tournament desk",[link("Back to the Cup","cup")]))};
    }
    const desk=window.WilderCupDesk.create({species,sim,rules,row,image,show,render,notify,start,write,
      read:()=>({series:entry(),cabinet:cup().cabinet,hallSetup:game.state.sparring.setup})});
    function overview(){
      const page=desk.model("cup:desk");const e=entry();
      if(!page.sections.some(s=>s.rows?.some(r=>r.value==="cup:cabinet")))page.sections.push(group("Trophies",[link("Cup cabinet","cup:cabinet")]));
      if(e?.rounds.length){
        const shown=new Set(page.sections.flatMap(s=>(s.rows||[]).map(r=>r.value)));
        const missing=e.rounds.flatMap((r,i)=>r.conceded||shown.has("cup:replay:"+i)?[]:[link("Replay game "+(i+1),"cup:replay:"+i)]);
        if(missing.length)page.sections.push(group("Match films",missing));
      }
      return page;
    }
    function model(v){
      film=null;
      if(v==="cup:cabinet")return cabinet();
      if(v==="cup:concede"&&field())return {title:"Concede game "+field().gameNumber+"?",kicker:"LANTERN CUP",
        subtitle:field().cupOpponent+" receives this game. The scorecard will record a concession.",
        sections:[group("Match desk",[link("Keep playing","cup:match","",{tone:"primary"}),button("concede","Concede this game",field().gameNumber+"/"+field().moves.length)])]};
      const path=/^cup:(?:replay|film|archive:([a-z]+)):([0-2])(?::(.*))?$/.exec(v);
      if(path){
        const c=path[1],i=Number(path[2]),t=c?cup().cabinet[c]?.rounds?.[i]:entry()?.rounds[i];
        if(!t||t.conceded)return c?cabinet():overview();
        film={tape:t,back:c?"cup:cabinet":"cup",path:c?"cup:archive:"+c+":"+i:"cup:film:"+i};
        const page=reviewer.model(path[3]||"p0");
        return {...page,kicker:"LANTERN CUP · GAME "+(i+1)+"   /   "+page.kicker};
      }
      if(["cup","cup:result","cup:desk","cup:match","cup:concede"].includes(v))return overview();
      return desk.model(v)||overview();
    }
    function act(id,value){
      if(id==="cup-series-open"){show(value);return true;}
      if(id==="cup-series-concede"){
        const m=field();
        if(m&&value===m.gameNumber+"/"+m.moves.length){finish(m,1,true);show("cup:result","replace");}
        return true;
      }
      if(film&&reviewer.act(id,value))return true;
      return desk.act(id,value);
    }
    return {field,model,act,saveTurn,key:(e,v)=>desk.key(e,v)};
  }
  window.WilderCupSeries={restore,create};
})();
