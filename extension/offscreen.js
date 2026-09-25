let media = null;
let audioContext = null;
let stopRequested = false;
let currentRecorder = null;
let tabId = null;
const FUNCTION_URL = 'https://mexrrchqiehzvrefftym.supabase.co/functions/v1/process-audio';
const PUBLISHABLE_KEY = 'sb_publishable_NZCEN4vfkbyxQrzCa8YR8Q_i4ZQCH2T';
const SLICE_MS = 7000;

function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }

async function blobToBase64(blob) {
  const buf = await blob.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i=0;i<bytes.length;i+=chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i+chunk, bytes.length)));
  }
  return btoa(binary);
}

async function recordStandaloneSlice() {
  if (!media || stopRequested) return null;
  return new Promise((resolve, reject) => {
    const chunks = [];
    const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus' : 'audio/webm';
    const r = new MediaRecorder(media, {mimeType:mime, audioBitsPerSecond:64000});
    currentRecorder = r;
    r.ondataavailable = e => { if (e.data?.size) chunks.push(e.data); };
    r.onerror = e => reject(e.error || new Error('MediaRecorder error'));
    r.onstop = () => {
      currentRecorder = null;
      resolve(chunks.length ? new Blob(chunks,{type:mime}) : null);
    };
    r.start();
    setTimeout(() => {
      if (r.state !== 'inactive') r.stop();
    }, SLICE_MS);
  });
}

async function processLoop() {
  while (!stopRequested && media) {
    let blob = null;
    try {
      blob = await recordStandaloneSlice();
      if (!blob || stopRequested) continue;
      const audioBase64 = await blobToBase64(blob);

      chrome.runtime.sendMessage({
        type:'FC_TRANSCRIPT', tabId,
        payload:{status:'transcribing'}
      });

      const res = await fetch(FUNCTION_URL,{
        method:'POST',
        headers:{
          'content-type':'application/json',
          'apikey': PUBLISHABLE_KEY
        },
        body:JSON.stringify({
          audioBase64,
          mimeType:blob.type || 'audio/webm',
          language:'auto',
          client:'chrome-extension'
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Backend ${res.status}`);

      chrome.runtime.sendMessage({type:'FC_RESULT',tabId,payload:data});
    } catch (e) {
      chrome.runtime.sendMessage({
        type:'FC_RESULT',tabId,
        payload:{error:e?.message || String(e),transcript:'',claims:[]}
      });
      await sleep(1500);
    }
  }
}

async function start({streamId,tabId:tid}) {
  await stop();
  stopRequested = false;
  tabId = tid;

  media = await navigator.mediaDevices.getUserMedia({
    audio:{
      mandatory:{
        chromeMediaSource:'tab',
        chromeMediaSourceId:streamId
      }
    },
    video:false
  });

  audioContext = new AudioContext();
  const source = audioContext.createMediaStreamSource(media);
  source.connect(audioContext.destination);

  processLoop();
}

async function stop() {
  stopRequested = true;
  if (currentRecorder && currentRecorder.state !== 'inactive') {
    try { currentRecorder.stop(); } catch {}
  }
  if (media) {
    media.getTracks().forEach(t=>t.stop());
    media = null;
  }
  if (audioContext) {
    try { await audioContext.close(); } catch {}
    audioContext = null;
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.target !== 'offscreen') return;
  if (msg.type === 'START_AUDIO') {
    start(msg).then(()=>sendResponse({ok:true}))
      .catch(e=>sendResponse({ok:false,error:e?.message || String(e)}));
    return true;
  }
  if (msg.type === 'STOP_AUDIO') {
    stop().then(()=>sendResponse({ok:true}));
    return true;
  }
});