const $ = id => document.getElementById(id);
let activeTab = 'actors';
let lang = 'sk';

const dict = {
  sk: {
    summary:'Prehľad', facts:'Tvrdenia', disputed:'Sporné', patterns:'Vzorce', actors:'Aktéri', captured:'Zachytené tvrdenia',
    verified:'Overené', disputedShort:'Sporné', unverified:'Neoverené', latest:'Posledné tvrdenia',
    disputedNote:'Zavádzajúce, nepravdivé a neoverené tvrdenia.', patternsNote:'Tu sa zobrazia výroky, ktoré sa počas relácie opakujú.',
    noCaptions:'bez titulkov', start:'Spustiť overovanie', stop:'Zastaviť', clear:'Vymazať', ready:'Pripravené.',
    listening:'Počúvam audio aktuálneho tabu…', transcribing:'Prepisujem a analyzujem posledný úsek…', stopped:'Overovanie je zastavené.',
    noVideo:'Klikni na ikonu DETEKTOR pri otvorenom videu', emptyTitle:'Zatiaľ bez tvrdení', emptyBody:'Po spustení sa sem budú pridávať overiteľné výroky.',
    noDisputed:'Zatiaľ bez sporných tvrdení', noPatterns:'Zatiaľ bez opakovaných tvrdení', sources:'Zdroje', noSources:'Zdroj nie je v tomto výsledku dostupný.',
    confidence:'istota', repeats:'× opakované', timeFallback:'od spustenia',
    streamTitle:'Stream Browser Source', factOverlay:'LIVE fact-check', scoreOverlay:'Aktéri – priebežné počty verdictov',
    copy:'Kopírovať', copied:'Skopírované', streamNote:'V OBS/Streamlabs vlož URL ako Browser Source. Moderátor sa v prehľade aktérov nezobrazuje.',
    speakerTitle:'Aktéri relácie', speakerNote:'Počas hovorenia konkrétneho človeka zadaj meno a zachyť 3 s jeho hlasu. Max. 4 známi rečníci.',
    actorsNote:'Priebežné počty fact-checkovaných tvrdení v tejto relácii. Nejde o celkové hodnotenie osoby.',
    checkedClaims:'Fact-checkované tvrdenia', actorWaiting:'Čakám na priradené výroky účastníkov…',
    actorsNote:'Percentá zobrazujú iba rozdelenie fact-checkovaných tvrdení v tejto relácii. Nejde o hodnotenie osoby.',
    checkedClaims:'Fact-checkované tvrdenia', actorWaiting:'Čakám na priradené výroky účastníkov…',
    participant:'Účastník', moderator:'Moderátor', captureVoice:'Zachytiť hlas', capturing:'Nahrávam 3 s…', voiceReady:'Hlas uložený',
    credits:'Detektory', billingTest:'TEST režim · kredity sa zatiaľ neodpočítavajú', billingLive:'Kredity sa odpočítavajú podľa používania',
    privacyTitle:'Pred prvým LIVE overovaním',
    privacyBody:'DETEKTOR po spustení zachytáva zvuk aktuálnej karty a odošle ho na zabezpečené serverové spracovanie za účelom prepisu a fact-checkingu.',
    privacyDetail:'Spracúvajú sa aj údaje potrebné na priebeh relácie, napríklad názov a URL aktívnej stránky, prepis, tvrdenia a technické metadáta. Údaje sa používajú iba na poskytovanie služby DETEKTOR.live.',
    privacyAccept:'Súhlasím a spustiť', privacyCancel:'Zrušiť', privacyInfo:'Súkromie'
  },
  cz: {
    summary:'Přehled', facts:'Tvrzení', disputed:'Sporné', patterns:'Vzorce', actors:'Aktéři', captured:'Zachycená tvrzení',
    verified:'Ověřené', disputedShort:'Sporné', unverified:'Neověřené', latest:'Poslední tvrzení',
    disputedNote:'Zavádějící, nepravdivá a neověřená tvrzení.', patternsNote:'Zde se zobrazí výroky, které se během pořadu opakují.',
    noCaptions:'bez titulků', start:'Spustit ověřování', stop:'Zastavit', clear:'Vymazat', ready:'Připraveno.',
    listening:'Poslouchám audio aktuálního panelu…', transcribing:'Přepisuji a analyzuji poslední úsek…', stopped:'Ověřování je zastaveno.',
    noVideo:'Klikni na ikonu DETEKTOR při otevřeném videu', emptyTitle:'Zatím bez tvrzení', emptyBody:'Po spuštění se sem budou přidávat ověřitelná tvrzení.',
    noDisputed:'Zatím bez sporných tvrzení', noPatterns:'Zatím bez opakovaných tvrzení', sources:'Zdroje', noSources:'Zdroj není v tomto výsledku dostupný.',
    confidence:'jistota', repeats:'× opakováno', timeFallback:'od spuštění',
    streamTitle:'Stream Browser Source', factOverlay:'LIVE fact-check', scoreOverlay:'Aktéři – průběžné počty verdiktů',
    copy:'Kopírovat', copied:'Zkopírováno', streamNote:'V OBS/Streamlabs vlož URL jako Browser Source. Moderátor se v přehledu aktérů nezobrazuje.',
    speakerTitle:'Aktéři relace', speakerNote:'Během mluvení konkrétního člověka zadej jméno a zachyť 3 s jeho hlasu. Max. 4 známí mluvčí.',
    actorsNote:'Průběžné počty fact-checkovaných tvrzení v této relaci. Nejde o celkové hodnocení osoby.',
    checkedClaims:'Fact-checkovaná tvrzení', actorWaiting:'Čekám na přiřazené výroky účastníků…',
    actorsNote:'Procenta zobrazují pouze rozdělení fact-checkovaných tvrzení v této relaci. Nejde o hodnocení osoby.',
    checkedClaims:'Fact-checkovaná tvrzení', actorWaiting:'Čekám na přiřazené výroky účastníků…',
    participant:'Účastník', moderator:'Moderátor', captureVoice:'Zachytit hlas', capturing:'Nahrávám 3 s…', voiceReady:'Hlas uložen',
    credits:'Detektory', billingTest:'TEST režim · kredity se zatiaľ neodečítajú', billingLive:'Kredity se odečítají podle používání',
    privacyTitle:'Před prvním LIVE ověřováním',
    privacyBody:'DETEKTOR po spuštění zachytává zvuk aktuální karty a odešle ho ke zabezpečenému serverovému zpracování za účelem přepisu a fact-checkingu.',
    privacyDetail:'Zpracovávají se také údaje potřebné pro průběh relace, například název a URL aktivní stránky, přepis, tvrzení a technická metadata. Údaje se používají pouze pro poskytování služby DETEKTOR.live.',
    privacyAccept:'Souhlasím a spustit', privacyCancel:'Zrušit', privacyInfo:'Soukromí'
  }
};
const t = k => dict[lang][k] || k;

