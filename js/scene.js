// js/scene.js — Three.js scene, render loop, kontrol kamera
import { state } from './config.js';
import { buildRoom, buildDesks, buildMeetingArea, buildLights, buildPlants,
         buildWhiteboard, buildTVWall,  applyTimeOfDay } from './room.js';
import { initDust, updateSteam, updateConfetti, buildCoffeeSteam, playClick } from './effects.js';
import { agentAt, doHover, handleClick, clearFocus, flyTo, focusAgent } from './hover.js';
import { openModal, closeModal } from './ui.js';

// ---------- state.scene ----------
export function initScene() {
    const container = document.getElementById('canvas-container');
    state.scene = new THREE.Scene();
    state.scene.background = new THREE.Color(0x202429);
    state.scene.fog = new THREE.Fog(0x202429, 38, 70);

    state.camera = new THREE.PerspectiveCamera(48, container.clientWidth / container.clientHeight, 0.1, 200);
    state.camera.position.set(22, 17, 22);

    state.renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('canvas'), antialias: true });
    state.renderer.setSize(container.clientWidth, container.clientHeight);
    state.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    state.renderer.shadowMap.enabled = true;
    state.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    state.renderer.outputEncoding = THREE.sRGBEncoding;
    state.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    state.renderer.toneMappingExposure = 1.25;
    state.renderer.physicallyCorrectLights = true;

    state.clock = new THREE.Clock();
    state.raycaster = new THREE.Raycaster();

    state.controls = new THREE.OrbitControls(state.camera, state.renderer.domElement);
    state.controls.enableDamping = true;
    state.controls.dampingFactor = 0.08;
    state.controls.enablePan = true;
    state.controls.screenSpacePanning = true;
    state.controls.minDistance = 1.2;
    state.controls.maxDistance = 40;
    state.controls.maxPolarAngle = Math.PI / 2.02;
    state.controls.target.set(0, 1, 0);

    state.ambLight = new THREE.AmbientLight(0xc9d8e6, 0.65);
    state.scene.add(state.ambLight);

    state.hemiLight = new THREE.HemisphereLight(0xffffff, 0xe8ded1, 0.4);
    state.scene.add(state.hemiLight);

    const sun = new THREE.DirectionalLight(0xf2e9cf, 0.8);
    sun.position.set(16, 22, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -20;
    sun.shadow.camera.right = 20;
    sun.shadow.camera.top = 20;
    sun.shadow.camera.bottom = -20;
    sun.shadow.camera.far = 65;
    sun.shadow.bias = -0.0001;
    sun.shadow.normalBias = 0.05;
    state.scene.add(sun);
    state.sunLight = sun;

    const fill = new THREE.DirectionalLight(0xe6f2ff, 0.4);
    fill.position.set(-14, 16, -10);
    state.scene.add(fill);
    state.fillLight = fill;

    const rimLight2 = new THREE.DirectionalLight(0xffe2cc, 0.25);
    rimLight2.position.set(-10, 8, 14);
    state.scene.add(rimLight2);
    state.rimLight = rimLight2;

    // Sky backdrop behind the window wall (day/night gradient, Fase 1)
    state.skyCanvas = document.createElement('canvas');
    state.skyCanvas.width = 16; state.skyCanvas.height = 256;
    state.skyTex = new THREE.CanvasTexture(state.skyCanvas);
    state.skyTex.encoding = THREE.sRGBEncoding;
    state.skyMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(90, 30),
        new THREE.MeshBasicMaterial({ map: state.skyTex, depthWrite: false, fog: false })
    );
    state.skyMesh.position.set(0, 8, -24);
    state.scene.add(state.skyMesh);

    buildRoom();
    buildDesks();
    buildMeetingArea();
    buildLights();
    buildPlants();
    buildWhiteboard();
    buildTVWall();
    buildCoffeeSteam();
    initDust();
    applyTimeOfDay();

    const cv = state.renderer.domElement;
    cv.addEventListener('pointermove', e => { state.lastClient = { x: e.clientX, y: e.clientY }; state.hoverDirty = true; });
    cv.addEventListener('pointerdown', e => { state.downPos = { x: e.clientX, y: e.clientY }; });
    cv.addEventListener('pointerup', e => {
        if (state.downPos && Math.hypot(e.clientX - state.downPos.x, e.clientY - state.downPos.y) < 6) handleClick(e);
        state.downPos = null;
    });
    cv.addEventListener('dblclick', e => {
        e.preventDefault();
        const a = agentAt(e);
        if (a) { focusAgent(a); openModal(a); playClick(); return; }
        const rect = state.renderer.domElement.getBoundingClientRect();
        state.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        state.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        state.raycaster.setFromCamera(state.pointer, state.camera);
        const hits = state.raycaster.intersectObjects(state.scene.children, true);
        const hit = hits.find(h => h.point.y < 4);
        if (!hit) return;
        const dir = state.camera.position.clone().sub(hit.point).normalize();
        const dist = Math.max(Math.min(state.camera.position.distanceTo(hit.point) * 0.45, 6), 2.2);
        const toPos = hit.point.clone().add(dir.multiplyScalar(dist));
        toPos.y = Math.max(toPos.y, 1.2);
        state.focused = null;
        document.getElementById('focus-bar').classList.remove('active');
        flyTo(toPos, hit.point.clone().add(new THREE.Vector3(0, 0.6, 0)));
        playClick();
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeModal(); clearFocus(); } });
    window.addEventListener('resize', onResize);

    animate();
    // Cinematic intro: glide from wide shot into default view
    flyTo(new THREE.Vector3(9.5, 8, 9.5), new THREE.Vector3(0, 1, 0), 2.2);
}

