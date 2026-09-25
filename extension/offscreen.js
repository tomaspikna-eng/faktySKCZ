let media = null;
let audioContext = null;
let stopRequested = false;
let currentRecorder = null;
let tabId = null;
let sequenceNo = 0;
const SLICE_MS = 40000;

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

      const currentSequence = sequenceNo++;
      const reply = await chrome.runtime.sendMessage({
        target:'background',
        type:'PROCESS_AUDIO',
        tabId,
        payload:{
          audioBase64,
          mimeType:blob.type || 'audio/webm',
          language:'auto',
          client:'chrome-extension',
          sequenceNo:currentSequence,
          audioDurationMs:SLICE_MS
        }
      });

      if (!reply?.ok) {
        if (reply?.fatal === true) {
          chrome.runtime.sendMessage({
            type:'FC_RESULT',
            tabId,
            payload:{
              error:reply?.error || 'Spracovanie bolo zastavené.',
              errorCode:reply?.errorCode || 'fatal_error',
              fatal:true,
              transcript:'',
              claims:[]
            }
          });
          await stop();
          return;
        }
        throw new Error(reply?.error || 'Backend request zlyhal');
      }

      chrome.runtime.sendMessage({type:'FC_RESULT',tabId,payload:reply.data});
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
  sequenceNo = 0;

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