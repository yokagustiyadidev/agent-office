// js/net.js — WebSocket client + handler event agen
import { state, WS_URL, STATUS_CSS } from './config.js';
import { playSpawn, playComplete, scheduleExit, finishExit, findAgent } from './effects.js';
import { Agent3D } from './agents.js';
import { renderAgents, updateStats, addGlobalLog, showToast } from './ui.js';
import { drawTVWall } from './room.js';

// ---------- websocket ----------
export function connectWS() {
    const wsProto = location.protocol === 'https:' ? 'wss' : 'ws';
    const sock = new WebSocket(`${wsProto}://${WS_URL}`);
    state.ws = sock;
    sock.onopen = () => setConn(true);
    sock.onclose = () => { setConn(false); setTimeout(connectWS, 3000); };
    sock.onerror = () => {};
    sock.onmessage = ev => {
        let data; try { data = JSON.parse(ev.data); } catch { return; }
        handleWS(data);
    };
}

export function setConn(ok) {
    const el = document.getElementById('connection-status');
    el.className = ok ? 'connected' : 'disconnected';
    el.querySelector('span').textContent = ok ? 'Terhubung' : 'Terputus';
}

export function handleWS({ type, agent, agentId, agents: list }) {
    switch (type) {
        case 'init':
            (list || []).forEach(a => {
                if (a.status === 'completed' || a.status === 'error') {
                    addRecord(a);   // record saja — jangan hidupkan lagi yang sudah selesai
                } else addAgent(a);
            });
            renderAgents();
            break;
        case 'agent_spawn':
            addAgent(agent); playSpawn();
            addGlobalLog(`${agent.name} mulai â€” "${agent.task}"`);
            break;
        case 'agent_update': updateAgent(agent); if (typeof drawTVWall === 'function') drawTVWall(); break;
        case 'agent_complete':
            updateAgent(agent);
            if (agent.status === 'completed') {
                state.stats.completed++;
                addGlobalLog(`${agent.name} selesai (${agent.duration ?? '?'} dtk)`);
                showToast(agent, 'completed');
            } else if (agent.status === 'error') {
                addGlobalLog(`${agent.name} gagal`);
                showToast(agent, 'error');
            }
            {
                // jangan lenyapkan mendadak — jalankan keluar lewat pintu dulu
                if (agent) scheduleExit(agent.id);
            }
            break;
        case 'agent_removed': {
            const a = findAgent(agentId);
            if (a) {
                if (!a.exitWalk && !a.exitPending) addGlobalLog(`${a.name} keluar kantor`);
                finishExit(a.id);
            }
            break;
        }
    }
    updateStats();
}

export function addAgent(data) {
    if (state.agents.has(data.id)) { updateAgent(data); return; }
    const a = new Agent3D(data);
    state.agents.set(data.id, a);
    a.setStatus(data.status, data.progress);
    if (data.status === 'working') {
        const free = state.desks.filter(d => !d.occupant || d.occupant === a);
        const spot = free.length ? free[0] : state.desks[Math.floor(Math.random() * state.desks.length)];
        a.queue.length = 0;
        a.walkLane(spot.x, spot.z + 1.15);
    }
    renderAgents();
}

// record tanpa mesh: dipakai untuk agen yang sudah selesai / sudah keluar,
// supaya kartu & laporan di sidebar tetap ada tanpa menghidupkan figur lagi.
export function addRecord(data) {
    if (state.agents.has(data.id)) return;
    const a = Object.create(Agent3D.prototype);
    a.id = data.id;
    a.name = data.name;
    a.role = data.role || 'Developer';
    a.task = data.task || '';
    a.status = data.status || 'completed';
    a.progress = data.progress || 100;
    a.logs = data.logs || [];
    a.output = data.output || '';
    a.duration = data.duration;
    a.exitPending = false;
    a.exitWalk = false;
    a.exitWatchdog = null;
    a.disposed = true;   // tidak punya mesh → tidak ikut update/hover/fokus
    a.exited = true;     // sudah tidak ada di ruangan (record/laporan tetap tampil)
    a.group = null;
    state.agents.set(a.id, a);
    return a;
}

export function updateAgent(data) {
    const a = state.agents.get(data.id);
    if (!a) { addAgent(data); return; }
    const taskChanged = data.task && data.task !== a.task;
    a.task = data.task ?? a.task;
    a.logs = data.logs ?? a.logs;
    a.output = data.output ?? a.output;
    if (taskChanged && a.status === 'working') {
        a.bubbleReveal = 0; // reset typewriter on task change
    }
    a.setStatus(data.status, data.progress);
    if (data.status === 'working' && !a.meeting) {
        const sx = a.desk.x, sz = a.desk.z + 1.15;
        const last = a.queue.length ? a.queue[a.queue.length - 1] : { x: a.target.x, z: a.target.z };
        if (Math.hypot(last.x - sx, last.z - sz) > 0.3) { a.queue.length = 0; a.walkLane(sx, sz); }
    }
    renderAgents();
}
