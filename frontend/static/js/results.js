/* ═══════════════════════════════════════════════
   InterviewAI — Results Page Logic
   ═══════════════════════════════════════════════ */

const sessionId = window.location.pathname.split('/results/')[1];

const FILLERS = [
  'uh','uhh','uhhh','um','umm','ummm','ah','ahh','er','err','erm',
  'like','basically','literally','actually','honestly','clearly','obviously',
  'right','okay','so','well','anyway','you know','i mean','i guess',
  'i think','kind of','sort of','to be honest','the thing is',
];

/* ── Helpers ── */
function scoreColor(s) { return s >= 80 ? '#00e676' : s >= 60 ? '#ffa726' : '#ff4d6d'; }
function scoreEmoji(s) { return s >= 80 ? '🎉' : s >= 60 ? '👍' : '😬'; }
function heroTitle(s)  { return s >= 80 ? 'Great job, keep it up!' : s >= 60 ? 'Solid effort — room to grow!' : 'Keep practicing, you\'ll get there!'; }

function highlightSpeech(text) {
  if (!text) return '<span style="color:#6b7280;font-style:italic">No answer recorded</span>';
  let out = text;
  FILLERS.forEach(f => {
    const re = new RegExp('\\b(' + f.replace(/\s+/g, '\\s+') + ')\\b', 'gi');
    out = out.replace(re, '<mark style="background:rgba(255,167,38,0.25);color:#ffa726;border-radius:3px;padding:0 2px;font-weight:700">$1</mark>');
  });
  out = out.replace(/\b(\w{2,})\s+\1\b/gi,
    '<span style="background:rgba(255,77,109,0.2);color:#ff4d6d;border-radius:3px;padding:0 2px;border-bottom:2px solid #ff4d6d">$&</span>');
  return out;
}

function countFillersFromText(text) {
  if (!text) return {};
  const counts = {};
  FILLERS.forEach(f => {
    const re = new RegExp('\\b' + f.replace(/\s+/g, '\\s+') + '\\b', 'gi');
    const m = text.match(re);
    if (m) counts[f] = (counts[f] || 0) + m.length;
  });
  return counts;
}

/* ── Main loader ── */
async function loadResults() {
  try {
    const res = await fetch(`/interview/results-data/${sessionId}`, { credentials: 'include' });
    if (!res.ok) {
      document.getElementById('loading-screen').innerHTML =
        '<div style="text-align:center;padding:40px;color:#ff4d6d">Could not load results. <a href="/dashboard" style="color:#00e5ff">Go back</a></div>';
      return;
    }

    const d       = await res.json();
    const score   = d.score || 0;
    const answers = d.answers || [];
    const isVoice = d.mode === 'voice';
    const totalFillers  = d.total_filler_words || 0;
    const totalStutters = d.total_stutters || 0;
    const answered = answers.filter(a => !a.skipped && a.answer && a.answer !== '[Skipped]').length;
    const dur = d.duration_minutes || 0;

    /* Hero */
    document.getElementById('hero-emoji').textContent = scoreEmoji(score);
    document.getElementById('hero-title').textContent = heroTitle(score);
    document.getElementById('hero-sub').innerHTML =
      `You scored <strong style="color:#00e5ff">${score}%</strong> on your ` +
      `${(d.interview_type||'').replace('voice_','').replace(/_/g,' ')} ${isVoice?'Voice ':''}Interview`;

    /* Score ring */
    const offset = 408.4 - (score / 100) * 408.4;
    document.getElementById('score-ring').style.strokeDashoffset = offset;
    document.getElementById('score-text').textContent = score + '%';

    /* Stat cards — hide filler/stutter for text interviews */
    if (!isVoice) {
      const cf = document.getElementById('card-fillers');
      const cs = document.getElementById('card-stutters');
      if (cf) cf.style.display = 'none';
      if (cs) cs.style.display = 'none';
      const grid = document.getElementById('stats-grid');
      if (grid) grid.style.gridTemplateColumns = 'repeat(2,1fr)';
    } else {
      document.getElementById('stat-fillers').textContent  = totalFillers;
      document.getElementById('stat-stutters').textContent = totalStutters;
    }
    document.getElementById('stat-answered').textContent = `${answered}/${answers.length}`;
    document.getElementById('stat-duration').textContent = dur > 0 ? dur + 'm' : '—';

    /* Filler breakdown — voice only */
    if (isVoice) {
      const fillerSection = document.getElementById('filler-section');
      fillerSection.style.display = 'grid';
      fillerSection.style.gridTemplateColumns = '1fr 1fr';
      fillerSection.style.gap = '16px';
      fillerSection.classList.remove('hidden');

      const allFillerCounts = {};
      answers.forEach(a => {
        if (a.skipped || !a.answer) return;
        Object.entries(countFillersFromText(a.answer)).forEach(([w,c]) => {
          allFillerCounts[w] = (allFillerCounts[w]||0)+c;
        });
      });
      const sorted = Object.entries(allFillerCounts).sort((a,b)=>b[1]-a[1]).slice(0,6);
      const max = sorted[0]?.[1]||1;
      document.getElementById('filler-list').innerHTML = sorted.length > 0
        ? sorted.map(([w,c]) => `
            <div class="flex items-center gap-2 mb-2.5">
              <div class="text-xs text-white w-20 flex-shrink-0 font-mono">${w}</div>
              <div class="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
                <div class="h-full rounded-full" style="width:${Math.round((c/max)*100)}%;background:linear-gradient(90deg,#ffa726,#ff4d6d);transition:width 0.7s ease"></div>
              </div>
              <div class="text-xs text-muted w-6 text-right">${c}×</div>
            </div>`).join('')
        : '<div class="text-xs text-success">✓ No filler words detected!</div>';

      const stutterWords = {};
      answers.forEach(a => {
        if (a.skipped || !a.answer) return;
        const words = a.answer.toLowerCase().split(/\s+/);
        for (let i = 1; i < words.length; i++) {
          if (words[i] === words[i-1] && words[i].length > 2)
            stutterWords[words[i]] = (stutterWords[words[i]]||0)+1;
        }
      });
      const stutterEntries = Object.entries(stutterWords).sort((a,b)=>b[1]-a[1]);
      const stutterMax = stutterEntries[0]?.[1]||1;
      document.getElementById('stutter-list').innerHTML = stutterEntries.length > 0
        ? stutterEntries.slice(0,4).map(([w,c]) => `
            <div class="flex items-center gap-2 mb-2.5">
              <div class="text-xs text-accent3 w-20 flex-shrink-0 font-mono">"${w}"</div>
              <div class="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
                <div class="h-full rounded-full" style="width:${Math.round((c/stutterMax)*100)}%;background:linear-gradient(90deg,#ff4d6d,#ffa726)"></div>
              </div>
              <div class="text-xs text-muted w-6 text-right">${c}×</div>
            </div>`).join('')
        : '<div class="text-xs text-success">✓ No significant stuttering!</div>';
      if (stutterEntries.length > 0) document.getElementById('stutter-tip').classList.remove('hidden');
    }


    /* Show page, then kick off coaching */
    document.getElementById('loading-screen').classList.add('hidden');
    document.getElementById('results-content').classList.remove('hidden');


  } catch(e) {
    document.getElementById('loading-screen').innerHTML =
      `<div style="text-align:center;padding:40px">
        <div style="color:#ff4d6d;margin-bottom:8px">Error loading results</div>
        <div style="color:#6b7280;font-size:12px;margin-bottom:16px">${e.message}</div>
        <a href="/dashboard" style="color:#00e5ff;font-size:12px">← Dashboard</a>
      </div>`;
  }
}


loadResults();