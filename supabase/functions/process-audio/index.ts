import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const GOOGLE_ENDPOINT = "https://factchecktools.googleapis.com/v1alpha1/claims:search";
const STOP = new Set(["a","aj","ale","alebo","ani","ako","asi","bez","bol","bola","bolo","boli","by","cez","do","ho","i","je","jej","ich","ja","k","ked","keď","kto","ma","má","mi","na","nad","ne","nie","o","od","po","pod","pre","pri","sa","si","so","sú","su","tak","tam","ten","to","tu","u","už","v","vo","z","za","že","ze","se","jsou","jsem","byl","byla","bylo","byli","který","která","které"]);

function reply(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "content-type": "application/json; charset=utf-8" }
  });
}

function normalize(s = "") {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}
function tokens(s: string) {
  return new Set(normalize(s).split(" ").filter((x) => x.length > 2 && !STOP.has(x)));
}
function similarity(a: string, b: string) {
  const A = tokens(a), B = tokens(b);
  if (!A.size || !B.size) return 0;
  let n = 0;
  for (const x of A) if (B.has(x)) n++;
  return n / new Set([...A, ...B]).size;
}
function hostname(url = "") {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}
function weight(url = "") {
  const d = hostname(url);
  if (d === "demagog.sk" || d === "demagog.cz") return 1;
  if (d.endsWith(".gov.sk") || d.endsWith(".gov.cz") || d.endsWith(".europa.eu") || d === "slov-lex.sk" || d === "nbs.sk" || d === "cnb.cz" || d === "czso.cz" || d === "slovak.statistics.sk") return 1;
  if (d.includes("reuters.com") || d.includes("afp.com")) return .95;
  return .86;
}
function verdict(r = "") {
  const s = normalize(r);
  if (/neprav|false|incorrect|nesprav|klam|hoax|pants on fire/.test(s)) return "false";
  if (/zavadz|mislead|mostly false|partly false|half true|poloprav|manipul/.test(s)) return "misleading";
  if (/prevazne prav|mostly true|largely true|mostly correct/.test(s)) return "mostly_true";
  if (/pravd|true|correct|spravn/.test(s)) return "true";
  return "unverified";
}
function verdictLabel(v: string) {
  const m: Record<string,string> = {
    true: "PRAVDIVÉ",
    mostly_true: "PREVAŽNE PRAVDIVÉ",
    misleading: "ZAVÁDZAJÚCE",
    false: "NEPRAVDIVÉ",
    unverified: "NEOVERENÉ"
  };
  return m[v] || "NEOVERENÉ";
}
function decode64(base64: string) {
  const bin = atob(base64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function transcribe(audioBase64: string, mimeType: string, speakerProfiles: any[]) {
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) throw new Error("OPENAI_API_KEY is not configured");

  const known = Array.isArray(speakerProfiles)
    ? speakerProfiles.slice(0,4).filter((x:any)=>x?.speakerKey && x?.referenceDataUrl)
    : [];
  const diarize = known.length > 0;
  const model = diarize
    ? (Deno.env.get("DIARIZE_MODEL") || "gpt-4o-transcribe-diarize")
    : (Deno.env.get("TRANSCRIBE_MODEL") || "gpt-4o-mini-transcribe");

  const form = new FormData();
  form.append("file", new Blob([decode64(audioBase64)], { type: mimeType || "audio/webm" }), "audio.webm");
  form.append("model", model);

  if (diarize) {
    form.append("response_format", "diarized_json");
    form.append("chunking_strategy", "auto");
    for (const p of known) {
      form.append("known_speaker_names[]", String(p.speakerKey));
      form.append("known_speaker_references[]", String(p.referenceDataUrl));
    }
  }

  const r = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: "Bearer " + key },
    body: form
  });
  if (!r.ok) throw new Error("Transcription " + r.status + ": " + (await r.text()).slice(0,400));
  const d = await r.json();

  const segments = diarize && Array.isArray(d.segments)
    ? d.segments.map((s:any)=>({
        speaker: String(s?.speaker || ""),
        start: Number(s?.start || 0),
        end: Number(s?.end || 0),
        text: String(s?.text || "").trim()
      })).filter((s:any)=>s.text)
    : [];

  return {
    text: String(d.text || "").trim(),
    usage: d.usage || null,
    segments,
    diarized: diarize,
    model
  };
}

function outputText(d: any) {
  if (typeof d.output_text === "string") return d.output_text;
  for (const item of d.output || []) {
    for (const c of item.content || []) if (typeof c.text === "string") return c.text;
  }
  return "";
}

