/* ═══════════════════════════════════════════════
   ANTI-CHEAT — Tab Switch Detection

   Strike 1 → Orange warning, user can resume
   Strike 2 → Red overlay shown, auto-terminates
               after 3 seconds, no button needed
   ═══════════════════════════════════════════════ */

let _acStrikes    = 0;
let _acActive     = false;
let _acTerminated = false;
let _acCooldown   = false;   // prevents double-fire from blur+visibilitychange

/* ── Mic permission guard ──────────────────────────────────────
   Browser permission dialogs (mic, camera) steal window focus
   and fire a blur event — must NOT count that as a tab switch.
   Call acIgnoreNextBlur() before requesting any permission.
──────────────────────────────────────────────────────────────── */
let _acIgnoreNextBlur = false;

function acIgnoreNextBlur(ms = 3000) {
  _acIgnoreNextBlur = true;
  setTimeout(() => { _acIgnoreNextBlur = false; }, ms);
}

function acStart()  { _acActive = true; _acStrikes = 0; _acTerminated = false; }
function acStop()   { _acActive = false; }

/* ── Warning overlay (strike 1) ── */
function _showWarning() {
  const old = document.getElementById('ac-overlay');
  if (old) old.remove();

  const el = document.createElement('div');
  el.id = 'ac-overlay';
  el.style.cssText = `
    position:fixed;inset:0;z-index:9999;
    display:flex;align-items:center;justify-content:center;
    background:rgba(0,0,0,0.85);backdrop-filter:blur(6px);
  `;
  el.innerHTML = `
    <div style="background:#0d1117;border:2px solid #ffa726;border-radius:20px;
                padding:40px;max-width:440px;width:90%;text-align:center;
                box-shadow:0 0 60px rgba(255,167,38,0.25);">
      <div style="font-size:48px;margin-bottom:16px;">⚠️</div>
      <h2 style="font-family:'Space Grotesk',sans-serif;font-size:22px;
                 font-weight:800;color:#ffa726;margin:0 0 12px;">
        Tab Switch Detected
      </h2>
      <p style="color:#9ca3af;font-size:13px;line-height:1.6;margin:0 0 8px;">
        Please stay on this tab during your interview.
      </p>
      <p style="color:#6b7280;font-size:12px;margin:0 0 28px;">
        <strong style="color:#ffa726;">This is your only warning.</strong>
        Switching tabs again will immediately terminate your session.
      </p>
      <button onclick="acDismiss()" style="
        background:linear-gradient(135deg,#ffa726,#ff8c00);
        color:#000;border:none;border-radius:12px;
        padding:12px 32px;font-family:'Space Grotesk',sans-serif;
        font-weight:800;font-size:14px;cursor:pointer;
        box-shadow:0 4px 20px rgba(255,167,38,0.3);">
        I Understand — Resume Interview
      </button>
    </div>`;
  document.body.appendChild(el);
}

/* ── Terminate overlay (strike 2) — no button, auto-submits ── */
function _showTerminate() {
  const old = document.getElementById('ac-overlay');
  if (old) old.remove();

  const el = document.createElement('div');
  el.id = 'ac-overlay';
  el.style.cssText = `
    position:fixed;inset:0;z-index:9999;
    display:flex;align-items:center;justify-content:center;
    background:rgba(0,0,0,0.92);backdrop-filter:blur(8px);
  `;
  el.innerHTML = `
    <div style="background:#0d1117;border:2px solid #ff4d6d;border-radius:20px;
                padding:40px;max-width:440px;width:90%;text-align:center;
                box-shadow:0 0 80px rgba(255,77,109,0.4);">
      <div style="font-size:48px;margin-bottom:16px;">🚫</div>
      <h2 style="font-family:'Space Grotesk',sans-serif;font-size:22px;
                 font-weight:800;color:#ff4d6d;margin:0 0 12px;">
        Session Terminated
      </h2>
      <p style="color:#9ca3af;font-size:13px;line-height:1.6;margin:0 0 8px;">
        You switched tabs a second time during the interview.
      </p>
      <p style="color:#6b7280;font-size:12px;margin:0 0 24px;">
        Unanswered questions scored <strong style="color:#ff4d6d;">0</strong>.
        Your completed answers have been saved.
      </p>
      <div style="background:rgba(255,77,109,0.08);border:1px solid rgba(255,77,109,0.25);
                  border-radius:10px;padding:12px 16px;margin-bottom:16px;">
        <div style="font-size:12px;color:#ff4d6d;font-family:'DM Mono',monospace;margin-bottom:8px;">
          ⚡ Submitting session...
        </div>
        <div style="height:4px;background:#1f2937;border-radius:2px;overflow:hidden;">
          <div id="ac-progress-bar" style="height:100%;width:0%;
               background:linear-gradient(90deg,#ff4d6d,#ffa726);
               border-radius:2px;transition:width 3s linear;"></div>
        </div>
      </div>
      <p style="color:#4b5563;font-size:11px;">Redirecting automatically...</p>
    </div>`;

  document.body.appendChild(el);

  // Animate the progress bar filling over 3 seconds
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const bar = document.getElementById('ac-progress-bar');
      if (bar) bar.style.width = '100%';
    });
  });
}

function acDismiss() {
  const el = document.getElementById('ac-overlay');
  if (el) el.remove();
  _acCooldown = false;  // reset so next strike can fire
}

/* ── Single strike handler — cooldown prevents double-fire ── */
function _handleStrike() {
  if (!_acActive || _acTerminated) return;

  // 500ms cooldown — stops visibilitychange + blur firing at the same time
  if (_acCooldown) return;
  _acCooldown = true;
  setTimeout(() => { _acCooldown = false; }, 500);

  _acStrikes++;

  if (_acStrikes === 1) {
    _showWarning();

  } else {
    // Strike 2 — terminate immediately, no user action needed
    _acTerminated = true;
    _acActive     = false;
    _showTerminate();

    // Auto-submit after 4 seconds (gives overlay time to fully render + be seen)
    setTimeout(async () => {
      if (typeof acTerminateSession === 'function') {
        await acTerminateSession();
      }
    }, 4000);
  }
}

/* ── Listeners ── */
document.addEventListener('visibilitychange', () => {
  if (_acIgnoreNextBlur) return;  // mic/camera permission popup
  if (document.visibilityState === 'hidden') _handleStrike();
});

window.addEventListener('blur', () => {
  // Skip if a browser permission dialog is expected (mic popup etc.)
  if (_acIgnoreNextBlur) return;
  // Only count blur when tab is still visible (pure alt-tab / window switch)
  if (document.visibilityState === 'visible') _handleStrike();
});