// Public identity must never fall back to or display an email address.
function publicDisplayName(account){
  const name=String(account?.displayName||'').trim();
  if(!name || name.includes('@')) return '';
  return name;
}

function normalizeOverlayUrl(value){
  try{
    const u=new URL(String(value||''));
    if(u.hostname==='mexrrchqiehzvrefftym.supabase.co' && u.pathname==='/overlay-api'){
      u.pathname='/functions/v1/overlay-api';
    }
    u.protocol='https:';
    return u.toString();
  }catch{
    return String(value||'');
  }
}

function mapVerdict(v) {
  const labels = lang === 'cz'
    ? {true:'PRAVDIVÉ',mostly_true:'PŘEVÁŽNĚ PRAVDIVÉ',misleading:'ZAVÁDĚJÍCÍ',false:'NEPRAVDIVÉ',unverified:'NEOVĚŘENÉ'}
    : {true:'PRAVDIVÉ',mostly_true:'PREVAŽNE PRAVDIVÉ',misleading:'ZAVÁDZAJÚCE',false:'NEPRAVDIVÉ',unverified:'NEOVERENÉ'};
  return labels[v] || labels.unverified;
}
function esc(s=''){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function fmt(sec){
  if(!Number.isFinite(sec)) return '';
  const s=Math.max(0,Math.round(sec)), h=Math.floor(s/3600), m=Math.floor((s%3600)/60), x=s%60;
  return h ? `${h}:${String(m).padStart(2,'0')}:${String(x).padStart(2,'0')}` : `${m}:${String(x).padStart(2,'0')}`;
}
function sourceUrl(s){return s?.url||s?.claimReviewUrl||s?.sourceUrl||s?.link||s?.publisherUrl||''}
function sourceTitle(s,i){return s?.title||s?.publisher?.name||s?.publisher||s?.sourceName||s?.claimant||`Zdroj ${i+1}`}
function sourceList(c){
  const all=[];
  if(c.selectedSource) all.push(c.selectedSource);
  for(const x of (c.candidates||[])) if(x && !all.some(y=>JSON.stringify(y)===JSON.stringify(x))) all.push(x);
  return all.slice(0,5);
}

function empty(title, body=''){
  return `<div class="empty"><strong>${esc(title)}</strong>${esc(body)}</div>`;
}

function card(c){
  const v=c.verdict||'unverified';
  const conf=Number.isFinite(c.matchConfidence)?`${c.matchConfidence}% ${t('confidence')}`:'—';
  const time=Number.isFinite(c.videoSeconds)?fmt(c.videoSeconds):`${fmt(c.elapsedSeconds)} ${t('timeFallback')}`;
  const sources=sourceList(c);
  const sourceHtml=sources.length?sources.map((s,i)=>{
    const u=sourceUrl(s), title=sourceTitle(s,i);
    return `<div class="source-row">${u?`<a href="${esc(u)}" target="_blank" rel="noreferrer">${esc(title)} ↗</a>`:esc(title)}</div>`;
  }).join(''):`<div class="source-row">${esc(t('noSources'))}</div>`;
  return `<article class="claim-card">
    <div class="claim-top"><span class="verdict ${esc(v)}">${esc(mapVerdict(v))}</span><span class="confidence"><strong>${esc(conf)}</strong></span></div>
    <div class="claim-text">“${esc(c.claim||'')}”</div>
    ${c.explanation?`<div class="explanation">${esc(c.explanation)}</div>`:''}
    <div class="card-bottom"><span class="time">${esc(time)}</span>${(c.repeats||1)>1?`<span class="repeat">${c.repeats}${esc(t('repeats'))}</span>`:''}<button class="source-btn" data-source="${esc(c.id)}" type="button">${esc(t('sources'))}</button></div>
    <div class="sources" id="src-${esc(c.id)}">${sourceHtml}</div>
  </article>`;
}

function bindSourceButtons(){
  document.querySelectorAll('[data-source]').forEach(b=>b.onclick=()=>{
    const el=document.getElementById(`src-${b.dataset.source}`); if(el) el.classList.toggle('open');
  });
}

function pct(n,total){
  return total>0?Math.round((Number(n||0)/total)*100):0;
}

function actorCard(p){
  const c=p?.counts||{};
  const total=Number(c.total||0);
  const rows=[
    ['true',mapVerdict('true'),Number(c.true||0)],
    ['mostly_true',mapVerdict('mostly_true'),Number(c.mostly_true||0)],
    ['misleading',mapVerdict('misleading'),Number(c.misleading||0)],
    ['false',mapVerdict('false'),Number(c.false||0)],
    ['unverified',mapVerdict('unverified'),Number(c.unverified||0)]
  ];
  return `<article class="actor-card">
    <div class="actor-head">
      <strong>${esc(p?.displayName||'')}</strong>
      <span>${esc(t('checkedClaims'))}: <b>${total}</b></span>
    </div>
    <div class="actor-bars">
      ${rows.map(([v,label,n])=>`<div class="actor-row">
        <div class="actor-label"><span class="verdict ${esc(v)}">${esc(label)}</span><b>${pct(n,total)}%</b><small>${n}/${total}</small></div>
        <div class="actor-track"><span class="actor-fill ${esc(v)}" style="width:${pct(n,total)}%"></span></div>
      </div>`).join('')}
    </div>
    <div class="actor-note">${esc(t('actorsNote'))}</div>
  </article>`;
}

async function loadActorStats(capture){
  const box=$('actorsList');
  const url=normalizeOverlayUrl(capture?.streamOverlay?.scoreboardUrl||'');
  if(!url){
    box.innerHTML=empty(t('actorWaiting'));
    return;
  }
  try{
    const u=new URL(url);
    u.searchParams.set('format','json');
    u.searchParams.delete('view');
    const r=await fetch(u.toString(),{cache:'no-store'});
    const data=await r.json();
    const people=Array.isArray(data?.participants)?data.participants:[];
    if(!data?.speakerMappingReady||!people.length){
      box.innerHTML=empty(t('actorWaiting'));
      return;
    }
    box.innerHTML=people.map(actorCard).join('');
  }catch{
    box.innerHTML=empty(t('actorWaiting'));
  }
}

async function render(){
  const state=await chrome.storage.local.get(['sessionClaims','captureState','processingState','uiLang','speakerProfiles','detectedParticipants','detectedSpeakerLabels','creditState','authState']);
  const claims=Array.isArray(state.sessionClaims)?state.sessionClaims:[];
  const capture=state.captureState||{};
  const proc=state.processingState||{};
  lang=state.uiLang||lang;
  $('langBtn').textContent=lang.toUpperCase();
  document.documentElement.lang=lang;
  document.querySelectorAll('[data-i18n]').forEach(el=>el.textContent=t(el.dataset.i18n));
  $('startBtn').textContent=t('start'); $('stopBtn').textContent=t('stop'); $('clearBtn').textContent=t('clear');
  $('copyFactOverlay').textContent=t('copy'); $('copyScoreOverlay').textContent=t('copy');
  $('privacyTitle').textContent=t('privacyTitle');
  $('privacyBody').textContent=t('privacyBody');
  $('privacyDetail').textContent=t('privacyDetail');
  $('privacyAcceptBtn').textContent=t('privacyAccept');
  $('privacyCancelBtn').textContent=t('privacyCancel');
  $('privacyInfoBtn').textContent=t('privacyInfo');
  $('extensionVersion').textContent='v'+chrome.runtime.getManifest().version;

  const credit=state.creditState||{};
  const available=Number(credit.availableCredits??credit.balanceCredits);
  $('creditBalance').textContent=Number.isFinite(available)?available.toLocaleString(lang==='cz'?'cs-CZ':'sk-SK',{maximumFractionDigits:2})+' det.':'—';
  $('creditMode').textContent=credit.billingEnforced===true?t('billingLive'):t('billingTest');
  $('creditBar').classList.toggle('billing-on',credit.billingEnforced===true);

  const account=state.authState||null;
  $('authLoggedOut').classList.toggle('hidden',!!account?.id);
  $('authLoggedIn').classList.toggle('hidden',!account?.id);
  $('accountStatus').textContent=account?.id?(lang==='cz'?'Přihlášen':'Prihlásený'):(lang==='cz'?'Nepřihlášen':'Neprihlásený');
  const displayName=publicDisplayName(account);
  $('accountDisplayName').textContent=displayName || (lang==='cz'?'Nastav zobrazované jméno':'Nastav zobrazované meno');
  if(document.activeElement!==$('profileDisplayName')) $('profileDisplayName').value=displayName;

  const overlay=capture.streamOverlay||null;
  if(overlay?.factcheckUrl&&overlay?.scoreboardUrl){
    $('streamBox').classList.remove('hidden');
    $('factOverlayUrl').value=normalizeOverlayUrl(overlay.factcheckUrl);
    $('scoreOverlayUrl').value=normalizeOverlayUrl(overlay.scoreboardUrl);
  }else{
    $('streamBox').classList.add('hidden');
    $('factOverlayUrl').value='';
    $('scoreOverlayUrl').value='';
  }

  const profiles=Array.isArray(state.speakerProfiles)?state.speakerProfiles:[];
  const speakerLabels=Array.isArray(state.detectedSpeakerLabels)?state.detectedSpeakerLabels:[];
  $('autoSpeakerState').textContent=speakerLabels.length
    ? (lang==='cz'?'Automaticky rozpoznané hlasy: ':'Automaticky rozpoznané hlasy: ')+speakerLabels.join(', ')
    : (lang==='cz'?'Čekám na rozlišení hlasů…':'Čakám na rozlíšenie hlasov…');
  const detected=Array.isArray(state.detectedParticipants)?state.detectedParticipants:[];
  const assignedNames=new Set(profiles.map(x=>String(x?.displayName||'').toLowerCase()));
  const freeDetected=detected.filter(x=>!assignedNames.has(String(x?.displayName||'').toLowerCase()));
  let autoIndex=0;
  document.querySelectorAll('.speaker-row').forEach(row=>{
    const key=row.dataset.speakerKey;
    const p=profiles.find(x=>x?.speakerKey===key);
    const name=row.querySelector('.speaker-name');
    const role=row.querySelector('.speaker-role');
    const btn=row.querySelector('.capture-speaker');
    const st=row.querySelector('.speaker-state');
    if(p){
      if(document.activeElement!==name)name.value=p.displayName||'';
      role.value=p.role==='moderator'?'moderator':'participant';
      st.textContent=t('voiceReady');
    }else if(st.dataset.busy!=='1'){
      const candidate=freeDetected[autoIndex++]||null;
      if(candidate){
        if(document.activeElement!==name)name.value=candidate.displayName||'';
        role.value=candidate.role==='moderator'?'moderator':'participant';
        const src=candidate.source==='metadata'?'názov/popis':'úvod relácie';
        const conf=Number.isFinite(Number(candidate.confidence))?' · '+Math.round(Number(candidate.confidence))+'%':'';
        st.textContent='Nájdené automaticky: '+src+conf;
      }else{
        st.textContent='';
      }
    }
    btn.textContent=st.dataset.busy==='1'?t('capturing'):t('captureVoice');
    btn.disabled=st.dataset.busy==='1'||capture.active!==true;
    role.options[0].textContent=t('participant');
    role.options[1].textContent=t('moderator');
  });

  $('mediaTitle').textContent=capture.title||t('noVideo');
  $('mediaDot').classList.toggle('live',capture.active===true);
  $('startBtn').classList.toggle('hidden',capture.active===true);
  $('stopBtn').classList.toggle('hidden',capture.active!==true);

  const status = proc.phase==='transcribing'?t('transcribing'):proc.phase==='listening'?t('listening'):proc.phase==='stopped'?t('stopped'):proc.phase==='error'?'':t('ready');
  $('statusLine').textContent=status;
  if(proc.phase==='error'&&proc.error){$('errorBox').textContent=proc.error;$('errorBox').classList.remove('hidden')}else $('errorBox').classList.add('hidden');

  const verified=claims.filter(c=>['true','mostly_true'].includes(c.verdict)).length;
  const disputed=claims.filter(c=>['misleading','false','unverified'].includes(c.verdict)).length;
  const unverified=claims.filter(c=>c.verdict==='unverified').length;
  $('sumAll').textContent=claims.length; $('sumVerified').textContent=verified; $('sumDisputed').textContent=disputed; $('sumUnverified').textContent=unverified;
  $('factsCount').textContent=claims.length; $('disputedCount').textContent=disputed;

  $('summaryList').innerHTML=claims.length?claims.slice(0,5).map(card).join(''):empty(t('emptyTitle'),t('emptyBody'));
  $('factsList').innerHTML=claims.length?claims.map(card).join(''):empty(t('emptyTitle'),t('emptyBody'));
  const disputedItems=claims.filter(c=>['misleading','false','unverified'].includes(c.verdict));
  $('disputedList').innerHTML=disputedItems.length?disputedItems.map(card).join(''):empty(t('noDisputed'));
  const patterns=claims.filter(c=>(c.repeats||1)>1);
  $('patternsList').innerHTML=patterns.length?patterns.map(card).join(''):empty(t('noPatterns'));
  bindSourceButtons();
  await loadActorStats(capture);
}

function setTab(name){
  activeTab=name;
  document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x.dataset.tab===name));
  document.querySelectorAll('.view').forEach(x=>x.classList.toggle('active',x.id===`view-${name}`));
}
document.querySelectorAll('.tab').forEach(x=>x.addEventListener('click',()=>setTab(x.dataset.tab)));

