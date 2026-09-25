const $ = id => document.getElementById(id);
let activeTab = 'summary';
let lang = 'sk';

const dict = {
  sk: {
    summary:'Prehľad', facts:'Tvrdenia', disputed:'Sporné', patterns:'Vzorce', captured:'Zachytené tvrdenia',
    verified:'Overené', disputedShort:'Sporné', unverified:'Neoverené', latest:'Posledné tvrdenia',
    disputedNote:'Zavádzajúce, nepravdivé a neoverené tvrdenia.', patternsNote:'Tu sa zobrazia výroky, ktoré sa počas relácie opakujú.',
    noCaptions:'bez titulkov', start:'Spustiť overovanie', stop:'Zastaviť', clear:'Vymazať', ready:'Pripravené.',
    listening:'Počúvam audio aktuálneho tabu…', transcribing:'Prepisujem a analyzujem posledný úsek…', stopped:'Overovanie je zastavené.',
    noVideo:'Klikni na ikonu faktySKCZ pri otvorenom videu', emptyTitle:'Zatiaľ bez tvrdení', emptyBody:'Po spustení sa sem budú pridávať overiteľné výroky.',
    noDisputed:'Zatiaľ bez sporných tvrdení', noPatterns:'Zatiaľ bez opakovaných tvrdení', sources:'Zdroje', noSources:'Zdroj nie je v tomto výsledku dostupný.',
    confidence:'istota', repeats:'× opakované', timeFallback:'od spustenia'
  },
  cz: {
    summary:'Přehled', facts:'Tvrzení', disputed:'Sporné', patterns:'Vzorce', captured:'Zachycená tvrzení',
    verified:'Ověřené', disputedShort:'Sporné', unverified:'Neověřené', latest:'Poslední tvrzení',
    disputedNote:'Zavádějící, nepravdivá a neověřená tvrzení.', patternsNote:'Zde se zobrazí výroky, které se během pořadu opakují.',
    noCaptions:'bez titulků', start:'Spustit ověřování', stop:'Zastavit', clear:'Vymazat', ready:'Připraveno.',
    listening:'Poslouchám audio aktuálního panelu…', transcribing:'Přepisuji a analyzuji poslední úsek…', stopped:'Ověřování je zastaveno.',
    noVideo:'Klikni na ikonu faktySKCZ při otevřeném videu', emptyTitle:'Zatím bez tvrzení', emptyBody:'Po spuštění se sem budou přidávat ověřitelná tvrzení.',
    noDisputed:'Zatím bez sporných tvrzení', noPatterns:'Zatím bez opakovaných tvrzení', sources:'Zdroje', noSources:'Zdroj není v tomto výsledku dostupný.',
    confidence:'jistota', repeats:'× opakováno', timeFallback:'od spuštění'
  }
};
const t = k => dict[lang][k] || k;

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

async function render(){
  const state=await chrome.storage.local.get(['sessionClaims','captureState','processingState','uiLang']);
  const claims=Array.isArray(state.sessionClaims)?state.sessionClaims:[];
  const capture=state.captureState||{};
  const proc=state.processingState||{};
  lang=state.uiLang||lang;
  $('langBtn').textContent=lang.toUpperCase();
  document.documentElement.lang=lang;
  document.querySelectorAll('[data-i18n]').forEach(el=>el.textContent=t(el.dataset.i18n));
  $('startBtn').textContent=t('start'); $('stopBtn').textContent=t('stop'); $('clearBtn').textContent=t('clear');

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
}

function setTab(name){
  activeTab=name;
  document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x.dataset.tab===name));
  document.querySelectorAll('.view').forEach(x=>x.classList.toggle('active',x.id===`view-${name}`));
}
document.querySelectorAll('.tab').forEach(x=>x.addEventListener('click',()=>setTab(x.dataset.tab)));

$('startBtn').addEventListener('click',async()=>{
  $('startBtn').disabled=true;
  const r=await chrome.runtime.sendMessage({type:'START_CAPTURE'});
  $('startBtn').disabled=false;
  if(!r?.ok){$('errorBox').textContent=r?.error||'Chyba';$('errorBox').classList.remove('hidden')}
  await render();
});
$('stopBtn').addEventListener('click',async()=>{await chrome.runtime.sendMessage({type:'STOP_CAPTURE'});await render()});
$('clearBtn').addEventListener('click',async()=>{await chrome.runtime.sendMessage({type:'CLEAR_SESSION'});await render()});
$('langBtn').addEventListener('click',async()=>{lang=lang==='sk'?'cz':'sk';await chrome.storage.local.set({uiLang:lang});await render()});
chrome.storage.onChanged.addListener(()=>render());
render();