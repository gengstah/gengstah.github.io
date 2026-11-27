// Finch's second outing carries an owned pair to actual wild tracks in Mossbrook.
(() => {
  "use strict";
  const route="first-trail-partners",huntKey="wilderkin.first-hunt.v1";
  const trails={
    gustlance:"A long-winged Gustlance is circling the clearing.",
    leafshuttle:"A Leafshuttle keeps slipping between the low branches.",
    charquill:"A Charquill is warming its wings beside the trail.",
    mossbell:"A Mossbell has left little bell-shaped tracks in the moss."
  };
  const favorites={sprigkit:"gustlance",cindlet:"leafshuttle",dewfin:"charquill",opalclasp:"mossbell"};
  const same=(a,b)=>a.length===b.length&&a.every((id,i)=>id===b[i]);

  function create({game,practice,row,image,go,notify,locate,openTrail,openField,rehearse}){
    const s=()=>game.state,member=id=>s().party.find(p=>p.id===id),name=id=>game.kin(id,{owned:true})?.name||"Companion";
    const btn=(key,label,value=null,detail="",extra={})=>row("trailmate-"+key,label,value,detail,extra);
    const show=(page=null)=>go(route,page);
    let lead=null,partner=null,team=[],sourceTeam=[],pending=null,search="",picking="lead",stamp="",cachedHunt=null;
    const cache=new Map();
    function receipt(){
      const r=game.firstBattle?.read()?.receipt;
      return r?.foe==="opalclasp"&&["victory","recruited"].includes(r.outcome)&&member(r.lead)?r:null;
    }
    const local=()=>!!receipt()&&s().region===0&&!s().battle&&!s().crests.includes(0);
    const signature=r=>JSON.stringify([r.lead,r.outcome,r.turn,r.activeId,r.foeHp,r.partyHp,r.text]);
    function remember(value){
      cachedHunt=value;
      try{if(value)window.sessionStorage?.setItem(huntKey,JSON.stringify(value));else window.sessionStorage?.removeItem(huntKey);}
      catch{ /* The current page can still carry the hunt to the tracks. */ }
    }
    function hunt(){
      if(!cachedHunt){
        try{const raw=window.sessionStorage?.getItem(huntKey);if(raw&&raw.length<=3200)cachedHunt=JSON.parse(raw);}catch{return null;}
      }
      const h=cachedHunt,r=receipt();
      if(!h)return null;
      if(!r||h.source!==signature(r)||!["planned","active","done"].includes(h.phase)||h.region!==0||
          !Object.hasOwn(trails,h.foe)||!Array.isArray(h.team)||h.team.length>6||new Set(h.team).size!==h.team.length||
          !h.team.every(member)||!h.team.includes(h.lead)||h.partner!==null&&(!h.team.includes(h.partner)||h.partner===h.lead)||
          !game.kin(h.lead,{owned:true}).skills.some(k=>k.id===h.skill)){
        remember(null);return null;
      }
      if(h.phase==="active"&&!s().battle){
        if(s().wins>h.wins||(!h.previouslyOwned&&member(h.foe)))remember({...h,phase:"done"});
        else remember(null);
      }
      return cachedHunt;
    }
    function entry(){
      const h=hunt(),r=receipt();
      if(!local()||h?.phase==="done")return null;
      const recruited=r.outcome==="recruited"&&member("opalclasp");
      return row("nav",recruited?"Choose Opalclasp’s next hunt":"Choose "+name(r.lead)+"’s next partner",route,
        recruited?"Pick a teammate and follow another set of tracks.":"Pick who leads the next hunt in Mossbrook.",{image:image(recruited?"opalclasp":r.lead,true),tone:"primary"});
    }
    function bind(card){
      const h=hunt(),b=s().battle;
      if(!h||h.phase==="done")return;
      if(h.phase==="planned"&&card&&b?.kind==="wild"&&!b.firstBattle&&b.enemy.id===h.foe&&b.activeId===h.lead&&s().region===0&&
        card.kind==="wild"&&card.region===0&&card.foe===h.foe&&card.lead===h.lead&&same(h.team,card.team)&&same(h.team,s().team)){
        remember({...h,phase:"active",wins:s().wins,previouslyOwned:!!member(h.foe)});
      }else remember(null);
    }
    function battleSection(){
      const b=s().battle,h=hunt();
      if(!b||!h||h.phase!=="active"||b.kind!=="wild"||b.firstBattle||b.wildCall?.answered||b.pendingFallen||b.enemy.id!==h.foe||
          b.activeId!==h.lead||s().region!==h.region||!same(s().team,h.team))return null;
      if(h.intent==="befriend"&&!member(h.foe)&&s().bag.kinweave){
        const capture=game.captureStatus(),safe=game.ordinaryForecast("trail-feint");
        const foeName=name(h.foe);
        const strike=game.kin(h.lead,{owned:true}).skills.map(k=>game.ordinaryForecast(k.id))
          .filter(f=>f?.available&&f.finishes).sort((a,b)=>b.damage-a.damage)[0];
        if(capture.available)return {title:"Befriend "+foeName,rows:[
          row("capture","Cast Kinweave",null,capture.offer.preview+" · 1 Kinweave",{tone:"primary"}),
          ...(strike?[row("skill","Finish with "+strike.skill.name,strike.skill.id,"Knocks out "+foeName+" before its reply.")]:[])
        ]};
        if(safe?.available)return {title:"Befriend "+foeName,rows:[row("skill","Hold back","trail-feint",
          safe.damage+" damage · leaves "+Math.max(1,b.enemy.hp-safe.damage)+" HP · take "+safe.returnDamage,{tone:"primary"})]};
      }
      if(b.turn===1){
        const f=game.ordinaryForecast(h.skill);
        if(f?.available)return {title:"Your hunt opening",rows:[row("skill",name(h.lead)+" · "+f.skill.name,h.skill,
          (f.skill.kind==="heal"?"Recover "+f.healing+" HP":f.damage+" damage")+" · take "+f.returnDamage+" HP in reply.",{image:image(h.lead,true)})]};
      }
      if(b.turn===2&&h.partner){
        const d=game.duets().options.find(o=>o.partnerId===h.partner);
        if(d?.available)return {title:"Your trail partner",rows:[row("duet",d.name+" with "+name(h.partner),h.partner,
          d.cost+" beats · "+d.preview+".",{image:image(h.partner,true)})]};
      }
      return null;
    }
    const legal=(a,b)=>a!==b&&!!member(a)&&!!member(b);
    function defaultPartner(id,r){
      const ids=[r?.lead,r?.outcome==="recruited"?"opalclasp":null,...team,...s().party.map(p=>p.id)];
      return ids.find(other=>legal(id,other)&&team.includes(other)&&member(other).hp>0)||
        ids.find(other=>legal(id,other)&&team.includes(other))||null;
    }
    function reset(){
      const r=receipt();sourceTeam=s().team.slice();team=sourceTeam.slice();
      lead=r?.outcome==="recruited"&&member("opalclasp")?"opalclasp":r?.lead||s().lead;
      pending=null;search="";picking="lead";
      if(!team.includes(lead)){
        if(team.length<6)team.push(lead);
        else {pending={role:"lead",id:lead};lead=s().lead;}
      }
      partner=defaultPartner(lead,r);cache.clear();
    }
    function open(){reset();show(pending?"seat":null);}
    function refresh(){
      if(!team.length||!same(s().team,sourceTeam)||!member(lead)||partner&&!member(partner)||!team.every(member))reset();
      const key=JSON.stringify([s().party.map(k=>[k.id,k.hp,k.maxHp,k.level]),s().growth,s().trainedGuards,s().trailFittings,s().seen,s().firstBattle,s().region]);
      if(key!==stamp){cache.clear();stamp=key;}
    }
    function assign(role,id,outgoing){
      if(!member(id)||!["lead","partner"].includes(role))return null;
      const ids=team.slice();
      if(!ids.includes(id)){
        if(ids.length<6)ids.push(id);
        else {
          const at=ids.indexOf(outgoing);
          if(at<0||outgoing===(role==="lead"?partner:lead))return null;
          ids[at]=id;
        }
      }
      const a=role==="lead"?id:id===lead?partner:lead;
      const b=role==="partner"?id:id===partner?lead:partner;
      return a!==b&&ids.includes(a)&&(!b||ids.includes(b))?{lead:a,partner:b,team:ids}:null;
    }
    function select(role,id,outgoing){
      if(!member(id))return;
      const next=assign(role,id,outgoing);
      if(!next){
        if(!team.includes(id)&&team.length===6){pending={id,role};show("seat");}
        return;
      }
      team=next.team;lead=next.lead;partner=next.partner;pending=null;show();
    }
    const setup=(ids,head,foe)=>({kind:"wild",region:0,foe,lead:head,team:ids.slice()});

    // Forecast both turns with the actual travelers' HP, levels and fittings.
    function project(ids,head,helper,foe){
      const scope=practice.preview(setup(ids,head,foe),true);if(!scope)return null;
      const leadHp=member(head).hp,kin=scope.kin(head,{owned:true});
      const pair=helper&&scope.duets().options.find(p=>p.partnerId===helper);
      const forecast=kin.skills.filter(k=>!k.trained&&["guard","attack","heal"].includes(k.kind)).map(k=>{
        const f=scope.ordinaryForecast(k.id);
        return f?.available?{id:k.id,name:k.name,role:k.kind,type:k.type,damage:f.damage,healing:f.healing,reply:f.returnDamage,hpAfter:leadHp+f.healing-f.returnDamage}:null;
      }).filter(Boolean).sort((a,b)=>Number(b.hpAfter>0)-Number(a.hpAfter>0)||b.damage-a.damage||a.reply-b.reply);
      if(!forecast.length)return null;
      const move=forecast[0],guard=forecast.find(k=>k.role==="guard"&&k.id!==move.id);
      let follow=null;
      if(leadHp>0&&scope.useSkill(move.id).ok&&scope.state.battle?.activeId===head&&!scope.replacements()){
        const duet=scope.duets().options.find(p=>p.partnerId===helper);
        if(duet)follow={available:duet.available,reason:duet.reason,damage:duet.damage,reply:duet.returnDamage,beats:scope.state.battle.beats};
      }
      return {foe,lead:head,partner:helper,move,guard,foeName:name(foe),pair:pair?{name:pair.name,role:pair.role,cost:pair.cost}:null,follow};
    }
    function report(ids,head,helper){
      const key=JSON.stringify([ids,head,helper]);
      if(cache.has(key))return cache.get(key);
      const targets=practice.targets(0).filter(t=>t.kind==="wild"&&Object.hasOwn(trails,t.foe));
      const preferred=targets.find(t=>favorites[head]===t.foe);
      const options=(preferred?[preferred]:targets).map(t=>project(ids,head,helper,t.foe)).filter(Boolean);
      options.sort((a,b)=>Number(b.move.hpAfter>0)-Number(a.move.hpAfter>0)||b.move.damage-a.move.damage||a.move.reply-b.move.reply);
      const result=options[0]||null;
      if(cache.size>=30)cache.clear();
      cache.set(key,result);return result;
    }
    function summary(r){
      if(!r)return "Choose a local trail.";
      if(member(r.lead).hp<=0)return name(r.lead)+" needs a rest before leading.";
      return r.move.name+(r.move.role==="heal"?" restores "+r.move.healing+" HP":" deals "+r.move.damage+" to "+r.foeName)+" · "+r.move.reply+" HP in reply.";
    }
    function pairNote(r){
      if(!r?.pair)return "Another conscious companion can join in a duet.";
      const opening=name(r.lead)+" + "+name(r.partner)+" · "+r.pair.role+" · "+r.pair.cost+" beats. ";
      if(!member(r.partner).hp)return opening+name(r.partner)+" needs to rest before joining in.";
      if(!r.follow)return opening+"The opening leaves no duet with this pair on turn two.";
      if(!r.follow.available)return opening+"After "+r.move.name+" the meter is at "+r.follow.beats+"/3. "+r.follow.reason;
      return opening+"After "+r.move.name+", deal "+r.follow.damage+" more on turn two and take "+r.follow.reply+" HP in reply.";
    }
    function goals(){
      const lodge=game.regions[0],gate=game.trialAccess(0);
      return {title:"Other paths",rows:[
        btn("mossbell","Watch Mossbell at its nest",null,"Read the signs and offer a peaceful bond.",{image:image("mossbell",false)}),
        btn("fern","Visit Warden "+lodge.warden,null,lodge.crest+" · "+gate.reason)
      ]};
    }
    function picker(role,page){
      const ids=[...new Set([role==="lead"?lead:partner,...team,...s().party.map(p=>p.id)].filter(Boolean))]
        .filter(id=>!search||[name(id),game.species[id].name,...game.species[id].types].join(" ").toLowerCase().includes(search.toLowerCase()));
      const last=Math.max(0,Math.ceil(ids.length/4)-1),at=Math.min(last,Math.max(0,Number(page)||0));
      const rows=ids.slice(at*4,(at+1)*4).map(id=>{
        const temp=assign(role,id),r=temp&&report(temp.team,temp.lead,temp.partner);
        const signature=game.kin(id,{owned:true}).skills.find(k=>k.kind==="attack")?.name;
        const note=r?(role==="lead"?"Track "+r.foeName+". "+summary(r):(signature?signature+". ":"")+(r.pair?.name||"No duet")+" · "+pairNote(r)):
          "Choose a traveling seat to bring this reserve along.";
        return btn(role==="lead"?"lead":"partner",name(id),id,note,{image:image(id,true),badge:id===(role==="lead"?lead:partner)?"Selected":team.includes(id)?"Traveler":"Reserve"});
      });
      return {title:role==="lead"?"Who takes the lead?":"Who joins the duet?",kicker:"MOSSBROOK   /   SECOND OUTING",
        subtitle:role==="lead"?"See which tracks each companion can follow.":"Compare each partner with "+name(lead)+" against the same quarry. Selecting the lead exchanges their roles.",
        sections:[{title:"Owned companions · "+(at+1)+"/"+(last+1),rows},{rows:[btn("search",search?"Search · "+search:"Find a companion",role),
          ...(at?[btn("page","Previous companions",role+":"+(at-1))]:[]),...(at<last?[btn("page","More companions",role+":"+(at+1))]:[]),btn("home","Back to the hunt")]}]};
    }
    function model(view){
      if(!local())return {title:"Mossbrook trail partners",kicker:"TRAILHEAD",subtitle:s().battle?"Your companions are in an encounter.":"Finch meets new teams here after their first Opalclasp encounter.",sections:[
        {rows:[row("root",s().battle?"Return to the encounter":"Return to the trail"),row("nav","Visit your party","party")]}]};
      refresh();
      if(pending&&(!view||view==="seat")){
        const other=pending.role==="lead"?partner:lead;
        return {title:"A seat for "+name(pending.id),kicker:"TRAIL PARTY   /   SIX SEATS",subtitle:"Choose who stays in reserve. You’ll review the full party before leaving.",
          sections:[{rows:team.filter(id=>id!==other).map(id=>btn("seat","Replace "+name(id),id,member(id).hp+"/"+member(id).maxHp+" trail HP",{image:image(id,true)}))},
            {rows:[btn("home","Keep my travelers")]}]};
      }
      const [place,role,page]=String(view||"").split(":");
      if(place==="pick"&&["lead","partner"].includes(role)){picking=role;return picker(role,page);}
      const r=report(team,lead,partner),ready=member(lead).hp>0;
      const slots=[lead,partner].filter(Boolean).map((id,i)=>({id,name:name(id),lead:i===0,src:image(id,true),level:member(id).level,hp:member(id).hp,maxHp:member(id).maxHp,
        action:btn(i?"partners":"leads",i?"Choose your duet partner":"Choose the hunt leader")}));
      const changing=!same(team,s().team);
      const first=r&&ready?btn("follow",changing?"Review team for "+r.foeName:"Track "+r.foeName+" with "+name(lead),r.foe,
        (changing?"Review the traveling seats. ":"")+name(lead)+" will lead at "+member(lead).hp+"/"+member(lead).maxHp+" HP.",{image:image(r.foe,false),tone:"primary"}):
        btn("rest","Walk to the campfire",null,"Rest your companions before setting out.",{tone:"primary"});
      return {title:"Your next hunt",kicker:"MOSSBROOK   /   TRAIL PARTNERS",formationStrip:{label:"Hunt leader · Duet partner",slots},
        subtitle:r?trails[r.foe]:"Choose a companion to follow the tracks.",
        sections:[{title:r&&ready?"Choose your hunt goal":undefined,rows:[
          ...(r&&ready&&!member(r.foe)?[btn("befriend","Befriend "+r.foeName,r.foe,s().bag.kinweave?"Weaken it safely, then offer one Kinweave.":"Craft a Kinweave in your satchel first.",{tone:"primary",disabled:!s().bag.kinweave})]:[]),
          r&&ready?{...first,detail:"Defeat the quarry for experience. "+first.detail}:first]},...(r&&ready?[{title:"Opening against "+r.foeName,rows:[
          {label:r.move.name,detail:summary(r)+" "+name(lead)+(r.move.hpAfter>0?" ends at "+r.move.hpAfter+"/"+member(lead).maxHp+" HP.":" would faint."),image:image(lead,true)},
          ...(r.guard?[{label:r.guard.name,detail:"Guard instead · "+r.guard.damage+" damage · "+r.guard.reply+" HP in reply.",image:image(lead,true)}]:[]),
          ...(r.pair?[{label:r.pair.name,detail:pairNote(r),image:image(partner,true)}]:[])]}]:[]),
          {title:"Choose your team",rows:[...(r&&rehearse?[btn("rehearse","Try this team at the Chalkyard",r.foe,"Practice this matchup with copies of your companions.")]:[]),btn("leads","Change hunt leader",null,"See another companion’s move and quarry."),btn("partners","Choose a duet partner",null,"Compare a traveling ally or a specialist from reserve.")]},goals()]};
    }
    function act(id,value){
      if(typeof id!=="string"||!id.startsWith("trailmate-"))return false;
      if(!local()){go("world",null,"root");return true;}
      refresh();
      switch(id){
        case "trailmate-home":pending=null;show();break;
        case "trailmate-leads":case "trailmate-partners":picking=id.endsWith("leads")?"lead":"partner";search="";pending=null;show("pick:"+picking+":0");break;
        case "trailmate-page":if(/^(lead|partner):\d{1,3}$/.test(value))show("pick:"+value);break;
        case "trailmate-search":{
          const next=window.prompt("Find an owned companion by name or affinity",search);
          if(next!==null){search=next.trim().slice(0,60);show("pick:"+picking+":0");}break;
        }
        case "trailmate-lead":select("lead",value);break;
        case "trailmate-partner":select("partner",value);break;
        case "trailmate-seat":if(pending)select(pending.role,pending.id,value);break;
        case "trailmate-mossbell":{const site=game.sightings().find(k=>k.species==="mossbell");if(site)locate(site.id);break;}
        case "trailmate-fern":locate("warden","warden");break;
        case "trailmate-rest":locate("camp","camp");break;
        case "trailmate-rehearse":{
          const r=report(team,lead,partner);
          if(r?.foe===value)rehearse?.(setup(team,lead,r.foe));
          break;
        }
        case "trailmate-befriend":case "trailmate-follow":{
          const r=report(team,lead,partner);
          if(!r||r.foe!==value||!member(lead).hp||id==="trailmate-befriend"&&(!s().bag.kinweave||member(r.foe))){notify("Review the hunt with your current companions.");show();break;}
          const plan=setup(team,lead,r.foe);
          remember({...plan,partner,intent:id==="trailmate-befriend"?"befriend":"defeat",skill:r.move.id,source:signature(receipt()),phase:"planned"});
          if(!same(team,s().team)){openTrail(plan);break;}
          if(s().lead!==lead){const res=game.setLead(lead);if(!res.ok){remember(null);notify(res.message);break;}}
          openField(plan);break;
        }
      }
      return true;
    }
    return {entry,open,reset,model,act,bind,battleSection,clear:()=>{remember(null);team=[];sourceTeam=[];pending=null;cache.clear();}};
  }
  window.WilderFirstTrailPartners=Object.freeze({create});
})();
