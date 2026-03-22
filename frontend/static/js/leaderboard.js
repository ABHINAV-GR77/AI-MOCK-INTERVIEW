const MEDAL_COLORS = [
  { border:'#ffa726', glow:'rgba(255,167,38,0.2)',  text:'#ffa726', bg:'rgba(255,167,38,0.06)',  label:'1ST' },
  { border:'#9ca3af', glow:'rgba(156,163,175,0.15)', text:'#9ca3af', bg:'rgba(156,163,175,0.05)', label:'2ND' },
  { border:'#cd7c2f', glow:'rgba(205,124,47,0.15)',  text:'#cd7c2f', bg:'rgba(205,124,47,0.05)',  label:'3RD' },
];
const CROWN_SVG = `<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M2 19h20v2H2v-2zM2 9l5 4 5-7 5 7 5-4-2 8H4L2 9z"/></svg>`;

function scoreColor(s) {
  return s >= 80 ? '#00e676' : s >= 60 ? '#ffa726' : '#ff4d6d';
}

function avatarLetter(display) {
  return (display || '?').charAt(0).toUpperCase();
}

async function loadLB() {
  try {
    const rows = await fetch('/leaderboard/data', { credentials:'include' }).then(r => r.json());
    if (!Array.isArray(rows) || rows.length === 0) {
      document.getElementById('lb-tbody').innerHTML = `<tr><td colspan="4" class="px-6 py-10 text-center text-muted text-xs">No rankings yet — complete an interview to appear here!</td></tr>`;
      return;
    }

    document.getElementById('total-count').textContent = rows.length + ' users ranked';

    // ── Podium ──
    const podium = document.getElementById('podium');
    const top3 = rows.slice(0, 3);
    const order = top3.length === 3 ? [1, 0, 2] : top3.length === 2 ? [1, 0] : [0];

    podium.innerHTML = order.map(idx => {
      const r = top3[idx];
      if (!r) return '<div></div>';
      const m = MEDAL_COLORS[idx];
      const isFirst = idx === 0;
      return `
        <div class="relative rounded-2xl p-5 text-center overflow-hidden ${isFirst ? 'mb-0' : 'mt-6'}" style="background:${m.bg};border:1px solid ${m.border};box-shadow:0 0 30px ${m.glow};">
          <div class="scan-line" style="background:linear-gradient(90deg,transparent,${m.border},transparent)"></div>
          ${isFirst ? `<div class="crown mb-1" style="color:${m.text}">${CROWN_SVG}</div>` : ''}
          <div class="w-14 h-14 rounded-full flex items-center justify-center font-grotesk font-black text-xl text-bg mx-auto mb-3 relative" style="background:linear-gradient(135deg,${m.border},${m.border}88)">
            ${avatarLetter(r.display)}
            <div class="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-xs font-black" style="background:${m.border};color:#060a0f">${idx+1}</div>
          </div>
          <div class="font-grotesk font-bold text-sm text-white mb-1 truncate">${r.display}</div>
          <div class="font-grotesk text-2xl font-black mb-1" style="color:${m.text}">${r.avg_score}%</div>
          <div class="text-xs text-muted">${r.total_sessions} session${r.total_sessions !== 1 ? 's' : ''}</div>
          <div class="mt-3 inline-block px-3 py-1 rounded-full text-xs font-black tracking-widest" style="background:${m.border}22;color:${m.text};border:1px solid ${m.border}44">${m.label}</div>
        </div>`;
    }).join('');

    // ── Table ──
    document.getElementById('lb-tbody').innerHTML = rows.map((r, i) => {
      const isTop3 = i < 3;
      const rankColor = i === 0 ? '#ffa726' : i === 1 ? '#9ca3af' : i === 2 ? '#cd7c2f' : '#6b7280';
      const sc = scoreColor(r.avg_score);
      const isMe = window._currentUser && r.email === window._currentUser;
      const meBg = isMe ? 'background:rgba(0,229,255,0.04);' : '';
      return `
        <tr class="lb-row border-b border-border/40" style="${meBg}">
          <td class="px-6 py-3.5">
            <span class="font-grotesk font-black text-sm" style="color:${rankColor}">${isTop3 ? ['🥇','🥈','🥉'][i] : '#'+(i+1)}</span>
          </td>
          <td class="px-6 py-3.5">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-full flex items-center justify-center font-grotesk font-black text-xs text-bg flex-shrink-0" style="background:linear-gradient(135deg,${sc},${sc}88)">${avatarLetter(r.display)}</div>
              <div class="font-grotesk font-bold text-sm text-white">${r.display}${isMe ? ' <span style="font-size:10px;color:#00e5ff;">(you)</span>' : ''}</div>
            </div>
          </td>
          <td class="px-6 py-3.5 text-right text-muted text-xs">${r.total_sessions}</td>
          <td class="px-6 py-3.5 text-right">
            <span class="font-grotesk font-black text-sm px-3 py-1 rounded-full" style="background:${sc}18;color:${sc}">${r.avg_score}%</span>
          </td>
        </tr>`;
    }).join('');

    // ── My rank banner ──
    if (window._currentUser) {
      const myIdx = rows.findIndex(r => r.email === window._currentUser);
      if (myIdx !== -1) {
        const me = rows[myIdx];
        document.getElementById('my-rank-banner').classList.remove('hidden');
        document.getElementById('my-avatar').textContent    = avatarLetter(me.display);
        document.getElementById('my-name').textContent      = me.display;
        document.getElementById('my-rank').textContent      = '#' + (myIdx + 1);
        document.getElementById('my-score').textContent     = me.avg_score + '%';
        document.getElementById('my-sessions').textContent  = me.total_sessions;
      }
    }

  } catch(e) { console.error(e); }
}

loadLB();
