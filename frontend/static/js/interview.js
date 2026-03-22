/* ═══════════════════════════════════════════════
   InterviewAI — Text Interview Logic
   Place at: frontend/static/js/interview.js
   ═══════════════════════════════════════════════ */

const params      = new URLSearchParams(window.location.search);
let sessionId     = params.get('session');
let currentQ      = params.get('q') || '';
let qNum          = parseInt(params.get('qn')) || 1;
const totalQ      = 5;
const iType       = window.location.pathname.split('/interview/')[1]?.split('?')[0] || 'technical';
const diff        = sessionStorage.getItem('interview_difficulty') || 'medium';
let elapsed       = 0;
let timerInterval = null;

/* ── Word counter ── */
const ansInput = document.getElementById('answer-input');
ansInput.addEventListener('input', () => {
  const wc = ansInput.value.trim().split(/\s+/).filter(Boolean).length;
  document.getElementById('word-count').textContent = wc + ' word' + (wc !== 1 ? 's' : '');
});

/* ── Ctrl+Enter to submit ── */
ansInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.ctrlKey) submitAnswer();
});

/* ── Init ── */
function initInterview() {
  document.getElementById('interview-title').textContent = iType.replace(/_/g, ' ') + ' Interview';
  document.getElementById('interview-meta').textContent  = diff.charAt(0).toUpperCase() + diff.slice(1) + ' · 5 Questions';

  timerInterval = setInterval(() => {
    elapsed++;
    const m = String(Math.floor(elapsed / 60)).padStart(2, '0');
    const s = String(elapsed % 60).padStart(2, '0');
    document.getElementById('timer-display').textContent = `${m}:${s}`;
  }, 1000);

  acStart();
  showQuestion(currentQ, qNum);
}

function showQuestion(q, num) {
  document.getElementById('loading-screen').classList.add('hidden');
  document.getElementById('interview-screen').classList.remove('hidden');
  document.getElementById('question-text').textContent = q;
  document.getElementById('q-num').textContent         = num;
  document.getElementById('q-counter').textContent     = `Q ${num}/${totalQ}`;
  document.getElementById('progress-bar').style.width  = `${(num / totalQ) * 100}%`;
  document.getElementById('answer-input').value        = '';
  document.getElementById('word-count').textContent    = '0 words';
  document.getElementById('submit-btn').disabled       = false;
  document.getElementById('submit-btn').textContent    = 'Submit Answer →';
}

/* ── Submit answer ── */
async function submitAnswer() {
  const answer = ansInput.value.trim();
  if (!answer) { ansInput.focus(); return; }

  const btn = document.getElementById('submit-btn');
  btn.disabled    = true;
  btn.textContent = 'Scoring...';

  try {
    const res  = await fetch('/interview/answer', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, question: currentQ, answer, question_number: qNum })
    });
    const data = await res.json();

    if (!res.ok) {
      alert(data.detail || 'Error submitting answer');
      btn.disabled = false; btn.textContent = 'Submit Answer →';
      return;
    }

    if (data.done) { await endSession(); return; }

    // Show brief feedback before next question
    const scoreVal   = data.score || 0;
    const scoreColor = scoreVal >= 80 ? '#00e676' : scoreVal >= 60 ? '#ffa726' : '#ff4d6d';
    document.getElementById('last-score').classList.remove('hidden');
    document.getElementById('last-score-val').textContent = scoreVal + '%';
    document.getElementById('last-score-val').style.color = scoreColor;

    if (data.feedback) {
      const fbEl = document.getElementById('last-feedback');
      fbEl.classList.remove('hidden');
      fbEl.textContent      = '💬 ' + data.feedback;
      fbEl.style.background = scoreVal >= 80 ? 'rgba(0,230,118,0.07)' : scoreVal >= 60 ? 'rgba(255,167,38,0.07)' : 'rgba(255,77,109,0.07)';
      fbEl.style.color      = scoreColor;
    }

    currentQ = data.question;
    qNum     = data.question_number;
    setTimeout(() => showQuestion(currentQ, qNum), 1800);

  } catch (e) {
    alert('Network error: ' + e.message);
    btn.disabled = false; btn.textContent = 'Submit Answer →';
  }
}

/* ── Skip question ── */
async function skipQuestion() {
  const res  = await fetch('/interview/answer', {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, question: currentQ, answer: '[Skipped]', question_number: qNum })
  });
  const data = await res.json();
  if (data.done) { await endSession(); return; }
  currentQ = data.question;
  qNum     = data.question_number;
  showQuestion(currentQ, qNum);
}

/* ── End session ── */
async function endSession() {
  acStop();
  clearInterval(timerInterval);
  document.getElementById('interview-screen').classList.add('hidden');
  document.getElementById('submitting-screen').classList.remove('hidden');

  try {
    const res  = await fetch('/interview/end', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, answers: [], duration_minutes: Math.round(elapsed / 60) })
    });
    const data = await res.json();
    if (res.ok) {
      window.location.href = `/interview/results/${data.session_id}`;
    } else {
      alert('Error ending session: ' + (data.detail || 'Unknown'));
    }
  } catch (e) {
    alert('Network error: ' + e.message);
  }
}

/* ── Auto-start if no session yet ── */
if (!sessionId) {
  fetch('/interview/start', {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ interview_type: iType, difficulty: diff })
  })
  .then(r => r.json())
  .then(data => {
    sessionId = data.session_id;
    currentQ  = data.question;
    qNum      = 1;
    initInterview();
  })
  .catch(e => alert('Failed to start interview: ' + e.message));
} else {
  initInterview();
}

/* ── Anti-cheat terminate handler ── */
async function acTerminateSession() {
  // Submit session in background first, then navigate after overlay has shown
  try {
    const sid = window._sessionId || sessionId;
    if (sid) {
      await fetch('/interview/end', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sid, force: true })
      });
    }
  } catch(e) { /* best effort */ }
  // Navigate to results — overlay has already been visible for 4s
  const sid = window._sessionId || sessionId;
  if (sid) {
    window.location.href = `/results?session_id=${sid}&terminated=1`;
  } else {
    window.location.href = '/dashboard';
  }
}