const PRIVACY_DISCLOSURE_VERSION='2026-09-27-v1';
let startAfterPrivacy=false;

async function startLiveCapture(){
  $('startBtn').disabled=true;
  $('statusLine').textContent=lang==='cz'?'Spouštím ověřování…':'Spúšťam overovanie…';
  const r=await chrome.runtime.sendMessage({type:'START_CAPTURE'});
  $('startBtn').disabled=false;
  if(!r?.ok){
    $('errorBox').textContent=r?.error||(lang==='cz'?'Ověřování se nepodařilo spustit.':'Overovanie sa nepodarilo spustiť.');
    $('errorBox').classList.remove('hidden');
  }else{
    $('errorBox').classList.add('hidden');
  }
  await render();
}

$('startBtn').addEventListener('click',async()=>{
  const saved=await chrome.storage.local.get('privacyDisclosureAcceptedVersion');
  if(saved?.privacyDisclosureAcceptedVersion!==PRIVACY_DISCLOSURE_VERSION){
    startAfterPrivacy=true;
    $('privacyDisclosure').showModal();
    return;
  }
  await startLiveCapture();
});

$('privacyAcceptBtn').addEventListener('click',async()=>{
  await chrome.storage.local.set({privacyDisclosureAcceptedVersion:PRIVACY_DISCLOSURE_VERSION});
  $('privacyDisclosure').close();
  if(startAfterPrivacy){
    startAfterPrivacy=false;
    await startLiveCapture();
  }
});

