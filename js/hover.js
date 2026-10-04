// js/hover.js — hover tooltip + klik fokus + kamera tween
import { state, STATUS_CSS } from './config.js';
import { playClick } from './effects.js';
import { openModal } from './ui.js';

// ---------- hover + click focus ----------
export function agentAt(e) {
    const rect = state.renderer.domElement.getBoundingClientRect();
    state.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    state.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    state.raycaster.setFromCamera(state.pointer, state.camera);
    const hits = state.raycaster.intersectObjects([...state.agents.values()].filter(a => a.group).map(a => a.group), true);
    if (!hits.length) return null;
    const id = hits[0].object.userData.agentId;
    return state.agents.get(id) || null;
}

export function doHover() {
    const rect = state.renderer.domElement.getBoundingClientRect();
    state.pointer.x = ((state.lastClient.x - rect.left) / rect.width) * 2 - 1;
    state.pointer.y = -((state.lastClient.y - rect.top) / rect.height) * 2 + 1;
    state.raycaster.setFromCamera(state.pointer, state.camera);
    const hits = state.raycaster.intersectObjects([...state.agents.values()].filter(a => a.group).map(a => a.group), true);
    const tip = document.getElementById('tooltip');
    const cont = document.getElementById('canvas-container').getBoundingClientRect();

    if (state.hovered && (!hits.length || hits[0].object.userData.agentId !== state.hovered.id)) {
        state.hovered.shirtMat.emissive.setHex(0x000000);
        if (state.hovered.ring) state.hovered.ring.scale.set(0.34, 0.34, 1);
        state.hovered = null;
    }
    if (hits.length) {
        const a = state.agents.get(hits[0].object.userData.agentId);
        if (a) {
            if (state.hovered !== a) {
                state.hovered = a;
                // Fase 4: glow lebih terlihat
                a.shirtMat.emissive.setHex(0x1a3a6e);
                a.shirtMat.emissiveIntensity = 0.9;
                if (a.ring) a.ring.scale.set(0.42, 0.42, 1);  // pulse ring membesar
                playClick();
            }
            tip.style.display = 'block';
            tip.style.left = (state.lastClient.x - cont.left + 16) + 'px';
            tip.style.top = (state.lastClient.y - cont.top + 12) + 'px';
            tip.innerHTML = `<b>${a.name}</b> Â· ${a.role}\n${a.status} Â· ${Math.round(a.progress)}%\n${String(a.task).slice(0, 90)}`;
            state.renderer.domElement.style.cursor = 'grab';
            return;
        }
    }
    tip.style.display = 'none';
    state.renderer.domElement.style.cursor = 'grab';
}

export function handleClick(e) {
    const a = agentAt(e);
    if (a) { focusAgent(a); openModal(a); playClick(); }
    else clearFocus();
}

export function focusAgent(a) {
    if (!a || !a.group) return;   // agen yang sudah keluar tidak punya mesh
    state.focused = a;
    a.wave = 1.2;
    document.getElementById('focus-bar').classList.add('active');
    document.getElementById('focus-label').textContent = `Fokus: ${a.name} â€” ${a.role}`;
    const p = a.group.position;
    flyTo(new THREE.Vector3(p.x + 2.6, 2.4, p.z + 2.6), new THREE.Vector3(p.x, 1.3, p.z));
    state.controls.autoRotate = false;
    document.getElementById('btn-rotate').classList.remove('on');
}

export function clearFocus() {
    if (!state.focused) return;
    state.focused = null;
    document.getElementById('focus-bar').classList.remove('active');
}

export function flyTo(toPos, toTg, dur = 0.9) {
    state.camTween = {
        t: 0, dur,
        fromPos: state.camera.position.clone(), toPos,
        fromTg: state.controls.target.clone(), toTg
    };
}
