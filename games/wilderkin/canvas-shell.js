// The canvas owns the visible game surface, hit areas and focus order. Game state lives in the engine.
(() => {
  "use strict";
  const C = {
    paper:"#f5f2e6", sheet:"#fffdf3", ink:"#243d31", secondary:"#54675b", faint:"#738273",
    line:"#bfc8b4", pale:"#e9eddd", forest:"#203e32", deep:"#18342b", moss:"#47765a",
    gold:"#e9b95e", cream:"#fff1c7", brass:"#967339", bark:"#775b3c", red:"#a94c3e"
  };
  const affinity = {
    Grove:["#4b7943","#a3c36e"], Ember:["#c65130","#ffc566"], Tide:["#43859b","#a0e7db"],
    Vane:["#40877d","#c9efe1"], Arc:["#b5821d","#ffeb90"], Loam:["#926744","#d7a36f"],
    Rime:["#578da8","#d8f7fc"], Gloam:["#77538c","#cfb0e8"], Chime:["#b26993","#fbd3e9"],
    Alloy:["#627789","#dce6e8"], Neutral:["#846e52","#fbe3a6"]
  };
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const clamp = (v,low,high) => Math.max(low,Math.min(high,v));
  const pi = Math.PI;
  const rightFacing=new Set(["art/sprigkit.png","art/glimmeray.png","art/dewfin.png","art/coalmoth.png","art/growth/brackenveil.png","art/growth/rillwarden.png"]);
  const getFont = (size,kind="body",weight=500) => `${weight} ${size}px ${kind==="title" ? 'Pixelify, monospace' : kind==="mono" ? 'monospace' : '"DM Sans", system-ui, sans-serif'}`;
  const inside = (x,y,r) => x>=r.x && x<r.x+r.w && y>=r.y && y<r.y+r.h;
  function rect(c,x,y,w,h,fill,stroke) {
    if (w<=0 || h<=0) return;
    c.fillStyle=fill; c.fillRect(x,y,w,h);
    if(stroke){c.strokeStyle=stroke;c.lineWidth=1;c.strokeRect(x+.5,y+.5,w-1,h-1);}
  }
  function line(c,x1,y1,x2,y2,color,width=1) {
    c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.stroke();
  }
  function ellipse(c,x,y,rx,ry,fill,stroke,width=1) {
    if(rx<=0 || ry<=0)return;
    c.beginPath();c.ellipse(x,y,rx,ry,0,0,2*pi);
    if(fill){c.fillStyle=fill;c.fill();}
    if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}
  }
  function poly(c,coords,color) {
    c.beginPath();coords.forEach(([x,y],i)=>i ? c.lineTo(x,y) : c.moveTo(x,y));
    c.closePath();c.fillStyle=color;c.fill();
  }
  function label(c,text,x,y,size=15,color=C.ink,kind="body",weight=500,align="left") {
    c.font=getFont(size,kind,weight);c.fillStyle=color;c.textAlign=align;c.textBaseline="top";c.fillText(String(text??""),x,y);
    c.textAlign="left";
  }
  function fit(c,text,width) {
    text=String(text??"");
    if(c.measureText(text).width<=width)return text;
    while(text && c.measureText(text+"…").width>width)text=text.slice(0,-1);
    return text+"…";
  }
  function wrap(c,value,width) {
    const lines=[];
    for(const paragraph of String(value??"").split("\n")){
      let pending="";
      for(const word of paragraph.split(/\s+/).filter(Boolean)){
        const expanded=pending ? pending+" "+word : word;
        if(c.measureText(expanded).width<=width){pending=expanded;continue;}
        if(pending){lines.push(pending);pending="";}
        for(const letter of word){
          if(pending && c.measureText(pending+letter).width>width){lines.push(pending);pending="";}
          pending+=letter;
        }
      }
      lines.push(pending);
    }
    return lines;
  }
  function paragraph(c,lines,x,y,size,leading,color=C.secondary,kind="body",weight=500) {
    lines.forEach((s,i)=>label(c,s,x,y+i*leading,size,color,kind,weight));
    return lines.length*leading;
  }
  function star(c,x,y,r,color) {
    poly(c,[[x,y-r],[x+r*.24,y-r*.24],[x+r,y],[x+r*.24,y+r*.24],[x,y+r],[x-r*.24,y+r*.24],[x-r,y],[x-r*.24,y-r*.24]],color);
  }
  function crest(c,x,y,size,color,secondary) {
    c.save();c.translate(x,y);c.scale(size/24,size/24);
    poly(c,[[12,1],[21,5],[21,14],[17,20],[12,23],[6,19],[3,14],[3,5]],color);
    poly(c,[[12,4],[18,7],[18,13],[15,17],[12,19],[8,16],[6,13],[6,7]],secondary);
    star(c,12,11.5,5,color);c.restore();
  }
  // Small pixel-cut symbols remain legible at footer and touch-menu sizes.
  const patterns = {
    expedition:["00010000","00111000","01101100","11010110","10010001","11111111","00000000"],
    map:["00100010","11110111","10111101","10100101","10100101","10111101","11100111"],
    book:["11100111","10011001","10111101","10011001","10111101","10011001","11100111"],
    bag:["00111100","01100110","11111111","11000011","11111111","11011011","01111110"],
    quest:["00111110","01100010","01011010","01000010","01011010","11000010","01111100"],
    games:["11000011","11111111","11011011","11111111","01100110","00100100","00111100"],
    camp:["00010000","00111000","00111010","01111110","11111111","01111110","11000011"],
    kin:["01100110","11000011","00111100","01111110","11111111","11111111","01100110"],
    menu:["11111111","11111111","00000000","11111111","11111111","00000000","11111111"],
    back:["00011000","00110000","01100000","11111111","01100000","00110000","00011000"],
    leaf:["00001111","00111111","01111110","11111100","01111000","00110000","01100000"],
    sound:["00010000","00110010","11110101","11110101","11110101","00110010","00010000"],
    help:["00111100","01000110","00001100","00011000","00010000","00000000","00010000"],
    settings:["00111100","10100101","11000011","11011011","11000011","10100101","00111100"],
    home:["00011000","00111100","01111110","11111111","01100110","01100110","01111110"]
  };
  function symbol(c,key,x,y,size,color) {
    const k=String(key||"").toLowerCase();
    const aliases={station:"camp",explore:"home",chronicle:"book",atlas:"map",backpack:"bag",inventory:"bag",satchel:"bag",journal:"quest",quests:"quest",story:"book","field-guide":"book",guide:"book",party:"kin",adventure:"home",world:"map",activities:"games",fairs:"games",shortcuts:"menu",locations:"map",items:"bag"};
    const marks=patterns[aliases[k]||k];
    if(!marks){star(c,x+size/2,y+size/2,size*.42,color);return;}
    c.fillStyle=color;
    const unit=size/8;
    marks.forEach((row,iy)=>[...row].forEach((px,ix)=>{if(px==="1")c.fillRect(Math.round(x+ix*unit),Math.round(y+iy*unit),Math.ceil(unit),Math.ceil(unit));}));
  }

  function create(canvas,handlers={}) {
    const c=canvas.getContext("2d",{alpha:false});
    const ground=document.createElement("canvas");
    ground.width=384;ground.height=208;
    const images=new Map();
    const paperStamp=document.createElement("canvas");paperStamp.width=paperStamp.height=9;
    const pc=paperStamp.getContext("2d");rect(pc,0,0,9,9,C.paper);rect(pc,5,5,1,1,"#46633f12");
    const paper=c.createPattern(paperStamp,"repeat");
    const mirror=document.createElement("section");
    const live=document.createElement("div");
    mirror.className=live.className="wilder-assist";
    mirror.setAttribute("aria-label","Game controls");live.setAttribute("role","status");live.setAttribute("aria-live","polite");
    canvas.after(mirror,live);
    canvas.tabIndex=0;
    canvas.setAttribute("role","application");
    canvas.setAttribute("aria-label","Wilderkin adventure. Press Tab to select, Enter to act, or F1 to open the trail menu.");
    let model={id:"loading",kind:"page",title:"Wilderkin",sections:[]};
    let width=0,height=0,ratio=1,frame=0,lastPaint=0,dirty=true,scroll=0,limit=0;
    let hits=[],focus="",hover="",pointer=null,menu=false,menuScroll=0,menuLimit=0,menuClip=null;
    let arenaRect=null,lastPage=0,fx=null,notice=null,header=58,footer=50,clipTop=58,clipBottom=0;
    let passedLeads={};
    let mirrorSig="",destroyed=false;
    const surface = {get busy(){return Boolean(fx);},show,animate,toast,invalidate:()=>{dirty=true;},destroy};
    const twinField=window.WilderTwinField?.create({c,rect,ellipse,label,getFont,fit,source,picture,rightFacing,control,highlighted});
    function source(src){
      if(!src)return null;
      if(typeof src!=="string")return src;
      if(!images.has(src)){
        const im=new Image();im.onload=()=>{dirty=true;};im.onerror=()=>{dirty=true;};
        im.src=src;images.set(src,im);
      }
      const im=images.get(src);
      return im.complete && im.naturalWidth ? im : null;
    }
    function picture(src,x,y,w,h,mode="contain",flip=false,focusY=.5) {
      const im=source(src);
      if(!im || !w || !h)return;
      const iw=im.naturalWidth||im.width,ih=im.naturalHeight||im.height;
      if(!iw || !ih)return;
      const scale=mode==="cover"?Math.max(w/iw,h/ih):Math.min(w/iw,h/ih);
      const dw=Math.max(1,Math.round(iw*scale)),dh=Math.max(1,Math.round(ih*scale));
      const dx=Math.round(x+(w-dw)/2),dy=Math.round(y+(h-dh)*focusY);
      c.save();c.beginPath();c.rect(x,y,w,h);c.clip();c.imageSmoothingEnabled=false;
      if(flip){c.translate(dx+dw,dy);c.scale(-1,1);c.drawImage(im,0,0,dw,dh);}
      else c.drawImage(im,dx,dy,dw,dh);
      c.restore();
    }
    function shortcutList(){return typeof handlers.shortcuts==="function" ? handlers.shortcuts() : handlers.shortcuts||[];}
    function resize() {
      const b=canvas.getBoundingClientRect();
      width=Math.max(1,Math.round(b.width));height=Math.max(1,Math.round(b.height));
      ratio=clamp(window.devicePixelRatio||1,1,2);
      canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);
      dirty=true;
    }
    const observer=new ResizeObserver(resize);observer.observe(canvas);resize();
    const fonts=document.fonts;
    if(fonts)Promise.all([fonts.load('600 26px Pixelify'),fonts.load('500 15px "DM Sans"')]).then(()=>{dirty=true;});
    function control(row,x,y,w,h,area="content",activate) {
      if(!row || (!row.id && !activate))return null;
      const uid=(row.uid??[area,row.id,typeof row.value==="object" ? JSON.stringify(row.value) : row.value,row.label].join("|"));
      const hit={x,y,w,h,uid,area,row,activate,disabled:Boolean(row.disabled)};
      hits.push(hit);
      return hit;
    }
    function highlighted(hit){return hit && !hit.disabled && (hit.uid===hover || hit.uid===focus);}
    function activeControl(row,cb) {
      if(fx || !row || row.disabled)return;
      if(cb){cb();return;}
      if(typeof row.onClick==="function")row.onClick();
      else handlers.action?.(row.id,row.value);
    }
    function run(hit) {
      if(hit && !hit.disabled){activeControl(hit.row,hit.activate);dirty=true;}
    }
    function show(next) {
      if(!next)return;
      if(next.id!==model.id || next.kind!==model.kind){
        scroll=0;focus="";hover="";lastPage=performance.now();
      }
      twinField?.update(next.twinField);model=next;passedLeads={};menu=false;dirty=true;
      // Update controls synchronously so a screen reader can follow each transition.
      render(performance.now());
      if(next.twinField?.focus&&next.subtitle&&live.textContent!==next.subtitle)live.textContent=next.subtitle;
    }
    function toast(value){
      const text=String(value||"");
      if(!text)return;
      notice={text,until:performance.now()+Math.max(3300,Math.min(7200,text.length*60))};
      live.textContent=text;dirty=true;
    }
    const pulse=t=>reduced.matches?0:Math.sin(t*.002);
    function edge(x,y,w,h,hot=false){
      rect(c,x,y,w,h,hot?"#ecf1e0":C.sheet,hot?C.moss:C.line);
      if(hot)rect(c,x,y,3,h,C.moss);
    }
    function keycap(text,x,y,dark=false){
      const key=String(text||"");
      if(!key)return 0;
      c.font=getFont(10,"mono",700);const w=Math.max(18,c.measureText(key).width+10);
      rect(c,x,y,w,18,dark?"#354f40":"#e5e8d8",dark?"#6e8471":"#bbc5af");
      label(c,key,x+w/2,y+3,10,dark?"#ecedd5":C.forest,"mono",700,"center");
      return w;
    }
    function button(row,x,y,w,h=40,area="content",cb) {
      const hit=control(row,x,y,w,h,area,cb),hot=highlighted(hit);
      const primary=!row.disabled&&row.tone==="primary",danger=!row.disabled&&row.tone==="danger";
      const fill=row.disabled?"#e6e7dc":primary?(hot?"#416e50":C.forest):hot?"#edf2dc":danger?"#f7e6dc":C.sheet;
      rect(c,x,y,w,h,fill,primary?C.forest:hot?C.moss:C.line);
      const ink=row.disabled?"#7e887b":primary?"#fff7d8":danger?C.red:C.ink;
      c.font=getFont(14,"body",650);
      label(c,fit(c,row.label,w-16),x+w/2,y+(h-17)/2,14,ink,"body",650,"center");
      return hit;
    }
    function shellHeader() {
      rect(c,0,0,width,header,C.deep);rect(c,0,header-2,width,2,"#b29f61");
      const margin=width<560?14:Math.max(22,(width-1392)/2);
      const back=model.back;
      let bx=margin;
      if(back){
        const hit=control({...back,label:back.label||"Back"},bx,7,38,header-16,"header");
        rect(c,bx,11,32,32,highlighted(hit)?"#47694f":"#2a4738","#526e56");
        symbol(c,"back",bx+9,20,14,C.cream);bx+=44;
      }
      picture("ui/wilderkin.png",bx,9,37,header-21);
      label(c,"Wilderkin",bx+41,Math.max(8,(header-31)/2),29,"#fff1c9","title",700);
      const menuW=width<410?73:104,mx=width-margin-menuW;
      const hit=control({id:"$menu",label:menu?"Close menu":"Trail menu"},mx,9,menuW,header-19,"header",toggleMenu);
      rect(c,mx,10,menuW,header-21,highlighted(hit)?"#52684a":"#324e3c","#6a8064");
      symbol(c,"menu",mx+10,(header-12)/2,12,C.cream);label(c,width<410?"Menu":"Trail menu",mx+29,(header-16)/2,13,C.cream,"body",700);
      if(width>770 && model.status){
        c.font=getFont(12,"mono",600);
        const status=fit(c,model.status,Math.min(width*.38,430));
        label(c,status,mx-18,(header-16)/2,12,"#c7d4b8","mono",600,"right");
      }
    }
    function toggleMenu(){
      if(fx)return;
      menu=!menu;menuScroll=0;focus="";dirty=true;render(performance.now());
    }
    function dock() {
      const items=shortcutList(),mobile=width<720;
      const shown=items.slice(0,mobile?4:Math.min(8,Math.max(4,Math.floor(width/130))));
      const y=height-footer;
      rect(c,0,y,width,footer,C.forest);rect(c,0,y,width,1,"#76916e");
      if(!shown.length)return;
      const cell=Math.min((width-12)/shown.length,154);
      const start=(width-cell*shown.length)/2;
      shown.forEach((item,i)=>{
        const x=start+i*cell,hit=control(item,x,y+3,cell,footer-4,"dock");
        const route=item.id==="nav" ? item.value : item.id;
        const here=model.id?.split(":")[0]===route || model.nav===route;
        if(highlighted(hit)||here)rect(c,x+2,y+4,cell-4,footer-7,"#36533f");
        if(here)rect(c,x+10,y+2,cell-20,2,C.gold);
        const ink=item.disabled?"#a2ac99":here?C.cream:"#e4ead7";
        if(mobile){
          symbol(c,item.icon||(item.id==="nav"?item.value:item.id),x+cell/2-7,y+7,14,here?C.gold:ink);
          c.font=getFont(11,"body",650);label(c,fit(c,item.label,cell-6),x+cell/2,y+26,11,ink,"body",650,"center");
        }else{
          const key=item.key?String(item.key).toUpperCase():"";
          const keyW=key?22:0;
          c.font=getFont(13,"body",650);
          const name=fit(c,item.label,cell-38-keyW);
          const total=c.measureText(name).width+22+keyW;
          const left=x+(cell-total)/2;
          symbol(c,item.icon||(item.id==="nav"?item.value:item.id),left,y+footer/2-7,14,here?C.gold:ink);
          label(c,name,left+21,y+footer/2-9,13,ink,"body",650);
          if(key)keycap(key,left+total-keyW+2,y+footer/2-10,true);
        }
      });
    }
    function titleBlock(x,y,w,hasArt=false) {
      const narrow=width<650;
      let ty=y;
      if(model.kicker){
        star(c,x+5,ty+6,5,C.brass);c.font=getFont(11,"mono",700);
        label(c,fit(c,String(model.kicker).toUpperCase(),w-20),x+17,ty,11,C.moss,"mono",700);ty+=19;
      }
      const size=narrow?30:hasArt?41:43;
      c.font=getFont(size,"title",700);
      const lines=wrap(c,model.title,w);
      ty+=paragraph(c,lines,x,ty-2,size,size+1,C.ink,"title",700)+3;
      if(model.subtitle){
        c.font=getFont(narrow?14:15,"body",500);
        ty+=paragraph(c,wrap(c,model.subtitle,w),x,ty,narrow?14:15,narrow?19:21)+3;
      }
      return ty-y;
    }
    function hpBar(x,y,w,p) {
      const percent=clamp(Number(p.hp)/Math.max(1,Number(p.maxHp))||0,0,1);
      rect(c,x,y,w,6,"#d7ddca");
      rect(c,x,y,w*percent,6,percent<.25?"#b3624b":percent<.5?"#bc9851":"#64915c");
      if(w*percent>2)rect(c,x,y,w*percent,1,percent<.25?"#db9e7f":"#93b078");
    }
    function party(x,y,w,partyRows,t) {
      const rows=partyRows||[];if(!rows.length)return 0;
      const cell=width<650?56:65;
      const h=46+rows.length*cell+6;
      rect(c,x,y,w,h,C.sheet,C.line);
      rect(c,x,y,w,4,C.moss);symbol(c,"kin",x+15,y+18,15,C.moss);
      label(c,"Traveling party",x+39,y+10,23,C.ink,"title",650);
      label(c,String(rows.length)+" / 6",x+w-15,y+20,11,C.faint,"mono",600,"right");
      rows.forEach((p,i)=>{
        const yy=y+45+i*cell;
        const row={...p,label:p.name||p.label};
        const hit=control(row,x+4,yy,w-8,cell-1);
        if(highlighted(hit))rect(c,x+4,yy,w-8,cell-1,C.pale);
        if(i)line(c,x+13,yy,x+w-13,yy,"#dde0d2");
        const size=cell-9;
        picture(p.src||p.image,x+10,yy+3+pulse(t+i*340),size,size);
        const tx=x+size+19,tw=w-(tx-x)-13;
        c.font=getFont(19,"title",650);label(c,fit(c,row.label,tw-44),tx,yy+5,19,C.ink,"title",650);
        label(c,"Lv "+p.level,x+w-13,yy+10,11,C.secondary,"mono",650,"right");
        const types=Array.isArray(p.types)?p.types.join(" · "):p.types||"";
        if(types)label(c,types,tx,yy+26,10,C.moss,"mono",650);
        const v=String(p.hp)+"/"+p.maxHp;
        c.font=getFont(10,"mono",650);
        const hpW=Math.max(18,tw-c.measureText(v).width-7);
        hpBar(tx,yy+cell-15,hpW,p);
        label(c,v,x+w-13,yy+cell-19,10,C.secondary,"mono",650,"right");
      });
      return h;
    }
    function questBox(q,x,y,w) {
      if(!q)return 0;
      const compact=w<400,sz=q.illustrations?(compact?56:74):(compact?33:43),tx=x+sz+26,tw=Math.max(70,w-sz-47);
      c.font=getFont(22,"title",650);const titles=wrap(c,q.title,tw);
      c.font=getFont(13,"body",500);const lines=q.description?wrap(c,q.description,tw):[];
      const h=28+titles.length*22+lines.length*18+13;
      const hit=control({...q,label:q.title},x,y,w,h);
      rect(c,x,y,w,h,highlighted(hit)?"#f6e4b4":"#f8edce","#bda770");
      rect(c,x,y,4,h,"#b99047");
      if(q.illustrations){
        const d=Math.round(sz*.58),top=y+(h-sz)/2;
        picture(q.illustrations[0],x+10,top,d,d);
        picture(q.illustrations[1],x+14+sz-d,top+3,d,d);
        picture(q.illustrations[2],x+12+(sz-d)/2,top+sz-d,d,d);
      }else picture("ui/quest.png",x+12,y+(h-sz)/2,sz,sz);
      label(c,q.kicker||"CURRENT QUEST",tx,y+9,10,"#836832","mono",700);
      const dy=paragraph(c,titles,tx,y+23,22,22,C.ink,"title",650);
      paragraph(c,lines,tx,y+25+dy,13,18,"#655e44");
      return h;
    }
    function mapPanel(x,y,w,t) {
      const r=window.WilderWorld?.regions[model.region];
      if(!r)return 0;
      const mh=Math.round((w-6)*r.rows/r.cols),h=mh+33;
      rect(c,x,y,w,h,C.forest);rect(c,x+3,y+3,w-6,mh,"#8cab70");
      const player=typeof model.player==="function" ? model.player(t) : model.player||r.spawn;
      window.WilderWorld.draw(ground,model.region,player,reduced.matches?0:t);
      picture(ground,x+3,y+3,w-6,mh);
      const mapHit=control({id:"$tile",label:"Explore map"},x+3,y+3,w-6,mh,"map",()=>handlers.tile?.(Math.round(player.x),Math.round(player.y)));
      mapHit.selectTile=(px,py)=>handlers.tile?.(clamp(Math.floor((px-mapHit.x)*r.cols/mapHit.w),0,r.cols-1),clamp(Math.floor((py-mapHit.y)*r.rows/mapHit.h),0,r.rows-1));
      const caption=y+mh+11;
      symbol(c,"map",x+12,caption+1,13,"#d9ddab");
      label(c,width<640?"Tap a trail to walk":"Click a trail to walk",x+34,caption,12,"#e1e6ca","body",600);
      if(w>460)label(c,"WASD / ↑↓←→   ·   E  Interact",x+w-12,caption,11,"#d8dfc5","mono",500,"right");
      return h;
    }
    function rowHeight(row,w,compact) {
      if(row.height)return row.height;
      const art=row.image||row.src;
      const textW=Math.max(25,w-(art?67:24)-(row.key?27:0));
      c.font=getFont(compact?16:19,"title",650);
      const name=wrap(c,row.label||"",textW);
      c.font=getFont(13,"body",500);
      const detail=row.detail?wrap(c,row.detail,textW):[];
      return Math.max(42,(art?59:0),16+name.length*(compact?18:21)+detail.length*17+(row.badge?16:0));
    }
    function drawRow(row,x,y,w,h,t,compact=false) {
      if(!row)return;
      const hit=control(row,x,y,w,h),hot=highlighted(hit);
      const primary=!row.disabled&&row.tone==="primary",muted=row.disabled||row.tone==="muted";
      let fill=primary?C.forest:hot?"#edf2df":muted?"#eeefe4":C.sheet;
      if(!row.disabled&&row.tone==="danger")fill="#f5e4db";
      rect(c,x,y,w,h,fill,hot?C.moss:primary?C.forest:C.line);
      if(hot)rect(c,x,y,3,h,C.gold);
      const art=row.image||row.src;
      let tx=x+12,tw=w-24-(row.key?27:0);
      if(art){
        const side=Math.min(h-9,48);
        picture(typeof art==="string" || art.getContext ? art:art.src,x+7,y+(h-side)/2+pulse(t)*1.4,side,side);
        tx=x+61;tw=w-67-(row.key?27:0);
      }
      if(row.key)keycap(row.key,x+w-29,y+8,primary);
      c.font=getFont(compact?16:19,"title",650);const names=wrap(c,row.label||"",Math.max(25,tw));
      c.font=getFont(13,"body",500);const info=row.detail?wrap(c,row.detail,Math.max(25,tw)):[];
      const lh=compact?18:21,total=names.length*lh+info.length*17+(row.badge?16:0);
      let ty=y+(h-total)/2;
      if(row.badge){
        c.font=getFont(10,"mono",700);label(c,fit(c,String(row.badge).toUpperCase(),tw),tx,ty,10,primary?"#d6dca3":C.moss,"mono",700);ty+=16;
      }
      ty+=paragraph(c,names,tx,ty,compact?16:19,lh,primary?C.cream:muted?C.faint:C.ink,"title",650);
      paragraph(c,info,tx,ty+1,13,17,primary?"#d9e4cc":muted?C.faint:C.secondary);
    }
    function grid(g,x,y,w) {
      const cols=clamp(Math.floor(g.cols||3),1,32),gap=3;
      const jars=model.id==="play:firefly-pairs";
      const maxWidth=Math.min(w,g.width||Math.max(245,cols*(jars?80:64)));
      const left=x+(w-maxWidth)/2,cw=(maxWidth-(cols-1)*gap)/cols;
      const cells=g.cells||[];
      let sy=y;
      const tones={lit:["#f5d783","#66501d"],solved:["#cde0b5","#314e35"],aligned:["#cde0b5","#314e35"],green:["#cde0b5","#314e35"],blue:["#c5dfea","#305765"],player:[C.forest,C.cream],rock:["#abb69a","#4a5a45"],danger:["#f4c8ae","#7b4934"],clue:["#e2e6d6",C.ink],gap:["#f8f7eb",C.ink],pass:["#f8f7eb",C.ink],primary:[C.forest,C.cream]};
      const font=cw<36?12:16;
      for(let first=0;first<cells.length;first+=cols){
        const strip=cells.slice(first,first+cols);
        const spec=strip.map(cell=>{
          const row=typeof cell==="string"?{label:cell}:cell||{};
          c.font=getFont(font,"title",650);
          const labels=wrap(c,row.label??"",Math.max(10,cw-4));
          c.font=getFont(11,"body",500);
          const details=row.detail?wrap(c,row.detail,Math.max(10,cw-4)):[];
          return {row,labels,details};
        });
        const ch=Math.max(g.cellHeight||Math.min(jars?77:50,Math.max(28,cw*(jars?.97:.77))),...spec.map(s=>s.labels.length*(font+1)+s.details.length*13+7));
        spec.forEach(({row,labels,details},i)=>{
          const xx=left+i*(cw+gap),hit=control(row,xx,sy,cw,ch);
          const [fill,ink]=tones[row.tone]||[row.disabled?"#e3e6d8":C.sheet,C.ink];
          rect(c,xx,sy,cw,ch,jars?"#294738":highlighted(hit)?"#f7eac3":fill,highlighted(hit)?C.brass:C.line);
          if(jars){
            const cx=xx+cw/2,cy=sy+ch*.55,unit=Math.max(2,Math.floor(Math.min(cw,ch)/15));
            const open=row.label!=="?",glow=open?(row.tone==="solved"?"#f6df8c":"#f9eeb3"):"#d6c6a1";
            const glass=highlighted(hit)?"#bddbc6":"#86b4a6";
            rect(c,cx-3*unit,cy-5*unit,6*unit,2*unit,open?glass:"#b78450");
            rect(c,cx-2*unit,cy-3*unit,4*unit,unit,glass);
            rect(c,cx-4*unit,cy-2*unit,8*unit,6*unit,glass);
            rect(c,cx-3*unit,cy-unit,6*unit,5*unit,open?"#58725a":"#3b6154");
            rect(c,cx-3*unit,cy+4*unit,6*unit,unit,glass);
            rect(c,cx-3*unit,cy,unit,2*unit,"#d5e3ca");
            label(c,row.label,cx,cy-1.55*unit,Math.max(13,unit*3.8),glow,"body",700,"center");
            return;
          }
          const yy=sy+(ch-labels.length*(font+1)-details.length*13)/2;
          labels.forEach((s,j)=>label(c,s,xx+cw/2,yy+j*(font+1),font,ink,"title",650,"center"));
          details.forEach((s,j)=>label(c,s,xx+cw/2,yy+labels.length*(font+1)+j*13,11,ink,"body",500,"center"));
        });
        sy+=ch+gap;
      }
      return sy-y;
    }
    function section(s,x,y,w,t) {
      if(!s)return 0;
      let sy=y;
      if(s.reveal){
        const m=s.reveal,h=w<520?195:242,sz=h-27,cx=x+w/2,cy=sy+h*.48;
        const phase=reduced.matches?1:clamp((t-m.start)/1150,0,1),tint=affinity[m.type]||affinity.Neutral;
        const gradient=c.createRadialGradient(cx,cy,5,cx,cy,w*.65);
        gradient.addColorStop(0,tint[1]);gradient.addColorStop(1,C.forest);
        c.fillStyle=gradient;c.fillRect(x,sy,w,h);
        c.save();c.beginPath();c.rect(x,sy,w,h);c.clip();
        if(phase<1){c.globalAlpha=1-phase;picture(m.from,cx-sz*.43,cy-sz*.43,sz*.86,sz*.86);}
        c.globalAlpha=phase;picture(m.to,cx-sz/2,cy-sz/2,sz,sz);
        c.globalAlpha=.8;
        for(let i=0;i<16;i++){
          const theta=Math.PI*2*i/16+.15*phase,rad=sz*(.33+phase*.32);
          star(c,cx+Math.cos(theta)*rad,cy+Math.sin(theta)*rad*.64,1.5+(1-phase)*3,tint[1]);
        }
        c.restore();sy+=h+12;
      }
      if(s.growth){
        const g=s.growth,half=w/2,h=w<550?142:185,colors=affinity[g.type]||affinity.Neutral;
        const size=h-31,bob=pulse(t)*2.5;
        rect(c,x,sy,w,h,"#eef0df",C.line);
        for(let i=0;i<2;i++){
          const center=x+(i+.5)*half;
          const gw=Math.min(half-14,size*(i?1:.78));
          ellipse(c,center,sy+h-30,gw*.36,5,colors[1]+"66");
          picture(i?g.to:g.from,center-gw/2,sy+h-29-gw+bob,gw,gw);
          label(c,i?g.toName:g.fromName,center,sy+h-23,15,C.ink,"title",650,"center");
        }
        const mid=x+half,my=sy+h*.52;
        line(c,mid-10,my,mid+10,my,colors[0],2);
        line(c,mid+4,my-5,mid+10,my,colors[0],2);line(c,mid+4,my+5,mid+10,my,colors[0],2);
        sy+=h+10;
      }
      if(s.title){c.font=getFont(21,"title",650);const headings=wrap(c,s.title,w);sy+=paragraph(c,headings,x,sy,21,23,C.ink,"title",650)+5;}
      if(s.text){
        c.font=getFont(15,"body",500);
        sy+=paragraph(c,wrap(c,s.text,w),x,sy,15,22)+8;
      }
      if(s.image){
        const im=typeof s.image==="string"?{src:s.image}:s.image;
        const ih=Math.min(im.height||140,350);
        picture(im.src||im,x,sy,w,ih,im.mode||"contain");sy+=ih+8;
      }
      if(s.draw){
        const h=s.height||145;
        c.save();c.beginPath();c.rect(x,sy,w,h);c.clip();s.draw(c,x,sy,w,h,reduced.matches?0:t);c.restore();
        for(const spot of s.hotspots?.(x,sy,w,h)||[]){
          const hit=control(spot,spot.x,spot.y,spot.w,spot.h);
          if(highlighted(hit)){c.save();c.strokeStyle=C.moss;c.lineWidth=2;c.strokeRect(spot.x+1,spot.y+1,spot.w-2,spot.h-2);c.restore();}
        }
        sy+=h+8;
      }
      if(s.meter){
        const m=s.meter;rect(c,x,sy,w,32,"#77a8a6",C.moss);rect(c,x+w*clamp(m.low/100,0,1),sy+2,w*(m.high-m.low)/100,28,C.gold);
        const value=typeof m.value==="function"?m.value(t):m.value;
        rect(c,x+clamp(value/100,0,1)*(w-4),sy,4,32,C.deep);sy+=40;
      }
      if(s.grid)sy+=grid(s.grid,x,sy,w)+6;
      const rows=s.rows||[];
      const requested=s.columns||1;
      const cols=Math.max(1,Math.min(requested,Math.floor((w+8)/Math.min(185,Math.max(125,w/2-6)))||1));
      const gap=8,cw=(w-gap*(cols-1))/cols;
      for(let i=0;i<rows.length;i+=cols){
        const band=rows.slice(i,i+cols),small=cw<210;
        const h=Math.max(...band.map(row=>rowHeight(row,cw,small)));
        band.forEach((row,col)=>drawRow(row,x+col*(cw+gap),sy,cw,h,t,small));sy+=h+gap;
      }
      return sy-y+9;
    }
    function artPanel(a,x,y,w,t) {
      const h=a.height||Math.min(215,Math.max(115,w*.45)),src=typeof a==="string"?a:a.src;
      rect(c,x,y,w,h,"#e5ecdb",C.line);
      c.save();c.beginPath();c.rect(x+1,y+1,w-2,h-2);c.clip();
      if(model.id?.startsWith("region:") && window.WilderWorld){
        const index=Number(model.id.split(":")[1]),region=window.WilderWorld.regions[index];
        if(region){
          const caption=a.caption?26:0;
          window.WilderWorld.draw(ground,index,{...region.spawn,questActive:false},reduced.matches?0:t);
          rect(c,x,y,w,h,C.forest);
          picture(ground,x+2,y+2,w-4,h-caption-4);
          if(a.caption)label(c,a.caption,x+w/2,y+h-20,11,C.cream,"mono",650,"center");
          c.restore();return h;
        }
      }
      if(a.landscape){
        picture(src,x+1,y+1,w-2,h-2,"cover",false,a.focusY);
        for(let i=0;i<10;i++){
          const xx=x+w*((i*.114+pulse(t+i*170)*.007)%1);
          const yy=y+h*(.33+(i*.197)%0.6)+pulse(t+i*290)*3;
          star(c,xx,yy,1.8,"#f6e9aa");
        }
        c.restore();return h;
      }
      const kinId=model.id?.startsWith("kin:")?model.id.slice(4):null;
      const tint=affinity[window.WilderGame?.species[kinId]?.types[0]];
      if(tint){
        rect(c,x+1,y+1,w-2,h-2,tint[1]+"58");
        for(let layer=0;layer<2;layer++){
          const step=8,shade=tint[0]+(layer?"1c":"10");
          c.beginPath();c.moveTo(x,y+h);
          for(let col=0;col<=w+step;col+=step){
            const slope=Math.sin(col/w*7+layer*2.2)*.05+Math.sin(col/w*12+layer)*.025;
            const yy=Math.round(h*(.55+layer*.18+slope)/3)*3+y;
            c.lineTo(x+col,yy);c.lineTo(x+col+step,yy);
          }
          c.lineTo(x+w+step,y+h);c.closePath();c.fillStyle=shade;c.fill();
        }
      }
      for(let j=0;j<8;j++){
        const xx=x+((j*.171+0.08)%1)*w, yy=y+(j*.237%1)*h;
        star(c,xx,yy+2*pulse(t+j*510),2+.7*pulse(t+j*380),tint?tint[0]+"79":"#b5c9a3");
      }
      const bob=pulse(t)*3;
      ellipse(c,x+w/2,y+h*.79,w*.14,4,"#beccac");
      picture(src,x+8,y+8+bob,w-16,h-(a.caption?37:19));
      if(a.caption){c.font=getFont(11,"mono",650);label(c,fit(c,a.caption,w-18),x+w/2,y+h-22,11,C.secondary,"mono",650,"center");}
      c.restore();return h;
    }
    function lineupStrip(strip,x,y,w){
      const slots=strip.slots;
      if(!slots?.length)return 0;
      const gap=6,cols=Math.min(slots.length,w<570?3:6),cw=Math.floor((w-gap*(cols-1))/cols);
      const cardH=79,top=y+18;
      label(c,strip.label,x,y,12,C.ink,"body",700);
      slots.forEach((slot,index)=>{
        const cx=x+index%cols*(cw+gap),cy=top+Math.floor(index/cols)*(cardH+gap);
        const hit=slot.action&&control({...slot.action,aria:(index+1)+". "+slot.name+(slot.lead?", leader":"")+". "+slot.action.label},cx,cy,cw,cardH);
        rect(c,cx,cy,cw,cardH,hit&&highlighted(hit)?"#efe6c7":slot.lead?"#dfebd5":C.sheet,slot.lead?C.moss:C.line);
        label(c,String(index+1),cx+5,cy+4,10,C.secondary,"mono",600);
        if(slot.lead)label(c,"LEAD",cx+cw-5,cy+4,9,C.moss,"mono",700,"right");
        const size=43;
        c.save();if(slot.hp===0)c.globalAlpha=.5;picture(slot.src,cx+(cw-size)/2,cy+3,size,size);c.restore();
        c.font=getFont(12,"body",700);label(c,fit(c,slot.name,cw-6),cx+cw/2,cy+46,12,C.ink,"body",700,"center");
        label(c,"Lv. "+slot.level,cx+cw/2,cy+61,10,C.secondary,"mono",550,"center");
        if(slot.maxHp>0)hpBar(cx+8,cy+73,cw-16,slot);
      });
      return 18+Math.ceil(slots.length/cols)*(cardH+gap)+6;
    }
    function content(x,y,w,t) {
      // Keep prose and controls within a comfortable reading width on large monitors.
      if(model.kind==="page"){
        const maxWidth=model.id?.startsWith("play:")?780:1040;
        if(w>maxWidth){x+=(w-maxWidth)/2;w=maxWidth;}
      }
      const desktop=w>=860;
      const parts=model.sections||[];
      if(twinField&&model.twinField){
        const top=y+titleBlock(x,y,w)+10;
        if(desktop){
          const fieldW=Math.floor(w*.555),gap=22;
          const fieldEnd=top+twinField.draw(model.twinField,x,top,fieldW,t,reduced.matches);
          let bottom=top;for(const part of parts)bottom+=section(part,x+fieldW+gap,bottom,w-fieldW-gap,t);
          return Math.max(bottom,fieldEnd+12);
        }
        let bottom=top+twinField.draw(model.twinField,x,top,w,t,reduced.matches)+12;
        for(const part of parts)bottom+=section(part,x,bottom,w,t);return bottom;
      }
      let art=model.art;
      if(!art && model.id?.startsWith("scene:")){
        const theme=Number(window.WilderGame?.regions[window.WilderGame.state.region]?.theme)||0;
        art={src:"ui/battle-"+theme%3+".png",height:width<680?92:175,landscape:true};
      }
      if(model.kind==="page" && art && desktop){
        const aw=Math.min(343,w*.34),gap=30,rx=x+aw+gap,rw=w-aw-gap;
        const hero=typeof art==="string"?{src:art}:art;
        const artHeight=artPanel({...hero,height:hero.height||Math.round(aw*.83)},x,y,aw,t);
        let ry=y+titleBlock(rx,y,rw,true)+15;
        if(model.formationStrip)ry+=lineupStrip(model.formationStrip,rx,ry,rw);
        for(const part of parts)ry+=section(part,rx,ry,rw,t);
        return Math.max(ry,y+artHeight+12);
      }
      let sy=y;
      sy+=titleBlock(x,y,w)+13;
      if(model.formationStrip)sy+=lineupStrip(model.formationStrip,x,sy,w);
      if(model.kind==="page" && art)sy+=artPanel(art,x,sy,w,t)+15;
      if(model.kind==="world"){
        if(desktop){
          const right=Math.min(340,Math.round(w*.285)),gap=18,left=w-right-gap,top=sy;
          sy+=mapPanel(x,sy,left,t)+14;
          sy+=questBox(model.objective,x,sy,left)+14;
          let ry=top;
          ry+=party(x+left+gap,ry,right,model.party,t)+14;
          for(const part of parts)ry+=section(part,x+left+gap,ry,right,t);
          return Math.max(ry,sy);
        }
        sy+=mapPanel(x,sy,w,t)+13;
        sy+=questBox(model.objective,x,sy,w)+13;
        for(const part of parts)sy+=section(part,x,sy,w,t);
        sy+=party(x,sy,w,model.party,t)+10;
      }else if(model.kind==="battle") {
        if(model.lineups)sy+=matchTeams(model.lineups,x,sy,w)+4;
        sy+=battle(x,sy,w,t)+12;
        for(const part of parts)sy+=section(part,x,sy,w,t);
      }else{
        for(const part of parts)sy+=section(part,x,sy,w,t);
      }
      return sy;
    }
    function matchTeams(lineups,x,y,w) {
      const half=(w-4)/2,h=44;
      [lineups.left,lineups.right].forEach((side,i)=>{
        const sx=x+i*(half+4),accent=i?"#896182":"#4a785b",sz=half>=205?32:25;
        rect(c,sx,y,half,h,"#f8f3df",C.line);
        const teamX=sx+8;
        side.team.forEach((kin,slot)=>{
          const px=teamX+slot*(sz+2),top=y+(h-sz-4)/2;
          if(slot===side.active)rect(c,px,top,sz,sz+5,i?"#f1e2e4":"#e0edcf",accent);
          c.save();c.globalAlpha=kin.hp?1:.36;picture(kin.src,px+2,top+1,sz-4,sz-3);c.restore();
          hpBar(px+3,top+sz,sz-6,kin);
        });
        const right=sx+half-6,space=right-(teamX+3*(sz+2))-3;
        c.font=getFont(10,"mono",650);
        label(c,fit(c,side.label,space),right,y+8,10,accent,"mono",650,"right");
        label(c,side.beats+"/3 beats",right,y+22,10,C.ink,"mono",700,"right");
      });
      return h;
    }
    function fighterStat(p,x,y,w,h,side) {
      const types=Array.isArray(p.types)?p.types.join(" · "):p.types||"";
      rect(c,x,y,w,h,side==="ally"?"#eaf0da":"#f0e7d3",C.line);
      const pad=8,inner=w-pad*2;
      const sideLabel=model.lineups?.[side==="ally"?"left":"right"]?.label||(side==="ally"?"Companion":"Rival");
      label(c,sideLabel.toUpperCase(),x+pad,y+5,9,side==="ally"?C.moss:C.brass,"mono",700);
      c.font=getFont(11,"mono",650);label(c,"Lv "+p.level,x+w-pad,y+5,11,C.secondary,"mono",650,"right");
      c.font=getFont(width<550?18:23,"title",650);
      label(c,fit(c,p.name,inner),x+pad,y+17,width<550?18:23,C.ink,"title",650);
      if(types){c.font=getFont(10,"body",650);label(c,fit(c,types,inner),x+pad,y+h-28,10,C.secondary,"body",650);}
      c.font=getFont(10,"mono",650);const life=p.hp+"/"+p.maxHp;
      const tw=c.measureText(life).width;
      hpBar(x+pad,y+h-12,Math.max(14,inner-tw-6),p);
      label(c,life,x+w-pad,y+h-16,10,C.ink,"mono",650,"right");
    }
    function gearBar(p,x,y,w) {
      const h=32,g=p.gear;
      rect(c,x,y,w,h,C.sheet,C.line);
      if(!g){label(c,"No gear",x+9,y+9,11,C.secondary,"body",500);return;}
      const action=g.action||{id:"spar-view",value:"equipment"};
      const hit=control({...action,label:p.name+" · "+g.name+" · "+(g.spent?"Used":"Ready")},x,y,w,h);
      if(highlighted(hit))rect(c,x+1,y+1,w-2,h-2,"#efe6c7");
      c.save();c.globalAlpha=g.spent ? .52 : 1;picture("art/gear/"+g.id+".png",x+5,y+2,27,27);c.restore();
      c.font=getFont(12,"body",650);label(c,fit(c,g.name,w-44),x+37,y+2,12,C.ink,"body",650);
      label(c,g.spent?"USED":"READY",x+37,y+18,9,g.spent?C.brass:C.moss,"mono",700);
    }
    function fighterImage(p,side,x,y,size,alpha=1){
      const forward=rightFacing.has(p.src),flip=p.flip??(side==="ally"?!forward:forward);
      c.save();c.globalAlpha=alpha;
      picture(p.src||p.image,x-size/2,y-size/2,size,size,"contain",flip);
      c.restore();
    }
    function battle(x,y,w,t){
      if(!model.ally||!model.foe)return 0;
      const active=fx?.handoff&&fx.handoffView!==model?null:fx;
      const elapsed=active?clamp((t-active.started)/active.duration,0,1):0;
      const mobile=w<530,sh=mobile?122:Math.min(235,Math.max(145,w/4.6)),bar=mobile?72:78,gap=4;
      const half=(w-gap)/2;
      const leads={ally:passedLeads.ally||model.ally,foe:passedLeads.foe||model.foe};
      const handoff=active?.handoff,switched=handoff&&(reduced.matches||elapsed>=.48);
      const ally=switched&&active.side==="ally"?handoff:leads.ally;
      const foe=switched&&active.side==="foe"?handoff:leads.foe;
      fighterStat(ally,x,y,half,bar,"ally");fighterStat(foe,x+half+gap,y,half,bar,"foe");
      let yy=y+bar+gap;
      if(ally.gear||foe.gear||model.ally.gear||model.foe.gear||handoff?.gear){
        gearBar(ally,x,yy,half);gearBar(foe,x+half+gap,yy,half);yy+=32+gap;
      }
      arenaRect={y:yy,h:sh};
      rect(c,x,yy,w,sh,"#8ba875",C.forest);
      c.save();c.beginPath();c.rect(x+2,yy+2,w-4,sh-4);c.clip();
      picture(model.background||"ui/battle-"+(model.theme||0)+".png",x,yy,w,sh,"cover");
      const tile=Math.min(sh*.77,w*.27),footY=yy+sh*.89;
      const points={ally:{x:x+w*.25,y:footY-tile*.46},foe:{x:x+w*.75,y:footY-tile*.56}};
      for(const side of ["ally","foe"]){
        const p=leads[side],sign=side==="ally"?1:-1,point=points[side];
        ellipse(c,point.x,point.y+tile*.46,tile*.32,Math.max(2,tile*.047),"#324d3438");
        if(handoff&&active.side===side){
          if(active.kind==="trio"){
            const beat=reduced.matches?.56:elapsed;
            const along=clamp(beat/.55,0,1),fade=clamp((1-beat)/.25,0,1);
            // The two callers leave room for the third kin to come through.
            // Keep all three silhouettes legible in the reduced-motion pose.
            fighterImage({src:active.source},side,point.x-sign*tile*.59,point.y-tile*.13,tile*.56,fade);
            fighterImage({src:active.partner},side,point.x+sign*tile*.04,point.y-tile*.20,tile*.52,fade);
            fighterImage(handoff,side,point.x+sign*tile*(.57*along-.19),point.y+tile*.15,tile*.76,Math.min(1,.22+along));
            continue;
          }
          const leave=reduced.matches?1:clamp((elapsed-.08)/.43,0,1);
          const enter=reduced.matches?1:clamp((elapsed-.29)/.40,0,1);
          if(leave<1)fighterImage(p,side,point.x-sign*tile*.32*leave,point.y,tile*(1-.12*leave),1-leave);
          if(enter>0)fighterImage(handoff,side,point.x-sign*tile*.40*(1-enter)**2,point.y-tile*.06*Math.sin(pi*enter),tile,enter);
          continue;
        }
        let dx=0,dy=reduced.matches?0:Math.sin(t*.0024+(side==="ally"?0:2))*2.3,alpha=1,scale=1;
        if(active && !reduced.matches){
          if(active.kind==="defeat" && side===active.side){
            alpha=1-elapsed;dy+=elapsed*elapsed*tile*.52;
          }else if(active.kind==="capture" && side!==active.side){
            scale=elapsed<.36?1:Math.max(.035,1-(elapsed-.36)*2.3);
            alpha=elapsed<.8?1:Math.max(0,(1-elapsed)*5);
          }else if(active.kind==="swap" && side===active.side){
            dx=sign*-tile*(1-elapsed);alpha=elapsed;
          }else if((active.kind==="attack"||active.kind==="guard") && side===active.side){
            dx=sign*Math.sin(clamp(elapsed/.4,0,1)*pi)*tile*.17;
          }else if((active.kind==="attack"||active.kind==="guard") && side!==active.side && elapsed>.45){
            const hit=(elapsed-.45)/.55;
            dx=sign*Math.sin(hit*pi*5)*tile*.045*(1-hit);
            if(hit<.44)alpha=(Math.floor(hit*16)%2===0)?.58:1;
          }
        }
        fighterImage(p,side,point.x+dx,point.y+dy,tile*scale,alpha);
      }
      if(active?.kind==="duet" && active.partner){
        const side=active.side,allied=side==="ally",partnerSize=tile*.71;
        const xx=points[side].x+(allied?1:-1)*tile*.64,yy=points[side].y+tile*.19;
        c.save();
        c.globalAlpha=reduced.matches?1:Math.min(1,elapsed*7,(1-elapsed)*8);
        picture(active.partner,xx-partnerSize/2,yy-partnerSize/2,partnerSize,partnerSize,"contain",allied?!rightFacing.has(active.partner):rightFacing.has(active.partner));
        c.restore();
        impact({...active,type:active.partnerType,kind:"attack"},elapsed,{...points,[side]:{x:xx,y:yy}},tile*.77);
      }
      if(active){
        if(active.kind==="trio"){
          const pos=points[active.side],sign=active.side==="ally"?1:-1;
          const trail=[[-.59,-.13],[.04,-.20],[.38,.15]].map(([x,y])=>({x:pos.x+sign*tile*x,y:pos.y+tile*y}));
          const beat=reduced.matches?.65:elapsed;
          for(let i=0;i<2;i++){
            const from=trail[i],to=trail[i+1],f=clamp(beat*6-i,0,1);
            if(f>0&&beat<.74){
              const xx=from.x+(to.x-from.x)*f,yy=from.y+(to.y-from.y)*f-tile*.17;
              star(c,xx,yy,4,C.gold);
            }
          }
          if(beat>=.43)impact({...active,handoff:null,kind:active.role==="heal"?"heal":active.role==="guard"?"guard":"attack"},
            clamp((beat-.43)/.57,0,1),{...points,[active.side]:trail[2]},tile*.85);
        }else impact(active,elapsed,points,tile);
        if(active.name){
          c.font=getFont(12,"body",650);
          const caption=active.kind==="wild-call" && active.target?active.name+" → "+active.target:active.name;
          const move=fit(c,caption,w-34),sw=c.measureText(move).width+20;
          rect(c,x+(w-sw)/2,yy+6,sw,23,"#203c30ee","#829571");
          label(c,move,x+w/2,yy+9,12,C.cream,"body",650,"center");
        }
      }
      c.restore();
      let bottom=yy+sh+6;
      const logs=(Array.isArray(model.log)?model.log:[model.log]).filter(Boolean);
      if(logs.length){
        c.font=getFont(13,"body",550);
        const lines=wrap(c,logs.join("  ·  "),w-24);
        const h=lines.length*18+16;
        rect(c,x,bottom,w,h,"#e8ecdc",C.line);
        paragraph(c,lines,x+12,bottom+8,13,18,C.ink,"body",550);bottom+=h;
      }
      return bottom-y;
    }
    function impact(a,p,points,tile) {
      const src=points[a.side],dst=points[a.side==="ally"?"foe":"ally"],sign=a.side==="ally"?1:-1;
      const [ink,light]=affinity[a.type]||affinity.Neutral;
      const unit=clamp(tile/95,.62,1.6);
      c.save();
      if(a.kind==="fitting"){
        const size=clamp(tile*.37,25,48),left=src.x+size*.72,cy=src.y-tile*.16;
        const lift=reduced.matches?0:Math.sin(p*Math.PI)*4*unit,y=cy-lift;
        ellipse(c,left,y,size*.58,size*.58,"#4d614d");ellipse(c,left,y,size*.52,size*.52,"#f5e8bd");
        picture("art/gear/"+a.item+".png",left-size/2,y-size/2,size,size,"contain");
        c.restore();return;
      }
      if(a.kind==="wild-call"){
        // Aim between the fighters. The quarry stays on screen and never plays a hit reaction.
        const x=(src.x+dst.x)/2, y=Math.max(src.y,dst.y)+tile*.39;
        ellipse(c,x,y+2*unit,15*unit,4*unit,"#47614a");
        if(a.motif==="stone"){
          poly(c,[[x-13*unit,y],[x-8*unit,y-8*unit],[x+6*unit,y-10*unit],[x+13*unit,y-3*unit],[x+10*unit,y+unit]],"#818482");
          line(c,x-7*unit,y-7*unit,x+5*unit,y-9*unit,"#d2c59e",2*unit);
        }else{
          for(let i=-1;i<=1;i++){
            const stem=x+i*7*unit,tip=y-(i===0?15:11)*unit;
            line(c,stem,y,stem+i*3*unit,tip,"#39644c",2*unit);
            if(a.motif==="flowers")star(c,stem+i*3*unit,tip,4*unit,"#f8d36c");
            else line(c,stem,y-3*unit,stem+5*unit,tip+3*unit,"#8bae66",2*unit);
          }
        }
        const t=reduced.matches?.72:clamp(p/.76,0,1);
        for(let i=0;i<6;i++){
          const along=t-i*.06;
          if(along<=0||along>1)continue;
          const xx=src.x+(x-src.x)*along, yy=src.y+(y-src.y)*along-Math.sin(pi*along)*tile*.46;
          ellipse(c,xx,yy,unit*(4-i*.35),unit*(3-i*.2),i%2?ink:light);
        }
        if(reduced.matches||p>.55){
          const glow=reduced.matches?.65:clamp((p-.55)/.45,0,1);
          c.globalAlpha=1-glow*.7;
          ellipse(c,x,y,unit*(10+glow*18),unit*(3+glow*5),null,light,2*unit);
        }
        c.restore();return;
      }
      if(a.kind==="learn"){
        const rise=reduced.matches?1:clamp(p*2,0,1);
        const xx=src.x+sign*tile*.27,yy=src.y-tile*(.30+.12*rise),r=unit*9;
        const shield=[[xx-r,yy-r*.7],[xx,yy-r],[xx+r,yy-r*.7],[xx+r*.75,yy+r*.4],[xx,yy+r],[xx-r*.75,yy+r*.4]];
        poly(c,shield,"#694e32");star(c,xx,yy,r*.72,"#ffe29a");
        if(!reduced.matches){
          c.globalAlpha=Math.sin(pi*p);
          for(let i=0;i<5;i++){
            const angle=pi*(1.08+i*.2),radius=(11+14*p)*unit;
            star(c,xx+Math.cos(angle)*radius,yy+Math.sin(angle)*radius,2.5*unit,"#ffe8ac");
          }
        }
        c.restore();return;
      }
      if(a.handoff){
        const still=reduced.matches;
        if(a.pass==="beacon"){
          const xx=dst.x-sign*tile*.30,yy=dst.y-tile*.30;
          if(!still&&p>.08&&p<.65){
            const progress=clamp((p-.08)/.57,0,1);
            const x=src.x+(xx-src.x)*progress,y=src.y+(yy-src.y)*progress-Math.sin(pi*progress)*tile*.24;
            c.globalAlpha=Math.sin(pi*progress)*.8;
            star(c,x,y,5*unit,"#fff0bc");
          }
          const strength=still?1:clamp((p-.32)/.28,0,1);
          c.globalAlpha=strength;
          ellipse(c,xx,yy,12*unit,12*unit,"#63462199","#e3b963",2*unit);
          star(c,xx,yy,9*unit,"#ffe49c");
        }else{
          const rise=still?1:clamp((p-.16)/.52,0,1);
          c.globalAlpha=still?.95:Math.min(.95,rise*1.45);
          c.translate(src.x,src.y+tile*(.24-.07*rise));c.scale(sign*tile,tile);
          c.lineCap="round";
          for(const [lift,reach] of [[.02,.48],[.14,.35]]){
            c.beginPath();c.moveTo(-reach-.11,lift+.04);
            c.bezierCurveTo(-.24,lift-.14,.02,lift+.19,reach,lift-.06);
            c.quadraticCurveTo(reach+.13,lift-.15,reach+.01,lift-.17);
            c.strokeStyle="#286e67";c.lineWidth=.054;c.stroke();
            c.strokeStyle="#a4ebdc";c.lineWidth=.025;c.stroke();
          }
        }
        c.restore();return;
      }
      if(reduced.matches){
        const target=["attack","duet","capture"].includes(a.kind)?dst:src;
        ellipse(c,target.x,target.y,tile*.46,tile*.45,null,ink,2);
        c.restore();return;
      }
      if(a.kind==="heal" || a.kind==="item"){
        const r=tile*.49;
        c.globalAlpha=Math.sin(pi*p);
        ellipse(c,src.x,src.y+r*.65,r,r*.24,null,light,3*unit);
        for(let j=0;j<9;j++){
          const u=(p+j/9)%1,xx=src.x+Math.sin(j*2.4+u)*r*.85,yy=src.y+r*(.9-u*2.3);
          const k=unit*(1+Math.sin(pi*u));rect(c,xx-k,yy-3*k,k*2,k*6,light);rect(c,xx-3*k,yy-k,k*6,k*2,light);
        }
      }else if(a.kind==="capture"){
        const q=clamp(p/.48,0,1),xx=src.x+(dst.x-src.x)*q,yy=src.y+(dst.y-src.y)*q-Math.sin(pi*q)*tile*.64;
        if(p<.67){ellipse(c,xx,yy,8*unit,8*unit,C.cream,C.brass,2);star(c,xx,yy,5*unit,C.moss);}
        if(p>.32){
          const u=(p-.32)/.68,r=Math.max(2,tile*.56*(1-u));
          ellipse(c,dst.x,dst.y,r,r*.76,null,C.cream,2*unit);
          for(let j=0;j<8;j++)star(c,dst.x+Math.cos(j*pi/4+u*3)*r,dst.y+Math.sin(j*pi/4+u*3)*r*.8,3*unit,C.gold);
        }
      }else if(a.kind==="defeat" || a.kind==="swap"){
        for(let j=0;j<8;j++){const angle=j*pi/4,r=tile*.6*p;c.globalAlpha=1-p;star(c,src.x+Math.cos(angle)*r,src.y+Math.sin(angle)*r,4*unit,light);}
      }else {
        if(a.kind==="guard"){
          c.globalAlpha=Math.sin(pi*p);
          poly(c,[[src.x,src.y-tile*.56],[src.x+tile*.39,src.y-tile*.32],[src.x+tile*.29,src.y+tile*.27],[src.x,src.y+tile*.51],[src.x-tile*.29,src.y+tile*.27],[src.x-tile*.39,src.y-tile*.32]],"#b8dba859");
          ellipse(c,src.x,src.y,tile*.43,tile*.54,null,"#f4f7cd",3*unit);
          c.globalAlpha=1;
        }
        const travel=clamp((p-.09)/.5,0,1);
        if(p<.68){
          for(let j=0;j<7;j++){
            const pos=clamp(travel-j*.035,0,1),xx=src.x+(dst.x-src.x)*pos,yy=src.y+(dst.y-src.y)*pos;
            const wave=Math.sin(pos*pi*4+j*.7),sz=unit*Math.max(2,8-j*.8);
            c.globalAlpha=Math.max(.18,1-j*.1);
            switch(a.type){
              case "Grove":
                poly(c,[[xx-sz*sign,yy+wave*10],[xx+sz*.6*sign,yy+wave*10-sz*.9],[xx+sz*sign,yy+wave*10-sz*.4],[xx-sz*.3*sign,yy+wave*10+sz]],j%2?light:ink);break;
              case "Ember":{
                const fy=yy+wave*5;
                poly(c,[[xx-2*sz*sign,fy-sz*.6],[xx,fy-sz],[xx+sz*sign,fy],[xx,fy+sz],[xx-3*sz*sign,fy+sz*.6]],ink);
                ellipse(c,xx,fy,sz*.68,sz*.64,light);break;
              }
              case "Tide":
                ellipse(c,xx,yy+wave*11,sz*1.6,sz*.62,j%2?light:ink);break;
              case "Vane":
                c.beginPath();c.moveTo(xx-sz*3*sign,yy+wave*15);c.quadraticCurveTo(xx+sign*sz*2,yy+wave*15-sz*2,xx+sign*sz,yy+wave*15+sz);c.strokeStyle=j%2?light:ink;c.lineWidth=2*unit;c.stroke();break;
              case "Arc":{
                const next=clamp(pos-.06,0,1);
                const nx=src.x+(dst.x-src.x)*next,ny=src.y+(dst.y-src.y)*next+(j%2?1:-1)*sz*1.7;
                line(c,nx,ny,xx,yy+(j%2?-1:1)*sz*1.7,ink,4*unit);line(c,nx,ny,xx,yy+(j%2?-1:1)*sz*1.7,light,2*unit);break;
              }
              case "Loam":{
                const ry=yy-Math.sin(pi*pos)*tile*.38+j*2;
                poly(c,[[xx-sz,ry],[xx-sz*.6,ry-sz],[xx+sz*.6,ry-sz],[xx+sz,ry],[xx+sz*.6,ry+sz*.7],[xx-sz*.6,ry+sz]],ink);
                line(c,xx-sz*.4,ry-sz*.7,xx+sz*.5,ry-sz*.7,light,2*unit);break;
              }
              case "Rime":
                poly(c,[[xx+sz*2*sign,yy+wave*11],[xx-sz*sign,yy+wave*11-sz*.7],[xx-sz*.45*sign,yy+wave*11+sz*.8]],j%2?ink:light);break;
              case "Gloam":
                ellipse(c,xx,yy+wave*12,sz*1.3,sz*1.3,ink);ellipse(c,xx-sz*.35,yy+wave*12-sz*.24,sz*.66,sz*.66,light);break;
              case "Chime":
                ellipse(c,xx,yy,sz*.6,sz*1.65,null,j%2?light:ink,2.5*unit);break;
              case "Alloy":
                c.save();c.translate(xx,yy+wave*7);c.rotate(pos*pi*4);
                rect(c,-sz*.8,-sz*.8,sz*1.6,sz*1.6,ink);rect(c,-sz*.4,-sz*.4,sz*.8,sz*.8,light);c.restore();break;
              default:
                line(c,xx-sz*2.7*sign,yy+wave*8+sz,xx+sz*sign,yy+wave*8-sz,light,3*unit);
            }
          }
        }
        if(p>.45){
          const u=(p-.45)/.55,r=tile*(.07+.5*u);c.globalAlpha=1-u;
          if(a.type==="Chime"||a.type==="Tide")ellipse(c,dst.x,dst.y,r,r*.82,null,light,3*unit);
          for(let j=0;j<9;j++){
            const angle=j*2*pi/9;
            const xx=dst.x+Math.cos(angle)*r,yy=dst.y+Math.sin(angle)*r;
            if(a.type==="Rime"||a.type==="Arc"||a.type==="Alloy")star(c,xx,yy,(5-2*u)*unit,j%2?ink:light);
            else rect(c,xx,yy,3.5*unit,3.5*unit,j%2?ink:light);
          }
        }
      }
      c.restore();
    }
    function animate(effect={}) {
      if(fx)return fx.promise;
      const kind=effect.kind||"attack",speed=window.WilderGame?.state.animationSpeed||1;
      const side=effect.side==="foe"?"foe":"ally",view=model,portrait=effect.incoming||effect.incomingKin?.src;
      const trio=kind==="trio"&&effect.source&&effect.partner;
      const passing=(trio||(kind==="swap"||kind==="wild-call")&&["beacon","slipstream","field-swap"].includes(effect.pass))&&portrait&&model.kind==="battle";
      const duration=reduced.matches?(passing||kind==="learn"||kind==="fitting"?190:95):(trio?900:passing?640:({heal:610,capture:820,defeat:460,swap:350,item:600,fitting:540,duet:850,learn:760}[kind]||550))/speed;
      let resolve;
      const promise=new Promise(done=>{resolve=done;});
      const token={...effect,kind,side,duration,started:performance.now(),promise};
      if(passing){
        source(portrait);
        if(trio){source(effect.source);source(effect.partner);}
        token.handoffView=view;
        token.handoff={...(effect.incomingKin||passedLeads[side]||model[side]),flip:effect.incomingKin?.flip,src:portrait};
      }
      if(model.kind==="battle" && arenaRect && (arenaRect.y<clipTop || arenaRect.y+arenaRect.h>clipBottom)){
        scroll=clamp(scroll+arenaRect.y-clipTop-(clipBottom-clipTop-arenaRect.h)/2,0,limit);
      }
      if(effect.announce)live.textContent=effect.announce;
      fx=token;dirty=true;render(performance.now());
      // Finishes even if the tab is backgrounded halfway through a move.
      setTimeout(()=>{
        if(fx===token){
          if(token.handoff&&model===view)passedLeads[side]=token.handoff;
          fx=null;dirty=true;
        }
        resolve();
      },duration);
      return promise;
    }
    function overlay() {
      const items=shortcutList(),mw=Math.min(width-20,510),cols=mw>=425?2:1;
      const needed=71+Math.ceil(items.length/cols)*49+18;
      const mh=Math.min(height-26,needed),mx=(width-mw)/2,my=(height-mh)/2;
      rect(c,0,0,width,height,"#132c24b8");rect(c,mx+4,my+5,mw,mh,"#13291d77");
      rect(c,mx,my,mw,mh,C.paper,C.forest);rect(c,mx,my,mw,5,C.gold);
      label(c,"Trail menu",mx+16,my+13,29,C.ink,"title",700);
      button({id:"$close-menu",label:"Close"},mx+mw-77,my+11,64,34,"menu",toggleMenu);
      const top=my+58,bottom=my+mh-12;
      menuLimit=Math.max(0,Math.ceil(items.length/cols)*49-(bottom-top));
      menuScroll=clamp(menuScroll,0,menuLimit);
      menuClip={x:mx,y:top,w:mw,h:bottom-top};
      c.save();c.beginPath();c.rect(mx+1,top,mw-2,bottom-top);c.clip();
      const cw=(mw-31-(cols-1)*7)/cols;
      items.forEach((item,i)=>{
        const x=mx+15+i%cols*(cw+7),y=top+Math.floor(i/cols)*49-menuScroll;
        const hit=control(item,x,y,cw,43,"menu-scroll",()=>{menu=false;activeControl(item);});
        edge(x,y,cw,43,highlighted(hit));
        symbol(c,item.icon||(item.id==="nav"?item.value:item.id),x+10,y+15,15,item.disabled?C.faint:C.moss);
        c.font=getFont(15,"body",650);label(c,fit(c,item.label,cw-(item.key?72:45)),x+34,y+11,15,item.disabled?C.faint:C.ink,"body",650);
        if(item.key)keycap(String(item.key).toUpperCase(),x+cw-29,y+12);
      });
      c.restore();
    }
    function background() {
      c.fillStyle=paper;c.fillRect(0,0,width,height);
    }
    function syncMirror() {
      const accessible=menu?hits.filter(h=>h.area.startsWith("menu")):hits;
      const unique=new Map();
      for(const h of accessible){
        if(h.area==="map"||h.pointerOnly)continue;
        const signature=h.row.id+"|"+String(h.row.value??"")+"|"+h.row.label;
        if(!unique.has(signature))unique.set(signature,h);
      }
      const narration=[model.kicker,model.title,model.subtitle,model.status];
      if(model.twinField&&window.WilderTwinField)narration.push(...window.WilderTwinField.narration(model.twinField));
      if(model.formationStrip)narration.push(model.formationStrip.label,...model.formationStrip.slots.map((s,i)=>
        (i+1)+". "+s.name+(s.lead?", leader":"")+", level "+s.level+(s.maxHp?", "+s.hp+" of "+s.maxHp+" health":"")));
      if(model.objective)narration.push(model.objective.title,model.objective.description);
      if(model.log)narration.push(...(Array.isArray(model.log)?model.log:[model.log]));
      if(model.lineups)for(const side of [model.lineups.left,model.lineups.right]){
        narration.push(side.label+", "+side.beats+" of 3 duet beats");
        side.team.forEach((k,i)=>narration.push((k.name||k.id)+(i===side.active?", active":"")+", "+k.hp+" of "+k.maxHp+" health"));
      }
      for(const side of [model.ally,model.foe,...(model.party||[])])if(side)narration.push(side.name+", level "+side.level+", "+side.hp+" of "+side.maxHp+" health"+(side.gear?", "+side.gear.name+(side.gear.spent?", used":", ready"):""));
      for(const s of model.sections||[]){
        narration.push(s.title,s.text);
        for(const cell of [...(s.rows||[]),...(s.grid?.cells||[])])if(!cell.id)narration.push(cell.label,cell.detail);
      }
      const text=narration.filter(Boolean).join(". ");
      const sig=text+"|"+[...unique].map(([key,h])=>key+(h.disabled?"_off":"")+(h.row.detail||"")+(h.row.badge||"")).join(";");
      if(sig===mirrorSig)return;
      mirrorSig=sig;
      const reading=document.createElement("p");reading.textContent=text;
      const fragment=document.createDocumentFragment();fragment.append(reading);
      for(const hit of unique.values()){
        const b=document.createElement("button");
        b.type="button";b.tabIndex=-1;b.disabled=hit.disabled;
        b.textContent=[hit.row.aria||hit.row.label,hit.row.badge,hit.row.detail].filter(Boolean).join(". ");
        b.dataset.action=hit.row.id;if(hit.row.value!==undefined)b.dataset.value=String(hit.row.value);
        b.addEventListener("focus",()=>{
          const current=hits.find(h=>h.uid===hit.uid);
          if(current && !current.disabled){focus=current.uid;ensureVisible(current);}
        });
        b.addEventListener("click",()=>run(hit));fragment.append(b);
      }
      mirror.replaceChildren(fragment);
    }
    function render(t) {
      if(destroyed || width<2 || height<2)return;
      c.setTransform(ratio,0,0,ratio,0,0);c.imageSmoothingEnabled=false;hits=[];
      header=width<610?50:59;footer=width<720?47:49;clipTop=header;clipBottom=height-footer;
      background();
      const margin=width<500?11:width<820?19:Math.max(30,(width-1360)/2),w=width-2*margin;
      const inset=width<500?14:21;
      c.save();c.beginPath();c.rect(0,clipTop,width,Math.max(0,clipBottom-clipTop));c.clip();
      const bottom=content(margin,clipTop+inset-scroll,w,t);
      c.restore();
      limit=Math.max(0,Math.ceil(bottom+scroll+10-clipBottom));
      if(scroll>limit+1){scroll=limit;return render(t);}
      if(limit>0){
        const track=Math.max(20,clipBottom-clipTop-8),thumb=Math.max(20,track*track/(track+limit));
        rect(c,width-5,clipTop+4+(track-thumb)*scroll/limit,3,thumb,"#85947a");
      }
      if(!reduced.matches){
        const fade=1-(t-lastPage)/125;
        if(fade>0 && fade<=1)rect(c,0,clipTop,width,clipBottom-clipTop,"rgba(244,240,220,"+(fade*.36)+")");
      }
      dock();shellHeader();
      if(menu)overlay();else menuClip=null;
      if(notice && t<notice.until && !menu){
        c.font=getFont(14,"body",600);
        const ww=Math.min(width-24,Math.max(150,Math.min(530,c.measureText(notice.text).width+28)));
        const lines=wrap(c,notice.text,ww-24);
        const h=lines.length*18+18,x=(width-ww)/2,y=clipBottom-h-8;
        rect(c,x+2,y+3,ww,h,"#15312344");rect(c,x,y,ww,h,C.deep,"#9cab80");
        paragraph(c,lines,x+12,y+7,14,18,C.cream,"body",600);
      }
      const selected=hits.find(h=>h.uid===focus);
      if(selected && visible(selected)){
        c.strokeStyle="#b28a43";c.lineWidth=2;
        c.strokeRect(selected.x+2,selected.y+2,Math.max(1,selected.w-4),Math.max(1,selected.h-4));
      }
      syncMirror();dirty=false;lastPaint=t;
    }
    function tick(t) {
      if(destroyed)return;
      // Water, portraits and NPCs idle gently. Battles animate at 60 Hz while a skill plays.
      const interval=fx?12:((model.kind==="world" && !reduced.matches)?32:75);
      if(!document.hidden && (dirty || t-lastPaint>=interval && (!reduced.matches || fx || notice || (model.sections||[]).some(s=>s.draw||s.meter))))render(t);
      if(notice && t>=notice.until){notice=null;dirty=true;}
      frame=requestAnimationFrame(tick);
    }
    function visible(hit) {
      if(menu && !hit.area.startsWith("menu"))return false;
      if(hit.area==="menu-scroll")return menuClip && hit.y<menuClip.y+menuClip.h && hit.y+hit.h>menuClip.y;
      if(hit.area==="content"||hit.area==="map")return hit.y<clipBottom && hit.y+hit.h>clipTop;
      return true;
    }
    function hitAt(x,y){
      for(let i=hits.length-1;i>=0;i--){
        const h=hits[i];if(!visible(h) || !inside(x,y,h))continue;
        if((h.area==="content"||h.area==="map") && (y<clipTop||y>=clipBottom))continue;
        if(h.area==="menu-scroll" && !inside(x,y,menuClip))continue;
        return h;
      }
      return null;
    }
    function point(e){
      const b=canvas.getBoundingClientRect();return {x:(e.clientX-b.left)*width/b.width,y:(e.clientY-b.top)*height/b.height};
    }
    function moveScroll(delta) {
      if(menu)menuScroll=clamp(menuScroll+delta,0,menuLimit);
      else scroll=clamp(scroll+delta,0,limit);
      dirty=true;render(performance.now());
    }
    function ensureVisible(h) {
      if(!h)return;
      if(h.area==="content"||h.area==="map"){
        if(h.y<clipTop+3)scroll+=h.y-clipTop-3;
        else if(h.y+h.h>clipBottom-3)scroll+=h.y+h.h-clipBottom+3;
        scroll=clamp(scroll,0,limit);
      }else if(h.area==="menu-scroll"){
        if(h.y<menuClip.y)menuScroll+=h.y-menuClip.y;
        else if(h.y+h.h>menuClip.y+menuClip.h)menuScroll+=h.y+h.h-menuClip.y-menuClip.h;
        menuScroll=clamp(menuScroll,0,menuLimit);
      }
      dirty=true;render(performance.now());
    }
    function moveFocus(dir) {
      const options=hits.filter(h=>!h.disabled && !h.pointerOnly && h.area!=="map" && (menu?h.area.startsWith("menu"):!h.area.startsWith("menu")));
      if(!options.length)return;
      const index=options.findIndex(h=>h.uid===focus);
      const next=index<0?(dir>0?0:options.length-1):(index+dir+options.length)%options.length;
      focus=options[next].uid;ensureVisible(options[next]);
      live.textContent=options[next].row.aria||options[next].row.label;
    }
    function onKey(e) {
      if(e.defaultPrevented||e.isComposing||e.ctrlKey||e.metaKey||e.altKey || e.target?.matches?.("input,textarea,select,[contenteditable=true]"))return;
      if(fx){e.preventDefault();return;}
      const key=e.key.toLowerCase();
      if(menu){
        if(key==="escape"||key==="f1"){e.preventDefault();toggleMenu();return;}
        if(key==="tab"||key.startsWith("arrow")){e.preventDefault();moveFocus((key==="tab"&&e.shiftKey)||key==="arrowup"||key==="arrowleft"?-1:1);return;}
        if(key==="enter"||key===" "){e.preventDefault();run(hits.find(h=>h.uid===focus));return;}
        const short=shortcutList().find(s=>s.key?.toLowerCase()===key);
        if(short){e.preventDefault();menu=false;activeControl(short);dirty=true;}
        return;
      }
      if(key==="tab"){e.preventDefault();moveFocus(e.shiftKey?-1:1);return;}
      if((key==="enter"||key===" ") && focus){e.preventDefault();run(hits.find(h=>h.uid===focus));return;}
      if(handlers.key?.(e)){e.preventDefault();dirty=true;return;}
      if(key==="escape"&&model.back){e.preventDefault();activeControl(model.back);return;}
      if(key==="f1"){e.preventDefault();toggleMenu();return;}
      if(key==="pagedown"||key==="pageup"){e.preventDefault();moveScroll((key==="pagedown"?1:-1)*(clipBottom-clipTop)*.85);return;}
      const short=shortcutList().find(s=>s.key?.toLowerCase()===key);
      if(short){e.preventDefault();activeControl(short);return;}
      if(key.startsWith("arrow")){e.preventDefault();moveFocus(key==="arrowup"||key==="arrowleft"?-1:1);}
    }
    const events=new AbortController(),opts={signal:events.signal};
    document.addEventListener("keydown",onKey,opts);
    canvas.addEventListener("wheel",e=>{
      e.preventDefault();if(!fx)moveScroll(e.deltaY*(e.deltaMode===1?16:1));
    },{...opts,passive:false});
    canvas.addEventListener("pointerdown",e=>{
      if(e.button!==0||fx)return;
      const p=point(e);pointer={id:e.pointerId,...p,prior:p.y,drag:false,hit:hitAt(p.x,p.y)};
      canvas.focus({preventScroll:true});canvas.setPointerCapture(e.pointerId);
    },opts);
    canvas.addEventListener("pointermove",e=>{
      const p=point(e);
      if(pointer && e.pointerId===pointer.id){
        if(Math.abs(p.y-pointer.y)>6)pointer.drag=true;
        if(pointer.drag){moveScroll(pointer.prior-p.y);pointer.prior=p.y;}
      }else{
        const h=hitAt(p.x,p.y);hover=h?.uid||"";canvas.style.cursor=h&&!h.disabled?(h.area==="map"?"crosshair":"pointer"):"default";dirty=true;
      }
    },opts);
    canvas.addEventListener("pointerup",e=>{
      if(!pointer||e.pointerId!==pointer.id)return;
      const p=point(e),h=hitAt(p.x,p.y),down=pointer;pointer=null;
      if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);
      if(down.drag||fx)return;
      focus="";
      if(h && h.uid===down.hit?.uid){
        if(h.selectTile)h.selectTile(p.x,p.y);else run(h);
      }else if(menu && !h && !down.hit)toggleMenu();
      dirty=true;
    },opts);
    canvas.addEventListener("pointercancel",()=>{pointer=null;},opts);
    canvas.addEventListener("pointerleave",()=>{hover="";dirty=true;},opts);
    function destroy(){
      destroyed=true;events.abort();observer.disconnect();cancelAnimationFrame(frame);mirror.remove();live.remove();
    }
    frame=requestAnimationFrame(tick);
    return surface;
  }
  window.WilderCanvas={create};
})();