$('privacyCancelBtn').addEventListener('click',()=>{startAfterPrivacy=false});
$('privacyDisclosure').addEventListener('cancel',()=>{startAfterPrivacy=false});
$('privacyInfoBtn').addEventListener('click',()=>{startAfterPrivacy=false;$('privacyDisclosure').showModal()});
$('stopBtn').addEventListener('click',async()=>{await chrome.runtime.sendMessage({type:'STOP_CAPTURE'});await render()});
$('clearBtn').addEventListener('click',async()=>{await chrome.runtime.sendMessage({type:'CLEAR_SESSION'});await render()});
$('langBtn').addEventListener('click',async()=>{lang=lang==='sk'?'cz':'sk';await chrome.storage.local.set({uiLang:lang});await render()});

async function refreshAccountAndCredits(){
  try{await chrome.runtime.sendMessage({type:'GET_AUTH_STATE'});}catch{}
  try{await chrome.runtime.sendMessage({type:'GET_CREDIT_STATUS'});}catch{}
  await render();
}

$('signInBtn').addEventListener('click',async()=>{
  const email=$('authEmail').value.trim();
  const password=$('authPassword').value;
  $('authMessage').textContent='Prihlasujem…';
  const r=await chrome.runtime.sendMessage({type:'DETEKTOR_SIGN_IN',email,password});
  if(!r?.ok){
    $('authMessage').textContent=r?.error||'Prihlásenie zlyhalo.';
    return;
  }
  $('authPassword').value='';
  $('authMessage').textContent='Prihlásenie úspešné.';
  await refreshAccountAndCredits();
});

