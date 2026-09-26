const OFFSCREEN_URL = 'offscreen.html';
const FUNCTION_URL = 'https://mexrrchqiehzvrefftym.supabase.co/functions/v1/process-audio';
const OVERLAY_API_URL = 'https://mexrrchqiehzvrefftym.supabase.co/functions/v1/overlay-api';
const PUBLISHABLE_KEY = 'sb_publishable_NZCEN4vfkbyxQrzCa8YR8Q_i4ZQCH2T';
const BACKEND_TIMEOUT_MS = 120000;

async function getClientInstallId(){
  const state=await chrome.storage.local.get('clientInstallId');
  let id=String(state.clientInstallId||'').trim();
  if(!id){
    id=crypto.randomUUID();
    await chrome.storage.local.set({clientInstallId:id});
  }
  return id;
}

async function fetchCreditStatus(){
  const clientInstallId=await getClientInstallId();
  const res=await fetch(FUNCTION_URL,{
    method:'POST',
    headers:{
      'content-type':'application/json',
      'apikey':PUBLISHABLE_KEY,
      'authorization':'Bearer '+PUBLISHABLE_KEY
    },
    body:JSON.stringify({action:'credit_status',clientInstallId})
  });
  const data=await res.json().catch(()=>({}));
  if(res.ok&&data?.credits)await chrome.storage.local.set({creditState:data.credits});
  return data?.credits||null;
}

async function appendDebugEvent(stage, details = {}) {
  try {
    const { debugEvents = [] } = await chrome.storage.local.get('debugEvents');
    debugEvents.push({
      at: new Date().toISOString(),
      stage,
      ...details
    });
    await chrome.storage.local.set({ debugEvents: debugEvents.slice(-50) });
  } catch {}
}

async function processAudioRequest(payload, tabId) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), BACKEND_TIMEOUT_MS);
  try {
    await appendDebugEvent('upload_started', {
      tabId,
      base64Length: payload?.audioBase64?.length || 0
    });

    const { rollingTranscript = '', captureState = {}, speakerProfiles = [] } =
      await chrome.storage.local.get(['rollingTranscript','captureState','speakerProfiles']);
    const clientInstallId=await getClientInstallId();
    const requestPayload = {
      ...(payload || {}),
      clientInstallId,
      contextBefore: String(rollingTranscript || '').slice(-2500),
      sessionId: payload?.sessionId || captureState.sessionId || null,
      sourceUrl: captureState.url || '',
      mediaTitle: captureState.title || '',
      sessionStartedAt: captureState.startedAt || null,
      pageContext: captureState.pageContext || {},
      speakerProfiles: Array.isArray(speakerProfiles) ? speakerProfiles.slice(0,4) : []
    };

    const res = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'apikey': PUBLISHABLE_KEY,
        'authorization': 'Bearer ' + PUBLISHABLE_KEY
      },
      body: JSON.stringify(requestPayload),
      signal: controller.signal
    });

    const raw = await res.text();
    let data = {};
    try { data = raw ? JSON.parse(raw) : {}; }
    catch { data = { error: raw || 'Neplatná odpoveď backendu' }; }

    await appendDebugEvent('backend_response', {
      tabId,
      status: res.status,
      ok: res.ok
    });

    if (!res.ok) {
      const err = new Error(data?.userMessage || data?.error || `Backend ${res.status}: ${raw.slice(0, 180)}`);
      err.errorCode = data?.errorCode || null;
      err.fatal = data?.fatal === true;
      throw err;
    }

    if (data?.transcript) {
      const combined = (String(rollingTranscript || '') + '\n' + String(data.transcript)).trim();
      await chrome.storage.local.set({ rollingTranscript: combined.slice(-2500) });
    }
    if(data?.credits) await chrome.storage.local.set({creditState:data.credits});

    return data;
  } catch (e) {
    const message = e?.name === 'AbortError'
      ? 'Backend timeout po 120 sekundách'
      : (e?.message || String(e));
    await appendDebugEvent('backend_fetch_error', {
      tabId,
      error: message,
      errorCode: e?.errorCode || null,
      fatal: e?.fatal === true
    });
    const wrapped = new Error(message);
    wrapped.errorCode = e?.errorCode || null;
    wrapped.fatal = e?.fatal === true;
    throw wrapped;
  } finally {
    clearTimeout(timeout);
  }
}

function isHttpTab(tab) {
  return !!tab?.id && /^https?:/i.test(tab.url || '');
}

