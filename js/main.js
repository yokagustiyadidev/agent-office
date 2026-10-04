// js/main.js — entry point module
import { state } from './config.js';
import { initScene } from './scene.js';
import { renderAgents } from './ui.js';
import { connectWS } from './net.js';

// ---------- boot ----------
export function bootError(msg) {
    const el = document.getElementById('boot-error');
    if (el) { el.style.display = 'block'; el.textContent = msg; }
}
window.addEventListener('DOMContentLoaded', () => {
    try {
        if (typeof THREE === 'undefined') { bootError('Three.js tidak termuat (CDN cdnjs diblokir?). Cek koneksi/adblock lalu reload.'); return; }
        if (!THREE.OrbitControls) { bootError('OrbitControls tidak termuat (CDN jsdelivr diblokir?). Cek koneksi/adblock lalu reload.'); return; }
        initScene();
    } catch (err) { bootError('Render 3D gagal start: ' + (err && err.message ? err.message : err)); return; }
    renderAgents();
    connectWS();
});


// ---- expose ke window untuk handler onclick di index.html ----
import { toggleSidebar, toggleMiniLog, closeModal, switchTab, spawnCustomAgent, spawnDemoOffice, spawnQuick } from './ui.js';
import { resetCamera, toggleAutoRotate, toggleTopView, toggleFullscreen } from './scene.js';
import { toggleMeeting } from './meeting.js';
import { clearFocus } from './hover.js';
import { setTimeOfDay, toggleAutoTime } from './room.js';
import { toggleSound } from './effects.js';
import './peta.js';

window.state = state;  // ekspos utk debugging di console
Object.assign(window, {
    toggleSidebar, toggleMiniLog, closeModal, switchTab, spawnCustomAgent,
    spawnDemoOffice, spawnQuick, resetCamera, toggleAutoRotate, toggleTopView,
    toggleFullscreen, clearFocus, toggleMeeting, setTimeOfDay, toggleAutoTime,
    toggleSound
});