$('signUpBtn').addEventListener('click',async()=>{
  const email=$('authEmail').value.trim();
  const password=$('authPassword').value;
  $('authMessage').textContent='Vytváram účet…';
  const r=await chrome.runtime.sendMessage({type:'DETEKTOR_SIGN_UP',email,password});
  if(!r?.ok){
    $('authMessage').textContent=r?.error||'Registrácia zlyhala.';
    return;
  }
  $('authPassword').value='';
  if(r?.confirmationRequired){
    $('authMessage').textContent='Účet je vytvorený. Potvrď email a potom sa prihlás.';
  }else{
    $('authMessage').textContent='Účet je vytvorený a prihlásený.';
    await refreshAccountAndCredits();
  }
});

$('saveDisplayNameBtn').addEventListener('click',async()=>{
  const displayName=$('profileDisplayName').value.trim();
  $('authMessage').textContent='Ukladám zobrazované meno…';
  const r=await chrome.runtime.sendMessage({type:'DETEKTOR_UPDATE_PROFILE',displayName});
  if(!r?.ok){
    $('authMessage').textContent=r?.error||'Meno sa nepodarilo uložiť.';
    return;
  }
  $('authMessage').textContent='Zobrazované meno uložené.';
  await refreshAccountAndCredits();
});

$('signOutBtn').addEventListener('click',async()=>{
  $('authMessage').textContent='Odhlasujem…';
  const r=await chrome.runtime.sendMessage({type:'DETEKTOR_SIGN_OUT'});
  $('authMessage').textContent=r?.ok?'Odhlásený.':(r?.error||'Odhlásenie zlyhalo.');
  await refreshAccountAndCredits();
});
async function copyOverlay(inputId,buttonId){
  const input=$(inputId),button=$(buttonId);
  if(!input?.value)return;
  try{
    await navigator.clipboard.writeText(input.value);
  }catch{
    input.focus();input.select();
    try{document.execCommand('copy')}catch{}
  }
  const old=button.textContent;
  button.textContent=t('copied');
  setTimeout(()=>{button.textContent=t('copy')||old},1200);
}
$('copyFactOverlay').addEventListener('click',()=>copyOverlay('factOverlayUrl','copyFactOverlay'));
$('copyScoreOverlay').addEventListener('click',()=>copyOverlay('scoreOverlayUrl','copyScoreOverlay'));

