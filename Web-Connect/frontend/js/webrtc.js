let pc;
async function startConnection(targetCode){
  pc=new RTCPeerConnection();
  pc.onicecandidate=e=>{
    if(e.candidate)
      fetch('/api/candidate',{method:'POST',body:JSON.stringify({target:targetCode,candidate:e.candidate})});
  };
  const offer=await pc.createOffer();
  await pc.setLocalDescription(offer);
  await fetch('/api/offer',{method:'POST',body:JSON.stringify({target:targetCode,offer})});
}
