/* ═══════════════════════════════════════════════
   VOICE INTERVIEW — AssemblyAI transcription
   ═══════════════════════════════════════════════ */

let vType          = 'technical';
let vRole          = '';
let vRoleLabel     = ''; // display name e.g. "Software Engineer", "Data Engineer" 
let vDifficulty    = 'medium';
let vQuestions     = [];
let vQIndex        = 0;
let isRecording    = false;
let sessionAnswers = [];
let elapsed        = 0;
let timerInterval  = null;

// MediaRecorder state
let mediaRecorder  = null;
let audioChunks    = [];
let mediaStream    = null;

// Live display transcript (Web Speech API — for showing text while speaking)
let recognition       = null;
let displayTranscript = '';

/* ── Live display via Web Speech API (show text while speaking) ── */
function startLiveDisplay() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return;
  recognition = new SR();
  recognition.continuous     = true;
  recognition.interimResults = true;
  recognition.lang           = 'en-US';

  recognition.onresult = (e) => {
    let interim = '';
    let final   = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript;
      if (e.results[i].isFinal) final += t;
      else interim += t;
    }
    if (final) {
      displayTranscript += ' ' + final;
      document.getElementById('transcript-final').textContent = displayTranscript.trim();
      document.getElementById('transcript-interim').textContent = '';
    }
    if (interim) {
      document.getElementById('transcript-interim').textContent = interim;
    }
    document.getElementById('transcript-placeholder').style.display = 'none';

    // Update word count live
    const wc = displayTranscript.trim().split(/\s+/).filter(Boolean).length;
    const wcEl = document.getElementById('word-count');
    if (wcEl) wcEl.textContent = wc;
    const wbEl = document.getElementById('word-bar');
    if (wbEl) wbEl.style.width = Math.min(wc / 2, 100) + '%';
  };

  recognition.onend = () => {
    if (isRecording) {
      try { recognition.start(); } catch(e) {}
    }
  };

  try { recognition.start(); } catch(e) {}
}

function stopLiveDisplay() {
  if (recognition) {
    recognition.onend = null;
    try { recognition.stop(); } catch(e) {}
    recognition = null;
  }
}

/* ── AssemblyAI transcription ── */
async function transcribeAudio(audioBlob) {
  // Step 1: Upload audio
  const uploadRes = await fetch('/interview/voice/upload-audio', {
    method: 'POST',
    headers: { 'Content-Type': audioBlob.type || 'audio/webm' },
    credentials: 'include',
    body: audioBlob,
  });
  const uploadData = await uploadRes.json();
  if (!uploadData.upload_url) throw new Error('Upload failed');

  // Step 2: Request transcription with disfluencies
  const transcriptRes = await fetch('/interview/voice/transcribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ audio_url: uploadData.upload_url }),
  });
  const transcriptData = await transcriptRes.json();
  return transcriptData.text || displayTranscript.trim();
}

/* ── Type + Difficulty Selection ── */
function setVType(t) {
  vType = t;
  document.querySelectorAll('.vtype-btn').forEach(b => {
    const active = b.dataset.vtype === t;
    b.style.background  = active ? 'rgba(0,229,255,0.08)' : 'transparent';
    b.style.borderColor = active ? 'rgba(0,229,255,0.4)'  : '#1f2937';
    b.style.color       = active ? '#00e5ff'              : '#6b7280';
  });
}

function setVDiff(d) {
  vDifficulty = d;
  const colors = {
    easy:   { bg: 'rgba(74,222,128,0.08)',  border: 'rgba(74,222,128,0.5)',  text: '#4ade80' },
    medium: { bg: 'rgba(250,204,21,0.08)',  border: 'rgba(250,204,21,0.5)',  text: '#facc15' },
    hard:   { bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.5)', text: '#f87171' },
  };
  document.querySelectorAll('.vdiff-btn').forEach(b => {
    const active = b.dataset.diff === d;
    const c = colors[b.dataset.diff] || colors.medium;
    b.style.background  = active ? c.bg     : 'transparent';
    b.style.borderColor = active ? c.border : '#1f2937';
    b.style.color       = active ? c.text   : '#6b7280';
  });
}

