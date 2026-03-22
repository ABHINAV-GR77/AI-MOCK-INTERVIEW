/* ═══════════════════════════════════════════════
   InterviewAI — Global Script
   ═══════════════════════════════════════════════ */

/* ── Utilities ───────────────────────────────── */
function showError(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
}
function hideError(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'none';
}
function showSuccess(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  if (msg) el.textContent = msg;
  el.style.display = 'block';
}
function setLoading(btnId, textId, spinnerId, loading, loadingText = 'Loading...', defaultText = null) {
  const btn = document.getElementById(btnId);
  const txt = document.getElementById(textId);
  const spinner = document.getElementById(spinnerId);
  if (!btn) return;
  btn.disabled = loading;
  if (spinner) spinner.style.display = loading ? 'block' : 'none';
  if (txt) txt.textContent = loading ? loadingText : (defaultText || txt.dataset.default || txt.textContent);
}

/* ── Toggle Password Eye ─────────────────────── */
function toggleEye(inputId, iconId, accentColor = '#00e5ff') {
  const input = document.getElementById(inputId);
  const icon = document.getElementById(iconId);
  if (!input || !icon) return;
  const hidden = input.type === 'password';
  input.type = hidden ? 'text' : 'password';
  icon.innerHTML = hidden
    ? `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>`
    : `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`;
  icon.style.color = hidden ? accentColor : '';
}

/* ── Email Validation ────────────────────────── */
function validateEmail(input, hintId) {
  const hint = document.getElementById(hintId);
  if (!hint) return;
  const val = input.value.trim();
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
  if (!val) { hint.style.display = 'none'; return; }
  hint.style.display = 'block';
  hint.textContent = valid ? '✓ Valid email' : '✗ Enter a valid email (e.g. you@example.com)';
  hint.style.color = valid ? '#00e676' : '#ff4d6d';
}

/* ── Password Strength ───────────────────────── */
function updateStrength(password, bar1, bar2, bar3, bar4, labelId) {
  const bars = [bar1, bar2, bar3, bar4].map(id => document.getElementById(id));
  const label = document.getElementById(labelId);
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  const cls = score <= 1 ? 'weak' : score === 2 ? 'fair' : score === 3 ? 'good' : 'strong';
  bars.forEach((b, i) => { if (!b) return; b.className = 'sbar'; if (i < score) b.classList.add(cls); });
  if (label) {
    label.textContent = password ? ['', 'Weak', 'Fair', 'Good', 'Strong'][score] : '';
    label.style.color = score <= 1 ? '#ff4d6d' : score === 2 ? '#ffa726' : score === 3 ? '#00e5ff' : '#00e676';
  }
}

/* ── OTP Helpers ─────────────────────────────── */
function otpMove(el, idx, inputs) {
  el.value = el.value.replace(/[^0-9]/g, '');
  if (el.value && idx < inputs.length - 1) inputs[idx + 1].focus();
}
function otpBack(e, idx, inputs) {
  if (e.key === 'Backspace' && !inputs[idx].value && idx > 0) inputs[idx - 1].focus();
}
function getOtp(inputs) {
  return Array.from(inputs).map(i => i.value).join('');
}

/* ── OTP Timer ───────────────────────────────── */
function startTimer(displayId, seconds = 600) {
  const el = document.getElementById(displayId);
  if (!el) return;
  const interval = setInterval(() => {
    seconds--;
    if (seconds <= 0) {
      clearInterval(interval);
      el.textContent = 'Expired';
      el.style.color = '#ff4d6d';
      return;
    }
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    el.textContent = `${m}:${s}`;
  }, 1000);
}

/* ═══════════════════════════════════════════════
   AUTH — Login
   ═══════════════════════════════════════════════ */
