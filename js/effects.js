// js/effects.js — suara, debu matahari, konfeti, steam kopi, siklus keluar agen
import { state, API_URL } from './config.js';
import { addGlobalLog, renderAgents } from './ui.js';
import { clearFocus } from './hover.js';
import { endMeeting } from './meeting.js';

// ---------- sound (subtle, off by default? keep on, low volume) ----------
export function beep(freq, dur, type = 'sine', vol = 0.05, when = 0) {
    if (!state.soundOn) return;
    try {
        if (!state.audioCtx) state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const t = state.audioCtx.currentTime + when;
        const o = state.audioCtx.createOscillator(), g = state.audioCtx.createGain();
        o.type = type; o.frequency.setValueAtTime(freq, t);
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g).connect(state.audioCtx.destination);
        o.start(t); o.stop(t + dur);
    } catch (e) { /* ignore */ }
}
export const playSpawn = () => beep(520, .1);
export const playComplete = () => { beep(523, .12); beep(784, .18, 'sine', .05, .1); };
export const playClick = () => beep(700, .04, 'sine', .03);

export function toggleSound() {
    state.soundOn = !state.soundOn;
    document.getElementById('fab').textContent = state.soundOn ? 'Suara: Nyala' : 'Suara: Mati';
    if (state.soundOn) playClick();
}

// ---------- subtle sun dust ----------
export function initDust() {
    const N = 120;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
        pos[i * 3] = (Math.random() - .5) * 26;
        pos[i * 3 + 1] = Math.random() * 5 + 0.3;
        pos[i * 3 + 2] = (Math.random() - .5) * 26;
        state.dustVel.push((Math.random() - .5) * 0.05);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    state.dustPts = new THREE.Points(geo, new THREE.PointsMaterial({
        color: 0xffe9c4, size: 0.045, transparent: true, opacity: 0.2, depthWrite: false
    }));
    state.scene.add(state.dustPts);
}

// Penanda keluar: agen yang selesai berjalan keluar lewat pintu (10,13),
// lalu mesh-nya baru dibuang setelah sampai di luar (rekornya tetap di sidebar).
export const DOOR_X = 10, DOOR_Z = 13;
export const EXIT_AFTER_DONE = 4000;   // jeda setelah selesai (beri waktu toast) sebelum berjalan keluar
export const EXIT_WALK_MS    = 30000;  // pengaman terakhir kalau perjalanan keluar tak rampung
export const EXIT_OUT_Z      = 21;     // dianggap di luar saat z sudah melewati ini


// ---------- Fase 4: konfeti saat agen selesai ----------
export const confetti = { list: [] };

