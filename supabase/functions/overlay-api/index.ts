
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
};

function envAdmin() {
  const url = Deno.env.get("SUPABASE_URL") || "";
  const secretJson = Deno.env.get("SUPABASE_SECRET_KEYS");
  const key = secretJson ? JSON.parse(secretJson)["default"] : "";
  return { url, key };
}

async function rpc(name:string, payload:Record<string,unknown>) {
  const {url,key}=envAdmin();
  if(!url||!key) throw new Error("Supabase admin environment is not configured");
  const r=await fetch(url+"/rest/v1/rpc/"+name,{
    method:"POST",
    headers:{apikey:key,Authorization:"Bearer "+key,"content-type":"application/json"},
    body:JSON.stringify(payload)
  });
  const raw=await r.text();
  if(!r.ok) throw new Error(name+" "+r.status+": "+raw.slice(0,300));
  try{return raw?JSON.parse(raw):null}catch{return raw}
}

function json(data:unknown,status=200){
  return new Response(JSON.stringify(data),{status,headers:{...CORS,"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
}

function overlayHtml(token:string, view:string){
  const safeToken=JSON.stringify(token);
  const safeView=JSON.stringify(view);
  return `<!doctype html>
<html lang="sk">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>DETEKTOR LIVE Overlay</title>
<style>
:root{color-scheme:dark;--bg:rgba(8,12,18,.78);--card:rgba(15,22,33,.90);--line:rgba(255,255,255,.14);--text:#f7f9fc;--muted:#a9b4c4;--true:#2fb777;--mostly:#75cfa8;--mis:#e0a13b;--false:#e45562;--un:#8792a2}
*{box-sizing:border-box}
html,body{margin:0;background:transparent!important;color:var(--text);font-family:Arial,Helvetica,sans-serif;overflow:hidden}
#root{width:100%;min-height:100%;padding:28px}
.brand{font-weight:900;letter-spacing:.08em;font-size:22px;margin-bottom:12px;text-shadow:0 2px 8px rgba(0,0,0,.45)}
.brand small{font-size:11px;color:var(--muted);margin-left:10px;letter-spacing:.12em}
.panel{background:var(--bg);border:1px solid var(--line);border-radius:18px;padding:18px 20px;backdrop-filter:blur(8px)}
.hidden{display:none!important}.muted{color:var(--muted)}.status{font-size:14px;color:var(--muted)}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px}
.person{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px}.person h2{margin:0 0 12px;font-size:24px}
.chips{display:flex;flex-wrap:wrap;gap:8px}.chip{display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:6px 9px;font-size:13px;font-weight:800;border:1px solid rgba(255,255,255,.08)}
.dot{width:8px;height:8px;border-radius:50%}.t{background:rgba(47,183,119,.12)}.t .dot{background:var(--true)}.mt{background:rgba(117,207,168,.12)}.mt .dot{background:var(--mostly)}.m{background:rgba(224,161,59,.12)}.m .dot{background:var(--mis)}.f{background:rgba(228,85,98,.12)}.f .dot{background:var(--false)}.u{background:rgba(135,146,162,.12)}.u .dot{background:var(--un)}
.latest{margin-top:12px;padding-top:12px;border-top:1px solid var(--line);font-size:14px;line-height:1.4}
.claim-card{max-width:1180px;margin:0 auto;background:var(--card);border:1px solid var(--line);border-radius:16px;padding:18px 20px;box-shadow:0 14px 34px rgba(0,0,0,.28)}
.toprow{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:10px}.speaker{font-size:18px;font-weight:900}.verdict{font-size:13px;font-weight:900;padding:6px 10px;border-radius:999px}
.verdict.true{background:rgba(47,183,119,.18);color:#b9f4d8}.verdict.mostly_true{background:rgba(117,207,168,.18);color:#d7f8ea}.verdict.misleading{background:rgba(224,161,59,.18);color:#ffe0a4}.verdict.false{background:rgba(228,85,98,.18);color:#ffd0d4}.verdict.unverified{background:rgba(135,146,162,.18);color:#e0e5eb}
.claim{font-size:26px;font-weight:800;line-height:1.28}.reason{margin-top:10px;font-size:15px;color:#d7dde6;line-height:1.45}.foot{margin-top:12px;font-size:11px;color:var(--muted)}.notice{margin-top:12px;font-size:11px;color:var(--muted);text-align:center}
@media(max-width:700px){#root{padding:14px}.claim{font-size:19px}.person h2{font-size:20px}}
</style>
</head>
<body>
<div id="root">
  <div class="brand">DETEKTOR <small>LIVE FACT-CHECK</small><small id="ownerName"></small></div>
  <div id="score" class="panel hidden">
    <div id="scoreStatus" class="status">Čakám na priradené výroky účastníkov…</div>
    <div id="people" class="grid"></div>
    <div class="notice">Počty sa týkajú iba fact-checkovaných tvrdení v tejto relácii. Nejde o hodnotenie osoby ani jej celkovej dôveryhodnosti.</div>
  </div>
  <div id="fact" class="hidden"><div id="claimCard" class="claim-card"><div class="status">Čakám na prvé overené tvrdenie…</div></div></div>
</div>
<script>
(()=>{
  const TOKEN=${safeToken};
  const VIEW=${safeView};
  const endpoint=new URL(location.href);
  endpoint.searchParams.set("format","json");
  endpoint.searchParams.delete("view");
  const score=document.getElementById("score"),fact=document.getElementById("fact");
  if(VIEW==="scoreboard")score.classList.remove("hidden");else fact.classList.remove("hidden");
  const labels={true:"PRAVDIVÉ",mostly_true:"PREVAŽNE PRAVDIVÉ",misleading:"ZAVÁDZAJÚCE",false:"NEPRAVDIVÉ",unverified:"NEOVERENÉ"};
  const esc=(s)=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const chip=(cls,label,n)=>'<span class="chip '+cls+'"><span class="dot"></span>'+label+' <b>'+Number(n||0)+'</b></span>';
  function renderScore(d){
    const people=Array.isArray(d.participants)?d.participants:[];
    const wrap=document.getElementById("people");
    const status=document.getElementById("scoreStatus");
    if(!d.speakerMappingReady){status.textContent="Čakám na rozpoznanie a priradenie rečníkov…";wrap.innerHTML="";return}
    status.textContent="";
    wrap.innerHTML=people.map(p=>{
      const c=p.counts||{};
      const last=p.latestClaim?.claim?'<div class="latest"><span class="muted">Posledný fact-check:</span> '+esc(p.latestClaim.claim)+'</div>':"";
      return '<section class="person"><h2>'+esc(p.displayName)+'</h2><div class="chips">'+chip("t","Pravdivé",c.true)+chip("mt","Prevažne pravdivé",c.mostly_true)+chip("m","Zavádzajúce",c.misleading)+chip("f","Nepravdivé",c.false)+chip("u","Neoverené",c.unverified)+'</div>'+last+'</section>';
    }).join("");
  }
  function renderFact(d){
    const c=d.latestClaim,el=document.getElementById("claimCard");
    if(!c){el.innerHTML='<div class="status">Čakám na prvé overené tvrdenie…</div>';return}
    const speaker=c.speakerName?'<div class="speaker">'+esc(c.speakerName)+'</div>':'<div class="speaker">Overené tvrdenie</div>';
    const verdict=esc(labels[c.verdict]||"NEOVERENÉ");
    const conf=Number.isFinite(Number(c.confidence))?' · istota dôkazov '+Math.round(Number(c.confidence))+' %':'';
    el.innerHTML='<div class="toprow">'+speaker+'<span class="verdict '+esc(c.verdict||"unverified")+'">'+verdict+'</span></div><div class="claim">„'+esc(c.claim)+'“</div>'+(c.rationale?'<div class="reason">'+esc(c.rationale)+'</div>':'')+'<div class="foot">DETEKTOR LIVE'+conf+'</div>';
  }
  async function tick(){
    try{
      const r=await fetch(endpoint.toString(),{cache:"no-store"});
      const d=await r.json();
      if(d.ok){
        const owner=document.getElementById("ownerName");
        if(owner)owner.textContent=d.ownerDisplayName ? " · "+d.ownerDisplayName : "";
        if(VIEW==="scoreboard")renderScore(d);else renderFact(d)
      }
    }catch(e){}
    setTimeout(tick,2000);
  }
  tick();
})();
</script>
</body></html>`;
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:CORS});
  const u=new URL(req.url);
  if(req.method==="GET"){
    const token=String(u.searchParams.get("token")||"");
    if(!token)return json({ok:false,error:"token_required"},400);
    const state=await rpc("get_stream_overlay_state",{p_token:token});
    if(u.searchParams.get("format")==="json")return json(state,state?.ok===false?403:200);
    if(state?.ok===false)return new Response("Overlay token je neplatný alebo expirovaný.",{status:403,headers:{...CORS,"content-type":"text/plain; charset=utf-8"}});
    const view=u.searchParams.get("view")==="scoreboard"?"scoreboard":"factcheck";
    return new Response(overlayHtml(token,view),{headers:{...CORS,"content-type":"text/html; charset=utf-8","cache-control":"no-store"}});
  }
  if(req.method!=="POST")return json({error:"GET or POST only"},405);
  const publishableJson=Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  const allowed=publishableJson?Object.values(JSON.parse(publishableJson)):[];
  const supplied=req.headers.get("apikey")||"";
  if(!allowed.includes(supplied))return json({error:"Unauthorized"},401);
  const body=await req.json();
  if(body?.action==="create"){
    const created=await rpc("create_stream_overlay",{
      p_session_id:String(body.sessionId||""),
      p_source_url:String(body.sourceUrl||""),
      p_media_title:String(body.mediaTitle||""),
      p_started_at:body.startedAt||null,
      p_expires_hours:Number.isFinite(Number(body.expiresHours))?Number(body.expiresHours):12
    });
    const supabaseUrl=(Deno.env.get("SUPABASE_URL")||u.origin).replace(/\/+$/,"");
    const base=supabaseUrl+"/functions/v1/overlay-api";
    return json({ok:true,...created,factcheckUrl:base+"?view=factcheck&token="+encodeURIComponent(created.token),scoreboardUrl:base+"?view=scoreboard&token="+encodeURIComponent(created.token)});
  }
  if(body?.action==="revoke"){
    const revoked=await rpc("revoke_stream_overlay",{p_token:String(body.token||"")});
    return json({ok:true,revoked});
  }
  return json({error:"Unknown action"},400);
});
