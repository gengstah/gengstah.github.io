// The volunteer signal crews lend a party for one course. Only its record touches the courier's save.
(() => {
  "use strict";
  const level=18;
  const modes={round:{name:"Courier Round",legs:3},night:{name:"Night Shift",legs:4}};
  const pool=["sprigkit","cindlet","dewfin","pincoil","gustlance","cragtup","rimecurl","hushplume","boltbur","chimeskater","ferribill","glimmeray"];
  const courses=[
    {name:"Mill race",condition:"shelter",region:0,routes:[
      {name:"Turbine bank",foes:["dewfin","pincoil"],text:"The skiff crew patrols the turbine intake."},
      {name:"Clay spillway",foes:["cragtup","ferribill"],text:"Two heavy gatekeepers hold the exposed bank."}]},
    {name:"Tower cable",condition:"gale",region:1,routes:[
      {name:"Signal loft",foes:["chimeskater","hushplume"],text:"The white pennant marks an open return circuit."},
      {name:"Lightning mast",foes:["pincoil","gustlance"],text:"A repair crew is testing the lightning rod."}]},
    {name:"Glass quarry",condition:"echo",region:2,routes:[
      {name:"Fog tunnel",foes:["hushplume","ferribill"],text:"The lantern crew walks the old mine galleries."},
      {name:"Reflector pit",foes:["rimecurl","chimeskater"],text:"The pit keeps the sound of your last attack."}]},
    {name:"Ridge ladder",condition:"ledge",region:1,routes:[
      {name:"Shelter stairs",foes:["sprigkit","cragtup"],text:"Climb the stone stairs to the night watch."},
      {name:"High wire",foes:["gustlance","cindlet"],text:"The bell runners have the high ground."}]},
    {name:"Bell causeway",condition:"gale",region:0,routes:[
      {name:"Raft launch",foes:["glimmeray","rimecurl"],text:"A ferry signals from the calmer crossing."},
      {name:"Weir bridge",foes:["boltbur","dewfin"],text:"The toll keepers have stationed two kin on the bridge."}]},
    {name:"Lantern kiln",condition:"echo",region:2,routes:[
      {name:"Ash steps",foes:["cindlet","sprigkit"],text:"A watch lamp guides you down the cutters’ steps."},
      {name:"Copper chamber",foes:["ferribill","pincoil"],text:"Twin copper rails ring as the watch crew approaches."}]}
  ];
  const empty=()=>({version:1,board:0,best:{round:0,night:0},run:null});
  const number=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
  const scoreValue=v=>number(v,0,99999)?v:0;
  const unique=ids=>new Set(ids).size===ids.length;
  const known=id=>pool.includes(id);
  const openingDeck=board=>Array.from({length:6},(_,i)=>pool[(board*5+i)%pool.length]);
  const station=r=>courses[(r.board+r.leg)%courses.length];
  function invitationCode(mode,board,marks) {
    return "WK1-"+(mode==="night"?"N":"R")+"-"+String(board+1).padStart(2,"0")+(marks==null?"":"-"+marks);
  }
  function parseInvitation(fragment) {
    if(typeof fragment!=="string"||fragment.length>12)return null;
    const m=/^#WK1-(R|N)-(0[1-9]|1[0-2])(?:-([1-9][0-9]?))?$/.exec(fragment);
    if(!m||m[0]!==fragment)return null;
    const mode=m[1]==="N"?"night":"round",target=m[3]?Number(m[3]):null;
    if(target!==null&&(target<modes[mode].legs*2+1||target>modes[mode].legs*5+3))return null;
    return {mode,board:Number(m[2])-1,target,code:fragment.slice(1)};
  }
  function lane(r,route) {
    const site=station(r),data=site.routes[route];
    const count=route===1||r.mode==="night"&&r.leg>=1?2:1;
    const foes=data.foes.slice(0,count);
    if(route===1&&r.mode==="night"&&r.leg===modes.night.legs-1)foes.push(site.routes[0].foes[0]);
    return {...data,foes,marks:route===1?5:2};
  }
  function validParty(p){
    return p && known(p.id) && p.level===level && number(p.maxHp,1,150)&&number(p.hp,0,p.maxHp);
  }
  // If an interrupted save is incomplete the closed course can be redrafted. Career results survive.
  function restore(saved) {
    const record=empty();
    if(!saved||saved.version!==1)return record;
    record.board=number(saved.board,0,11)?saved.board:0;
    for(const mode of Object.keys(modes))record.best[mode]=scoreValue(saved.best?.[mode]);
    const r=saved.run;
    if(!r||!Object.hasOwn(modes,r.mode)||!number(r.board,0,11)||!number(r.leg,0,modes[r.mode].legs-1)
      || !["draft","route","bout","service","cleared","lost"].includes(r.phase)
      || !number(r.marks,0,9999)||!Array.isArray(r.picks)||r.picks.length>3||!unique(r.picks)||!r.picks.every(known))return record;
    if(r.phase==="draft"){
      if(r.picks.some(id=>!openingDeck(r.board).includes(id)))return record;
    }else{
      const f=r.field;
      if(!f||r.picks.length!==3||!Array.isArray(f.team)||!Array.isArray(f.party)||f.team.length!==3||f.party.length!==3
        || !r.picks.every((id,i)=>f.team[i]===id&&f.party[i]?.id===id&&validParty(f.party[i]))
        || !f.team.includes(f.lead)||!number(f.region,0,2))return record;
      if(["bout","service","lost","cleared"].includes(r.phase)&&![0,1].includes(r.route))return record;
      if(r.phase==="bout"){
        const b=f.battle;
        if(!b||b.kind!=="circuit"||!f.team.includes(b.activeId)||!f.party.some(p=>p.id===b.activeId&&p.hp>0)
          ||!validParty(b.enemy)||!b.enemy.hp||!lane(r,r.route).foes.includes(b.enemy.id)
          ||!Array.isArray(b.remaining)||b.remaining.length>=lane(r,r.route).foes.length||!b.remaining.every(id=>lane(r,r.route).foes.includes(id))
          ||!number(b.turn,1,99999)||!number(b.beats,0,3)||!Array.isArray(b.log)||!b.log.every(line=>typeof line==="string"))return record;
      }else if(f.battle)return record;
    }
    if(r.invite){
      const invitation=typeof r.invite==="string"&&parseInvitation("#"+r.invite);
      if(!invitation||invitation.mode!==r.mode||invitation.board!==r.board)delete r.invite;
    }
    record.run=r;
    return record;
  }

  function create({game,row,image,go,render,notify,animate,playTone,active=()=>true}) {
    const record=()=>game.state.circuit||empty();
    const kin=id=>game.species[id];
    const save=rec=>game.saveCircuit(rec);
    const group=(title,rows,columns=1)=>({title,rows,columns});
    const info=(label,detail)=>({label,detail});
    const action=(id,label,value,detail="",extra={})=>row("circuit-"+id,label,value,detail,extra);
    const profile=(p)=>({species:p.id,name:kin(p.id).name,src:image(p.id),hp:p.hp,maxHp:p.maxHp,level:p.level,types:kin(p.id).types});
    const partySummary=r=>group("Loaner team",r.field.party.map(p=>info(kin(p.id).name,p.hp+" / "+p.maxHp+" HP"+(p.id===r.field.lead?" · lead":""))));
    let busy=false,forfeit=false;
    let invitation=parseInvitation(window.location?.hash),showInvitation=Boolean(invitation),copyFallback="";
    window.addEventListener?.("hashchange",()=>{
      invitation=parseInvitation(window.location.hash);showInvitation=Boolean(invitation);copyFallback="";
      if(invitation)go?.("circuit");else if(active())render();
    });
    const liveRun=r=>r&&!["cleared","lost"].includes(r.phase);
    function sharing(r) {
      const code=invitationCode(r.mode,r.board,r.phase==="cleared"?r.marks:null);
      return group("Challenge a friend",[action("copy","Copy challenge link",code,
        copyFallback===code?"Add #"+code+" to the game address to share this course.":"Same draft and routes · "+code)]);
    }
    function newRun(mode,board,invite=null) {
      return {mode,board,invite,picks:[],phase:"draft",leg:0,marks:0,route:null,field:null};
    }
    function model() {
      const rec=record(),r=rec.run;
      const menu={title:"Loaner Circuit",kicker:"MOSSBROOK SIGNAL SCHOOL",viewId:"circuit:desk",sections:[]};
      if(game.state.battle){
        menu.subtitle="The trail encounter is still in progress. Your loaners will wait at the school.";
        return menu;
      }
      if(invitation&&showInvitation&&r?.invite!==invitation.code){
        menu.viewId="circuit:invite:"+invitation.code;menu.title="Course invitation";
        menu.kicker=modes[invitation.mode].name+"   /   BOARD "+(invitation.board+1);
        menu.subtitle=invitation.target===null?"A friend sent you this loaner draft and route board.":"Score to beat: "+invitation.target+" marks. Both crews get the same draft and routes.";
        menu.sections=[group("Course desk",[
          action("join","Accept this challenge",null,liveRun(r)?"Finish or retire your current crew to sign out another.":invitation.code,{disabled:Boolean(liveRun(r)),tone:"primary"}),
          action("dismiss",liveRun(r)?"Continue my current course":"Return to the course desk")])];
        return menu;
      }
      if(!r||r.phase==="cleared"||r.phase==="lost") {
        menu.subtitle="Borrow three level-18 kin. Scout each checkpoint and carry the same team's health to the finish.";
        if(r)menu.sections.push({title:r.phase==="cleared"?"Signal delivered":"Crew recalled",text:r.phase==="cleared"?
          modes[r.mode].name+" cleared with "+r.marks+" marks.":"The crew reached checkpoint "+(r.leg+1)+". The school has recovered all of its loaners."});
        const target=r?.invite?parseInvitation("#"+r.invite)?.target:null;
        if(target!=null&&r.phase==="cleared"){
          const margin=r.marks-target;
          menu.sections.push({title:margin>0?"Challenge beaten":margin===0?"Challenge tied":"Challenge result",
            text:"Your crew scored "+r.marks+" marks against "+target+"."+(margin<0?" Try a higher-paying route or bring more loaners through the finish.":"")});
        }
        menu.sections.push(group("Choose a course",Object.entries(modes).map(([id,m])=>action("start",m.name,id,
          m.legs+" checkpoints · best "+rec.best[id]+" marks"+(id==="night"?" · double formations after the first gate":" · staffed stops and shortcuts"),{disabled:!!game.state.battle}))));
        if(r)menu.sections.push(group("Rematch",[action("replay","Replay this course",r.mode,"Same draft and opponents.",{disabled:!!game.state.battle})]));
        if(r)menu.sections.push(sharing(r));
        if(invitation&&r?.invite!==invitation.code)menu.sections.push(group("Challenge",[action("invite","Review the invitation")]));
        return menu;
      }
      menu.kicker=modes[r.mode].name+"  /  "+r.marks+" MARKS";
      menu.viewId="circuit:"+r.phase+":"+r.leg;
      if(forfeit) {
        menu.viewId+=":retire";menu.title="Recall this crew?";
        menu.sections=[group("The current course will end",[action("resume","Keep riding"),action("retire","Retire the crew")])];
        return menu;
      }
      if(r.phase==="draft"){
        menu.title="Sign out three loaners";menu.subtitle="Choose a trio. The first kin you sign out leads. You can change the lead at every stop.";
        const picks=r.picks,roster=openingDeck(r.board);
        menu.sections.push(group("Loaners · "+picks.length+" / 3",roster.map(id=>{
          const pair=picks.length && !picks.includes(id)?game.duetPair(picks[0],id):null;
          return action("pick",kin(id).name,id,kin(id).types.join(" / ")+(pair?" · "+pair.name+" ("+pair.label+")":""),
            {image:image(id),badge:picks.includes(id)?"SIGNED":"",disabled:picks.length===3&&!picks.includes(id)});
        }),2));
        if(picks.length>1)menu.sections.push(group("Available duets",picks.flatMap((id,i)=>picks.slice(i+1).map(partner=>{
          const pair=game.duetPair(id,partner);return info(pair.name,kin(id).name+" + "+kin(partner).name+" · "+pair.description);
        }))));
        menu.sections.push(group("Dispatch",[action("launch","Meet the course marshal",null,"",{disabled:picks.length!==3,tone:"primary"})]));
      }else if(r.phase==="route"){
        menu.title=station(r).name;menu.subtitle="Checkpoint "+(r.leg+1)+" of "+modes[r.mode].legs+". Read the two formations before committing.";
        menu.sections.push({title:game.conditions[station(r).condition].name,text:game.conditions[station(r).condition].description});
        menu.sections.push(group("Scout the approaches",[0,1].map(index=>{
          const l=lane(r,index);const list=l.foes.map(id=>kin(id).name+" ("+kin(id).types.join("/")+")").join(" → ");
          const reward=r.leg===modes[r.mode].legs-1?"Finish · one extra mark per conscious loaner":(index===0?"45% team recovery offered":"20% team recovery offered");
          const weather=index===1?" · "+kin(l.foes[0]).type+" skills gain 20% on both sides":"";
          return action("route",l.name,index,l.text+" "+list+weather+" · "+reward,{image:image(l.foes[0]),badge:"+"+l.marks});
        })));
        menu.sections.push(group("Choose a leader",r.field.party.map(p=>action("lead",kin(p.id).name,p.id,p.hp+" / "+p.maxHp+" HP",{image:image(p.id),badge:r.field.lead===p.id?"LEAD":"",disabled:!p.hp||r.field.lead===p.id})),3));
      }else if(r.phase==="service"){
        const path=lane(r,r.route),newId=path.foes.at(-1);
        menu.title="Exchange platform";menu.subtitle="Spend the stop on field medicine or exchange one loaner. Health carries into the next checkpoint.";
        menu.sections.push(group("Field medicine",[action("mend","Patch the crew",null,"Restore "+(r.route===0?"45%":"20%")+" maximum HP to each loaner. This also revives downed kin.",{tone:"primary"})]));
        if(!r.picks.includes(newId)) menu.sections.push(group("Trade for "+kin(newId).name,r.field.party.map(p=>
          action("trade","Return "+kin(p.id).name,p.id,"Sign out a fresh "+kin(newId).name+" ("+kin(newId).types.join("/")+")",{image:image(newId)}))));
        else menu.sections.push({text:"This stop’s exchange kin, "+kin(newId).name+", is already in your crew."});
        menu.sections.push(partySummary(r));
      }else{
        return battleModel(r);
      }
      menu.sections.push(sharing(r),group("Course desk",[action("quit","Retire from this course"),
        ...(invitation&&r.invite!==invitation.code?[action("invite","Review the invitation")]:[])]));
      return menu;
    }
    function battleModel(r){
      return game.withLoaners(r.field,()=>{
        const b=game.state.battle,lead=game.team().find(p=>p.id===b.activeId),intent=game.foeIntent(),d=game.duets();
        const sections=[group("Call a skill",kin(lead.id).skills.map((s,i)=>action("skill",s.name,s.id,
          s.kind==="attack"?s.type+" · "+(window.WilderKinDex.effectiveness(s.type,kin(b.enemy.id).types)>1?"advantage":s.description):s.description,
          {key:String(i+1),disabled:s.kind==="heal"&&lead.hp===lead.maxHp})),2),
          {title:"Duets · "+d.beats+" / 3 beats",text:d.hint},
          group("Choose a partner",d.options.map(o=>action("duet",o.name,o.partnerId,kin(o.partnerId).name+" · "+o.preview+(o.reason?" · "+o.reason:""),
            {disabled:!o.available,image:image(o.partnerId),badge:o.cost+" BEATS"}))),
          group("Switch kin",game.team().filter(p=>p.id!==lead.id).map(p=>action("swap",kin(p.id).name,p.id,p.hp+" / "+p.maxHp+" HP",{disabled:!p.hp})),2),
          group("Course desk",[action("quit","Retire from this course")])];
        const pass=game.familyTechnique();
        if(pass)sections.splice(1,0,group(pass.name+" · 1 beat",pass.targets.map(target=>action("pass",target.name,target.id,
          pass.reason||((target.heal?"Restore "+target.heal+" HP · ":"")+target.hpAfter+" / "+target.maxHp+" HP after reply · "+(pass.id==="beacon"?"Mark the rival":"Hand off the lead")),
          {disabled:!pass.available,image:image(target.id)}))));
        const tip=intent.charged?"Charged "+intent.skill.name+" incoming.":intent.guarding?"Foe braced. Guard skills break through.":"";
        return {viewId:"circuit:bout:"+r.leg,kind:"battle",title:lane(r,r.route).name,kicker:modes[r.mode].name+"   /   TURN "+b.turn,
          subtitle:"Checkpoint "+(r.leg+1)+" · "+(b.remaining.length+1)+" opposing kin left · "+game.conditions[b.condition].name+(b.weather?" · "+b.weather+" skills +20%":""),
          theme:game.regions[r.field.region].theme,ally:profile(lead),foe:profile(b.enemy),log:[...b.log.slice(-2),tip].filter(Boolean),sections};
      });
    }
    function launch(r){
      if(r.picks.length!==3)return;
      r.field={region:0,party:r.picks.map(id=>game.loaner(id,level)),team:r.picks.slice(),lead:r.picks[0],battle:null};
      r.phase="route";
    }
    function nextLeg(r){
      if(!r.field.party.find(p=>p.id===r.field.lead).hp)r.field.lead=r.field.party.find(p=>p.hp>0).id;
      r.leg++;r.route=null;r.phase="route";
    }
    function openLane(r,i){
      if(i!==0 && i!==1)return;
      const path=lane(r,i),site=station(r);
      r.field.region=site.region;
      const weather=i===1?kin(path.foes[0]).type:null;
      const outcome=game.withLoaners(r.field,start=>start(path.foes,level,path.text,{condition:site.condition,weather}));
      if(!outcome.ok){notify(outcome.message);return;}
      r.route=i;r.phase="bout";playTone?.("battle");
    }
    async function takeTurn(rec,id,value) {
      if(busy)return;
      busy=true;
      const r=rec.run,b=r.field.battle;
      try {
        const {result,effects}=game.withLoaners(r.field,()=>{
          const lead=kin(b.activeId),intent=game.foeIntent(),original=b.enemy,originalId=b.activeId;
          const model=id==="duet"?game.duets().options.find(o=>o.partnerId===value):lead.skills.find(s=>s.id===value);
          const defender=id==="swap"||id==="pass"||model?.switchLead?value:originalId;
          const fx=id==="duet"?{kind:"duet",name:model?.name,type:lead.type,partnerType:model?.type,partner:known(value)?image(value):null}:
            id==="swap"||id==="pass"?{kind:"swap",name:id==="pass"?game.familyTechnique()?.name:kin(value)?.name,type:kin(value)?.type}:
            {kind:model?.kind,name:model?.name,type:model?.type};
          if(id==="pass"){
            const pass=game.familyTechnique(),target=pass?.targets.find(t=>t.id===value);
            if(target){
              const incomingKin=profile({...game.team().find(p=>p.id===value),hp:target.hpAfter+target.returnDamage});
              Object.assign(fx,{pass:pass.id,incoming:incomingKin.src,incomingKin});
            }
          }
          const result=id==="skill"?game.useSkill(value):id==="swap"?game.swap(value):id==="pass"?game.useFamilyTechnique(value):game.useDuet(value);
          const effects=[];
          if(result.ok){
            effects.push({...fx,side:"ally"});
            if(result.kind==="victory"||b.enemy!==original)effects.push({kind:"defeat",side:"foe",name:kin(original.id).name});
            else{
              effects.push({kind:"attack",side:"foe",type:intent.skill.type,name:intent.skill.name});
              if(result.kind==="defeat" || !game.team().find(p=>p.id===defender).hp)effects.push({kind:"defeat",side:"ally"});
            }
          }
          return {result,effects};
        });
        if(!result.ok){notify(result.message);return;}
        if(result.kind==="defeat")r.phase="lost";
        if(result.kind==="victory"){
          r.marks+=lane(r,r.route).marks;
          if(r.leg===modes[r.mode].legs-1){
            r.phase="cleared";
            r.marks+=r.field.party.filter(p=>p.hp).length;
            rec.best[r.mode]=Math.max(rec.best[r.mode],r.marks);
          }else r.phase="service";
        }
        save(rec);
        playTone?.("strike");
        for(const effect of effects)if(active())await animate?.(effect);
      }finally{busy=false;if(active())render();}
    }
    function act(actionId,value){
      if(!actionId.startsWith("circuit-"))return false;
      if(busy)return true;
      if(game.state.battle){notify("Finish the trail encounter first.");return true;}
      const id=actionId.slice(8),rec=record(),r=rec.run;
      if(invitation&&showInvitation&&r?.invite!==invitation.code&&!["join","dismiss"].includes(id))return true;
      if(id==="copy"&&r){
        const code=invitationCode(r.mode,r.board,r.phase==="cleared"?r.marks:null);
        const fallback=()=>{copyFallback=code;if(active()){render();notify("Share the game address followed by #"+code+".");}};
        try {
          const clipboard=window.navigator?.clipboard,location=window.location;
          if(!clipboard?.writeText||!location){fallback();return true;}
          clipboard.writeText(location.origin+location.pathname+"#"+code).then(()=>{if(active())notify("Challenge link copied.");},fallback);
        }catch{fallback();}
        return true;
      }
      if(id==="invite"&&invitation){showInvitation=true;render();return true;}
      if(id==="dismiss"){showInvitation=false;render();return true;}
      if(id==="join"){
        if(!invitation||liveRun(r))return true;
        rec.run=newRun(invitation.mode,invitation.board,invitation.code);forfeit=false;copyFallback="";
      }else if(id==="start"||id==="replay"){
        if((r&&!["lost","cleared"].includes(r.phase))||!Object.hasOwn(modes,value))return true;
        const board=id==="replay"&&r?r.board:rec.board;
        if(id==="start")rec.board=(board+1)%12;
        rec.run=newRun(value,board,id==="replay"?r?.invite:null);
        forfeit=false;copyFallback="";showInvitation=false;
      }else if(!r)return true;
      else if(id==="quit"){forfeit=true;render();return true;}
      else if(id==="resume"){forfeit=false;render();return true;}
      else if(id==="retire"&&forfeit){rec.run=null;forfeit=false;}
      else if(forfeit)return true;
      else if(r.phase==="draft"&&id==="pick"&&openingDeck(r.board).includes(value)){
        if(r.picks.includes(value))r.picks=r.picks.filter(k=>k!==value);else if(r.picks.length<3)r.picks.push(value);
      }else if(r.phase==="draft"&&id==="launch")launch(r);
      else if(r.phase==="route"&&id==="route")openLane(r,Number(value));
      else if(r.phase==="route"&&id==="lead"&&r.field.party.some(p=>p.id===value&&p.hp))r.field.lead=value;
      else if(r.phase==="bout"&&["skill","duet","swap","pass"].includes(id)){
        void takeTurn(rec,id,value);return true;
      }else if(r.phase==="service"&&id==="mend"){
        const portion=r.route===0?.45:.20;
        for(const p of r.field.party)p.hp=Math.min(p.maxHp,p.hp+Math.ceil(p.maxHp*portion));
        nextLeg(r);
      }else if(r.phase==="service"&&id==="trade"){
        const newId=lane(r,r.route).foes.at(-1),i=r.picks.indexOf(value);
        if(i<0||r.picks.includes(newId))return true;
        r.field.party[i]=game.loaner(newId,level);r.picks[i]=newId;r.field.team[i]=newId;
        if(r.field.lead===value)r.field.lead=newId;
        nextLeg(r);
      }else return true;
      save(rec);render();return true;
    }
    function key(e){
      if(busy)return true;
      const r=record().run;
      if(invitation&&showInvitation&&r?.invite!==invitation.code)return false;
      if(forfeit||r?.phase!=="bout"||!/^\d$/.test(e.key))return false;
      const skill=kin(r.field.battle.activeId).skills[Number(e.key)-1];
      if(skill&&!e.repeat)act("circuit-skill",skill.id);
      return true;
    }
    return {model,act,key,hasInvitation:()=>Boolean(invitation)};
  }
  window.WilderTrials={create,restore};
})();