async function getPageContext(tabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target:{tabId},
      func:()=>{
        const meta=(sel)=>document.querySelector(sel)?.getAttribute('content')||'';
        const heading=document.querySelector('h1')?.textContent?.trim()||'';
        return {
          title:document.title||'',
          description:meta('meta[name="description"]'),
          ogTitle:meta('meta[property="og:title"]'),
          ogDescription:meta('meta[property="og:description"]'),
          heading
        };
      }
    });
    return results?.[0]?.result || {};
  } catch {
    return {};
  }
}

async function createStreamOverlay({ sessionId, sourceUrl, mediaTitle, startedAt }) {
  const res = await fetch(OVERLAY_API_URL, {
    method:'POST',
    headers:{
      'content-type':'application/json',
      'apikey':PUBLISHABLE_KEY,
      'authorization':'Bearer ' + PUBLISHABLE_KEY
    },
    body:JSON.stringify({
      action:'create',
      sessionId,
      sourceUrl,
      mediaTitle,
      startedAt,
      expiresHours:12
    })
  });
  const raw = await res.text();
  let data = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch {}
  if (!res.ok || !data?.ok) throw new Error(data?.error || 'Stream overlay sa nepodarilo vytvoriť.');
  return {
    token:data.token,
    expiresAt:data.expiresAt,
    factcheckUrl:data.factcheckUrl,
    scoreboardUrl:data.scoreboardUrl
  };
}

async function startCaptureForTab(tab) {
  if (!isHttpTab(tab)) throw new Error('Otvor video alebo stream v bežnom HTTP/HTTPS tabe.');

  const captured = await chrome.tabCapture.getCapturedTabs();
  const activeCapture = captured.find(x => x.status === 'active' || x.status === 'pending');
  if (activeCapture && activeCapture.tabId !== tab.id) {
    try { await chrome.runtime.sendMessage({ target:'offscreen', type:'STOP_AUDIO' }); } catch {}
  }

  await ensureOffscreen();
  const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id });
  const startedAt = new Date().toISOString();
  const sessionId = crypto.randomUUID();
  const pageContext = await getPageContext(tab.id);

  let streamOverlay = null;
  try {
    streamOverlay = await createStreamOverlay({
      sessionId,
      sourceUrl: tab.url || '',
      mediaTitle: tab.title || 'Aktuálne video',
      startedAt
    });
    await appendDebugEvent('stream_overlay_created', { tabId:tab.id, sessionId });
  } catch (e) {
    await appendDebugEvent('stream_overlay_error', {
      tabId:tab.id,
      sessionId,
      error:e?.message || String(e)
    });
  }

  await chrome.storage.local.set({
    sessionClaims: [],
    rollingTranscript: '',
    speakerProfiles: [],
    detectedParticipants: [],
    processingState: { phase: 'listening', error: null },
    captureState: {
      active: true,
      sessionId,
      tabId: tab.id,
      windowId: tab.windowId,
      title: tab.title || 'Aktuálne video',
      url: tab.url || '',
      favIconUrl: tab.favIconUrl || '',
      startedAt,
      pageContext,
      streamOverlay
    }
  });

  const reply = await chrome.runtime.sendMessage({
    target:'offscreen',
    type:'START_AUDIO',
    streamId,
    tabId:tab.id,
    sessionId
  });
  if (reply?.ok === false) throw new Error(reply.error || 'Audio vstup sa nepodarilo spustiť.');

  await chrome.action.setBadgeText({tabId:tab.id,text:'LIVE'});
}

chrome.action.onClicked.addListener(async (tab) => {
  try {
    await chrome.sidePanel.open({ windowId: tab.windowId });
    await startCaptureForTab(tab);
  } catch (e) {
    await chrome.storage.local.set({
      processingState:{phase:'error',error:e?.message||String(e)},
      captureState:{
        active:false,
        tabId:tab?.id||null,
        windowId:tab?.windowId||null,
        title:tab?.title||'',
        url:tab?.url||''
      }
    });
  }
});

async function getCurrentContext() {
  try {
    const [tab] = await chrome.tabs.query({active:true,lastFocusedWindow:true});
    if (isHttpTab(tab)) return tab;
  } catch {}
  const {captureState={}}=await chrome.storage.local.get('captureState');
  if (captureState.tabId) {
    try {
      const tab=await chrome.tabs.get(captureState.tabId);
      if (isHttpTab(tab)) return tab;
    } catch {}
  }
  return null;
}

