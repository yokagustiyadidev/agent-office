// js/meeting.js — adakan/bubarkan rapat
import { state, MEET_CX, MEET_CZ, MEET_LINES, MEET_CHAIRS } from './config.js';
import { playClick } from './effects.js';
import { addGlobalLog } from './ui.js';

// ---------- meeting: gather, converse, disperse ----------
export function meetSpot(i) {
    if (i < 6 && MEET_CHAIRS[i]) return { x: MEET_CHAIRS[i].x, z: MEET_CHAIRS[i].z };
    if (i < 6) {
        const a = (i / 6) * Math.PI * 2;
        return { x: MEET_CX + Math.cos(a) * 3.3, z: MEET_CZ + Math.sin(a) * 2.6 };
    }
    const a = ((i - 6) / 8) * Math.PI * 2 + 0.4;
    return { x: MEET_CX + Math.cos(a) * 4.6, z: MEET_CZ + Math.sin(a) * 3.8 };
}

export function toggleMeeting() {
    if (meeting.active) endMeeting();
    else startMeeting();
    playClick();
}

export function startMeeting() {
    if (!state.agents.size) { addGlobalLog('Belum ada agen untuk rapat.'); return; }
    meeting.active = true;
    meeting.speaker = 0;
    let i = 0;
    state.agents.forEach(a => {
        if (!a.group || a.exitWalk || a.disposed) return;   // lewati agen yang sudah keluar
        const idx = i++;
        const s = meetSpot(idx);
        a.meeting = true;
        a.seatIdx = idx;
        a.meetLine = '';
        a.bubbleReveal = 0;
        a.queue.length = 0;
        a.walkLane(s.x, s.z);
        a.drawBubble();
    });
    document.getElementById('meeting-btn').textContent = 'Bubarkan Rapat';
    addGlobalLog('Rapat dimulai — semua agen berkumpul di meja rapat.');
    speakNext();
    meeting.timer = setInterval(speakNext, 4500);
}

export function speakNext() {
    if (!meeting.active) return;
    const gathered = [...state.agents.values()].filter(a => a.meeting && !a.walking);
    if (!gathered.length) return;
    meeting.speaker = (meeting.speaker + 1) % gathered.length;
    const a = gathered[meeting.speaker];
    a.meetLine = MEET_LINES[Math.floor(Math.random() * MEET_LINES.length)];
    a.bubbleReveal = 0;
    a.bubbleDotPhase = 0;
    a.drawBubble();
    a.wave = 0.8;
    // Fase 3: speaker nod (angguk) — animasi kepala singkat
    a.nodT = 1.4;
}

export function endMeeting() {
    meeting.active = false;
    if (meeting.timer) { clearInterval(meeting.timer); meeting.timer = null; }
    state.agents.forEach(a => {
        if (!a.meeting) return;
        a.meeting = false;
        a.seatIdx = -1;
        a.meetLine = '';
        a.drawBubble();
        a.queue.length = 0;
        a.walkLane(a.desk.x, a.desk.z + 1.15);
    });
    const btn = document.getElementById('meeting-btn');
    if (btn) btn.textContent = 'Adakan Rapat';
    addGlobalLog('Rapat selesai — agen kembali ke meja.');
}