/* ── Start Interview ── */
async function startVoice() {
  // Validate something is selected
  if (!vType) {
    const errEl = document.getElementById('start-error');
    if (errEl) { errEl.textContent = 'Please select a role or interview type first.'; errEl.style.display='block'; }
    return;
  }

  // vType = interview type (technical/behavioral/system_design/product_sense)
  // vRole = ChromaDB role key for non-CS roles (financial_analyst, hr_manager etc.) or '' for CS
  const VALID_TYPES = ['technical','behavioral','system_design','product_sense'];
  const roleToSend = VALID_TYPES.includes(vRole) ? '' : vRole; // don't send role if it IS the type

  const startBtn = document.getElementById('start-btn');
  const startTxt = document.getElementById('start-btn-text');
  startBtn.disabled = true;
  startTxt.textContent = 'Loading questions...';
  const errEl = document.getElementById('start-error');
  if (errEl) errEl.style.display = 'none';

  try {
    const res = await fetch('/interview/voice/questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ interview_type: vType, difficulty: vDifficulty, role: roleToSend, role_label: vRoleLabel || '' }),
    });
    if (!res.ok) {
      const err = await res.json();
      alert('Failed to load questions: ' + (err.detail || err.error || 'Server error'));
      startBtn.disabled = false;
      startTxt.textContent = '🎤 Start Voice Interview';
      return;
    }
    const data = await res.json();
    vQuestions     = data.questions;
    vQIndex        = 0;
    sessionAnswers = [];
    elapsed        = 0;
    // Store role label so results/analytics can display it properly
    sessionStorage.setItem('v_role_label', vRoleLabel || '');
    sessionStorage.setItem('v_type', vType || '');

    document.getElementById('setup-screen').style.display='none';
    document.getElementById('interview-screen').style.display='flex';

    const TOTAL_SECS = 10 * 60; // 10 minutes
    timerInterval = setInterval(() => {
      elapsed++;
      const remaining = Math.max(0, TOTAL_SECS - elapsed);
      const m = String(Math.floor(remaining / 60)).padStart(2, '0');
      const s = String(remaining % 60).padStart(2, '0');
      const el = document.getElementById('timer-display');
      el.textContent = `${m}:${s}`;
      if (remaining <= 60)       { el.style.color = '#ff4d6d'; el.style.fontWeight = '700'; }
      else if (remaining <= 180) { el.style.color = '#ffa726'; el.style.fontWeight = '700'; }
      else                       { el.style.color = ''; el.style.fontWeight = ''; }
      if (remaining === 0) {
        clearInterval(timerInterval);
        submitVoiceSession();
      }
    }, 1000);

    acStart();
    blockNav();
    showVQuestion();

  } catch (e) {
    alert('Network error: ' + e.message);
    startBtn.disabled = false;
    startTxt.textContent = '🎤 Start Voice Interview';
  }
}

/* ── Question List ── */
function buildQuestionList() {
  const list = document.getElementById('q-list');
  list.innerHTML = vQuestions.map((q, i) => `
    <div id="qitem-${i}" class="qlist-item ${i === 0 ? 'active' : ''}">
      <span class="qnum" id="qnum-${i}">${i + 1}</span>
      <span class="qtxt" id="qtxt-${i}">${q.substring(0, 60)}${q.length > 60 ? '...' : ''}</span>
    </div>`).join('');
}

/* ── Show Question ── */
function showVQuestion() {
  const q = vQuestions[vQIndex];
  document.getElementById('v-question').textContent         = q;
  document.getElementById('v-progress').textContent         = `Question ${vQIndex + 1} / ${vQuestions.length}`;
  document.getElementById('v-progress-bar').style.width     = `${((vQIndex + 1) / vQuestions.length) * 100}%`;
  document.getElementById('transcript-final').textContent   = '';
  document.getElementById('transcript-interim').textContent = '';
  document.getElementById('transcript-placeholder').style.display = 'block';

  ['filler-count','stutter-count','word-count'].forEach(id => {
    const el = document.getElementById(id); if (el) el.textContent = '0';
  });
  ['filler-bar','stutter-bar','word-bar'].forEach(id => {
    const el = document.getElementById(id); if (el) el.style.width = '0%';
  });
  ['filler-pct','stutter-pct'].forEach(id => {
    const el = document.getElementById(id); if (el) el.textContent = '0';
  });

  displayTranscript = '';
  audioChunks = [];
  stopMic();

  vQuestions.forEach((_, i) => {
    const item = document.getElementById(`qitem-${i}`);
    const num  = document.getElementById(`qnum-${i}`);
    if (!item) return;
    item.className = 'qlist-item';
    if (i < vQIndex) {
      item.classList.add('done');
      if (num) num.textContent = '✓';
    } else if (i === vQIndex) {
      item.classList.add('active');
      if (num) num.textContent = i + 1;
    } else {
      if (num) num.textContent = i + 1;
    }
  });
}

