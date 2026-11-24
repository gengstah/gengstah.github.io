// Finch ties a pennant to each saved lineup. A pennant records who travels, while
// the party ledger continues to hold each individual kin's health and training.
(() => {
  "use strict";

  const pennants = ["Copper pennant", "Juniper pennant", "Indigo pennant"];
  const error = message => ({ok:false,kind:"error",message});

  function restore(value, party) {
    const owned = new Set(party.map(p => p.id));
    function read(lineup) {
      if (!Array.isArray(lineup?.team) || !lineup.team.length || lineup.team.length > 6 ||
          new Set(lineup.team).size !== lineup.team.length ||
          !lineup.team.every(id => owned.has(id)) || !lineup.team.includes(lineup.lead)) return null;
      return {team:lineup.team.slice(),lead:lineup.lead};
    }
    return {slots:pennants.map((_,i) => read(value?.slots?.[i])), previous:read(value?.previous)};
  }

  function create({state,commit,hpAt,regions,species,items}) {
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
    function status(lineup) {
      if (!lineup) return null;
      const s=state(),party=members(lineup);
      const first=party.find(p=>p?.id===lineup.lead && p.hp>0) || party.find(p=>p?.hp>0);
      const lead=first?.id || null;
      const active=lead===s.lead && s.team.length===lineup.team.length && s.team.every((id,i)=>id===lineup.team[i]);
      const reason=s.battle?"Finish this encounter first.":party.some(p=>!p)?"A companion is missing from the roster.":
        !lead?"Rest at camp to wake a member of this formation.":active?"Already traveling together.":"";
      return {team:lineup.team.slice(),lead:lineup.lead,readyLead:lead,active,reason};
    }
    function formations() {
      const book=ledger();
      return {slots:pennants.map((name,i)=>({index:i,name,lineup:status(book.slots[i])})),previous:status(book.previous)};
    }
    const slotIndex=slot=>[0,1,2,"0","1","2"].includes(slot)?Number(slot):-1;
    function saveFormation(slot) {
      const index=slotIndex(slot);
      if (index<0) return error("Choose a pennant.");
      if (state().battle) return error("Finish this encounter before recording a formation.");
      const lineup=snapshot();
      const previous=ledger().slots[index];
      if (previous?.lead===lineup.lead && previous.team.join("|")===lineup.team.join("|"))
        return error("This pennant already records the traveling lineup.");
      ledger().slots[index]=lineup;
      return commit("formation",pennants[index]+" now records "+species[lineup.lead].name+" and company.");
    }
    function apply(lineup,undo) {
      const info=status(lineup);
      if (!info) return error(undo?"There is no earlier formation to restore.":"Record a traveling formation on this pennant first.");
      if (info.reason) return error(info.reason);
      const s=state(),book=ledger(),previous=snapshot();
      s.team=info.team;
      s.lead=info.readyLead;
      book.previous=undo?null:previous;
      return commit("formation",(undo?"Earlier lineup restored. ":"Formation recalled. ")+species[s.lead].name+" leads the party.");
    }
    function recallFormation(slot) {return apply(ledger().slots[slotIndex(slot)],false);}
    function undoFormation() {return apply(ledger().previous,true);}

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
      return commit("mentored",species[lesson.teacher].name+" trained "+species[id].name+" to level "+lesson.target+".");
    }
    return {formations,saveFormation,recallFormation,undoFormation,training,trainReserve};
  }

  function pages({game,row,image,go,render,notify,locate}) {
    const api=game.caravan;
    const heading=(title,rows,columns=1)=>({title,rows,columns});
    const view=(name,value,label,detail="",extra={})=>row("view",label,name+"|"+value,detail,extra);
    const headingPage=(title,kicker,subtitle,sections)=>({title,kicker,subtitle,sections});
    const names=team=>team.map(id=>game.species[id].name).join(" · ");
    let mentoringPage=0,walkingTo=null;
    function lineupRows(team,lead) {
      return team.map(id=>{
        const kin=game.state.party.find(p=>p.id===id),species=game.species[id];
        return row("open-kin",species.name,id,"Lv. "+kin.level+" · "+kin.hp+"/"+kin.maxHp+" HP · "+species.types.join(" / "),
          {image:image(id),badge:id===lead?"LEAD":""});
      });
    }
    function formations() {
      const book=api.formations(),s=game.state;
      const slots=book.slots.map(({index,name,lineup})=>view("formation",index,name,
        lineup?names(lineup.team):"Record the party traveling with Finch.",{badge:lineup?(lineup.active?"ACTIVE":"SAVED"):"EMPTY"}));
      const sections=[heading("Pennants",slots)];
      if (book.previous) sections.push(heading("Before your last recall",[
        row("caravan-undo","Restore earlier lineup",null,names(book.previous.team)+(book.previous.reason?" · "+book.previous.reason:""),{disabled:!!book.previous.reason})]));
      sections.push(heading("Traveling now",lineupRows(s.team,s.lead),2));
      return headingPage("Trail formations","PARTY PENNANTS","Tie a lineup and its lead to a pennant. Recall it between encounters.",sections);
    }
    function formation(slot,confirmReplace=false) {
      const book=api.formations(),flag=book.slots[Number(slot)];
      if (!flag) return formations();
      const s=game.state,old=flag.lineup;
      const same=old && s.lead===old.lead && s.team.join("|")===old.team.join("|");
      const actions=[];
      if (old && !confirmReplace) actions.push(row("caravan-recall","Recall this lineup",slot,
        old.reason || ("Lead with "+game.species[old.readyLead].name+" · Undo is available after recalling."),{disabled:!!old.reason,tone:"primary"}));
      if (old && !confirmReplace) actions.push(view("formation-replace",slot,"Replace with traveling party",names(s.team),{disabled:!!s.battle||same}));
      else actions.push(row("caravan-save",confirmReplace?"Replace recorded lineup":"Record traveling lineup",slot,
        names(s.team),{disabled:!!s.battle,tone:"primary"}));
      if (confirmReplace) actions.push(row("back","Keep recorded lineup"));
      const sections=[heading(confirmReplace?"Record this change?":"Pennant",actions)];
      if (old) sections.push(heading("Recorded lineup",lineupRows(old.team,old.lead),2));
      sections.push(heading("Traveling lineup",lineupRows(s.team,s.lead),2));
      return headingPage(flag.name,"TRAIL FORMATIONS",confirmReplace?"This changes the lineup written on this pennant.":"",sections);
    }
    function mentoring() {
      const s=game.state, list=s.party.filter(p=>!s.team.includes(p.id)).map(p=>api.training(p.id));
      list.sort((a,b)=>b.gain-a.gain || game.species[a.id].name.localeCompare(game.species[b.id].name));
      const limit=8,total=Math.max(1,Math.ceil(list.length/limit));
      mentoringPage=Math.max(0,Math.min(mentoringPage,total-1));
      const selections=list.slice(limit*mentoringPage,limit*(mentoringPage+1)).map(l=>view("mentor",l.id,game.species[l.id].name,
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
      const species=game.species[id],cost=Object.entries(lesson.cost).map(([key,n])=>
        ({label:game.items[key].name,detail:n+" required · "+(s.bag[key]||0)+" held"}));
      const actions=[];
      if (lesson.gain>0 && !lesson.atCamp && !s.battle) actions.push(row("caravan-walk","Walk to the training yard",id));
      actions.push(row("caravan-train","Train "+species.name,id,lesson.reason||"Spend the listed supplies for one lesson.",{disabled:!lesson.available,tone:"primary"}));
      if (!s.team.includes(id)) actions.push(view("enlist",id,"Add to the traveling party"));
      const sections=[{title:"Lesson level",text:(lesson.teacher?game.species[lesson.teacher].name+" can mentor at Lv. "+lesson.teacherLevel+". ":"A healthy traveling mentor is needed. ")+
        "Local wild kin are Lv. "+lesson.regionalLevel+". This camp teaches to Lv. "+lesson.target+"."}];
      if (cost.length) sections.push(heading("Supplies",cost,3));
      sections.push(heading("At the yard",actions));
      return {...headingPage(species.name,"CAMP MENTORSHIP",lesson.gain?"Lv. "+lesson.level+" → "+lesson.target+" in one lesson.":"Current level "+lesson.level+".",sections),
        art:{src:image(id),caption:"Reserve training"}};
    }
    function model(name,value) {
      switch(name) {
        case "formations":return formations();
        case "formation":return formation(value);
        case "formation-replace":return formation(value,true);
        case "mentoring":return mentoring();
        case "mentor":return mentor(value||walkingTo);
      }
    }
    function act(id,value) {
      let result;
      switch(id) {
        case "caravan-save":result=api.saveFormation(value);if (result.ok) go("formation",value,"replace");break;
        case "caravan-recall":result=api.recallFormation(value);break;
        case "caravan-undo":result=api.undoFormation();break;
        case "caravan-train":result=api.trainReserve(value);break;
        case "caravan-page":mentoringPage+=Number(value);render();return true;
        case "caravan-walk":walkingTo=value || null;locate("camp",walkingTo?"mentor":"mentoring");return true;
        default:return false;
      }
      render();
      notify(result.message);
      return true;
    }
    return {model,act};
  }

  window.WilderCaravans={restore,create,pages};
})();
