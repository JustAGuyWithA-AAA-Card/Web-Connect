// frontend/js/webrtc.js
// Basic WebRTC flow using HTTP signaling (send offers/answers/ices to Worker /api/signal/send and poll /api/signal/poll)
// This demo uses polling every 1000ms to fetch messages for the session code.

let localPC = null;

// STUN servers
const RTC_CONFIG = { iceServers: [ { urls: "stun:stun.l.google.com:19302" } ] };

// Client (caller) creates offer -> send to targetCode
export async function startClientOffer(targetCode, hostPassword='', statusCb = ()=>{}){
  statusCb('Creating connection...');
  localPC = new RTCPeerConnection(RTC_CONFIG);

  // Get remote stream area handled in dashboard's video if needed - for demo we won't attach
  // Collect ICE candidates and send to worker
  localPC.onicecandidate = e => {
    if(e.candidate){
      fetch('/api/signal/send', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ targetCode, kind:'ice', payload: e.candidate })});
    }
  };

  // Create data channel for control events
  const dc = localPC.createDataChannel('wc-control');
  dc.onopen = () => statusCb('Control channel open');
  dc.onmessage = (m) => console.log('ctrl msg', m.data);

  // Create offer
  const offer = await localPC.createOffer();
  await localPC.setLocalDescription(offer);

  // send offer (with optional host password)
  await fetch('/api/signal/send', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ targetCode, kind:'offer', payload: { offer, hostPassword } }) });

  statusCb('Offer sent, waiting for answer...');
  // poll for messages (answer & ice)
  const poll = setInterval(async () => {
    const resp = await fetch(`/api/signal/poll?code=${encodeURIComponent(targetCode)}`);
    const msgs = await resp.json();
    if(msgs && msgs.length){
      for(const m of msgs){
        if(m.kind === 'answer'){
          await localPC.setRemoteDescription(new RTCSessionDescription(m.payload.answer));
          statusCb('Connected!');
        } else if(m.kind === 'ice'){
          try { await localPC.addIceCandidate(m.payload); } catch(e){ console.warn(e); }
        }
      }
    }
  }, 1000);
}

// Host poller: host polls for offers for its own code; when offer arrives, creates answer and sends it back
export async function startHostPoller(myCode){
  // create persistent RTCPeerConnection per incoming offer? We'll create one per incoming offer for demo
  async function processOffer(offerMsg){
    // perform host permission checks
    const { offer, hostPassword } = offerMsg.payload;
    // verify if host session requires password
    // get session info from /api/session/list or direct KV via worker (we have only /session/list)
    // for simplicity we assume password ok if not required in demo
    const pc = new RTCPeerConnection(RTC_CONFIG);
    // attach screen: use getDisplayMedia
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video:true, audio:false });
      stream.getTracks().forEach(t => pc.addTrack(t, stream));
    } catch(e){
      console.error('getDisplayMedia failed', e);
      return;
    }

    pc.onicecandidate = e => {
      if(e.candidate){
        fetch('/api/signal/send', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ targetCode: offerMsg.from || offerMsg.fromId || offerMsg.session || offerMsg.code, kind:'ice', payload: e.candidate }) });
      }
    };

    pc.ondatachannel = (ev) => {
      const ch = ev.channel;
      ch.onmessage = (m) => {
        try {
          const obj = JSON.parse(m.data);
          if(obj.type === 'click') {
            // demo: show on-screen notification
            alert(`Remote clicked at ${obj.x}, ${obj.y}`);
          }
        } catch(e){}
      };
    };

    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    // send answer back to caller: target is the caller code (we rely on offerMsg.fromCode prop)
    const callerCode = offerMsg.fromCode || offerMsg.caller || offerMsg.from;
    await fetch('/api/signal/send', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ targetCode: callerCode, kind:'answer', payload: { answer } }) });
  }

  // Poll loop
  setInterval(async () => {
    const r = await fetch(`/api/signal/poll?code=${encodeURIComponent(myCode)}`);
    const msgs = await r.json();
    if(msgs && msgs.length) {
      for(const m of msgs){
        if(m.kind === 'offer'){
          // include origin code info if available
          m.fromCode = m.payload && m.payload.callerCode ? m.payload.callerCode : null;
          await processOffer(m);
        }
        // ICE messages for host's created PC are handled inside host PC creation above
      }
    }
  }, 1000);
}
