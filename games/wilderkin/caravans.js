// Finch records travel order and, optionally, the fittings held by those kin.
(() => {
  "use strict";

  const pennants = ["Copper pennant", "Juniper pennant", "Indigo pennant"];
  const error = message => ({ok:false,kind:"error",message});

  function pennantName(value) {
    if (typeof value!=="string" || /[\u0000-\u001f\u007f-\u009f<>\u202a-\u202e\u2066-\u2069]/u.test(value)) return null;
    const name=value.normalize("NFC").trim().replace(/\s+/gu," ");
    return name && [...name].length<=32 ? name : null;
  }
  const usesGear=lineup=>!!lineup && Object.hasOwn(lineup,"gear");
  const sameOrder=(one,two)=>one.lead===two.lead && one.team.length===two.team.length && one.team.every((id,i)=>id===two.team[i]);
  const held=(s,id)=>s.trailFittings?.gear?.[id] || null;
  function capture(team,s) {
    return Object.fromEntries(team.filter(id=>held(s,id)).map(id=>[id,held(s,id)]));
  }
  function restore(value, party) {
    const owned = new Set(party.map(p => p.id));
    const isItem=id=>typeof id==="string" && !!window.WilderTrailFittings?.byId(id);
    function read(lineup,previous=false) {
      if (!Array.isArray(lineup?.team) || !lineup.team.length || lineup.team.length > 6 ||
          new Set(lineup.team).size !== lineup.team.length ||
          !lineup.team.every(id => owned.has(id)) || !lineup.team.includes(lineup.lead)) return null;
      const saved={team:lineup.team.slice(),lead:lineup.lead};
      if (!previous) {
        const name=pennantName(lineup.name);
        if (name) saved.name=name;
        if (lineup.gear && typeof lineup.gear==="object" && !Array.isArray(lineup.gear)) {
          const pairs=Object.entries(lineup.gear);
          if (pairs.every(([id,item])=>saved.team.includes(id)&&isItem(item)) && new Set(pairs.map(([,item])=>item)).size===pairs.length)
            saved.gear=Object.fromEntries(pairs);
        }
      } else if (Array.isArray(lineup.changes) && lineup.changes.length>0 && lineup.changes.length<=12) {
        const list=lineup.changes;
        const valid=list.every(c=>c&&owned.has(c.id)&&c.before!==c.after&&(c.before===null||isItem(c.before))&&(c.after===null||isItem(c.after)));
        const unique=key=>{const ids=list.map(c=>c[key]).filter(Boolean);return new Set(ids).size===ids.length;};
        if (valid&&unique("id")&&unique("before")&&unique("after")) saved.changes=list.map(({id,before,after})=>({id,before,after}));
      }
      return saved;
    }
    return {slots:pennants.map((_,i) => read(value?.slots?.[i])), previous:read(value?.previous,true)};
  }

  function create({state,commit,hpAt,regions,species,items,fittings=window.WilderTrailFittings,isCurrent=()=>true,blocked=()=>false}) {
    const companionName=id=>{
      const s=state(),base=species[id];
      return s.growth && window.WilderGrowth ? window.WilderGrowth.decorate(base,s).name : base.name;
    };
    function ledger() {
      const s=state();
      return s.caravan ||= restore(null,s.party);
    }
    function snapshot() {
      const s=state();
      return {team:s.team.slice(),lead:s.lead};
    }
    function members(lineup) {
      const owned = new Map(state().party.map(p=>[p.id,p]));
      return lineup.team.map(id=>owned.get(id));
    }
    // Drop only assignments that require changing a newer choice. If their holder
    // keeps a piece, its previous owner must also keep their current equipment.
    function undoAssignments(s,receipt) {
      const owner=new Map(Object.entries(s.trailFittings?.gear||{}).map(([id,item])=>[item,id]));
      const candidates=new Set(receipt.filter(c=>held(s,c.id)===c.after).map(c=>c.id));
      let removed;
      do {
        removed=false;
        for (const c of receipt) {
          const holder=owner.get(c.before);
          if (candidates.has(c.id) && holder && holder!==c.id && !candidates.has(holder)) {
            candidates.delete(c.id);removed=true;
          }
        }
      } while (removed);
      const assignments={},kept=[];
      for (const c of receipt) {
        if (candidates.has(c.id)) assignments[c.id]=c.before;
        else kept.push({id:c.id,item:held(s,c.id),wanted:c.before,holder:owner.get(c.before)||null});
      }
      return {assignments,kept};
    }
    function fittingPlan(lineup,undo) {
      let assignments=null,kept=[];
      if (usesGear(lineup)) assignments=Object.fromEntries(lineup.team.map(id=>[id,lineup.gear[id]||null]));
      else if (undo && lineup.changes) ({assignments,kept}=undoAssignments(state(),lineup.changes));
      if (assignments===null) return {ok:true,assignments,changes:[],kept};
      if (!fittings) return {...error("The trail fittings ledger is unavailable."),assignments,changes:[],kept};
      const plan=fittings.plan(state(),assignments);
      return {...plan,assignments,changes:plan.changes||[],kept};
    }
    function status(lineup,undo=false) {
      if (!lineup) return null;
      const s=state(),party=members(lineup),plan=fittingPlan(lineup,undo);
      const first=party.find(p=>p?.id===lineup.lead && p.hp>0) || party.find(p=>p?.hp>0);
      const lead=first?.id || null;
      const active=sameOrder({team:lineup.team,lead},s) && plan.ok && !plan.changes.length;
      const reason=s.battle||blocked()?"Finish this encounter first.":party.some(p=>!p)?"A companion is missing from the roster.":
        !lead?"Rest at camp to wake a member of this formation.":!plan.ok?plan.message:
        active && !plan.kept.length?"Already traveling together.":"";
      return {team:lineup.team.slice(),lead:lineup.lead,readyLead:lead,active,reason,changes:plan.changes,kept:plan.kept,
        ...(usesGear(lineup)?{gear:{...lineup.gear}}:{}),reviewGear:!!lineup.changes||usesGear(lineup)};
    }
    function formations() {
      const book=ledger();
      return {slots:pennants.map((label,i)=>({index:i,name:book.slots[i]?.name||label,lineup:status(book.slots[i])})),previous:status(book.previous,true)};
    }
    const slotIndex=slot=>[0,1,2,"0","1","2"].includes(slot)?Number(slot):-1;
    function permission() {
      if (state().battle||blocked()) return error("Finish this encounter before changing a formation.");
      if (!isCurrent()) return {...error("Your trail save changed in another tab. Review the latest formation."),code:"changed"};
      return null;
    }
    function pennantPlan(index,lineup,withGear,name) {
      const old=state().caravan?.slots?.[index]||null;
      const label=name===undefined?old?.name:pennantName(name);
      const next={team:lineup.team.slice(),lead:lineup.lead};
      if (label) next.name=label;
      if (withGear) next.gear=capture(next.team,state());
      const identical=old && sameOrder(old,next) && old.name===next.name && usesGear(old)===usesGear(next) &&
        (!withGear || next.team.every(id=>old.gear[id]===next.gear[id]));
      const reason=index<0?"Choose a pennant.":name!==undefined&&!label?"Give the pennant a name of 1–32 characters.":
        withGear&&!fittings?"The trail fittings ledger is unavailable.":identical?"This pennant already records these choices.":"";
      return {next,reason};
    }
    function recordPennant(index,plan) {
      if(plan.reason)return error(plan.reason);
      const next=plan.next;
      ledger().slots[index]=next;
      return commit("formation",(next.name||pennants[index])+" now records "+companionName(next.lead)+" and company"+
        (usesGear(next)?" with their fittings.":"."));
    }
    function saveFormation(slot,{fittings:withGear=false,name}={}) {
      const index=slotIndex(slot),denied=permission();
      if (denied) return denied;
      return recordPennant(index,pennantPlan(index,state(),withGear,name));
    }
    function renameFormation(slot,name) {
      const index=slotIndex(slot),denied=permission(),label=pennantName(name);
      if (denied) return denied;
      const old=ledger().slots[index];
      if (!old || !label) return error("Record a formation and give it a name of 1–32 characters.");
      if (label===old.name) return error("That name is already on the pennant.");
      old.name=label;
      return commit("formation","Finch labeled this pennant "+label+".");
    }
    function apply(lineup,undo,notice="Formation recalled. ") {
      const denied=permission();if (denied) return denied;
      const info=status(lineup,undo);
      if (!info) return error(undo?"There is no earlier formation to restore.":"Record a traveling formation on this pennant first.");
      if (info.reason) return error(info.reason);
      const s=state(),book=ledger(),previous=snapshot(),plan=fittingPlan(lineup,undo);
      if (plan.assignments!==null) {
        const result=fittings.apply(s,plan.assignments);
        if (!result.ok) return error(result.message);
        if (result.changes?.length) previous.changes=result.changes.map(({id,before,after})=>({id,before,after}));
      }
      s.team=info.team;
      s.lead=info.readyLead;
      book.previous=undo?null:previous;
      return commit("formation",(undo?"Earlier formation restored. ":notice)+companionName(s.lead)+" leads the party.");
    }
    function recallFormation(slot) {return apply(ledger().slots[slotIndex(slot)],false);}
    function undoFormation() {return apply(ledger().previous,true);}

    // The Chalkyard supplies only IDs. HP, levels, fittings and the consent
    // to replace a pennant are always checked against the current trail.
    function previewPromotion(setup,options={}) {
      if(!Array.isArray(setup?.team)||!setup.team.length||setup.team.length>6||!options||typeof options!=="object"||Array.isArray(options)||
          options.substitute!=null&&typeof options.substitute!=="string"||
          options.fittings!==undefined&&typeof options.fittings!=="boolean")return null;
      const s=state(),team=[...setup.team],lead=setup.lead,party=new Map(s.party.map(p=>[p.id,p]));
      if(new Set(team).size!==team.length||!team.includes(lead)||!team.every(id=>typeof id==="string"&&party.has(id)))return null;
      const memberRow=id=>{
        const p=party.get(id);
        return {id,name:companionName(id),level:p.level,hp:p.hp,maxHp:p.maxHp,gear:held(s,id),traveling:s.team.includes(id),
          discipline:s.growth?.[id]?.selected||null,trainedGuard:s.trainedGuards?.includes(id)||false};
      };
      const members=team.map(memberRow),current=snapshot(),currentMembers=current.team.map(memberRow);
      const leadChoices=members.filter(p=>p.hp>0).map(p=>p.id),substitute=options.substitute==null?null:team.includes(options.substitute)?options.substitute:"";
      const requestedUp=leadChoices.includes(lead),substituteOK=substitute!==null&&leadChoices.includes(substitute);
      const readyLead=requestedUp?lead:substituteOK?substitute:null;
      const busy=s.battle||blocked()?"Finish this encounter before changing a formation.":"";
      const applyReason=busy||(!leadChoices.length?"Rest at camp to wake a member of this formation.":
        !requestedUp&&!readyLead?companionName(lead)+" is fainted on the trail. Choose a conscious substitute or rest at camp.":
        requestedUp&&substitute!==null&&substitute!==lead?companionName(lead)+" can lead on the trail. Review the selected lead.":
        sameOrder({team,lead:readyLead},current)?"Already traveling together.":"");
      const index=slotIndex(options.slot),withGear=options.fittings===true;
      const name=options.name===undefined?undefined:pennantName(options.name);
      const plan=pennantPlan(index,{team,lead},withGear,name);
      const old=index>=0?s.caravan?.slots?.[index]:null;
      const existing=old?{team:old.team.slice(),lead:old.lead,...(old.name?{name:old.name}:{}),...(usesGear(old)?{gear:{...old.gear}}:{})}:null;
      const pennant=index<0?null:{index,name:plan.next.name||pennants[index],occupied:!!old,existing,fittings:withGear,
        ...(withGear?{gear:{...plan.next.gear}}:{})};
      const request={substitute,slot:index,...(name!==undefined?{name}:{}),fittings:withGear};
      const token=JSON.stringify([current,currentMembers,members,lead,request,pennant,busy]);
      const saveReason=busy||plan.reason;
      return {team,lead,readyLead,substitute,leadChoices,current,currentMembers,members,joining:team.filter(id=>!s.team.includes(id)),
        leaving:s.team.filter(id=>!team.includes(id)),canApply:!applyReason,applyReason,canSave:!saveReason,saveReason,pennant,request,token};
    }
    function confirmedPromotion(review,writeSlot) {
      const denied=permission();if(denied)return denied;
      const latest=review&&typeof review.token==="string"?previewPromotion(review,review.request):null;
      if(!latest||latest.token!==review.token)return {...error("This formation review has changed. Review the party and pennant again."),code:"changed"};
      if(writeSlot){
        if(!latest.canSave)return error(latest.saveReason);
        return recordPennant(latest.pennant.index,pennantPlan(latest.pennant.index,latest,latest.pennant.fittings,latest.request.name));
      }
      if(!latest.canApply)return error(latest.applyReason);
      return apply({team:latest.team,lead:latest.readyLead},false,"Practice lineup is traveling. ");
    }
    const applyPromotion=review=>confirmedPromotion(review,false);
    const savePromotion=review=>confirmedPromotion(review,true);

    function mentor() {
      const s=state();
      return s.party.filter(p=>s.team.includes(p.id)&&p.hp>0)
        .reduce((best,p)=>!best || p.level>best.level ? p : best,null);
    }
    function training(id) {
      const s=state(),kin=s.party.find(p=>p.id===id);
      if (!kin) return null;
      const teacher=mentor(),regionalLevel=regions[s.region].wildLevel;
      const target=Math.max(1,Math.min(teacher?.level||1,regionalLevel)-2);
      const gain=Math.max(0,target-kin.level),band=Math.min(6,Math.ceil(gain/15));
      const cost=gain?{reed:2+band,sap:1+band}:{};
      if (band>1) cost.ore=band-1;
      const missing=Object.entries(cost).filter(([key,n])=>(s.bag[key]||0)<n)
        .map(([key,n])=>(n-(s.bag[key]||0))+" "+items[key].name);
      const reason=s.battle?"Finish this encounter before training.":s.team.includes(id)?"This lesson is for a reserve companion.":
        !teacher?"Rest a traveling companion to mentor this lesson.":!gain?"Already at or above the lesson level here.":
        s.landmark!=="camp"?"Walk to the local camp.":missing.length?"Gather "+missing.join(" and ")+".":"";
      return {id,level:kin.level,target,gain,cost,regionalLevel,teacher:teacher?.id,teacherLevel:teacher?.level,
        atCamp:s.landmark==="camp",reason,available:!reason};
    }
    function trainReserve(id) {
      const lesson=training(id);
      if (!lesson) return error("Choose a befriended reserve companion.");
      if (!lesson.available) return error(lesson.reason);
      const s=state(),kin=s.party.find(p=>p.id===id),maxHp=hpAt(id,lesson.target);
      const hp=kin.hp===0?0:Math.max(1,Math.floor(maxHp*kin.hp/kin.maxHp));
      for (const [key,quantity] of Object.entries(lesson.cost)) s.bag[key]-=quantity;
      Object.assign(kin,{level:lesson.target,maxHp,hp});
      return commit("mentored",companionName(lesson.teacher)+" trained "+companionName(id)+" to level "+lesson.target+".");
    }
    return {formations,saveFormation,renameFormation,recallFormation,undoFormation,training,trainReserve,
      previewPromotion,applyPromotion,savePromotion};
  }

  function pages({game,row,image,go,render,notify,locate,travel}) {
    const api=game.caravan,own=id=>game.kin?.(id,{owned:true}) || game.species[id];
    const heading=(title,rows,columns=1)=>({title,rows,columns});
    const view=(name,value,label,detail="",extra={})=>row("view",label,name+"|"+value,detail,extra);
    const headingPage=(title,kicker,subtitle,sections)=>({title,kicker,subtitle,sections});
    const names=team=>team.map(id=>own(id).name).join(" · ");
    let mentoringPage=0,walkingTo=null,supplyTrip=null;
    const kit=window.WilderTrailFittings;
    const fittingName=id=>kit?.byId(id)?.name||"No fitting";
    let preview=null;
    function lineupRows(team,lead,gear) {
      return team.map(id=>{
        const kin=game.state.party.find(p=>p.id===id),species=own(id);
        const trail="Lv. "+kin.level+" · "+kin.hp+"/"+kin.maxHp+" HP";
        return row("open-kin",species.name,id,trail+" · "+(gear?fittingName(gear[id]):species.types.join(" / ")),
          {image:image(id),badge:id===lead?"LEAD":""});
      });
    }
    function formations() {
      const book=api.formations(),s=game.state;
      const slots=book.slots.map(({index,name,lineup})=>view("formation",index,name,
        lineup?names(lineup.team):"Record your traveling party.",{badge:lineup?
          (lineup.active?"ACTIVE":"SAVED")+(usesGear(lineup)?" · FITTINGS":""):"EMPTY"}));
      const sections=[heading("Pennants",slots)];
      if (book.previous) {
        const prev=book.previous;
        sections.push(heading("Before your last recall",[
          prev.reviewGear?view("formation-undo","","Review previous formation",prev.reason||"See who gets each fitting back.",{disabled:!!prev.reason}):
          row("caravan-undo","Restore earlier lineup",null,names(prev.team)+(prev.reason?" · "+prev.reason:""),{disabled:!!prev.reason})]));
      }
      sections.push(heading("Traveling now",lineupRows(s.team,s.lead,s.trailFittings?.gear),2));
      return headingPage("Trail formations","PARTY PENNANTS","Record the traveling order and leader. Each pennant can also remember the team’s fittings.",sections);
    }
    function formation(slot,confirmReplace=false) {
      const flag=api.formations().slots[Number(slot)];
      if (!flag) return formations();
      const s=game.state,old=flag.lineup,same=old && sameOrder(old,s);
      const sameBare=same&&!usesGear(old);
      const sameEquipped=same&&usesGear(old)&&s.team.every(id=>(old.gear[id]||null)===held(s,id));
      const actions=[];
      if (old && !confirmReplace) {
        if (usesGear(old)) actions.push(view("formation-recall",slot,"Review lineup and fittings",old.reason||
          (old.changes.length+" holder"+(old.changes.length===1?"":"s")+" will change fittings."),{disabled:!!old.reason,tone:"primary"}));
        else actions.push(row("caravan-recall","Recall this lineup",slot,
          old.reason || ("Lead with "+own(old.readyLead).name+" · Keep current fittings."),{disabled:!!old.reason,tone:"primary"}));
        actions.push(view("formation-replace",slot,"Update this pennant",names(s.team),{disabled:!!s.battle||(!kit&&sameBare)}),
          row("caravan-rename","Rename pennant",slot,"Choose a name for this formation.",{disabled:!!s.battle}));
      }else{
        actions.push(row("caravan-save",confirmReplace?"Save lineup only":"Record traveling lineup",slot,
          "Keep each kin’s current fitting when you recall.",{disabled:!!s.battle||!!sameBare,tone:confirmReplace||!kit?"primary":undefined}));
        if (kit) actions.push(row("caravan-save-gear","Record lineup + fittings",slot,
          "Remember what each traveler holds, including empty slots.",{disabled:!!s.battle||!!sameEquipped,tone:confirmReplace?undefined:"primary"}));
        if (confirmReplace) actions.push(row("back","Keep recorded lineup"));
      }
      const sections=[heading(confirmReplace?"Save current travelers":"Pennant",actions)];
      if (old) sections.push(heading("Recorded lineup",lineupRows(old.team,old.lead,old.gear),2));
      sections.push(heading("Traveling lineup",lineupRows(s.team,s.lead,s.trailFittings?.gear),2));
      return headingPage(flag.name,"TRAIL FORMATIONS",confirmReplace?"Choose what Finch should write on this pennant.":"",sections);
    }
    function receiptKey(slot,result) {
      return JSON.stringify([slot,game.state.team,game.state.lead,result]);
    }
    function recallReview(slot,undo=false) {
      const book=api.formations(),flag=book.slots[Number(slot)],info=undo?book.previous:flag?.lineup;
      if (!info || !info.reviewGear) return formations();
      const s=game.state;
      const role=id=>s.team.includes(id)?(info.team.includes(id)?"Traveling":"Moving to reserve"):
        (info.team.includes(id)?"Joining the party":"Camp reserve");
      preview=receiptKey(undo?"undo":String(slot),info);
      const changes=info.changes.map(c=>({label:own(c.id).name,detail:fittingName(c.before)+" → "+fittingName(c.after),badge:role(c.id),image:image(c.id)}));
      const kept=info.kept.map(c=>{
        let detail=c.item?"Keeps "+fittingName(c.item)+".":"Stays unequipped.";
        if(c.wanted&&c.holder&&c.holder!==c.id)detail+=" "+own(c.holder).name+" now holds "+fittingName(c.wanted)+".";
        return {label:own(c.id).name,detail,image:image(c.id)};
      });
      const action=undo?"caravan-confirm-undo":"caravan-confirm-recall";
      const sections=[{title:"Traveling order",text:names(info.team)+"."+(info.readyLead?" "+own(info.readyLead).name+" will lead.":"")}];
      if(changes.length)sections.push(heading("Fittings to move",changes));
      else sections.push({text:"Every fitting stays with its current holder."});
      if(kept.length)sections.push(heading("Later fitting changes to keep",kept));
      sections.push(heading("At the pennant",[row(action,undo?"Restore earlier formation":"Recall this formation",undo?null:slot,info.reason||
        (undo?"Return to the earlier travel order.":"An undo will be available at Trail formations."),{disabled:!!info.reason,tone:"primary"}),
        row("back","Keep traveling as you are")]));
      return headingPage(undo?"Review your undo":"Review this recall",undo?"TRAIL FORMATIONS":flag.name.toUpperCase(),"",sections);
    }
    function mentoring() {
      const s=game.state, list=s.party.filter(p=>!s.team.includes(p.id)).map(p=>api.training(p.id));
      list.sort((a,b)=>b.gain-a.gain || own(a.id).name.localeCompare(own(b.id).name));
      const limit=8,total=Math.max(1,Math.ceil(list.length/limit));
      mentoringPage=Math.max(0,Math.min(mentoringPage,total-1));
      const selections=list.slice(limit*mentoringPage,limit*(mentoringPage+1)).map(l=>view("mentor",l.id,own(l.id).name,
        l.gain?"Lv. "+l.level+" → "+l.target:"Lv. "+l.level+" · Trained for this camp",{image:image(l.id),badge:l.gain?"+"+l.gain+" LV":""}));
      const sections=[heading("Reserve companions",selections.length?selections:[{label:"Your whole company is traveling together.",detail:"Additional companions join the reserve after your sixth party member."}],2)];
      if (total>1) sections.push(heading("Page "+(mentoringPage+1)+" of "+total,[
        row("caravan-page","Previous",-1,"",{disabled:mentoringPage===0}),row("caravan-page","Next",1,"",{disabled:mentoringPage+1===total})],2));
      if (s.landmark!=="camp") sections.unshift(heading("Training yard",[row("caravan-walk","Walk to camp","","",{disabled:!!s.battle})]));
      return headingPage("Camp mentorship",game.regions[s.region].name,
        "A traveling kin can bring an old friend up to two levels below the lower of its own level and the local wild level.",sections);
    }
    function mentor(id) {
      const lesson=api.training(id),s=game.state;
      if (!lesson) return mentoring();
      const species=own(id),cost=Object.entries(lesson.cost).map(([key,n])=>{
        const held=s.bag[key]||0,detail=n+" required · "+held+" held";
        return key==="ore"&&held<n&&!s.team.includes(id)?
          row("caravan-find","Find Bellstone",id,detail+" · need "+(n-held)+" more",{disabled:!!s.battle}):{label:game.items[key].name,detail};
      });
      const actions=[];
      if (lesson.gain>0 && !lesson.atCamp && !s.battle) actions.push(row("caravan-walk","Walk to the training yard",id));
      actions.push(row("caravan-train","Train "+species.name,id,lesson.reason||"Spend the listed supplies for one lesson.",{disabled:!lesson.available,tone:"primary"}));
      if (!s.team.includes(id)) actions.push(view("enlist",id,"Add to the traveling party"));
      const sections=[{title:"Lesson level",text:(lesson.teacher?own(lesson.teacher).name+" can mentor at Lv. "+lesson.teacherLevel+". ":"A healthy traveling mentor is needed. ")+
        "Local wild kin are Lv. "+lesson.regionalLevel+". This camp teaches to Lv. "+lesson.target+"."}];
      if (cost.length) sections.push(heading("Supplies",cost,3));
      sections.push(heading("At the yard",actions));
      return {...headingPage(species.name,"CAMP MENTORSHIP",lesson.gain?"Lv. "+lesson.level+" → "+lesson.target+" in one lesson.":"Current level "+lesson.level+".",sections),
        art:{src:image(id),caption:"Reserve training"}};
    }
    function mentorshipReturn(){
      if(!supplyTrip||game.state.team.includes(supplyTrip.id)||!game.state.party.some(p=>p.id===supplyTrip.id))return null;
      return view("mentor-supplies",supplyTrip.id,"Supplies for "+own(supplyTrip.id).name,game.state.bag.ore+" / "+supplyTrip.needed+" Bellstone");
    }
    function supplies(id){
      if(!supplyTrip||id!==supplyTrip.id||!mentorshipReturn())return mentor(id);
      const {region,needed}=supplyTrip,s=game.state,held=s.bag.ore,r=game.regions[region],student=own(id).name;
      const actions=[];
      if(held<needed){
        if(s.forageReady)actions.push(row("caravan-gather","Gather Bellstone",id,"A fresh patch here yields at least 1 Bellstone.",{tone:"primary",disabled:!!s.battle}));
        else{
          const leg=game.expedition();
          if(!leg.done)actions.push(row("nav","Continue "+leg.title,"expedition","Finish leg "+leg.step+" of "+leg.total+" to reveal a fresh patch."));
          actions.push(row("walk-kind","Follow local wild tracks","wild|tracks","Win the encounter or befriend a wild kin to reveal another patch."));
        }
        const crossing=game.regions.map((_,i)=>i).filter(i=>game.access(i).carrier)
          .sort((a,b)=>Math.abs(a-s.region)-Math.abs(b-s.region))[0];
        if(crossing!=null)actions.push(row("caravan-cross","Cross to "+game.regions[crossing].name,crossing,game.access(crossing).reason,{disabled:!!s.battle}));
      }
      actions.push(row("caravan-return","Return to "+student+"’s lesson",id,r.name+" · "+(held>=needed?"Bellstone ready":"Camp mentorship"),{tone:held>=needed?"primary":undefined,disabled:!!s.battle}));
      return headingPage("Bellstone for "+student,"CAMP MENTORSHIP",held+" / "+needed+" Bellstone for the lesson at "+r.name+".",[heading("Supplies",actions)]);
    }
    function model(name,value) {
      switch(name) {
        case "formations":return formations();
        case "formation":return formation(value);
        case "formation-replace":return formation(value,true);
        case "formation-recall":return recallReview(value);
        case "formation-undo":return recallReview(null,true);
        case "mentoring":return mentoring();
        case "mentor":return mentor(value||walkingTo);
        case "mentor-supplies":return supplies(value);
      }
    }
    function act(id,value) {
      let result;
      switch(id) {
        case "caravan-save":case "caravan-save-gear":
          result=api.saveFormation(value,{fittings:id==="caravan-save-gear"});if (result.ok) go("formation",value,"replace");break;
        case "caravan-rename":{
          const flag=api.formations().slots[Number(value)];
          if (!flag?.lineup) return true;
          const name=window.prompt?.("Name this pennant (up to 32 characters)",flag.name);
          if(typeof name!=="string")return true;
          result=api.renameFormation(value,name);break;
        }
        case "caravan-confirm-recall":case "caravan-confirm-undo":{
          const undo=id==="caravan-confirm-undo",book=api.formations(),info=undo?book.previous:book.slots[Number(value)]?.lineup;
          if (!info || preview!==receiptKey(undo?"undo":String(value),info)) {
            render();notify("The formation changed. Review the current holders before confirming.");return true;
          }
          result=undo?api.undoFormation():api.recallFormation(value);
          if(result.ok){preview=null;go(undo?"formations":"formation",undo?null:value,"replace");}
          break;
        }
        case "caravan-recall":
          if(api.formations().slots[Number(value)]?.lineup?.reviewGear){go("formation-recall",value);return true;}
          result=api.recallFormation(value);break;
        case "caravan-undo":
          if(api.formations().previous?.reviewGear){go("formation-undo");return true;}
          result=api.undoFormation();break;
        case "caravan-find":{
          const lesson=api.training(value);
          if(!lesson||game.state.battle||game.state.team.includes(value)||!(lesson.cost.ore>game.state.bag.ore))return true;
          supplyTrip={id:value,region:game.state.region,needed:lesson.cost.ore};
          go("mentor-supplies",value);return true;
        }
        case "caravan-cross":{
          const i=Number(value);
          if(supplyTrip&&game.access(i).carrier)travel(i,{name:"mentor-supplies",value:supplyTrip.id});
          return true;
        }
        case "caravan-gather":result=game.gather();break;
        case "caravan-return":{
          if(!supplyTrip||value!==supplyTrip.id)return true;
          const region=supplyTrip.region;
          walkingTo=value;
          if(game.state.region!==region){
            travel(region);
            if(game.state.region!==region)return true;
          }
          if(game.state.landmark!=="camp")locate("camp","mentor");
          else go("mentor",value,"replace");
          return true;
        }
        case "caravan-train":result=api.trainReserve(value);if(result.ok&&supplyTrip?.id===value)supplyTrip=null;break;
        case "caravan-page":mentoringPage+=Number(value);render();return true;
        case "caravan-walk":walkingTo=value || null;locate("camp",walkingTo?"mentor":"mentoring");return true;
        default:return false;
      }
      render();
      notify(result.message);
      return true;
    }
    return {model,act,mentorshipReturn,clearMentorship(){walkingTo=null;supplyTrip=null;}};
  }

  window.WilderCaravans={restore,create,pages};
})();
