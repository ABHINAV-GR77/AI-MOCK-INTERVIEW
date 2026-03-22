/* ═══════════════════════════════════════════════
   InterviewAI — Practice Page
   ═══════════════════════════════════════════════ */

/* ── Role definitions ── */
const ROLES = {
  'Computer Science': [
    { value: 'technical',     label: 'Software Engineer' },
    { value: 'system_design', label: 'System Design' },
    { value: 'product_sense', label: 'Product Manager' },
    { value: 'data_engineer', label: 'Data Engineer', isRole: true },
    { value: 'ml_engineer',   label: 'ML Engineer',   isRole: true },
    { value: 'devops_engineer',label: 'DevOps Engineer',isRole: true },
  ],
  'Business & Management': [
    { value: 'business_analyst', label: 'Business Analyst', isRole: true },
    { value: 'project_manager',  label: 'Project Manager',  isRole: true },
  ],
  'Finance & Accounting': [
    { value: 'financial_analyst', label: 'Financial Analyst', isRole: true },
    { value: 'accountant',        label: 'Accountant',        isRole: true },
  ],
  'Marketing & Content': [
    { value: 'digital_marketing', label: 'Digital Marketing', isRole: true },
    { value: 'content_writer',    label: 'Content Writer',    isRole: true },
  ],
  'Human Resources': [
    { value: 'hr_manager', label: 'HR Manager', isRole: true },
  ],
  'Design': [
    { value: 'ux_designer', label: 'UI/UX Designer', isRole: true },
  ],
  'General': [
    { value: 'behavioral', label: 'Behavioral (Any Role)' },
  ],
};

/* Categories per role type */
const CS_CATEGORIES = ['technical','behavioral','system_design','product_sense'];
const CS_CAT_LABELS = {
  technical:     'Technical',
  behavioral:    'Behavioral',
  system_design: 'System Design',
  product_sense: 'Product Sense',
};
const ROLE_CATEGORIES = ['behavioral','technical','situational'];
const ROLE_CAT_LABELS = {
  behavioral:  'Behavioral',
  technical:   'Technical',
  situational: 'Situational',
};
const BEHAVIORAL_ONLY = { behavioral: 'Behavioral' };

let selectedRole     = null; // {value, label, isRole}
let selectedCategory = null;
let selectedDiff     = 'medium';
let sessionId        = null;
let currentQ         = '';
let qNum             = 1;
let elapsed          = 0;
let timerInterval    = null;
const totalQ         = 5;

/* ── Build role dropdown ── */
function buildRoleList() {
  const list = document.getElementById('role-list');
  list.innerHTML = '';
  Object.entries(ROLES).forEach(([group, roles]) => {
    const glabel = document.createElement('div');
    glabel.className = 'dropdown-group-label';
    glabel.textContent = group;
    list.appendChild(glabel);
    roles.forEach(role => {
      const item = document.createElement('div');
      item.className = 'dropdown-item';
      item.dataset.value = role.value;
      item.dataset.label = role.label;
      item.dataset.isRole = role.isRole ? '1' : '0';
      item.textContent = role.label;
      item.onclick = () => selectRole(role);
      list.appendChild(item);
    });
  });
}

function filterRoles(q) {
  const items = document.querySelectorAll('#role-list .dropdown-item');
  const labels = document.querySelectorAll('#role-list .dropdown-group-label');
  const search = q.toLowerCase();
  items.forEach(item => {
    item.style.display = item.textContent.toLowerCase().includes(search) ? '' : 'none';
  });
  // Hide group labels if all items hidden
  labels.forEach(label => {
    let next = label.nextElementSibling;
    let allHidden = true;
    while (next && !next.classList.contains('dropdown-group-label')) {
      if (next.style.display !== 'none') { allHidden = false; break; }
      next = next.nextElementSibling;
    }
    label.style.display = allHidden ? 'none' : '';
  });
}

function toggleDropdown(name) {
  const menu = document.getElementById(`${name}-menu`);
  const btn  = document.getElementById(`${name}-btn`);
  const isOpen = menu.classList.contains('open');
  // Close all
  document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.remove('open'));
  document.querySelectorAll('.dropdown-btn').forEach(b => b.classList.remove('open'));
  if (!isOpen) {
    menu.classList.add('open');
    btn.classList.add('open');
    const input = document.getElementById(`${name}-search`);
    if (input) { input.value = ''; filterRoles(''); input.focus(); }
  }
}

// Close dropdown when clicking outside
document.addEventListener('click', e => {
  if (!e.target.closest('.dropdown')) {
    document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.remove('open'));
    document.querySelectorAll('.dropdown-btn').forEach(b => b.classList.remove('open'));
  }
});

