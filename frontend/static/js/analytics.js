/* ═══════════════════════════════════════════════
   InterviewAI — Analytics JS  (stored-data first)
   ═══════════════════════════════════════════════ */

const FILLER_GROUPS = {
  'uh / uhh':  /\b(u+h+)\b/gi,
  'um / umm':  /\b(u+m+)\b/gi,
  'ah / ahh':  /\b(a+h+)\b/gi,
  'like':      /\blike\b/gi,
  'you know':  /\byou know\b/gi,
  'basically': /\bbasically\b/gi,
  'literally': /\bliterally\b/gi,
  'i mean':    /\bi mean\b/gi,
  'kind of':   /\bkind of\b/gi,
  'actually':  /\bactually\b/gi,
  'right':     /\bright\b/gi,
  'so':        /\bso\b/gi,
  'well':      /\bwell\b/gi,
  'i think':   /\bi think\b/gi,
};

let allSessions = [], filterCount = 3, activeTab = 'overview', coachData = null;
let rawData = {};

/* ── Text analysis (used when answer text exists) ── */
function analyzeText(text) {
  if (!text || !text.trim()) return null;
  const words = text.toLowerCase().trim().split(/\s+/);
  const total = words.length;
  const fillerCounts = {};
  let totalFillers = 0;
  Object.entries(FILLER_GROUPS).forEach(([label, regex]) => {
    const m = text.match(new RegExp(regex.source, 'gi'));
    if (m && m.length > 0) { fillerCounts[label] = m.length; totalFillers += m.length; }
  });
  const unique = new Set(words.filter(w => w.length > 3));
  const diversity = total > 0 ? Math.round((unique.size / total) * 100) : 0;
  const fillerDensity = total > 0 ? parseFloat(((totalFillers / total) * 100).toFixed(1)) : 0;
  const stutters = {};
  let stutterTotal = 0;
  for (let i = 1; i < words.length; i++) {
    const w = words[i].replace(/[^a-z]/g,'');
    const p = words[i-1].replace(/[^a-z]/g,'');
    if (w && w === p && w.length > 2) { stutters[w] = (stutters[w]||0)+1; stutterTotal++; }
  }
  let highlighted = text;
  Object.values(FILLER_GROUPS).forEach(regex => {
    highlighted = highlighted.replace(new RegExp(regex.source,'gi'),
      m => `<span style="background:rgba(255,167,38,0.25);color:#ffa726;border-radius:3px;padding:0 2px;font-weight:700">${m}</span>`);
  });
  highlighted = highlighted.replace(/\b(\w+)(\s+\1)+\b/gi,
    m => `<span style="background:rgba(255,77,109,0.2);color:#ff4d6d;border-radius:3px;padding:0 2px">${m}</span>`);
  return { total, fillerCounts, totalFillers, fillerDensity, diversity, stutters, stutterTotal, highlighted };
}

function speechScore(a) {
  if (!a || a.total === 0) return 0;
  let s = 100;
  s -= Math.min(35, a.fillerDensity * 4);
  s -= Math.min(15, a.stutterTotal * 2);
  s -= a.diversity < 30 ? 12 : a.diversity < 45 ? 6 : 0;
  s -= a.total < 15 ? 15 : a.total < 35 ? 7 : 0;
  return Math.max(0, Math.round(s));
}

function scoreColor(s) { return s >= 75 ? '#00e676' : s >= 50 ? '#ffa726' : '#ff4d6d'; }
function fillerColor(w) {
  const c = {'uh / uhh':'#ffa726','um / umm':'#ff8c00','like':'#7b61ff','you know':'#00e5ff'};
  return c[w] || '#ffa726';
}

/* ══════════════════════════════
   LOAD
   ══════════════════════════════ */
async function loadAnalytics() {
  try {
    const res  = await fetch('/analytics/data', { credentials: 'include' });
    if (!res.ok) { window.location.href = '/'; return; }
    const data = await res.json();
    rawData = data;

    rawData.role_breakdown = data.role_breakdown || {};

    allSessions = (data.recent || []).map(s => ({
      ...s,
      interview_type: s.interview_type || '',
      role: s.role || '',
      answers: (s.answers || []).map(a => ({
        question:      a.question      || '',
        answer:        a.answer        || '',
        score:         a.score         ?? null,
        feedback:      a.feedback      || '',
        skipped:       a.skipped       || false,
        filler_count:  a.filler_count  || 0,
        stutter_count: a.stutter_count || 0,
      })),
    }));

    console.log('[Analytics] sessions loaded:', allSessions.length);
    allSessions.forEach((s,i) => {
      const nonEmpty = s.answers.filter(a=>a.answer && a.answer.trim()).length;
      console.log(`  [${i}] ${s.interview_type} score=${s.score} answers=${s.answers.length} non-empty=${nonEmpty} fillers=${s.total_filler_words||0}`);
    });

    render();
  } catch(e) {
    console.error('[Analytics] load error:', e);
    document.getElementById('main-content').innerHTML =
      `<div style="text-align:center;padding:60px;color:#ff4d6d">Failed to load: ${e.message}<br><a href="/dashboard" style="color:#00e5ff">← Dashboard</a></div>`;
  }
}

function setFilter(n, btn) {
  filterCount = n;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  coachData = null;
  render();
}

