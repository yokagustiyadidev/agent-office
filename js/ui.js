// js/ui.js — sidebar, tab, modal, toast, log, chart aktivitas, spawn form
import { state, API_URL, ROLE_CONFIG } from './config.js';
import { playClick } from './effects.js';
import { focusAgent } from './hover.js';
import { onResize } from './scene.js';

// ---------- UI ----------
export function initials(name) {
    return String(name).split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

export function switchTab(name) {
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.textContent.toLowerCase().includes(name === 'agents' ? 'agen' : name)));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.getElementById(`tab-${name}`).classList.add('active');
    if (name === 'logs') drawActivityChart();
    playClick();
}

// ---------- Fase 5: grafik aktivitas spawn per jam ----------
let activityTimer = null;
export function drawActivityChart() {
    const cv = document.getElementById('activity-chart');
    if (!cv) return;
    fetch(`${API_URL}/api/activity`).then(r => r.json()).then(j => {
        const data = j.hours || [];
        const ctx = cv.getContext('2d');
        const W = cv.width, H = cv.height;
        ctx.clearRect(0, 0, W, H);
        const pad = { l: 8, r: 8, t: 10, b: 18 };
        const chartW = W - pad.l - pad.r, chartH = H - pad.t - pad.b;
        const max = Math.max(1, ...data.map(h => h.spawns));
        const bw = chartW / data.length;

        // grid baseline
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.beginPath(); ctx.moveTo(pad.l, pad.t + chartH); ctx.lineTo(pad.l + chartW, pad.t + chartH); ctx.stroke();

        data.forEach((h, i) => {
            const bh = (h.spawns / max) * (chartH - 6);
            const x = pad.l + i * bw;
            // bar
            ctx.fillStyle = h.spawns ? 'rgba(59,130,246,0.85)' : 'rgba(255,255,255,0.10)';
            const barH = h.spawns ? Math.max(bh, 3) : 2;
            ctx.beginPath();
            ctx.roundRect(x + 1, pad.t + chartH - barH, bw - 2, barH, 2);
            ctx.fill();
            // label jam tiap 4 jam
            if (i % 4 === 0) {
                ctx.fillStyle = '#6b7280';
                ctx.font = '9px system-ui, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(h.label.slice(0, 2), x + bw / 2, H - 4);
            }
        });

        // total badge
        const total = data.reduce((s, h) => s + h.spawns, 0);
        ctx.fillStyle = '#9ca3af';
        ctx.font = '10px system-ui, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`${total} spawn / 24j`, W - pad.r, pad.t + 8);
    }).catch(() => {});
}

export function updateStats() {
    let active = 0;
    state.agents.forEach(a => { if (a.status === 'working') active++; });
    state.stats.active = active;
    document.getElementById('stat-active').textContent = active;
    document.getElementById('stat-completed').textContent = state.stats.completed;
    document.getElementById('stat-total').textContent = state.stats.total;
}

export function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function addGlobalLog(msg) {
    const el = document.getElementById('global-logs');
    const line = document.createElement('div');
    line.className = 'log-line';
    line.innerHTML = `<span class="log-timestamp">[${new Date().toLocaleTimeString('id-ID')}]</span><span class="log-message">${esc(msg)}</span>`;
    el.prepend(line);
    while (el.children.length > 60) el.removeChild(el.lastChild);
    const mini = document.getElementById('mini-log-body');
    if (mini) {
        mini.prepend(line.cloneNode(true));
        while (mini.children.length > 5) mini.removeChild(mini.lastChild);
    }
}

export function toggleSidebar() {
    const c = document.getElementById('container');
    const hidden = c.classList.toggle('sidebar-hidden');
    document.getElementById('sidebar-toggle').textContent = hidden ? '» Panel' : '« Panel';
    const mini = document.getElementById('mini-log');
    if (mini) {
        mini.classList.toggle('hidden', !hidden);
        if (hidden) { syncMiniLog(); mini.classList.remove('minimized'); }
    }
    onResize();
    playClick();
}
export function toggleMiniLog() {
    document.getElementById('mini-log').classList.toggle('minimized');
    playClick();
}
export function syncMiniLog() {
    const src = document.getElementById('global-logs');
    const dst = document.getElementById('mini-log-body');
    if (!src || !dst) return;
    dst.innerHTML = '';
    for (let i = 0; i < Math.min(5, src.children.length); i++) dst.appendChild(src.children[i].cloneNode(true));
}