export function mat(color, rough = 0.85, extra = {}) {
    return new THREE.MeshStandardMaterial(Object.assign({ color, roughness: rough, metalness: 0.02 }, extra));
}


// ---------- loop ----------
export function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(state.clock.getDelta(), 0.05);
    const t = state.clock.elapsedTime;

    if (state.hoverDirty) { state.hoverDirty = false; doHover(); }

    if (state.camTween) {
        state.camTween.t += dt;
        const k = Math.min(state.camTween.t / state.camTween.dur, 1);
        const e = 1 - Math.pow(1 - k, 3);
        state.camera.position.lerpVectors(state.camTween.fromPos, state.camTween.toPos, e);
        state.controls.target.lerpVectors(state.camTween.fromTg, state.camTween.toTg, e);
        if (k >= 1) state.camTween = null;
    }

    state.agents.forEach(a => a.update(dt, t));

    // Auto day/night: 1 game-hour per 10 real seconds
    if (state.autoTime) {
        state.timeOfDay = (state.timeOfDay + dt * 0.1) % 24;
        applyTimeOfDay();
        const label = document.getElementById('time-label');
        if (label) label.textContent = String(Math.floor(state.timeOfDay)).padStart(2, '0') + ':' + String(Math.floor((state.timeOfDay % 1) * 60)).padStart(2, '0');
    }

    updateSteam(dt, t);
    updateConfetti(dt);

    if (state.dustPts) {
        const arr = state.dustPts.geometry.attributes.position.array;
        for (let i = 0; i < state.dustVel.length; i++) {
            arr[i * 3 + 1] += state.dustVel[i] * dt * 2;
            if (arr[i * 3 + 1] > 5.5) arr[i * 3 + 1] = 0.3;
        }
        state.dustPts.geometry.attributes.position.needsUpdate = true;
    }

    // follow state.focused agent if it walks
    if (state.focused && !state.camTween) {
        const p = state.focused.group.position;
        state.controls.target.lerp(new THREE.Vector3(p.x, 1.3, p.z), 0.06);
    }

    state.controls.update();
    state.renderer.render(state.scene, state.camera);
}

export function onResize() {
    const c = document.getElementById('canvas-container');
    state.camera.aspect = c.clientWidth / c.clientHeight;
    state.camera.updateProjectionMatrix();
    state.renderer.setSize(c.clientWidth, c.clientHeight);
}

// ---------- state.camera buttons ----------
export function resetCamera() {
    clearFocus();
    state.controls.autoRotate = false;
    document.getElementById('btn-rotate').classList.remove('on');
    flyTo(new THREE.Vector3(9.5, 8, 9.5), new THREE.Vector3(0, 1, 0));
    playClick();
}
export function toggleAutoRotate() {
    state.controls.autoRotate = !state.controls.autoRotate;
    state.controls.autoRotateSpeed = 1.2;
    document.getElementById('btn-rotate').classList.toggle('on', state.controls.autoRotate);
    playClick();
}
export function toggleTopView() {
    flyTo(new THREE.Vector3(0.01, 24, 0.01), new THREE.Vector3(0, 0, 0));
    playClick();
}
export function toggleFullscreen() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen();
    else document.exitFullscreen();
    playClick();
}
