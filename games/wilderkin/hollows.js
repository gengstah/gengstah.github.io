// Small authored side passages. Each license changes the way a partner moves through its room.
(() => {
  "use strict";
  const moves={north:[0,-1],east:[1,0],south:[0,1],west:[-1,0]};
  const arrows={"^":"north",">":"east","v":"south","<":"west"};
  const pathKeys=[...Object.keys(moves),"skill"];
  const rooms=[
    {id:"first-post",title:"The Sparrow Post",ability:null,partner:"Fern",verb:"Walk",color:"#849d51",
      goal:"Pick up the brass letter by the nesting grass. Carry it to the gold post.",
      intro:"Fern holds open the wicket. “The chick put its first letter in the grass. Would you deliver it together?”",
      ending:"Fern kneels to show the chick a small brass stamp. Its first delivery mark lands upside down.",
      reward:{kinweave:2,balm:1},layout:["#########","#S..#..G#","#.#.#.|##","#.#...#.#","#..*....#","#########"]},
    {id:"rill-mail",title:"The Returning Current",ability:"Raftwake",partner:"Nessa",verb:"Board the raft",color:"#4299a4",
      goal:"Board at a striped dock, retrieve Lev’s float, then reach the gold post. A current carries you one extra tile in its arrow direction.",
      intro:"Nessa unties the rope. “Lev carved that float with his left hand after the accident. I'd rather fetch his own than make him another.”",
      ending:"Lev slips the float onto the rope. His sister lets him tie the knot himself.",
      reward:{kinweave:4,tonic:2},layout:["##########","#S=~>v##G#","##~~#v==.#","#*==<v~~=#","#~<>^~~~=#","##########"]},
    {id:"sail-shelf",title:"The Unmanned Kite",ability:"Cloudlift",partner:"Tal",verb:"Spread wings",color:"#7e94b8",
      goal:"Open your wings on a feather pad, then choose a direction. Glide to the first solid ledge, collect the sailcloth and return to the gold post.",
      intro:"The runaway kite wears a patch from Tal’s first flour sack. “Mum always said that seam would hold. Let's see if it did.”",
      ending:"Tal finds his mother's crooked seam under three winters of repairs. He leaves it crooked.",
      reward:{tonic:3,sparkseed:1},layout:["###########","#S+~~~+~~G#","#..###~##.#","######~####","#*.+~~+...#","###########"]},
    {id:"twin-pins",title:"The Two Hinge Stones",ability:"Stonecleave",partner:"Hedd",verb:"Set a wedge",color:"#aa8867",
      goal:"Set a wedge, then step toward a stone to roll it one square. Seat both stones on the brass rings and reach the gold post.",
      intro:"Hedd marks the two sockets in chalk. “Sen would have wanted this door heavy enough to stay, light enough for one person to open.”",
      ending:"The hinges lift. Hedd leaves the chalk where the next apprentice will see how the stones got there.",
      reward:{ore:8,sparkseed:2},layout:["#########","#S......#","#.O.o...#","#.O.o#.##","#.....|G#","#########"]},
    {id:"cradle-choir",title:"The Cradle Choir",ability:"Lullsong",partner:"Mina",verb:"Hum at a bell",color:"#ac829d",
      goal:"Hum on numbered bells to change the herds beside the gate. Bell 1 calms or wakes A and B, bell 2 affects B and C, and bell 3 affects A. Let all three sleep.",
      intro:"Mina takes the clappers out of the bells. “You can hum through the brass. The calves don't need to hear any more alarms.”",
      ending:"The first calf falls asleep leaning on Mina’s boot. Finch sits down beside her until she can move.",
      reward:{sap:10,balm:5},layout:["##########","#S.1...a2#","#.###.#..#","#..3..#..#","#.#####.##","#...abc.G#","##########"]},
    {id:"inward-lens",title:"The Window Underground",ability:"Glowpath",partner:"Edda",verb:"Turn a prism",color:"#9585b5",
      goal:"Stand on a prism and turn it to bend the beam. Light the round receiver to release the gate beside the gold post.",
      intro:"Edda puts Finch’s finger on a scratch in the brass. “Nell made that the year she could finally reach the bench.”",
      ending:"Light makes a small square on the tunnel wall. Edda invites Nell to add her new height to the old scratch.",
      reward:{tonic:4,ore:6},layout:["##########","#>.../...#","#S.#..##G#","#...#..#|#","#.!..\\...#","##########"]},
    {id:"resting-islands",title:"The Resting Islands",ability:"Frostspan",partner:"Sol",verb:"Shape a span",color:"#81abb6",
      goal:"Shape a span at an anchor, then aim across one or two water tiles. The previous span melts. Retrieve Ena’s scarf and bring it to the gold post.",
      intro:"Sol hangs a dry mitten on the first anchor. “Ena wants a way across where anyone can stop halfway. Let’s find her some islands.”",
      ending:"Ena lays the scarf on a sun-warm rock and stays for lunch. The next crossing can wait.",
      reward:{sparkseed:3,kinweave:5},layout:["###########","#S+~~+~~~G#","#####~###+#","#*.+~+~~+.#","###########"]}
  ];
  for(const room of rooms) {
    room.w=room.layout[0].length;room.h=room.layout.length;room.map=room.layout.join("");
    room.start=room.map.indexOf("S");room.exit=room.map.indexOf("G");
    room.rocks=[];room.mirrors=[];
    for(let i=0;i<room.map.length;i++){
      if(room.map[i]==="O")room.rocks.push(i);
      if("/\\".includes(room.map[i]))room.mirrors.push(i);
    }
  }
  const byId=Object.fromEntries(rooms.map(r=>[r.id,r]));
  const fresh=r=>({p:r.start,mask:0,token:false,ready:false,rocks:r.rocks.slice(),ice:[]});
  const clone=v=>({...v,rocks:v.rocks.slice(),ice:v.ice.slice()});
  const keyOf=v=>[v.p,v.mask,+v.token,+v.ready,v.rocks.join("."),v.ice.join(".")].join("|");
  const neighbor=(r,p,dir)=>{
    const [dx,dy]=moves[dir],x=p%r.w+dx,y=Math.floor(p/r.w)+dy;
    return x>=0&&x<r.w&&y>=0&&y<r.h?y*r.w+x:-1;
  };
  function beam(r,v) {
    let p=r.map.indexOf(">"),dir="east";
    const cells=[],seen=new Set();
    while(p>=0) {
      if(seen.has(p+"|"+dir))break;
      seen.add(p+"|"+dir);cells.push(p);
      if(r.map[p]==="!")return {cells,lit:true};
      const m=r.mirrors.indexOf(p);
      if(m>=0){
        const slash=(r.map[p]==="/")!==Boolean(v.mask&(1<<m));
        dir=(slash?{east:"north",north:"east",west:"south",south:"west"}:{east:"south",south:"east",west:"north",north:"west"})[dir];
      }
      p=neighbor(r,p,dir);
      if(r.map[p]==="#")break;
    }
    return {cells,lit:false};
  }
  function unlocked(r,v) {
    if(r.ability==="Stonecleave")return v.rocks.every(p=>r.map[p]==="o");
    if(r.ability==="Lullsong")return v.mask===7;
    if(r.ability==="Glowpath")return beam(r,v).lit;
    return v.token;
  }
  function pass(r,v,p) {
    const c=r.map[p];
    if(!c||c==="#")return false;
    if(c==="G"||c==="|")return unlocked(r,v);
    if(r.ability==="Lullsong" && "abc".includes(c))return Boolean(v.mask&(1<<"abc".indexOf(c)));
    if(c==="~")return r.ability==="Raftwake"?v.ready:r.ability==="Frostspan"&&v.ice.includes(p);
    if(r.ability==="Raftwake"&&arrows[c])return v.ready;
    return true;
  }
  function advance(r,initial,cmd) {
    const v=clone(initial),tile=r.map[v.p],a=r.ability;
    if(cmd==="skill") {
      if(a==="Lullsong"&&"123".includes(tile))v.mask^=({"1":3,"2":6,"3":1})[tile];
      else if(a==="Glowpath"&&r.mirrors.includes(v.p))v.mask^=1<<r.mirrors.indexOf(v.p);
      else if((a==="Raftwake"&&tile==="=")||((a==="Cloudlift"||a==="Frostspan")&&tile==="+")||a==="Stonecleave")v.ready=!v.ready;
      else return null;
      return v;
    }
    if(!Object.hasOwn(moves,cmd))return null;
    let target=neighbor(r,v.p,cmd);
    if(a==="Cloudlift"&&v.ready) {
      if(r.map[target]!=="~")return null;
      while(r.map[target]==="~")target=neighbor(r,target,cmd);
      v.ready=false;
    } else if(a==="Frostspan"&&v.ready) {
      const span=[];
      for(let i=0;i<2&&r.map[target]==="~";i++){span.push(target);target=neighbor(r,target,cmd);}
      if(!span.length)return null;
      v.ice=span;v.ready=false;return v;
    } else if(a==="Stonecleave"&&v.rocks.includes(target)) {
      if(!v.ready)return null;
      const ahead=neighbor(r,target,cmd);
      if(!pass(r,v,ahead)||r.map[ahead]==="G"||v.rocks.includes(ahead))return null;
      v.rocks[v.rocks.indexOf(target)]=ahead;v.rocks.sort((x,y)=>x-y);v.ready=false;
    }
    if(!pass(r,v,target))return null;
    if(a==="Raftwake" && arrows[r.map[target]]) {
      const drift=neighbor(r,target,arrows[r.map[target]]);
      if(pass(r,v,drift))target=drift;
    }
    v.p=target;
    if(a==="Raftwake"&&!"~^>v<".includes(r.map[target]))v.ready=false;
    if(r.map[target]==="*")v.token=true;
    return keyOf(initial)===keyOf(v)?null:v;
  }
  function restore(raw) {
    const safe={};
    for(const r of rooms) {
      const old=raw?.[r.id];
      if(!old||typeof old!=="object")continue;
      const inside=p=>Number.isInteger(p)&&p>=0&&p<r.map.length&&r.map[p]!=="#";
      function read(v) {
        if(!v||!inside(v.p)||!Number.isInteger(v.mask)||v.mask<0||v.mask>7||
          !Array.isArray(v.rocks)||v.rocks.length!==r.rocks.length||new Set(v.rocks).size!==v.rocks.length||
          !v.rocks.every(inside)||!Array.isArray(v.ice)||v.ice.length>2||!v.ice.every(p=>inside(p)&&r.map[p]==="~"))return null;
        return {p:v.p,mask:v.mask,token:v.token===true,ready:v.ready===true,rocks:v.rocks.slice(),ice:v.ice.slice()};
      }
      const now=read(old.now);
      safe[r.id]={now:now||fresh(r),undo:now&&Array.isArray(old.undo)?old.undo.slice(-24).map(read).filter(Boolean):[],claimed:old.claimed===true};
    }
    return safe;
  }
  function route(r,start) {
    if(start.p===r.exit)return [];
    const queue=[{state:start,prev:-1,command:null}],seen=new Set([keyOf(start)]);
    for(let i=0;i<queue.length&&i<50000;i++) {
      for(const command of pathKeys) {
        const next=advance(r,queue[i].state,command);
        if(!next)continue;
        const key=keyOf(next);
        if(seen.has(key))continue;
        seen.add(key);queue.push({state:next,prev:i,command});
        if(next.p===r.exit){
          const path=[];
          for(let n=queue.length-1;n>0;n=queue[n].prev)path.push(queue[n].command);
          return path.reverse();
        }
      }
    }
    return null;
  }
  function create({state,commit,regions,species,items}) {
    const homes=new Map(rooms.map(r=>[r.id,r.ability?regions.findIndex(place=>place.routeAbility===r.ability):0]));
    function entry(r) {
      const s=state(),region=homes.get(r.id),claimed=s.hollows?.[r.id]?.claimed===true;
      const carrier=r.ability?s.party.find(p=>species[p.id]?.ability===r.ability):null;
      const reason=s.battle?"Finish this encounter first.":s.region!==region?"Visit "+regions[region].name+".":
        r.ability&&!s.licenses.includes(r.ability)?"Earn the "+r.ability+" license.":
        r.ability&&!carrier?"Befriend a "+r.ability+" carrier.":s.landmark!=="travel"?"Walk to the trailpost entrance.":"";
      return {id:r.id,title:r.title,region,ability:r.ability,partner:r.partner,carrier:carrier?.id,complete:claimed,open:!reason,reason};
    }
    function board(id) {
      if(!Object.hasOwn(byId,id))return null;
      const r=byId[id];
      const record=state().hollows?.[r.id];
      return {entry:entry(r),room:r,now:record?clone(record.now):fresh(r),canUndo:!!record?.undo.length};
    }
    function input(id,cmd) {
      const b=board(id);
      if(!b||!b.entry.open)return {ok:false,message:b?.entry.reason||"Choose a hollow."};
      const r=b.room,s=state(),stored=s.hollows?.[id],v=b.now;
      let next,undo=stored?.undo.slice()||[];
      if(cmd==="undo") {
        if(!undo.length)return {ok:false,message:"No earlier step to undo."};
        next=undo.pop();
      } else if(cmd==="restart"){
        next=fresh(r);
        if(keyOf(next)===keyOf(v))return {ok:false,message:"You are at the entrance."};
        undo.push(v);
      } else {
        if(v.p===r.exit)return {ok:false,message:"The delivery is complete. Walk the hollow again to practice."};
        next=advance(r,v,cmd);
        if(!next)return {ok:false,message:cmd==="skill"?r.goal:"That way is closed. Check the markings or ask for a hint."};
        undo.push(v);
      }
      const reward=next.p===r.exit&&!stored?.claimed;
      if(!s.hollows)s.hollows={};
      s.hollows[id]={now:next,undo:undo.slice(-24),claimed:!!stored?.claimed||reward};
      if(reward)for(const [item,n] of Object.entries(r.reward))s.bag[item]=(s.bag[item]||0)+n;
      return commit(reward?"hollow-complete":"hollow-step",reward?r.ending:"");
    }
    function hint(id) {
      const b=board(id);if(!b||!b.entry.open)return b?.entry.reason||"Choose a hollow.";
      const plan=route(b.room,b.now);
      if(!plan)return "This position has no path to the post. Undo a step, or start again at the entrance.";
      if(!plan.length)return "The letter is home.";
      return plan[0]==="skill"?b.room.verb+" here.":"Go "+plan[0]+" next.";
    }
    return {list:()=>rooms.map(entry),at:i=>{const r=rooms.find(r=>homes.get(r.id)===i);return r?entry(r):null;},board,input,hint};
  }
  const colors={
    first:["#3a644c","#86a762","#abae78","#cbd798","#6b814e"],
    Raftwake:["#2f655f","#739c71","#b5ad7a","#e1d399","#6f845d"],
    Cloudlift:["#4b5e78","#8193a1","#bcb4a1","#e0d5b4","#84878b"],
    Stonecleave:["#695346","#9d8060","#b9a685","#d7c6a1","#897b68"],
    Lullsong:["#705d70","#a98a92","#bdab95","#ddcfb4","#8d7c73"],
    Glowpath:["#40435c","#6b7286","#838b86","#a9b2a2","#626e76"],
    Frostspan:["#4c6f7c","#88adb4","#bdd2c9","#e5eadd","#849f9c"]
  };
  const pictures=new Map();
  function kinPicture(id){
    if(!id||typeof Image==="undefined"||!window.WilderKinDex)return null;
    if(!pictures.has(id)){const picture=new Image();picture.src=window.WilderKinDex.spriteUrl(id);pictures.set(id,picture);}
    const picture=pictures.get(id);return picture.complete&&picture.naturalWidth?picture:null;
  }
  function geometry(r,x,y,w,h) {
    const cell=Math.max(1,Math.floor(Math.min((w-8)/r.w,(h-8)/r.h,47)));
    const companionWidth=w>=675?Math.min(210,w*.25):0;
    return {cell,companionWidth,left:Math.floor(x+(w-cell*r.w-companionWidth)/2),top:Math.floor(y+(h-cell*r.h)/2)};
  }
  function paint(c,r,v,x,y,w,h,t,partner) {
    const {cell,left,top,companionWidth}=geometry(r,x,y,w,h);
    const picture=kinPicture(partner?.id);
    const palette=colors[r.ability||"first"],lit=unlocked(r,v);
    const rect=(color,x,y,w,h)=>{c.fillStyle=color;c.fillRect(x,y,w,h);};
    const glyph=(text,color,x,y,size=8)=>{
      c.font="bold "+size+"px monospace";c.fillStyle=color;c.textAlign="center";c.textBaseline="middle";c.fillText(text,x,y);
    };
    const reflect=typeof matchMedia!=="undefined"&&matchMedia("(prefers-reduced-motion: reduce)").matches;
    const pulse=reflect?0:Math.floor(t/520)%2;
    if(companionWidth && partner){
      const side=left+r.w*cell+9,sw=companionWidth-15,bottom=top+r.h*cell,sh=r.h*cell;
      c.save();
      rect(palette[0],side,top,sw,sh);rect(palette[2],side+2,top+2,sw-4,sh-4);
      rect(palette[3],side+3,top+3,sw-6,sh*.55);
      const ground=top+sh*.72;
      for(let i=0;i<sw-4;i+=5){
        const h1=6+5*Math.sin(i*.04)+7*Math.sin(i*.07+2),h2=4+6*Math.sin(i*.05+2);
        rect(palette[1],side+2+i,ground-h1-21,Math.min(5,sw-4-i),h1+26);
        rect(palette[2],side+2+i,ground-h2-9,Math.min(5,sw-4-i),h2+14);
      }
      c.fillStyle=palette[1];c.beginPath();c.ellipse(side+sw*.52,ground,sw*.25,5,0,0,Math.PI*2);c.fill();
      if(picture){
        const size=Math.min(sw*.9,sh*.64);c.imageSmoothingEnabled=false;
        const ratio=Math.min(size/picture.naturalWidth,size/picture.naturalHeight);
        const pw=picture.naturalWidth*ratio,ph=picture.naturalHeight*ratio;
        c.drawImage(picture,Math.floor(side+(sw-pw)/2),Math.floor(ground-ph-pulse),Math.round(pw),Math.round(ph));
      }
      rect(palette[0],side+2,bottom-37,sw-4,35);
      c.textAlign="center";c.textBaseline="middle";c.fillStyle="#fff8d9";c.font="600 17px Pixelify,monospace";c.fillText(partner.name,side+sw/2,bottom-24);
      c.fillStyle="#e6ecd0";c.font="11px sans-serif";c.fillText(r.ability||"Walking partner",side+sw/2,bottom-9);
      c.restore();
    }
    c.save();c.translate(left,top);c.scale(cell/16,cell/16);
    rect("#2a4039",-1,-1,r.w*16+2,r.h*16+2);
    for(let p=0;p<r.map.length;p++){
      const tx=p%r.w*16,ty=Math.floor(p/r.w)*16,kind=r.map[p],seed=(p*43+p%7)%13;
      c.save();c.translate(tx,ty);
      if(kind==="#"){
        rect(palette[0],0,0,16,16);
        rect(palette[1],1,2,14,9);rect(palette[0],1,8,5,2);rect(palette[2],2,2,6,1);
        if(r.ability==="Glowpath"||r.ability==="Stonecleave"){rect(palette[3],11,5,2,1);rect(palette[1],8,13,6,1);}
        else if(r.ability==="Cloudlift"||r.ability==="Frostspan"){
          rect(palette[3],1,2,10,2);rect(palette[2],0,4,5,2);rect(palette[2],3+seed%4,6,3,3);rect(palette[1],9,11,4,2);
        }else if(r.ability==="Raftwake"){
          rect("#60856a",0,6,16,7);rect("#88a56f",2,4,2,7);rect("#a8b373",4,2,1,8);rect("#667b54",10,5,2,6);
        }else{
          rect("#645740",7,9,3,5);rect(palette[0],2,3,12,8);rect(palette[1],1,5,13,4);
          rect(palette[1],4,1,8,9);rect(palette[2],4+seed%3,2,3,2);rect(palette[1],0,13,3,2);
        }
      }else if(kind==="~"||(r.ability==="Raftwake"&&arrows[kind])){
        const sky=r.ability==="Cloudlift",frozen=v.ice.includes(p);
        rect(sky?"#66839e":frozen?"#b9e5e1":"#578f9e",0,0,16,16);
        rect(sky?"#8098aa":frozen?"#ebf8ec":"#87b7bb",2+(seed+pulse)%5,3+seed%7,6,1);
        rect(sky?"#a9bec7":frozen?"#89c6ce":"#427b8a",seed%8,12,7,1);
        if(frozen){rect("#e7f4ee",0,0,16,2);rect("#739ba4",0,14,16,2);rect("#7eb3bb",9,4,1,3);rect("#7eb3bb",10,7,2,2);}
        if(arrows[kind]){
          c.save();c.translate(8,8);c.rotate(({">":0,"v":1,"<":2,"^":3})[kind]*Math.PI/2);
          rect("#def2cf",-4,-1,7,2);rect("#def2cf",1,-3,2,2);rect("#def2cf",1,1,2,2);c.restore();
        }
      } else {
        rect(palette[2],0,0,16,16);rect(palette[3],2+seed%8,2+seed%4,2,1);rect(palette[4],seed%12,11+seed%3,3,1);
        if(kind==="="){
          for(let n=0;n<3;n++){rect("#8d6e4d",0,1+n*5,16,4);rect("#d4b87d",1,1+n*5,14,1);}
        } else if(kind==="+"){
          rect("#627783",2,2,12,12);rect("#b6c5c2",3,3,10,10);
          if(r.ability==="Cloudlift"){rect("#eff0c9",5,8,2,4);rect("#eff0c9",7,5,3,5);rect("#eff0c9",10,4,2,3);}
          else{rect("#5b899a",7,3,2,9);rect("#5b899a",4,8,8,2);rect("#5b899a",4,6,2,2);rect("#5b899a",10,6,2,2);}
        } else if(kind==="o"){
          rect("#756140",2,4,12,8);rect("#edcc76",3,4,10,7);rect(palette[4],5,5,6,4);
        } else if(kind==="|"&&!lit){for(let n=0;n<3;n++){rect("#574d46",2+n*5,0,2,16);rect("#bb9a6a",2+n*5,1,1,13);}rect("#806949",0,6,16,3);}
        else if(kind==="*"&&!v.token){
          rect("#775f36",3,7,10,6);rect("#f7d47b",4,5+pulse,8,6);rect("#aa8042",5,6+pulse,2,1);rect("#e8a353",8,8+pulse,2,2);
        }else if(kind==="G"){
          rect("#735432",6,8,3,7);rect("#785435",2,4,12,8);rect(lit?"#f7d77c":"#b19060",3,3,10,7);
          rect("#72583e",5,6,6,1);rect("#e1a05b",12,2,2,5);
        }else if(kind==="1"||kind==="2"||kind==="3"){
          rect("#876341",3,8,10,5);rect("#e0bd78",5,3,6,8);rect("#dbac65",3,9,10,2);
          glyph(kind,"#59422c",8,7,7);
        }else if(r.ability==="Lullsong"&&"abc".includes(kind)){
          const quiet=Boolean(v.mask&(1<<"abc".indexOf(kind)));
          rect("#77756b",3,9,10,4);rect(quiet?"#d7ddc6":"#e9dfc9",2,5,11,6);rect("#765d54",10,6,4,4);
          rect("#6c5e50",3,10,2,3);rect("#6c5e50",9,10,2,3);rect("#423c38",12,7,1,1);
          glyph(quiet?"z":kind.toUpperCase(),"#54435a",5,3,6);
        }else if(r.mirrors.includes(p)){
          const m=r.mirrors.indexOf(p),slash=(kind==="/")!==Boolean(v.mask&(1<<m));
          rect("#5d6273",2,2,12,12);for(let j=0;j<8;j++){rect("#d1ecce",4+j,slash?11-j:4+j,2,2);}
        }else if(kind==="!"||kind===">"){
          rect("#48485c",3,3,10,10);rect(lit||kind===">"?"#f4d07d":"#b8aea0",5,5,6,6);
        }
      }
      if(v.rocks.includes(p)){
        rect("#635445",2,5,12,8);rect("#85715d",2,4,12,7);rect("#b09c79",4,3,8,2);rect("#d8bd89",5,5,3,1);
        rect("#554f47",6,7,2,2);rect("#554f47",8,9,1,2);
      }
      c.restore();
    }
    if(r.ability==="Glowpath"){
      const line=beam(r,v).cells;
      c.save();c.strokeStyle="#fff1a9";c.lineWidth=1.3;c.beginPath();
      line.forEach((p,i)=>{const x=(p%r.w)*16+8,y=Math.floor(p/r.w)*16+8;if(i)c.lineTo(x,y);else c.moveTo(x,y);});
      c.stroke();c.restore();
    }
    const px=v.p%r.w*16,py=Math.floor(v.p/r.w)*16;
    c.translate(px,py);
    if(v.ready){rect("#f1cf75",0,0,4,1);rect("#f1cf75",0,0,1,4);rect("#f1cf75",12,15,4,1);rect("#f1cf75",15,12,1,4);}
    if(picture){
      c.save();c.imageSmoothingEnabled=false;
      const scale=Math.min(9/picture.naturalWidth,9/picture.naturalHeight);
      c.drawImage(picture,8,6-pulse,Math.max(1,picture.naturalWidth*scale),Math.max(1,picture.naturalHeight*scale));
      c.restore();
    }
    rect("#697163",3,13,11,2);rect("#403c37",5,11,2,3);rect("#403c37",9,11,2,3);
    rect("#364d43",4,8,7,4);rect("#74543b",3,8,2,4);rect("#e0b48a",5,5,6,4);
    rect("#725038",5,5,1,3);rect("#42483b",9,6,1,1);
    rect("#c8a25a",4,2,6,3);rect("#775a38",3,4,10,2);rect("#dfc27c",4,3,6,1);
    c.restore();
  }
  function pages({game,row,go,render,notify,locate}) {
    let walkingTo=null;
    const api=game.hollows;
    const itemNames=reward=>Object.entries(reward).map(([k,n])=>n+" "+game.items[k].name).join(" · ");
    const open=(name,value,label,detail="",extra={})=>row("view",label,name+"|"+value,detail,extra);
    function index() {
      const rows=api.list().map(e=>open("hollow",e.id,e.title,game.regions[e.region].name+" · "+(e.ability||"On foot"),
        {badge:e.complete?"DELIVERED":e.region===game.state.region?"LOCAL":""}));
      return {title:"Hidden hollows",kicker:"THE SIDE POST",subtitle:"Seven small deliveries along the old foot routes. Start at the host region’s trailpost.",sections:[{rows}]};
    }
    function model(name,value) {
      if(name==="hollows")return index();
      if(name!=="hollow")return null;
      const id=value||walkingTo,b=api.board(id);
      if(!b)return index();
      const {room:r,entry:e,now:v}=b;
      const sections=[],done=v.p===r.exit;
      const partnerId=e.carrier || game.state.lead;
      const partner=game.species[partnerId]?{id:partnerId,name:game.species[partnerId].name}:null;
      if(!e.open){
        const options=[];
        if(game.state.region!==e.region)options.push(open("region",e.region,"Find the trailpost",game.regions[e.region].name));
        else if(r.ability&&!game.state.licenses.includes(r.ability))options.push(open("license",r.ability,"Visit the traversal school"));
        else if(r.ability&&!e.carrier)options.push(row("nav","Find a carrier in the field guide","guide"));
        else options.push(row("hollow-walk","Walk to the trailpost",id,"",{disabled:!!game.state.battle}));
        sections.push({title:"Entrance",text:e.reason,rows:options},{title:r.partner,text:r.intro});
      }else{
        const action=(cmd,label)=>row("hollow-input",label,id+"|"+cmd);
        const spots=(x,y,w,h)=>{
          if(done)return [];
          const {cell,left,top}=geometry(r,x,y,w,h),hits=[];
          for(const cmd of Object.keys(moves)){
            const target=neighbor(r,v.p,cmd);
            if(target>=0&&advance(r,v,cmd))hits.push({...action(cmd,"Step "+cmd),x:left+target%r.w*cell,y:top+Math.floor(target/r.w)*cell,w:cell,h:cell});
          }
          if(r.ability&&advance(r,v,"skill"))hits.push({...action("skill",r.verb),x:left+v.p%r.w*cell,y:top+Math.floor(v.p/r.w)*cell,w:cell,h:cell});
          return hits;
        };
        const legend=r.ability==="Stonecleave"?v.rocks.filter(p=>r.map[p]==="o").length+"/2 hinge stones seated":
          r.ability==="Lullsong"?"Herds asleep · "+(["A","B","C"].filter((_,i)=>v.mask&(1<<i)).join(" ")||"none"):
          r.ability==="Glowpath"?(unlocked(r,v)?"Receiver lit":"Receiver dark"):v.token?"Parcel in Finch’s pack":"Parcel marked in gold";
        sections.push({height:223,draw:(c,x,y,w,h,t)=>paint(c,r,v,x,y,w,h,t,partner),hotspots:spots},
          {text:"Row "+(Math.floor(v.p/r.w)+1)+" · Column "+(1+v.p%r.w)+" · "+(v.ready?r.ability+" ready · ":"")+legend});
        if(done){
          sections.push({title:r.partner,text:r.ending},{title:"Delivered",text:itemNames(r.reward),columns:2,
            rows:[action("restart","Practice again"),row("root","Return to trail")]});
        }else{
          const controls=Object.keys(moves).map(cmd=>({...action(cmd,cmd[0].toUpperCase()+cmd.slice(1)),disabled:!advance(r,v,cmd)}));
          if(r.ability)controls.push({...action("skill",r.verb),tone:"primary",key:"E",disabled:!advance(r,v,"skill")});
          controls.push({...action("undo","Undo"),disabled:!b.canUndo});
          sections.push({columns:3,rows:controls},{title:"Field note",text:r.goal,columns:2,rows:[row("hollow-hint","Show next step",id),action("restart","Return to entrance")]},
            {title:r.partner,text:r.intro},{title:e.complete?"Previous delivery":"Delivery supplies",text:itemNames(r.reward)});
        }
      }
      return {title:r.title,kicker:game.regions[e.region].name+"   /   "+(r.ability||"FOOTPATH"),
        subtitle:e.carrier?"Traveling with "+game.species[e.carrier].name:undefined,sections};
    }
    function act(id,value) {
      if(id==="hollow-walk"){walkingTo=value;locate("travel","hollow");return true;}
      if(id==="hollow-hint"){notify(api.hint(value));return true;}
      if(id!=="hollow-input")return false;
      const [room,cmd]=value.split("|"),result=api.input(room,cmd);
      if(result.ok)render();
      if(!result.ok||result.kind==="hollow-complete")notify(result.message);
      return true;
    }
    function key(event,value) {
      const id=value||walkingTo;
      if(!id||!api.board(id)?.entry.open)return false;
      const command={arrowup:"north",w:"north",arrowdown:"south",s:"south",arrowleft:"west",a:"west",arrowright:"east",d:"east",e:"skill",u:"undo",h:"hint"}[event.key.toLowerCase()];
      if(!command)return false;
      if(!event.repeat)act(command==="hint"?"hollow-hint":"hollow-input",command==="hint"?id:id+"|"+command);
      return true;
    }
    return {model,act,key};
  }
  window.WilderHollows={create,restore,pages};
})();