function selectRole(role) {
  selectedRole = role;
  selectedCategory = null;

  // Update button label
  document.getElementById('role-label').textContent = role.label;
  document.getElementById('role-label').style.color = '#fff';

  // Mark selected
  document.querySelectorAll('#role-list .dropdown-item').forEach(i => {
    i.classList.toggle('selected', i.dataset.value === role.value);
  });

  // Close dropdown
  document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.remove('open'));
  document.querySelectorAll('.dropdown-btn').forEach(b => b.classList.remove('open'));

  // Show categories
  buildCategoryBtns(role);
  document.getElementById('category-section').style.display = '';
  document.getElementById('difficulty-section').style.display = 'none';
  document.getElementById('start-btn').disabled = true;
  document.getElementById('start-btn').style.opacity = '0.4';
}

function buildCategoryBtns(role) {
  const container = document.getElementById('category-btns');
  container.innerHTML = '';

  let cats;
  if (role.value === 'behavioral') {
    cats = BEHAVIORAL_ONLY;
  } else if (role.isRole) {
    cats = ROLE_CAT_LABELS;
  } else {
    // CS type — use the type itself, only behavioral as extra
    cats = { [role.value]: CS_CAT_LABELS[role.value] || role.label, behavioral: 'Behavioral' };
  }

  Object.entries(cats).forEach(([val, lbl]) => {
    const btn = document.createElement('button');
    btn.className = 'type-btn';
    btn.textContent = lbl;
    btn.onclick = () => selectCategory(val, btn);
    container.appendChild(btn);
  });
}

function selectCategory(cat, btn) {
  selectedCategory = cat;
  document.querySelectorAll('#category-btns .type-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('difficulty-section').style.display = '';
  checkCanStart();
}

function setDiff(d, btn) {
  selectedDiff = d;
  document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  checkCanStart();
}

function checkCanStart() {
  const canStart = selectedCategory && selectedDiff;
  const btn = document.getElementById('start-btn');
  if (btn) { btn.disabled = !canStart; btn.style.opacity = canStart ? '1' : '0.4'; }
}

/* ── Nav blocking during interview ── */
function blockNav()   { if (typeof NavLock !== 'undefined') NavLock.lock();   }
function unblockNav() { if (typeof NavLock !== 'undefined') NavLock.unlock(); }

/* ── Start interview ── */
async function startInterview() {
  const btn = document.getElementById('start-btn');
  btn.disabled = true;
  btn.textContent = 'Loading questions...';
  const errEl = document.getElementById('start-error');
  if (errEl) errEl.classList.add('hidden');

  // selectedCategory = interview type (technical/behavioral/system_design/product_sense)
  // selectedRole = {value: chromadb_role_key, label: display_name}
  // selectedDiff = easy/medium/hard
  // For non-CS roles: selectedCategory is the type, selectedRole.value is the ChromaDB role key
  // For CS roles: selectedCategory IS the type, selectedRole.value matches the type

  const VALID_TYPES = ['technical','behavioral','system_design','product_sense'];
  const interviewType = VALID_TYPES.includes(selectedCategory) ? selectedCategory : 'behavioral';
  // Send role only if it's a non-CS role (role value doesn't match a valid type)
  const role = (selectedRole && !VALID_TYPES.includes(selectedRole.value)) ? selectedRole.value : '';
  const activeDiff = selectedDiff || 'medium';
  console.log('[START] interview_type:', interviewType, 'role:', role, 'diff:', activeDiff);

  try {
    const res = await fetch('/interview/start', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        interview_type: interviewType,
        difficulty: activeDiff,
        role: role,
        role_label: selectedRole ? selectedRole.label : '',
      })
    });
    const data = await res.json();
    if (!res.ok) {
      document.getElementById('start-error').textContent = data.error || 'Failed to start. Try again.';
      document.getElementById('start-error').classList.remove('hidden');
      btn.disabled = false;
      btn.textContent = 'Start Interview →';
      return;
    }

    sessionId = data.session_id;
    currentQ  = data.question;
    qNum      = 1;

    // Store for interview.js compatibility
    sessionStorage.setItem('interview_difficulty', selectedDiff);
    sessionStorage.setItem('interview_role', role);
    sessionStorage.setItem('interview_role_label', selectedRole ? selectedRole.label : '');
    sessionStorage.setItem('interview_type_label', interviewType);

    document.getElementById('setup-screen').style.display='none';
    showQuestion(currentQ, qNum);
    startTimer();
    acStart();
    blockNav();

    document.getElementById('interview-title').textContent =
      (role ? selectedRole.label : selectedRole.label) + ' Interview';
    document.getElementById('interview-meta').textContent =
      selectedDiff.charAt(0).toUpperCase() + selectedDiff.slice(1) +
      ' · 5 Questions · 10 minutes';

  } catch(e) {
    document.getElementById('start-error').textContent = 'Network error: ' + e.message;
    document.getElementById('start-error').classList.remove('hidden');
    btn.disabled = false;
    btn.textContent = 'Start Interview →';
  }
}