async function ensureOffscreen() {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [chrome.runtime.getURL(OFFSCREEN_URL)]
  });
  if (contexts.length) return;
  await chrome.offscreen.createDocument({
    url: OFFSCREEN_URL,
    reasons: ['USER_MEDIA'],
    justification: 'Capture current-tab audio for user-started live fact checking.'
  });
}

async function getCurrentVideoSeconds(tabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const videos = [...document.querySelectorAll('video')];
        if (!videos.length) return null;
        const active = videos.find(v => !v.paused && Number.isFinite(v.currentTime)) || videos[0];
        return Number.isFinite(active?.currentTime) ? active.currentTime : null;
      }
    });
    const n = results?.[0]?.result;
    return Number.isFinite(n) ? Math.max(0, Math.round(n)) : null;
  } catch {
    return null;
  }
}

function norm(s = '') {
  return s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

function similarity(a, b) {
  const A = new Set(norm(a).split(' ').filter(Boolean));
  const B = new Set(norm(b).split(' ').filter(Boolean));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  const union = A.size + B.size - inter;
  return union ? inter / union : 0;
}

async function appendClaims(payload, tabId) {
  const claims = Array.isArray(payload?.claims) ? payload.claims : [];
  if (!claims.length) return;

  const state = await chrome.storage.local.get(['sessionClaims', 'captureState']);
  const list = Array.isArray(state.sessionClaims) ? state.sessionClaims : [];
  const videoSeconds = await getCurrentVideoSeconds(tabId);
  const started = state.captureState?.startedAt ? Date.parse(state.captureState.startedAt) : Date.now();
  const elapsedSeconds = Math.max(0, Math.round((Date.now() - started) / 1000));

  for (const c of claims) {
    const claimText = c?.claim || payload?.transcript || '';
    if (!claimText.trim()) continue;

    let existingIndex = -1;
    let best = 0;
    for (let i = Math.max(0, list.length - 30); i < list.length; i++) {
      const s = similarity(list[i]?.claim || '', claimText);
      if (s > best) { best = s; existingIndex = i; }
    }

    if (best >= 0.78 && existingIndex >= 0) {
      list[existingIndex] = {
        ...list[existingIndex],
        repeats: (list[existingIndex].repeats || 1) + 1,
        lastSeenAt: new Date().toISOString()
      };
      continue;
    }

    list.unshift({
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      videoSeconds,
      elapsedSeconds,
      claim: claimText,
      transcript: payload?.transcript || '',
      verdict: c?.verdict || 'unverified',
      verdictLabel: c?.verdictLabel || 'NEOVERENÉ',
      matchConfidence: Number.isFinite(c?.matchConfidence) ? c.matchConfidence : null,
      explanation: c?.explanation || c?.reason || '',
      selectedSource: c?.selectedSource || null,
      candidates: Array.isArray(c?.candidates) ? c.candidates : [],
      repeats: 1
    });
  }

  await chrome.storage.local.set({ sessionClaims: list.slice(0, 200) });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.target === 'background' && msg?.type === 'PROCESS_AUDIO') {
    (async () => {
      try {
        const data = await processAudioRequest(msg.payload, msg.tabId);
        sendResponse({ ok: true, data });
      } catch (e) {
        sendResponse({
          ok: false,
          error: e?.message || String(e),
          errorCode: e?.errorCode || null,
          fatal: e?.fatal === true
        });
      }
    })();
    return true;
  }

  if (msg?.type === 'GET_CREDIT_STATUS') {
    (async()=>{
      try{
        const credits=await fetchCreditStatus();
        sendResponse({ok:true,credits});
      }catch(e){
        sendResponse({ok:false,error:e?.message||String(e)});
      }
    })();
    return true;
  }

  if (msg?.type === 'GET_ACTIVE_CONTEXT') {
    (async () => {
      const tab = await getCurrentContext();
      sendResponse({
        ok: !!tab,
        tab: tab ? {
          id: tab.id,
          windowId: tab.windowId,
          title: tab.title || 'Aktuálne video',
          url: tab.url || '',
          favIconUrl: tab.favIconUrl || ''
        } : null
      });
    })();
    return true;
  }

  if (msg?.type === 'PREPARE_RESTART') {
    (async () => {
      const { captureState = {} } = await chrome.storage.local.get('captureState');
      if (!captureState.tabId) {
        sendResponse({ ok:false, error:'Otvor video a klikni na ikonu DETEKTOR v lište Chrome.' });
        return;
      }
      try {
        const tab = await chrome.tabs.get(captureState.tabId);
        if (!tab?.id) throw new Error('Pôvodná karta už neexistuje.');
        await chrome.tabs.update(tab.id, { active:true });
        if (tab.windowId) await chrome.windows.update(tab.windowId, { focused:true });
        sendResponse({ ok:true, message:'Klikni teraz na ikonu DETEKTOR v lište Chrome. Chrome vyžaduje nový používateľský klik pre opätovné zachytenie audia.' });
      } catch {
        sendResponse({ ok:false, error:'Pôvodná video karta už nie je otvorená. Otvor video a klikni na ikonu DETEKTOR.' });
      }
    })();
    return true;
  }

  if (msg?.type === 'START_CAPTURE') {
    (async () => {
      try {
        const tab = await getCurrentContext();
        if (!tab) throw new Error('Klikni na ikonu DETEKTOR v lište Chrome. Otvorí panel a spustí overovanie aktuálneho tabu.');
        await startCaptureForTab(tab);
        sendResponse({ ok: true });
      } catch (e) {
        const error = e?.message || String(e);
        await chrome.storage.local.set({
          processingState: { phase: 'error', error }
        });
        sendResponse({ ok: false, error });
      }
    })();
    return true;
  }

  if (msg?.type === 'STOP_CAPTURE') {
    (async () => {
      try { await chrome.runtime.sendMessage({ target: 'offscreen', type: 'STOP_AUDIO' }); } catch {}
      const { captureState = {} } = await chrome.storage.local.get('captureState');

      let archived = null;
      if (captureState.sessionId) {
        try {
          const res = await fetch(FUNCTION_URL, {
            method:'POST',
            headers:{
              'content-type':'application/json',
              'apikey':PUBLISHABLE_KEY,
              'authorization':'Bearer ' + PUBLISHABLE_KEY
            },
            body:JSON.stringify({
              action:'complete_session',
              sessionId:captureState.sessionId,
              client:'chrome-extension'
            })
          });
          archived = await res.json().catch(()=>null);
        } catch {}
      }

      if (captureState.tabId) {
        try { await chrome.action.setBadgeText({ tabId: captureState.tabId, text: '' }); } catch {}
      }
      await chrome.storage.local.set({
        captureState: {
          ...captureState,
          active: false,
          stoppedAt: new Date().toISOString(),
          archivedAt: archived?.archived ? new Date().toISOString() : captureState.archivedAt || null
        },
        processingState: { phase: 'stopped', error: null }
      });
      sendResponse({ ok: true, archived });
    })();
    return true;
  }

  if (msg?.type === 'CAPTURE_SPEAKER_REFERENCE') {
    (async () => {
      const speakerKey = String(msg.speakerKey || '').trim();
      const displayName = String(msg.displayName || '').trim();
      const role = msg.role === 'moderator' ? 'moderator' : 'participant';

      if (!/^p[1-4]$/.test(speakerKey)) {
        sendResponse({ ok:false, error:'Neplatný slot rečníka.' });
        return;
      }
      if (!displayName) {
        sendResponse({ ok:false, error:'Zadaj meno rečníka.' });
        return;
      }

      const { captureState = {}, speakerProfiles = [] } =
        await chrome.storage.local.get(['captureState','speakerProfiles']);
      if (!captureState.active) {
        sendResponse({ ok:false, error:'Najprv spusti LIVE overovanie.' });
        return;
      }

      const ref = await chrome.runtime.sendMessage({
        target:'offscreen',
        type:'CAPTURE_REFERENCE',
        durationMs:3000
      });
      if (!ref?.ok || !ref.audioBase64) {
        sendResponse({ ok:false, error:ref?.error || 'Hlasovú ukážku sa nepodarilo zachytiť.' });
        return;
      }

      const next = Array.isArray(speakerProfiles) ? [...speakerProfiles] : [];
      const profile = {
        speakerKey,
        displayName,
        role,
        referenceDataUrl:`data:${ref.mimeType || 'audio/webm'};base64,${ref.audioBase64}`,
        capturedAt:new Date().toISOString()
      };
      const idx = next.findIndex(x => x?.speakerKey === speakerKey);
      if (idx >= 0) next[idx] = profile; else next.push(profile);
      await chrome.storage.local.set({ speakerProfiles: next.slice(0,4) });
      sendResponse({ ok:true, profile:{speakerKey,displayName,role,capturedAt:profile.capturedAt} });
    })().catch(e=>sendResponse({ok:false,error:e?.message||String(e)}));
    return true;
  }

  if (msg?.type === 'CLEAR_SESSION') {
    chrome.storage.local.set({ sessionClaims: [], lastResult: null });
    sendResponse({ ok: true });
    return;
  }

  if (msg?.type === 'FC_TRANSCRIPT' && msg.tabId) {
    chrome.storage.local.set({ processingState: { phase: 'transcribing', error: null } });
  }

  if (msg?.type === 'FC_RESULT' && msg.tabId) {
    (async () => {
      if (msg.payload?.error) {
        const { captureState = {} } = await chrome.storage.local.get('captureState');

        if (msg.payload?.fatal === true) {
          if (captureState.sessionId) {
            try {
              await fetch(FUNCTION_URL, {
                method:'POST',
                headers:{
                  'content-type':'application/json',
                  'apikey':PUBLISHABLE_KEY,
                  'authorization':'Bearer ' + PUBLISHABLE_KEY
                },
                body:JSON.stringify({
                  action:'complete_session',
                  sessionId:captureState.sessionId,
                  client:'chrome-extension'
                })
              });
            } catch {}
          }
          if (captureState.tabId) {
            try { await chrome.action.setBadgeText({ tabId:captureState.tabId, text:'' }); } catch {}
          }
        }

        await chrome.storage.local.set({
          lastResult: { payload: msg.payload, receivedAt: new Date().toISOString() },
          captureState: msg.payload?.fatal === true ? {
            ...captureState,
            active:false,
            stoppedAt:new Date().toISOString(),
            stopReason:msg.payload?.errorCode || 'fatal_error'
          } : captureState,
          processingState: {
            phase: 'error',
            error: msg.payload.error,
            errorCode: msg.payload?.errorCode || null,
            fatal: msg.payload?.fatal === true
          }
        });
        return;
      }
      await appendClaims(msg.payload, msg.tabId);

      if (Array.isArray(msg.payload?.participants) && msg.payload.participants.length) {
        const { detectedParticipants = [] } = await chrome.storage.local.get('detectedParticipants');
        const merged = Array.isArray(detectedParticipants) ? [...detectedParticipants] : [];
        for (const p of msg.payload.participants) {
          const name = String(p?.displayName || '').trim();
          if (!name) continue;
          const key = name.toLowerCase().replace(/\s+/g,' ').trim() + '|' + (p?.role === 'moderator' ? 'moderator' : 'participant');
          const idx = merged.findIndex(x => (
            String(x?.displayName || '').toLowerCase().replace(/\s+/g,' ').trim() + '|' +
            (x?.role === 'moderator' ? 'moderator' : 'participant')
          ) === key);
          const item = {
            displayName:name,
            role:p?.role === 'moderator' ? 'moderator' : 'participant',
            source:p?.source || 'intro',
            confidence:Number.isFinite(Number(p?.confidence)) ? Number(p.confidence) : null
          };
          if (idx >= 0) merged[idx] = {...merged[idx],...item};
          else merged.push(item);
        }
        await chrome.storage.local.set({ detectedParticipants: merged.slice(0,8) });
      }

      await chrome.storage.local.set({
        lastResult: { payload: msg.payload, receivedAt: new Date().toISOString() },
        processingState: { phase: 'listening', error: null }
      });
    })();
  }
});

const SIDEPANEL_COMMAND_TABS = {
  'open-summary':'summary',
  'open-facts':'facts',
  'open-disputed':'disputed',
  'open-patterns':'patterns',
  'open-actors':'actors'
};

chrome.commands.onCommand.addListener(async (command) => {
  const tabName = SIDEPANEL_COMMAND_TABS[command];
  if (!tabName) return;
  try {
    const [tab] = await chrome.tabs.query({ active:true, lastFocusedWindow:true });
    if (!tab?.windowId) return;

    await chrome.storage.local.set({ requestedSideTab:tabName });
    await chrome.sidePanel.open({ windowId:tab.windowId });

    try {
      await chrome.runtime.sendMessage({ type:'SET_SIDEPANEL_TAB', tab:tabName });
    } catch {}
  } catch (e) {
    await appendDebugEvent('sidepanel_command_error', {
      command,
      error:e?.message || String(e)
    });
  }
});