function showTab(tab, btn) {
  activeTab = tab;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  render();
}

/* ══════════════════════════════
   RENDER
   ══════════════════════════════ */
const typeLabel = {technical:'Technical',system_design:'System Design',behavioral:'Behavioral',product_sense:'Product Sense'};
const roleLabel2 = {
  financial_analyst:'Financial Analyst', accountant:'Accountant',
  hr_manager:'HR Manager', ux_designer:'UX/UI Designer',
  business_analyst:'Business Analyst', project_manager:'Project Manager',
  management_consultant:'Management Consultant', digital_marketing:'Digital Marketing',
  content_writer:'Content Writer', data_engineer:'Data Engineer',
  ml_engineer:'ML Engineer', devops_engineer:'DevOps Engineer',
  product_manager:'Product Manager',
};

function render() {
  const withAnswers = allSessions.filter(s => s.answers && s.answers.length > 0);
  const filtered = filterCount === 0 ? withAnswers : withAnswers.slice(0, filterCount);

  if (allSessions.length === 0) {
    document.getElementById('main-content').innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🎙️</div>
        <div class="empty-state-title">No sessions yet</div>
        <div class="empty-state-sub">Complete a Practice or Voice Interview to see your analytics.</div>
        <a href="/practice" style="display:inline-block;margin-top:24px;padding:12px 28px;background:linear-gradient(135deg,#00e5ff,#7b61ff);color:#060a0f;border-radius:10px;font-family:'Space Grotesk',sans-serif;font-weight:700;text-decoration:none;">▶ Start Practice →</a>
      </div>`;
    return;
  }

  /* ── Build aggregated stats from STORED data (no text re-analysis needed) ── */
  const sessionsToUse = filtered.length > 0 ? filtered : allSessions.slice(0, filterCount || 3);

  // Scores from DB
  const scores = sessionsToUse.map(s => s.score || 0);
  const avgScore = scores.length ? Math.round(scores.reduce((a,b)=>a+b,0)/scores.length) : 0;

  // Filler & stutter counts from DB stored totals
  const totalStoredFillers  = sessionsToUse.reduce((s,x) => s + (x.total_filler_words||0), 0);
  const totalStoredStutters = sessionsToUse.reduce((s,x) => s + (x.total_stutters||0), 0);

  // Answer-level stats — use stored score, fall back to text analysis
  const allAnswers = sessionsToUse.flatMap(s => s.answers.filter(a => !a.skipped));
  const avgAiScore = allAnswers.length
    ? Math.round(allAnswers.reduce((s,a) => s+(a.score||0),0) / allAnswers.length) : 0;

  // Text-based metrics (for answers that have text)
  const analyses = [];
  const globalFillers = {};
  sessionsToUse.forEach(s => {
    s.answers.forEach(a => {
      if (a.skipped || !a.answer || !a.answer.trim()) return;
      const an = analyzeText(a.answer);
      if (an) {
        analyses.push(an);
        Object.entries(an.fillerCounts).forEach(([w,c]) => { globalFillers[w]=(globalFillers[w]||0)+c; });
      }
    });
  });

  const totalWords   = analyses.reduce((s,a)=>s+a.total,0);
  const totalFillers = analyses.reduce((s,a)=>s+a.totalFillers,0);
  const avgDiv       = analyses.length ? Math.round(analyses.reduce((s,a)=>s+a.diversity,0)/analyses.length) : 0;
  const avgLen       = analyses.length ? Math.round(totalWords/analyses.length) : 0;
  const fillerDensity= totalWords>0 ? parseFloat(((totalFillers/totalWords)*100).toFixed(1)) : 0;

  // Use stored fillerDensity if no text available
  const totalAnswerWords = totalWords || sessionsToUse.reduce((s,x)=>{
    return s+(x.answers||[]).reduce((ss,a)=>{
      return ss+(a.answer?a.answer.trim().split(/\s+/).filter(Boolean).length:0);
    },0);
  },0);
  const effectiveFillerDensity = totalAnswerWords > 0
    ? fillerDensity
    : (totalStoredFillers > 0 ? parseFloat((totalStoredFillers/10).toFixed(1)) : 0);

  // Speech score = use avg AI score since we have it stored
  const displayScore = avgAiScore || avgScore;

  const sortedFillers = Object.entries(globalFillers).sort((a,b)=>b[1]-a[1]).slice(0,10);
  const maxFiller     = sortedFillers[0]?.[1] || 1;

  // Session trend
  const sessionTrend = sessionsToUse.map(s => ({
    date: s.date, score: s.score||0, speechScore: (() => {
      const ans = s.answers.filter(a=>!a.skipped&&a.answer&&a.answer.trim());
      if (!ans.length) return s.score||0;
      const analysed = ans.map(a=>analyzeText(a.answer)).filter(Boolean);
      return analysed.length ? Math.round(analysed.reduce((t,a)=>t+speechScore(a),0)/analysed.length) : s.score||0;
    })()
  }));

  if      (activeTab === 'overview')   renderOverview(displayScore, effectiveFillerDensity, avgLen, avgDiv, sortedFillers, maxFiller, sessionTrend, analyses, totalStoredFillers, totalStoredStutters);
  else if (activeTab === 'coach')      renderCoach();
  else                                 renderBreakdown(sessionsToUse);
}

/* ── OVERVIEW ── */
function renderOverview(avgScore, fillerDensity, avgLen, avgDiv, sortedFillers, maxFiller, sessions, analyses, storedFillers, storedStutters) {
  const sC  = avgScore>=75?'#00e676':avgScore>=50?'#ffa726':'#ff4d6d';
  const fC  = storedFillers===0?'#00e676':storedFillers<=10?'#ffa726':'#ff4d6d';
  const stC = storedStutters===0?'#00e676':storedStutters<=5?'#ffa726':'#ff4d6d';
  const wC  = avgLen>=80?'#00e676':avgLen>=40?'#ffa726':'#ff4d6d';

  const voiceSessions = allSessions.filter(s=>s.mode==='voice'||(s.interview_type||'').startsWith('voice_'));
  const hasVoice = voiceSessions.length > 0;

  const prevSessions = allSessions.slice(filterCount||3);
  const prevAvg      = prevSessions.length ? Math.round(prevSessions.reduce((s,x)=>s+(x.score||0),0)/prevSessions.length) : null;
  const diff         = prevAvg !== null ? avgScore - prevAvg : null;
  const diffStr      = diff === null ? (avgScore>=75?'✓ Strong':avgScore>=50?'⚡ Improving':'⚠ Needs work')
                       : (diff>0?'↑ +'+diff+'% vs before':diff<0?'↓ '+diff+'% vs before':'— Same as before');
  const diffC        = diff === null ? sC : diff>0?'#00e676':diff<0?'#ff4d6d':'#6b7280';

  const allAns      = allSessions.flatMap(s=>s.answers||[]);
  const shortAns    = allAns.filter(a=>!a.skipped&&a.answer&&a.answer.trim().split(/\s+/).filter(Boolean).length<40).length;
  const skippedCnt  = allAns.filter(a=>a.skipped).length;
  const lowScoreCnt = allAns.filter(a=>!a.skipped&&(a.score||0)<60).length;

  const breakdown      = rawData.breakdown || {};
  const roleBreakdown  = rawData.role_breakdown || {};
  const typeLabel      = {technical:'Technical',system_design:'System Design',behavioral:'Behavioral',product_sense:'Product Sense'};
  const roleLabel      = {
    financial_analyst:'Financial Analyst', accountant:'Accountant',
    hr_manager:'HR Manager', ux_designer:'UX/UI Designer',
    business_analyst:'Business Analyst', project_manager:'Project Manager',
    management_consultant:'Management Consultant', digital_marketing:'Digital Marketing',
    content_writer:'Content Writer', data_engineer:'Data Engineer',
    ml_engineer:'ML Engineer', devops_engineer:'DevOps Engineer',
    product_manager:'Product Manager',
  };
  // For sessions with no role, map interview_type → friendly label
  const typeDisplayLabel = {
    technical:'Technical (General)', system_design:'System Design',
    behavioral:'Behavioral (General)', product_sense:'Product Sense',
  };
  // For AI Coach session list: map interview_type → readable label for old sessions
  const typeToRoleLabel = {
    technical:'Technical Interview',
    system_design:'System Design Interview',
    behavioral:'Behavioral Interview',
    product_sense:'Product Sense Interview',
  };

  let html = `
  <!-- 4 STAT CARDS: Avg Score · Filler Words · Repeated Words · Avg Words -->
  <div class="stat-row">
    <div class="a-stat c1">
      <div class="a-stat-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00e5ff" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>
      <div class="a-stat-val" style="color:${sC}">${avgScore}%</div>
      <div class="a-stat-lbl">Avg Score</div>
      <div class="a-stat-sub" style="color:${diffC}">${diffStr}</div>
    </div>
    <div class="a-stat c2">
      <div class="a-stat-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7b61ff" stroke-width="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div>
      <div class="a-stat-val" style="color:${fC}">${storedFillers}</div>
      <div class="a-stat-lbl">Filler Words</div>
      <div class="a-stat-sub" style="color:${fC}">${storedFillers===0?'✓ Clean':storedFillers<=10?'⚡ Moderate':'⚠ Too many'}</div>
    </div>
    <div class="a-stat c3">
      <div class="a-stat-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffa726" stroke-width="2.5"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg></div>
      <div class="a-stat-val" style="color:${stC}">${storedStutters}</div>
      <div class="a-stat-lbl">Repeated Words</div>
      <div class="a-stat-sub" style="color:${stC}">${storedStutters===0?'✓ Fluent':storedStutters<=5?'⚡ Some stutters':'⚠ Work on flow'}</div>
    </div>
    <div class="a-stat c4">
      <div class="a-stat-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00e676" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></div>
      <div class="a-stat-val" style="color:${wC}">${avgLen||'—'}</div>
      <div class="a-stat-lbl">Avg Words / Answer</div>
      <div class="a-stat-sub" style="color:${wC}">${avgLen>=80?'✓ Detailed':avgLen>=40?'⚡ Adequate':avgLen>0?'⚠ Too brief':'—'}</div>
    </div>
  </div>

  <!-- ROW 2: Mistakes+Fillers  |  Trend+Category -->
  <div class="ag">
    <div class="ac">
      <div class="ac-title">⚠ Common Mistakes</div>
      <div class="ac-sub">What's holding your score back</div>
      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:20px">`;

  const mkSev  = v => v===0?'low':v<=3?'mid':'high';
  const mkBg   = s => s==='high'?'rgba(255,77,109,0.08)':s==='mid'?'rgba(255,167,38,0.08)':'rgba(0,230,118,0.06)';
  const mkBord = s => s==='high'?'rgba(255,77,109,0.2)':s==='mid'?'rgba(255,167,38,0.18)':'rgba(0,230,118,0.18)';
  const mkTxt  = s => s==='high'?'#ff4d6d':s==='mid'?'#ffa726':'#00e676';
  const mkLbl  = s => s==='high'?'High':s==='mid'?'Medium':'Good';

  [
    { label:'Short answers',      desc: shortAns+' answers under 40 words',    sev: mkSev(shortAns)    },
    { label:'Low-score answers',  desc: lowScoreCnt+' answers below 60%',      sev: mkSev(lowScoreCnt) },
    { label:'Skipped questions',  desc: skippedCnt+' questions skipped',        sev: mkSev(skippedCnt)  },
  ].forEach(m => {
    html += `<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 14px;border-radius:10px;background:${mkBg(m.sev)};border:1px solid ${mkBord(m.sev)}">
      <div>
        <div style="font-size:12px;font-weight:600;color:#fff;margin-bottom:2px">${m.label}</div>
        <div style="font-size:11px;color:#9ca3af">${m.desc}</div>
      </div>
      <span style="font-size:10px;font-weight:700;padding:3px 9px;border-radius:99px;border:1px solid ${mkBord(m.sev)};color:${mkTxt(m.sev)};white-space:nowrap">${mkLbl(m.sev)}</span>
    </div>`;
  });

  html += `</div>
      <div style="font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:10px">Filler words${!hasVoice?' <span style="font-weight:400;text-transform:none;letter-spacing:0;color:#4b5563">— do a voice session to track</span>':''}</div>
      <div class="filler-bars">`;

  if (!hasVoice) {
    html += `<div style="font-size:12px;color:#6b7280;line-height:1.6">Complete a voice interview to see filler words like <em>like</em>, <em>um</em>, <em>you know</em> tracked here.</div>`;
  } else if (sortedFillers.length===0 && storedFillers===0) {
    html += `<div style="font-size:12px;color:#00e676">✓ No filler words detected!</div>`;
  } else {
    sortedFillers.slice(0,6).forEach(([w,c])=>{
      html += `<div class="filler-row">
        <div class="filler-word">${w}</div>
        <div class="filler-bar-wrap"><div class="filler-bar-fill" style="width:0%;background:${fillerColor(w)}" data-pct="${Math.round((c/maxFiller)*100)}"></div></div>
        <div class="filler-count">${c}×</div>
      </div>`;
    });
  }

  html += `</div></div>

    <!-- RIGHT col -->
    <div style="display:flex;flex-direction:column;gap:16px">
      <div class="ac">
        <div class="ac-title">🕸 Skills Radar</div>
        <div class="ac-sub">Your 5 key performance dimensions</div>
        <div class="radar-wrap"><canvas id="radar-chart" width="220" height="190"></canvas></div>
      </div>
      <div class="ac">
        <div class="ac-title">📊 Score by Category</div>
        <div class="ac-sub">Which type needs most work</div>
        <div style="display:flex;flex-direction:column;gap:10px;margin-top:4px">`;

  // Build category list:
  // - If session had a role → show role name only
  // - If session had no role → show type (Technical, System Design etc)
  // No mixing — never show both for same session

  const categoryItems = [];

  // Role-based sessions
  Object.entries(roleBreakdown).forEach(([r, d]) => {
    categoryItems.push({
      label: roleLabel[r] || r.replace(/_/g,' '),
      score: d.avg_score,
      count: d.count,
    });
  });

  // Type-based sessions (only those without a role)
  const mergedTypes = {};
  Object.entries(breakdown).forEach(([t, d]) => {
    const key = t.replace('voice_','');
    if (!mergedTypes[key]) mergedTypes[key] = {scores:[], count:0};
    if (d.avg_score) mergedTypes[key].scores.push(d.avg_score);
    mergedTypes[key].count += d.count;
  });

  // Subtract role-session counts to avoid double-counting
  Object.values(roleBreakdown).forEach(d => {
    const t = d.interview_type;
    if (mergedTypes[t]) mergedTypes[t].count = Math.max(0, mergedTypes[t].count - d.count);
  });

  Object.entries(mergedTypes).forEach(([t, d]) => {
    if (d.count > 0) {
      const sc = d.scores.length ? Math.round(d.scores.reduce((a,b)=>a+b,0)/d.scores.length) : 0;
      categoryItems.push({ label: typeDisplayLabel[t] || typeLabel[t] || t.replace(/_/g,' '), score: sc, count: d.count });
    }
  });

  categoryItems.sort((a,b) => b.count - a.count);

  if (!categoryItems.length) {
    html += `<div style="color:#6b7280;font-size:12px;text-align:center;padding:12px">Complete more interviews to see breakdown</div>`;
  } else {
    categoryItems.forEach(item => {
      const scC = item.score>=75?'#00e676':item.score>=50?'#ffa726':'#ff4d6d';
      html += `<div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px">
          <span style="font-size:12px;color:#d1d5db">${item.label}</span>
          <span style="font-size:12px;font-weight:700;color:${scC}">${item.score}% <span style="font-weight:400;font-size:10px;color:#6b7280">${item.count}×</span></span>
        </div>
        <div style="height:5px;background:rgba(255,255,255,0.06);border-radius:99px;overflow:hidden">
          <div style="height:100%;border-radius:99px;background:${scC};width:0%;transition:width 0.8s ease" data-w="${item.score}"></div>
        </div>
      </div>`;
    });
  }

  html += `
        </div>
      </div>
    </div>
  </div>

  <!-- AI COACH CTA -->
  <div class="ac" style="text-align:center;padding:28px;margin-bottom:20px">
    <div style="font-size:36px;margin-bottom:12px">🤖</div>
    <div style="font-family:'Space Grotesk',sans-serif;font-size:16px;font-weight:700;margin-bottom:8px">Get Your AI Coaching Report</div>
    <div style="font-size:12px;color:var(--muted);line-height:1.7;margin-bottom:20px">Pick any session and get personalized feedback — what you missed, a rewritten answer, and the ideal response.</div>
    <button class="ai-coach-btn" style="font-size:14px;padding:12px 28px;border-radius:12px" onclick="runAICoach()">🤖 Open AI Coach →</button>
  </div>`;

  document.getElementById('main-content').innerHTML = html;

  requestAnimationFrame(() => {
    document.querySelectorAll('.filler-bar-fill').forEach(el => {
      setTimeout(()=>{ el.style.width = el.dataset.pct+'%'; }, 80);
    });
    document.querySelectorAll('[data-w]').forEach(el => {
      setTimeout(()=>{ el.style.width = el.dataset.w+'%'; }, 80);
    });
    drawRadar(avgScore, analyses);
  });
}


/* ── BREAKDOWN TAB ── */
function runAICoach() {
  // Switch to AI Coach tab and auto-load the most recent session
  activeTab = 'coach';
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => {
    if (b.textContent.includes('AI Coach')) b.classList.add('active');
  });
  renderCoach();
  // Auto-trigger the latest session after render
  setTimeout(() => {
    const firstSession = document.querySelector('[onclick*="loadSessionCoaching"]');
    if (firstSession) firstSession.click();
  }, 150);
}