function parseJsonText(raw: string) {
  let x = raw.trim();
  x = x.replace(/^\`\`\`json\s*/i, "").replace(/^\`\`\`\s*/, "").replace(/\`\`\`\s*$/i, "").trim();
  return JSON.parse(x);
}

async function extractClaims(transcript: string, contextBefore: string, segments: any[], pageContext: any) {
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key || !transcript) return { claims: [], participants: [], usage: null };

  const diarizedText = Array.isArray(segments) && segments.length
    ? segments.map((s:any)=>"[" + String(s.speaker || "unknown") + "] " + String(s.text || "")).join("\n")
    : transcript;

  const pageMeta = [
    pageContext?.title,
    pageContext?.description,
    pageContext?.ogTitle,
    pageContext?.ogDescription,
    pageContext?.heading
  ].filter(Boolean).map(String).join("\n").slice(0,2500);

  const prompt =
    "You extract fact-checkable claims and explicitly identified participants from Czech/Slovak political or news speech.\n" +
    "PAGE / VIDEO METADATA (use only to identify explicitly named participants; do not invent people):\n---\n" +
    (pageMeta || "(none)") +
    "\n---\nPREVIOUS CONTEXT (for resolving references only; do not extract old claims):\n---\n" +
    (contextBefore || "(none)") +
    "\n---\nCURRENT SEGMENT WITH OPTIONAL SPEAKER LABELS:\n---\n" + diarizedText + "\n---\n" +
    "Return JSON only: {\"claims\":[{\"claim\":\"self-contained claim\",\"speakerKey\":\"speaker label or null\"}],\"participants\":[{\"displayName\":\"full name\",\"role\":\"participant|moderator\",\"source\":\"metadata|intro\",\"confidence\":0}]}. " +
    "Extract only claims actually asserted in CURRENT SEGMENT that are concrete and externally verifiable. " +
    "If speaker labels are present in square brackets, preserve the exact label of the person who asserted the claim. " +
    "Extract a participant only when the person's name is explicitly present in PAGE/VIDEO METADATA or they are explicitly introduced in CURRENT SEGMENT (for example 'vítam ...', 'mojím hosťom je ...', 'diskutujú ...'). " +
    "Use role moderator only when explicitly clear; otherwise use participant. Do not infer identity from voice, political affiliation, or topic. " +
    "Do not repeat the same participant. Confidence is confidence that the name/role was explicitly identified, not a political score. " +
    "Never infer a person's real identity from wording or political context. If attribution is ambiguous, speakerKey must be null. " +
    "Rewrite pronouns or vague references into a self-contained claim only when the referent is explicit in PREVIOUS CONTEXT. " +
    "Discard incomplete, subjective, rhetorical, predictive, personal-experience-only, or contextless statements. " +
    "Prefer numbers, dates, laws, public records, historical events and measurable statements. Maximum 5 claims. Preserve Czech/Slovak.";

  const r = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: "Bearer " + key, "content-type": "application/json" },
    body: JSON.stringify({
      model: Deno.env.get("CLAIM_MODEL") || "gpt-5.6-terra",
      input: prompt,
      max_output_tokens: 700
    })
  });
  if (!r.ok) throw new Error("Claim extraction " + r.status + ": " + (await r.text()).slice(0,400));
  const d = await r.json();
  try {
    const p = parseJsonText(outputText(d));
    const claims = Array.isArray(p.claims)
      ? p.claims.slice(0,5).map((x:any)=>{
          if (typeof x === "string") return { claim:x.trim(), speakerKey:null };
          return {
            claim:String(x?.claim || "").trim(),
            speakerKey:x?.speakerKey == null ? null : String(x.speakerKey).trim() || null
          };
        }).filter((x:any)=>x.claim.length >= 15)
      : [];
    const participants = Array.isArray(p.participants)
      ? p.participants.slice(0,8).map((x:any)=>({
          displayName:String(x?.displayName || "").trim(),
          role:x?.role === "moderator" ? "moderator" : "participant",
          source:x?.source === "metadata" ? "metadata" : "intro",
          confidence:Number.isFinite(Number(x?.confidence)) ? Math.max(0,Math.min(100,Math.round(Number(x.confidence)))) : null
        })).filter((x:any)=>x.displayName.length >= 3)
      : [];
    return { claims, participants, usage: d.usage || null };
  } catch {
    return { claims: [], participants: [], usage: d.usage || null };
  }
}

async function googleSearch(q: string, publisher?: string) {
  const key = Deno.env.get("GOOGLE_FACTCHECK_API_KEY");
  if (!key) return [];
  const p = new URLSearchParams({ key, query: q, pageSize: "10" });
  if (publisher) p.set("reviewPublisherSiteFilter", publisher);
  const r = await fetch(GOOGLE_ENDPOINT + "?" + p.toString());
  if (!r.ok) return [];
  const d = await r.json();
  const out: any[] = [];
  for (const c of d.claims || []) {
    for (const review of c.claimReview || []) {
      out.push({
        claimText: c.text || "",
        claimant: c.claimant || "",
        publisher: review.publisher?.name || "",
        title: review.title || c.text || "",
        url: review.url || "",
        reviewUrl: review.url || "",
        reviewDate: review.reviewDate || null,
        rating: review.textualRating || ""
      });
    }
  }
  return out;
}

async function verifyFromFactchecks(claim: string) {
  const groups = await Promise.all([
    googleSearch(claim),
    googleSearch(claim, "demagog.sk"),
    googleSearch(claim, "demagog.cz")
  ]);
  const uniq: any[] = [];
  const seen = new Set<string>();
  for (const x of groups.flat()) {
    const k = x.reviewUrl + "|" + x.claimText + "|" + x.rating;
    if (!seen.has(k)) { seen.add(k); uniq.push(x); }
  }
  const scored = uniq.map((x) => {
    const s = similarity(claim, x.claimText) * weight(x.reviewUrl);
    return { ...x, score: s, verdict: verdict(x.rating) };
  }).filter((x) => x.verdict !== "unverified").sort((a,b) => b.score - a.score);

  const best = scored[0];
  const min = Number(Deno.env.get("MIN_MATCH_CONFIDENCE") || "55") / 100;
  if (!best || best.score < min) return null;

  return {
    claim,
    verdict: best.verdict,
    verdictLabel: verdictLabel(best.verdict),
    matchConfidence: Math.max(1, Math.min(99, Math.round(best.score * 100))),
    explanation: "Zhoda s už publikovaným fact-checkom.",
    selectedSource: best,
    candidates: scored.slice(0,10),
    verificationMode: "factcheck_database"
  };
}

function normalizeWebResult(claim: string, x: any) {
  const allowed = new Set(["true","mostly_true","misleading","false","unverified"]);
  const v = allowed.has(String(x?.verdict)) ? String(x.verdict) : "unverified";
  const confidence = Number.isFinite(Number(x?.confidence))
    ? Math.max(0, Math.min(99, Math.round(Number(x.confidence))))
    : null;
  const sources = Array.isArray(x?.sources)
    ? x.sources.slice(0,5).map((s:any)=>({
        title: String(s?.title || s?.publisher || s?.url || "Zdroj"),
        url: String(s?.url || ""),
        publisher: String(s?.publisher || ""),
        date: s?.date || null,
        tier: String(s?.tier || "")
      })).filter((s:any)=>s.url)
    : [];
  return {
    claim,
    verdict: v,
    verdictLabel: verdictLabel(v),
    matchConfidence: confidence,
    explanation: String(x?.explanation || ""),
    selectedSource: sources[0] || null,
    candidates: sources,
    verificationMode: "web_search"
  };
}

async function webVerifyClaims(claims: string[]) {
  if (!claims.length) return [];
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) return claims.map((claim)=>normalizeWebResult(claim, { verdict:"unverified", confidence:null, explanation:"Chýba OpenAI API key.", sources:[] }));

  const prompt =
    "You are a neutral evidence-based fact-checking engine for Czech and Slovak public-affairs statements. " +
    "Fact-check EACH claim below using current web search. Do not rate, rank, endorse, oppose, or assess any politician/person overall. " +
    "Judge only the specific factual proposition. Prefer primary sources: official statistics, laws, ministries, central banks, election/public records, EU institutions and original documents. " +
    "Use established fact-checkers or major news agencies as secondary evidence. Avoid blogs/social posts unless they are the primary artifact being verified. " +
    "If the wording is vague, context is missing, evidence conflicts, or the proposition cannot be established reliably, use unverified. " +
    "For time-sensitive claims, use sources relevant to the stated time period. " +
    "Confidence means confidence in evidence/relevance, NOT percent truth. " +
    "Return JSON only with exactly this shape: " +
    "{\"results\":[{\"index\":0,\"verdict\":\"true|mostly_true|misleading|false|unverified\",\"confidence\":0,\"explanation\":\"1-2 factual sentences\",\"sources\":[{\"title\":\"\",\"url\":\"https://...\",\"publisher\":\"\",\"date\":\"YYYY-MM-DD or null\",\"tier\":\"A|B|C|D\"}]}]}. " +
    "Tier A=primary/official, B=established fact-check/research, C=major news agency/media, D=other web. Maximum 4 sources per claim.\n\n" +
    claims.map((c,i)=>i + ": " + c).join("\n");

  const r = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: "Bearer " + key, "content-type": "application/json" },
    body: JSON.stringify({
      model: Deno.env.get("FACTCHECK_MODEL") || "gpt-5.6-terra",
      tools: [{ type: "web_search", search_context_size: "medium" }],
      input: prompt,
      max_output_tokens: 1400
    })
  });
  if (!r.ok) {
    const err = await r.text();
    console.error("WEB_VERIFY_ERROR", r.status, err.slice(0,400));
    return claims.map((claim)=>normalizeWebResult(claim, {
      verdict:"unverified",
      confidence:null,
      explanation:"Webové overenie momentálne zlyhalo.",
      sources:[]
    }));
  }
  const d = await r.json();
  try {
    const p = parseJsonText(outputText(d));
    const byIndex = new Map<number,any>();
    for (const item of Array.isArray(p.results) ? p.results : []) byIndex.set(Number(item.index), item);
    return claims.map((claim,i)=>normalizeWebResult(claim, byIndex.get(i) || {
      verdict:"unverified",
      confidence:null,
      explanation:"Nenašiel sa dostatočný podklad na spoľahlivé overenie.",
      sources:[]
    }));
  } catch (e) {
    console.error("WEB_VERIFY_PARSE_ERROR", String(e), outputText(d).slice(0,500));
    return claims.map((claim)=>normalizeWebResult(claim, {
      verdict:"unverified",
      confidence:null,
      explanation:"Výsledok webového overenia sa nepodarilo spracovať.",
      sources:[]
    }));
  }
}


function uniqueClaimTexts(claims: any[]) {
  const out: string[] = [];
  for (const item of claims || []) {
    const claim = String(item?.claim || "").trim();
    if (!claim) continue;
    if (!out.some((x) => similarity(x, claim) >= 0.78)) out.push(claim);
  }
  return out.slice(0, 5);
}

async function embedClaims(claims: string[]) {
  if (!claims.length) return [];
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) return claims.map(()=>null);
  const model = "text-embedding-3-small";
  const r = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { Authorization: "Bearer " + key, "content-type": "application/json" },
    body: JSON.stringify({ model, input: claims })
  });
  if (!r.ok) {
    console.error("EMBEDDING_ERROR", r.status, (await r.text()).slice(0,300));
    return claims.map(()=>null);
  }
  const d = await r.json();
  const rows = Array.isArray(d.data) ? d.data : [];
  const byIndex = new Map<number, any>();
  for (const row of rows) byIndex.set(Number(row.index), row.embedding);
  return claims.map((_,i)=>byIndex.get(i) || null);
}

async function findCachedFactcheck(claim: string, embedding: any) {
  if (!embedding) return null;
  try {
    const rows = await callAdminRpc("match_factcheck_cache", {
      p_query_embedding: embedding,
      p_min_similarity: 0.92,
      p_max_age_days: 30
    });
    const hit = Array.isArray(rows) ? rows[0] : null;
    if (!hit) return null;

    try {
      await callAdminRpc("increment_factcheck_cache_hit", { p_cache_id: hit.cache_id });
    } catch {}

    return {
      claim,
      verdict: hit.verdict,
      verdictLabel: verdictLabel(hit.verdict),
      matchConfidence: hit.confidence == null ? null : Math.max(1, Math.min(99, Math.round(Number(hit.confidence) * 100))),
      explanation: hit.explanation || "Použitý už overený záznam z lokálnej fact-check databázy.",
      selectedSource: hit.selected_source || null,
      candidates: Array.isArray(hit.candidates) ? hit.candidates : [],
      verificationMode: "local_cache",
      cacheSimilarity: Math.round(Number(hit.similarity || 0) * 100)
    };
  } catch (e) {
    console.error("CACHE_LOOKUP_ERROR", String(e));
    return null;
  }
}

async function storeFactcheckCache(claim: string, embedding: any, item: any) {
  if (!embedding || !item || item.verdict === "unverified") return;
  const candidates = Array.isArray(item.candidates) ? item.candidates : [];
  if (!candidates.length && !item.selectedSource) return;

  const { url, key } = adminConfig();
  if (!url || !key) return;
  try {
    await fetch(url + "/rest/v1/factcheck_cache", {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: "Bearer " + key,
        "content-type": "application/json",
        Prefer: "return=minimal"
      },
      body: JSON.stringify({
        claim_text: claim,
        normalized_claim: normalize(claim),
        embedding,
        embedding_model: "text-embedding-3-small",
        verdict: item.verdict,
        confidence: item.matchConfidence == null ? null : Number(item.matchConfidence) / 100,
        explanation: item.explanation || null,
        selected_source: item.selectedSource || null,
        candidates,
        verification_mode: item.verificationMode || "unknown",
        metadata: { cachedBy: "process-audio-v13" }
      })
    });
  } catch (e) {
    console.error("CACHE_STORE_ERROR", String(e));
  }
}

async function verifyClaims(claimOccurrences: any[]) {
  const uniqueTexts = uniqueClaimTexts(claimOccurrences);
  const verifiedByText = new Map<string,any>();
  const embeddings = await embedClaims(uniqueTexts);
  const afterCache: { index:number, claim:string }[] = [];
  let cacheHits = 0;

  for (let i=0;i<uniqueTexts.length;i++) {
    const hit = await findCachedFactcheck(uniqueTexts[i], embeddings[i]);
    if (hit) {
      verifiedByText.set(uniqueTexts[i], hit);
      cacheHits++;
    } else {
      afterCache.push({ index:i, claim:uniqueTexts[i] });
    }
  }

  const afterFactcheckDb: { index:number, claim:string }[] = [];
  for (const item of afterCache) {
    const hit = await verifyFromFactchecks(item.claim);
    if (hit) {
      verifiedByText.set(item.claim, hit);
      await storeFactcheckCache(item.claim, embeddings[item.index], hit);
    } else {
      afterFactcheckDb.push(item);
    }
  }

  if (afterFactcheckDb.length) {
    const web = await webVerifyClaims(afterFactcheckDb.map(x=>x.claim));
    for (let j=0;j<afterFactcheckDb.length;j++) {
      const u = afterFactcheckDb[j];
      verifiedByText.set(u.claim, web[j]);
      await storeFactcheckCache(u.claim, embeddings[u.index], web[j]);
    }
  }

  const results = (claimOccurrences || []).map((occ:any)=>{
    const claim = String(occ?.claim || "").trim();
    let bestKey = "";
    let bestScore = -1;
    for (const key of uniqueTexts) {
      const s = similarity(key, claim);
      if (s > bestScore) { bestScore = s; bestKey = key; }
    }
    const base = verifiedByText.get(bestKey) || normalizeWebResult(claim,{
      verdict:"unverified",
      confidence:null,
      explanation:"Nenašiel sa dostatočný podklad na spoľahlivé overenie.",
      sources:[]
    });
    return {
      ...base,
      claim,
      speakerKey: occ?.speakerKey == null ? null : String(occ.speakerKey)
    };
  });

  return {
    results,
    metrics: {
      inputClaims: claimOccurrences.length,
      uniqueClaims: uniqueTexts.length,
      cacheHits,
      externalChecks: uniqueTexts.length - cacheHits,
      webChecks: afterFactcheckDb.length
    }
  };
}

async function saveAudit(client: string, transcript: string, item: any, metadata: any) {
  const url = Deno.env.get("SUPABASE_URL");
  const secretJson = Deno.env.get("SUPABASE_SECRET_KEYS");
  const key = secretJson ? JSON.parse(secretJson)["default"] : "";
  if (!url || !key) return;

  await fetch(url + "/rest/v1/factcheck_audits", {
    method: "POST",
    headers: {
      apikey: key,
      "content-type": "application/json",
      Prefer: "return=minimal"
    },
    body: JSON.stringify({
      client,
      transcript,
      claim: item.claim || null,
      verdict: item.verdict || null,
      verdict_label: item.verdictLabel || null,
      match_confidence: item.matchConfidence ?? null,
      selected_source: item.selectedSource || null,
      candidates: item.candidates || [],
      metadata: {
        sourceMode: "tab-audio",
        verificationMode: item.verificationMode || "unknown",
        sourcesVisibleToViewer: true,
        ...metadata
      }
    })
  });
}


function adminConfig() {
  const url = Deno.env.get("SUPABASE_URL") || "";
  const secretJson = Deno.env.get("SUPABASE_SECRET_KEYS");
  const key = secretJson ? JSON.parse(secretJson)["default"] : "";
  return { url, key };
}

async function getAuthUser(accessToken: string, publishableKey: string) {
  if (!accessToken) return null;
  const url = Deno.env.get("SUPABASE_URL") || "";
  if (!url) throw new Error("SUPABASE_URL is not configured");
  const r = await fetch(url + "/auth/v1/user", {
    headers: {
      apikey: publishableKey,
      Authorization: "Bearer " + accessToken
    }
  });
  if (r.status === 401 || r.status === 403) return null;
  if (!r.ok) throw new Error("Auth user " + r.status + ": " + (await r.text()).slice(0,300));
  return await r.json();
}

async function callAdminRpc(name: string, payload: Record<string, unknown>) {
  const { url, key } = adminConfig();
  if (!url || !key) throw new Error("Supabase admin environment is not configured");
  const r = await fetch(url + "/rest/v1/rpc/" + name, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: "Bearer " + key,
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  const raw = await r.text();
  if (!r.ok) throw new Error("Archive RPC " + r.status + ": " + raw.slice(0, 400));
  try { return raw ? JSON.parse(raw) : null; } catch { return raw; }
}

async function recordRawUsageSafe(payload: Record<string, unknown>) {
  try {
    return await callAdminRpc("detektor_record_raw_usage", payload);
  } catch (e) {
    console.error("RAW_USAGE_LOG_ERROR", e instanceof Error ? e.message : String(e));
    return null;
  }
}

async function archiveChunk(body: any, client: string, transcript: string, results: any[], metadata: any) {
  const sessionId = String(body.sessionId || "");
  if (!sessionId) return null;
  return await callAdminRpc("archive_factcheck_chunk", {
    p_session_id: sessionId,
    p_client: client,
    p_source_url: String(body.sourceUrl || ""),
    p_media_title: String(body.mediaTitle || ""),
    p_language: String(body.language || "auto"),
    p_started_at: body.sessionStartedAt || null,
    p_sequence_no: Number.isFinite(Number(body.sequenceNo)) ? Number(body.sequenceNo) : 0,
    p_audio_duration_ms: Number.isFinite(Number(body.audioDurationMs)) ? Number(body.audioDurationMs) : 40000,
    p_transcript: transcript || "",
    p_results: results || [],
    p_metadata: metadata || {}
  });
}

async function syncParticipants(sessionId: string, profiles: any[]) {
  if (!sessionId || !Array.isArray(profiles) || !profiles.length) return null;
  const participants = profiles.slice(0,8).map((p:any)=>({
    speakerKey:String(p?.speakerKey || "").trim() || null,
    displayName:String(p?.displayName || "").trim(),
    role:p?.role === "moderator" ? "moderator" : "participant",
    source:String(p?.source || (p?.speakerKey ? "known-speaker-reference" : "auto-detected")),
    confidence:Number.isFinite(Number(p?.confidence)) ? Number(p.confidence) : null
  })).filter((p:any)=>p.displayName);
  if (!participants.length) return null;
  return await callAdminRpc("sync_session_participants", {
    p_session_id: sessionId,
    p_participants: participants
  });
}

async function archiveSpeakerSegments(body: any, segments: any[]) {
  const sessionId = String(body.sessionId || "");
  if (!sessionId || !Array.isArray(segments) || !segments.length) return null;
  return await callAdminRpc("archive_speaker_segments", {
    p_session_id: sessionId,
    p_sequence_no: Number.isFinite(Number(body.sequenceNo)) ? Number(body.sequenceNo) : 0,
    p_audio_duration_ms: Number.isFinite(Number(body.audioDurationMs)) ? Number(body.audioDurationMs) : 40000,
    p_segments: segments
  });
}

async function completeSession(sessionId: string) {
  if (!sessionId) return null;
  return await callAdminRpc("complete_factcheck_session", { p_session_id: sessionId });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return reply({ error: "POST only" }, 405);

  const publishableJson = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  const allowed = publishableJson ? Object.values(JSON.parse(publishableJson)) : [];
  const supplied = req.headers.get("apikey") || "";
  if (!allowed.includes(supplied)) return reply({ error: "Unauthorized" }, 401);

  const started = Date.now();
  let billingReservationId: string | null = null;
  let billingClientInstallId = "";
  let billingEnabled = false;
  let usageSeconds = 0;

  try {
    const body = await req.json();
    const installId = String(body?.clientInstallId || "").trim();
    const accessToken = String(body?.accessToken || "").trim();
    const authUser = accessToken ? await getAuthUser(accessToken, supplied) : null;

    if (accessToken && !authUser) {
      return reply({
        error:"AUTH_SESSION_EXPIRED",
        userMessage:"Prihlásenie vypršalo. Prihlás sa znova.",
        errorCode:"auth_session_expired",
        fatal:false
      },401);
    }

    billingClientInstallId = installId;
    let accountBinding: any = null;

    if (authUser?.id && installId) {
      accountBinding = await callAdminRpc("detektor_bind_wallet", {
        p_user_id: authUser.id,
        p_client_install_id: installId
      });
      billingClientInstallId = String(accountBinding?.billingKey || ("user:" + authUser.id));
    }

    if (body?.action === "bind_account") {
      if (!authUser?.id) {
        return reply({error:"AUTH_REQUIRED",userMessage:"Najprv sa prihlás.",errorCode:"auth_required"},401);
      }
      if (!installId) return reply({error:"CLIENT_INSTALL_ID_REQUIRED"},400);
      const credits = accountBinding || await callAdminRpc("detektor_bind_wallet", {
        p_user_id: authUser.id,
        p_client_install_id: installId
      });
      const billing = await callAdminRpc("detektor_billing_state", {});
      const profile = await callAdminRpc("detektor_get_profile",{p_user_id:authUser.id});
      return reply({
        ok:true,
        account:{id:authUser.id,email:authUser.email || null,displayName:profile?.displayName || null},
        credits:{...credits,billingEnforced:billing?.enforced===true}
      });
    }

    if (body?.action === "profile_get") {
      if (!authUser?.id) {
        return reply({error:"AUTH_REQUIRED",userMessage:"Najprv sa prihlás.",errorCode:"auth_required"},401);
      }
      const profile=await callAdminRpc("detektor_get_profile",{p_user_id:authUser.id});
      return reply({
        ok:true,
        account:{id:authUser.id,email:authUser.email || null,displayName:profile?.displayName || null}
      });
    }

    if (body?.action === "profile_update") {
      if (!authUser?.id) {
        return reply({error:"AUTH_REQUIRED",userMessage:"Najprv sa prihlás.",errorCode:"auth_required"},401);
      }
      const displayName=String(body?.displayName||"").trim();
      if(displayName.length<2 || displayName.length>40){
        return reply({error:"DISPLAY_NAME_INVALID_LENGTH",userMessage:"Zobrazované meno musí mať 2 až 40 znakov."},400);
      }
      const profile=await callAdminRpc("detektor_set_display_name",{
        p_user_id:authUser.id,
        p_display_name:displayName
      });
      return reply({
        ok:true,
        account:{id:authUser.id,email:authUser.email || null,displayName:profile?.displayName || null}
      });
    }

    if (body?.action === "test_purchase") {
      if (!authUser?.id) {
        return reply({error:"AUTH_REQUIRED",userMessage:"Najprv sa prihlás.",errorCode:"auth_required"},401);
      }
      const productCode=String(body?.productCode||"").trim();
      const purchaseId=String(body?.purchaseId||"").trim();
      if(!productCode || !purchaseId){
        return reply({error:"INVALID_TEST_PURCHASE",userMessage:"Neplatný testovací nákup."},400);
      }
      const purchase=await callAdminRpc("detektor_test_purchase",{
        p_user_id:authUser.id,
        p_product_code:productCode,
        p_test_purchase_id:purchaseId
      });
      const billing=await callAdminRpc("detektor_billing_state",{});
      const profile=await callAdminRpc("detektor_get_profile",{p_user_id:authUser.id});
      return reply({
        ok:true,
        test:true,
        account:{id:authUser.id,email:authUser.email||null,displayName:profile?.displayName||null},
        purchase,
        credits:{...(purchase?.credits||{}),billingEnforced:billing?.enforced===true}
      });
    }

    if (body?.action === "credit_status") {
      if (!billingClientInstallId) {
        return reply({ ok:true, credits:{ enabled:false, reason:"client_install_id_missing" } });
      }
      const credits = await callAdminRpc("detektor_wallet_status", {
        p_client_install_id: billingClientInstallId
      });
      const billing = await callAdminRpc("detektor_billing_state", {});
      const profile=authUser?.id ? await callAdminRpc("detektor_get_profile",{p_user_id:authUser.id}) : null;
      return reply({
        ok:true,
        account:authUser?.id ? {id:authUser.id,email:authUser.email || null,displayName:profile?.displayName || null} : null,
        credits:{ ...credits, billingEnforced: billing?.enforced === true }
      });
    }

    if (body?.action === "complete_session") {
      const archived = await completeSession(String(body.sessionId || ""));
      return reply({ ok: true, archived });
    }

    if (authUser?.id && body?.sessionId) {
      await callAdminRpc("detektor_attach_session_identity",{
        p_session_id:body.sessionId,
        p_user_id:authUser.id
      });
    }

    const audioBase64 = String(body.audioBase64 || "");
    const mimeType = String(body.mimeType || "audio/webm");
    const client = String(body.client || "unknown");
    usageSeconds = Math.max(1, Math.ceil(Number(body.audioDurationMs || 40000) / 1000));

    const billing = await callAdminRpc("detektor_billing_state", {});
    billingEnabled = billing?.enforced === true;

    if (billingEnabled) {
      if (!billingClientInstallId) throw new Error("CLIENT_INSTALL_ID_REQUIRED");
      const reservation = await callAdminRpc("detektor_reserve_live_credits", {
        p_client_install_id: billingClientInstallId,
        p_session_id: body.sessionId || null,
        p_seconds: usageSeconds,
        p_idempotency_key: String(body.sessionId || "session") + ":" + String(body.sequenceNo ?? 0),
        p_metadata: { client, sequenceNo: Number(body.sequenceNo || 0) }
      });
      billingReservationId = reservation?.reservationId || null;
      if (!billingReservationId) throw new Error("BILLING_RESERVATION_FAILED");
    }
    const contextBefore = String(body.contextBefore || "").slice(-2500);
    const pageContext = body.pageContext && typeof body.pageContext === "object" ? body.pageContext : {};
    if (!audioBase64) return reply({ error: "audioBase64 is required" }, 400);

    const speakerProfiles = Array.isArray(body.speakerProfiles) ? body.speakerProfiles.slice(0,4) : [];
    if (body.sessionId && speakerProfiles.length) {
      await syncParticipants(String(body.sessionId), speakerProfiles);
    }

    const tr = await transcribe(audioBase64, mimeType, speakerProfiles);
    const baseMetadata = {
      transcriptionUsage: tr.usage,
      processingMs: Date.now() - started,
      transcribeModel: tr.model,
      diarized: tr.diarized === true,
      knownSpeakerCount: speakerProfiles.length,
      factcheckModel: Deno.env.get("FACTCHECK_MODEL") || "gpt-5.6-terra"
    };

    if (!tr.text) {
      const archived = await archiveChunk(body, client, "", [], baseMetadata);
      let credits: any = null;
      if (billingClientInstallId) {
        await recordRawUsageSafe({
          p_client_install_id: billingClientInstallId,
          p_session_id: body.sessionId || null,
          p_seconds: usageSeconds,
          p_metadata: {
            sequenceNo: Number(body.sequenceNo || 0),
            transcribeModel: tr.model || null,
            transcriptionUsage: tr.usage || null,
            emptyTranscript: true
          }
        });
        if (billingReservationId) {
          credits = await callAdminRpc("detektor_settle_live_credits", {
            p_reservation_id: billingReservationId,
            p_real_api_cost_eur: null,
            p_metadata: {emptyTranscript:true,transcribeModel:tr.model || null,transcriptionUsage:tr.usage || null}
          });
          billingReservationId = null;
        } else {
          credits = await callAdminRpc("detektor_wallet_status", {
            p_client_install_id: billingClientInstallId
          });
        }
      }
      return reply({
        transcript:"",
        claims:[],
        processingMs:Date.now()-started,
        archived,
        credits:credits ? {...credits,billingEnforced:billingEnabled} : null
      });
    }

    const ex = await extractClaims(tr.text, contextBefore, tr.segments, pageContext);
    if (body.sessionId && Array.isArray(ex.participants) && ex.participants.length) {
      await syncParticipants(String(body.sessionId), ex.participants);
    }
    const verified = await verifyClaims(ex.claims);
    const results = verified.results;

    const metadata = {
      ...baseMetadata,
      claimExtractionUsage: ex.usage,
      detectedParticipants: ex.participants || [],
      costControl: verified.metrics,
      processingMs: Date.now() - started
    };

    const archived = await archiveChunk(body, client, tr.text, results, metadata);
    const speakerArchive = await archiveSpeakerSegments(body, tr.segments);

    let credits: any = null;
    if (billingClientInstallId) {
      await recordRawUsageSafe({
        p_client_install_id: billingClientInstallId,
        p_session_id: body.sessionId || null,
        p_seconds: usageSeconds,
        p_metadata: {
          sequenceNo: Number(body.sequenceNo || 0),
          transcribeModel: tr.model || null,
          transcriptionUsage: tr.usage || null,
          claimExtractionUsage: ex.usage || null,
          costControl: verified.metrics || null
        }
      });

      if (billingReservationId) {
        credits = await callAdminRpc("detektor_settle_live_credits", {
          p_reservation_id: billingReservationId,
          p_real_api_cost_eur: null,
          p_metadata: {
            transcribeModel: tr.model || null,
            transcriptionUsage: tr.usage || null,
            claimExtractionUsage: ex.usage || null,
            costControl: verified.metrics || null
          }
        });
        billingReservationId = null;
      } else {
        credits = await callAdminRpc("detektor_wallet_status", {
          p_client_install_id: billingClientInstallId
        });
      }
    }

    return reply({
      transcript: tr.text,
      speakerSegments: tr.segments,
      diarized: tr.diarized === true,
      participants: ex.participants || [],
      claims: results,
      costControl: verified.metrics,
      processingMs: Date.now() - started,
      archived,
      speakerArchive,
      credits: credits ? { ...credits, billingEnforced: billingEnabled } : null,
      audit: {
        client,
        at: new Date().toISOString(),
        sourceMode: "tab-audio",
        sourcesVisibleToViewer: true
      }
    });
  } catch (e) {
    if (billingReservationId) {
      try {
        await callAdminRpc("detektor_release_live_credits", {
          p_reservation_id: billingReservationId,
          p_reason: e instanceof Error ? e.message : String(e)
        });
      } catch (_) {}
      billingReservationId = null;
    }

    const message = e instanceof Error ? e.message : String(e);
    console.error("FACTCTP_PIPELINE_ERROR", message);

    if (/DETEKTOR_CREDIT_EXHAUSTED|CLIENT_INSTALL_ID_REQUIRED|credit_balance_exhausted|insufficient_quota|no credits remaining/i.test(message)) {
      return reply({
        error: "Detektory sú vyčerpané.",
        userMessage: "Nemáš dostatok detektorov. Kúp detektory a spusti overovanie znova.",
        errorCode: "credit_balance_exhausted",
        fatal: true,
        stage: "billing"
      }, 402);
    }

    return reply({
      error: message,
      userMessage: "Spracovanie audia zlyhalo. Skús overovanie spustiť znova.",
      errorCode: "pipeline_error",
      fatal: false,
      stage: "pipeline"
    }, 500);
  }
});