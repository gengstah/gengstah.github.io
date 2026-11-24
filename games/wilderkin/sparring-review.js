// A completed rival match is the two lineups, the starting seat, and its successful commands.
(() => {
  "use strict";
  const leader=side=>side.team[side.active];
  const health=side=>side.team.reduce((sum,k)=>sum+k.hp,0);
  const group=(title,rows,columns=1)=>({title,rows,columns});
  function create({game,sim,species,row,image,go,read}) {
    species=species||game.species;
    sim=sim||window.WilderSparringBattle.create({species});
    const name=id=>species[id].name;
    const actor=(pos,seat)=>name(leader(pos.sides[seat]).id);
    const sideName=(seat,human)=>seat===human?"Your team":"Rival team";
    const link=(label,value,detail="",extra={})=>row("spar-review-open",label,value,detail,extra);
    const leave=()=>row("spar-review-leave","Return to the hall result");
    const perPage=6;
    let cached=null;
    function replay(record) {
      if(!record)return null;
      const setup=record.setup||record,human=record.human??0,{first,moves}=record;
      if((setup.mode!==undefined&&setup.mode!=="cpu")||![0,1].includes(human)||![0,1].includes(first)||
        !Array.isArray(moves)||!moves.length||moves.length>66||moves.some(id=>typeof id!=="string"||id.length>80)||
        ![setup.left,setup.right].every(team=>Array.isArray(team)&&team.length===3&&team.every(id=>typeof id==="string"&&id.length<=80)))return null;
      const signature=JSON.stringify([setup.left,setup.right,setup.gear,human,first,moves]);
      if(cached?.signature===signature)return cached;
      let pos=sim.start(setup.left,setup.right,first,setup.gear);
      if(!pos)return null;
      const events=[];
      for(const id of moves){
        const move=sim.forecast(pos,id);
        if(!move?.available)return null;
        const after=sim.apply(pos,id);
        events.push({before:pos,move,after});pos=after;
      }
      if(pos.phase!=="done")return null;
      cached={signature,human,events,final:pos};
      return cached;
    }
    const number=e=>e.before.ply+1;
    const turnLabel=e=>e.move.kind==="replace"?"Replacement before action "+number(e):"Action "+number(e);
    function context(pos,human){
      return [human,1-human].map(i=>{
        const side=pos.sides[i],p=leader(side),effects=[];
        if(p.exposed)effects.push("exposed");
        if(side.cover<1)effects.push(side.cover===.25?"quarter cover":"half cover");
        if(side.pinned)effects.push("pinned");
        if(!p.recovery)effects.push("recovery spent");
        if(p.gear)effects.push(window.WilderSparringGear.byId(p.gear).name+" "+(p.spent?"used":"ready"));
        const signature=window.WilderSparringSignatures?.byId(p.id);
        if(signature&&!signature.family)effects.push(signature.name+" "+(side.thornRead?"awaiting a reply":p.signatureSpent?"used":"unused"));
        if(side.familyPassUsed)effects.push("Team pass spent on "+window.WilderSparringSignatures.byId(side.familyPassUsed).name);
        else if(signature?.family)effects.push(signature.name+" · team pass ready");
        return {label:sideName(i,human)+" · "+name(p.id),detail:[p.hp+"/"+p.maxHp+" HP",side.beats+"/3 beats",...effects].join(" · "),
          ...(image?{image:image(p.id,false)}:{})};
      });
    }
    function indexPage(book,page){
      const count=Math.ceil(book.events.length/perPage);
      page=Math.min(count-1,Math.max(0,page));
      const rows=book.events.slice(page*perPage,(page+1)*perPage).map((e,i)=>
        link(turnLabel(e)+" · "+e.move.label,"t"+(page*perPage+i),
          [sideName(e.before.turn,book.human),actor(e.before,e.before.turn),...(e.move.gearEvents||[]).map(g=>window.WilderSparringGear.byId(g.gearId).name)].join(" · "),
          {badge:e.move.kind==="signature"?"SIGNATURE":e.move.kind==="duet"?"DUET":undefined}));
      const nav=[];
      if(page>0)nav.push(link("Earlier turns","p"+(page-1)));
      if(page<count-1)nav.push(link("Later turns","p"+(page+1)));
      const result=book.final.winner==="draw"?"Draw":sideName(book.final.winner,book.human)+" won";
      return {title:"Match review",kicker:"RIVAL SPARRING   /   "+result.toUpperCase(),subtitle:"Open one of your turns to try another legal move against the coach’s reply.",
        sections:[group("Turns in order · page "+(page+1)+" / "+count,rows),group("Review desk",[...nav,leave()],2)]};
    }
    // A replacement is free. Follow it through the same side's played action before judging the reply.
    function recorded(book,index) {
      const e=book.events[index],seat=e.before.turn,line=[e];let j=index+1;
      if(e.move.kind==="replace"&&book.events[j]?.before.turn===seat)line.push(book.events[j++]);
      while(book.events[j]?.before.turn===1-seat)line.push(book.events[j++]);
      return line;
    }
    function projection(before,move,opening=null) {
      const seat=before.turn,line=[];
      function append(p,m) {
        const after=sim.apply(p,m.id);line.push({before:p,move:m,after});return after;
      }
      let p=append(before,move);
      if(p.phase!=="done"&&p.turn===seat) {
        const leadMove=opening&&sim.forecast(p,opening.id);
        p=append(p,leadMove?.available?leadMove:sim.recommend(p));
      }
      while(p.phase!=="done"&&p.turn!==seat)p=append(p,sim.recommend(p));
      return line;
    }
    function lineRows(line,human) {
      return line.map(({before,move,after})=>{
        const seat=before.turn,foe=leader(before.sides[1-seat]),fell=foe.hp&&!after.sides[1-seat].team[before.sides[1-seat].active].hp;
        return {label:sideName(seat,human)+" · "+move.label,detail:move.detail+(fell?" · "+name(foe.id)+" falls":"")};
      });
    }
    function turnPage(book,index) {
      const e=book.events[index],human=book.human,mine=e.before.turn===human,line=recorded(book,index);
      const sections=[group("On the floor",context(e.before,human),2),group("Recorded play",lineRows(line,human))];
      if(mine){
        const options=sim.options(e.before).filter(m=>m.available&&m.id!==e.move.id);
        if(options.length)sections.push(group("Try another move here",options.map(m=>link(m.label,"a"+index+"/"+m.id,m.detail)),2));
        else sections.push({text:"This position had one legal choice."});
      }
      const nav=[];
      if(index>0)nav.push(link("Previous turn","t"+(index-1)));
      if(index+1<book.events.length)nav.push(link("Next turn","t"+(index+1)));
      nav.push(link("Return to all turns","p"+Math.floor(index/perPage)),leave());
      sections.push(group("Review desk",nav,2));
      return {title:turnLabel(e),kicker:sideName(e.before.turn,human).toUpperCase()+"   /   "+actor(e.before,e.before.turn).toUpperCase(),
        subtitle:actor(e.before,e.before.turn)+" faced "+actor(e.before,1-e.before.turn)+".",sections};
    }
    function comparePage(book,index,alt) {
      const e=book.events[index],human=book.human,actual=recorded(book,index);
      if(e.before.turn!==human||!alt?.available||alt.id===e.move.id)return turnPage(book,index);
      const expected=projection(e.before,e.move,e.move.kind==="replace"?actual[1]?.move:null);
      const other=projection(e.before,alt);
      const end=other.at(-1).after,original=actual.at(-1).after;
      const delta=seat=>health(end.sides[seat])-health(original.sides[seat]);
      const deltaText=n=>n===0?"the same HP":Math.abs(n)+(n>0?" more HP":" less HP");
      const difference="Your trio has "+deltaText(delta(human))+" and the rival has "+deltaText(delta(1-human))+" across all three kin.";
      const sections=[group("Review desk",[link("Return to recorded turn","t"+index),link("All turns","p"+Math.floor(index/perPage))],2),
        group("In the match",lineRows(actual,human))];
      if(expected.some((x,i)=>actual[i]?.move.id!==x.move.id)||expected.length!==actual.length)
        sections.push(group("Coach’s reply to your recorded move",lineRows(expected.slice(1),human)));
      sections.push(group("If you chose "+alt.label,lineRows(other,human)),
        {title:"After this exchange",text:difference},group("Projected position",context(end,human),2));
      const changes=end.sides.flatMap((side,i)=>side.team.flatMap((k,j)=>{
        const real=original.sides[i].team[j];
        if(!k.gear||real.spent===k.spent)return [];
        return [{label:name(k.id)+" · "+window.WilderSparringGear.byId(k.gear).name,
          detail:sideName(i,human)+" · "+(k.spent?"Used in this variation. Still ready in the recorded match.":"Still ready in this variation. Used in the recorded match.")}];
      }));
      if(changes.length)sections.push(group("Equipment after the exchange",changes));
      if([...actual,...other].some(e=>e.move.kind==="signature"||e.move.thornResponse)){
        const changes=end.sides.flatMap((side,i)=>{
          const real=original.sides[i],rows=[];
          if(side.familyPassUsed!==real.familyPassUsed){
            const status=id=>id?"spent on "+window.WilderSparringSignatures.byId(id).name:"available";
            rows.push({label:sideName(i,human)+" · shared family pass",
              detail:"The pass is "+status(side.familyPassUsed)+" in this variation. It was "+status(real.familyPassUsed)+" in the recorded match."});
          }
          for(const [j,k] of side.team.entries()){
            if(Boolean(k.signatureSpent)!==Boolean(real.team[j].signatureSpent)){
              const signature=window.WilderSparringSignatures.byId(k.id);
              rows.push({label:name(k.id)+" · "+signature.name,detail:k.signatureSpent?
                "Used in this variation. Still available in the recorded match.":"Still available in this variation. Used in the recorded match."});
            }
            if(k.exposed!==real.team[j].exposed)rows.push({label:name(k.id)+" · exposure",detail:k.exposed?
              "Exposed in this variation. Clear in the recorded match.":"Clear in this variation. Exposed in the recorded match."});
          }
          if(side.beats!==real.beats)rows.push({label:sideName(i,human)+" · beats",detail:side.beats+"/3 in this variation · "+real.beats+"/3 in the match"});
          return rows;
        });
        if(changes.length)sections.push(group("Signature after the exchange",changes));
      }
      if(end.phase==="done")sections.push({text:end.winner==="draw"?"The projected match ends in a draw.":sideName(end.winner,human)+" wins in this variation."});
      else if(alt.kind==="replace")sections.push({text:"The coach picked the incoming leader’s first move and the rival’s reply."});
      return {title:"Try another move",kicker:turnLabel(e).toUpperCase()+"   /   PRACTICE VARIATION",subtitle:e.move.label+" or "+alt.label+" from the same position.",sections};
    }
    function model(value) {
      const book=replay(read?.());
      if(!book)return {title:"Match review",kicker:"SPARRING HALL",sections:[{text:"Finish a rival match to review its turns."},group("Match desk",[leave()])]};
      const route=typeof value==="string"?value:"",match=/^([pta])(\d{1,2})(?:\/([a-z-]+:[a-z0-9-]+))?$/.exec(route);
      if(!match)return indexPage(book,0);
      const [,view,num,id]=match,index=Number(num);
      if(view==="p")return indexPage(book,index);
      const e=book.events[index];
      if(!e)return indexPage(book,0);
      return view==="a"&&id?comparePage(book,index,sim.forecast(e.before,id)):turnPage(book,index);
    }
    function act(id,value) {
      if(id==="spar-review-leave")go("sparring","result","replace");
      else if(id==="spar-review-open")go("sparring-review",value,"replace");
      else return false;
      return true;
    }
    return {valid:record=>!!replay(record),model,act};
  }
  window.WilderSparringReview={create};
})();
