/* ═══════════════════════════════════════════════
   InterviewAI — Dashboard
   ═══════════════════════════════════════════════ */

/* ── Dashboard inline AI Chat ── */
var dashHistory = [], dashLoading = false;
if (typeof marked !== 'undefined') marked.setOptions({ breaks: true, gfm: true });

function dashAutoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 80) + 'px';
}
function dashHandleKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); dashSendMessage(); }
}
function dashSendChip(text) {
  document.getElementById('dash-chat-input').value = text;
  dashSendMessage();
}
function dashScrollBottom() {
  var c = document.getElementById('dash-chat-messages');
  c.scrollTop = c.scrollHeight;
}
function dashAppendMessage(role, content) {
  var container = document.getElementById('dash-chat-messages');
  var isAI = role === 'assistant';
  var wrap = document.createElement('div');
  wrap.className = 'flex gap-3 mb-5 dash-msg';
  var icon = isAI
    ? '<div class="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5" style="background:linear-gradient(135deg,rgba(0,229,255,0.15),rgba(123,97,255,0.15));border:1px solid rgba(0,229,255,0.2)"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#00e5ff" stroke-width="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div>'
    : '<div class="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-bold" style="background:rgba(123,97,255,0.15);border:1px solid rgba(123,97,255,0.25);color:#7b61ff">You</div>';
  var label = isAI
    ? '<div class="text-xs font-bold mb-1.5" style="color:#00e5ff">InterviewAI Coach</div>'
    : '<div class="text-xs font-bold mb-1.5" style="color:#7b61ff">You</div>';
  var body = isAI
    ? '<div class="dash-prose text-sm" style="max-width:none">' + (typeof marked !== 'undefined' ? marked.parse(content) : content) + '</div>'
    : '<div class="text-sm" style="color:#d1d5db;line-height:1.7">' + content.replace(/\n/g,'<br>') + '</div>';
  wrap.innerHTML = icon + '<div class="flex-1">' + label + body + '</div>';
  container.appendChild(wrap);
  dashScrollBottom();
}
function dashShowTyping() {
  var container = document.getElementById('dash-chat-messages');
  var wrap = document.createElement('div');
  wrap.id = 'dash-typing';
  wrap.className = 'flex gap-3 mb-5';
  wrap.innerHTML = '<div class="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0" style="background:linear-gradient(135deg,rgba(0,229,255,0.15),rgba(123,97,255,0.15));border:1px solid rgba(0,229,255,0.2)"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#00e5ff" stroke-width="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div><div class="flex items-center gap-1.5 mt-2"><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span></div>';
  container.appendChild(wrap);
  dashScrollBottom();
}
function dashHideTyping() { var el = document.getElementById('dash-typing'); if (el) el.remove(); }
async function dashSendMessage() {
  if (dashLoading) return;
  var input = document.getElementById('dash-chat-input');
  var message = input.value.trim();
  if (!message) return;
  input.value = ''; input.style.height = 'auto';
  dashLoading = true;
  var btn = document.getElementById('dash-send-btn');
  btn.style.opacity = '0.5'; btn.disabled = true;
  dashAppendMessage('user', message);
  dashHistory.push({ role: 'user', content: message });
  dashShowTyping();
  try {
    var res = await fetch('/ai-chat/message', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: message, history: dashHistory.slice(0, -1) })
    });
    var data = await res.json();
    dashHideTyping();
    var reply = data.reply || '⚠ Something went wrong. Please try again.';
    dashAppendMessage('assistant', reply);
    dashHistory.push({ role: 'assistant', content: reply });
  } catch(e) {
    dashHideTyping();
    dashAppendMessage('assistant', '⚠ Network error: ' + e.message);
  }
  dashLoading = false; btn.style.opacity = '1'; btn.disabled = false; input.focus();
}
function dashClearChat() {
  dashHistory = [];
  var c = document.getElementById('dash-chat-messages');
  c.innerHTML = '';
  var wrap = document.createElement('div');
  wrap.className = 'flex gap-3 mb-5';
  wrap.innerHTML = '<div class="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5" style="background:linear-gradient(135deg,rgba(0,229,255,0.15),rgba(123,97,255,0.15));border:1px solid rgba(0,229,255,0.2)"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#00e5ff" stroke-width="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div><div class="flex-1"><div class="text-xs font-bold mb-1.5" style="color:#00e5ff">InterviewAI Coach</div><div class="text-sm" style="color:#9ca3af">Chat cleared. Ask me anything!</div></div>';
  c.appendChild(wrap);
}