function renderBreakdown(sessions) {
  if (!sessions.length) {
    document.getElementById('main-content').innerHTML = `<div class="empty-state"><div class="empty-state-icon">🔍</div><div class="empty-state-title">No answers to show</div></div>`;
    return;
  }

  const latest = sessions[0];
  let html = `
    <div class="ac-title" style="margin-bottom:4px">📋 Question & Answer Breakdown</div>
    <div class="ac-sub" style="margin-bottom:16px">Click any question to expand · <span style="color:#ffa726">■ fillers</span> in orange · <span style="color:#ff4d6d">■ stutters</span> in red</div>
    <div style="display:flex;flex-direction:column;gap:10px">`;

  latest.answers.forEach((ans, i) => {
    const skipped = ans.skipped || !ans.answer;
    const sc      = ans.score;
    const scC     = sc!=null ? scoreColor(sc) : '#6b7280';
    const a       = (!skipped && ans.answer) ? analyzeText(ans.answer) : null;
    const highlighted = a ? a.highlighted : (ans.answer || '');

    html += `
      <div style="background:rgba(255,255,255,0.02);border:1px solid #1f2937;border-radius:14px;overflow:hidden">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:14px 16px;cursor:pointer"
             onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none'">
          <div style="display:flex;gap:10px;align-items:flex-start">
            <div style="width:22px;height:22px;border-radius:6px;background:rgba(0,229,255,0.08);border:1px solid rgba(0,229,255,0.15);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:10px;color:#00e5ff;font-weight:700">${i+1}</div>
            <div style="font-size:13px;color:#fff;line-height:1.5">${ans.question||`Question ${i+1}`}</div>
          </div>
          <div style="display:flex;gap:8px;align-items:center;flex-shrink:0">
            ${skipped ? `<span style="font-size:10px;padding:2px 8px;border-radius:99px;background:rgba(107,114,128,0.1);color:#6b7280">Skipped</span>` : sc!=null ? `<span style="font-size:13px;font-weight:800;color:${scC}">${sc}%</span>` : ''}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
        </div>
        <div style="display:none;border-top:1px solid #1f2937;padding:14px 16px">
          ${skipped ? `<div style="color:#6b7280;font-size:12px;font-style:italic">This question was skipped.</div>` : `
            <div style="font-size:10px;color:#4b5563;text-transform:uppercase;letter-spacing:1.5px;font-weight:700;margin-bottom:6px">Your Answer</div>
            <div style="font-size:12px;line-height:1.7;color:#d1d5db;background:rgba(255,255,255,0.02);border:1px solid #1f2937;border-radius:8px;padding:10px;font-family:'DM Mono',monospace">${highlighted || '<span style="color:#6b7280;font-style:italic">No answer text recorded</span>'}</div>
            ${ans.feedback ? `
            <div style="font-size:10px;color:#4b5563;text-transform:uppercase;letter-spacing:1.5px;font-weight:700;margin:10px 0 6px">AI Feedback</div>
            <div style="font-size:12px;line-height:1.7;color:#9ca3af;background:${sc>=75?'rgba(0,230,118,0.04)':sc>=50?'rgba(255,167,38,0.04)':'rgba(255,77,109,0.04)'};border:1px solid ${scC}22;border-radius:8px;padding:10px">${ans.feedback}</div>` : ''}
          `}
        </div>
      </div>`;
  });

  html += '</div>';
  document.getElementById('main-content').innerHTML = html;
}