async function handleLogin() {
  hideError('error-msg');
  const email    = document.getElementById('email')?.value.trim();
  const password = document.getElementById('password')?.value;
  if (!email || !password) { showError('error-msg', '⚠ Please fill in all fields.'); return; }

  setLoading('login-btn', 'login-btn-text', 'login-spinner', true, 'Signing in...');
  try {
    const res  = await fetch('/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ email, password }) });
    const data = await res.json();
    if (res.ok) window.location.href = data.redirect || '/dashboard';
    else showError('error-msg', '⚠ ' + (data.detail || 'Invalid email or password.'));
  } catch { showError('error-msg', '⚠ Network error. Try again.'); }
  finally  { setLoading('login-btn', 'login-btn-text', 'login-spinner', false, '', 'SIGN IN →'); }
}

/* ═══════════════════════════════════════════════
   AUTH — Register
   ═══════════════════════════════════════════════ */
async function handleRegister() {
  hideError('error-msg');
  const name     = document.getElementById('name')?.value.trim();
  const email    = document.getElementById('email')?.value.trim();
  const password = document.getElementById('password')?.value;

  if (!name)    { showError('error-msg', '⚠ Please enter your name.'); return; }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showError('error-msg', '⚠ Please enter a valid email address.'); return; }
  if (password.length < 8) { showError('error-msg', '⚠ Password must be at least 8 characters.'); return; }

  setLoading('reg-btn', 'btn-text', 'spinner', true, 'Creating...');
  try {
    const res  = await fetch('/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ email, password, name }) });
    const data = await res.json();
    if (res.ok) { showSuccess('success-msg'); setTimeout(() => window.location.href = '/', 1500); }
    else showError('error-msg', '⚠ ' + (data.detail || 'Registration failed.'));
  } catch { showError('error-msg', '⚠ Network error. Try again.'); }
  finally  { setLoading('reg-btn', 'btn-text', 'spinner', false, '', 'CREATE ACCOUNT'); }
}

/* ═══════════════════════════════════════════════
   AUTH — Forgot Password
   ═══════════════════════════════════════════════ */
async function handleForgot() {
  hideError('error-msg');
  const email = document.getElementById('email')?.value.trim();
  if (!email) { showError('error-msg', '⚠ Please enter your email.'); return; }

  setLoading('forgot-btn', 'btn-text', 'spinner', true, 'Sending...');
  try {
    const res  = await fetch('/forgot-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
    const data = await res.json();
    if (res.ok) {
      showSuccess('success-msg');
      setTimeout(() => { window.location.href = `/reset-password?email=${encodeURIComponent(email)}`; }, 1500);
    } else showError('error-msg', '⚠ ' + (data.detail || 'Something went wrong.'));
  } catch { showError('error-msg', '⚠ Network error. Try again.'); }
  finally  { setLoading('forgot-btn', 'btn-text', 'spinner', false, '', 'SEND OTP'); }
}

/* ═══════════════════════════════════════════════
   AUTH — Reset Password
   ═══════════════════════════════════════════════ */
async function handleReset() {
  hideError('error-msg');
  const email    = document.getElementById('email')?.value.trim();
  const inputs   = document.querySelectorAll('.otp-input');
  const otp      = getOtp(inputs);
  const password = document.getElementById('password')?.value;
  const confirm  = document.getElementById('confirm-password')?.value;

  if (otp.length !== 6)  { showError('error-msg', '⚠ Please enter the complete 6-digit OTP.'); return; }
  if (!password)         { showError('error-msg', '⚠ Please enter a new password.'); return; }
  if (password !== confirm) { showError('error-msg', '⚠ Passwords do not match.'); return; }

  setLoading('reset-btn', 'btn-text', 'spinner', true, 'Resetting...');
  try {
    const res  = await fetch('/reset-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: otp, new_password: password, email }) });
    const data = await res.json();
    if (res.ok) { showSuccess('success-msg'); setTimeout(() => window.location.href = '/', 2000); }
    else showError('error-msg', '⚠ ' + (data.detail || 'Invalid or expired OTP.'));
  } catch { showError('error-msg', '⚠ Network error. Try again.'); }
  finally  { setLoading('reset-btn', 'btn-text', 'spinner', false, '', 'RESET PASSWORD'); }
}

/* ── Enter key support ───────────────────────── */
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  if (document.getElementById('login-btn'))  handleLogin();
  if (document.getElementById('forgot-btn')) handleForgot();
  if (document.getElementById('reg-btn'))    handleRegister();
});