// Trail fairs use short rounds. Each activity owns its board and rules; only completed rounds award a clear.
(() => {
  "use strict";

  const pick = list => list[Math.floor(Math.random() * list.length)];
  const range = n => Array.from({length:n}, (_, i) => i);
  function shuffle(list) {
    const result = [...list];
    for (let i=result.length-1; i>0; i--) {
      const j = Math.floor(Math.random() * (i+1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
  const sum = values => values.reduce((a,b) => a+b, 0);
  const control = (key, text, style="", disabled=false, label="") =>
    `<button type="button" class="fair-key ${style}" data-play="${key}"${disabled ? " disabled" : ""}${label ? ` aria-label="${label}"` : ""}>${text}</button>`;
  const group = (...items) => `<div class="fair-buttons">${items.join("")}</div>`;
  const tiles = (cols, items) => `<div class="fair-tiles" style="--columns:${cols}">${items.join("")}</div>`;
  const tile = (text, style="", label="") => `<span class="fair-tile ${style}"${label ? ` aria-label="${label}"` : ""}>${text}</span>`;
  const gauge = (label,value) => `<div class="fair-gauge"><span>${label}</span><strong>${value}</strong></div>`;
  const won = (s,text) => { s.result = "won"; s.notice = text; };
  const lost = (s,text) => { s.result = "lost"; s.notice = text; };
  const adjacent = (i,size) => [i-size,i+size,i%size ? i-1 : -1,i%size<size-1 ? i+1 : -1].filter(n=>n>=0&&n<size*size);
  const directionButtons = () => group(control("up","↑ North"),control("left","← West"),control("down","↓ South"),control("right","→ East"));
  const vector = {up:[0,-1],left:[-1,0],down:[0,1],right:[1,0]};
  const rune = ["✦","☾","◆","♧","☀","≈"];
  const runeNames = ["Star","Moon","Gem","Leaf","Sun","Wave"];
  const games = [];

  function add(id, name, region, description, setup, view, play) {
    games.push({ id,name,region,description,setup,view,play });
  }

  add("firefly-pairs","Firefly Jars",0,
    "Lift two jar covers at a time. Find all four matching pairs in eight turns.",
    () => ({cards:shuffle([0,0,1,1,2,2,3,3]),open:[],matched:[],turns:0}),
    s => gauge("Pairs",s.matched.length/2+" / 4 · "+(8-s.turns)+" turns left") +
      tiles(4,s.cards.map((card,i) => {
        const found = s.matched.includes(i), visible = found || s.open.includes(i);
        return control(i,visible ? rune[card] : "?",found ? "solved" : visible ? "lit" : "",found || s.open.length===2 || visible,
          "Jar "+(i+1)+(visible ? ", "+runeNames[card] : ", covered"));
      })) + (s.open.length===2 ? group(control("cover","Cover both jars")) : ""),
    (s,key) => {
      if(key==="cover") {s.open=[];s.notice="Choose another pair.";return;}
      const i=Number(key);
      if(s.open.includes(i)||s.matched.includes(i)||s.open.length===2)return;
      s.open.push(i);
      if(s.open.length!==2)return;
      s.turns++;
      if(s.cards[s.open[0]]===s.cards[i]) {
        s.matched.push(...s.open);s.open=[];s.notice="A pair! Their lanterns glow in unison.";
      } else s.notice="Different lights. Remember their positions.";
      if(s.matched.length===8)won(s,"All four pairs are lighting the village path.");
      else if(s.turns===8)lost(s,"Dawn has come. The fireflies need to rest.");
    });

  add("coal-share","Last Ember",1,
    "You and the kiln keeper take turns collecting one, two, or three coals. Take the final coal to win.",
    () => ({pile:pick([9,10,11,13,14,15])}),
    s => gauge("Coals left",s.pile)+`<div class="fair-pile" aria-hidden="true">${"◆ ".repeat(s.pile)}</div>`+
      group(...[1,2,3].map(n=>control(n,"Take "+n,"",n>s.pile))),
    (s,key) => {
      const n=Number(key); if(n<1||n>Math.min(3,s.pile))return;
      s.pile-=n;
      if(!s.pile)return won(s,"You took the last glowing coal.");
      const rival=Math.min(s.pile,s.pile%4 || pick([1,2,3]));
      s.pile-=rival;s.notice="The kiln keeper takes "+rival+".";
      if(!s.pile)lost(s,"The keeper claims the last ember. Try leaving piles of four.");
    });

  function flipLamps(lights,i) {
    [i,...adjacent(i,3)].forEach(j=>{lights[j]=!lights[j];});
  }
  add("lamplighter","Moonlamp Switchboard",2,
    "Light all nine lamps. Each switch flips its own lamp and the lamps directly beside it. You have six presses.",
    () => {
      const lamps=Array(9).fill(true);
      shuffle(range(9)).slice(0,pick([3,4,5])).forEach(i=>flipLamps(lamps,i));
      return {lamps,moves:0};
    },
    s => gauge("Presses left",6-s.moves)+tiles(3,s.lamps.map((lit,i)=>control(i,lit?"☀":"·",lit?"lit":"",false,"Lamp "+(i+1)+(lit?" lit":" dark")))),
    (s,key) => {
      flipLamps(s.lamps,Number(key));s.moves++;
      if(s.lamps.every(Boolean))won(s,"Nine lanterns burn above the moonwell.");
      else if(s.moves===6)lost(s,"The switchboard needs a fresh charge.");
    });

  add("mortar","Apothecary’s Measure",3,
    "Choose exactly three herb weights that add up to the prescription. You can change your selection before grinding.",
    () => {
      const weights=shuffle(range(9).map(n=>n+1)).slice(0,6);
      return {weights,target:sum(shuffle(weights).slice(0,3)),chosen:[],tries:2};
    },
    s => gauge("Prescription",s.target+" grams")+
      tiles(3,s.weights.map((w,i)=>control(i,w+" g",s.chosen.includes(i)?"lit":"",s.chosen.length===3&&!s.chosen.includes(i))))+
      gauge("Mortar",sum(s.chosen.map(i=>s.weights[i]))+" / "+s.target+" · "+s.tries+" batches left")+
      group(control("grind","Grind selected herbs","",s.chosen.length!==3)),
    (s,key) => {
      if(key!=="grind"){const i=Number(key);s.chosen=s.chosen.includes(i)?s.chosen.filter(j=>j!==i):s.chosen.length<3?[...s.chosen,i]:s.chosen;return;}
      if(s.chosen.length!==3)return;
      if(sum(s.chosen.map(i=>s.weights[i]))===s.target)return won(s,"The three leaves make a perfectly balanced remedy.");
      s.chosen=[];s.tries--;s.notice="That batch missed the prescription. Reweigh the herbs.";
      if(!s.tries)lost(s,"The apothecary has run out of fresh leaves.");
    });

  add("sluice","The Sluice Keeper",7,
    "Measure exactly four cups in the five-cup jug. Fill, empty, or pour between the two jugs in ten moves.",
    () => ({water:[0,0],moves:0}),
    s => gauge("Moves left",10-s.moves)+
      `<div class="fair-vessels">${[3,5].map((capacity,i)=>`<div><span class="fair-vessel" style="--fill:${100*s.water[i]/capacity}%"></span><strong>${s.water[i]} / ${capacity} cups</strong></div>`).join("")}</div>`+
      group(...[3,5].flatMap((capacity,i)=>[control("fill"+i,"Fill "+capacity,"",s.water[i]===capacity),control("empty"+i,"Empty "+capacity,"",!s.water[i])]),
        control("pour0","Pour 3 → 5","",!s.water[0]||s.water[1]===5),control("pour1","Pour 5 → 3","",!s.water[1]||s.water[0]===3)),
    (s,key) => {
      const i=Number(key.slice(-1)),j=1-i,capacity=[3,5];
      if(key.startsWith("fill"))s.water[i]=capacity[i];
      else if(key.startsWith("empty"))s.water[i]=0;
      else {const n=Math.min(s.water[i],capacity[j]-s.water[j]);s.water[i]-=n;s.water[j]+=n;}
      s.moves++;
      if(s.water[1]===4)won(s,"Exactly four cups. The sluice float rises to its mark.");
      else if(s.moves===10)lost(s,"The water wheel stops before the float can rise.");
    });

  const mazes=[
    ["S...#","##.K#","#...#","#.##E","#...."],
    ["S#..E","...#.","##.#.","K..#.",".###."],
    ["S..#E",".#.#.",".#...","..##.","K...."]
  ];
  add("burrow","Burrow Post",11,
    "Carry the brass key to the exit before your lantern uses its 22 steps. Stone walls block the tunnels.",
    () => {const rows=pick(mazes);return {board:rows.join(""),pos:0,hasKey:false,steps:22};},
    s => gauge("Lantern",s.steps+" steps · "+(s.hasKey?"Key collected":"Find the key"))+
      tiles(5,[...s.board].map((c,i)=>tile(i===s.pos?"●":c==="K"&&!s.hasKey?"⚿":c==="E"?"⇥":c==="#"?"▨":"·",
        i===s.pos?"player":c==="#"?"rock":c==="E"?"lit":"",i===s.pos?"Courier":c==="E"?"Exit":c==="K"?"Key":"")))+directionButtons(),
    (s,key) => {
      if(!vector[key])return;const [dx,dy]=vector[key],x=s.pos%5+dx,y=Math.floor(s.pos/5)+dy,dest=y*5+x;
      if(x<0||x>4||y<0||y>4||s.board[dest]==="#"){s.notice="A stone wall blocks this tunnel.";return;}
      s.pos=dest;s.steps--;s.notice="";
      if(s.board[dest]==="K"){s.hasKey=true;s.notice="Key in hand. Find the exit marked ⇥.";}
      if(s.board[dest]==="E"&&s.hasKey)won(s,"The night mail reaches its burrow.");
      else if(!s.steps)lost(s,"The lantern went out in the tunnels.");
    });

  add("loom","Ribbon Loom",17,
    "Study the weaver’s four-thread pattern. Hide the sample, then weave it back in the same order.",
    () => ({pattern:range(4).map(()=>pick([0,1,2,3])),woven:[],hidden:false}),
    s => gauge(s.hidden?"Your ribbon":"Weaver’s sample",s.hidden?s.woven.length+" / 4 threads":"Study the four beads")+
      tiles(4,range(4).map(i=>tile(!s.hidden?rune[s.pattern[i]]:s.woven[i]!==undefined?rune[s.woven[i]]:"·","",!s.hidden?runeNames[s.pattern[i]]:"Thread "+(i+1))))+
      (s.hidden?group(...range(4).map(i=>control(i,rune[i]+" "+runeNames[i]))):group(control("hide","Hide sample and weave"))),
    (s,key) => {
      if(key==="hide"){s.hidden=true;return;}if(!s.hidden)return;
      const color=Number(key);s.woven.push(color);
      if(color!==s.pattern[s.woven.length-1])return lost(s,"The shuttle caught the wrong thread. A fresh sample is ready for another try.");
      if(s.woven.length===4)won(s,"The festival ribbon matches the sample.");
    });

  const cargoNames=["Fangfox","Mossbun","Fennel"];
  add("ferry","The Narrow Ferry",23,
    "Ferry all three passengers across. Your boat holds you and one passenger. An unattended Fangfox chases Mossbun, and Mossbun eats the fennel.",
    () => ({bank:0,cargo:[0,0,0],crossings:0}),
    s => gauge("Ferry",s.bank?"Far bank":"Near bank")+
      [0,1].map(b=>gauge(b?"Far bank":"Near bank",cargoNames.filter((_,i)=>s.cargo[i]===b).join(" · ")||"Empty")).join("")+
      group(...cargoNames.map((name,i)=>control(i,"Take "+name,"",s.cargo[i]!==s.bank)),control("solo","Cross alone")),
    (s,key) => {
      const bank=s.bank;s.bank=1-bank;s.crossings++;
      if(key!=="solo")s.cargo[Number(key)]=s.bank;
      if(s.cargo[1]===bank&&(s.cargo[0]===bank||s.cargo[2]===bank))lost(s,"A passenger caused trouble on the unattended bank.");
      else if(s.cargo.every(b=>b===1))won(s,"All three passengers made it across safely in "+s.crossings+" crossings.");
      else if(s.crossings>=12)lost(s,"The water rose above the landing after twelve crossings.");
    });

  add("wind-cards","Windreader’s Wager",30,
    "Predict whether the next wind card is higher or lower. Read the remaining deck and make four correct calls before your third miss.",
    () => {const deck=shuffle(range(9).map(n=>n+1));return {current:deck.pop(),deck,hit:0,miss:0};},
    s => gauge("Forecasts",s.hit+" / 4 correct · "+s.miss+" / 3 misses")+
      `<div class="fair-card">${s.current}</div>`+gauge("Cards still in play",[...s.deck].sort((a,b)=>a-b).join(" · "))+
      group(control("lower","↓ Lower"),control("higher","↑ Higher")),
    (s,key) => {
      const next=s.deck.pop(),correct=(next>s.current)===(key==="higher");
      s.current=next;if(correct)s.hit++;else s.miss++;
      s.notice=correct?"The vane agrees with your forecast.":"The gust turned against your forecast.";
      if(s.hit===4)won(s,"Four sound readings. The sail crew sets off.");
      else if(s.miss===3)lost(s,"Three missed gusts have sent the kite into the reeds.");
    });

  add("tile-cart","Quarry Switchyard",37,
    "Slide numbered carts into reading order, leaving the last square free. Only a cart beside the gap can move. You have 24 shifts.",
    () => {
      const board=[1,2,3,4,5,6,7,8,0];let empty=8,last=-1;
      for(let i=0;i<10;i++){const next=pick(adjacent(empty,3).filter(j=>j!==last));board[empty]=board[next];board[next]=0;last=empty;empty=next;}
      if(board.every((v,i)=>v===(i+1)%9)){const next=7;board[8]=board[next];board[next]=0;}
      return {board,moves:0};
    },
    s => gauge("Shifts left",24-s.moves)+tiles(3,s.board.map((n,i)=>n?control(i,n,n===i+1?"aligned":"",!adjacent(s.board.indexOf(0),3).includes(i),"Cart "+n):tile("·","gap")))
      +`<p class="fair-hint">Target rows: 1 2 3 / 4 5 6 / 7 8 ·</p>`,
    (s,key) => {
      const i=Number(key),empty=s.board.indexOf(0);
      if(!adjacent(empty,3).includes(i)){s.notice="Only a cart next to the empty rail can slide.";return;}
      s.board[empty]=s.board[i];s.board[i]=0;s.moves++;s.notice="";
      if(s.board.every((n,j)=>n===(j+1)%9))won(s,"The convoy is in order and ready to roll.");
      else if(s.moves===24)lost(s,"The quarry whistle ends this shift.");
    });

  add("reed-cast","Reedwater Casting",44,
    "Watch the float travel across the marked water. Reel when its pointer is inside the gold band. Land two bites in four casts.",
    () => ({landed:0,casts:0,started:performance.now(),low:pick([26,47,60]),steady:false,position:0}),
    s => gauge("Catch",s.landed+" / 2 bites · "+(4-s.casts)+" casts left")+
      `<div class="fair-water" style="--bank:${s.low}%"><span class="fair-school"></span><span class="fair-float" aria-hidden="true"${s.steady ? ` style="animation:none;left:${s.position}%"` : ""}></span></div><p class="fair-hint">The band covers ${s.low}–${s.low+26}% of the channel. ${s.steady ? "Float position: "+s.position+"%." : "The pointer crosses in two seconds."}</p>`+
      group(control("reel","Reel in"),s.steady ? control("row","Paddle 10%") : control("steady","Use step controls")),
    (s,key) => {
      if(key==="steady"){s.steady=true;s.position=0;s.notice="Paddle to move the float into the marked band.";return;}
      if(key==="row"){s.position=(s.position+10)%110;return;}
      const phase=((performance.now()-s.started)%4000)/2000;
      const position=s.steady?s.position:(phase<=1?phase:2-phase)*100;
      s.casts++;
      if(position>=s.low&&position<=s.low+26){s.landed++;s.notice="A silver reedfish takes the bait!";}
      else s.notice="The hook came up with duckweed.";
      if(s.landed===2)won(s,"Two reedfish are ready for the village supper.");
      else if(s.casts===4)lost(s,"The school has moved downstream.");
      else {s.low=pick([26,47,60]);s.started=performance.now();s.position=0;}
    });

  function runs(line) {
    const groups=[];let length=0;
    for(const cell of [...line,false]) {
      if(cell)length++;
      else if(length){groups.push(length);length=0;}
    }
    return groups.join(" ")||"0";
  }
  function skyClues(bits) {
    return [...range(4).map(y=>runs(bits.slice(y*4,y*4+4))),...range(4).map(x=>runs(range(4).map(y=>bits[y*4+x])))];
  }
  add("sky-chart","Starcloth",52,
    "Mark stars on the four-by-four chart. Each margin gives the lengths of the filled runs in that row or column, separated by empty squares.",
    () => {
      const pattern=pick(["0010011111000100","1000111010110001","0100111010011100","1010111100100111"]);
      return {clues:skyClues([...pattern].map(c=>c==="1")),ink:Array(16).fill(false),tries:3};
    },
    s => tiles(5,[tile(""),...s.clues.slice(4).map(v=>tile(v,"clue")),...range(4).flatMap(y=>[tile(s.clues[y],"clue"),
      ...range(4).map(x=>control(y*4+x,s.ink[y*4+x]?"✦":"·",s.ink[y*4+x]?"lit":"",false,`Row ${y+1} column ${x+1}, ${s.ink[y*4+x]?"star":"empty"}`))])])+
      group(control("check","Read the sky · "+s.tries+" readings left")),
    (s,key) => {
      if(key!=="check"){s.ink[Number(key)]=!s.ink[Number(key)];return;}
      if(skyClues(s.ink).every((clue,i)=>clue===s.clues[i]))return won(s,"The astronomer recognizes the stars on your cloth.");
      s.tries--;s.notice="At least one margin disagrees with the stars.";
      if(!s.tries)lost(s,"Clouds cover the sky before the chart can be signed.");
    });

  add("gem-vault","Prism Vault",60,
    "Crack a three-gem code in seven guesses. Gems can repeat. Pins count gems in the correct place. Glints count correct gems in the wrong place.",
    () => ({code:range(3).map(()=>pick(range(4))),guess:[],history:[]}),
    s => gauge("Guess",s.guess.map(n=>rune[n]).join(" ")||"Choose three gems")+
      group(...range(4).map(i=>control(i,rune[i]+" "+runeNames[i],"",s.guess.length===3)),control("undo","Undo","",!s.guess.length),
        control("try","Test code","",s.guess.length!==3))+
      `<ol class="fair-history">${s.history.map(row=>`<li>${row.guess.map(n=>runeNames[n]).join(" · ")} <b>${row.pins} pins · ${row.glints} glints</b></li>`).join("")}</ol>`,
    (s,key) => {
      if(key==="undo"){s.guess.pop();return;}
      if(key!=="try"){if(s.guess.length<3)s.guess.push(Number(key));return;}
      if(s.guess.length!==3)return;
      const pins=s.guess.filter((n,i)=>s.code[i]===n).length;
      const common=sum(range(4).map(n=>Math.min(s.code.filter(x=>x===n).length,s.guess.filter(x=>x===n).length)));
      s.history.push({guess:s.guess,pins,glints:common-pins});s.guess=[];
      if(pins===3)won(s,"All three tumblers turn. The prism vault opens.");
      else if(s.history.length===7)lost(s,"The vault resets. Its code was "+s.code.map(i=>runeNames[i]).join(", ")+".");
    });

  const words=[
    ["ANTLER","A branched crown that grows and falls."],["LICHEN","A slow-growing crust on old stone."],
    ["POLLEN","Golden dust ferried between flowers."],["CINDER","A small piece of nearly spent fuel."],
    ["ZEPHYR","The old ranger’s name for a gentle breeze."],["CORAL","A stone-like colony beneath warm waves."],
    ["THISTLE","A prickly flower with a purple crown."],["BASALT","Dark rock born when lava cools."]
  ];
  add("glyph-word","Weatherworn Words",68,
    "Restore the inscription one letter at a time. Its clue survived the storm. Six wrong letters wash the tablet clean.",
    () => {const [word,clue]=pick(words);return {word,clue,letters:[],miss:0};},
    s => gauge("Clue",s.clue)+`<div class="fair-word" aria-label="Inscription">${[...s.word].map(c=>s.letters.includes(c)?c:"_").join(" ")}</div>`+
      gauge("Wrong letters",s.miss+" / 6")+tiles(7,[..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"].map(c=>control(c,c,"",s.letters.includes(c)))),
    (s,key) => {
      if(s.letters.includes(key))return;s.letters.push(key);
      if(!s.word.includes(key))s.miss++;
      if([...s.word].every(c=>s.letters.includes(c)))won(s,"The tablet reads "+s.word+". A piece of trail history survives.");
      else if(s.miss===6)lost(s,"Rain erased the inscription. The missing word was "+s.word+".");
    });

  add("frog-cross","Lily Leap",76,
    "Swap the banks of the two green and two blue frogs. Green moves right and blue left. A frog can step into a free pad or jump over one frog to reach it.",
    () => ({pads:[1,1,0,-1,-1],moves:0}),
    s => gauge("Frog jumps",s.moves)+tiles(5,s.pads.map((v,i)=>v?control(i,v===1?"G →":"← B",v===1?"green":"blue",false,(v===1?"Green":"Blue")+" frog on pad "+(i+1)):tile("·","gap"))),
    (s,key) => {
      const i=Number(key),step=s.pads[i],empty=s.pads.indexOf(0),distance=empty-i;
      if(distance!==step&&distance!==2*step){s.notice="That frog cannot reach the free pad in its swimming direction.";return;}
      s.pads[empty]=step;s.pads[i]=0;s.moves++;s.notice="";
      if(s.pads.join(",")==="-1,-1,0,1,1")return won(s,"Both little families reach their nesting banks.");
      const gap=s.pads.indexOf(0);
      if(!s.pads.some((v,j)=>v&&(gap-j===v||gap-j===2*v)))lost(s,"The frogs are stuck facing one another. Start with a single step.");
    });

  function neighbors(i) {
    const x=i%4,y=Math.floor(i/4);
    return range(16).filter(j=>j!==i&&Math.abs(j%4-x)<=1&&Math.abs(Math.floor(j/4)-y)<=1);
  }
  function survey() {
    // Keep only layouts whose visible counts determine a unique set of three vents.
    while(true) {
      const hidden=shuffle(range(16)).slice(0,6),vents=hidden.slice(0,3);
      const clues=range(16).map(i=>neighbors(i).filter(j=>vents.includes(j)).length);
      let solutions=0;
      for(let a=0;a<4;a++)for(let b=a+1;b<5;b++)for(let c=b+1;c<6;c++) {
        const candidate=[hidden[a],hidden[b],hidden[c]];
        if(range(16).every(i=>hidden.includes(i)||neighbors(i).filter(j=>candidate.includes(j)).length===clues[i]))solutions++;
      }
      if(solutions===1)return {hidden,vents,clues,flags:[],tries:2};
    }
  }
  add("vent-survey","Steam Survey",85,
    "Mark three sealed vents among the six covered tiles. Each exposed number counts vents in its eight neighboring squares.",
    survey,
    s => gauge("Survey flags",s.flags.length+" / 3 · "+s.tries+" surveys left")+tiles(4,range(16).map(i=>
      s.hidden.includes(i)?control(i,s.flags.includes(i)?"⚑":"?",s.flags.includes(i)?"lit":"",s.flags.length===3&&!s.flags.includes(i),"Plot "+(i+1)+(s.flags.includes(i)?", flagged":", covered")):tile(s.clues[i],"clue","Plot "+(i+1)+": "+s.clues[i]+" adjacent vents")))+
      group(control("report","File survey","",s.flags.length!==3)),
    (s,key) => {
      if(key!=="report"){const i=Number(key);s.flags=s.flags.includes(i)?s.flags.filter(j=>j!==i):s.flags.length<3?[...s.flags,i]:s.flags;return;}
      if(s.flags.length!==3)return;
      if(s.vents.every(i=>s.flags.includes(i)))return won(s,"Three steam vents are marked for the quarry crew.");
      s.tries--;s.notice="One or more flags are misplaced. Check the diagonal counts too.";
      if(!s.tries)lost(s,"Steam rises from the plot before the survey is complete.");
    });

  const stoneNames=["Amber","Flint","Opal","Jade","Quartz"];
  add("stone-scale","The Lapidary’s Scale",95,
    "Order five stones from lightest to heaviest. Weigh two at a time, then switch to arranging and choose them in order.",
    () => ({ranks:shuffle(range(5)),pan:[],weighings:[],order:[],sorting:false,tries:2}),
    s => gauge(s.sorting?"Your order":"On the scale",(s.sorting?s.order:s.pan).map(i=>stoneNames[i]).join(" → ")||"Choose a stone")+
      group(...stoneNames.map((name,i)=>control(i,name,"",(s.sorting?s.order:s.pan).includes(i))))+
      group(control("mode",s.sorting?"Return to scale":"Arrange stones"),...(s.sorting?[control("undo","Undo placement","",!s.order.length),control("submit","Submit order","",s.order.length!==5)]:[]))+
      `<ul class="fair-history">${s.weighings.map(line=>`<li>${line}</li>`).join("")}</ul>`,
    (s,key) => {
      if(key==="mode"){s.sorting=!s.sorting;s.pan=[];return;}
      if(key==="undo"){s.order.pop();return;}
      if(key==="submit"){
        if(s.order.length!==5)return;
        if(s.order.every((n,i)=>s.ranks[n]===i))return won(s,"The lapidary records five perfectly graded stones.");
        s.order=[];s.tries--;s.notice="The order was uneven. Check the scale again.";
        if(!s.tries)lost(s,"The merchant’s cart leaves before its stones are graded.");
        return;
      }
      const i=Number(key);
      if(s.sorting){if(!s.order.includes(i))s.order.push(i);return;}
      s.pan.push(i);
      if(s.pan.length===2){
        const [a,b]=s.pan.sort((m,n)=>s.ranks[m]-s.ranks[n]);const reading=stoneNames[a]+" is lighter than "+stoneNames[b]+".";
        if(!s.weighings.includes(reading))s.weighings.push(reading);s.pan=[];s.notice=reading;
      }
    });

  add("kite-run","Cloudlane Regatta",106,
    "Steer the glider through eight gates. Each turn moves you forward one row. Change one lane or hold steady to dodge stormclouds.",
    () => {
      let lane=1;
      const route=range(8).map(()=>{lane=pick([lane-1,lane,lane+1].filter(i=>i>=0&&i<3));return lane;});
      return {lane:1,route,leg:0};
    },
    s => gauge("Gates crossed",s.leg+" / 8")+
      `<div class="fair-flight">${[2,1,0].map(offset=>{const row=s.route[s.leg+offset];return row===undefined?"":tiles(3,range(3).map(i=>tile(row===i?"○":"☁",row===i?"pass":"rock",row===i?"Open lane":"Cloud")));}).join("")}${tiles(3,range(3).map(i=>tile(i===s.lane?"▲":"·",i===s.lane?"player":"")) )}</div>`+
      group(control("left","← Bank left","",s.lane===0),control("hold","↑ Hold lane"),control("right","Bank right →","",s.lane===2)),
    (s,key) => {
      s.lane+=key==="left"?-1:key==="right"?1:0;
      if(s.lane!==s.route[s.leg])return lost(s,"A thunderhead caught the sail. Aim for the open circle directly ahead.");
      s.leg++;if(s.leg===8)won(s,"The glider sails between the finish flags.");
    });

  function traceMirrors(s) {
    let x=-1,y=0,dx=1,dy=0;
    const path=[];
    for(let i=0;i<45;i++){
      x+=dx;y+=dy;
      if(x<0||y<0||x>=3||y>=3)return {hit:x===3&&y===2,path};
      const cell=y*3+x;path.push(cell);
      if(!s.mirrors.includes(cell))continue;
      if(s.slash[cell])[dx,dy]=[-dy,-dx];else [dx,dy]=[dy,dx];
    }
    return {hit:false,path};
  }
  add("mirror-reef","Beacon Mirrors",118,
    "Bring the light from the upper-left entrance to the lower-right exit. Turn a mirror to switch its diagonal. Then fire the beam.",
    () => {
      const bend=pick([0,1,2]),mirrors=[bend,6+bend];
      const extras=shuffle(range(9).filter(i=>i%3!==bend && !(i<3&&i<bend) && !(i>=6&&i>6+bend))).slice(0,3);
      mirrors.push(...extras);
      const slash=range(9).map(()=>Math.random()<.5);slash[bend]=true;
      return {mirrors,slash,path:[],shots:3};
    },
    s => gauge("Light path","Enter → row 1 · exit row 3 →")+
      tiles(3,range(9).map(i=>s.mirrors.includes(i)?control(i,s.slash[i]?"╱":"╲",s.path.includes(i)?"lit":"",false,"Rotate mirror "+(i+1)):tile(s.path.includes(i)?"✧":"·",s.path.includes(i)?"lit":"")))+
      group(control("fire","Fire beacon · "+s.shots+" beams left")),
    (s,key) => {
      if(key!=="fire"){s.slash[Number(key)]=!s.slash[Number(key)];s.path=[];return;}
      const beam=traceMirrors(s);s.path=beam.path;
      if(beam.hit)return won(s,"The harbor beacon flashes across the reef.");
      s.shots--;s.notice="The lit squares show where the beam went astray.";
      if(!s.shots)lost(s,"The beacon battery needs recharging.");
    });

  const riverNodes=[[18,17],[79,23],[23,76],[83,74],[48,32]];
  const bridgeLayouts=[
    [[0,1],[1,3],[3,2],[2,0],[0,4],[4,1],[1,2]],
    [[0,1],[1,3],[3,2],[2,0],[3,4],[4,1],[1,2]],
    [[0,2],[2,3],[3,1],[1,0],[2,4],[4,3],[3,0]]
  ];
  function wireChart(s) {
    const lines=s.edges.map(([a,b],i)=>`<line x1="${riverNodes[a][0]}" y1="${riverNodes[a][1]}" x2="${riverNodes[b][0]}" y2="${riverNodes[b][1]}" class="${s.used.includes(i)?"crossed":""}"/>`).join("");
    const posts=riverNodes.map(([x,y],i)=>`<circle cx="${x}" cy="${y}" r="7" class="${s.at===i?"here":""}"/><text x="${x}" y="${y+2.6}">${"ABCDE"[i]}</text>`).join("");
    return `<svg class="fair-wire" viewBox="0 0 100 98" role="img" aria-label="Bridge network. Crossed bridges are dashed.">${lines}${posts}</svg>`;
  }
  add("bridge-oath","Seven-Bridge Circuit",132,
    "Walk every bridge exactly once. Choose the next connected post. A dashed bridge has already been crossed.",
    () => {
      const edges=pick(bridgeLayouts),odd=range(5).filter(n=>edges.filter(e=>e.includes(n)).length%2);
      return {edges,at:pick(odd),used:[]};
    },
    s => gauge("Bridges crossed",s.used.length+" / "+s.edges.length)+wireChart(s)+
      group(...range(5).filter(n=>n!==s.at&&s.edges.some((e,i)=>!s.used.includes(i)&&e.includes(s.at)&&e.includes(n))).map(n=>control(n,"Walk to "+"ABCDE"[n]))),
    (s,key) => {
      const next=Number(key),edge=s.edges.findIndex((e,i)=>!s.used.includes(i)&&e.includes(s.at)&&e.includes(next));
      if(edge<0)return;s.at=next;s.used.push(edge);
      if(s.used.length===s.edges.length)won(s,"You completed the bridge keeper’s entire circuit.");
      else if(!s.edges.some((e,i)=>!s.used.includes(i)&&e.includes(next)))lost(s,"Every bridge from this post is spent, with more crossings still ahead.");
    });

  add("bell-stack","Belfry Transfer",147,
    "Move all three bells to the east spindle in ten moves. Lift one top bell at a time. A larger bell cannot rest on a smaller one.",
    () => ({stacks:[[3,2,1],[],[]],held:null,moves:0}),
    s => gauge("Moves left",10-s.moves)+tiles(3,s.stacks.map((stack,i)=>control(i,
      `<span class="fair-bells">${[...stack].reverse().map(size=>`<i style="width:${size*25}%">${size}</i>`).join("")}</span>${["West","Center","East"][i]}`,
      s.held===i?"lit":"",s.held===null&&!stack.length)))+
      (s.held!==null?group(control("cancel","Put down selected bell")):""),
    (s,key) => {
      if(key==="cancel"){s.held=null;return;}
      const i=Number(key);
      if(s.held===null){s.held=i;s.notice="Choose a destination spindle.";return;}
      if(s.held===i){s.held=null;s.notice="";return;}
      const origin=s.stacks[s.held],bell=origin.at(-1),top=s.stacks[i].at(-1);
      if(top!==undefined&&bell>top){s.notice="That bell is too wide to rest on this one.";return;}
      origin.pop();s.stacks[i].push(bell);s.held=null;s.moves++;s.notice="";
      if(s.stacks[2].length===3)won(s,"The eastern belfry rings across the trail.");
      else if(s.moves===10)lost(s,"The belfry doors close at dusk.");
    });

  // Each request has its own owner, delivery, and evidence. Lifetime milestones carry over on acceptance.
  const quests=[];
  function quest(id,name,region,requester,description,kind,target,amount=1) {
    quests.push({id,name,region,requester,description,kind,target,amount});
  }
  quest("lantern-watch","Lights for the Night Watch",0,"Mira, lamplighter",
    "Four firefly jars went dark along the cottage lane. Mira needs the right pairs to coax them alight again.","game","firefly-pairs");
  quest("bell-blossom","A Bell for the Nursery",0,"Pip, nursery hand",
    "Pip’s seedlings wilt before a storm. A Mossbell’s tiny flowers ring before the rain comes. Bring one into your collection.","species","mossbell");
  quest("ash-ledger","The Kiln Keeper’s Ledger",1,"Orro, charcoal burner",
    "The kiln crew pays for lessons with a round of Last Ember. Beat the keeper twice to earn a place at the hearth.","game","coal-share",2);
  quest("river-pilot","A Pilot for the Mailboat",2,"Elna, ferrymaster",
    "The mailboat lost its oars. Elna will reopen the run once you find a companion that knows Raftwake.","ability","Raftwake");
  quest("four-corners","Postmarks in Green Ink",3,"Saff, post runner",
    "Saff is reopening the old post road. Collect village postmarks by visiting each of the four settlements on her route.","route",[0,1,2,3]);
  quest("night-shift","A Pillow by the Fire",5,"Dory, innkeeper",
    "Dory is testing the new camp mattresses. Rest your team at camp three times and report how they slept.","rests",null,3);
  quest("spring-vial","A Measure for Dry Roots",7,"Wick, gardener",
    "The nursery’s last sapling needs exactly four cups of water. Ask the sluice keeper for the two measuring jugs.","game","sluice");
  quest("moth-signal","Cinders in the Storm",9,"Rilka, signal tender",
    "Rain keeps putting out the signal tower. A Coalmoth can keep watch with its glowing wing spots. Befriend one for Rilka.","species","coalmoth");
  quest("many-footprints","Twelve Sets of Tracks",12,"Ashwin, track caster",
    "Ashwin makes casts of the prints outside camp. Let him study the tracks of twelve different companions.","owned",null,12);
  quest("sky-letter","A Letter for the Loft",16,"Fen, loft keeper",
    "A love letter has been sitting beneath the loft for a week. Find a companion with Cloudlift to carry it up.","ability","Cloudlift");
  quest("woven-history","The Weaver’s Witness",17,"Oma Threadfin",
    "Oma does not write down her family patterns. Reproduce one festival ribbon at her loom so the pattern survives.","game","loom");
  quest("ledger-plates","The Surveyor’s Plates",20,"Talli, field engraver",
    "Talli wants sketches of local creatures she has never handled. Befriend two different wild species that live in this region.","local",20,2);
  quest("safe-crossing","No Teeth on the Ferry",23,"Harri, harbor cook",
    "Harri has a feast to deliver, a restless bun, and a hungry fox. Bring every passenger safely over the narrow ferry.","game","ferry");
  quest("chalk-line","Beyond the Chalk Line",26,"Kiva, stonemason",
    "A landslide buried Kiva’s old boundary marker. Bring a companion with Stonecleave so she can cut a path.","ability","Stonecleave");
  quest("six-pressings","The Crest Rubbings",32,"Edric, archivist",
    "Edric’s book has six blank rubbings. Earn six different Warden crests for him to study.","crests",null,6);
  quest("cart-call","The Cartwright’s Whistle",37,"Della, cartwright",
    "A quarry train cannot leave until its wagons are coupled in order. Set the switchyard carts right.","game","tile-cart");
  quest("far-tides","Songs for Unquiet Water",40,"Marn, reed singer",
    "A great sleeper is stirring near the floodgate. Find a companion with Lullsong before the next tide.","ability","Lullsong");
  quest("fish-supper","The Cook’s Silver Catch",44,"Ira, supper cook",
    "The inn promised fresh reedfish for two village suppers. Bring in two successful rounds at the casting channel.","game","reed-cast",2);
  quest("star-index","Margins for a New Atlas",48,"Rhea, illustrator",
    "Rhea needs sixty species entries before she can bind the first field-guide volume. Encounters and recruits both add entries.","seen",null,60);
  quest("coal-road","The Long Courier Run",53,"Lark, route marshal",
    "Lark lost the old courier map. Revisit the three way stations on his list and certify their trail marks.","route",[37,52,57]);
  quest("quiet-bolts","A Gentle Warm-Up",58,"Brina, sparring tutor",
    "Brina’s students need an experienced partner. Show a record of twenty victories against wild kin or Wardens.","wins",null,20);
  quest("prism-first","Three Tumblers and a Promise",60,"Ilva, locksmith",
    "Ilva sealed her sister’s heirloom behind a three-gem code. Use the Prism Vault’s pins and glints to open it.","game","gem-vault");
  quest("lamplife","Light without Oil",65,"Noll, cavern painter",
    "Lamp smoke blackens Noll’s cave paintings. Bring a companion with Glowpath to light the stone for her.","ability","Glowpath");
  quest("stone-poem","A Word under Rain",68,"Edda, epigraphist",
    "An old inscription is washing away. Restore one tablet in Weatherworn Words for Edda’s archive.","game","glyph-word");
  quest("double-weave","Two Threads in One",74,"Arun, naturalist",
    "Arun studies creatures that express two affinities at once. Befriend eight different dual-affinity Wilderkin.","dual",null,8);
  quest("reed-song","Across the Lily Pads",76,"Jem, marsh guide",
    "The marsh chorus has split into two frog families. Help the green and blue singers trade nesting banks.","game","frog-cross");
  quest("winter-trail","A Footbridge of Frost",82,"Toma, bridgewright",
    "Toma’s winter travelers have arrived early. Find a companion that knows Frostspan to make the crossing.","ability","Frostspan");
  quest("deep-bores","Flags for the Drill Crew",85,"Osa, ground engineer",
    "Steam pockets keep bursting beneath the old drilling rig. Mark all three vents in the Steam Survey.","game","vent-survey");
  quest("seven-notes","Seven Affinities in Chorus",91,"Vessa, choir leader",
    "Vessa hears a different overtone in every elemental family. Bring companions representing seven distinct affinities.","types",null,7);
  quest("stone-guild","A Merchant’s Honest Measure",95,"Bela, gem merchant",
    "Someone mixed the labels on Bela’s stones. Order the five weights correctly at the lapidary’s scale.","game","stone-scale");
  quest("plateau-almanac","One Hundred Haven Marks",100,"Miro, almanac editor",
    "Miro is printing a guide for travelers. Send him a trail journal containing visits to one hundred different regions.","visited",null,100);
  quest("glider-licence","Regatta Pilot",106,"Yori, sailmaker",
    "Yori wants the new glider tested by a real pilot. Bring it through every cloud gate in the regatta.","game","kite-run");
  quest("new-neighbors","Strangers at the Salt Lick",114,"Tess, field medic",
    "Three unfamiliar species have left tracks by the salt lick. Befriend three of the kin found in this region.","local",114,3);
  quest("mirror-mail","Letters from the Harbor",118,"Ren, lighthouse keeper",
    "Ships offshore are waiting for Ren’s reply. Turn the mirrors until the beacon fires out of the harbor.","game","mirror-reef");
  quest("fair-passport","A Passport in Many Inks",125,"Neri, fair inspector",
    "Neri is collecting stamps from different fair hosts. Complete twelve distinct mini-games to fill the passport.","fairs",null,12);
  quest("last-bridges","The Seven-Bridge Promise",132,"Pera, bridge keeper",
    "Pera’s grandfather swore he once crossed every bridge in a single circuit. Trace that walk for her.","game","bridge-oath");
  quest("caravan-colors","The Traveling Menagerie",140,"Uli, caravan steward",
    "Uli wants a broad survey before opening the wandering menagerie. Befriend one hundred different species.","owned",null,100);
  quest("bells-east","Bells for a New Morning",147,"Caro, bell founder",
    "Move the three nested bells onto the east spindle. Caro wants their first notes to greet the rising sun.","game","bell-stack");
  quest("keeper-gathering","The Wardens’ Reunion",149,"Ansa, lodge steward",
    "Ansa has set thirty places at the reunion table. Bring crests from every Warden to complete the guest book.","crests",null,30);

  function progress(q,state) {
    const game=window.WilderGame;
    const owns=new Set(state.party.map(p=>p.id));
    let current=0,total=q.amount,label="";
    switch(q.kind){
      case "game": {
        const activity=games.find(item=>item.id===q.target);
        current=state.clears?.[q.target]||0;label="Clear "+activity.name+(total>1?" "+total+" times":"");break;
      }
      case "species": current=Number(owns.has(q.target));label="Befriend "+game.species[q.target].name;break;
      case "ability": current=Number([...owns].some(id=>game.species[id]?.ability===q.target));label="Befriend a companion with "+q.target;break;
      case "route": {
        const unseen=q.target.filter(i=>!state.visited.includes(i));
        total=q.target.length;current=total-unseen.length;
        label=unseen.length?"Visit "+unseen.map(i=>game.regions[i].name).join(", "):"All route marks collected";break;
      }
      case "local": {
        const pool=window.WilderKinDex.encounterPools[q.target];current=pool.filter(id=>owns.has(id)).length;
        label="Befriend "+total+" local species in "+game.regions[q.target].name;break;
      }
      case "rests":current=state.rests||0;label="Rest your party at camp";break;
      case "owned":current=owns.size;label="Befriend different species";break;
      case "crests":current=state.crests.length;label="Earn different Warden crests";break;
      case "seen":current=state.seen.length;label="Discover different species";break;
      case "wins":current=state.wins;label="Win battles";break;
      case "dual":current=[...owns].filter(id=>game.species[id]?.types.length>1).length;label="Befriend dual-affinity species";break;
      case "types":current=new Set([...owns].flatMap(id=>game.species[id]?.types||[])).size;label="Collect different affinities";break;
      case "visited":current=state.visited.length;label="Visit different regions";break;
      case "fairs":current=games.filter(item=>(state.clears?.[item.id]||0)>0).length;label="Clear different mini-games";break;
    }
    return {current:Math.min(current,total),total,label};
  }

  window.WilderActivities={games,quests,progress};
})();