export function spawnConfetti(pos3) {
    const N = 60;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(N * 3);
    const colors = new Float32Array(N * 3);
    const palette = [0x3b82f6, 0x10b981, 0xf59e0b, 0xef4444, 0x8b5cf6, 0xf472b6];
    const parts = [];
    for (let i = 0; i < N; i++) {
        positions[i*3] = pos3.x + (Math.random() - 0.5) * 0.4;
        positions[i*3+1] = 2.2 + Math.random() * 0.6;
        positions[i*3+2] = pos3.z + (Math.random() - 0.5) * 0.4;
        const c = new THREE.Color(palette[i % palette.length]);
        colors[i*3] = c.r; colors[i*3+1] = c.g; colors[i*3+2] = c.b;
        parts.push({
            vx: (Math.random() - 0.5) * 1.6,
            vy: 1.8 + Math.random() * 2.2,
            vz: (Math.random() - 0.5) * 1.6,
            life: 1.6 + Math.random() * 0.8
        });
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mat2 = new THREE.PointsMaterial({
        size: 0.07, vertexColors: true, transparent: true, opacity: 0.95,
        depthWrite: false, sizeAttenuation: true
    });
    const pts = new THREE.Points(geo, mat2);
    pts.frustumCulled = false;
    state.scene.add(pts);
    confetti.list.push({ pts, parts, age: 0 });
}

export function updateConfetti(dt) {
    for (let k = confetti.list.length - 1; k >= 0; k--) {
        const c = confetti.list[k];
        c.age += dt;
        const arr = c.pts.geometry.attributes.position.array;
        let alive = 0;
        for (let i = 0; i < c.parts.length; i++) {
            const p = c.parts[i];
            p.life -= dt;
            if (p.life > 0) {
                alive++;
                p.vy -= 4.5 * dt;         // gravitasi
                arr[i*3] += p.vx * dt;
                arr[i*3+1] += p.vy * dt;
                arr[i*3+2] += p.vz * dt;
                if (arr[i*3+1] < 0.05) { arr[i*3+1] = 0.05; p.vy = 0; p.vx *= 0.6; p.vz *= 0.6; }
            }
        }
        c.pts.material.opacity = Math.max(0, 0.95 * (1 - c.age / 2.6));
        c.pts.geometry.attributes.position.needsUpdate = true;
        if (c.age > 2.6 || !alive) {
            state.scene.remove(c.pts);
            c.pts.geometry.dispose();
            c.pts.material.dispose();
            confetti.list.splice(k, 1);
        }
    }
}

let steamParticles = null, steamData = null;

export function buildCoffeeSteam() {
    // Uap dari mesin kopi (coffee machine di 15.6, 1.4, 8)
    const N = 26;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(N * 3);
    steamData = [];
    for (let i = 0; i < N; i++) {
        pos[i*3] = 15.6 + (Math.random() - 0.5) * 0.08;
        pos[i*3+1] = 1.75 + Math.random() * 0.6;
        pos[i*3+2] = 8 + (Math.random() - 0.5) * 0.08;
        steamData.push({ seed: Math.random() * Math.PI * 2, speed: 0.25 + Math.random() * 0.4 });
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const m = new THREE.PointsMaterial({
        color: 0xdfe6ee, size: 0.05, transparent: true, opacity: 0.3,
        depthWrite: false, sizeAttenuation: true
    });
    steamParticles = new THREE.Points(geo, m);
    steamParticles.name = 'coffee-steam';
    state.scene.add(steamParticles);
}

export function updateSteam(dt, t) {
    if (!steamParticles || !steamData) return;
    const arr = steamParticles.geometry.attributes.position.array;
    for (let i = 0; i < steamData.length; i++) {
        const s = steamData[i];
        arr[i*3+1] += s.speed * dt * 0.5;
        arr[i*3] += Math.sin(t * 2 + s.seed) * dt * 0.03;
        if (arr[i*3+1] > 2.6) {
            arr[i*3+1] = 1.75;
            arr[i*3] = 15.6 + (Math.random() - 0.5) * 0.08;
            arr[i*3+2] = 8 + (Math.random() - 0.5) * 0.08;
        }
    }
    steamParticles.geometry.attributes.position.needsUpdate = true;
}


// ---------- siklus keluar agen ----------
export function findAgent(id) {
    if (state.agents.has(id)) return state.agents.get(id);
    for (const a of state.agents.values()) if (a.id === id) return a;
    return null;
}

// jadwalkan satu kali saja; agen "berangkat" padahal keluar kantor cuma 10 detik.
export function scheduleExit(id) {
    const a = findAgent(id);
    if (!a || a.exitPending || a.exitWalk || a.disposed) return;
    a.exitPending = true;
    setTimeout(() => begExit(id), EXIT_AFTER_DONE);
}

export function begExit(id) {
    const a = findAgent(id);
    if (!a || a.exitWalk || a.disposed) return;
    if (a.meeting) {
        // keluar dari rapat secara individual (endMeeting() untuk seluruh rapat)
        a.meeting = false;
        a.seatIdx = -1;
        a.meetLine = '';
        a.drawBubble();
    }
    a.exitWalk = true;
    a.exitPending = false;
    a.bubbleReveal = 0;
    a.queue.length = 0;
    a.gone = true;                 // sengaja keluar — bukan bug posisi
    a.walking = false;
    a.walkLane(DOOR_X, DOOR_Z);    // rute Manhattan ke pintu (target + queue diisi di sini)
    a.queue.push({ x: DOOR_X, z: EXIT_OUT_Z });   // lanjut lurus keluar melewati pintu
    a.faceTowards(DOOR_X, DOOR_Z);
    if (state.focused === a) clearFocus();
    if (state.hovered === a) { if (a.shirtMat) a.shirtMat.emissive.setHex(0x000000); state.hovered = null; }
    addGlobalLog(`${a.name} keluar kantor`);

    // pengaman terakhir: kalau logika jalan tersendat, tetap dibuang setelah batas waktu
    a.exitWatchdog = setTimeout(() => finishExit(id), EXIT_WALK_MS);
}

export function finishExit(id) {
    const a = findAgent(id);
    if (!a || a.disposed) return;
    if (a.exitWatchdog) { clearTimeout(a.exitWatchdog); a.exitWatchdog = null; }
    if (state.focused === a) clearFocus();
    if (state.hovered === a) { if (a.shirtMat) a.shirtMat.emissive.setHex(0x000000); state.hovered = null; }
    a.dispose();               // hanya mesh yang dibuang
    a.exited = true;           // record + laporan tetap ada di sidebar
    renderAgents();
}

// typewriter bubble: saat agen sedang keluar, tampilkan pesan perpisahan
// (bukan task-nya lagi) supaya "keluar kantor" terlihat jelas di ruangan.
export function exitBubbleText(a) {
    if (!a) return null;
    return a.exitPending ? 'Selesai ✅' : (a.exitWalk ? 'Keluar kantor…' : null);
}
