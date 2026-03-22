/* ═══════════════════════════════════════════════
   InterviewAI — AI Chat
   ═══════════════════════════════════════════════ */

let history   = [];
let isLoading = false;

marked.setOptions({ breaks: true, gfm: true });

/* ── Helpers ── */
function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 140) + 'px';
}

function handleKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

function sendChip(text) {
  document.getElementById('chat-input').value = text;
  sendMessage();
}

function scrollToBottom() {
  const c = document.getElementById('chat-messages');
  c.scrollTop = c.scrollHeight;
}

/* ── Render a message bubble ── */
function appendMessage(role, content) {
  const container = document.getElementById('chat-messages');
  const isAI = role === 'assistant';

  const wrap = document.createElement('div');
  wrap.className = 'flex gap-4 mb-6 msg';

  const icon = isAI
    ? `<div class="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5" style="background:linear-gradient(135deg,rgba(0,229,255,0.15),rgba(123,97,255,0.15));border:1px solid rgba(0,229,255,0.2)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00e5ff" stroke-width="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
       </div>`
    : `<div class="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-bold" style="background:rgba(123,97,255,0.15);border:1px solid rgba(123,97,255,0.2);color:#7b61ff">You</div>`;

  const label = isAI
    ? `<div class="text-xs font-bold mb-2" style="color:#00e5ff">InterviewAI Coach</div>`
    : `<div class="text-xs font-bold mb-2" style="color:#7b61ff">You</div>`;

  const body = isAI
    ? `<div class="prose" style="max-width:640px">${marked.parse(content)}</div>`
    : `<div class="text-sm leading-relaxed" style="color:#d1d5db;max-width:640px">${content.replace(/\n/g,'<br>')}</div>`;

  wrap.innerHTML = `${icon}<div class="flex-1">${label}${body}</div>`;
  container.appendChild(wrap);
  scrollToBottom();
}

/* ── Typing indicator ── */
function showTyping() {
  const container = document.getElementById('chat-messages');
  const wrap = document.createElement('div');
  wrap.id = 'typing-indicator';
  wrap.className = 'flex gap-4 mb-6 msg';
  wrap.innerHTML = `
    <div class="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style="background:linear-gradient(135deg,rgba(0,229,255,0.15),rgba(123,97,255,0.15));border:1px solid rgba(0,229,255,0.2)">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00e5ff" stroke-width="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
    </div>
    <div class="flex items-center gap-1.5 mt-2">
      <span class="typing-dot"></span>
      <span class="typing-dot"></span>
      <span class="typing-dot"></span>
    </div>`;
  container.appendChild(wrap);
  scrollToBottom();
}

function hideTyping() {
  const el = document.getElementById('typing-indicator');
  if (el) el.remove();
}

/* ── Send message ── */
async function sendMessage() {
  if (isLoading) return;
  const input = document.getElementById('chat-input');
  const message = input.value.trim();
  if (!message) return;

  input.value = '';
  input.style.height = 'auto';
  isLoading = true;

  const btn = document.getElementById('send-btn');
  btn.style.opacity = '0.5';
  btn.disabled = true;

  appendMessage('user', message);
  history.push({ role: 'user', content: message });
  showTyping();

  try {
    const res = await fetch('/ai-chat/message', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, history: history.slice(0, -1) })
    });
    const data = await res.json();
    hideTyping();

    if (data.reply) {
      appendMessage('assistant', data.reply);
      history.push({ role: 'assistant', content: data.reply });
    } else {
      appendMessage('assistant', '⚠ Something went wrong. Please try again.');
    }
  } catch(e) {
    hideTyping();
    appendMessage('assistant', '⚠ Network error: ' + e.message);
  }

  isLoading = false;
  btn.style.opacity = '1';
  btn.disabled = false;
  input.focus();
}

/* ── Clear chat ── */
function clearChat() {
  history = [];
  const container = document.getElementById('chat-messages');
  container.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'flex gap-4 mb-6 msg';
  wrap.innerHTML = `
    <div class="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5" style="background:linear-gradient(135deg,rgba(0,229,255,0.15),rgba(123,97,255,0.15));border:1px solid rgba(0,229,255,0.2)">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00e5ff" stroke-width="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
    </div>
    <div class="flex-1">
      <div class="text-xs font-bold mb-2" style="color:#00e5ff">InterviewAI Coach</div>
      <div class="prose"><p style="color:#9ca3af">Chat cleared. Ask me anything!</p></div>
    </div>`;
  container.appendChild(wrap);
}

/* ── Init ── */
document.getElementById('chat-input').focus();
