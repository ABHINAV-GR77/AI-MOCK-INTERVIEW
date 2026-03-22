/* ═══════════════════════════════════════════════
   NavLock — Navigation Lock Module
   Fully locks the user to the current page
   during an active interview session.
   ═══════════════════════════════════════════════ */

const NavLock = (function () {

  let _locked = false;

  /* ── Toast message ── */
  function _showToast() {
    if (document.getElementById('navlock-toast')) return;
    const el = document.createElement('div');
    el.id = 'navlock-toast';
    el.style.cssText = [
      'position:fixed', 'top:20px', 'left:50%',
      'transform:translateX(-50%)',
      'background:#0d1117',
      'border:1px solid #ffa726',
      'border-radius:10px',
      'padding:10px 24px',
      'color:#ffa726',
      'font-size:13px',
      'font-family:"Space Grotesk",sans-serif',
      'font-weight:600',
      'z-index:2147483647',
      'pointer-events:none',
      'white-space:nowrap',
    ].join(';');
    el.textContent = '⚠ Finish your interview before navigating away';
    document.body.appendChild(el);
    setTimeout(() => { if (el.parentNode) el.remove(); }, 2500);
  }

  /* ── 1. Click capture — intercepts ALL link clicks ── */
  function _clickGuard(e) {
    if (!_locked) return;
    const link = e.target.closest('a[href]');
    if (!link) return;
    const href = link.getAttribute('href');
    if (!href || href === '#' || href.startsWith('javascript') || href.includes('/logout')) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    _showToast();
  }

  /* ── 2. beforeunload — browser close / refresh / tab close ── */
  function _unloadGuard(e) {
    if (!_locked) return;
    e.preventDefault();
    e.returnValue = 'Your interview session is still active. Are you sure you want to leave?';
    return e.returnValue;
  }

  /* ── 3. popstate — browser back/forward buttons ── */
  function _popGuard(e) {
    if (!_locked) return;
    // Push a dummy state back so back button does nothing
    history.pushState(null, '', window.location.href);
    _showToast();
  }

  /* ── 4. Patch history.pushState and replaceState ── */
  const _origPush    = history.pushState.bind(history);
  const _origReplace = history.replaceState.bind(history);

  function _patchHistory() {
    history.pushState = function (...args) {
      if (_locked) { _showToast(); return; }
      return _origPush(...args);
    };
    history.replaceState = function (...args) {
      if (_locked) { _showToast(); return; }
      return _origReplace(...args);
    };
  }

  function _unpatchHistory() {
    history.pushState    = _origPush;
    history.replaceState = _origReplace;
  }

  /* ── 5. Dim sidebar links visually ── */
  function _dimSidebar() {
    document.querySelectorAll('.nav-link, aside a[href]').forEach(a => {
      const href = a.getAttribute('href') || '';
      if (href.includes('/logout') || href.startsWith('javascript')) return;
      a.style.opacity    = '0.25';
      a.style.cursor     = 'not-allowed';
      a.title            = 'Finish your interview first';
    });
  }

  function _undimSidebar() {
    document.querySelectorAll('.nav-link, aside a[href]').forEach(a => {
      a.style.opacity = '';
      a.style.cursor  = '';
      a.title         = '';
    });
  }

  /* ── Public API ── */

  function lock() {
    if (_locked) return;
    _locked = true;

    // Push a dummy history entry so back button hits it first
    history.pushState(null, '', window.location.href);

    _patchHistory();
    _dimSidebar();

    document.addEventListener('click',       _clickGuard,  true);
    window.addEventListener  ('beforeunload', _unloadGuard);
    window.addEventListener  ('popstate',     _popGuard);
  }

  function unlock() {
    if (!_locked) return;
    _locked = false;

    _unpatchHistory();
    _undimSidebar();

    document.removeEventListener('click',       _clickGuard,  true);
    window.removeEventListener  ('beforeunload', _unloadGuard);
    window.removeEventListener  ('popstate',     _popGuard);

    const toast = document.getElementById('navlock-toast');
    if (toast) toast.remove();
  }

  function isLocked() { return _locked; }

  return { lock, unlock, isLocked };

})();
