// Atlas, collection, journal and station pages share the same canvas navigation.
window.WilderPages = {
  create({game,world,dex,row,member,image,go,back,render,notify,locate,root,fight,playTone,resolveBattle,fieldRecruited,travel,reset,atSite,openFinder,trailPartners}) {
    const fair=window.WilderActivities, story=window.WilderStory;
    const caravans=window.WilderCaravans.pages({game,row,image,go,render,notify,locate});
    const walkers=window.WilderWalkingPartner.pages({game,row,image,go,render,notify,locate});
    const hollows=window.WilderHollows.pages({game,row,go,render,notify,locate});
    const mystery=window.WilderStillwake.pages({game,row,go,render,notify,locate});
    const outing=window.WilderOpening.pages({game,row,image,go,notify,locate});
    const own=id=>game.kin(id,{owned:true});
    const fittings=window.WilderTrailFittings;
    const held=id=>fittings?.byId((game.state.battle?game.state.battle.trailFittings:game.state.trailFittings)?.gear?.[id]);
    const fittingText=f=>(f?.fittingEvents||[]).map(e=>e.preview||e.text).join(" ");
    const starterIds=["sprigkit","cindlet","dewfin"];
    let selectedGrowth=null,growthMoment=0;
    const s=()=>game.state, here=()=>game.regions[s().region], area=()=>world.regions[s().region];
    const all=Object.values(game.species), entryNo=new Map(all.map((k,i)=>[k.id,i+1]));
    const routes=[{start:0,end:2},...window.WilderAtlas.routes.filter(r=>r.start>=3)];
    const regionalArt=new Map();
    const settings=()=>({guidePage:0,guideSearch:"",collection:"All",affinity:"All",atlasRoute:null,atlasPage:0,atlasSearch:"",
      questPage:0,questFilter:"All",gamePage:0,crestPage:0,notebookPage:0,pinPage:0,storyKind:"chapter",storyPage:0,searchFor:"guide",entry:""});
    let filter=settings();
    const format=n=>String(n).padStart(3,"0");
    const info=(label,detail)=>({label,detail});
    const nav=(target,label,detail="")=>row("nav",label,target,detail);
    const open=(name,value,label,detail="",extra={})=>row("view",label,name+"|"+value,detail,extra);
    const page=(title,kicker,sections,subtitle="",art)=>({title,kicker,sections,subtitle,art});
    const requirements=items=>items.map(r=>info((r.done?"✓ ":"□ ")+r.label));
    const heading=(title,rows,columns=1)=>({title,rows,columns});
    const setResult=(res,repaint=true)=>{
      if (repaint) render();
      notify(res.message);
      if (res.ok) playTone("click");
      return res.ok;
    };
    function thumb(i) {
      if (!regionalArt.has(i)) {
        const c=document.createElement("canvas");
        world.draw(c,i,{...world.regions[i].spawn,questActive:false},500);
        if (regionalArt.size>=8) regionalArt.delete(regionalArt.keys().next().value);
        regionalArt.set(i,c);
      }
      return regionalArt.get(i);
    }
    function pages(rows,key,count=8) {
      const total=Math.ceil(rows.length/count);
      filter[key]=Math.max(0,Math.min(filter[key],total-1));
      const list=rows.slice(filter[key]*count,filter[key]*count+count);
      const sections=[{rows:list.length?list:[info("No matching entries","Try a different filter.")]}];
      if (total>1) sections.push(heading("Page "+(filter[key]+1)+" of "+total,[
        row("page-step","Previous",key+"|-1","",{disabled:filter[key]===0}),
        row("page-step","Next",key+"|1","",{disabled:filter[key]===total-1})],2));
      return sections;
    }
    const routeOf=i=>routes.findIndex(r=>r.start<=i&&r.end>=i);
    const siteFor=kind=>area().sites.find(a=>(a.kind||a.id)===kind);
    function wayTo(kind,next,label) {
      const site=siteFor(kind);
      return site?row("walk-kind",label||"Walk to "+site.label,kind+"|"+(next||""),site.label):null;
    }
    function localLinks() {
      return area().sites.map((a,i)=>row("walk-site",a.label,i,
        a.label==="Brookside Mill"?"Reedbank Relay and trail camp":
          ({warden:"Warden trial",wild:"Follow creature tracks",camp:"Rest and retrain",travel:"Atlas and crossings",activities:"Regional field station","lantern-cup":"Enter the Lantern Cup","guard-school":"Neri Pike’s field guard lessons","third-beat":"Iona Rill’s three-bell commission",twinbell:"Two active kin per side · doubles Wardens",switchyard:"Ride to Captain Sela’s doubles cup"})[a.kind||a.id]));
    }
    function guardStatus(lesson,owned) {
      if(!lesson)return "";
      return lesson.learned?lesson.name+" learned":(owned?"Learning ":"Can learn ")+lesson.name;
    }
    function guardSection(id) {
      const t=game.guardTraining(id);
      if(!t)return [];
      const owned=!!member(id);
      const learn=t.learned?"":(owned?"Use ":"Befriend this kin, then use ")+t.guard+" to survive a charged, damaging reply in any campaign battle. ";
      return [{title:guardStatus(t,owned),text:learn+t.summary}];
    }
    function localSpecies(id,action="open-kin",wild=action==="track") {
      const base=game.species[id],p=member(id),k=wild?base:own(id);
      return row(action,k.name,id,[k.types.join(" / "),k.emberArt?.name,k.ability,window.WilderFamilyTechniques.forKin(id)?.name,guardStatus(game.guardTraining(id),p),p?"Befriended":null].filter(Boolean).join(" · "),
        {image:image(id,!wild),badge:p&&!wild?"Lv. "+p.level:undefined});
    }
    function atlas() {
      if (filter.atlasRoute===null) filter.atlasRoute=routeOf(s().region);
      const route=routes[filter.atlasRoute], query=filter.atlasSearch.toLowerCase();
      const results=game.regions.flatMap((r,i)=>{
        if (query?![r.name,r.district,r.warden||"",r.ability||""].join(" ").toLowerCase().includes(query):i<route.start||i>route.end) return [];
        const gate=game.access(i);
        return [open("region",i,r.name,[i===s().region?"You are here":gate.reason,"Wild Lv. "+game.wildLevel(i)].join(" · "),{badge:format(i+1)})];
      });
      const change=heading("Find a route",[
        row("route-step","Previous route",-1,"",{disabled:filter.atlasRoute===0}),row("route-step","Next route",1,"",{disabled:filter.atlasRoute===routes.length-1}),
        row("search-edit",filter.atlasSearch?"Find: "+filter.atlasSearch:"Search all regions","atlas")],3);
      const nodes=[];
      for(let i=route.start;i<=route.end;i++) nodes.push(mapNode(i,"view","region|"+i,game.regions[i].name));
      const sections=[heading("Map case",[nav("districts","All districts"),nav("pins","Saved pins",s().pins.length+" locations"),nav("hollows","Hidden hollows")],3)];
      if(!query)sections.push(window.WilderRouteMap.chart(nodes));
      return page("World atlas",s().visited.length+" / 150 VISITED",[...sections,change,...pages(results,"atlasPage")],
        filter.atlasSearch?"Matching regions":game.regions[route.start].district+" · "+game.regions[route.end].name);
    }
    function mapNode(i,id,value,label) {
      return {id,value,label,detail:game.access(i).reason,biome:game.regions[i].biome,current:s().region===i,visited:s().visited.includes(i),open:game.access(i).open,pin:s().pins.includes(i)};
    }
    function districts(value) {
      const names=[...new Set(game.regions.map(r=>r.district))];
      if(value==null){
        const nodes=names.map((name,n)=>{
          const i=game.regions.findIndex(r=>r.district===name),node=mapNode(i,"view","district|"+n,name.replace(/^The /,""));
          return {...node,current:here().district===name,pin:s().pins.some(i=>game.regions[i].district===name)};
        });
        return page("District chart","WORLD ATLAS",[window.WilderRouteMap.chart(nodes,true)],"Select a district to unfold its routes. The gold ring marks your location.");
      }
      const name=names[Number(value)],list=routes.flatMap((r,i)=>game.regions[r.start].district===name?[row("atlas-route",game.regions[r.end].name,i,game.regions[r.start].name+" → "+game.regions[r.end].name)]:[]);
      return page(name,"DISTRICT CHART",[heading("Routes",list)],"Choose a route to read its landmarks and access requirements.");
    }
    function pins() {
      const entries=s().pins.map(i=>open("region",i,game.regions[i].name,game.access(i).reason,{badge:s().destination===i?"TRACKING":"PINNED"}));
      return page("Saved pins","WORLD ATLAS",entries.length?pages(entries,"pinPage"):[{text:"Open any region on the atlas and choose Save a pin."}],"Track one destination to put its current access requirements on the exploration screen.");
    }
    function regionPage(i) {
      const r=game.regions[i],gate=game.access(i),job=game.expedition(i);
      const actions=[row("travel",i===s().region?"Return to this region":gate.carrier?"Cross with "+r.ability:"Travel here",i,gate.reason,{disabled:!gate.open||!!s().battle,tone:"primary"})];
      if (gate.hintRegion!=null && gate.hintRegion!==i) actions.push(open("region",gate.hintRegion,"Find the way through",game.regions[gate.hintRegion].name));
      if (r.ability) actions.push(open("license",r.ability,r.ability+" training",window.WilderAtlas.abilities[r.ability]));
      if (r.warden) actions.push(open("crest",i,r.crest,"Warden "+r.warden));
      const hollow=game.hollows.at(i);
      if(hollow)actions.push(open("hollow",hollow.id,hollow.title,"Hidden hollow · "+(hollow.ability||"Introductory trail")));
      const pinned=s().pins.includes(i),tracked=s().destination===i;
      const marks=[row("atlas-pin",pinned?"Remove pin":"Save a pin",i+"|"+(pinned?"remove":"save")),row("atlas-pin",tracked?"Stop tracking":"Track destination",i+"|"+(tracked?"untrack":"track"))];
      return page(r.name,r.district+"   /   "+format(i+1),[heading("Trail access",actions),heading("Map pin",marks,2),heading("Local tracks",game.pools[i].map(id=>localSpecies(id,"open-kin",true)))],
        r.description+"  Wild Lv. "+game.wildLevel(i)+" · "+job.completed+"/"+job.total+" field legs charted.",{src:thumb(i),caption:r.name});
    }
    function guideScope(state){
      const held=new Set(state.party.map(p=>p.id));
      return all.filter(k=>{
        if(k.bonus && !state.stillwake?.revealed && !held.has(k.id))return false;
        const status={"All":true,"Seen":state.seen.includes(k.id),"Owned":held.has(k.id),"Reserve":held.has(k.id)&&!state.team.includes(k.id),"Local":game.pools[state.region].includes(k.id),"Carriers":!!k.ability};
        return status[filter.collection]&&(filter.affinity==="All"||k.types.includes(filter.affinity));
      });
    }
    function guide() {
      const query=filter.guideSearch.toLowerCase(),state=s();
      const entries=guideScope(state).filter(k=>{
        const pass=window.WilderFamilyTechniques.forKin(k.id),guard=game.guardTraining(k.id);
        return [k.name,own(k.id).name,game.growthInfo(k.id)?.formName||"",k.ability||"",k.emberArt?.name,pass?.family,pass?.name,guard?.family,guard?.name,guard?.guard,...k.skills.map(skill=>skill.name),...k.types,format(entryNo.get(k.id))].join(" ").toLowerCase().includes(query);
      });
      const perPage=10,count=Math.ceil(entries.length/perPage);filter.guidePage=Math.max(0,Math.min(filter.guidePage,count-1));
      const found=entries.slice(filter.guidePage*perPage,filter.guidePage*perPage+perPage);
      const sections=[heading("Catalog",[
        row("search-edit",query?"Find: "+filter.guideSearch:"Search names and techniques","guide"),
        ...(openFinder?[row("field-partners","Find a duet partner","guide",query?"Look for partner skills matching “"+filter.guideSearch+"”.":"Compare partners for your lead and find their habitats.")]:[]),
        row("cycle-collection","Collection: "+filter.collection),row("cycle-affinity","Affinity: "+filter.affinity),nav("affinities","Affinity chart")],2),
        heading(entries.length+" matching kin",found.length?found.map(id=>localSpecies(id.id)):[info("No results","Change your search or filters.")],2)];
      if (count>1) sections.push(heading("Page "+(filter.guidePage+1)+" of "+count,[row("page-step","Previous","guidePage|-1","",{disabled:!filter.guidePage}),row("page-step","Next","guidePage|1","",{disabled:filter.guidePage>=count-1})],2));
      const ordinary=ids=>ids.filter(id=>!game.species[id]?.bonus).length;
      return page("Field guide",ordinary(state.seen)+" DISCOVERED  /  "+ordinary(state.party.map(p=>p.id))+" BEFRIENDED",sections,"Track 500 regional species and the abilities they bring to a crossing.");
    }
    function kinPage(id) {
      const k=own(id),p=member(id),homes=game.homes[id],local=homes.includes(s().region);
      const home=local?s().region:homes.find(i=>s().visited.includes(i))??homes[0];
      if(k.bonus && !s().stillwake?.revealed && !p)return guide();
      const controls=k.bonus?[nav("stillwake","The fourth sounding","Read the witnesses’ accounts.")]:[open("study",id,"Field observations")];
      if(openFinder&&!k.bonus)controls.push(row("field-partners","Find a partner for "+k.name,id,"Look for a duet and test it with level-20 loaners."));
      if(!k.bonus&&local)controls.push(wayTo("wild","tracks","Follow local tracks"));
      else if(!k.bonus&&homes.length===1)controls.push(open("region",home,"Find its habitat",game.regions[home].name));
      if(!s().battle&&game.pools[s().region].includes(id)&&game.wildCall?.(id))controls.unshift(open("wild-scout",id,"Scout "+k.name+"’s call","Choose your lead for this encounter."));
      if(p&&!s().battle&&window.WilderTrioPlanner)controls.unshift(row("kin-trio","Build a trio around "+k.name,id,"Choose a duet partner and a third companion to take the next turn."));
      if(p&&!s().battle&&window.WilderPracticeYard)controls.unshift(row("yard-kin","Compare "+k.name+" as lead",id,"Compare this companion’s opening against local opponents."));
      if(p&&game.trailFittings)controls.unshift(open("kit-bench","kin:"+id,"Field fitting",held(id)?.name||"See which fitting this companion could carry."));
      if(game.growthInfo(id))controls.unshift(open("growth",id,"Growth and disciplines",k.discipline?.name||"See training and forms."));
      const signature=window.WilderSparringSignatures?.byId(id);
      const family=window.WilderFamilyTechniques.forKin(id);
      if(k.emberArt)controls.push(open("sparring","ember","Try "+k.emberArt.name,"Borrow both Ember herons for a practice exchange."));
      if(family)controls.push(nav("reedbank","Practice "+family.name,"Borrow a scout at Brookside Mill."));
      else if(signature)controls.push(open("sparring","bench:grove:"+id,"Try "+signature.name,"Practice this Hall signature at the Thornbridge crossing."));
      const guard=game.guardTraining(id);
      if(guard&&!s().battle){
        const exemplar=guard.id==="shell"?"cragroll":"opalclasp";
        if(p)controls.push(open("guard-school",id,(guard.learned?"Review ":"Train ")+k.name+" with Neri","Neri checks this companion’s field training."));
        else if(id===exemplar)controls.push(open("guard-school",id,"Find "+k.name+" with Neri","Follow this companion’s wild tracks."));
        else controls.push(open("guard-school",exemplar,"See Neri’s "+game.species[exemplar].name+" lesson","Meet the "+guard.family.toLowerCase()+" mentor. "+k.name+" lives in "+game.regions[home].name+"."));
      }
      if (k.ability) controls.push(open("license",k.ability,k.ability+" license",dex.abilities[k.ability].description));
      if(p) controls.push(row("walk-partner-select","Walk with "+k.name,id,"Choose a follower independently of your battle leader."));
      if (p && !s().battle && !s().team.includes(id)) controls.unshift(open("enlist",id,"Call from reserve"),open("mentor",id,"Train at camp"));
      else if (p && !s().battle && s().lead!==id) controls.unshift(row("lead","Make party leader",id,"",{disabled:!p.hp}));
      const duets=game.team().filter(other=>other.id!==id).map(other=>{
        const pair=game.duetPair(id,other.id);
        return info(pair.name+" · "+own(other.id).name,pair.label+" · "+pair.cost+" beats · "+pair.description);
      });
      return page(k.name,"FIELD GUIDE  /  "+format(entryNo.get(id)),[
        heading(k.types.join(" / "),controls.filter(Boolean),2),...(family?[{title:family.name+" · "+family.family+" family",text:family.summary+" Your team can use one family pass per battle. It costs one beat."}]:[]),
        ...(homes.length>1?[heading("Habitats",homes.map((r,i)=>open("region",r,game.regions[r].name,
          (i===0?"Native habitat":"Trail roost")+(s().region===r?" · You are here":""))).reverse(),2)]:[]),
        ...(k.emberArt?[{title:k.emberArt.name,text:k.emberArt.description}]:[]),
        ...guardSection(id),heading("Skills",k.skills.map(skill=>info(skill.name+" · "+skill.type,skill.description))),heading("Duets with your party",duets,2)],
        k.description,{src:image(id),caption:p?"Level "+p.level+" · "+p.hp+"/"+p.maxHp+" HP · "+p.xp+"/"+game.xpNeeded(p.level)+" XP":"Wild kin · "+k.types.join(" / ")});
    }
    function affinityChart() {
      return page("Affinity chart","FIELD GUIDE",[heading("Elemental strengths",Object.entries(dex.types).map(([name,t])=>info(name+" → "+t.strengths.join(" / "),t.description)))],
        "Each strike checks both of the target’s affinities. A weakness and a resistance cancel.");
    }
    function party(switching) {
      const call=switching&&s().battle?.kind==="wild"?game.wildCall?.():null;
      const hunt=!switching&&trailPartners?.entry();
      const rows=game.team().map(p=>{
        const k=own(p.id),pass=window.WilderFamilyTechniques.forKin(p.id);
        const battle=s().battle,lead=switching?battle?.activeId:s().lead;
        const f=switching?game.switchForecast(p.id):null;
        let detail=["Lv. "+p.level,p.hp+"/"+p.maxHp+" HP",k.types.join(" / "),held(p.id)?.name,pass?.name,guardStatus(game.guardTraining(p.id),true)].filter(Boolean).join(" · ");
        if(f?.available){
          const saving=f.protected&&f.damage<f.normalDamage?" instead of "+f.normalDamage:"";
          detail=(f.protected?"Shell Escort · ":"")+f.damage+" damage"+saving+" · "+f.hpAfter+"/"+f.maxHp+" HP after reply · "+k.types.join(" / ");
          const move=call?.options.find(o=>o.actor===p.id&&o.available);
          if(move&&f.hpAfter>0)detail+=" · answers with "+move.name;
          for(const event of f.fittingEvents||[])detail+=" · "+(event.preview||event.text);
        }
        return row(switching?"swap":"open-kin",k.name,p.id,detail,
          {image:image(p.id),badge:p.id===lead?"LEAD":"",disabled:switching&&(!f?.available)});
      });
      if(!switching&&window.WilderTrioPlanner)rows.push(row("open-trios","Build around a favorite",null,"Choose who leads, who plays the duet and who takes the next turn."));
      if(!switching&&window.WilderTrailRosterDesk)rows.push(row("yard-edit","Arrange a trail lineup",null,"Try companions in any seat, then save a pennant or take them onto the trail."));
      if(!switching&&window.WilderPracticeYard)rows.push(nav("practice-yard","Try this team at the Chalkyard","Compare leads and test reserve swaps with your own kin."));
      if(!switching&&game.trailFittings)rows.push(nav("kit-bench","Field fittings","Equip a campaign companion or visit Pella’s bench."));
      if (!switching) rows.push(row("reserve","Open reserve roster",null,(s().party.length-s().team.length)+" companions at camp"),nav("formations","Trail formations","Recall a party and its lead, with optional fittings."),nav("mentoring","Camp mentorship","Train a companion from your reserve."));
      if(!switching)rows.push(nav("walker","Walking partner","Check in or change who follows you."));
      if(!switching)rows.push(nav("growth-ledger","Starter growth","Compare forms and study their techniques."));
      if(!switching)rows.push(nav("sparring","Practice at the Sparring Hall","Build both teams from level-20 loaners."));
      if(!switching)rows.push(nav("bellpost","Battle a friend with this party","Bring your trail trio into a two-device Bellpost match."));
      return page(switching?"Send out a Wilderkin":"Traveling party","COMPANIONS",[...(hunt?[{rows:[hunt]}]:[]),heading("Your team",rows)],switching?"Changing kin spends this turn.":"Select a companion to read its skills or make it your leader.");
    }
    function growthLedger() {
      const entries=starterIds.map(id=>{
        const g=game.growthInfo(id);
        return open("growth",id,g.baseName+" → "+g.formName,g.requirements.find(t=>!t.done)?.label||"Available at camp.",{image:image(id),badge:g.selected?"TRAINED":g.earned?"READY":""});
      });
      return page("Starter growth","CAMP TRAINING",[heading("Companions",entries)],"Each starter can learn one of two disciplines. You can change its training and appearance at any camp.");
    }
    function growthPage(id) {
      id=id||selectedGrowth;
      const g=game.growthInfo(id);
      if(!g)return growthLedger();
      const controls=[];
      if(!g.atCamp)controls.push(row("growth-walk","Walk to camp",id,"Visit a training yard.",{disabled:!!s().battle}));
      if(g.selected&&g.atCamp)controls.push(row("growth-look",g.classic?"Wear grown form":"Wear original form",id,"Retain your trained skill."),row("growth-choose","Return to original discipline",id+"|","Practice the starter’s original moves."));
      const training=g.disciplines.map(d=>row("growth-choose",d.name,id+"|"+d.id,d.skill.name+" · "+d.skill.cost+" beats. "+d.skill.description,
        {badge:g.selected===d.id?"EQUIPPED":"",disabled:!g.earned||!g.atCamp||g.selected===d.id}));
      const sections=[{growth:{from:dex.spriteUrl(id),to:"art/growth/"+g.formId+".png",fromName:g.baseName,toName:g.formName,type:game.species[id].type}},
        heading("Field requirements",requirements(g.requirements)),heading("Choose a discipline",training)];
      if(controls.length)sections.push(heading("At the training yard",controls,2));
      return page(g.formName,"GROWTH   /   "+g.baseName,sections,g.description);
    }
    function enlist(id) {
      const swap=game.team().map(p=>row("assign",own(p.id).name,id+"|"+p.id,"Return to reserve · Lv. "+p.level,{image:image(p.id)}));
      return page("Call "+own(id).name,"RESERVE",[heading("Traveling party",s().team.length<6?[row("assign","Join the party",id+"|")]:swap)]);
    }
    function bag() {
      const rows=Object.values(game.items).map(item=>open("item",item.id,item.name,item.description,{badge:"×"+(s().bag[item.id]||0)}));
      return page("Field satchel","SUPPLIES",[heading("Equipment and provisions",rows),heading("Fieldwork",[
        row("gather","Gather materials",null,s().forageReady?"A fresh patch is ready":"Another field leg or wild encounter reveals a patch.",{disabled:!!s().battle||!s().forageReady})])],
        "Craft Kinweaves to invite wild companions. Medicine used during combat takes a turn.");
    }
    function itemPage(id) {
      const item=game.items[id],recipe=item.recipe,options=[];
      if (recipe) options.push(row("craft","Craft "+item.name,id,Object.entries(recipe).map(([m,n])=>game.items[m].name+" "+(s().bag[m]||0)+"/"+n).join(" · "),
        {disabled:!!s().battle||Object.entries(recipe).some(([m,n])=>(s().bag[m]||0)<n)}));
      if (item.use==="capture" && s().battle?.kind==="wild") {
        const ready=game.captureStatus();
        options.push(row("capture","Cast a Kinweave",null,ready.reason||"Offer 1 Kinweave.",{disabled:!ready.available}));
      }
      if(item.use==="meal")options.push(row("share-broth","Share with your party",null,"Enjoy between encounters.",{disabled:!!s().battle||!s().bag.broth||!game.team().some(p=>p.hp>0&&p.hp<p.maxHp)}));
      if (item.use==="heal"||item.use==="revive") for (const p of game.team()) {
        const injured=item.use==="revive"?!p.hp:p.hp>0&&p.hp<p.maxHp;
        const f=s().battle&&game.itemForecast?.(id,p.id);
        let detail=p.hp+"/"+p.maxHp+" HP";
        if(f?.available){
          detail="Restore "+f.gain+" HP → "+f.targetHpAfterHeal+"/"+f.targetMaxHp+". ";
          detail+=f.activeName+" takes "+f.returnDamage+" from "+f.replyName;
          if(f.activeRecovery)detail+=" and recovers "+f.activeRecovery;
          detail+=" · "+f.activeHpAfter+"/"+f.activeMaxHp+" HP after the turn.";
          if(f.fittingEvents.length)detail+=" "+fittingText(f);
        }
        options.push(row("use-item","Use on "+own(p.id).name,id+"|"+p.id,detail,
          {disabled:f?!f.available:!s().bag[id]||!injured,image:image(p.id)}));
      }
      if (!recipe) options.push(row("gather","Gather more materials",null,"Replenish supplies after fieldwork.",{disabled:!!s().battle||!s().forageReady}));
      return page(item.name,"SATCHEL  /  "+(s().bag[id]||0)+" HELD",[heading("Actions",options)],item.description);
    }
    function expedition() {
      const job=game.expedition(),i=s().region;
      const sections=[];
      if (job.done) {
        const next=i+1<game.regions.length?[open("region",i+1,"Next region",game.regions[i+1].name)]:[];
        sections.push(heading("Chart complete",[nav("objective","Current objective"),...next]));
      } else if (!job.atSite) {
        sections.push(heading("Work site",[wayTo(job.targetSite,"expedition"),nav("bag","Check provisions")].filter(Boolean)));
      } else {
        sections.push(heading("Field decision",job.choices.map(c=>row("expedition-choice",c.label,c.id,c.description,{disabled:!c.available}))));
      }
      if (!job.done && job.forecast) sections.push({title:job.forecast.name,text:job.forecast.description});
      if(i>=3)sections.push(heading("Other routes",[nav("passage","Naturalist’s report","Use wildlife studies for onward travel and trial admission.")]));
      return page(job.title,here().name+"  /  FIELD COMMISSION",sections,job.description,
        job.focus?{src:image(job.focus,false),caption:job.completed+" / "+job.total+" legs charted · "+game.species[job.focus].name}:undefined);
    }
    function passage() {
      const report=game.passageReport(),controls=[];
      if(!report)return page("Naturalist’s reports","FIELD STATION",[{text:"The first reporting desk is at Reedline Landing in the Sundrill Delta."}]);
      if(!report.filed)controls.push(report.atDesk?row("passage-file","File the report",null,"Register this passage.",{disabled:report.requirements.some(q=>!q.done)}):wayTo("travel","passage","Walk to the reporting desk"));
      if(report.filed&&s().region+1<game.regions.length)controls.push(open("region",s().region+1,"Onward route",game.regions[s().region+1].name));
      controls.push(nav("notebook","Study local wildlife"),nav("expedition","Continue the field commission"));
      return page("Naturalist’s report",here().name+"   /   "+(report.filed?"FILED":"TRAILPOST"),[heading("Evidence",requirements(report.requirements)),heading("Reporting desk",controls.filter(Boolean))],
        "A filed report satisfies the local survey requirement for travel and Warden trials. The station trains each traveling kin below the local wild level by one level. You can still finish the full commission.");
    }
    function objective() {
      const q=game.objective(),i=s().region,job=game.expedition(),next=game.wardens[s().crests.length];
      const choices=[];
      if (q.target!=null && q.target!==i) choices.push(open("region",q.target,"Plan the journey",game.regions[q.target].name));
      if (!job.done) choices.push(nav("expedition","Open regional commission",job.title));
      if(s().region>=3)choices.push(nav("passage","Naturalist’s route"));
      if (s().crests.length===game.wardens.length) choices.push(open("scene","ending","Read The Unstruck Bell","Final dispatch"),nav("stillwake","The fourth sounding"));
      choices.push(nav("chronicle","Read the chronicle"),nav("licenses","Field licenses"));
      if (next===i) choices.push(wayTo("warden","warden","Meet Warden "+here().warden));
      return page(q.title,"CURRENT OBJECTIVE",[heading("Next steps",choices.filter(Boolean))],q.description);
    }
    function licenseList() {
      return page("Field licenses","TRAVERSAL SCHOOL",[heading("Training ledger",Object.keys(dex.abilities).map(a=>{
        const l=game.license(a);return open("license",a,a,dex.abilities[a].description,{badge:l.earned?"LICENSED":"TRAINING"});
      }))],"Complete an instructor’s lesson, practice in the field, and befriend a carrier to open new passages.");
    }
    function license(a) {
      const l=game.license(a),scenes=story.catalog(s());
      const lesson=scenes.find(c=>c.kind==="lesson"&&(c.ability===a || c.id.toLowerCase().includes(a.toLowerCase()) || c.title.includes(a)));
      const controls=[];
      if (lesson) controls.push(open("scene",lesson.id,"Instructor’s lesson",lesson.title));
      controls.push(open("region",l.region,"Training ground",game.regions[l.region].name));
      if (!l.earned) controls.push(row("claim-license","Collect license",a,"Claim at the training ground.",{disabled:s().region!==l.region||!!s().battle||l.requirements.some(t=>!t.done)}));
      return page(a,l.earned?"LICENSED":"FIELD TRAINING",[heading("Requirements",requirements(l.requirements)),heading("Training",controls)],dex.abilities[a].description);
    }
    function warden() {
      const r=here(),i=s().region,job=game.expedition();
      const gate=game.trialAccess(i);
      const choices=[row("accept-trial",gate.open?"Accept the trial":"Trial locked",null,gate.reason,{tone:"primary",disabled:!gate.open}),
        ...(window.WilderPracticeYard?[s().landmark==="warden"?
          row("yard-invite",s().met.includes(i)||s().crests.includes(i)?"Rehearse "+r.warden+"’s lineup":"Ask "+r.warden+" for a practice bout",null,"Use the trial lineup in a friendly Chalkyard match.",{disabled:!!s().battle}):
          wayTo("warden","warden","Visit "+r.warden+" for a practice bout")].filter(Boolean):[]),
        ...(game.trailFittings?[nav("formations","Choose a trail formation","Preview a saved lineup for this trial."),nav("kit-bench","Inspect field fittings","Check the gear on your companions.")]:[]),
        ...(window.WilderTwinbell?[nav("twinbell","Visit Twinbell Grounds","Challenge three doubles Wardens with two leads on the field.")]:[]),
        open("second-bell",i,"Second Bell exhibition","Scout "+r.warden+"’s lineup and bring your own party."),
        nav("expedition","Open field commission",job.title),nav("chronicle","Listen to the chapter dispatch")];
      if(gate.target!=null && gate.target!==i)choices.push(open("region",gate.target,"Locate the uncharted passage",game.regions[gate.target].name));
      if(gate.target===i&&i>=3)choices.push(nav("passage","File a naturalist’s report"));
      const lesson=game.wardenLesson?.(i);
      return page("Warden "+r.warden,r.lodge,[heading("Trial",choices),...(lesson?[{title:lesson.title,text:lesson.brief+" "+lesson.challenge+" "+(lesson.mastered?"Mastery seal earned.":lesson.reward)}]:[])],s().crests.includes(i)?"Your crest still carries the mark of this lodge. Come spar again.":r.dialogue,
        {src:world.wardenArt(i),caption:r.crest+" · Lv. "+r.wardenLevel});
    }
    function crest(i) {
      const r=game.regions[i],lesson=game.wardenLesson?.(i);return page(r.crest,r.name,[heading("Trail record",[open("region",i,"Locate the lodge",r.lodge)]),...(lesson?[{title:lesson.mastered?"Mastery seal · "+lesson.title:lesson.title,text:lesson.brief+" "+lesson.challenge}]:[])],
        "Warden "+r.warden+" guards this crossing.",{src:world.crestArt(i,s().crests.includes(i)),caption:s().crests.includes(i)?"Crest earned":"Warden trial"});
    }
    function camp() {
      const atMill=atSite?.()?.label==="Brookside Mill";
      const relay=nav("reedbank",atMill?"Run the Reedbank Relay":"Practice at Brookside Mill","Borrow a scout and enter a crossing with Cindlet.");
      return page(atMill?"Brookside Mill":"Trail camp",here().name,[heading(atMill?"At the river crossing":"By the fire",[
        ...(atMill?[relay]:[]),
        ...(window.WilderPracticeYard?[nav("practice-yard","Enter the Chalkyard","Try your party’s skills, duets and fittings in a friendly battle.")]:[]),
        ...(game.trailFittings?[nav("kit-bench","Pella Hem’s field bench","Collect or fit gear for the traveling party.")]:[]),
        row("rest","Rest the party",null,s().refit?"Your veteran team can complete field retraining here.":"Restore all companions to full health.",{tone:"primary"}),
        ...(s().region<2?[nav("guard-school","Meet Neri Pike","Learn a guard in a real encounter with your own kin.")]:[]),
        ...(s().region===0&&!atMill?[relay]:[]),
        nav("growth-ledger","Starter growth"),nav("mentoring","Camp mentorship"),nav("formations","Trail formations"),nav("bag","Prepare supplies"),nav("chronicle","Courier’s chronicle"),nav("bonds","Traveling companions"),nav("expedition","Check field commission")])]);
    }
    function tracks(trailhead=false) {
      const site=siteFor("wild"),atTracks=s().landmark==="wild",ids=game.pools[s().region];
      const calls=ids.flatMap(id=>{
        const call=game.wildCall?.(id);
        if(!call)return [];
        return [open("wild-scout",id,game.species[id].name+" · "+call.title,call.answer,{image:image(id,false)})];
      });
      const sections=[];
      if(!atTracks)sections.push(heading("From here",[wayTo("wild","tracks","Walk to "+site.label)]));
      if(calls.length)sections.push(heading("Scout a wild call",calls));
      if(atTracks)sections.push(heading("Follow tracks into battle",ids.map(id=>localSpecies(id,"track"))));
      sections.push(heading("Supplies",[nav("bag","Check satchel",s().bag.kinweave+" Kinweaves packed")]));
      return page(trailhead?"Wild calls":"Wild tracks",here().name,sections,
        calls.length?"Some wild kin ask your party for help. Aim a move at the field to offer a Kinweave at full health. You can also battle and offer at half health.":
          "Wild Lv. "+game.wildLevel(s().region)+" · Lower an unfamiliar kin to half health to offer a Kinweave.",
        trailhead?{src:"art/story/wild-calls.png",caption:site.label,landscape:true,height:168}:undefined);
    }
    function wildHelper(call) {
      const h=window.WilderWildCalls.helper(game,call);
      if(!h)return null;
      const move=h.name+" knows "+h.skill+".";
      if(h.traveling){
        const rest=wayTo("camp","camp",h.healthy?"Rest a relay partner":"Rest "+h.name);
        return {...rest,detail:move+(h.healthy?" A second conscious traveler must receive the pass.":" Restore its HP at camp.")};
      }
      if(h.owned)return open(s().team.length>=6?"enlist":"kin",h.id,"Bring "+h.name+" from reserve",move,{image:image(h.id)});
      if(h.region===s().region)return open(game.wildCall(h.id)?"wild-scout":"kin",h.id,"Find "+h.name+" here",move,{image:image(h.id,false)});
      return open("region",h.region,"Find "+h.name+" in "+game.regions[h.region].name,move+" Check the crossing on the atlas.",{image:image(h.id,false)});
    }
    function wildScout(id) {
      const call=game.pools[s().region].includes(id)&&game.wildCall?.(id);
      if(!call)return tracks();
      const team=game.team(),lead=team.find(p=>p.id===s().lead&&p.hp>0)||team.find(p=>p.hp>0);
      const k=game.species[id],atTracks=s().landmark==="wild",site=siteFor("wild");
      const rows=team.map(p=>{
        const o=call.options.find(o=>o.actor===p.id&&o.available);
        return row("wild-lead",own(p.id).name,p.id,!p.hp?"Rest at camp":o?o.name+(o.partner?" · hand off to a reserve":"")+" can answer":"No matching field move",
          {image:image(p.id),disabled:!p.hp||p.id===lead?.id,badge:p.id===lead?.id?"LEAD":""});
      });
      const answer=lead&&call.options.find(o=>o.actor===lead.id&&o.available);
      const detail=!lead?"Rest at camp first.":own(lead.id).name+(answer?" can answer with "+answer.name+".":" leads · choose a matching kin below or battle.");
      const next=atTracks?row("track","Approach "+k.name,id,detail,{disabled:!lead,tone:"primary"}):
        row("wild-scout-walk","Walk to "+site.label,id,"Follow the tracks to "+k.name+".",{tone:"primary"});
      const helper=wildHelper(call);
      const sections=[{title:call.title,text:call.scene+" "+call.answer,rows:helper?[next,helper]:[next]}];
      if(lead&&call.strike&&call.warning){
        const strike=call.strike,warning=call.warning,opener=own(lead.id).name;
        sections.push({title:"If "+opener+" attacks",text:strike.name+" deals "+strike.damage+" damage. "+
          (strike.finishes?k.name+" falls before replying.":k.name+" answers with "+warning.name+" ("+warning.type+") for "+warning.damage+" damage.")});
      }
      sections.push(heading("Choose your field lead",rows));
      return page(k.name+"’s tracks",here().name+"   /   WILD CALL",sections,
        "Wild Lv. "+game.wildLevel(s().region)+" · "+s().bag.kinweave+" Kinweaves packed",{src:image(id,false),caption:k.types.join(" / ")});
    }
    function notebook() {
      const entries=game.notebook(),local=game.sightings();
      const mark=d=>d.complete?"FILED":d.clues.some(c=>c.read)?"IN PROGRESS":"";
      return page("Field notebook",entries.filter(d=>d.complete).length+" BEHAVIORS RECORDED",[
        heading("Sightings in "+here().name,local.map(site=>{
          const d=game.study(site.species);
          return open("study",d.id,d.name,d.title,{badge:d.complete&&!d.habitatRecorded?"NEW HABITAT":mark(d),image:image(d.id,false)});
        }),2),...(entries.length?[{title:"Your observations"},...pages(entries.map(d=>open("study",d.id,d.title,d.name+" · "+d.location,{badge:mark(d)})),"notebookPage",6)]:[])],
        "Follow a wild kin, read its signs and choose an approach. The first two solved sightings per region each chart one unfinished commission leg.");
    }
    function study(id) {
      const d=game.study(id);
      if(!d) return notebook();
      const sections=[],local=s().region===d.region,owned=!!member(id);
      if(d.atSite||d.complete)sections.push(window.WilderFieldwork.panel(d));
      if(d.complete)sections.push({title:"Recorded behavior",text:d.answer});
      if(d.canRecordHabitat)sections.push(heading("Local survey",[row("field-observe","Record this habitat",id+"|record-habitat",
        "Add the "+d.location+" sighting to your field note.")]));
      const signs=d.clues.filter(c=>c.text);
      if(signs.length) sections.push(...signs.map(c=>({title:c.label,text:c.text})));
      if(!d.atSite) {
        sections.push(heading("Habitat",[local ?row("walk-kind","Walk to "+d.name,"sighting:"+id+"|","Follow its marker on the map.",{disabled:!!s().battle})
          :open("region",d.region,"Find its habitat",d.location)]));
      } else if(!d.complete) {
        const help=id==="mossbell"?outing.assistRow(d):null;
        if(help)sections.push(heading("Ask your partner",[help]));
        sections.push(heading("Read the signs",d.clues.filter(c=>!c.read).map(c=>row("field-observe",c.label,id+"|"+c.id)),3));
        if(d.nextHint)sections.push({text:d.nextHint});
        sections.push(heading("How will you approach?",d.choices.map(c=>row("field-observe",c.label,id+"|"+c.id,c.detail,{disabled:!d.canRespond||c.tried}))));
      } else if(!owned) {
        const invitation=game.canInvite(id);
        sections.push(heading("Offer a bond",[row("field-invite","Offer a Kinweave",id,invitation.ok?"Use 1 of "+s().bag.kinweave+" Kinweaves.":invitation.message,{disabled:!invitation.ok,tone:"primary"}),nav("bag","Open satchel")]));
      }
      sections.push(...guardSection(id),heading("Notebook",[open("kin",id,"Field guide entry",d.name),nav("notebook","Other sightings")],2));
      return page(d.title,"FIELD OBSERVATION   /   "+d.name,sections,d.description,d.atSite||d.complete?undefined:{src:image(id,false),caption:d.location});
    }
    function requestStatus(q) {
      if (s().quests[q.id]==="claimed") return "Completed";
      if (s().quests[q.id]==="active") {const p=fair.progress(q,s());return p.current>=p.total?"Ready":"Active";}
      return s().visited.includes(q.region)?"Available":"Undiscovered";
    }
    function quests() {
      const entries=fair.quests.filter(q=>filter.questFilter==="All"||requestStatus(q)===filter.questFilter||
        (filter.questFilter==="Active" && requestStatus(q)==="Ready")).map(q=>open("request",q.id,q.name,q.requester+" · "+game.regions[q.region].name,{badge:requestStatus(q)}));
      return page("Quest journal","FIELD NOTES",[
        heading("Campaign", [nav("objective","Main objective",game.objective().title),nav("expedition","Field commission"),nav("bonds","Character quests"),nav("licenses","Traversal lessons"),nav("stillwake","The fourth sounding","Investigate the unlisted signal.")],2),
        heading("Regional requests",[row("cycle-quests","Filter: "+filter.questFilter),nav("crests","Crest ledger")],2),...pages(entries,"questPage")],
        Object.values(s().quests).filter(v=>v==="claimed").length+" / "+fair.quests.length+" local requests completed.");
    }
    function request(id) {
      const q=fair.quests.find(q=>q.id===id),p=fair.progress(q,s()),status=requestStatus(q);
      const options=[open("region",q.region,"Posting region",game.regions[q.region].name)];
      if (status==="Available" || status==="Ready") options.unshift(row("request-step",status==="Available"?"Accept request":"Claim 75 XP",id,"",{tone:"primary",disabled:!!s().battle}));
      return page(q.name,q.requester+"   /   "+status,[heading("Journal",[info(p.label,p.current+" / "+p.total),...options])],q.description);
    }
    function games() {
      const entries=fair.games.map(a=>open("game-info",a.id,a.name,game.regions[a.region].name,{badge:s().passes.includes(a.id)?"PASS":"LOCKED"}));
      return page("Field games",s().passes.length+" / "+fair.games.length+" PASSES",[...pages(entries,"gamePage")],"Each station keeps its own games. Earn a permanent pass and return there to play.");
    }
    function gameInfo(id) {
      const g=fair.games.find(a=>a.id===id),pass=game.gamePass(id),local=s().region===g.region,atStation=s().landmark==="activities";
      const options=[];
      if (pass.earned&&local) options.push(row("play-start","Sit at the table",id,"",{tone:"primary",disabled:!!s().battle}));
      else if (local && atStation && !pass.earned) options.push(row("unlock-game","Collect station pass",id,pass.reason,{disabled:pass.requirements.some(t=>!t.done)||!!s().battle}));
      else if (local) options.push(wayTo("activities","station","Walk to the host station"));
      if (!local) options.push(open("region",g.region,"Find the host station",game.regions[g.region].name));
      return page(g.name,game.regions[g.region].name+"  /  "+(s().clears[id]||0)+" CLEARS",[
        heading(pass.earned?"Permanent admission":"Admission requirements",pass.earned?[info("Pass earned","Valid in this region.")]:requirements(pass.requirements)),heading("At the table",options.filter(Boolean))],g.description);
    }
    function station() {
      const i=s().region,local=fair.games.filter(g=>g.region===i),notices=fair.quests.filter(q=>q.region===i);
      const sections=[heading("Fieldwork",[nav("expedition","Regional commission",game.expedition().title),nav("licenses","Training ledger")],2)];
      sections.unshift(heading("Loaner Circuit",[nav("circuit","Enter the circuit","Draft a team and scout the next bout.")]));
      sections.unshift(heading("Sparring Hall",[nav("sparring","Build a trio and spar","Scout eight rival teams or play another person on this device."),
        open("sparring","cup","Lantern Cup","Choose three from your six for each bout.")],2));
      if(i>=3)sections.push(heading("Route survey",[nav("passage","Naturalist’s report")]));
      if (!s().landmark || s().landmark!=="activities") sections.unshift(heading("Local station",[wayTo("activities","station","Walk to the station")]));
      sections.push(heading("Games",local.length?local.map(g=>open("game-info",g.id,g.name,game.gamePass(g.id).reason)):[nav("games","Games register","Find a host region.")]));
      sections.push(heading("Noticeboard",notices.length?notices.map(q=>open("request",q.id,q.name,q.requester+" · "+requestStatus(q))):[nav("quests","Open requests")]));
      return page("Field station",here().name,sections);
    }
    const portrait=id=>{
      if (id==="fern"||id==="orris") return world.wardenArt(id==="fern"?0:149);
      return story.characters.some(c=>c.id===id)&&id!=="trail"?"art/story/"+id+".png":null;
    };
    const kindLabels={chapter:"Chapters",bond:"Companion quests",lesson:"Field lessons",ending:"Final dispatch"};
    function storyLink(c) {
      return open("scene",c.id,c.title,c.requirement||game.regions[c.region]?.name||"",{badge:c.status});
    }
    function chronicle() {
      const catalog=story.catalog(s()),entries=catalog.filter(c=>c.kind===filter.storyKind);
      const current=entries.find(c=>c.status==="in progress")||entries.find(c=>c.status==="available");
      const sections=[];
      if (current) sections.push(heading("On Finch’s desk",[open("scene",current.id,current.title,current.summary,{tone:"primary"})]));
      sections.push(heading("Journal",Object.entries(kindLabels).map(([kind,label])=>row("story-kind",label,kind,"",{badge:kind===filter.storyKind?"OPEN":""})).concat(nav("bonds","Cast and bonds")),2),
        ...pages(entries.map(storyLink),"storyPage",6));
      return page("The Missing Beat","FINCH VALE’S CHRONICLE",sections,
        "Eleven years ago, Finch carried an order that told a flooded valley to wait. Now the bells are sounding again.");
    }
    function scene(id) {
      const record=story.catalog(s()).find(c=>c.id===id);
      if (!record) return chronicle();
      const moment=story.scene(s(),id),sections=[];
      const who=moment?.speakerId||record.character;
      const src=portrait(who);
      if (record.status==="locked") {
        sections.push(heading("To open this dispatch",[info(record.requirement||"Continue the campaign."),open("region",record.region,"Locate on the atlas",game.regions[record.region].name)]));
      } else if (record.status==="complete") {
        if (moment.text) sections.push({title:id==="ending"?"Your ending":"Finch’s entry",text:moment.text});
        sections.push(heading("Filed in the chronicle",[open("transcript",id,"Read the conversation"),nav("chronicle","Return to the chronicle"),nav("bonds","Visit the cast")]));
      } else {
        sections.push({title:moment.speaker||"Field notes",text:moment.text});
        const choices=moment.choices.length?moment.choices:[{id:"",label:moment.step===moment.total?"File this dispatch":"Continue"}];
        const answers=choices.map(c=>row("story-step",c.label,id+"|"+c.id,"",{disabled:!!s().battle,tone:"primary"}));
        if(moment.jump)answers.push(row("story-jump",moment.jump.label,id,"",{disabled:!!s().battle}));
        if(moment.step>1)answers.push(open("transcript",id,"Read conversation so far"));
        sections.push(heading(moment.choices.length?"Finch’s reply":"Dispatch · "+moment.step+" / "+moment.total,answers));
        if(moment.lockedChoices.length) sections.push(heading("Other endings",moment.lockedChoices.map(c=>info(c.label,c.requirement))));
      }
      return page(record.title,kindLabels[record.kind]+"   /   "+game.regions[record.region].name,sections,
        record.status==="locked"||record.status==="complete"?record.summary:"",
        src?{src,caption:moment?.speaker||story.characters.find(c=>c.id===who)?.name}:undefined);
    }
    function transcript(id) {
      const record=story.catalog(s()).find(c=>c.id===id);
      return page(record.title,"FINCH’S NOTEBOOK",story.transcript(s(),id).map(turn=>({title:turn.speaker,text:turn.text})));
    }
    function bonds() {
      const bonds=story.bonds(s());
      const cast=story.characters.filter(c=>c.id!=="trail").map(c=>{
        const b=bonds.find(b=>b.id===c.id);
        return open("character",c.id,c.name,c.role,{image:portrait(c.id),badge:b?b.rank:""});
      });
      return page("Cast and bonds","FINCH’S NOTEBOOK",[heading("Traveling company",cast,2)],"Follow each companion’s unfinished business. Your replies become part of their story.");
    }
    function character(id) {
      const c=story.characters.find(c=>c.id===id),b=story.bonds(s()).find(b=>b.id===id);
      const entries=story.catalog(s()).filter(scene=>scene.character===id && (b?scene.kind==="bond":scene.kind==="chapter"));
      const sections=[{title:c.role,text:c.bio}];
      if(b) sections.push({title:b.rank,text:b.points+" trust · "+b.completed+" / "+b.total+" personal quests completed."});
      if(entries.length) sections.push(heading("Conversations",entries.map(storyLink)));
      return page(c.name,"PEOPLE OF THE TRAIL",sections,"",{src:portrait(id),caption:c.role});
    }
    function crests() {
      return page("Crest ledger",s().crests.length+" / "+game.wardens.length+" CRESTS",pages(game.wardens.map(i=>{
        const r=game.regions[i];return open("crest",i,r.crest,r.warden+" · "+r.name,{badge:s().crests.includes(i)?"EARNED":"",image:world.crestArt(i,s().crests.includes(i))});
      }),"crestPage",6));
    }
    function search() {
      return page(filter.searchFor==="guide"?"Search the field guide":"Search the atlas","TRAIL INDEX",[
        {title:"Search text",text:filter.entry||"Enter a name or a few letters."},
        heading("Search controls",[row("search-key","Show matches","apply","",{tone:"primary"}),row("search-key","Delete letter","remove"),row("search-key","Clear","clear"),row("search-key","Space"," ")],2),
        {grid:{cols:6,cells:[..."ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"].map(c=>row("search-key",c,c))}}]);
    }
    function searchKey(value) {
      if(value==="apply") {filter[filter.searchFor+"Search"]=filter.entry.trim();filter[filter.searchFor+"Page"]=0;back();return;}
      if(value==="remove") filter.entry=filter.entry.slice(0,-1);
      else if(value==="clear") filter.entry="";
      else if(filter.entry.length<36) filter.entry+=value;
      render();
    }
    function typeKey(e) {
      if(e.key==="Enter" && document.activeElement?.tagName!=="BUTTON") {searchKey("apply");return true;}
      if(e.key==="Backspace") {searchKey("remove");return true;}
      if(/^[a-z0-9 -]$/i.test(e.key)) {searchKey(e.key);return true;}
      return false;
    }
    function options() {
      return page("Trail settings","WILDERKIN",[heading("Play",[
        row("sound",s().sound?"Sound effects on":"Sound effects off",null,"Control skill and menu sounds."),
        row("music","Music · "+["Off","Quiet","Full"][s().music],null,"Change the instrumental score."),
        row("speed","Battle animations · "+s().animationSpeed+"×",null,"Cycle through 1×, 2× and 3×."),nav("help","Controls"),nav("updates","What’s new in Wilderkin"),nav("reset-confirm","Start over","Erase this device’s Wilderkin save.")])],
        game.canSave?"Progress saves automatically in this browser.":"Browser storage is unavailable. This session’s progress cannot be stored.");
    }
    function updates() {
      const forms=starterIds.map(id=>{
        const g=game.growthInfo(id);
        return open("growth",id,g.formName,g.baseName+"’s two camp disciplines",{image:"art/growth/"+g.formId+".png"});
      });
      const lodge=game.wardens.find(i=>!s().wardenLessons.includes(i))??0;
      return page("What’s new in Wilderkin","FIELD DISPATCH   /   MOSSBROOK VALE",[
        ...(game.firstBattle?[heading("The Clover Clearing tracks",[nav("first-battle","Face Opalclasp with your starter","Pick a lead, earn duet beats and bring a third companion into the fight.")])]:[]),
        ...(window.WilderThirdBeat?[heading("Three kin, one opening",[nav("third-beat","Meet Iona at the ferry","Play a duet, then let a third kin take the lead with its own skill."),row("open-trios","Build a trio around a favorite")])]:[]),
        ...(window.WilderTrailRosterDesk?[heading("Build a traveling party",[row("yard-edit","Arrange your team",null,"Reorder six companions, choose a lead, then field the tested party against a real opponent.")])]:[]),
        ...(window.WilderPracticeYard?[heading("Try your campaign team",[nav("practice-yard","Enter the Chalkyard","Compare a reserve, face a local kin or a familiar Warden, and replay the last decision.")])]:[]),
        heading("Gear for the trail",[nav("kit-bench","Visit the field fittings bench","Choose a fitting for one of your own companions."),nav("formations","Trail formations","Record your party and fittings on a pennant.")]),
        heading("Switchyard Cup",[nav("switchyard","Face Captain Sela Switch","Register six and choose a new four for each doubles game. First to two wins takes the Cup.")]),
        heading("Battle with a pair",[nav("twinbell","Fight at Twinbell Grounds","Bring four kin and choose both leads’ orders against the doubles Wardens.")]),
        heading("Play a rental team",[nav("rental-counter","Visit the Rental Counter","Borrow four kin, pick three to battle, or bring your own team to face them.")]),
        heading("Build a pairing",[nav("partner-finder","Find a duet partner","Choose a skill for two kin, compare partners and try it in battle.")]),
        heading("Rehearse a battle",[nav("film-room","Enter the Film Room","Take Kilnbeak’s side at 22 HP, or bring your own match film.")]),
        heading("Scout a lineup",[nav("scout-table","Take a seat at the Scout Table","Bring four kin, scout your opponent and choose three."),open("sparring","scout-practice","Practice with a coach","Try the draft and battle using loaners.")]),
        heading("Ember partners",[open("sparring","ember","Meet Charquill and Kilnbeak","Tend a wounded reserve with Charquill or strike and recover with Kilnbeak.")]),
        heading("Battle a friend",[nav("bellpost","Open the Bellpost desk","Invite a friend, exchange turn links or connect on the same Wi-Fi.")]),
        heading("Calls on the trail",[nav("wild-calls","Follow a wild call","Scout a local kin, pick a lead and aim its move at a field target.")]),
        heading("Warden exhibitions",[nav("second-bell","Enter the Second Bell","Scout a Warden’s published formation and challenge it with your traveling party.")]),
        heading("Neri Pike’s guard school",[nav("guard-school","Train a guard with Neri","Find Opalclasp in Mossbrook Vale or Cragroll in Cinderfall Ridge.")]),
        {title:"Battle forecasts",text:"Each ordinary skill shows the damage it deals or HP it restores, plus how much damage comes back. Switch kin shows each reserve’s HP after the reply and how much a prepared Shell Escort saves."},
        heading("Brookside Mill",[nav("reedbank","Run the Reedbank Relay","Borrow Gustlance or Galeskip for two crossings with Cindlet.")]),
        heading("Sparring Hall",[
          open("sparring","cup","Enter the Lantern Cup","Register six kin. Choose your lead and two reserves again between bouts."),
          open("sparring","bench:grove","The Thornbridge crossing","Protect a teammate with Mossbell or read a rival’s attack with Fernprickle."),
          open("sparring","bench:workshop","The Earth Wire wager","Try one piece of equipment against Earth Wire’s trio."),
          open("sparring","edit:left:gear:0","Choose your lead’s equipment","Inspect six pieces and see exactly when each activates."),
          open("sparring","bench","Open your team case","Save two versions of a trio and see how each fares against the same rival."),
          nav("sparring","Build your team and battle","Choose three of 500 loaners, scout a rival and spar at level 20.")]),
        heading("Meet the grown forms",forms),
        heading("On the trail",[
          ...(game.firstOuting.offer()?[nav("first-outing","Choose your first trail partner","Walk to a Mossbell sighting together.")]:[]),
          nav("chronicle","Read Finch’s dispatches","Jump to your next reply or read every line."),
          open("crest",lodge,"Read Warden "+game.regions[lodge].warden+"’s lesson",game.wardenLesson(lodge).title),
          nav("notebook","Study nearby wildlife","Read the signs and approach a wild kin."),
          nav("passage","Take the naturalist’s route","File wildlife reports from Reedline Landing onward."),
          nav("stillwake","Investigate the fourth sounding","Follow an unlisted signal across the trail."),
          nav("circuit","Draft a loaner team","Try a three-bout course with a fresh squad.")]),
        heading("Adventure",[row("root",s().battle?"Return to your battle":"Explore the map",null,"",{tone:"primary"})])],
        "Read what a wild kin needs. A companion with the right skill can answer its call and earn an invitation.");
    }
    function help() {
      return page("Controls","TRAIL HANDBOOK",[
        {title:"Explore",text:"Click or tap a landmark to walk there. Move with WASD or the arrow keys. Press E to interact. In combat, 1–4 select skills. After a knockout, use the letter beside a reserve to send it in for free."},
        {title:"Journal shortcuts",text:"Q quests · X expedition · C chronicle · G field guide · N wildlife notebook · P party · M atlas · B satchel · F field games · V sparring hall · L loaner circuit · R battle duets · ? settings."},
        {title:"Menus",text:"Tap Menu or press F1 for all screens. Scroll or swipe to see more. Tab moves between controls, Enter selects, and Escape goes back."}]);
    }
    function model(name,value) {
      switch(name) {
        case "atlas":return atlas();
        case "districts":return districts(null);
        case "district":return districts(value);
        case "pins":return pins();
        case "walker":return walkers.model(value);
        case "growth-ledger":return growthLedger();
        case "updates":return updates();
        case "first-outing":return outing.model();
        case "growth":return growthPage(value);
        case "growth-reveal":{
          const g=game.growthInfo(value),k=own(value);
          return page(g.formName,"A FIELD MILESTONE",[{reveal:{from:dex.spriteUrl(value),to:"art/growth/"+g.formId+".png",start:growthMoment,type:k.type}},
            {title:k.discipline.name,text:k.discipline.skill.name+" · "+k.discipline.skill.description},
            heading("Training yard",[open("kin",value,"Meet "+k.name),open("growth",value,"Review disciplines")],2)],g.description);
        }
        case "stillwake":return mystery.model();
        case "passage":return passage();
        case "hollows":case "hollow":return hollows.model(name,value);
        case "notebook":return notebook();
        case "study":return study(value);
        case "family-pass":{
          const pass=game.familyTechnique();
          if(!pass)return party(false);
          const targets=pass.targets.map(p=>row("family-pass",p.name,p.id,
            (p.heal?"Recover "+p.heal+" HP · ":"")+"Incoming "+p.returnDamage+" damage · "+p.hpAfter+" / "+p.maxHp+" HP after"+(fittingText(p)?" · "+fittingText(p):""),
            {image:image(p.id),disabled:!pass.available,badge:p.hpAfter===0?"WILL FAINT":undefined}));
          return page(pass.name,pass.family+"   /   1 BEAT",[heading("Who takes the lead?",targets),{text:pass.reason||"Your team can use one family pass this battle."}],pass.summary);
        }
        case "duets":{
          const d=game.duets();
          return page("Trail duets",d.beats+" / "+d.max+" BEATS",[
            heading("Call a partner",d.options.map(o=>row("duet",o.name,o.partnerId,[own(o.partnerId).name,o.role,o.reason,o.preview,fittingText(o)].filter(Boolean).join(" · "),{image:image(o.partnerId),disabled:!o.available,badge:o.cost+" beats"})))],d.hint);
        }
        case "region":return regionPage(Number(value));
        case "guide":return guide();
        case "kin":return kinPage(value);
        case "affinities":return affinityChart();
        case "enlist":return enlist(value);
        case "party":case "switch":return party(name==="switch");
        case "bag":return bag();
        case "item":return itemPage(value);
        case "expedition":return expedition();
        case "objective":return objective();
        case "licenses":return licenseList();
        case "license":return license(value);
        case "warden":return warden();
        case "crest":return crest(Number(value));
        case "crests":return crests();
        case "camp":return camp();
        case "tracks":return tracks();
        case "wild-calls":return tracks(true);
        case "wild-scout":return wildScout(value);
        case "request":return request(value);
        case "quests":return quests();
        case "games":return games();
        case "game-info":return gameInfo(value);
        case "station":return station();
        case "chronicle":return chronicle();
        case "scene":return scene(value);
        case "transcript":return transcript(value);
        case "bonds":return bonds();
        case "character":return character(value);
        case "search":return search();
        case "settings":return options();
        case "help":return help();
        case "reset-confirm":return page("Begin a new adventure?","SAVE FILE",[
          heading("Your current expedition will be erased",[row("back","Keep my adventure",null,"",{tone:"primary"}),row("reset-save","Erase save and start over",null,"",{tone:"danger"})])]);
        case "landmarks":return page(here().name,"LOCAL LANDMARKS",[heading("Walk to",localLinks())]);
        default:return caravans.model(name,value);
      }
    }
    function cycle(key,values,pageKey) {
      filter[key]=values[(values.indexOf(filter[key])+1)%values.length];filter[pageKey]=0;render();
    }
    function act(id,value) {
      const [a,b]=String(value??"").split("|");
      switch(id) {
        case "field-partners":{
          if(!openFinder)return;
          const fromGuide=value==="guide",state=s();
          const anchor=fromGuide?(game.species[state.lead]?.bonus?"dewfin":state.lead):value;
          if(!Object.hasOwn(game.species,anchor)||game.species[anchor].bonus)return;
          const reserve=[...state.team,"sprigkit","dewfin"].find(k=>k!==anchor&&!game.species[k].bonus);
          const catalog=fromGuide?guideScope(state).filter(k=>!k.bonus).map(k=>k.id):undefined;
          openFinder({...window.WilderPartnerSearch.searchSeed(fromGuide?filter.guideSearch:""),anchor,slot:1,team:[anchor,reserve],
            foes:game.pools[state.region],foeLabel:"In this habitat",catalog,catalogLabel:fromGuide&&filter.collection!=="All"?filter.collection+" kin":"Field guide",
            label:"Field guide · "+own(anchor).name,back:()=>go(fromGuide?"guide":"kin",fromGuide?null:anchor,"replace")});return;
        }
        case "view":return go(a,b);
        case "page-step":filter[a]+=Number(b);return render();
        case "route-step":filter.atlasRoute+=Number(value);filter.atlasSearch="";filter.atlasPage=0;return render();
        case "atlas-route":filter.atlasRoute=Number(value);filter.atlasSearch="";filter.atlasPage=0;return go("atlas");
        case "atlas-pin":return setResult(game.pinRegion(Number(a),b));
        case "search-edit":filter.searchFor=value;filter.entry=filter[value+"Search"];return go("search",value);
        case "search-key":return searchKey(value);
        case "cycle-collection":return cycle("collection",["All","Seen","Owned","Reserve","Local","Carriers"],"guidePage");
        case "cycle-affinity":return cycle("affinity",["All",...Object.keys(dex.types)],"guidePage");
        case "cycle-quests":return cycle("questFilter",["All","Active","Available","Completed","Undiscovered"],"questPage");
        case "reserve":filter.collection="Reserve";filter.affinity="All";filter.guideSearch="";filter.guidePage=0;return go("guide");
        case "assign":{const res=game.enlist(a,b);if(res.ok) go("party",null,"replace");return setResult(res);}
        case "growth-walk":selectedGrowth=value;return locate("camp","growth");
        case "growth-choose":{
          const previous=game.growthInfo(a).selected,res=game.chooseGrowth(a,b||null);
          if(res.ok && !previous && b){growthMoment=performance.now();playTone("reward");return go("growth-reveal",a,"replace");}
          return setResult(res);
        }
        case "growth-look":return setResult(game.growthAppearance(value,!game.growthInfo(value).classic));
        case "lead":return setResult(game.setLead(value));
        case "wild-lead":return setResult(game.setLead(value));
        case "wild-scout-walk":return locate("wild",{name:"wild-scout",value});
        case "use-item":return s().battle?resolveBattle(()=>game.useItem(a,b),{type:"Grove",kind:"item",name:game.items[a].name}):setResult(game.useItem(a,b));
        case "share-broth":return setResult(game.useItem("broth"));
        case "passage-file":return setResult(game.filePassage());
        case "gather":return setResult(game.gather());
        case "craft":return setResult(game.craft(value));
        case "walk-kind":return locate(a,b);
        case "field-observe":return setResult(game.observe(a,b));
        case "field-invite":{
          const res=game.inviteField(value);
          if(!res.ok)return setResult(res);
          return fieldRecruited(value,res);
        }
        case "expedition-choice":{
          const res=game.expeditionAction(value);
          if(res.ok&&s().battle){playTone("battle");return go("battle",null,"root");}
          return setResult(res);
        }
        case "claim-license":return setResult(game.claimLicense(value));
        case "unlock-game":return setResult(game.unlockGame(value));
        case "accept-trial":{const res=game.meetWarden();if(!res.ok)return notify(res.message);return fight("warden");}
        case "track":return fight("wild",value);
        case "rest":return setResult(game.heal());
        case "request-step":return setResult(game.questAction(value));
        case "travel":return travel(Number(value));
        case "story-kind":filter.storyKind=value;filter.storyPage=0;return render();
        case "story-step":
        case "story-jump":{
          const res=game.storyStep(a,b||undefined,id==="story-jump"?"jump":undefined);
          if(!res.ok)return notify(res.message);playTone("click");return render();
        }
        case "sound":return setResult(game.setSound(!s().sound));
        case "speed":return setResult(game.cycleAnimationSpeed());
        case "music":return setResult(game.cycleMusic());
        case "reset-save":return reset();
        default:return outing.act(id,value)||caravans.act(id,value)||walkers.act(id,value)||hollows.act(id,value)||mystery.act(id,value);
      }
    }
    return {model,act,typeKey,hollowKey:(e,id)=>hollows.key(e,id),reset(){filter=settings();}};
  }
};