/* ── Mic Toggle ── */
function toggleMic() {
  if (isRecording) stopMic();
  else startMic();
}

async function startMic() {
  // Must ignore blur BEFORE requesting mic — browser fires blur the moment
  // the permission dialog appears, which triggers the anticheat strike
  if (typeof acIgnoreNextBlur === 'function') acIgnoreNextBlur(6000);

  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch(e) {
    alert('Could not access microphone: ' + e.message);
    return;
  }

  // Start MediaRecorder for AssemblyAI
  audioChunks = [];
  try {
    mediaRecorder = new MediaRecorder(mediaStream);
  } catch(e) {
    console.error('[MIC] MediaRecorder failed:', e);
    mediaRecorder = null;
  }
  if (mediaRecorder) {
    mediaRecorder.ondataavailable = (e) => {
      console.log('[MIC] chunk received size:', e.data.size);
      if (e.data.size > 0) audioChunks.push(e.data);
    };
    mediaRecorder.start(250);
    console.log('[MIC] MediaRecorder started, mimeType:', mediaRecorder.mimeType);
  }

  // Start live display via Web Speech API
  startLiveDisplay();

  isRecording = true;
  document.getElementById('rec-indicator').style.display='block';
  document.getElementById('wave-bars').style.display='flex';
  ;
  document.getElementById('mic-label').textContent     = 'Recording — Tap to Stop';
  document.getElementById('mic-btn').style.background  = 'rgba(255,77,109,0.08)';
  document.getElementById('mic-btn').style.borderColor = 'rgba(255,77,109,0.4)';
  document.getElementById('mic-btn').style.color       = '#ff4d6d';

}

function stopMicUI() {
  isRecording = false;
  stopLiveDisplay();
  const recInd   = document.getElementById('rec-indicator');
  const waveBars = document.getElementById('wave-bars');
  if (recInd)   recInd.style.display = 'none';
  if (waveBars) waveBars.style.display = 'none';
  const micLabel = document.getElementById('mic-label');
  const micBtn   = document.getElementById('mic-btn');
  if (micLabel) micLabel.textContent     = 'Tap to Speak';
  if (micBtn)   micBtn.style.background  = 'rgba(0,229,255,0.05)';
  if (micBtn)   micBtn.style.borderColor = 'rgba(0,229,255,0.3)';
  if (micBtn)   micBtn.style.color       = '#00e5ff';
}

// Returns a promise that resolves when mediaRecorder has fully stopped and all chunks are ready
function stopMicAndWait() {
  return new Promise((resolve) => {
    stopLiveDisplay();
    if (!mediaRecorder || mediaRecorder.state === 'inactive') {
      if (mediaStream) { mediaStream.getTracks().forEach(t => t.stop()); mediaStream = null; }
      stopMicUI();
      resolve();
      return;
    }
    mediaRecorder.onstop = () => {
      if (mediaStream) { mediaStream.getTracks().forEach(t => t.stop()); mediaStream = null; }
      stopMicUI();
      resolve();
    };
    mediaRecorder.stop();
  });
}

function stopMic() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.onstop = () => {
      if (mediaStream) { mediaStream.getTracks().forEach(t => t.stop()); mediaStream = null; }
    };
    mediaRecorder.stop();
  } else if (mediaStream) {
    mediaStream.getTracks().forEach(t => t.stop());
    mediaStream = null;
  }
  stopMicUI();
}

