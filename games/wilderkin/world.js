// Wilderkin's maps use a 16-pixel tile. Scenery is painted once per region.
(() => {
  'use strict';

  const TILE = 16;
  const COLS = 24;
  const ROWS = 13;
  const W = COLS * TILE;
  const H = ROWS * TILE;
  const palettes = [
    {
      turf: ['#a0bf62', '#93b65a', '#83a956', '#bbcf77', '#708f4a'],
      tree: ['#234f3f', '#326345', '#4c8050', '#659550', '#86af58', '#b0c96e'],
      pine: ['#244c40', '#326548', '#4d8155', '#6a9c61', '#9abf76'],
      water: ['#3d7489', '#4e96ad', '#68b3c0', '#a4d7d4', '#dbead8'],
      sand: ['#9c9658', '#c4ae72', '#dfc38a', '#ecd297', '#baa474'],
      roofs: [['#713f3a','#9c493b','#bd5b43','#d9794f','#e39660'],['#71403a','#954a40','#b75c4a','#d57a57','#e39868']],
      bloom: ['#e9a681','#f7d89e','#efc758','#ffedbc']
    },
    {
      turf: ['#b9ad62', '#ab9f58', '#9c914e', '#c9be75', '#82784b'],
      tree: ['#554936','#796344','#9a733f','#b68a47','#ceaa56','#dac16b'],
      pine: ['#414a3e','#4e6047','#6a7952','#8c925e','#aaab74'],
      water: ['#4b7586','#608c99','#77a6aa','#a0c0b8','#c6d2bf'],
      sand: ['#97885b','#b6a06b','#d2b782','#e4c893','#ae936b'],
      roofs: [['#67453f','#875449','#a35e4a','#bb795a','#d39771'],['#654c40','#865f48','#a57c51','#bb9264','#d2ad75']],
      bloom: ['#c16d50','#f0b36e','#edce74','#f8dca8']
    },
    {
      turf: ['#86ac8c', '#7da483', '#739980', '#a1bd95', '#588776'],
      tree: ['#344f56','#466664','#557d73','#699383','#83a792','#a3bd9a'],
      pine: ['#304d56','#3f6770','#537e82','#729897','#93ae9d'],
      water: ['#496f91','#5d87a4','#75a2b3','#a0c3c6','#c3d6c6'],
      sand: ['#83917d','#abb199','#c8c9ac','#e1dabe','#a3a68d'],
      roofs: [['#514b61','#655775','#826a89','#a5889d','#bca1a9'],['#46516b','#596887','#6d809a','#8b9bb0','#aeb7bc']],
      bloom: ['#d2a0c5','#f0d7cf','#e5cb86','#f8e6c6']
    }
  ];

  function site(id, x, y, label) { return { id, x, y, label }; }
  const regions = [
    {
      name:'Mossbrook Vale', spawn:{x:11,y:7}, cols:COLS, rows:ROWS,
      sites:[site('camp',4,6,'Hearth Cottage'),site('warden',10,5,'Mossbrook Lodge'),site('wild',21,7,'Clover Clearing'),site('travel',11,11,'Trailpost'),site('camp',15,5,'Brookside Mill')],
      river:[[242,-10],[244,15],[255,37],[271,46],[283,68],[293,86],[303,100],[307,120],[298,143],[277,157],[268,175],[276,190],[287,215]], width:15, bridgeY:119,
      paths:[
        [[-10,100],[37,100],[65,106],[95,108],[127,99],[154,93],[169,87]],
        [[114,104],[143,108],[161,120],[186,126],[213,125],[235,115],[259,113],[286,119],[326,119],[353,120],[393,108]],
        [[181,125],[188,151],[177,171],[181,194],[178,217]], [[226,118],[238,95],[244,76]]
      ],
      houses:[['camp',53,92],['lodge',168,76],['mill',243,73]],
      groves:[[-11,3,108,34],[81,-14,144,38],[196,-12,229,23],[310,-13,403,38],[-13,32,28,78],[357,38,403,87],[-12,145,63,230],[61,185,133,229],[202,167,247,232],[335,156,404,229]],
      fences:[[83,81,37],[98,66,39],[188,71,23],[26,118,44],[222,84,18],[335,151,33]],
      gardens:[[88,73,25,8],[125,58,14,9],[33,111,24,6],[352,141,15,7]],
      wild:[348,90], stones:[[104,143],[112,148],[250,141],[324,51],[215,31],[68,37],[143,171],[26,137]]
    },
    {
      name:'Cinderfall Ridge', spawn:{x:10,y:8}, cols:COLS, rows:ROWS,
      sites:[site('camp',3,7,'Ember Rest'),site('warden',19,4,'Emberwatch Hall'),site('wild',15,10,'Cindergrass'),site('travel',8,11,'Ridge Trailpost'),site('camp',7,6,'Quarry Cottage')],
      river:[[193,-10],[201,14],[204,34],[197,62],[206,79],[210,102],[208,122],[197,145],[190,159],[178,183],[178,217]], width:13, bridgeY:106,
      paths:[ [[-10,124],[41,124],[57,121],[88,130],[123,136],[152,128],[174,111],[202,105],[231,107],[256,99],[274,83],[301,75],[329,80],[393,72]], [[135,133],[139,153],[132,187],[129,217]], [[248,102],[244,127],[249,146],[245,171],[256,217]] ],
      houses:[['camp',50,105],['lodge',309,62],['cottage',110,91]],
      groves:[[-13,-12,94,33],[112,-13,163,33],[250,-13,295,23],[347,-9,403,35],[-20,44,23,88],[340,105,412,147],[-7,165,65,231],[282,164,392,229]],
      fences:[[68,109,43],[249,72,30],[327,60,32],[78,154,33],[271,135,34]],
      gardens:[[66,96,19,8],[261,60,16,8],[280,124,21,7]],
      wild:[234,160], stones:[[149,60],[158,65],[153,55],[81,177],[92,182],[337,121],[351,125],[224,43],[222,36],[267,183],[34,60]]
    },
    {
      name:'Moonwell Reach', spawn:{x:13,y:7}, cols:COLS, rows:ROWS,
      sites:[site('camp',18,6,'Lantern Cottage'),site('warden',5,5,'Moonwell Shrine'),site('wild',4,10,'Silver Ferns'),site('travel',17,11,'Moonwell Trailpost'),site('camp',13,5,'Reedwater Mill')],
      river:[[164,-10],[177,11],[182,28],[177,55],[164,78],[153,98],[151,125],[157,145],[169,161],[198,179],[205,196],[209,216]], width:18, bridgeY:116,
      paths:[ [[-10,97],[32,98],[58,99],[86,91],[110,97],[126,112],[149,116],[177,116],[201,118],[225,109],[252,101],[277,104],[299,103],[329,92],[394,91]], [[269,101],[265,122],[275,145],[279,167],[280,187],[283,217]], [[101,94],[92,115],[80,130],[76,149],[72,170],[62,201]] ],
      houses:[['camp',293,90],['lodge',82,76],['mill',211,79]],
      groves:[[-12,-12,52,32],[65,-14,134,25],[215,-13,269,28],[316,-15,401,43],[-15,36,26,78],[341,117,405,147],[-16,158,41,224],[98,181,147,230],[218,180,255,229],[312,165,402,230]],
      fences:[[32,81,26],[248,85,29],[298,118,36],[90,149,26]],
      gardens:[[252,74,16,7],[305,107,23,6]],
      wild:[55,158], stones:[[39,124],[34,128],[129,158],[135,164],[238,40],[325,152],[336,150],[302,46]]
    }
  ];

  function random(seed) {
    return () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
  }
  function surface(w,h) {
    const canvas=document.createElement('canvas');
    canvas.width=w; canvas.height=h;
    const ctx=canvas.getContext('2d');
    ctx.imageSmoothingEnabled=false;
    return ctx;
  }
  function rect(c,color,x,y,w,h) {
    c.fillStyle=color;
    c.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));
  }
  // Integer scanlines keep diagonals and curves crisp at every browser zoom.
  function poly(c,color,points) {
    const ys=points.map(p=>p[1]);
    c.fillStyle=color;
    for(let y=Math.floor(Math.min(...ys)); y<Math.ceil(Math.max(...ys)); y++) {
      const edges=[];
      const row=y+.5;
      for(let a=points.length-1,b=0;b<points.length;a=b++) {
        const [ax,ay]=points[a], [bx,by]=points[b];
        if((ay<=row&&by>row)||(by<=row&&ay>row)) edges.push(ax+(row-ay)*(bx-ax)/(by-ay));
      }
      edges.sort((a,b)=>a-b);
      for(let j=0;j+1<edges.length;j+=2) {
        const x=Math.round(edges[j]);
        c.fillRect(x,y,Math.round(edges[j+1])-x,1);
      }
    }
  }
  function oval(c,color,x,y,rx,ry) {
    for(let row=-ry;row<=ry;row++) {
      const w=Math.round(rx*Math.sqrt(Math.max(0,1-row*row/(ry*ry))));
      rect(c,color,x-w,y+row,w*2+1,1);
    }
  }
  function line(c,color,x1,y1,x2,y2) {
    let x=Math.round(x1), y=Math.round(y1);
    x2=Math.round(x2); y2=Math.round(y2);
    const dx=Math.abs(x2-x), dy=-Math.abs(y2-y);
    const sx=x<x2?1:-1, sy=y<y2?1:-1;
    let e=dx+dy;
    for(;;) {
      rect(c,color,x,y,1,1);
      if(x===x2&&y===y2) break;
      const e2=e*2;
      if(e2>=dy) {e+=dy;x+=sx;}
      if(e2<=dx) {e+=dx;y+=sy;}
    }
  }
  function riverX(region,y) {
    const points=region.river;
    let i=0;
    while(i<points.length-2&&y>points[i+1][1])i++;
    const [x1,y1]=points[i], [x2,y2]=points[i+1];
    const t=(y-y1)/(y2-y1);
    return x1+(x2-x1)*t;
  }
  function bankWidth(region,y) {
    return region.width+2*Math.cos(y/15)+1.7*Math.sin(y/9);
  }
  function distanceToPath(x,y,paths) {
    let nearest=1e5;
    for(const points of paths) {
      for(let i=1;i<points.length;i++) {
        const ax=points[i-1][0], ay=points[i-1][1];
        const dx=points[i][0]-ax, dy=points[i][1]-ay;
        const t=Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy)));
        const px=x-ax-t*dx, py=y-ay-t*dy;
        nearest=Math.min(nearest,px*px+py*py);
      }
    }
    return Math.sqrt(nearest);
  }
  const cache=[];
  const GRASS=0, PATH=1, WATER=2, BANK=3;
  function terrain(index) {
    const region=regions[index], p=palettes[index], c=surface(W,H);
    const data=c.createImageData(W,H), kind=new Uint8Array(W*H);
    const colorMap=new Map();
    function rgb(hex) {
      if(!colorMap.has(hex)) colorMap.set(hex,[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)));
      return colorMap.get(hex);
    }
    for(let y=0;y<H;y++) {
      const center=riverX(region,y);
      const width=bankWidth(region,y);
      for(let x=0;x<W;x++) {
        const k=y*W+x, bank=Math.abs(x-center)-width;
        let type=GRASS, color=p.turf[0];
        const grain=Math.sin(x/16+y/23)+Math.cos(x/25-y/13)+.36*Math.sin((x+y)/7);
        if(grain<-.3)color=p.turf[1];
        const d=distanceToPath(x,y,region.paths);
        const wobble=.85*Math.sin(x/7+y/9)+.65*Math.cos(x/4-y/5);
        if(d<11+wobble) {
          type=PATH; color=d>9.5+wobble?p.sand[1]:p.sand[2];
          if(d<6 && grain>1.24)color=p.sand[3];
        }
        if(bank<4) {
          type=BANK;color=bank>2?p.turf[4]:p.sand[1];
          if(bank>3) color=p.turf[2];
          if(bank<1)color=p.water[0];
          if(bank<0) {
            type=WATER; color=p.water[2];
            if(bank<-3 && Math.sin(x/12+y/16)+Math.cos(y/20-x/14)>.4)color=p.water[1];
            if(bank>-1.4 && x>center)color=p.water[3];
          }
        }
        kind[k]=type;
        const v=rgb(color);
        data.data[k*4]=v[0];data.data[k*4+1]=v[1];data.data[k*4+2]=v[2];data.data[k*4+3]=255;
      }
    }
    c.putImageData(data,0,0);
    const rnd=random(920+index*267);
    for(let i=0;i<1700;i++) {
      const x=Math.floor(rnd()*W),y=Math.floor(rnd()*H),t=kind[y*W+x];
      const tint=rnd();
      if(t===GRASS) {
        if(tint<.65) {
          const tone=tint<.29?p.turf[2]:p.turf[3];
          rect(c,tone,x,y,2,1);
          if(rnd()<.58) rect(c,tone,x+2,y-1,1,1);
          if(rnd()<.3) rect(c,p.turf[1],x-3,y+2,2,1);
        } else if(rnd()<.47) {
          rect(c,p.turf[2],x,y,2,1); rect(c,p.turf[2],x-1,y-1,1,1);
          rect(c,p.turf[2],x+2,y-2,1,2); rect(c,p.turf[3],x+3,y-3,1,2);
        }
      } else if(t===PATH&&tint<.48) {
        rect(c,tint<.24?p.sand[1]:p.sand[3],x,y,1+(rnd()<.35?2:0),1);
        if(rnd()<.22)rect(c,p.sand[3],x+1,y-1,2,1);
      } else if(t===WATER&&tint<.56) {
        rect(c,tint<.18?p.water[3]:p.water[1],x,y,2+Math.floor(rnd()*5),1);
      }
    }
    for(let i=0;i<80;i++) {
      const x=Math.floor(rnd()*W), y=Math.floor(rnd()*H);
      if(kind[y*W+x]!==GRASS)continue;
      for(let j=0;j<4;j++) {
        const fx=x+Math.round(rnd()*10)-5,fy=y+Math.round(rnd()*6)-3;
        if(fx<0||fx>=W||fy<1||fy>=H||kind[fy*W+fx]!==GRASS)continue;
        rect(c,p.turf[4],fx,fy,1,2);
        rect(c,p.bloom[i%4],fx-1,fy-1,3,1);
        rect(c,p.bloom[(i+1)%4],fx,fy-2,1,1);
      }
    }
    return {ground:c,kind,objects:[],blocked:new Set(),sparks:[],hotspots:[]};
  }

  const sprites=new Map();
  function sprite(key,w,h,paint) {
    if(!sprites.has(key)) {
      const ctx=surface(w,h); paint(ctx);
      sprites.set(key,ctx.canvas);
    }
    return sprites.get(key);
  }
  function place(map,img,x,y,depth=y) {
    map.objects.push({img,x:Math.round(x-img.width/2),y:Math.round(y-img.height),z:depth});
  }
  function block(map,x1,y1,x2,y2) {
    for(let y=0;y<ROWS;y++) for(let x=0;x<COLS;x++) {
      const px=x*TILE+8,py=y*TILE+8;
      if(px>=x1&&px<=x2&&py>=y1&&py<=y2)map.blocked.add(y*COLS+x);
    }
  }

  function treeSprite(index,kind,v) {
    const p=palettes[index], broad=kind==='oak';
    const w=broad?40:34,h=broad?42:47;
    return sprite('tree'+index+kind+v,w,h,c=>{
      const t=broad?p.tree:p.pine;
      const x=Math.floor(w/2);
      oval(c,p.turf[2],x+2,h-4,broad?15:12,3);
      rect(c,'#544c37',x-3,h-14,7,11);
      rect(c,'#8c7550',x-2,h-10,2,7);
      rect(c,'#715e42',x+1,h-9,2,7);
      rect(c,'#66593e',x-4,h-4,4,2);
      if(broad) {
        const silhouette=[[15,2],[23,2],[23,4],[29,4],[31,7],[33,9],[35,10],[35,15],[38,18],[38,25],[36,27],[36,30],[31,33],[25,33],[23,35],[17,34],[14,36],[8,34],[7,32],[4,32],[2,29],[2,24],[0,22],[1,17],[4,15],[3,12],[6,8],[10,7],[11,4],[15,4]];
        poly(c,t[0],silhouette);
        poly(c,t[1],[[15,4],[23,4],[27,6],[30,9],[32,10],[33,16],[36,19],[36,24],[34,25],[34,28],[30,31],[24,31],[21,33],[16,31],[13,33],[8,31],[5,28],[4,23],[2,21],[3,18],[6,15],[5,12],[8,10],[11,9]]);
        poly(c,t[2],[[12,7],[17,4],[23,5],[26,7],[29,8],[31,12],[30,16],[33,18],[33,23],[30,26],[25,27],[25,29],[19,29],[16,27],[12,30],[9,28],[8,26],[5,24],[4,20],[7,16],[6,13]]);
        poly(c,t[3],[[12,8],[17,5],[23,6],[24,8],[28,9],[29,13],[27,15],[29,17],[27,20],[24,21],[22,24],[17,23],[15,26],[11,25],[10,22],[7,21],[8,18],[7,16],[9,12],[12,11]]);
        poly(c,t[4],[[12,10],[13,8],[17,7],[20,7],[20,8],[24,9],[25,11],[23,13],[24,15],[21,18],[16,18],[15,21],[12,21],[11,19],[9,18],[10,15],[11,14]]);
        // Small overlapping leaf fans interrupt the silhouette's rounded masses.
        poly(c,t[2],[[24,16],[28,14],[31,16],[31,18],[34,19],[33,23],[30,25],[26,25],[24,22]]);
        poly(c,t[3],[[24,17],[27,15],[30,16],[30,18],[32,19],[30,21],[27,21],[26,23],[24,21]]);
        rect(c,t[4],26,16,3,1);rect(c,t[4],29,17,2,1);
        poly(c,t[2],[[11,23],[13,21],[17,22],[19,21],[21,22],[22,25],[20,28],[16,29],[13,27],[11,27]]);
        poly(c,t[3],[[12,23],[14,22],[17,23],[20,22],[20,24],[17,26],[14,25],[13,26]]);
        rect(c,t[4],15,23,2,1);rect(c,t[1],22,26,3,1);
        const rnd=random(81+v*23);
        for(let i=0;i<18;i++) {
          const xx=7+Math.floor(rnd()*23),yy=9+Math.floor(rnd()*17);
          const col=xx+yy<36?t[4]:t[2];
          rect(c,col,xx,yy,2+(i%2),1);
          if(i%3===0)rect(c,col,xx+2,yy-1,2,1);
        }
        for(const [xx,yy] of [[13,11],[17,9],[10,16],[18,15],[25,11]]) {
          rect(c,t[5],xx+v%2,yy,2,1);
          if(xx%2)rect(c,t[5],xx+1+v%2,yy-1,2,1);
        }
        for(const [xx,yy] of [[5,23],[9,27],[19,28],[27,25],[31,21],[15,22]]) {
          rect(c,t[1],xx,yy,2,1);rect(c,t[1],xx+2,yy-1,2,1);
        }
      } else {
        const tiers=[[1,16,7],[9,24,10],[15,32,13],[22,39,15]];
        [...tiers].reverse().forEach(([top,bottom,r])=>{
          const xx=x+(v===1?1:0),b=bottom;
          poly(c,t[0],[[xx,top],[xx+3,top+3],[xx+r-2,b-5],[xx+r-2,b-3],[xx+r,b-2],[xx+r,b],[xx+8,b],[xx+5,b+2],[xx+1,b+1],[xx-3,b+3],[xx-6,b+1],[xx-r+2,b+1],[xx-r,b-1],[xx-r+3,b-5]]);
          poly(c,t[1],[[xx,top+1],[xx+r-4,b-5],[xx+r-2,b-2],[xx+5,b-2],[xx+2,b],[xx-2,b-1],[xx-4,b+1],[xx-7,b-1],[xx-r+2,b-1]]);
          poly(c,t[2],[[xx,top+1],[xx+3,top+5],[xx+5,b-6],[xx+2,b-5],[xx+1,b-3],[xx-2,b-4],[xx-4,b-2],[xx-6,b-3],[xx-r+3,b-2]]);
          poly(c,t[3],[[xx,top+1],[xx+1,top+4],[xx-1,b-7],[xx-3,b-6],[xx-4,b-4],[xx-r+4,b-3]]);
          rect(c,t[4],xx-4,b-7,2,1);
        });
      }
    });
  }

  function windowPane(c,x,y) {
    rect(c,'#6a513f',x-1,y-1,10,10);
    rect(c,'#3e5556',x,y,8,7);
    rect(c,'#7d9c8d',x+1,y,2,4);rect(c,'#b3b69a',x+5,y+1,2,2);
    rect(c,'#ba9462',x+3,y,1,7);rect(c,'#ac895b',x,y+3,8,1);
    rect(c,'#e0bc86',x-2,y+7,12,2);rect(c,'#81664b',x-2,y+9,12,1);
  }

  function houseSprite(index,type) {
    const lodge=type==='lodge',mill=type==='mill';
    const w=lodge?76:54,h=lodge?62:49;
    const colors=palettes[index].roofs[lodge?0:1], p=palettes[index];
    return sprite('home'+index+type,w,h,c=>{
      const x=2,wallBottom=h-5,left=x+5,right=w-(mill?11:6);
      const eave=lodge?32:25, peak=lodge?11:8, far=right-7;
      oval(c,p.turf[2],Math.floor(w/2),h-4,Math.floor((w-5)/2),3);
      rect(c,'#5d5444',left, eave-1,right-left,wallBottom-eave+3);
      rect(c,'#d3af7c',left+1,eave,right-left-3,wallBottom-eave);
      rect(c,'#efd09a',left+2,eave+3,right-left-12,wallBottom-eave-5);
      poly(c,'#b69569',[[right-10,eave],[right,eave-5],[right,wallBottom-3],[right-10,wallBottom]]);
      rect(c,'#8f785c',left-1,wallBottom-1,right-left-6,3);
      for(let i=left+1;i<right-9;i+=7)rect(c,'#b7ab88',i,wallBottom,5,2);
      rect(c,'#866448',left+2,eave+2,3,wallBottom-eave-3);
      rect(c,'#886548',right-12,eave+1,3,wallBottom-eave-1);
      rect(c,'#ab865f',left+4,eave+9,right-left-15,2);
      // Masonry chimney, its cap and illuminated face.
      rect(c,'#5c524b',right-17,peak-8,8,13);
      rect(c,'#a28e76',right-16,peak-6,5,9);
      rect(c,'#c6af8f',right-16,peak-5,2,6);
      rect(c,'#63574f',right-18,peak-9,10,3);
      rect(c,'#a18c76',right-17,peak-9,8,1);
      const outer=[[x,eave],[left+9,peak-2],[far,peak-2],[right+4,eave-3],[right+4,eave],[right-5,eave+4],[x,eave+4]];
      poly(c,colors[0],outer);
      poly(c,colors[2],[[x+2,eave],[left+10,peak],[far,peak],[right-7,eave+1],[x+2,eave+1]]);
      poly(c,colors[1],[[far,peak],[right+2,eave-3],[right+2,eave-1],[right-6,eave+2],[right-8,eave+1]]);
      const slope=(left+10)-(x+2);
      for(let yy=peak+3,n=0;yy<eave;yy+=4,n++) {
        const t=(yy-peak)/(eave+1-peak);
        const a=Math.round(left+10-t*slope),b=Math.round(far+(right-7-far)*t);
        rect(c,colors[1],a,yy,b-a,1);
        for(let xx=a+(n%2?2:5);xx<b-1;xx+=7) {
          rect(c,colors[1],xx,yy-2,1,2);
          rect(c,colors[3],xx+1,yy-2,Math.min(4,b-xx-1),1);
        }
      }
      line(c,colors[4],left+10,peak-1,far,peak-1);
      line(c,colors[3],left+9,peak,x+2,eave);
      rect(c,'#634c3b',x+1,eave+3,right-x-6,2);
      rect(c,'#ae7950',x+3,eave+3,right-x-12,1);
      const door=lodge?35:26,doorTop=lodge?42:32;
      rect(c,'#7a573f',door-1,doorTop-1,10,wallBottom-doorTop+2);
      rect(c,'#67513f',door,doorTop,8,wallBottom-doorTop);
      rect(c,'#987448',door+1,doorTop+2,6,wallBottom-doorTop-3);
      rect(c,'#a98452',door+2,doorTop+3,1,wallBottom-doorTop-5);
      rect(c,'#e4bf76',door+5,doorTop+7,2,1);
      rect(c,'#ad9575',door-3,wallBottom+1,14,2);
      rect(c,'#ceba90',door-4,wallBottom+3,16,1);
      windowPane(c,left+7,wallBottom-13);
      if(lodge) {
        windowPane(c,50,wallBottom-13);
        // Half-timbered gable over the lodge entrance.
        poly(c,colors[0],[[24,35],[39,18],[54,34],[52,37],[39,23],[27,38]]);
        poly(c,'#e7c693',[[28,35],[39,23],[51,36]]);
        poly(c,'#76553e',[[27,35],[39,21],[52,35],[50,36],[39,25],[29,37]]);
        rect(c,'#886344',38,26,2,11);
        rect(c,'#987650',32,34,14,2);
        rect(c,'#6b533e',28,36,22,3);
        rect(c,'#bd9764',30,38,3,wallBottom-38);
        rect(c,'#ab8658',46,38,3,wallBottom-38);
        if(index===0) {
          poly(c,'#dba952',[[38,29],[42,27],[42,31],[39,33],[37,32]]);
        } else if(index===1) {
          poly(c,'#bc7445',[[37,33],[37,30],[39,28],[40,25],[42,29],[43,31],[41,33]]);
          rect(c,'#e9ac64',39,30,2,2);
        } else {
          oval(c,'#f1dca5',40,30,3,3);
          rect(c,'#e7c693',40,27,3,4);
          rect(c,'#a2929e',26,32,2,3);rect(c,'#a2929e',52,32,2,3);
        }
        rect(c,'#ffe0a0',38,29,1,1);
      }
      if(mill) {
        const wx=w-8,wy=h-11;
        oval(c,'#5c4c3f',wx,wy,7,9);
        oval(c,'#aa8153',wx,wy,5,7);
        oval(c,'#574c40',wx,wy,4,6);
        line(c,'#b49361',wx,wy-6,wx,wy+6);
        line(c,'#b49361',wx-5,wy,wx+5,wy);
        line(c,'#a78256',wx-3,wy-5,wx+3,wy+5);
        line(c,'#a78256',wx+3,wy-5,wx-3,wy+5);
        rect(c,'#d0aa73',wx-1,wy-1,3,2);
      }
      if(type==='camp') {
        // Porch planter.
        rect(c,'#866c48',left+4,wallBottom-2,11,2);
        rect(c,'#678550',left+4,wallBottom-5,10,3);
        [left+5,left+9,left+12].forEach(xx=>rect(c,p.bloom[0],xx,wallBottom-6,2,2));
      }
    });
  }

  function fence(map,index,x,y,length) {
    const img=sprite('fence'+index+'-'+length,length+4,12,c=>{
      rect(c,'#796946',1,4,length,2);
      rect(c,'#d5b77a',1,4,length,1);
      rect(c,'#89724c',1,8,length,2);
      rect(c,'#baa171',1,8,length,1);
      const n=Math.ceil(length/12);
      for(let i=0;i<=n;i++) {
        const px=Math.round(i*length/n);
        rect(c,'#766147',px,2,4,10);
        rect(c,'#ab885b',px,1,3,10);
        rect(c,'#d7b379',px,1,2,9);
        rect(c,'#ecd296',px+1,0,2,2);
        rect(c,'#806944',px+1,5,1,1);
      }
    });
    place(map,img,x+length/2,y+2);
    block(map,x-1,y-4,x+length+3,y+2);
  }
  function garden(c,p,x,y,w,h) {
    poly(c,'#997d53',[[x+2,y],[x+w,y],[x+w,y+h-2],[x+w-2,y+h],[x,y+h],[x,y+2]]);
    for(let row=y+1;row<y+h;row+=4) {
      rect(c,'#b89a66',x+1,row,w-2,1);
      for(let px=x+2;px<x+w-2;px+=5) {
        rect(c,'#668344',px,row-1,3,3);
        rect(c,'#9ab064',px-1,row-2,2,2);
        rect(c,'#c1ca74',px+1,row-2,2,2);
        if((x+px)%3===0)rect(c,p.bloom[0],px+1,row-2,2,1);
      }
    }
  }
  function rockSprite(index,small) {
    return sprite('rock'+index+small,small?9:16,small?7:12,c=>{
      const a=index===1?['#77684f','#9e8868','#bfa780','#dac39c']:['#5c7061','#7e8d79','#9da992','#c0c4a2'];
      if(small) {
        poly(c,a[0],[[0,5],[2,2],[6,1],[9,4],[8,6],[2,7]]);
        poly(c,a[1],[[1,4],[3,2],[6,2],[8,5],[4,6],[1,5]]);
        rect(c,a[2],3,2,3,1);
      } else {
        poly(c,a[0],[[0,8],[2,4],[5,2],[9,1],[13,3],[15,6],[16,9],[12,11],[4,12],[1,10]]);
        poly(c,a[1],[[2,8],[3,5],[6,3],[9,2],[13,4],[14,8],[11,10],[5,10]]);
        poly(c,a[2],[[2,7],[4,5],[6,3],[9,3],[11,5],[8,7],[5,8]]);
        rect(c,a[3],5,4,4,1);rect(c,a[0],11,8,2,1);
      }
    });
  }
  function tallGrass(c,p,x,y,rnd) {
    const shade=p.tree[2], mid=p.turf[4], light=p.turf[3];
    for(let i=0;i<115;i++) {
      const u=rnd()*2-1,v=rnd()*2-1;
      if(u*u+v*v>1) continue;
      const xx=Math.round(x+u*21),yy=Math.round(y+v*10);
      rect(c,mid,xx-2,yy-1,5,2);
      line(c,shade,xx,yy,xx-2,yy-3);
      line(c,mid,xx,yy,xx+2,yy-5);
      rect(c,light,xx+1,yy-4,1,2);
      if(i%7===0) {
        rect(c,p.bloom[1],xx+2,yy-5,2,2);rect(c,p.bloom[2],xx+2,yy-5,1,1);
      }
    }
  }
  function bridge(map,index,region) {
    const p=palettes[index], cy=region.bridgeY, cx=Math.round(riverX(region,cy));
    const half=Math.ceil(bankWidth(region,cy))+9,left=cx-half,ww=2*half+1;
    const c=map.ground;
    rect(c,p.water[0],left+2,cy+9,ww-2,4);
    rect(c,'#655540',left,cy-9,ww,20);
    for(let i=1;i<ww-1;i+=4) {
      const w=Math.min(3,ww-i-1);
      rect(c,i%3===0?'#cba772':'#be9967',left+i,cy-8,w,17);
      rect(c,'#d8b983',left+i,cy-7,1,12);
      if(i%3===1)rect(c,'#a98a61',left+i+1,cy-2,1,5);
    }
    function railing() {
      return sprite('bridge-rail-'+ww,ww+2,10,ctx=>{
        rect(ctx,'#715e45',1,3,ww,2);
        rect(ctx,'#d0ae77',1,2,ww,1);
        const pieces=Math.ceil(ww/15);
        for(let i=0;i<=pieces;i++) {
          const xx=Math.round(i*(ww-2)/pieces);
          rect(ctx,'#715c43',xx,1,4,9);
          rect(ctx,'#a88960',xx+1,1,2,7);
          rect(ctx,'#e2c18b',xx,0,3,2);
        }
      });
    }
    const rail=railing();
    place(map,rail,cx+1,cy-7,cy-8);
    place(map,rail,cx+1,cy+11,cy+11);
    map.bridge={x1:left-2,x2:left+ww+2,y1:cy-9,y2:cy+9};
  }

  function signSprite(index,kind) {
    return sprite('sign'+index+kind,17,20,c=>{
      const p=palettes[index];
      oval(c,p.turf[2],9,18,6,1);
      rect(c,'#69593e',7,5,3,13);rect(c,'#a68c5e',7,7,1,10);
      if(kind==='travel') {
        poly(c,'#68563e',[[2,2],[11,2],[15,4],[11,7],[2,7]]);
        poly(c,'#cbab70',[[2,2],[11,2],[14,4],[11,5],[2,5]]);
        poly(c,'#776348',[[4,9],[14,9],[14,13],[4,13],[1,11]]);
        poly(c,'#b49b69',[[4,8],[14,8],[14,11],[4,11],[2,10]]);
        rect(c,'#8f7351',4,3,5,1);rect(c,'#d0b582',6,9,5,1);
      } else {
        rect(c,'#705a40',1,3,14,9);rect(c,'#c8aa76',2,3,12,7);
        rect(c,'#967448',4,5,8,1);rect(c,'#9b7d52',4,7,6,1);
      }
    });
  }
  function banner(index) {
    return sprite('banner'+index,12,24,c=>{
      const bannerColors=[['#3f705f','#719e7b'],['#a15543','#cf7751'],['#6a5f8e','#9e86ae']][index];
      rect(c,'#5c5540',2,0,2,23);rect(c,'#bda16c',2,0,1,22);
      rect(c,'#866e4f',3,1,9,2);
      poly(c,bannerColors[0],[[4,3],[11,3],[11,15],[8,13],[4,16]]);
      rect(c,bannerColors[1],5,3,2,10);
      poly(c,'#e8c879',[[5,8],[8,5],[10,7],[7,11]]);
      rect(c,'#e8cb83',2,0,3,2);
    });
  }
  const personPattern=[
    '       XXX      ',
    '     XXhhhXX    ',
    '    XhHHHHhhX   ',
    '   XhHHHHHhhhX  ',
    '   XhhhrrrRrrX  ',
    '  XrrRRRRRRRrrX ',
    '   XXkkkkkkXXX  ',
    '    XkffFffkX   ',
    '    XfXfFfXfX   ',
    '     XffFffX    ',
    '     XrrrrrX    ',
    '    XrrRRrrrX   ',
    '   XppccCcrrpX  ',
    '   XpfccCccrpX  ',
    '   XffbbBbbffX  ',
    '    XXXccccXX   ',
    '     XppXppX    ',
    '     XppXppX    ',
    '    XbbbXbbbX   ',
    '    XXXXXXXX    '
  ];
  function explorer(index,kind,dir) {
    let facing=String(dir||'down').toLowerCase();
    if(facing==='north')facing='up';
    if(facing==='east')facing='right';
    if(facing==='west')facing='left';
    const key=kind+index+facing;
    return sprite('person'+key,18,23,c=>{
      const p=palettes[index];
      const colors={
        X:'#3c4036',h:'#a98751', H:'#e3c889', r:'#a74338', R:'#e66e4e',
        k:'#684d37',f:'#dba674',F:'#f4c695',p:'#4f6761',c:'#667f70',C:'#8eaa83',b:'#69533e',B:'#d6af67'
      };
      if(kind==='warden') {
        Object.assign(colors,[
          {h:'#526e4e',H:'#87a56c',r:'#446751',R:'#92af69',k:'#644e3c',c:'#51795d',C:'#9baa75',p:'#586255'},
          {h:'#a4533b',H:'#d5764d',r:'#684d41',R:'#a4b4a0',k:'#664e3b',c:'#776151',C:'#a08a66',p:'#545958'},
          {h:'#a9b4b9',H:'#d4d8cf',r:'#aab4b7',R:'#c9cfcf',k:'#aab3b7',c:'#475770',C:'#74879e',p:'#535f77'}
        ][index]);
      }
      if(kind==='camper')Object.assign(colors,{h:'#816951',H:'#d8b68a',r:'#4d6e77',R:'#8aa9a6',k:'#735139',c:'#b8966e',C:'#cbae85',p:'#66716a'});
      oval(c,p.turf[4],9,21,6,1);
      personPattern.forEach((row,y)=>{
        [...row].forEach((symbol,x)=>{
          if(symbol===' ')return;
          let color=colors[symbol];
          if(facing==='up' && y>=7&&y<=9 && (symbol==='f'||symbol==='F'||(symbol==='X'&&x>5&&x<11)))color=colors.k;
          if((facing==='right'||facing==='left') && y===8&&x===6)color=colors.f;
          const xx=facing==='left'?16-x:x+1;
          rect(c,color,xx,y+1,1,1);
        });
      });
      if(kind==='warden'&&index===0) {
        rect(c,'#e9bc72',5,3,3,3);rect(c,'#fcdaa1',5,3,1,1);
      }
      if(kind==='warden'&&index===1) {
        rect(c,'#424d4d',5,5,9,3);
        rect(c,'#a6c1b1',6,5,2,2);rect(c,'#b4c9ba',11,5,2,2);
      }
      if(facing==='up'&&kind==='player') {
        rect(c,colors.X,6,13,7,5);rect(c,'#a57b4f',7,12,5,5);rect(c,'#d3a56d',7,12,5,2);
        rect(c,'#6f533c',9,14,2,2);
      }
    });
  }
  function wildSprite(index) {
    return sprite('wild'+index,17,15,c=>{
      const p=palettes[index];
      oval(c,p.turf[2],9,13,6,1);
      if(index===0) {
        // Mossbell's flowered shell, feet and little turtle head.
        poly(c,'#495c40',[[1,10],[3,9],[4,5],[7,3],[12,3],[14,7],[15,8],[16,8],[16,11],[14,12],[12,12],[12,14],[10,14],[9,12],[6,12],[5,14],[3,13],[3,12],[1,12]]);
        poly(c,'#679657',[[4,9],[5,6],[8,4],[11,4],[13,7],[13,9],[11,11],[6,11]]);
        rect(c,'#8fb45e',6,6,4,3);rect(c,'#b4c975',8,5,3,2);
        rect(c,'#bbbc78',13,8,3,3);rect(c,'#46563c',15,8,1,1);
        rect(c,'#e9ba7d',6,3,3,2);rect(c,'#fff2ae',7,2,1,2);
        rect(c,'#e1ab82',11,4,3,2);rect(c,'#f8d496',12,3,1,2);
      } else if(index===1) {
        const wing=[[0,2],[4,2],[8,6],[10,9],[6,12],[2,11],[4,8],[1,7]];
        poly(c,'#61453c',wing);
        poly(c,'#61453c',wing.map(([x,y])=>[17-x,y]));
        for(const d of [0,1]) {
          const mx=x=>d?15-x:x;
          rect(c,'#a35c44',mx(3),4,2,3);rect(c,'#d28d5a',mx(4),5,2,2);
          rect(c,'#e7b679',mx(5),7,2,1);rect(c,'#9f7055',mx(5),9,2,2);
        }
        rect(c,'#544d45',8,6,2,6);rect(c,'#ddaf69',8,6,2,2);
        rect(c,'#765444',6,4,1,2);rect(c,'#765444',10,4,1,2);
      } else {
        poly(c,'#465f71',[[0,8],[3,5],[6,5],[8,2],[10,2],[13,6],[16,8],[16,10],[12,9],[10,11],[9,14],[7,14],[8,10],[5,10],[3,9],[0,10]]);
        poly(c,'#819db1',[[1,8],[5,6],[7,6],[9,3],[12,7],[15,8],[12,8],[9,10],[6,9],[4,8]]);
        rect(c,'#acc3c2',6,7,4,2);rect(c,'#cbd7c5',8,4,2,2);
        rect(c,'#efdaa2',3,7,1,1);rect(c,'#efdaa2',12,7,1,1);
      }
    });
  }

  function firepit(index) {
    return sprite('fire'+index,18,16,c=>{
      const stones=['#7f8773','#adad8a','#6d7767'];
      oval(c,palettes[index].turf[2],9,13,8,2);
      oval(c,'#675b46',9,11,6,2);
      [[3,11],[5,13],[10,14],[14,12],[14,10],[6,9]].forEach(([x,y],i)=>{
        rect(c,stones[i%3],x-1,y,3,2);rect(c,'#bfb895',x-1,y,2,1);
      });
      rect(c,'#826649',4,11,9,2);
      poly(c,'#ae6241',[[5,10],[6,6],[8,8],[9,5],[10,2],[12,6],[13,9],[12,11],[8,12]]);
      poly(c,'#e89854',[[6,10],[8,8],[9,9],[10,5],[12,8],[11,11],[8,11]]);
      rect(c,'#f5d387',9,8,2,3);
    });
  }
  function cliff(index,wide) {
    const w=wide?44:31,h=wide?20:16;
    return sprite('cliff'+index+w,w,h,c=>{
      const shadow='#786850',mid='#a48765',light='#c5a77d',high='#ddc69b',g=palettes[index].turf;
      oval(c,g[2],w/2,h-2,Math.floor(w/2)-1,2);
      poly(c,shadow,[[1,h-8],[6,5],[12,4],[16,1],[w-10,2],[w-7,4],[w-2,6],[w-1,h-3],[w-7,h],[w-18,h-2],[w-23,h-1],[6,h-1]]);
      poly(c,mid,[[2,h-9],[9,6],[18,3],[w-10,3],[w-8,6],[w-3,7],[w-3,h-4],[w-7,h-2],[w-17,h-4],[w-23,h-3],[8,h-3],[3,h-5]]);
      poly(c,light,[[3,h-9],[8,7],[14,6],[19,3],[w-11,3],[w-8,6],[w-4,7],[w-7,10],[w-17,8],[w-22,10],[9,10]]);
      rect(c,high,10,7,5,1);rect(c,high,w-18,4,5,1);
      line(c,'#897256',6,h-7,14,h-5);line(c,'#897256',14,h-5,20,h-6);
      line(c,'#897256',w-9,12,w-5,11);
      rect(c,shadow,14,h-8,1,4);rect(c,light,15,h-6,2,1);
      rect(c,mid,7,h-4,4,1);rect(c,'#e0b578',w-12,11,2,2);
    });
  }
  function moonwell() {
    return sprite('well',23,20,c=>{
      oval(c,'#698e7b',12,17,11,2);
      oval(c,'#586a70',11,14,9,5);
      rect(c,'#84969a',2,9,19,6);oval(c,'#8d9da0',11,14,9,3);
      rect(c,'#687d84',3,14,5,1);rect(c,'#687d84',14,15,6,1);
      rect(c,'#687d84',8,12,1,4);rect(c,'#687d84',16,11,1,3);
      oval(c,'#b3c0b5',11,9,10,5);oval(c,'#5a7887',11,9,7,3);
      oval(c,'#7baeb6',11,10,6,2);rect(c,'#d3dbbd',8,9,5,1);
      [[4,4],[18,5],[2,9],[19,11]].forEach(([x,y])=>{rect(c,'#877e91',x,y,3,3);rect(c,'#ceb4c5',x+1,y-1,2,2);});
    });
  }
  function questMarker(c,x,y,frame) {
    const top=y-((Math.sin(frame/360)>.35)?1:0);
    poly(c,'#705c36',[[x-3,top],[x+3,top],[x+5,top+2],[x+5,top+7],[x+1,top+10],[x-1,top+10],[x-5,top+7],[x-5,top+2]]);
    poly(c,'#f1ca6c',[[x-3,top+1],[x+3,top+1],[x+4,top+2],[x+4,top+6],[x,top+9],[x-4,top+6],[x-4,top+2]]);
    rect(c,'#fff0a1',x-3,top+2,2,1);
    rect(c,'#664f37',x,top+2,1,3);rect(c,'#664f37',x,top+6,1,1);
  }

  function build(index) {
    const region=regions[index],map=terrain(index),p=palettes[index],rnd=random(8613+index*719);
    const ground=map.ground;
    const at=id=>region.sites.find(s=>s.id===id);
    const keeper=at('warden'),camper=at('camp'),travel=at('travel');
    const hot=(s,x1,y1,x2,y2)=>map.hotspots.push({s,x1,y1,x2,y2});
    region.gardens.forEach(([x,y,w,h])=>garden(ground,p,x,y,w,h));
    tallGrass(ground,p,...region.wild,rnd);
    const wildSite=region.sites.find(v=>v.id==='wild');
    tallGrass(ground,p,wildSite.x*TILE+14,wildSite.y*TILE+3,rnd);
    for(let y=3;y<H-3;y+=4+Math.floor(rnd()*8)) {
      const center=riverX(region,y), w=bankWidth(region,y);
      const side=rnd()>.5?1:-1, x=Math.round(center+side*(w+1));
      for(let n=0;n<4;n++) {
        const a=x+Math.round(rnd()*4)-2,b=y+Math.round(rnd()*4);
        line(ground,p.turf[4],a,b,a+Math.round(rnd()*3)-1,b-3-Math.floor(rnd()*3));
        rect(ground,p.turf[3],a,b-4,1,2);
      }
      if(rnd()<.3) {
        const xx=Math.round(center+(w-5)*side);
        oval(ground,p.water[0],xx,y,3,1);
        rect(ground,p.turf[2],xx-2,y-1,5,1);rect(ground,p.turf[3],xx-1,y-2,3,1);
      }
      if(rnd()<.48)map.sparks.push({x:Math.round(center+(rnd()-.5)*w*1.4),y,phase:rnd()*7});
    }
    bridge(map,index,region);
    if(index===1) {
      [[151,64,true],[275,42,false],[319,134,true],[100,173,false]].forEach(([x,y,wide])=>{
        const img=cliff(index,wide);
        place(map,img,x,y);block(map,x-img.width/2+4,y-img.height/2,x+img.width/2-4,y-1);
      });
    }
    if(index===2) {
      place(map,moonwell(),124,72);
      block(map,115,63,132,72);
      hot(keeper,112,52,135,72);
    }
    region.stones.forEach(([x,y],i)=>{
      const r=rockSprite(index,i%3===1);
      place(map,r,x,y);block(map,x-r.width/2+2,y-r.height/2,x+r.width/2-2,y-1);
      if(i%3===0)place(map,rockSprite(index,true),x+7,y+1);
    });
    for(const [type,x,y] of region.houses) {
      const img=houseSprite(index,type);
      place(map,img,x,y,y-5);
      const entrance=type==='lodge'?keeper:type==='camp'?camper:region.sites[4];
      hot(entrance,x-img.width/2+1,y-img.height+4,x+img.width/2-2,y+3);
      if(type==='camp') {
        const fireX=x-17,fireY=y+13;
        place(map,firepit(index),fireX,fireY);
        hot(camper,fireX-8,fireY-14,fireX+8,fireY);
      }
      block(map,x-img.width/2+5,y-img.height+6,x+img.width/2-4,y-3);
      if(type==='lodge') {
        place(map,banner(index),x+img.width/2-1,y+6);
        place(map,signSprite(index,'lodge'),x-img.width/2-2,y+3);
      }
    }
    for(const [x,y,len] of region.fences) fence(map,index,x,y,len);
    const clearViews=[
      [travel.x*TILE+21,travel.y*TILE+9],
      [wildSite.x*TILE+17,wildSite.y*TILE+6]
    ];
    // The groves are staggered, with peninsulas of canopy extending into clearings.
    for(let g=0;g<region.groves.length;g++) {
      const [x1,y1,x2,y2]=region.groves[g];
      let row=0;
      for(let cy=y1;cy<y2;cy+=15,row++) {
        for(let cx=x1-(row%2)*10;cx<x2;cx+=20) {
          const x=cx+Math.round(rnd()*5),y=cy+Math.round(rnd()*5);
          if(x>0&&x<W&&y>0&&y<H) {
            if(Math.abs(x-riverX(region,y))<bankWidth(region,y)+5)continue;
            if(distanceToPath(x,y,region.paths)<17)continue;
          }
          if(clearViews.some(([px,py])=>Math.abs(px-x)<22&&y>=py-2&&y<py+43))continue;
          const conifer=(g+index)%3===0?rnd()<.8:rnd()<.17;
          const img=treeSprite(index,conifer?'pine':'oak',Math.floor(rnd()*3));
          place(map,img,x,y,y-2);
          block(map,x-7,y-11,x+7,y+1);
        }
      }
    }
    hot(keeper,keeper.x*TILE+8,keeper.y*TILE-25,keeper.x*TILE+26,keeper.y*TILE+10);
    hot(camper,camper.x*TILE+3,camper.y*TILE-19,camper.x*TILE+21,camper.y*TILE+5);
    hot(travel,travel.x*TILE+12,travel.y*TILE-10,travel.x*TILE+30,travel.y*TILE+10);
    hot(wildSite,region.wild[0]-22,region.wild[1]-12,region.wild[0]+21,region.wild[1]+10);
    hot(wildSite,wildSite.x*TILE-7,wildSite.y*TILE-10,wildSite.x*TILE+31,wildSite.y*TILE+12);
    place(map,explorer(index,'warden','down'),keeper.x*TILE+17,keeper.y*TILE+9);
    place(map,explorer(index,'camper','down'),camper.x*TILE+12,camper.y*TILE+4);
    place(map,signSprite(index,'travel'),travel.x*TILE+21,travel.y*TILE+9);
    place(map,wildSprite(index),wildSite.x*TILE+17,wildSite.y*TILE+6);
    map.objects.sort((a,b)=>a.z-b.z);
    for(const s of [...region.sites,region.spawn])map.blocked.delete(s.y*COLS+s.x);
    return map;
  }
  function regionMap(index) {
    if(!regions[index])return null;
    if(!cache[index])cache[index]=build(index);
    return cache[index];
  }
  function walkable(index,x,y) {
    if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||x>=COLS||y<0||y>=ROWS)return false;
    const map=regionMap(index);
    if(!map||map.blocked.has(y*COLS+x))return false;
    const px=x*TILE+8,py=y*TILE+8,b=map.bridge;
    if(px>=b.x1&&px<=b.x2&&py>=b.y1&&py<=b.y2)return true;
    return map.kind[py*W+px]!==WATER;
  }
  function draw(canvas,index,player,frame=0) {
    const map=regionMap(index);
    if(!canvas||!map)return;
    if(canvas.width!==W)canvas.width=W;
    if(canvas.height!==H)canvas.height=H;
    const c=canvas.getContext('2d');
    c.imageSmoothingEnabled=false;
    c.drawImage(map.ground.canvas,0,0);
    const t=Number.isFinite(frame)?frame*.001:0;
    for(const s of map.sparks) {
      const f=Math.sin(t*2+s.phase);
      if(f>.35) {
        rect(c,palettes[index].water[3],s.x,s.y,3,1);
        if(f>.85)rect(c,palettes[index].water[4],s.x+3,s.y-1,2,1);
      }
    }
    const pos=player||regions[index].spawn;
    const px=Math.round(pos.x*TILE+8),py=Math.round(pos.y*TILE+10);
    const character=explorer(index,'player',pos.facing||pos.dir);
    let drawn=false;
    for(const o of map.objects) {
      if(!drawn&&o.z>py) {
        c.drawImage(character,px-Math.floor(character.width/2),py-character.height);
        drawn=true;
      }
      c.drawImage(o.img,o.x,o.y);
    }
    if(!drawn)c.drawImage(character,px-Math.floor(character.width/2),py-character.height);
    if(pos.questActive!==false) {
      const s=regions[index].sites.find(s=>s.id==='warden');
      questMarker(c,s.x*TILE+17,s.y*TILE-26,frame);
    }
  }
  function hitTile(canvas,clientX,clientY) {
    const bounds=canvas.getBoundingClientRect();
    return {
      x:Math.floor((clientX-bounds.left)*COLS/bounds.width),
      y:Math.floor((clientY-bounds.top)*ROWS/bounds.height)
    };
  }
  function siteAt(index,x,y) {
    const region=regions[index];
    if(!region||!Number.isInteger(x)||!Number.isInteger(y))return null;
    const exact=region.sites.find(s=>s.x===x&&s.y===y);
    if(exact)return exact;
    // hitTile returns a whole tile; match the visible object with the largest
    // overlap, including thin signs and characters standing on a tile edge.
    const left=x*TILE,top=y*TILE;
    let best=null,area=12;
    for(const spot of regionMap(index).hotspots) {
      const w=Math.max(0,Math.min(left+TILE,spot.x2)-Math.max(left,spot.x1));
      const h=Math.max(0,Math.min(top+TILE,spot.y2)-Math.max(top,spot.y1));
      if(w*h>area) {best=spot.s;area=w*h;}
    }
    return best;
  }
  window.WilderWorld={regions,walkable,draw,hitTile,siteAt};
})();
