// Exchange two pairing slips on the same network, then carry the ordinary turn packets over WebRTC.
(() => {
  "use strict";
  const prefix="WILDERKIN-WIFI1.";
  const channelName="wilderkin-bellpost-v1";
  const usable=r=>r?.status==="active" && (r.seat===0 || r.seat===1);
  const capable=()=>typeof window.RTCPeerConnection==="function" && !!window.crypto?.getRandomValues;

  function makeSlip(session) {
    const {id,seat,nonce,pc}=session;
    const {type,sdp}=pc.localDescription;
    return prefix+btoa(JSON.stringify({id,seat,nonce,type,sdp}));
  }

  function readSlip(text,record) {
    const value=text.trim();
    if(value.length>32000 || !value.startsWith(prefix))return null;
    try{
      const data=JSON.parse(atob(value.slice(prefix.length)));
      if(data.id!==record.id || data.seat!==1-record.seat || !/^[0-9a-f]{16}$/.test(data.nonce) ||
        !["offer","answer"].includes(data.type) || typeof data.sdp!=="string")return null;
      const media=data.sdp.split(/\r?\n/).filter(line=>line.startsWith("m="));
      if(media.length!==1 || !/^m=application \d+ UDP\/DTLS\/SCTP webrtc-datachannel$/.test(media[0]))return null;
      return data;
    }catch{return null;}
  }

  function gathered(pc) {
    return new Promise((resolve,reject)=>{
      const finish=()=>{
        clearTimeout(timer);
        pc.removeEventListener("icegatheringstatechange",check);
        if(pc.localDescription?.sdp.includes("a=candidate:"))resolve();
        else reject(new Error("No local network route"));
      };
      const check=()=>{if(pc.iceGatheringState==="complete")finish();};
      const timer=setTimeout(finish,6000);
      pc.addEventListener("icegatheringstatechange",check);
      check();
    });
  }

  function localIPv4(text) {
    const parts=text.trim().split(".");
    if(parts.length!==4 || parts.some(p=>!/^\d{1,3}$/.test(p)||Number(p)>255))return null;
    const octets=parts.map(Number),[a,b]=octets;
    return a===10 || a===192&&b===168 || a===172&&b>=16&&b<=31 || a===169&&b===254 ? octets.join(".") : null;
  }

  function create({rules,row,render,notify}) {
    const sessions=new Map();
    const current=s=>sessions.get(s.id)===s;
    const connected=id=>Boolean(sessions.get(id)?.ready);
    const status=id=>connected(id)?"Direct play connected":sessions.get(id)?.message||"Turn links available";

    function close(id,message) {
      const s=sessions.get(id);
      sessions.delete(id);
      if(s){
        clearTimeout(s.timeout);
        clearTimeout(s.helpTimer);
        s.channel?.close();
        s.pc?.close();
      }
      if(message)sessions.set(id,{id,message});
      render();
    }

    function transmit(s) {
      const hash=rules.export(s.id);
      if(typeof hash!=="string" || s.channel?.readyState!=="open")return;
      s.channel.send(JSON.stringify({id:s.id,seat:s.seat,hash}));
      if(rules.get(s.id)?.status==="done")s.finalHash=hash;
    }

    function send(id) {
      const s=sessions.get(id),r=rules.get(id);
      // A free replacement belongs with the player's following move.
      if(!s?.ready || !r || (r.status==="active" && r.pos.turn===r.seat))return;
      try{transmit(s);}catch{close(id,"Direct play stopped. Your latest turn link is ready.");}
    }

    function attach(s,channel) {
      if(!current(s) || s.channel || channel.label!==channelName){channel.close();return;}
      s.channel=channel;
      channel.onopen=()=>{if(current(s))transmit(s);};
      channel.onclose=()=>{
        if(current(s))close(s.id,rules.get(s.id)?.status==="done"?null:"The other browser disconnected. Continue with turn links or pair again.");
      };
      channel.onmessage=async event=>{
        if(!current(s) || typeof event.data!=="string" || event.data.length>5000)return;
        let packet;
        try{packet=JSON.parse(event.data);}catch{return;}
        if(packet.id!==s.id || packet.seat!==1-s.seat || typeof packet.hash!=="string")return;
        const received=rules.inspect(packet.hash);
        if(!received || received.id!==s.id)return;
        const result=await rules.receive(packet.hash);
        if(!current(s))return;
        if(!result?.ok && result?.code!=="stale"){
          if(!s.ready || result?.code==="fork")close(s.id,"The two match histories differ. Open the latest turn link to resume.");
          return;
        }
        if(received.status==="done" && rules.get(s.id)?.hash===packet.hash){
          if(s.finalHash!==packet.hash)transmit(s);
          setTimeout(()=>{if(current(s))close(s.id);},350);
          render();return;
        }
        if(!s.ready){
          s.ready=true;clearTimeout(s.timeout);s.slip=null;
          notify("Both browsers are connected.");
        }
        // Both browsers keep their latest lawful turn. Catch up a peer that paired from an older letter.
        if(result.code==="stale" && rules.export(s.id)!==packet.hash)transmit(s);
        render();
      };
    }

    function start(record,nonce) {
      if(sessions.has(record.id))close(record.id);
      const pc=new window.RTCPeerConnection({iceServers:[]});
      const s={id:record.id,seat:record.seat,nonce,pc,slip:null,ready:false,message:"Finding a direct connection…"};
      sessions.set(s.id,s);
      pc.ondatachannel=e=>attach(s,e.channel);
      pc.onconnectionstatechange=()=>{
        if(current(s) && pc.connectionState==="failed")close(s.id,"The browsers could not reach each other. Use a turn link or pair on another network.");
      };
      render();
      return s;
    }

    function waitForPeer(s) {
      clearTimeout(s.timeout);
      s.timeout=setTimeout(()=>{
        if(current(s) && !s.ready)close(s.id,"Pairing expired. Make a new slip or send a turn link.");
      },180000);
    }

    function showAddressHelp(s) {
      clearTimeout(s.helpTimer);
      s.helpTimer=setTimeout(()=>{
        if(current(s)&&!s.ready&&s.pc.remoteDescription?.sdp.includes(".local")){
          s.addressHelp=true;render();
        }
      },4500);
    }

    async function addAddress(s) {
      const text=window.prompt("Enter the IPv4 address in your friend’s Wi-Fi settings (for example 192.168.1.24).","");
      if(!text)return;
      const address=localIPv4(text);
      if(!address){notify("Use the private IPv4 address shown for your friend’s Wi-Fi connection.");return;}
      // Some networks block lookup of the temporary .local names supplied by the browser.
      // Keep the port, transport and session credentials from the already exchanged pairing slip.
      const lines=s.pc.remoteDescription.sdp.split(/\r?\n/).filter(line=>line.startsWith("a=candidate:"));
      try{
        for(const line of lines){
          const candidate=line.slice(2).split(" ");
          if(candidate[2].toLowerCase()!=="udp" || !candidate[4].endsWith(".local") || candidate[7]!=="host")continue;
          candidate[4]=address;
          await s.pc.addIceCandidate({candidate:candidate.join(" "),sdpMLineIndex:0});
        }
        if(current(s)&&!s.ready){s.message="Trying your friend’s Wi-Fi address…";render();}
      }catch{if(current(s))notify("Could not use that address. You can still send your turn link.");}
    }

    async function pair(record,data) {
      let s=sessions.get(record.id);
      try{
        if(data?.type==="answer"){
          if(!s?.pc || s.nonce!==data.nonce || s.pc.signalingState!=="have-local-offer"){
            notify("Paste this reply in the tab that made the original slip.");return;
          }
          await s.pc.setRemoteDescription({type:data.type,sdp:data.sdp});
          if(current(s)&&!s.ready){s.slip=null;s.message="Pairing slips exchanged. Connecting…";showAddressHelp(s);render();}
          return;
        }
        const nonce=data?.nonce || Array.from(window.crypto.getRandomValues(new Uint8Array(8)),v=>v.toString(16).padStart(2,"0")).join("");
        s=start(record,nonce);
        if(data){
          await s.pc.setRemoteDescription({type:"offer",sdp:data.sdp});
          await s.pc.setLocalDescription(await s.pc.createAnswer());
        }else{
          attach(s,s.pc.createDataChannel(channelName));
          await s.pc.setLocalDescription(await s.pc.createOffer());
        }
        await gathered(s.pc);
        if(!current(s)||s.ready)return;
        s.slip=makeSlip(s);
        s.message=data?"Give the reply slip to the player who started pairing.":"Give this slip to your friend. Paste their reply here.";
        if(data)showAddressHelp(s);
        waitForPeer(s);render();
      }catch{
        if(s&&current(s))close(s.id,"Pairing could not finish. Your duel can continue with turn links.");
        else notify("This browser could not open a direct connection.");
      }
    }

    function link(record) {
      return usable(record)&&capable()?row("post-wire","Play on the same Wi-Fi",record.id,
        connected(record.id)?"Direct play connected":"Pair two open browsers to exchange moves automatically."):null;
    }

    function model(record) {
      const id=record.id,s=sessions.get(id),rows=[];
      if(usable(record)&&capable()){
        if(!s?.pc)rows.push(row("wire-new","Make a pairing slip",id,"One player starts. The other enters their slip here.",{tone:"primary"}));
        if(s?.slip)rows.push(row("wire-copy","Copy pairing slip",id,"Send it to your friend yourself.",{tone:"primary"}));
        if(!s?.ready)rows.push(row("wire-paste","Enter friend’s slip",id,"Paste the whole slip or reply into this tab."));
        if(s?.addressHelp&&!s.ready)rows.push(row("wire-address","Use friend’s Wi-Fi address",id,"If pairing stalls, enter the IPv4 address in their Wi-Fi settings."));
        if(s?.pc)rows.push(row("wire-close",s.ready?"Disconnect direct play":"Cancel pairing",id,"Your saved duel stays available by turn link."));
      }
      rows.push(row("post-battle","Return to the duel",id,s?.ready?"Moves arrive automatically while both tabs stay open.":"Open the board or share the latest turn link."));
      return {title:"Same-Wi-Fi play",kicker:"BELLPOST",subtitle:"Keep both match tabs open on the same local network. Exchange two pairing slips once. Some guest networks keep devices apart.",
        sections:[{title:status(id),rows}]};
    }

    function act(action,value,record) {
      if(!action.startsWith("wire-"))return false;
      if(!usable(record)||record.id!==value||!capable())return true;
      const s=sessions.get(value);
      if(action==="wire-new"&&!s?.pc)void pair(record);
      else if(action==="wire-paste"&&!s?.ready){
        const text=window.prompt("Paste your friend’s Bellpost pairing slip","");
        if(text){
          const data=readSlip(text,record);
          if(data)void pair(record,data);
          else notify("This slip does not match the other seat of this duel.");
        }
      }else if(action==="wire-copy"&&s?.slip){
        const value=s.slip,manual=()=>window.prompt("Copy your Bellpost pairing slip",value);
        if(window.navigator?.clipboard?.writeText){
          try{window.navigator.clipboard.writeText(value).then(()=>notify("Pairing slip copied."),manual);}catch{manual();}
        }else manual();
      }else if(action==="wire-address"&&s?.addressHelp&&!s.ready)void addAddress(s);
      else if(action==="wire-close"&&s?.pc)close(value,"Continue by turn link or pair again.");
      return true;
    }
    return {link,model,act,send,connected,status};
  }
  window.WilderBellpostWire={create};
})();