/* ── Timer ── */
function startTimer() {
  const TOTAL = 10 * 60;
  elapsed = 0;
  timerInterval = setInterval(() => {
    elapsed++;
    const remaining = Math.max(0, TOTAL - elapsed);
    const m = String(Math.floor(remaining / 60)).padStart(2,'0');
    const s = String(remaining % 60).padStart(2,'0');
    const el = document.getElementById('timer-display');
    el.textContent = `${m}:${s}`;
    if (remaining <= 60)       { el.style.color = '#ff4d6d'; el.style.fontWeight = '700'; }
    else if (remaining <= 180) { el.style.color = '#ffa726'; el.style.fontWeight = '700'; }
    else                       { el.style.color = ''; el.style.fontWeight = ''; }
    if (remaining === 0) { clearInterval(timerInterval); endSession(); }
  }, 1000);
}

/* ── Show question ── */
function showQuestion(q, num) {
  document.getElementById('loading-screen').style.display='none';
  document.getElementById('interview-screen').style.display='flex';
  document.getElementById('question-text').textContent = q;
  document.getElementById('q-num').textContent         = num;
  document.getElementById('q-counter').textContent     = `Q ${num}/${totalQ}`;
  document.getElementById('progress-bar').style.width  = `${(num/totalQ)*100}%`;
  document.getElementById('answer-input').value        = '';
  document.getElementById('word-count').textContent    = '0 words';
  document.getElementById('submit-btn').disabled       = false;
  document.getElementById('submit-btn').textContent    = 'Submit Answer →';
  document.getElementById('last-score').style.display='none';
  document.getElementById('last-feedback').style.display='none';
}

/* ── Word count ── */
document.getElementById('answer-input').addEventListener('input', () => {
  const wc = document.getElementById('answer-input').value.trim().split(/\s+/).filter(Boolean).length;
  document.getElementById('word-count').textContent = wc + ' word' + (wc !== 1 ? 's' : '');
});
document.getElementById('answer-input').addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.ctrlKey) submitAnswer();
});

/* ── Submit answer ── */
async function submitAnswer() {
  const answer = document.getElementById('answer-input').value.trim();
  if (!answer) { document.getElementById('answer-input').focus(); return; }

  const btn = document.getElementById('submit-btn');
  btn.disabled = true; btn.textContent = 'Scoring...';

  try {
    const res  = await fetch('/interview/answer', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, question: currentQ, answer, question_number: qNum })
    });
    const data = await res.json();
    if (!res.ok) { alert(data.detail || 'Error'); btn.disabled=false; btn.textContent='Submit Answer →'; return; }

    if (data.done) { await endSession(); return; }

    const scoreVal   = data.score || 0;
    const scoreColor = scoreVal>=80?'#00e676':scoreVal>=60?'#ffa726':'#ff4d6d';
    document.getElementById('last-score').style.display='block';
    document.getElementById('last-score-val').textContent  = scoreVal + '%';
    document.getElementById('last-score-val').style.color  = scoreColor;
    if (data.feedback) {
      const fb = document.getElementById('last-feedback');
      fb.style.display='block';
      fb.textContent     = '💬 ' + data.feedback;
      fb.style.background = scoreVal>=80?'rgba(0,230,118,0.07)':scoreVal>=60?'rgba(255,167,38,0.07)':'rgba(255,77,109,0.07)';
      fb.style.color      = scoreColor;
    }
    currentQ = data.question;
    qNum     = data.question_number;
    setTimeout(() => showQuestion(currentQ, qNum), 1800);
  } catch(e) {
    alert('Network error: ' + e.message);
    btn.disabled=false; btn.textContent='Submit Answer →';
  }
}

/* ── Skip ── */
async function skipQuestion() {
  const res  = await fetch('/interview/answer', {
    method:'POST', credentials:'include',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ session_id: sessionId, question: currentQ, answer: '[Skipped]', question_number: qNum })
  });
  const data = await res.json();
  if (data.done) { await endSession(); return; }
  currentQ = data.question; qNum = data.question_number;
  showQuestion(currentQ, qNum);
}

/* ── End session ── */
async function endSession() {
  clearInterval(timerInterval);
  acStop();
  unblockNav();
  document.getElementById('interview-screen').style.display='none';
  document.getElementById('submitting-screen').style.display='flex';
  try {
    await fetch('/interview/end', {
      method:'POST', credentials:'include',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ session_id: sessionId, answers:[], duration_minutes: Math.round(elapsed/60) })
    });
    window.location.href = `/interview/results/${sessionId}`;
  } catch(e) {
    window.location.href = '/dashboard';
  }
}

/* ── Anti-cheat ── */
async function acTerminateSession() {
  if (sessionId) {
    try {
      await fetch('/interview/end', {
        method:'POST', credentials:'include',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ session_id: sessionId, answers:[], duration_minutes: Math.round(elapsed/60) })
      });
    } catch(e) {}
    setTimeout(() => { window.location.href = `/interview/results/${sessionId}`; }, 2500);
  }
}

/* ── Init ── */
buildRoleList();