export function renderAgents() {
    const list = document.getElementById('agent-list');
    if (!state.agents.size) {
        list.innerHTML = '<div class="empty-state">Belum ada agen.<br>Deploy agen pertama untuk mulai.</div>';
        return;
    }
    list.innerHTML = '';
    state.agents.forEach(a => {
        const rc = ROLE_CONFIG[a.role] || ROLE_CONFIG.Developer;
        const card = document.createElement('div');
        card.className = `agent-card ${a.status}`;
        card.onclick = () => { focusAgent(a); openModal(a); playClick(); };
        const place = a.exitWalk ? 'keluar' : (a.exited ? 'sudah keluar' : 'di ruangan');
        card.innerHTML =
            `<div class="agent-header"><div class="agent-avatar" style="background:${rc.css}">${esc(initials(a.name))}</div>` +
            `<div><div class="agent-name">${esc(a.name)}</div><div class="agent-role">${esc(a.role)}</div></div></div>` +
            `<div class="agent-task">${esc(a.task)}</div>` +
            `<div class="agent-footer"><span class="agent-status status-${a.status}">${esc(a.status)}</span>` +
            `<span>${Math.round(a.progress)}%</span></div>` +
            `<div class="agent-progress"><div class="agent-progress-bar" style="width:${a.progress}%"></div></div>` +
            `<div class="agent-place">${place}</div>`;
        list.appendChild(card);
    });
    updateStats();
}

export function openModal(agent) {
    document.getElementById('modal-title').textContent = `${agent.name} — ${agent.role} (${Math.round(agent.progress)}%)`;
    const logs = document.getElementById('modal-logs');
    const out = agent.output ? `<div class="report-block"><div class="report-title">📄 Hasil</div><div class="report-body">${esc(agent.output)}</div></div>` : '';
    const logHtml = (agent.logs && agent.logs.length)
        ? agent.logs.map(l => `<div class="log-line"><span class="log-timestamp">[${esc(l.timestamp)}]</span><span class="log-message">${esc(l.message)}</span></div>`).join('')
        : '<div class="log-line"><span class="log-message">Belum ada aktivitas.</span></div>';
    logs.innerHTML = out + logHtml;
    document.getElementById('modal').classList.add('active');
}

// Completion toast: report visible even when Log tab closed
export function showToast(agent, kind) {
    let box = document.getElementById('toast-box');
    if (!box) {
        box = document.createElement('div');
        box.id = 'toast-box';
        document.body.appendChild(box);
    }
    const el = document.createElement('div');
    el.className = `toast toast-${kind}`;
    const snippet = (agent.output || '').trim().split('\n').slice(0, 3).join('\n').slice(0, 180);
    el.innerHTML =
        `<div class="toast-title">${kind === 'completed' ? '✅' : '❌'} ${esc(agent.name)} ${kind === 'completed' ? 'selesai' : 'gagal'} (${agent.duration ?? '?'} dtk)</div>` +
        (snippet ? `<div class="toast-snippet">${esc(snippet)}</div>` : '') +
        `<div class="toast-action">Klik untuk laporan lengkap</div>`;
    el.onclick = () => { const a = state.agents.get(agent.id); if (a) { focusAgent(a); openModal(a); } el.remove(); playClick(); };
    box.appendChild(el);
    setTimeout(() => { if (el.parentNode) el.remove(); }, 12000);
    while (box.children.length > 3) box.removeChild(box.firstChild);
}
export function closeModal() { document.getElementById('modal').classList.remove('active'); }
document.getElementById('modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });

// ---------- spawn ----------
export async function spawnCustomAgent() {
    const name = document.getElementById('agent-name').value.trim() || `Agent-${Math.floor(Math.random() * 900 + 100)}`;
    const role = document.getElementById('agent-role').value;
    const task = document.getElementById('agent-task').value.trim();
    if (!task) { alert('Deskripsi tugas wajib diisi.'); return; }
    await spawn({ name, role, task });
    document.getElementById('agent-task').value = '';
}

export async function spawnQuick(name, task) {
    const role = /review/i.test(name) ? 'Developer'
        : /bug|test/i.test(name) ? 'QA'
        : /doc/i.test(name) ? 'Manager' : 'DevOps';
    await spawn({ name, role, task });
}

export async function spawnDemoOffice() {
    try {
        const r = await fetch(`${API_URL}/api/demo`, { method: 'POST' });
        const j = await r.json();
        if (j.success) { state.stats.total += 6; updateStats(); switchTab('agents'); }
        else alert('Demo gagal: ' + (j.error || 'unknown'));
    } catch (e) { alert('Backend tidak terjangkau â€” jalankan `npm start`.'); }
}

async function spawn(payload) {
    try {
        const r = await fetch(`${API_URL}/api/spawn`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const j = await r.json();
        if (j.success) { state.stats.total++; updateStats(); switchTab('agents'); }
        else alert('Spawn gagal: ' + (j.error || 'unknown'));
    } catch (e) { alert('Backend tidak terjangkau â€” jalankan `npm start`.'); }
}
