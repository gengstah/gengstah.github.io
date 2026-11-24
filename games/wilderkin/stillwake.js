// The Fourth Sounding. A finite, optional postscript to The Missing Beat.
(() => {
  "use strict";
  const kin={
    id:"stillwake",name:"Stillwake",bonus:true,type:"Chime",types:["Chime","Tide"],ability:"Raftwake",baseHp:39,
    description:"This tall estuary kin reads changes in water pressure through four hollow crown-tines. Its wings fold like tide charts. A traveling Stillwake always leaves a clear path back to the marsh.",
    skills:[
      {id:"hollow-peal",name:"Hollow Peal",type:"Chime",power:11,kind:"attack",description:"Send a clear double tone down the crown. Strong against Gloam and Grove."},
      {id:"delta-fold",name:"Delta Fold",type:"Tide",power:10,kind:"attack",description:"Sweep a folding wave across the current. Strong against Ember and Alloy."},
      {id:"reed-mantle",name:"Reed Mantle",type:"Neutral",power:7,kind:"guard",description:"Fold the wings into a windbreak and halve the next hit."},
      {id:"quiet-basin",name:"Quiet Basin",type:"Neutral",kind:"heal",description:"Return to still water to recover one third of your health."}
    ]
  };
  const marks=[
    {region:0,site:"wild",title:"The unstruck rung",place:"Clover Clearing",holder:"Fern",ability:null,
      question:"Fern sets four brass rungs in the pond beside the Mossbell tracks. The first three tremble as the shell flowers open. At the fourth, the water clears around a hollow three-toed print. Which part will you copy?",
      options:[["rest","Trace the gap after the third ripple"],["ring","Record another loud bell"],["mirror","Trace the reflection of the lodge"]],
      answer:"rest",result:"A pressure reader waits through three ripples before it steps. Leave the fourth beat quiet."},
    {region:3,site:"travel",title:"The loosened towline",place:"Reedline Landing trailpost",holder:"Nessa",ability:"Raftwake",
      question:"Nessa lends you the old towline. Your Raftwake carrier follows three knocks under the hull. The youngest kin only surface when the rope slackens and the side channel opens. Which maneuver brings them home?",
      options:[["shut","Pull the channel closed"],["slacken","Pay out the line toward the open bank"],["strike","Strike the hull again"]],
      answer:"slacken",result:"The family takes the open channel when a towline falls slack. Let the current choose the way out."},
    {region:26,site:"camp",title:"The shutters below the lamp",place:"Jasper Caravanserai camp",holder:"Edda",ability:"Glowpath",
      question:"Your Glowpath companion lights an old glass plate. Folded in the bright reflection are two pairs of pale crown-tines. Shield the lantern with one hand and both shadows bow. Which detail belongs in the notebook?",
      options:[["bright","Turn the bright face toward the crown"],["mark","Scratch the image into the plate"],["shade","Shade the lens until both tines bow"]],
      answer:"shade",result:"The hollow tines lower when the light is shaded. Leave the young a dark bank to cross."}
  ];
  const finalRegion=149;
  const phases=[
    {name:"The listening crown",short:"Three peals",tell:"Three tines rise. The fourth stays still, then bends toward you. Brace on the quiet beat to expose the crown.",
      answer:"brace",type:"Chime",hp:38,threat:15,direction:"Three thin lines run through the brass."},
    {name:"The split current",short:"Split current",tell:"Water climbs the bank beneath your leader. Hand the line to the other kin before the breaking wave arrives.",
      answer:"relay",type:"Tide",hp:44,threat:19,direction:"The current curls beneath the first set of feet."},
    {name:"The drowned lantern",short:"Returning glare",tell:"Both tines flare in the lamp. Dim the Glowpath lantern to reveal the uncovered seam under the wing.",
      answer:"shade",type:"Chime",hp:50,threat:22,direction:"The lamp doubles in the hollow tines."}
  ];
  const peace=[
    {title:"Three rings on still water",text:"The crown rises after the third ring. A small foot waits behind it. What belongs in the fourth beat?",
      choices:[["tap","Add a tap on the empty beat"],["rest","Let the fourth beat pass"],["haul","Pull the towline tight"]],answer:"rest",
      reply:"A second head emerges between the hollow tines. Stillwake was counting the young behind it."},
    {title:"A line over the channel",text:"The last young one is swimming in place against a taut line. Stillwake tilts one wing toward a side channel.",
      choices:[["slacken","Pay out the towline"],["bar","Close the side channel"],["call","Sound all four bells"]],answer:"slacken",
      reply:"The line drops into the mud. The young slide into the side channel one at a time."},
    {title:"A crown full of lamplight",text:"The smallest kin is halfway under the bank. Two bright crescents stop exactly at the edge of Finch’s light.",
      choices:[["signal","Raise the lantern"],["mark","Mark the young kin's shell"],["shade","Shade the lantern"]],answer:"shade",
      reply:"With the bank in shadow the last swimmer passes. Stillwake steps beside Finch of its own accord."}
  ];
  const initial=()=>({marks:0,revealed:false,route:null,peace:0,trial:null,settled:null,oath:null});
  const whole=(n,min,max)=>Number.isInteger(n)&&n>=min&&n<=max;
  function restore(raw,party=[]) {
    const saved=initial(),owned=new Set(party.map(p=>p.id));
    if(!raw||typeof raw!=="object")return saved;
    saved.marks=whole(raw.marks,0,3)?raw.marks:0;
    saved.revealed=saved.marks===3&&raw.revealed===true;
    if(!saved.revealed)return saved;
    saved.settled=["peace","challenge"].includes(raw.settled)?raw.settled:null;
    saved.oath=saved.settled&&["sanctuary","companion"].includes(raw.oath)?raw.oath:null;
    if(saved.settled)return saved;
    saved.peace=whole(raw.peace,0,2)?raw.peace:0;
    if(raw.route==="peace"){saved.route="peace";return saved;}
    const b=raw.trial;
    if(raw.route!=="challenge"||!b||!Array.isArray(b.pair)||b.pair.length!==2||b.pair[0]===b.pair[1]||
      !b.pair.every(id=>owned.has(id))||!whole(b.lead,0,1)||!whole(b.phase,0,2)||!whole(b.hp,1,phases[b.phase].hp)||
      !whole(b.stamina,1,80)||!whole(b.beats,0,3)||!whole(b.turn,1,10000))return saved;
    saved.route="challenge";
    saved.trial={pair:b.pair.slice(),lead:b.lead,phase:b.phase,hp:b.hp,stamina:b.stamina,beats:b.beats,
      open:b.open===true,turn:b.turn,log:typeof b.log==="string"?b.log.slice(0,300):"",
      last:["strike","brace","relay","shade","duet"].includes(b.last)?b.last:null};
    return saved;
  }
  const err=message=>({ok:false,kind:"error",message});
  function create({state,commit,regions,species,makeMember,story,duetPair}) {
    const record=()=>state().stillwake ||= initial();
    const lookup=id=>state().party.find(p=>p.id===id);
    const hasCarrier=a=>state().party.some(p=>species[p.id].ability===a);
    const requiredSite=(r,site)=>state().battle?"Finish the current encounter.":state().region!==r?"Visit "+regions[r].name+".":
      state().landmark!==site?"Walk to the "+({wild:"wild clearing",travel:"trailpost",camp:"camp"})[site]+".":"";
    function access() {
      const s=state(),r=record();
      if(r.marks<3){
        const mark=marks[r.marks];
        if(!r.marks&&!s.fieldwork?.mossbell?.complete)return "Observe Mossbell and finish its field note in Mossbrook Vale.";
        if(mark.ability&&(!s.licenses.includes(mark.ability)||!hasCarrier(mark.ability)))return "Earn "+mark.ability+" and befriend a carrier.";
        return requiredSite(mark.region,mark.site);
      }
      if(!story.ending(s))return "Finish The Missing Beat and file its final dispatch.";
      return requiredSite(finalRegion,"wild");
    }
    function eligible(){const s=state();return s.team.filter(id=>lookup(id)?.hp>0);}
    function status() {
      const s=state(),r=record(),a=access(),stage=r.marks<3?marks[r.marks]:null;
      return {marks:r.marks,stage,clues:marks.slice(0,r.marks),revealed:r.revealed,route:r.route,settled:r.settled,oath:r.oath,
        recruited:!!lookup(kin.id),ending:story.ending(s),peace:r.peace,peaceStep:peace[r.peace],access:a,
        region:stage?stage.region:finalRegion,site:stage?stage.site:"wild",eligible:eligible(),trial:r.trial?preview(r.trial):null};
    }
    function encounterPair(b) {
      const lead=b.pair[b.lead],partner=b.pair[1-b.lead],pair=duetPair(lead,partner);
      return {lead,partner,pair};
    }
    function preview(b) {
      const {lead,partner,pair}=encounterPair(b),phase=phases[b.phase];
      const striker=species[lead].skills.find(sk=>sk.kind==="attack");
      const skill=striker?.name||"Strike",base=10+(striker?.power||8)-6;
      const damage=base+(b.open?8:0);
      const pairing=pair||{name:"Joined call",role:"ward",cost:2};
      const duetDamage=({rush:29,mark:21,lure:20,mend:18,relay:22,ward:19})[pairing.role]||20;
      const threatened=b.open?6:phase.threat;
      return {...b,pair:b.pair.slice(),phaseInfo:phase,leadId:lead,partnerId:partner,duetName:pairing.name,duetRole:pairing.role,
        duetCost:pairing.cost,duetDamage:duetDamage+(b.open?9:0),damage,skill,threatened,
        tell:b.open?"The crown is open. The returning wash costs 6 stamina unless you finish this phase.":phase.tell};
    }
    function settle(r,route){
      r.settled=route;r.route=null;r.trial=null;r.peace=0;
      return commit("wake-settled",route==="peace"?peace[2].reply:"Stillwake folds the crown. The smallest swimmer passes between your two companions.");
    }
    function challengeMove(cmd) {
      const r=record(),b=r.trial;
      if(r.route!=="challenge"||!b)return err("Choose a pair for the tide trial.");
      const v=preview(b),phase=v.phaseInfo;
      if(!["strike","brace","relay","shade","duet"].includes(cmd))return err("Choose a practiced maneuver.");
      if(cmd==="duet"&&b.beats<v.duetCost)return err("Build "+v.duetCost+" beats for "+v.duetName+".");
      const counter=!b.open&&cmd===phase.answer;
      let damage=0,hit=v.threatened,text="";
      if(cmd==="strike"){damage=v.damage;text=v.skill+" strikes for "+damage+".";}
      if(cmd==="duet"){
        b.beats-=v.duetCost;damage=v.duetDamage;text=v.duetName+" sounds for "+damage+".";
        if(v.duetRole==="mend")b.stamina=Math.min(80,b.stamina+12);
        if(v.duetRole==="ward"||v.duetRole==="lure")hit=Math.ceil(hit/2);
        if(v.duetRole==="relay")b.lead=1-b.lead;
      }else if(cmd!==b.last)b.beats=Math.min(3,b.beats+1);
      if(cmd==="relay"){b.lead=1-b.lead;text=species[b.pair[b.lead]].name+" takes the line.";}
      if(cmd==="brace"){hit=Math.ceil(hit*.55);text="Your pair braces at the bank.";}
      if(cmd==="shade")text="Finch lowers the lamp shutter.";
      if(counter){damage=8;hit=0;text+=" The tell is answered; the crown opens.";}
      if(b.hp<=damage){
        if(b.phase===2)return settle(r,"challenge");
        b.phase++;b.hp=phases[b.phase].hp;b.open=false;
        b.stamina=Math.min(80,b.stamina+9);b.beats=Math.min(3,b.beats+1);
        text+=" "+phases[b.phase].name+" begins. The crew recovers 9 stamina.";
      }else{
        b.hp-=damage;b.stamina=Math.max(0,b.stamina-hit);b.open=counter||(cmd==="duet"&&v.duetRole==="mark");
        if(hit)text+=" The wash takes "+hit+" stamina.";
        if(!b.stamina){r.route=null;r.trial=null;return commit("wake-retreat","The crew pulls the safety rope. Stillwake waits. All three field notes are safe.");}
      }
      b.last=cmd;b.turn++;b.log=text;
      return commit("wake-turn",text);
    }
    function act(cmd,value) {
      const r=record(),s=state(),blocked=access();
      if(blocked)return err(blocked);
      if(cmd==="record"){
        const mark=marks[r.marks];
        if(!mark||!mark.options.some(o=>o[0]===value))return err("Choose a detail from the field note.");
        if(value!==mark.answer)return err("The water and the witnesses tell a different story. Read the sign again.");
        r.marks++;return commit("wake-clue",mark.result);
      }
      if(r.marks<3)return err("Trace the three field notes first.");
      if(cmd==="reveal"){
        if(r.revealed)return err("The witness is already recorded.");
        r.revealed=true;if(!s.seen.includes(kin.id))s.seen.push(kin.id);
        return commit("wake-revealed","Stillwake steps from the folded reflection. Two smaller crowns follow it.");
      }
      if(!r.revealed)return err("Watch the bank before choosing an approach.");
      if(cmd==="pledge"){
        if(!r.settled||r.oath||!["sanctuary","companion"].includes(value))return err("Hear Stillwake’s answer before signing the field record.");
        if(value==="companion"&&!(s.bag.kinweave>0))return err("Bring a Kinweave to offer the companion.");
        r.oath=value;
        if(value==="sanctuary")return commit("wake-oath","Finch files the channel as a sanctuary. Its address stays with the local keepers.");
      }else if(cmd==="invite"){
        if(r.oath!=="sanctuary"||lookup(kin.id))return err("The sanctuary is already recorded.");
        if(!(s.bag.kinweave>0))return err("Bring a Kinweave when visiting the sanctuary.");
      }else{
        if(r.settled)return err("The crew has already made peace with the witness.");
        if(cmd==="listen"&&!r.route){r.route="peace";r.peace=0;return commit("wake-listen","You set down the survey frame. Three rings appear on the surface.");}
        if(cmd==="answer"&&r.route==="peace"){
          const step=peace[r.peace];
          if(value!==step.answer)return err("The young shelter behind one wing. Reopen the three field notes and try a gentler answer.");
          if(r.peace===2)return settle(r,"peace");
          r.peace++;return commit("wake-answer",step.reply);
        }
        if(cmd==="challenge"&&!r.route){
          const team=eligible(),lead=team.includes(s.lead)?s.lead:team[0];
          if(!lead||value===lead||!team.includes(value))return err("Choose a second healthy traveling companion.");
          r.route="challenge";r.trial={phase:0,hp:phases[0].hp,stamina:80,pair:[lead,value],lead:0,beats:1,open:false,turn:1,last:null,log:"Finch fastens the two safety lines."};
          return commit("wake-trial",r.trial.log);
        }
        if(cmd==="turn")return challengeMove(value);
        if(cmd==="withdraw"&&r.route){r.route=null;r.peace=0;r.trial=null;return commit("wake-retreat","You step back from the bank. The crew can approach again.");}
        return err("That choice is unavailable now.");
      }
      if(!lookup(kin.id)){
        s.bag.kinweave--;s.party.push(makeMember(kin.id,regions[finalRegion].wildLevel));if(s.team.length<6)s.team.push(kin.id);
      }
      return commit("wake-companion",r.oath==="sanctuary"?"One adult comes to travel with Finch. Its home channel remains a sanctuary.":"Stillwake touches the weave and falls into step. The return path remains open.");
    }
    return {status,act};
  }
  // A scanline silhouette keeps the forked crown, its hollow bells and the long
  // return curl legible both at battle scale and as a sixteen-pixel map companion.
  function drawKin(c,x,y,size,time=0,pose=0){
    c.save();c.translate(x,y);c.scale(size/104,size/104);
    const night="#20333e",shadow="#2d4751",deep="#345961",sea="#40777a",jade="#66a392",pale="#a1cdb0",cream="#e5e7bd",brass="#d6ab65",rust="#955d48";
    const rect=(ink,x,y,w,h)=>{c.fillStyle=ink;c.fillRect(x,y,w,h);};
    const poly=(ink,points)=>{
      c.fillStyle=ink;
      const ys=points.map(p=>p[1]),lo=Math.min(...ys),hi=Math.max(...ys);
      for(let row=Math.floor(lo);row<hi;row++){
        const y=row+.5,cross=[];
        for(let i=0;i<points.length;i++){
          const a=points[i],b=points[(i+1)%points.length];
          if((a[1]<=y&&b[1]>y)||(a[1]>y&&b[1]<=y))cross.push(a[0]+(y-a[1])*(b[0]-a[0])/(b[1]-a[1]));
        }
        cross.sort((a,b)=>a-b);
        for(let n=0;n+1<cross.length;n+=2){const left=Math.ceil(cross[n]-.5);c.fillRect(left,row,Math.max(0,Math.ceil(cross[n+1]-.5)-left),1);}
      }
    };
    const sway=time?Math.round(Math.sin(time*.002)*1.2):0;
    const legs=[[[39,60],[46,64],[46,75],[41,84],[43,91],[38,92],[38,84],[42,74]],
      [[60,61],[66,59],[67,70],[62,80],[63,88],[59,89],[59,79],[63,68]]];
    for(const leg of legs)poly(shadow,leg);
    poly(rust,[[38,89],[42,89],[48,92],[43,93],[40,92],[34,95],[31,94],[36,91],[32,91],[29,91],[31,89]]);
    poly(brass,[[59,86],[63,86],[68,88],[69,90],[63,89],[57,91],[52,90],[54,89],[59,89]]);
    // A hollow crook at the tail carries no bell clapper.
    poly(night,[[56,53],[67,48],[75,39],[82,28],[88,21],[95,19],[100,22],[101,27],[99,34+sway],[94,40],[88,40],[85,36],[85,32],[89,30],[92,32],[89,35],[92,36],[96,31],[97,25],[94,24],[90,26],[85,33],[82,44],[77,54],[67,63],[57,64]]);
    poly(sea,[[63,54],[72,48],[80,35],[86,27],[91,22],[96,21],[99,24],[99,29],[96,34],[97,27],[94,24],[89,25],[84,32],[81,43],[76,54],[65,60]]);
    poly(jade,[[76,44],[84,31],[87,26],[92,22],[96,22],[90,25],[85,32],[81,42],[78,47]]);
    // Four resonators hang in pairs from pale antler arcs.
    const antler=(a,b,tip,drop)=>{
      const [ax,ay]=a,[bx,by]=b,[tx,ty]=tip;
      poly(deep,[[ax-1,ay+1],[bx-2,by],[tx,ty-1],[tx+2,ty+1],[bx+1,by+3],[ax+2,ay+1]]);
      poly(pale,[[ax,ay],[bx-1,by-1],[tx,ty-1],[tx+1,ty],[bx+1,by+1],[ax+1,ay]]);
      rect(brass,tx,ty+1,1,drop);
      poly(rust,[[tx-2,ty+drop],[tx+1,ty+drop],[tx+3,ty+drop+5],[tx-3,ty+drop+5]]);
      rect(cream,tx-1,ty+drop,2,3);rect(night,tx-2,ty+drop+4,4,1);
    };
    antler([30,27],[19,10],[9,14],5);antler([29,25],[27,5],[18,5],4);
    antler([34,27],[42,9],[53,8],5);antler([32,26],[37,3],[45,3],3);
    // Broad mantle over a narrow, folded S-neck and a brass lower bill.
    poly(night,[[30,21],[37,21],[42,24],[44,28],[39,34],[34,37],[31,42],[32,47],[39,52],[45,49],[53,42],[64,42],[72,47],[76,54],[73,62],[65,68],[51,70],[42,66],[35,61],[30,59],[25,53],[23,47],[24,41],[29,35],[32,31],[26,30],[20,30],[8,34],[5,33],[15,26],[22,24]]);
    poly(sea,[[29,23],[36,23],[40,25],[40,28],[36,31],[33,35],[28,40],[26,46],[28,51],[34,55],[41,56],[44,61],[40,63],[34,60],[29,57],[26,52],[25,46],[26,41],[30,36],[34,31],[32,28],[24,28],[20,28],[15,30],[18,26],[24,24]]);
    poly(pale,[[35,32],[33,37],[29,42],[29,47],[33,51],[39,54],[35,55],[29,52],[27,48],[27,43],[30,37]]);
    poly(cream,[[18,26],[24,24],[31,23],[35,24],[32,25],[25,25],[23,27],[18,28],[13,30]]);
    rect(night,24,25,4,2);rect(brass,24,25,2,1);rect(cream,26,25,1,1);
    poly(brass,[[7,32],[17,29],[22,27],[21,29],[14,32],[6,34]]);rect(rust,8,33,5,1);
    poly(deep,[[37,55],[47,48],[56,44],[65,45],[71,49],[73,55],[69,62],[63,66],[52,68],[46,64],[42,59]]);
    // Tiers of folded chart-feathers have separate leading edges and torn tips.
    const lift=pose===2?-4:sway;
    poly(night,[[41,54],[48,46],[59,38+lift],[69,35+lift],[80,37+lift],[74,42],[64,47],[83,42],[91,43],[81,50],[69,56],[82,54],[87,55],[74,62],[59,66],[49,65],[43,61]]);
    poly(jade,[[43,54],[50,47],[60,40+lift],[70,37+lift],[77,38+lift],[66,42],[55,50],[49,55]]);
    poly(pale,[[49,48],[61,39+lift],[70,37+lift],[72,38+lift],[61,42],[52,48]]);
    poly(sea,[[45,57],[52,54],[64,48],[82,43],[87,44],[72,50],[61,55],[52,59]]);
    poly(pale,[[54,53],[65,47],[81,44],[76,46],[65,49],[57,54]]);
    poly(deep,[[46,60],[58,58],[71,54],[81,54],[72,59],[58,63],[50,63]]);
    poly(brass,[[42,54],[46,52],[49,54],[48,58],[45,59],[42,57]]);
    rect(cream,44,54,3,2);rect(rust,45,57,2,1);
    for(const [px,py] of [[58,46],[62,44],[68,41],[63,52],[69,50],[76,47],[54,60],[61,58],[69,57]])rect(cream,px,py,2,1);
    c.restore();
  }
  const partnerImages=new Map();
  function partnerImage(id){
    if(typeof Image==="undefined"||!window.WilderKinDex)return null;
    if(!partnerImages.has(id)){const img=new Image();img.src=window.WilderKinDex.spriteUrl(id);partnerImages.set(id,img);}
    const img=partnerImages.get(id);return img.complete&&img.naturalWidth?img:null;
  }
  function illustration(board){
    const started=typeof performance!=="undefined"?performance.now():0;
    const tints=[["#b9d7cc","#8da99b","#71988f","#42797c"],["#afc5d3","#899cb0","#667f91","#446775"],["#d3c2c1","#a595aa","#847a92","#596771"]];
    return {height:185,draw(c,x,y,w,h,time){
      const phase=board.trial?.phase||0,colors=tints[phase];
      const reduced=typeof matchMedia!=="undefined"&&matchMedia("(prefers-reduced-motion: reduce)").matches;
      const t=reduced?0:time;
      c.save();c.translate(x,y);c.fillStyle=colors[0];c.fillRect(0,0,w,h);
      const water=Math.floor(h*.69);c.fillStyle=colors[1];
      for(let i=0;i<w;i+=5){const ridge=water-28+Math.round(9*Math.sin(i*.02)+5*Math.sin(i*.046));c.fillRect(i,ridge,5,water-ridge);}
      c.fillStyle=colors[2];for(let i=0;i<w;i+=5){const edge=water-8+Math.floor(Math.sin(i*.031+2)*5);c.fillRect(i,edge,5,water-edge);}
      c.fillStyle=colors[3];c.fillRect(0,water,w,h-water);
      for(let j=0;j<12;j++){const a=(j*37)%Math.floor(w*.91),b=water+4+(j*13)%(h-water-5);
        c.fillStyle=j%2?"#86ada4":"#b7c9ac";c.fillRect(a+Math.round(Math.sin(t*.001+j)),b,8+j%4*4,2);}
      const size=Math.min(178,h*.93),left=board.trial?Math.min(w-size-7,w*.52):((w-size)/2);
      const b=board.trial;
      if(b){
        c.imageSmoothingEnabled=false;
        const pair=[b.partnerId,b.leadId],unit=Math.min(w*.20,84);
        pair.forEach((id,i)=>{
          const img=partnerImage(id),px=w*(i?.26:.10),py=water+(i?19:6);
          c.fillStyle=colors[2];c.beginPath();c.ellipse(px+unit*.16,py,unit*.39,3,0,0,Math.PI*2);c.fill();
          if(img){const ratio=unit/Math.max(img.naturalWidth,img.naturalHeight);c.drawImage(img,px-unit*.25,py-img.naturalHeight*ratio,img.naturalWidth*ratio,img.naturalHeight*ratio);}
        });
        c.save();c.lineWidth=2;
        if(b.open){
          c.strokeStyle="#f5d985";c.beginPath();c.ellipse(left+size*.58,water-size*.3,13+2*Math.sin(t*.003),8,-.4,0,Math.PI*2);c.stroke();
        }else if(phase===0){
          const beat=Math.floor(t/520)%4;
          for(let i=0;i<4;i++){c.fillStyle=i===3?colors[2]:i===beat?"#f7e6a9":"#c2c58f";
            c.fillRect(left+size*.14+i*8,water-size*.82,5,i===3?2:4);}
        }else if(phase===1){
          c.strokeStyle="#bbded1";
          for(const sign of [-1,1]){c.beginPath();c.moveTo(w*.6,water+10);c.quadraticCurveTo(w*.41,water+12,w*.35,water+10+sign*17);c.lineTo(w*.22,water+9+sign*16);c.stroke();}
        }else{
          c.fillStyle="rgba(255,225,159,.27)";c.beginPath();c.moveTo(w*.14,water-4);c.lineTo(left+size*.66,water-size*.48);c.lineTo(left+size*.71,water-size*.31);c.closePath();c.fill();
        }
        c.restore();
      }
      if(board.revealed)drawKin(c,left,water-size*.79,size,t,phase);
      else{
        c.strokeStyle="#e8dfae";c.lineWidth=2;
        for(let i=0;i<3;i++){c.beginPath();c.ellipse(w*.5,water+8+i*3,15+i*13+Math.sin(t*.001),3+i*2,0,0,Math.PI*2);c.stroke();}
      }
      if(b && b.turn>1 && !reduced){
        const progress=Math.min(1,Math.max(0,(time-started)/480));
        if(progress<1 && (b.last==="strike"||b.last==="duet")){
          c.save();c.globalAlpha=Math.sin(progress*Math.PI);
          for(let lane=0;lane<(b.last==="duet"?2:1);lane++){
            const from=w*(lane?.16:.32),end=left+size*.48,cx=from+(end-from)*progress,cy=water+6-progress*size*.25-(12+lane*16)*Math.sin(Math.PI*progress);
            c.strokeStyle=lane?"#d4f3dc":"#f0ce87";c.lineWidth=2;c.beginPath();c.arc(cx,cy,5+4*progress,0,Math.PI*2);c.stroke();
            c.fillStyle=c.strokeStyle;c.fillRect(cx-7,cy,3,2);c.fillRect(cx+1,cy-5,2,3);
          }
          c.restore();
        }
      }
      c.restore();
    }};
  }
  function pages({game,row,go,render,notify,locate}){
    const api=game.stillwake;
    const view=(page,value,label,detail="")=>row("view",label,page+"|"+value,detail);
    const button=(key,label,value="",detail="",extra={})=>row("wake-act",label,key+"|"+value,detail,extra);
    const section=(title,rows)=>({title,rows});
    function model(){
      const v=api.status(),s=game.state,region=game.regions[v.region],sections=[];
      const title=v.revealed?"Stillwake at the Fourth Sounding":"The Fourth Sounding";
      const intro="Fern found a silent fourth mark on the old flood gauge. Finch keeps three witness notes on the same page.";
      if(v.clues.length)sections.push(section("Witness notes",v.clues.map(m=>({label:m.title,detail:m.result}))));
      let active=[];
      if(v.access){
        if(v.stage?.region===0&&!s.fieldwork?.mossbell?.complete){
          active.push(view("study","mossbell","Read Mossbell’s field note","Watch at the local sighting and respond to its behavior."));
          if(s.region===0)active.push(row("wake-sighting","Walk to Mossbell’s sighting"));
        }
        if(v.stage?.ability&&!s.licenses.includes(v.stage.ability))active.push(view("license",v.stage.ability,"Open "+v.stage.ability+" training"));
        if(!v.stage&&!v.ending)active.push(view("scene","ending","The final dispatch"));
        if(s.region!==v.region)active.push(view("region",v.region,"Locate "+region.name));
        else if(s.landmark!==v.site)active.push(row("wake-walk","Walk to the "+({camp:"camp",travel:"trailpost",wild:"wild clearing"})[v.site],v.site));
        if(v.revealed&&s.party.some(p=>p.id===kin.id))active.push(row("open-kin","Read Stillwake’s guide entry",kin.id));
        sections.unshift({title:v.stage?v.stage.title:"Beyond the last dispatch",text:v.access,rows:active});
      }else if(v.stage){
        sections.unshift({title:v.stage.holder+"’s witness note",text:v.stage.question,rows:v.stage.options.map(([k,label])=>button("record",label,k))});
      }else if(!v.revealed){
        sections.unshift(illustration(v),{title:"The fourth sounding",text:"The old slip says to wait one extra beat. At the last clearing, Finch counts three rings. The water stays quiet on four. Something very tall steps around a nest.",
          rows:[button("reveal","Watch the far bank","","Record what the empty interval was protecting.",{tone:"primary"})]});
      }else if(v.oath){
        const text=v.oath==="sanctuary"?"The channel is on the keepers’ quiet map. The fledglings can cross without a crowd.":"Finch left an open weave on the water. Stillwake can travel with the crew and return whenever the channel needs it.";
        active=[row("open-kin","Read Stillwake’s guide entry",kin.id)];
        if(!v.recruited){
          active.unshift(button("invite","Offer a traveling Kinweave","","Spend 1 Kinweave. The sanctuary oath stays in the field record.",{disabled:!s.bag.kinweave}));
          if(!s.bag.kinweave)active.push(view("item","kinweave","Make a Kinweave","Bring a weave when you next visit."));
        }
        sections.unshift(illustration(v),{title:v.oath==="sanctuary"?"The kept channel":"The open weave",text,rows:active});
      }else if(v.settled){
        sections.unshift(illustration(v),{title:"Finch’s field record",text:(v.settled==="peace"?"The quiet crossing is complete. ":"The crew answered all three surges. ")+
          "Mara looks at the blank address. “Who gets to tell people this place exists?” Finch has room for one promise.",
          rows:[button("pledge","Keep the channel a sanctuary","sanctuary","Seal the habitat record with its keepers. Visiting a friend remains possible."),
            button("pledge","Offer an open Kinweave","companion","Spend 1 Kinweave and invite Stillwake into your company.",{disabled:!s.bag.kinweave}),
            row("nav","Check field supplies","bag")]});
      }else if(v.route==="peace"){
        const step=v.peaceStep;
        sections.unshift(illustration(v),{title:step.title,text:step.text,rows:step.choices.map(([k,label])=>button("answer",label,k))},section("At the bank",[button("withdraw","Step back")]));
      }else if(v.trial){
        const b=v.trial,p=b.phaseInfo;
        const name=id=>game.species[id].name;
        const moves=[
          button("turn",b.skill,"strike",b.damage+" force · "+(b.open?"Open seam":"Uncovered attack")),
          button("turn","Brace on the fourth beat","brace","Hold your lead. Guard the listening crown."),
          button("turn","Hand over the line","relay","Swap the lead to "+name(b.partnerId)+" and answer a split current."),
          button("turn","Shade the lantern","shade","Cover the returning glare."),
          button("turn",b.duetName,"duet",b.duetDamage+" force · "+b.duetCost+" beats · "+name(b.partnerId),
            {disabled:b.beats<b.duetCost,tone:"primary"})];
        sections.unshift(illustration(v),{title:"Phase "+(b.phase+1)+" / 3 · "+p.name,text:b.tell},
          {title:b.hp+" / "+p.hp+" crown pressure · "+b.stamina+" / 80 crew stamina",text:"Lead "+name(b.leadId)+" · "+b.beats+" / 3 beats. Vary maneuvers to earn beats. "+b.log,
            columns:2,rows:moves},section("Safety line",[button("withdraw","Return to the bank","","Keep all notes and reconsider your approach.")]));
      }else{
        const lead=v.eligible.includes(s.lead)?s.lead:v.eligible[0],pairs=v.eligible.filter(id=>id!==lead);
        sections.unshift(illustration(v),{title:"Two ways to meet the witness",text:"Nessa sees young kin caught below an old cable. The crew can free them by following their parent’s signals, or carry the cable through a three-surge trial.",
          rows:[button("listen","Listen to the family","","A peaceful crossing guided by your three field notes.",{tone:"primary"})]},
          {title:"Take the tide trial",text:lead?"Choose a partner for "+game.species[lead].name+". The safety frame gives the crew 80 stamina.":"Rest your party first.",
            rows:pairs.length?pairs.map(id=>button("challenge","Pair with "+game.species[id].name,id,game.duetPair(lead,id)?.name||"Traveling duet")):[row("nav","Prepare two healthy traveling kin","party")]});
      }
      return {title,viewId:"stillwake:"+(v.oath||v.settled||v.route||v.marks)+":"+v.revealed+":"+(v.trial?.phase??v.peace),kicker:"FINCH’S UNSENT LETTER   /   "+v.marks+" OF 3 WITNESS NOTES",subtitle:v.stage?intro:undefined,sections};
    }
    function act(id,value){
      if(id==="wake-walk"){locate(value,"stillwake");return true;}
      if(id==="wake-sighting"){locate("sighting:mossbell");return true;}
      if(id!=="wake-act")return false;
      const [cmd,answer]=String(value).split("|"),out=api.act(cmd,answer);render();notify(out.message);return true;
    }
    return {model,act};
  }
  window.WilderStillwake={kin,restore,create,drawKin,pages};
})();