document.querySelectorAll('.capture-speaker').forEach(btn=>btn.addEventListener('click',async()=>{
  const row=btn.closest('.speaker-row');
  const speakerKey=row?.dataset?.speakerKey||'';
  const name=row?.querySelector('.speaker-name')?.value?.trim()||'';
  const role=row?.querySelector('.speaker-role')?.value==='moderator'?'moderator':'participant';
  const st=row?.querySelector('.speaker-state');
  if(!name){
    st.textContent=lang==='cz'?'Zadej jméno.':'Zadaj meno.';
    return;
  }
  btn.disabled=true;
  st.dataset.busy='1';
  st.textContent=t('capturing');
  const res=await chrome.runtime.sendMessage({
    type:'CAPTURE_SPEAKER_REFERENCE',
    speakerKey,
    displayName:name,
    role
  });
  st.dataset.busy='0';
  if(res?.ok)st.textContent=t('voiceReady');
  else st.textContent=res?.error||'Chyba';
  await render();
}));
chrome.runtime.onMessage.addListener((msg)=>{
  if(msg?.type==='SET_SIDEPANEL_TAB' && ['summary','facts','disputed','patterns','actors'].includes(msg.tab)){
    setTab(msg.tab);
  }
});

chrome.storage.onChanged.addListener((changes)=>{
  if(changes.requestedSideTab?.newValue && ['summary','facts','disputed','patterns','actors'].includes(changes.requestedSideTab.newValue)){
    setTab(changes.requestedSideTab.newValue);
  }
  render();
});

(async()=>{
  const {requestedSideTab=null}=await chrome.storage.local.get('requestedSideTab');
  if(requestedSideTab && ['summary','facts','disputed','patterns','actors'].includes(requestedSideTab)){
    setTab(requestedSideTab);
  }else{
    setTab('actors');
  }
  // Always refresh the authenticated profile first so a stale authState
  // cannot leave an old email-looking value on screen.
  try{await chrome.runtime.sendMessage({type:'GET_AUTH_STATE'});}catch{}
  try{await chrome.runtime.sendMessage({type:'GET_CREDIT_STATUS'});}catch{}
  await render();
})();