/* ═══════════════════ DASHBOARD ═══════════════════ */
var allSessions = [], perfFilter = 5;
var curMonth = new Date().getMonth(), curYear = new Date().getFullYear();
var difficulties = {technical:'easy',behavioral:'easy',system_design:'easy',product_sense:'easy'};

var $  = id => document.getElementById(id);
var tx = (id, v) => { if ($(id)) $(id).textContent = v; };

function setGreeting(email) {
  var n = (email||'').split('@')[0];
  var d = n.charAt(0).toUpperCase()+n.slice(1);
  tx('greeting-name',d); tx('user-display-name',d);
  if ($('user-avatar')) $('user-avatar').textContent = d.charAt(0).toUpperCase();
}
function setDiff(type,level,btn){
  difficulties[type]=level;
  btn.closest('.flex').querySelectorAll('.diff-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
}
function startInterview(type){
  sessionStorage.setItem('interview_difficulty',difficulties[type]||'easy');
  window.location.href=`/interview/${type}`;
}
function quickStart(){
  var t=['technical','behavioral','system_design','product_sense'];
  var r=t[Math.floor(Math.random()*t.length)];
  sessionStorage.setItem('interview_difficulty',difficulties[r]||'easy');
  window.location.href=`/interview/${r}`;
}
function setPerfFilter(n,btn){
  perfFilter=n;
  document.querySelectorAll('.perf-filter').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  drawPerfChart();
}
function changeMonth(dir){
  curMonth+=dir;
  if(curMonth>11){curMonth=0;curYear++;}
  if(curMonth<0){curMonth=11;curYear--;}
  drawMonthly();
}

async function loadDashboard() {
  try {
    var res = await fetch('/dashboard/stats',{credentials:'include'});
    if (!res.ok) return;
    var d = await res.json();

    if (d.email) {
      setGreeting(d.email);
      var name = d.email.split('@')[0];
      tx('drop-name', name.charAt(0).toUpperCase()+name.slice(1));
      tx('drop-email', d.email);
    }
    tx('stat-sessions', d.total_sessions??0);
    tx('stat-avg',      d.avg_score ? d.avg_score+'%' : '—');
    tx('stat-streak',   (d.streak??0)+' day'+((d.streak===1)?'':'s'));
    tx('stat-time',     (d.practice_hours??0)+'h');
    if (d.total_sessions>0) tx('greeting-sub',`You've completed ${d.total_sessions} session${d.total_sessions>1?'s':''}. Keep it up! 🚀`);

    var total = d.total_sessions||0;
    tx('interviews-total', total);
    if ($('donut-alltime')) {
      var pct = Math.min(total/50,1);
      $('donut-alltime').style.strokeDashoffset = 138.2 - pct*138.2;
      tx('donut-pct', Math.round(pct*100)+'%');
    }
    var wAgo = new Date(Date.now()-7*86400000);
    var wk   = (d.recent_sessions||[]).filter(s=>s.date&&new Date(s.date)>=wAgo).length;
    tx('interviews-week', wk);
    tx('week-sub', wk>0 ? `${wk} session${wk>1?'s':''} this week 🔥` : 'Take your first interview!');

    var sp = d.skill_progress||{};
    tx('score-overall',    d.avg_score      ? d.avg_score+'%'      : '—');
    tx('score-technical',  sp.technical     ? sp.technical+'%'     : '—');
    tx('score-behavioral', sp.behavioral    ? sp.behavioral+'%'    : '—');
    tx('score-system',     sp.system_design ? sp.system_design+'%' : '—');

    var list = $('sessions-list');
    if (list && d.recent_sessions?.length) {
      var C={technical:'#00e5ff',behavioral:'#7b61ff',system_design:'#ff4d6d',product_sense:'#ffa726'};
      var L={technical:'💻 Technical',behavioral:'🧠 Behavioral',system_design:'📐 System Design',product_sense:'🚀 Product Sense'};
      list.innerHTML = d.recent_sessions.map(s=>{
        var t=(s.interview_type||'').replace('voice_','');
        var sc=s.score??0, col=sc>=80?'#00e676':sc>=60?'#ffa726':'#ff4d6d';
        return `<a href="${s.session_id?'/interview/results/'+s.session_id:'#'}" class="session-item">
          <div style="display:flex;align-items:center;gap:12px">
            <div style="width:8px;height:8px;border-radius:50%;background:${C[t]||'#00e5ff'};flex-shrink:0"></div>
            <div><div style="font-size:13px;font-weight:600;color:#f9fafb">${L[t]||t}</div>
            <div style="font-size:11px;color:#6b7280">${s.date?new Date(s.date).toLocaleDateString():''} · ${s.duration_minutes||0} min</div></div>
          </div>
          <div style="font-size:14px;font-weight:700;color:${col}">${sc}%</div>
        </a>`;
      }).join('');
    }

    allSessions = d.recent_sessions||[];
    try {
      var ar = await fetch('/analytics/data',{credentials:'include'});
      if (ar.ok) {
        var ad = await ar.json();
        if (ad.recent?.length) allSessions=[...ad.recent].reverse();
      }
    } catch(_){}

    setTimeout(()=>{drawPerfChart();drawMonthly();},50);
  } catch(e){console.error('[Dashboard]',e);}
}

function drawPerfChart() {
  var canvas = $('perf-chart');
  if (!canvas) return;
  if (canvas.offsetWidth===0){setTimeout(drawPerfChart,100);return;}
  var data = (perfFilter===0?allSessions:allSessions.slice(-perfFilter)).filter(s=>s.score!=null);
  var empty = $('perf-empty');
  if (!data.length){canvas.style.display='none';if(empty)empty.style.display='block';return;}
  canvas.style.display='block';if(empty)empty.style.display='none';
  var dpr=window.devicePixelRatio||1, W=canvas.offsetWidth, H=canvas.offsetHeight||200;
  canvas.width=W*dpr;canvas.height=H*dpr;
  var ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);
  var p={t:10,r:20,b:32,l:36},cW=W-p.l-p.r,cH=H-p.t-p.b;
  ctx.clearRect(0,0,W,H);
  [0,25,50,75,100].forEach(v=>{
    var y=p.t+cH-(v/100)*cH;
    ctx.strokeStyle='#1a2332';ctx.lineWidth=1;ctx.setLineDash([4,4]);
    ctx.beginPath();ctx.moveTo(p.l,y);ctx.lineTo(W-p.r,y);ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle='#374151';ctx.font='9px DM Mono,monospace';ctx.textAlign='right';
    ctx.fillText(v,p.l-6,y+3);
  });
  var xStep=cW/Math.max(data.length-1,1);
  var line=(getVal,color)=>{
    var pts=data.map((s,i)=>({x:p.l+i*xStep,y:p.t+cH-(((getVal(s)||0)/100)*cH),v:getVal(s)})).filter(pt=>pt.v!=null);
    if(!pts.length)return;
    ctx.strokeStyle=color;ctx.lineWidth=2.5;ctx.lineJoin='round';ctx.lineCap='round';
    ctx.shadowColor=color;ctx.shadowBlur=8;
    if(pts.length>1){
      ctx.beginPath();ctx.moveTo(pts[0].x,pts[0].y);
      for(var i=1;i<pts.length;i++){var mx=(pts[i-1].x+pts[i].x)/2;ctx.bezierCurveTo(mx,pts[i-1].y,mx,pts[i].y,pts[i].x,pts[i].y);}
      ctx.stroke();
    }
    ctx.shadowBlur=0;
    pts.forEach(pt=>{ctx.beginPath();ctx.arc(pt.x,pt.y,4,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();ctx.strokeStyle='#0d1117';ctx.lineWidth=2;ctx.stroke();});
  };
  line(s=>s.score,'#00e5ff');
  line(s=>(s.interview_type||'').replace('voice_','')==='technical'?s.score:null,'#7b61ff');
  line(s=>(s.interview_type||'').replace('voice_','')==='behavioral'?s.score:null,'#00e676');
  line(s=>(s.interview_type||'').replace('voice_','')==='system_design'?s.score:null,'#ffa726');
  ctx.fillStyle='#4b5563';ctx.font='9px DM Mono,monospace';ctx.textAlign='center';
  data.forEach((s,i)=>ctx.fillText(s.date?new Date(s.date).toLocaleDateString('en',{month:'short',day:'numeric'}):'S'+(i+1),p.l+i*xStep,H-4));
}

function drawMonthly(){
  var M=['January','February','March','April','May','June','July','August','September','October','November','December'];
  tx('month-label',M[curMonth]+' '+curYear);
  var inM=allSessions.filter(s=>{if(!s.date)return false;var d=new Date(s.date);return d.getMonth()===curMonth&&d.getFullYear()===curYear;});
  var c={technical:0,behavioral:0,system_design:0,voice:0};
  inM.forEach(s=>{var t=s.interview_type||'';if(t.startsWith('voice_'))c.voice++;else if(t in c)c[t]++;});
  tx('leg-technical',c.technical);tx('leg-behavioral',c.behavioral);tx('leg-system',c.system_design);tx('leg-voice',c.voice);
  var total=inM.length;tx('monthly-count',total||'N/A');
  var ring=$('monthly-ring');if(!ring)return;
  ring.style.strokeDashoffset=351.9-Math.min(total/20,1)*351.9;
  var CM={technical:'#00e5ff',behavioral:'#7b61ff',system_design:'#ff4d6d',voice:'#ffa726'};
  var top=Object.entries(c).sort((a,b)=>b[1]-a[1])[0];
  ring.style.stroke=total>0?(CM[top[0]]||'#00e5ff'):'#1f2937';
}

document.addEventListener('DOMContentLoaded', loadDashboard);
window.addEventListener('resize', drawPerfChart);


/* ── User Avatar Dropdown ─────────────────────── */
document.addEventListener('DOMContentLoaded', function() {
  fetch('/profile/data', {credentials:'include'})
    .then(function(r){ return r.json(); })
    .then(function(d){
      var name = d.name || (d.email||'').split('@')[0] || '?';
      var btn = document.getElementById('avatar-btn');
      var n = document.getElementById('av-name');
      var e = document.getElementById('av-email');
      if(btn) btn.textContent = name.charAt(0).toUpperCase();
      if(n) n.textContent = name;
      if(e) e.textContent = d.email || '';
    }).catch(function(){});

  document.addEventListener('click', function(e){
    var drop = document.getElementById('avatar-drop');
    var btn = document.getElementById('avatar-btn');
    if(drop && btn && !btn.contains(e.target) && !drop.contains(e.target)){
      drop.style.display = 'none';
    }
  });
});

function toggleAvatarDrop(){
  var d = document.getElementById('avatar-drop');
  var btn = document.getElementById('avatar-btn');
  if(!d || !btn) return;
  if(d.style.display === 'block') { d.style.display = 'none'; return; }
  var rect = btn.getBoundingClientRect();
  d.style.top = (rect.bottom + window.scrollY + 8) + 'px';
  d.style.right = (window.innerWidth - rect.right) + 'px';
  d.style.position = 'absolute';
  d.style.display = 'block';
}

/* ── Feedback Modal ─────────────────────── */
function openFeedback() {
  var d = document.getElementById('avatar-drop');
  if(d) d.style.display = 'none';
  var ex = document.getElementById('feedback-modal');
  if(ex) ex.remove();
  var modal = document.createElement('div');
  modal.id = 'feedback-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:999999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.7);backdrop-filter:blur(4px)';
  modal.innerHTML = `<div style="background:#0d1117;border:1px solid #1f2937;border-radius:20px;padding:28px;width:100%;max-width:440px;max-height:90vh;overflow-y:auto;position:relative">
    <button onclick="closeFeedback()" style="position:absolute;top:16px;right:16px;background:transparent;border:none;color:#6b7280;cursor:pointer;font-size:20px">✕</button>
    <div style="font-family:'Space Grotesk',sans-serif;font-weight:800;font-size:16px;color:#fff;margin-bottom:4px">Share Feedback</div>
    <div style="font-size:11px;color:#6b7280;margin-bottom:20px">Help us improve InterviewAI</div>
    <textarea id="fb-text" placeholder="Tell us what you think..." style="width:100%;background:rgba(255,255,255,0.02);border:1px solid #1f2937;border-radius:10px;padding:12px;color:#fff;font-family:'DM Mono',monospace;font-size:13px;line-height:1.6;resize:vertical;min-height:120px;outline:none;box-sizing:border-box" onfocus="this.style.borderColor='rgba(0,229,255,0.3)'" onblur="this.style.borderColor='#1f2937'"></textarea>
    <button onclick="submitFeedback()" id="fb-submit-btn" style="width:100%;margin-top:16px;padding:13px;border-radius:12px;background:linear-gradient(135deg,#00e5ff,#7b61ff);color:#000;font-family:'Space Grotesk',sans-serif;font-weight:800;font-size:14px;border:none;cursor:pointer">Send Feedback</button>
  </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', function(e){ if(e.target===modal) closeFeedback(); });
}
function closeFeedback(){ var m=document.getElementById('feedback-modal'); if(m) m.remove(); }
function submitFeedback(){
  var text=document.getElementById('fb-text').value.trim();
  if(!text){ document.getElementById('fb-text').style.borderColor='#ff4d6d'; return; }
  var btn=document.getElementById('fb-submit-btn');
  btn.textContent='Sending...'; btn.disabled=true;
  fetch('/feedback',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:text})})
    .then(function(){ closeFeedback(); }).catch(function(){ closeFeedback(); });
}