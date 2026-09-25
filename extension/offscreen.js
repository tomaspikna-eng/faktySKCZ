let media = null;
let audioContext = null;
let stopRequested = false;
let currentRecorder = null;
let tabId = null;
let sessionId = null;
let sequenceNo = 0;
let queue = [];
let uploadBusy = false;
let loopToken = 0;
const referenceRecorders = new Set();
const SLICE_MS = 40000;

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

function recorderMime(){
  return MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus' : 'audio/webm';
}

async function recordStandaloneSlice(durationMs=SLICE_MS) {
  if (!media || stopRequested) return null;
  return new Promise((resolve, reject) => {
    const chunks = [];
    const mime = recorderMime();
    const r = new MediaRecorder(media, {mimeType:mime, audioBitsPerSecond:64000});
    currentRecorder = r;
    r.ondataavailable = e => { if (e.data?.size) chunks.push(e.data); };
    r.onerror = e => reject(e.error || new Error('MediaRecorder error'));
    r.onstop = () => {
      if (currentRecorder === r) currentRecorder = null;
      resolve(chunks.length ? new Blob(chunks,{type:mime}) : null);
    };
    r.start();
    setTimeout(() => {
      if (r.state !== 'inactive') r.stop();
    }, durationMs);
  });
}

async function captureReference(durationMs=3000) {
  if (!media || stopRequested) throw new Error('Audio capture nie je aktívny.');
  const duration = Math.max(2000, Math.min(10000, Number(durationMs)||3000));
  return new Promise((resolve,reject)=>{
    const chunks=[];
    const mime=recorderMime();
    const r=new MediaRecorder(media,{mimeType:mime,audioBitsPerSecond:64000});
    referenceRecorders.add(r);
    r.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data)};
    r.onerror=e=>{referenceRecorders.delete(r);reject(e.error||new Error('Reference recorder error'))};
    r.onstop=async()=>{
      referenceRecorders.delete(r);
      try{
        const blob=chunks.length?new Blob(chunks,{type:mime}):null;
        if(!blob)return reject(new Error('Hlasová ukážka je prázdna.'));
        resolve({audioBase64:await blobToBase64(blob),mimeType:mime});
      }catch(e){reject(e)}
    };
    r.start();
    setTimeout(()=>{if(r.state!=='inactive')r.stop()},duration);
  });
}

async function uploadQueue(myToken) {
  if (uploadBusy) return;
  uploadBusy = true;
  try {
    while (!stopRequested && myToken === loopToken && queue.length) {
      const item = queue.shift();
      if (!item?.blob) continue;
      try {
        const audioBase64 = await blobToBase64(item.blob);
        chrome.runtime.sendMessage({
          type:'FC_TRANSCRIPT', tabId,
          payload:{status:'transcribing'}
        });

        const reply = await chrome.runtime.sendMessage({
          target:'background',
          type:'PROCESS_AUDIO',
          tabId,
          payload:{
            audioBase64,
            mimeType:item.blob.type || 'audio/webm',
            language:'auto',
            client:'chrome-extension',
            sequenceNo:item.sequenceNo,
            audioDurationMs:SLICE_MS,
            sessionId:item.sessionId
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
            break;
          }
          throw new Error(reply?.error || 'Backend request zlyhal');
        }

        chrome.runtime.sendMessage({type:'FC_RESULT',tabId,payload:reply.data});
      } catch (e) {
        chrome.runtime.sendMessage({
          type:'FC_RESULT',tabId,
          payload:{error:e?.message || String(e),transcript:'',claims:[]}
        });
      }
    }
  } finally {
    uploadBusy = false;
    if (!stopRequested && myToken === loopToken && queue.length) uploadQueue(myToken);
  }
}

async function captureLoop(myToken) {
  while (!stopRequested && media && myToken === loopToken) {
    try {
      const blob = await recordStandaloneSlice(SLICE_MS);
      if (!blob || stopRequested || myToken !== loopToken) continue;
      queue.push({blob,sequenceNo:sequenceNo++,sessionId});
      uploadQueue(myToken);
    } catch (e) {
      chrome.runtime.sendMessage({
        type:'FC_RESULT',tabId,
        payload:{error:e?.message || String(e),transcript:'',claims:[]}
      });
    }
  }
}

async function start({streamId,tabId:tid,sessionId:sid}) {
  await stop();
  stopRequested = false;
  tabId = tid;
  sessionId = sid || null;
  sequenceNo = 0;
  queue = [];
  uploadBusy = false;
  const myToken = ++loopToken;

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

  captureLoop(myToken);
}

async function stop() {
  stopRequested = true;
  loopToken++;
  queue = [];
  if (currentRecorder && currentRecorder.state !== 'inactive') {
    try { currentRecorder.stop(); } catch {}
  }
  for (const r of [...referenceRecorders]) {
    try { if (r.state !== 'inactive') r.stop(); } catch {}
  }
  referenceRecorders.clear();
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
  if (msg.type === 'CAPTURE_REFERENCE') {
    captureReference(msg.durationMs)
      .then(x=>sendResponse({ok:true,...x}))
      .catch(e=>sendResponse({ok:false,error:e?.message || String(e)}));
    return true;
  }
});