/* ── AI COACH TAB ── */
function renderCoach() {
  const sessions = filterCount===0 ? allSessions : allSessions.slice(0, filterCount);
  if (!sessions.length) {
    document.getElementById('main-content').innerHTML = `<div class="empty-state"><div class="empty-state-icon">🤖</div><div class="empty-state-title">No sessions yet</div></div>`;
    return;
  }

  // Show session list to pick from, or auto-pick latest
  const latest = sessions[0];
  document.getElementById('main-content').innerHTML = `
    <div class="ac" style="margin-bottom:16px">
      <div class="ac-title" style="margin-bottom:8px">🤖 AI Coach — Per-Session Deep Dive</div>
      <div class="ac-sub" style="margin-bottom:16px">Select a session to get personalized coaching: what you missed, how to say it better, and ideal answers.</div>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${sessions.slice(0,8).map((s,i) => {
          const d = s.date ? s.date.slice(0,10) : '';
          const rawType = (s.interview_type||'').replace('voice_','');
          const typeName = typeLabel[rawType] || rawType.replace(/_/g,' ');
          const roleName = s.role ? (roleLabel2[s.role] || roleLabel[s.role] || s.role.replace(/_/g,' ')) : null;
          // Primary label: role name if exists, else type name
          const displayLabel = roleName || typeName;
          // Sub info: if role exists show type as sub, else nothing extra
          const subLabel = roleName ? typeName : '';
          const sc = s.score||0;
          const scC = sc>=75?'#00e676':sc>=50?'#ffa726':'#ff4d6d';
          return `<div onclick="loadSessionCoaching('${s.session_id}','${rawType}','${s.mode||'text'}')"
            style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-radius:12px;border:1px solid #1f2937;background:rgba(255,255,255,0.01);cursor:pointer;transition:all 0.15s"
            onmouseover="this.style.borderColor='rgba(0,229,255,0.2)';this.style.background='rgba(0,229,255,0.03)'"
            onmouseout="this.style.borderColor='#1f2937';this.style.background='rgba(255,255,255,0.01)'">
            <div style="display:flex;align-items:center;gap:10px">
              <span style="font-size:16px">${s.mode==='voice'?'🎙':'💬'}</span>
              <div>
                <div style="font-size:13px;color:#fff;font-weight:600;text-transform:capitalize">${displayLabel}</div>
                <div style="font-size:11px;color:#6b7280">${d}${subLabel?' · '+subLabel:''}${s.mode==='voice'?' · Voice':' · Text'}</div>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:10px">
              <span style="font-size:14px;font-weight:800;color:${scC};font-family:'Space Grotesk',sans-serif">${sc}%</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>
    <div id="coach-result"></div>`;
}

async function loadSessionCoaching(sessionId, interviewType, mode) {
  const el = document.getElementById('coach-result');
  if (!el) return;

  el.innerHTML = `
    <div class="ac" style="text-align:center;padding:32px">
      <div style="font-size:32px;margin-bottom:12px">🤖</div>
      <div style="font-family:'Space Grotesk',sans-serif;font-size:15px;font-weight:700;margin-bottom:8px">Analyzing your interview...</div>
      <div style="font-size:12px;color:var(--muted)">Reading answers · Finding gaps · Writing rewrites</div>
      <div style="margin-top:16px;display:flex;flex-direction:column;gap:6px;max-width:360px;margin-left:auto;margin-right:auto">
        ${[1,2,3].map(i=>`<div style="height:12px;border-radius:6px;background:linear-gradient(90deg,#1f2937 0%,#2d3748 50%,#1f2937 100%);background-size:200%;animation:shimmer 1.5s infinite ${i*0.2}s;width:${60+i*12}%"></div>`).join('')}
      </div>
      <style>@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}</style>
    </div>`;

  try {
    const res = await fetch('/coaching/session', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, interview_type: interviewType.replace('voice_',''), mode })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || data.detail || `Server error ${res.status}`);
    renderSessionCoaching(data, el);
  } catch(e) {
    el.innerHTML = `<div class="ac" style="text-align:center;padding:24px;color:var(--accent3)">Failed to load coaching: ${e.message}<br><button onclick="loadSessionCoaching('${sessionId}','${interviewType}','${mode}')" style="margin-top:12px;padding:8px 18px;border-radius:8px;background:rgba(0,229,255,0.1);border:1px solid rgba(0,229,255,0.2);color:#00e5ff;font-size:12px;cursor:pointer">↻ Retry</button></div>`;
  }
}

function renderSessionCoaching(data, container) {
  const scoreC = data.avg_score>=75?'#00e676':data.avg_score>=50?'#ffa726':'#ff4d6d';
  const answered = data.answers.filter(a=>!a.skipped);

  let html = `
    <div class="ac" style="margin-bottom:16px">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
        <div style="width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,rgba(0,229,255,0.15),rgba(123,97,255,0.15));border:1px solid rgba(0,229,255,0.2);display:flex;align-items:center;justify-content:center;font-size:18px">🤖</div>
        <div>
          <div class="ac-title" style="margin-bottom:2px">Overall Coaching Report</div>
          <div style="font-size:11px;color:var(--muted)">${data.interview_type.replace(/_/g,' ')} · ${data.is_voice?'Voice':'Text'} · Avg <span style="color:${scoreC};font-weight:700">${data.avg_score}%</span></div>
        </div>
      </div>
      <div style="font-size:13px;line-height:1.8;color:#d1d5db;background:rgba(255,255,255,0.02);border:1px solid #1f2937;border-radius:10px;padding:14px">
        ${(data.overall_summary||'').replace(/\n/g,'<br>')}
      </div>
    </div>

    <div style="font-family:'Space Grotesk',sans-serif;font-size:13px;font-weight:700;color:#fff;margin-bottom:12px">📋 Question-by-Question Coaching</div>
    <div style="display:flex;flex-direction:column;gap:10px">`;

  answered.forEach((a, i) => {
    const sc   = a.score||0;
    const scC  = sc>=75?'#00e676':sc>=50?'#ffa726':'#ff4d6d';
    const idx  = data.answers.indexOf(a)+1;

    html += `
      <div style="border:1px solid #1f2937;border-radius:14px;overflow:hidden;background:rgba(255,255,255,0.01)">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:14px 16px;cursor:pointer"
             onclick="const b=this.nextElementSibling;const arr=this.querySelector('.arr');const open=b.style.display==='flex';b.style.display=open?'none':'flex';arr.style.transform=open?'rotate(0)':'rotate(180deg)'">
          <div style="display:flex;gap:10px;align-items:flex-start">
            <div style="width:22px;height:22px;border-radius:6px;background:rgba(0,229,255,0.08);border:1px solid rgba(0,229,255,0.15);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:10px;color:#00e5ff;font-weight:700">${idx}</div>
            <div style="font-size:13px;color:#e5e7eb;line-height:1.5">${a.question}</div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
            <span style="font-size:14px;font-weight:800;color:${scC};font-family:'Space Grotesk',sans-serif">${sc}%</span>
            <svg class="arr" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2" style="transition:transform 0.2s"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
        </div>
        <div class="coach-detail" style="border-top:1px solid #1f2937;padding:14px 16px;display:none;flex-direction:column;gap:12px">
          ${a.content_gaps?`<div style="background:rgba(255,77,109,0.04);border:1px solid rgba(255,77,109,0.12);border-radius:10px;padding:12px"><div style="font-size:10px;color:#ff4d6d;text-transform:uppercase;letter-spacing:1.5px;font-weight:700;margin-bottom:6px">⚠ What Was Missing</div><div style="font-size:12px;line-height:1.7;color:#fca5a5">${a.content_gaps}</div></div>`:''}
          ${a.rewrite?`<div style="background:rgba(123,97,255,0.04);border:1px solid rgba(123,97,255,0.15);border-radius:10px;padding:12px"><div style="font-size:10px;color:#7b61ff;text-transform:uppercase;letter-spacing:1.5px;font-weight:700;margin-bottom:6px">✏ Improved Version</div><div style="font-size:12px;line-height:1.8;color:#c4b5fd;font-style:italic">"${a.rewrite}"</div></div>`:''}
          ${a.ideal_answer?`<div style="background:rgba(0,230,118,0.04);border:1px solid rgba(0,230,118,0.15);border-radius:10px;padding:12px"><div style="font-size:10px;color:#00e676;text-transform:uppercase;letter-spacing:1.5px;font-weight:700;margin-bottom:6px">⭐ Ideal Answer</div><div style="font-size:12px;line-height:1.8;color:#86efac">${a.ideal_answer}</div></div>`:''}
          ${a.speaking_tip?`<div style="background:rgba(255,167,38,0.04);border:1px solid rgba(255,167,38,0.15);border-radius:10px;padding:12px"><div style="font-size:10px;color:#ffa726;text-transform:uppercase;letter-spacing:1.5px;font-weight:700;margin-bottom:6px">🎙 Speaking Tip</div><div style="font-size:12px;line-height:1.7;color:#fcd34d">${a.speaking_tip}</div></div>`:''}
        </div>
      </div>`;
  });

  html += `</div>`;
  container.innerHTML = html;

  // Auto-expand first weak answer
  setTimeout(() => {
    const rows = container.querySelectorAll('[onclick*="nextElementSibling"]');
    if (rows.length > 0) rows[0].click();
  }, 300);
}


/* ── Charts ── */
function drawLine(scores, color) {
  const canvas = document.getElementById('progress-chart');
  if (!canvas || !scores.length) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.offsetWidth || 380, H = canvas.offsetHeight || 160;
  canvas.width = W; canvas.height = H;
  ctx.clearRect(0,0,W,H);
  const pad = {top:16,right:16,bottom:32,left:36};
  const iW = W-pad.left-pad.right, iH = H-pad.top-pad.bottom;
  const max = Math.max(...scores,100), min = 0;
  const xStep = scores.length>1 ? iW/(scores.length-1) : iW;

  // Grid
  [0,25,50,75,100].forEach(v => {
    const y = pad.top + iH - ((v-min)/(max-min))*iH;
    ctx.strokeStyle='rgba(255,255,255,0.05)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(pad.left,y); ctx.lineTo(pad.left+iW,y); ctx.stroke();
    ctx.fillStyle='#4b5563'; ctx.font='10px DM Mono,monospace';
    ctx.fillText(v+'%', 2, y+4);
  });

  // Line
  const grad = ctx.createLinearGradient(pad.left,0,pad.left+iW,0);
  grad.addColorStop(0,'#00e5ff'); grad.addColorStop(1,'#7b61ff');
  ctx.strokeStyle=grad; ctx.lineWidth=2.5; ctx.lineJoin='round'; ctx.lineCap='round';
  ctx.beginPath();
  scores.forEach((s,i) => {
    const x = pad.left + i*xStep;
    const y = pad.top + iH - ((s-min)/(max-min))*iH;
    i===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
  });
  ctx.stroke();

  // Dots
  scores.forEach((s,i) => {
    const x = pad.left + i*xStep;
    const y = pad.top + iH - ((s-min)/(max-min))*iH;
    ctx.beginPath(); ctx.arc(x,y,4,0,Math.PI*2);
    ctx.fillStyle='#00e5ff'; ctx.fill();
  });
}

function drawRadar(avgScore, analyses) {
  const canvas = document.getElementById('radar-chart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W=220, H=190, cx=110, cy=100, r=72;
  canvas.width=W; canvas.height=H;
  ctx.clearRect(0,0,W,H);

  // Use stored score and computed metrics
  const avgFiller  = analyses.length ? analyses.reduce((s,a)=>s+a.fillerDensity,0)/analyses.length : 0;
  const avgDiv     = analyses.length ? analyses.reduce((s,a)=>s+a.diversity,0)/analyses.length : 50;
  const avgLen2    = analyses.length ? analyses.reduce((s,a)=>s+a.total,0)/analyses.length : 30;
  const avgStutter = analyses.length ? analyses.reduce((s,a)=>s+a.stutterTotal,0)/analyses.length : 0;

  const dims = [
    { label:'Clarity',    val: Math.max(0,100-avgFiller*6) },
    { label:'Fluency',    val: Math.max(0,100-avgStutter*8) },
    { label:'Vocabulary', val: Math.min(100,avgDiv*1.2) },
    { label:'Depth',      val: Math.min(100,avgLen2/1.2) },
    { label:'Confidence', val: avgScore },
  ];

  const n = dims.length;
  const angles = dims.map((_,i)=>(Math.PI*2*i/n)-Math.PI/2);

  // Web
  [0.25,0.5,0.75,1].forEach(scale => {
    ctx.strokeStyle='rgba(255,255,255,0.06)'; ctx.lineWidth=1;
    ctx.beginPath();
    angles.forEach((a,i)=>{
      const x=cx+Math.cos(a)*r*scale, y=cy+Math.sin(a)*r*scale;
      i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
    });
    ctx.closePath(); ctx.stroke();
  });
  angles.forEach(a=>{ ctx.strokeStyle='rgba(255,255,255,0.06)'; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(cx+Math.cos(a)*r,cy+Math.sin(a)*r); ctx.stroke(); });

  // Fill
  const grad = ctx.createRadialGradient(cx,cy,0,cx,cy,r);
  grad.addColorStop(0,'rgba(0,229,255,0.3)'); grad.addColorStop(1,'rgba(123,97,255,0.1)');
  ctx.fillStyle=grad; ctx.strokeStyle='#00e5ff'; ctx.lineWidth=2;
  ctx.beginPath();
  dims.forEach((d,i)=>{ const v=d.val/100; const x=cx+Math.cos(angles[i])*r*v, y=cy+Math.sin(angles[i])*r*v; i===0?ctx.moveTo(x,y):ctx.lineTo(x,y); });
  ctx.closePath(); ctx.fill(); ctx.stroke();

  // Labels
  ctx.fillStyle='#9ca3af'; ctx.font='bold 10px Space Grotesk,sans-serif'; ctx.textAlign='center';
  dims.forEach((d,i)=>{
    const a=angles[i], lx=cx+Math.cos(a)*(r+18), ly=cy+Math.sin(a)*(r+14);
    ctx.fillText(d.label, lx, ly+4);
  });
}

function buildDonut(gp, mp, pp, cx, cy, r, sw) {
  function arc(start, end, color) {
    if (end-start < 0.01) return '';
    const s = {x:cx+Math.cos(start)*r, y:cy+Math.sin(start)*r};
    const e = {x:cx+Math.cos(end)*r,   y:cy+Math.sin(end)*r};
    const large = (end-start)>Math.PI?1:0;
    return `<path d="M${s.x},${s.y} A${r},${r} 0 ${large},1 ${e.x},${e.y}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round"/>`;
  }
  const t = -Math.PI/2;
  const g = t + (gp/100)*2*Math.PI;
  const m = g + (mp/100)*2*Math.PI;
  const p = m + (pp/100)*2*Math.PI;
  return arc(t,g,'#00e676') + arc(g,m,'#ffa726') + arc(m,p,'#ff4d6d') +
    `<circle cx="${cx}" cy="${cy}" r="${r-sw/2-2}" fill="none" stroke="#1f2937" stroke-width="1"/>`;
}

loadAnalytics();