/* ── Save answer — transcribe audio via AssemblyAI then store ── */
async function saveCurrentAnswer(skipped = false) {
  console.log('[FLOW] saveCurrentAnswer called, skipped=', skipped, 'chunks=', audioChunks.length);
  if (skipped) {
    sessionAnswers.push({
      question: vQuestions[vQIndex],
      answer: '',
      skipped: true,
      filler_count: 0,
      stutter_count: 0,
    });
    return;
  }

  // Show processing state
  const nextBtn = document.getElementById('next-btn');
  const skipBtn = document.getElementById('skip-btn');
  if (nextBtn) { nextBtn.disabled = true; nextBtn.textContent = 'Transcribing...'; }
  if (skipBtn)   skipBtn.disabled = true;

  let finalText = displayTranscript.trim();

  // If we have audio chunks, send to AssemblyAI for real transcript
  console.log('[AAI] audioChunks count:', audioChunks.length);
  if (audioChunks.length > 0) {
    try {
      const mimeType  = (mediaRecorder && mediaRecorder.mimeType) ? mediaRecorder.mimeType : 'audio/webm';
      const audioBlob = new Blob(audioChunks, { type: mimeType });
      console.log('[AAI] sending blob size:', audioBlob.size, 'type:', mimeType);
      const aaiText   = await transcribeAudio(audioBlob);
      console.log('[AAI] transcript received:', aaiText);
      if (aaiText && aaiText.trim().length > 0) {
        finalText = aaiText.trim();
        // Update display with real transcript
        document.getElementById('transcript-final').textContent = finalText;
      }
    } catch(e) {
      console.warn('AssemblyAI failed, using display transcript:', e);
    }
  }

  if (nextBtn) { nextBtn.disabled = false; nextBtn.textContent = 'Next Question →'; }
  if (skipBtn)   skipBtn.disabled = false;

  sessionAnswers.push({
    question:      vQuestions[vQIndex],
    answer:        finalText,
    skipped:       false,
    filler_count:  0,
    stutter_count: 0,
  });
}

async function nextVoiceQ() {
  console.log('[FLOW] nextVoiceQ called');
  await stopMicAndWait();  // wait for final audio chunk
  await saveCurrentAnswer(false);
  vQIndex++;
  if (vQIndex >= vQuestions.length) { submitVoiceSession(); return; }
  showVQuestion();
}

async function skipVoiceQ() {
  await stopMicAndWait();
  await saveCurrentAnswer(true);
  vQIndex++;
  if (vQIndex >= vQuestions.length) { submitVoiceSession(); return; }
  showVQuestion();
}

/* ── Submit ── */
async function submitVoiceSession() {
  acStop();
  unblockNav();
  clearInterval(timerInterval);
  stopMic();
  document.getElementById('interview-screen').style.display='none';
  document.getElementById('submitting-screen').style.display='flex';

  console.log('[SUBMIT] vRoleLabel=', vRoleLabel, 'vRole=', vRole, 'vType=', vType);
  try {
    const res = await fetch('/interview/voice-results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        interview_type: vType,
        difficulty:     vDifficulty,
        answers:        sessionAnswers,
        total_duration: elapsed,
        role:           vRole || '',
        role_label:     vRoleLabel || '',
      }),
    });
    const data = await res.json();
    if (res.ok) {
      window.location.href = `/interview/results/${data.session_id}`;
    } else {
      document.getElementById('submitting-screen').style.display='none';
      document.getElementById('interview-screen').style.display='flex';
      alert('Error: ' + (data.detail || 'Submission failed'));
    }
  } catch (err) {
    document.getElementById('submitting-screen').style.display='none';
    document.getElementById('interview-screen').style.display='flex';
    alert('Network error: ' + err.message);
  }
}

/* ── Anti-cheat terminate ── */
async function acTerminateSession() {
  if (vQIndex < vQuestions.length) {
    sessionAnswers.push({
      question:      vQuestions[vQIndex],
      answer:        displayTranscript.trim(),
      skipped:       false,
      filler_count:  0,
      stutter_count: 0,
    });
  }
  for (let i = sessionAnswers.length; i < vQuestions.length; i++) {
    sessionAnswers.push({
      question: vQuestions[i], answer: '', skipped: true,
      filler_count: 0, stutter_count: 0, terminated: true,
    });
  }
  setTimeout(() => submitVoiceSession(), 2500);
}

// Init defaults
setVType('technical');
setVDiff('medium');

function blockNav()   { if (typeof NavLock !== 'undefined') NavLock.lock();   }
function unblockNav() { if (typeof NavLock !== 'undefined') NavLock.unlock(); }