// ============================================================
//  AGENT OFFICE 3D â€” daylight office, proportional agents,
//  hover tooltip + click focus. No bloom, no neon.
//  Three.js r128 + OrbitControls only.
// ============================================================

const WS_URL = `${location.hostname || 'localhost'}:${location.port || '80'}`;
const API_URL = `${location.protocol}//${location.hostname || 'localhost'}:${location.port || '80'}`;

// Muted shirt colors per role (real fabric tones, not neon)
const ROLE_CONFIG = {
    Developer: { color: 0x4a6fa5, css: '#4a6fa5' },
    Designer:  { color: 0x9c7c8c, css: '#9c7c8c' },
    Manager:   { color: 0x8a7a5c, css: '#8a7a5c' },
    QA:        { color: 0x5f8a6e, css: '#5f8a6e' },
    DevOps:    { color: 0x5b7d8a, css: '#5b7d8a' },
    Security:  { color: 0x8a5f5b, css: '#8a5f5b' }
};
const SKINS = [0xe8b88a, 0xd9a06f, 0xb07a4f, 0x8a5a35];
const HAIRS = [0x2b2118, 0x3d2c1e, 0x555555, 0x1a1a1a];
const TROUSER = 0x3a4356;
const STATUS_COLOR = { working: 0x2563eb, completed: 0x15803d, error: 0xb91c1c, idle: 0x9ca3af };
const STATUS_CSS = { working: '#2563eb', completed: '#15803d', error: '#b91c1c', idle: '#9ca3af' };

// Walk lanes (aisles between desks) + entrance door at (10, 13)
const LANE_X = [-7, -2.4, 2.4, 7], LANE_Z = [-7, -2.4, 2.4, 7];
function nearLane(arr, v) { let b = arr[0]; for (const a of arr) if (Math.abs(a - v) < Math.abs(b - v)) b = a; return b; }

const DESK_ROWS = 3, DESK_COLS = 3, DESK_GAP = 4.8;

// Meeting area (conference table) + conversation state
const MEET_CX = 0, MEET_CZ = -11;
const MEET_LINES = [
    'Gimana progres modul auth?',
    'Testing sudah 80%, besok selesai.',
    'Setuju, kita rilis bertahap saja.',
    'Perlu sinkron dengan tim desain.',
    'Deadline sprint hari Jumat, ya.',
    'Ada kendala di integrasi API.',
    'Dokumentasinya saya rapikan.',
    'Bagus, lanjutkan seperti itu.',
    'Jadwalkan review sore ini.',
    'Sepakat, eksekusi mulai besok.'
];
const meeting = { active: false, speaker: 0, timer: null };
const MEET_CHAIRS = [];

let scene, camera, renderer, controls, clock;
let raycaster, pointer = new THREE.Vector2();
let downPos = null, hoverDirty = false, lastClient = { x: 0, y: 0 };
const agents = new Map();
const desks = [];
let stats = { active: 0, completed: 0, total: 0 };
let ws;
let soundOn = true, audioCtx = null;
let hovered = null, focused = null, camTween = null;
let dustPts = null, dustVel = [];

// ---------- sound (subtle, off by default? keep on, low volume) ----------
function beep(freq, dur, type = 'sine', vol = 0.05, when = 0) {
    if (!soundOn) return;
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const t = audioCtx.currentTime + when;
        const o = audioCtx.createOscillator(), g = audioCtx.createGain();
        o.type = type; o.frequency.setValueAtTime(freq, t);
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g).connect(audioCtx.destination);
        o.start(t); o.stop(t + dur);
    } catch (e) { /* ignore */ }
}
const playSpawn = () => beep(520, .1);
const playComplete = () => { beep(523, .12); beep(784, .18, 'sine', .05, .1); };
const playClick = () => beep(700, .04, 'sine', .03);

function toggleSound() {
    soundOn = !soundOn;
    document.getElementById('fab').textContent = soundOn ? 'Suara: Nyala' : 'Suara: Mati';
    if (soundOn) playClick();
}

// ---------- scene ----------
function initScene() {
    const container = document.getElementById('canvas-container');
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x202429);
    scene.fog = new THREE.Fog(0x202429, 38, 70);

    camera = new THREE.PerspectiveCamera(48, container.clientWidth / container.clientHeight, 0.1, 200);
    camera.position.set(22, 17, 22);

    renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('canvas'), antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    renderer.physicallyCorrectLights = true;

    clock = new THREE.Clock();
    raycaster = new THREE.Raycaster();

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = true;
    controls.screenSpacePanning = true;
    controls.minDistance = 1.2;
    controls.maxDistance = 40;
    controls.maxPolarAngle = Math.PI / 2.02;
    controls.target.set(0, 1, 0);

    const ambientBase = new THREE.AmbientLight(0xc9d8e6, 0.65);
    scene.add(ambientBase);
    
    scene.add(new THREE.HemisphereLight(0xffffff, 0xe8ded1, 0.4));
    
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
    scene.add(sun);
    
    const fill = new THREE.DirectionalLight(0xe6f2ff, 0.4);
    fill.position.set(-14, 16, -10);
    scene.add(fill);
    
    const rimLight = new THREE.DirectionalLight(0xffe2cc, 0.25);
    rimLight.position.set(-10, 8, 14);
    scene.add(rimLight);

    buildRoom();
    buildDesks();
    buildMeetingArea();
    buildLights();
    buildPlants();
    initDust();

    const cv = renderer.domElement;
    cv.addEventListener('pointermove', e => { lastClient = { x: e.clientX, y: e.clientY }; hoverDirty = true; });
    cv.addEventListener('pointerdown', e => { downPos = { x: e.clientX, y: e.clientY }; });
    cv.addEventListener('pointerup', e => {
        if (downPos && Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y) < 6) handleClick(e);
        downPos = null;
    });
    cv.addEventListener('dblclick', e => {
        e.preventDefault();
        const a = agentAt(e);
        if (a) { focusAgent(a); openModal(a); playClick(); return; }
        const rect = renderer.domElement.getBoundingClientRect();
        pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);
        const hits = raycaster.intersectObjects(scene.children, true);
        const hit = hits.find(h => h.point.y < 4);
        if (!hit) return;
        const dir = camera.position.clone().sub(hit.point).normalize();
        const dist = Math.max(Math.min(camera.position.distanceTo(hit.point) * 0.45, 6), 2.2);
        const toPos = hit.point.clone().add(dir.multiplyScalar(dist));
        toPos.y = Math.max(toPos.y, 1.2);
        focused = null;
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

function mat(color, rough = 0.85, extra = {}) {
    return new THREE.MeshStandardMaterial(Object.assign({ color, roughness: rough, metalness: 0.02 }, extra));
}

// ---------- PREMIUM OFFICE ROOM ----------
function buildRoom() {
    // Luxury vinyl tile floor with wood grain effect
    const floorGeo = new THREE.PlaneGeometry(42, 42, 42, 42);
    const floorMat = mat(0x4a4640, 0.75, { metalness: 0.35 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    floor.name = 'floor';
    
    const posArr = floor.geometry.attributes.position.array;
    for (let i = 0; i < posArr.length; i += 3) {
        posArr[i + 2] += (Math.random() - 0.5) * 0.008;
    }
    floor.geometry.attributes.position.needsUpdate = true;
    floor.geometry.computeVertexNormals();
    scene.add(floor);

    // Premium carpet zones with geometric pattern
    const carpetMain = mat(0x556270, 0.95, { metalness: 0.03 });
    const carpetAccent = mat(0x3d4a58, 0.98, { metalness: 0.02 });
    
    // Main work area carpet
    const mainCarpet = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), carpetMain);
    mainCarpet.rotation.x = -Math.PI / 2;
    mainCarpet.position.y = 0.02;
    mainCarpet.receiveShadow = true;
    scene.add(mainCarpet);

    // Accent stripes
    for (let i = -2; i <= 2; i++) {
        const stripe = new THREE.Mesh(new THREE.PlaneGeometry(20, 0.3), carpetAccent);
        stripe.rotation.x = -Math.PI / 2;
        stripe.position.set(0, 0.034, i * 4);
        stripe.receiveShadow = true;
        scene.add(stripe);
    }

    // Entrance area - marble tile (outside carpet zone, no overlap)
    const marbleMat = mat(0xd4d8dd, 0.15, { metalness: 0.5 });
    const entrance = new THREE.Mesh(new THREE.PlaneGeometry(8, 10), marbleMat);
    entrance.rotation.x = -Math.PI / 2;
    entrance.position.set(0, 0.03, 15.5);
    entrance.receiveShadow = true;
    scene.add(entrance);

    // Premium walls with texture and accent colors
    const wallBase = mat(0x4a4e56, 0.82, { metalness: 0.08 });
    const wallAccent = mat(0x2c3e50, 0.78, { metalness: 0.12 });
    const wallLight = mat(0x5a6370, 0.85, { metalness: 0.05 });
    
    const mkWall = (w, h, x, y, z, ry, m = wallBase) => {
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
        mesh.position.set(x, y, z); mesh.rotation.y = ry; mesh.receiveShadow = true;
        scene.add(mesh);
    };
    
    // Back wall - feature wall with panels
    mkWall(42, 6, 0, 3, -18, 0, wallAccent);
    
    // Side walls
    mkWall(42, 6, -18, 3, 0, Math.PI / 2, wallBase);
    mkWall(42, 6, 18, 3, 0, -Math.PI / 2, wallLight);
    
    // Ceiling
    const ceilingMat = mat(0xf5f7fa, 0.9, { metalness: 0.05 });
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(42, 42), ceilingMat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = 6;
    ceiling.receiveShadow = true;
    scene.add(ceiling);
    
    // Decorative wall panels on back wall
    const panelMat = mat(0x1a2332, 0.65, { metalness: 0.25 });
    for (let i = -3; i <= 3; i++) {
        if (i === 0) continue; // skip center for window
        const panel = new THREE.Mesh(new THREE.BoxGeometry(4.5, 4.8, 0.15), panelMat);
        panel.position.set(i * 5.5, 2.9, -17.92);
        panel.castShadow = true;
        scene.add(panel);
        
        // Panel frame
        const frameMat = mat(0xc9a961, 0.4, { metalness: 0.6 });
        const frame = new THREE.Mesh(new THREE.BoxGeometry(4.6, 4.9, 0.08), frameMat);
        frame.position.set(i * 5.5, 2.9, -17.88);
        scene.add(frame);
    }

    // Premium floor-to-ceiling windows
    const winFrameMat = mat(0x1a1e24, 0.35, { metalness: 0.7 });
    const winGlassMat = new THREE.MeshStandardMaterial({ 
        color: 0x8cb4d9, 
        roughness: 0.03, 
        metalness: 0.25, 
        transparent: true, 
        opacity: 0.5,
        envMapIntensity: 1.5
    });
    
    // Large center window
    const centerWin = new THREE.Group();
    const centerFrame = new THREE.Mesh(new THREE.BoxGeometry(12, 5.2, 0.22), winFrameMat);
    centerFrame.castShadow = true;
    centerWin.add(centerFrame);
    
    const centerGlass = new THREE.Mesh(new THREE.PlaneGeometry(11.5, 4.8), winGlassMat);
    centerGlass.position.z = 0.12;
    centerGlass.receiveShadow = true;
    centerWin.add(centerGlass);
    
    // Window mullions - grid pattern
    for (let i = -1; i <= 1; i++) {
        const mullV = new THREE.Mesh(new THREE.BoxGeometry(0.12, 4.8, 0.08), winFrameMat);
        mullV.position.set(i * 3.8, 0, 0.14);
        mullV.castShadow = true;
        centerWin.add(mullV);
    }
    for (let i = -1; i <= 1; i++) {
        const mullH = new THREE.Mesh(new THREE.BoxGeometry(11.5, 0.12, 0.08), winFrameMat);
        mullH.position.set(0, i * 1.6, 0.14);
        mullH.castShadow = true;
        centerWin.add(mullH);
    }
    
    centerWin.position.set(0, 3.1, -17.88);
    scene.add(centerWin);

    // Baseboards - premium trim
    const baseMat = mat(0x2a2e35, 0.6, { metalness: 0.4 });
    [[0, -17.94, 0], [-17.94, 0, 1], [17.94, 0, 1]].forEach(([x, z, rot]) => {
        const b = new THREE.Mesh(new THREE.BoxGeometry(rot ? 0.12 : 42, 0.3, rot ? 42 : 0.12), baseMat);
        b.position.set(x, 0.15, z);
        b.castShadow = true;
        scene.add(b);
    });
    
    // Crown molding
    const crownMat = mat(0xf0f2f5, 0.7, { metalness: 0.15 });
    [[0, -17.94, 0], [-17.94, 0, 1], [17.94, 0, 1]].forEach(([x, z, rot]) => {
        const crown = new THREE.Mesh(new THREE.BoxGeometry(rot ? 0.2 : 42, 0.25, rot ? 42 : 0.2), crownMat);
        crown.position.set(x, 5.875, z);
        crown.castShadow = true;
        scene.add(crown);
    });

    // Reception desk - premium marble counter
    const recepBase = new THREE.Mesh(new THREE.BoxGeometry(4, 1.1, 2), mat(0x1a1e24, 0.5, { metalness: 0.5 }));
    recepBase.position.set(0, 0.55, 13);
    recepBase.castShadow = recepBase.receiveShadow = true;
    scene.add(recepBase);
    
    const recepTop = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.12, 2.1), mat(0xd4d8dd, 0.2, { metalness: 0.6 }));
    recepTop.position.set(0, 1.16, 13);
    recepTop.castShadow = true;
    scene.add(recepTop);
    
    // Company logo panel behind reception
    const logoPanel = new THREE.Mesh(new THREE.BoxGeometry(3, 1.2, 0.1), mat(0x2563eb, 0.3, { metalness: 0.4 }));
    logoPanel.position.set(0, 2, 11.8);
    logoPanel.castShadow = true;
    scene.add(logoPanel);
    
    const logoText = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.6, 0.08), mat(0xffffff, 0.8, { metalness: 0.1 }));
    logoText.position.set(0, 2, 11.75);
    scene.add(logoText);
    // Premium coffee bar area (right side)
    const coffeeBarBase = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1.05, 0.8), mat(0x1a1e24, 0.45, { metalness: 0.6 }));
    coffeeBarBase.position.set(15, 0.525, 8);
    coffeeBarBase.castShadow = coffeeBarBase.receiveShadow = true;
    scene.add(coffeeBarBase);
    
    const coffeeCounter = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.08, 0.85), mat(0xd4d8dd, 0.25, { metalness: 0.55 }));
    coffeeCounter.position.set(15, 1.09, 8);
    coffeeCounter.castShadow = true;
    scene.add(coffeeCounter);
    
    // Coffee machine
    const coffeeMachine = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.55, 0.35), mat(0x2a2e35, 0.35, { metalness: 0.7 }));
    coffeeMachine.position.set(15.6, 1.4, 8);
    coffeeMachine.castShadow = true;
    scene.add(coffeeMachine);
    
    // Coffee machine display
    const machineDisplay = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 0.15), new THREE.MeshBasicMaterial({ color: 0x2563eb, toneMapped: false }));
    machineDisplay.position.set(15.6, 1.5, 8.18);
    scene.add(machineDisplay);
    
    // Cups on counter
    for (let i = 0; i < 3; i++) {
        const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.09, 16), mat(0xf5f7fa, 0.6, { metalness: 0.1 }));
        cup.position.set(14.5 + i * 0.15, 1.175, 7.8);
        cup.castShadow = true;
        scene.add(cup);
    }
    
    // Lounge seating area (left side)
    const loungeChairMat = mat(0x4a5a6a, 0.8, { metalness: 0.08 });
    const loungeFrameMat = mat(0x1a1e24, 0.4, { metalness: 0.6 });
    
    // Armchair
    const chairSeat = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.15, 0.85), loungeChairMat);
    chairSeat.position.set(-15, 0.35, 8);
    chairSeat.castShadow = true;
    scene.add(chairSeat);
    
    const chairBack = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.8, 0.15), loungeChairMat);
    chairBack.position.set(-15, 0.75, 8.35);
    chairBack.castShadow = true;
    scene.add(chairBack);
    
    // Armrests
    [-0.45, 0.45].forEach(offset => {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 0.7), loungeFrameMat);
        arm.position.set(-15 + offset, 0.6, 8);
        arm.castShadow = true;
        scene.add(arm);
    });
    
    // Coffee table
    const coffeeTable = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.08, 24), mat(0xd4d8dd, 0.2, { metalness: 0.5 }));
    coffeeTable.position.set(-15, 0.45, 6.5);
    coffeeTable.castShadow = coffeeTable.receiveShadow = true;
    scene.add(coffeeTable);
    
    const tableBase = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, 0.4, 16), mat(0x2a2e35, 0.4, { metalness: 0.6 }));
    tableBase.position.set(-15, 0.2, 6.5);
    tableBase.castShadow = true;
    scene.add(tableBase);
    
    // Wall art gallery (left wall)
    const artFrameMat = mat(0x1a1e24, 0.5, { metalness: 0.5 });
    const artColors = [0x2563eb, 0x10b981, 0xf59e0b, 0xef4444, 0x8b5cf6];
    
    for (let i = 0; i < 5; i++) {
        const artCanvas = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.2, 1.2), mat(artColors[i], 0.7, { metalness: 0.15 }));
        artCanvas.position.set(-17.92, 2.5, -8 + i * 3.5);
        artCanvas.rotation.y = Math.PI / 2;
        artCanvas.castShadow = true;
        scene.add(artCanvas);
        
        const artFrame = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.3, 1.3), artFrameMat);
        artFrame.position.set(-17.88, 2.5, -8 + i * 3.5);
        artFrame.rotation.y = Math.PI / 2;
        scene.add(artFrame);
    }
    
    // Digital screen on right wall
    const screenFrame = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.5, 3.5), mat(0x1a1e24, 0.35, { metalness: 0.7 }));
    screenFrame.position.set(17.92, 2.8, -5);
    screenFrame.rotation.y = -Math.PI / 2;
    screenFrame.castShadow = true;
    scene.add(screenFrame);
    
    const screenDisplay = new THREE.Mesh(new THREE.PlaneGeometry(3.3, 2.3), new THREE.MeshBasicMaterial({ color: 0x0a0e14, toneMapped: false }));
    screenDisplay.position.set(17.88, 2.8, -5);
    screenDisplay.rotation.y = -Math.PI / 2;
    scene.add(screenDisplay);
    
    // Screen content - metrics display
    const metricsBar = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 0.3), new THREE.MeshBasicMaterial({ color: 0x10b981, toneMapped: false }));
    metricsBar.position.set(17.86, 2.5, -5);
    metricsBar.rotation.y = -Math.PI / 2;
    scene.add(metricsBar);

    // Modern wall clock
    const clockOuter = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.08, 32), mat(0x1a1e24, 0.4, { metalness: 0.6 }));
    clockOuter.rotation.x = Math.PI / 2;
    clockOuter.position.set(0, 4.5, -17.85);
    clockOuter.castShadow = true;
    scene.add(clockOuter);
    
    const clockFace = new THREE.Mesh(new THREE.CircleGeometry(0.28, 32), mat(0xf5f7fa, 0.85, { metalness: 0.05 }));
    clockFace.position.set(0, 4.5, -17.82);
    scene.add(clockFace);
    
    // Clock hands
    const hourHand = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.15, 0.02), mat(0x1a1e24, 0.5, { metalness: 0.5 }));
    hourHand.position.set(0, 4.5, -17.8);
    scene.add(hourHand);
    
    const minuteHand = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.22, 0.02), mat(0x1a1e24, 0.5, { metalness: 0.5 }));
    minuteHand.position.set(0, 4.5, -17.79);
    scene.add(minuteHand);


}

// ---------- desks: wood top, black legs, monitor with code, chair, mug ----------
function codeTexture(seed) {
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 160;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#1e293b'; ctx.fillRect(0, 0, 256, 160);
    ctx.fillStyle = '#0f172a'; ctx.fillRect(0, 0, 256, 22);
    ['#f87171', '#fbbf24', '#34d399'].forEach((c, i) => {
        ctx.fillStyle = c; ctx.beginPath(); ctx.arc(14 + i * 14, 11, 4, 0, 7); ctx.fill();
    });
    const colors = ['#7dd3fc', '#c4b5fd', '#86efac', '#fcd34d', '#94a3b8'];
    let rnd = seed * 9301 + 49297;
    const rand = () => (rnd = (rnd * 9301 + 49297) % 233280) / 233280;
    for (let r = 0; r < 9; r++) {
        let x = 12;
        const segs = 2 + Math.floor(rand() * 3);
        for (let s = 0; s < segs; s++) {
            const w = 20 + rand() * 55;
            ctx.fillStyle = colors[Math.floor(rand() * colors.length)];
            ctx.globalAlpha = 0.85;
            ctx.fillRect(x, 34 + r * 13, w, 6);
            x += w + 8;
            if (x > 240) break;
        }
    }
    ctx.globalAlpha = 1;
    const tex = new THREE.CanvasTexture(cv);
    tex.encoding = THREE.sRGBEncoding;
    return tex;
}

function buildDesks() {
    const half = (DESK_COLS - 1) * DESK_GAP / 2;
    const woodMat = mat(0x8a6d4f, 0.45, { metalness: 0.12 });
    const legMat = mat(0x2a2e35, 0.3, { metalness: 0.7 });
    const accentMat = mat(0xc9a961, 0.5, { metalness: 0.5 });
    let seed = 1;
    
    for (let r = 0; r < DESK_ROWS; r++) {
        for (let c = 0; c < DESK_COLS; c++) {
            const x = c * DESK_GAP - half, z = r * DESK_GAP - half;
            const group = new THREE.Group();

            // Premium wood desktop with edge banding
            const topGeo = new THREE.BoxGeometry(2.5, 0.12, 1.4);
            const top = new THREE.Mesh(topGeo, woodMat);
            top.position.y = 0.76; 
            top.castShadow = top.receiveShadow = true;
            top.name = 'deskTop';
            group.add(top);

            // Metal edge trim
            const edgeTrim = new THREE.Mesh(new THREE.BoxGeometry(2.52, 0.03, 1.42), accentMat);
            edgeTrim.position.y = 0.825;
            edgeTrim.castShadow = true;
            group.add(edgeTrim);

            // Modern adjustable legs with height mechanism
            [[-1.15, -0.62], [1.15, -0.62], [-1.15, 0.62], [1.15, 0.62]].forEach(([lx, lz]) => {
                // Main leg tube
                const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.76, 16), legMat);
                leg.position.set(lx, 0.38, lz); 
                leg.castShadow = true;
                group.add(leg);
                
                // Leg base foot
                const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.03, 16), legMat);
                foot.position.set(lx, 0.015, lz);
                foot.castShadow = true;
                group.add(foot);
                
                // Adjustment collar
                const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.05, 12), accentMat);
                collar.position.set(lx, 0.5, lz);
                group.add(collar);
            });

            // Premium ultrawide monitor setup
            const standBase = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.03, 20), legMat);
            standBase.position.set(0, 0.835, -0.42);
            standBase.castShadow = true;
            group.add(standBase);
            
            const standArm = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.38, 14), legMat);
            standArm.position.set(0, 1.0, -0.42); 
            group.add(standArm);
            
            // Monitor mount
            const mount = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.1, 0.08), legMat);
            mount.position.set(0, 1.2, -0.4);
            group.add(mount);
            
            // Ultrawide curved monitor
            const monitorBack = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.72, 0.08), mat(0x0f1318, 0.25, { metalness: 0.3 }));
            monitorBack.position.set(0, 1.28, -0.44); 
            monitorBack.castShadow = true; 
            group.add(monitorBack);
            
            // Monitor bezel
            const bezel = new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.74, 0.03), mat(0x1a1e24, 0.3, { metalness: 0.4 }));
            bezel.position.set(0, 1.28, -0.37); 
            bezel.castShadow = true; 
            group.add(bezel);
            
            // Curved screen with code
            const screenCurve = new THREE.Shape();
            screenCurve.absarc(0, 0, 2, Math.PI * 0.7, Math.PI * 0.3, true);
            screenCurve.lineTo(0.62, 0.35);
            screenCurve.lineTo(-0.62, 0.35);
            screenCurve.lineTo(-0.62, -0.35);
            screenCurve.lineTo(0.62, -0.35);
            
            const screenMat = new THREE.MeshBasicMaterial({ 
                map: codeTexture(seed++),
                toneMapped: false
            });
            const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.24, 0.66), screenMat);
            scr.position.set(0, 1.28, -0.35);
            group.add(scr);
            
            // Webcam on top
            const webcam = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.08, 12), mat(0x1a1e24, 0.4, { metalness: 0.6 }));
            webcam.rotation.z = Math.PI / 2;
            webcam.position.set(0, 1.65, -0.36);
            webcam.castShadow = true;
            group.add(webcam);
            
            // Webcam lens
            const lens = new THREE.Mesh(new THREE.CircleGeometry(0.015, 16), mat(0x1a3a5a, 0.2, { metalness: 0.7 }));
            lens.position.set(0, 1.65, -0.32);
            group.add(lens);

            // Mechanical keyboard with RGB underglow
            const kbCase = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.04, 0.32), mat(0x2a2e35, 0.55, { metalness: 0.5 }));
            kbCase.position.set(0, 0.84, 0.25);
            kbCase.castShadow = true;
            group.add(kbCase);

            const kbKeys = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.018, 0.28), mat(0x1a1e24, 0.65, { metalness: 0.3 }));
            kbKeys.position.set(0, 0.864, 0.25);
            group.add(kbKeys);
            
            // RGB underglow strip
            const rgbColors = [0xff0080, 0x00ffff, 0x00ff80, 0xff8000];
            const glowColor = rgbColors[seed % rgbColors.length];
            const underglow = new THREE.Mesh(new THREE.PlaneGeometry(0.88, 0.34), new THREE.MeshBasicMaterial({ 
                color: glowColor, 
                transparent: true, 
                opacity: 0.3,
                toneMapped: false 
            }));
            underglow.rotation.x = -Math.PI / 2;
            underglow.position.set(0, 0.823, 0.25);
            group.add(underglow);

            // Premium wireless mouse
            const mouseBody = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 0.12), mat(0x2a2e35, 0.4, { metalness: 0.6 }));
            mouseBody.position.set(0.7, 0.84, 0.3);
            mouseBody.castShadow = true;
            group.add(mouseBody);

            const mouseTop = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x1a1e24, 0.35, { metalness: 0.7 }));
            mouseTop.position.set(0.7, 0.86, 0.3);
            mouseTop.castShadow = true;
            group.add(mouseTop);

            // Mouse RGB accent
            const mouseRGB = new THREE.Mesh(new THREE.CircleGeometry(0.015, 12), new THREE.MeshBasicMaterial({ color: glowColor, toneMapped: false }));
            mouseRGB.rotation.x = -Math.PI / 2;
            mouseRGB.position.set(0.7, 0.863, 0.32);
            group.add(mouseRGB);
            
            // Premium coffee mug with brand logo
            const mugColors = [0x1a3a5a, 0x5a3a1a, 0x3a5a3a, 0x5a1a3a];
            const mugC = mugColors[seed % mugColors.length];
            const mugBody = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.058, 0.13, 20), mat(mugC, 0.45, { metalness: 0.15 }));
            mugBody.position.set(-0.95, 0.885, 0.22);
            mugBody.castShadow = true;
            group.add(mugBody);

            const mugHandle = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.012, 10, 16, Math.PI), mat(mugC, 0.45, { metalness: 0.15 }));
            mugHandle.rotation.set(0, Math.PI / 2, 0);
            mugHandle.position.set(-1.02, 0.905, 0.22);
            group.add(mugHandle);
            
            // Steam effect (subtle)
            const steam = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.04, 0.15, 8), new THREE.MeshBasicMaterial({ 
                color: 0xffffff, 
                transparent: true, 
                opacity: 0.15,
                toneMapped: false
            }));
            steam.position.set(-0.95, 1.035, 0.22);
            group.add(steam);

            // Desk accessories - phone stand
            const phoneStand = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.1), mat(0x2a2e35, 0.4, { metalness: 0.6 }));
            phoneStand.position.set(0.95, 0.86, -0.15);
            phoneStand.castShadow = true;
            group.add(phoneStand);

            // Phone
            const phone = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.15, 0.01), mat(0x1a1e24, 0.3, { metalness: 0.7 }));
            phone.rotation.x = -0.3;
            phone.position.set(0.95, 0.935, -0.15);
            phone.castShadow = true;
            group.add(phone);

            // Phone screen
            const phoneScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.075, 0.14), new THREE.MeshBasicMaterial({ color: 0x3b82f6, toneMapped: false }));
            phoneScreen.rotation.x = -0.3;
            phoneScreen.position.set(0.95, 0.935, -0.144);
            group.add(phoneScreen);

            // Ergonomic office chair - premium version
            const chairMat = mat(0x2a3442, 0.75, { metalness: 0.2 });
            const meshBackMat = mat(0x1a2432, 0.7, { metalness: 0.15 });
            const frameMat = mat(0x1a1e24, 0.35, { metalness: 0.75 });
            
            // Seat cushion with contour
            const seatGeo = new THREE.BoxGeometry(0.62, 0.1, 0.6);
            const seat = new THREE.Mesh(seatGeo, chairMat);
            seat.position.set(0, 0.52, 1.22); 
            seat.castShadow = true; 
            group.add(seat);
            
            // Seat frame
            const seatFrame = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.03, 0.62), frameMat);
            seatFrame.position.set(0, 0.575, 1.22);
            group.add(seatFrame);
            
            // Mesh backrest - modern design
            const backMesh = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.7, 0.05), meshBackMat);
            backMesh.position.set(0, 0.92, 1.53); 
            backMesh.castShadow = true; 
            group.add(backMesh);
            
            // Lumbar support
            const lumbar = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.08), chairMat);
            lumbar.position.set(0, 0.75, 1.54);
            lumbar.castShadow = true;
            group.add(lumbar);
            
            // Back frame
            const backFrame = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.73, 0.04), frameMat);
            backFrame.position.set(0, 0.92, 1.56);
            backFrame.castShadow = true;
            group.add(backFrame);
            
            // Headrest
            const headrest = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.15, 0.1), chairMat);
            headrest.position.set(0, 1.35, 1.52);
            headrest.castShadow = true;
            group.add(headrest);
            
            // Armrests
            [-0.35, 0.35].forEach(side => {
                const armPad = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 0.3), chairMat);
                armPad.position.set(side, 0.72, 1.22);
                armPad.castShadow = true;
                group.add(armPad);
                
                const armSupport = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.28, 10), frameMat);
                armSupport.position.set(side, 0.58, 1.22);
                group.add(armSupport);
            });
            
            // Gas lift cylinder
            const cylinder = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.52, 16), frameMat);
            cylinder.position.set(0, 0.26, 1.22); 
            group.add(cylinder);
            
            // Five-star base
            const starBase = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.04, 5), frameMat);
            starBase.position.set(0, 0.02, 1.22);
            starBase.castShadow = true;
            group.add(starBase);
            
            // Caster wheels
            for (let i = 0; i < 5; i++) {
                const angle = (i / 5) * Math.PI * 2;
                const wheelX = Math.cos(angle) * 0.32;
                const wheelZ = Math.sin(angle) * 0.32;
                
                const wheel = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 10), mat(0x3a3e46, 0.6, { metalness: 0.3 }));
                wheel.position.set(wheelX, 0.035, 1.22 + wheelZ);
                wheel.castShadow = true;
                group.add(wheel);
            }

            group.position.set(x, 0, z);
            group.traverse(o => { o.userData.deskRoot = group; });
            scene.add(group);
            desks.push({ x, z, occupant: null, group, top });
        }
    }
}

// ---------- meeting area: oval conference table + 6 chairs ----------
function buildMeetingArea() {
    const woodMat = mat(0x8a6d4f, 0.45, { metalness: 0.12 });
    const legMat = mat(0x2a2e35, 0.35, { metalness: 0.65 });
    const accentMat = mat(0xc9a961, 0.5, { metalness: 0.5 });

    // round rug under meeting zone
    const rug = new THREE.Mesh(new THREE.CircleGeometry(4.8, 40), mat(0x46536a, 0.96, { metalness: 0.03 }));
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(MEET_CX, 0.028, MEET_CZ);
    rug.receiveShadow = true;
    scene.add(rug);

    // oval tabletop
    const top = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.0, 0.12, 40), woodMat);
    top.scale.set(1.3, 1, 0.9);
    top.position.set(MEET_CX, 0.75, MEET_CZ);
    top.castShadow = top.receiveShadow = true;
    scene.add(top);

    // gold trim ring
    const trim = new THREE.Mesh(new THREE.TorusGeometry(2.0, 0.025, 10, 48), accentMat);
    trim.rotation.x = Math.PI / 2;
    trim.scale.set(1.3, 0.9, 1);
    trim.position.set(MEET_CX, 0.81, MEET_CZ);
    scene.add(trim);

    // pedestal base
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 0.7, 20), legMat);
    ped.position.set(MEET_CX, 0.35, MEET_CZ);
    ped.castShadow = true;
    scene.add(ped);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.2, 0.06, 28), legMat);
    disc.position.set(MEET_CX, 0.03, MEET_CZ);
    disc.castShadow = true;
    scene.add(disc);

    // centerpiece: planter + paper stacks
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.13, 0.2, 16), mat(0xf5f7fa, 0.7, { metalness: 0.1 }));
    pot.position.set(MEET_CX, 0.91, MEET_CZ);
    pot.castShadow = true;
    scene.add(pot);
    const bush = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 10), mat(0x4d8a5e, 0.85));
    bush.position.set(MEET_CX, 1.1, MEET_CZ);
    bush.castShadow = true;
    scene.add(bush);
    for (let i = 0; i < 3; i++) {
        const paper = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.012, 0.4), mat(0xf5f7fa, 0.9));
        const pa = (i / 3) * Math.PI * 2;
        paper.position.set(MEET_CX + Math.cos(pa) * 1.2, 0.82 + i * 0.005, MEET_CZ + Math.sin(pa) * 0.8);
        paper.rotation.y = pa;
        scene.add(paper);
    }

    // 6 chairs facing the table
    const chairMat = mat(0x2a3442, 0.8, { metalness: 0.15 });
    for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
        const x = MEET_CX + Math.cos(a) * 3.0, z = MEET_CZ + Math.sin(a) * 2.4;
        const g = new THREE.Group();
        const seat = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.09, 0.58), chairMat);
        seat.position.y = 0.495; seat.castShadow = true; g.add(seat);
        const back = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.6, 0.08), chairMat);
        back.position.set(0, 0.85, -0.3); back.castShadow = true; g.add(back);
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.04, 0.45, 12), legMat);
        pole.position.y = 0.24; g.add(pole);
        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.04, 5), legMat);
        base.position.y = 0.02; base.castShadow = true; g.add(base);
        g.position.set(x, 0, z);
        g.rotation.y = Math.atan2(MEET_CX - x, MEET_CZ - z);
        scene.add(g);
        MEET_CHAIRS.push({ x, z });
    }

    // pendant lamp above the table (light only, no shadow)
    const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.0, 8), legMat);
    wire.position.set(MEET_CX, 5.5, MEET_CZ);
    scene.add(wire);
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.55, 0.5, 20, 1, true), mat(0x1a1e24, 0.4, { metalness: 0.7 }));
    shade.position.set(MEET_CX, 4.75, MEET_CZ);
    scene.add(shade);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 12), new THREE.MeshBasicMaterial({ color: 0xffefc4, toneMapped: false }));
    glow.position.set(MEET_CX, 4.7, MEET_CZ);
    scene.add(glow);
    const pl = new THREE.PointLight(0xffefc4, 1.3, 10, 2);
    pl.position.set(MEET_CX, 4.6, MEET_CZ);
    pl.castShadow = false;
    scene.add(pl);
}

function buildLights() {
    // Premium LED panel ceiling lights
    const panelMat = new THREE.MeshBasicMaterial({ 
        color: 0xfffaee, 
        side: THREE.DoubleSide,
        toneMapped: false
    });
    const frameMat = mat(0x2a2e35, 0.35, { metalness: 0.6 });
    
    // Grid of modern recessed lights
    for (let row = -2; row <= 2; row++) {
        for (let col = -2; col <= 2; col++) {
            const x = col * 7;
            const z = row * 7;
            
            // Recessed frame
            const frameBox = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.12, 0.9), frameMat);
            frameBox.position.set(x, 5.94, z);
            scene.add(frameBox);

            // Light panel
            const panel = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.8), panelMat);
            panel.position.set(x, 5.88, z);
            panel.rotation.x = -Math.PI / 2;
            scene.add(panel);

            // Point light for illumination (no shadow: sun is the only shadow caster)
            if (Math.abs(row) === 2 && Math.abs(col) === 2) {
                const pt = new THREE.PointLight(0xfff5e0, 1.4, 18, 2);
                pt.position.set(x, 5.7, z);
                pt.castShadow = false;
                scene.add(pt);
            }
        }
    }
    
    // Accent strip lighting on ceiling
    const stripMat = new THREE.MeshBasicMaterial({ color: 0x4a8fff, toneMapped: false });
    
    // LED strips along walls
    [[-17.5, 0], [17.5, 0]].forEach(([x, z]) => {
        const strip = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 36), stripMat);
        strip.position.set(x, 5.95, z);
        scene.add(strip);
        
        const stripLight = new THREE.PointLight(0x6a9fff, 0.6, 12, 2);
        stripLight.position.set(x, 5.8, z);
        scene.add(stripLight);
    });
    
    [[0, -17.5]].forEach(([x, z]) => {
        const strip = new THREE.Mesh(new THREE.BoxGeometry(36, 0.05, 0.3), stripMat);
        strip.position.set(x, 5.95, z);
        scene.add(strip);
        
        const stripLight = new THREE.PointLight(0x6a9fff, 0.6, 12, 2);
        stripLight.position.set(x, 5.8, z);
        scene.add(stripLight);
    });
    
    // Pendant lights over lounge area
    const pendantMat = mat(0x1a1e24, 0.4, { metalness: 0.7 });
    const pendantGlassMat = mat(0xfff5d6, 0.3, { metalness: 0.1 });
    
    [[-15, 6.5], [15, 8]].forEach(([x, z]) => {
        // Pendant wire
        const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.2, 8), mat(0x1a1e24, 0.5, { metalness: 0.5 }));
        wire.position.set(x, 5.4, z);
        scene.add(wire);
        
        // Pendant shade
        const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 0.4, 16, 1, true), pendantMat);
        shade.position.set(x, 4.6, z);
        scene.add(shade);

        // Inner glow
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 12), pendantGlassMat);
        bulb.position.set(x, 4.6, z);
        scene.add(bulb);

        const bulbLight = new THREE.PointLight(0xffefc4, 1.2, 8, 2);
        bulbLight.position.set(x, 4.6, z);
        bulbLight.castShadow = false;
        scene.add(bulbLight);
    });
}

function buildPlants() {
    const potMat = mat(0x8a7d6f, 0.65, { metalness: 0.15 });
    const leafMat = mat(0x3d6642, 0.82, { metalness: 0.06 });
    const leafMat2 = mat(0x5a8a5e, 0.78, { metalness: 0.06 });
    const soilMat = mat(0x4a3a2a, 0.95, { metalness: 0.02 });
    
    // Large floor plants in corners
    [[-16, -16], [16, -16], [-16, 16], [16, 16]].forEach(([x, z], idx) => {
        const g = new THREE.Group();
        
        // Modern ceramic pot
        const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.32, 0.65, 24), potMat);
        pot.position.y = 0.325; 
        pot.castShadow = pot.receiveShadow = true; 
        g.add(pot);
        
        // Pot rim
        const rim = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.03, 12, 24), potMat);
        rim.rotation.x = Math.PI / 2;
        rim.position.y = 0.655;
        g.add(rim);
        
        const soil = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.04, 20), soilMat);
        soil.position.y = 0.67;
        g.add(soil);
        
        // Multiple leaf stems for fuller look
        const numStems = 8 + Math.floor(Math.random() * 4);
        for (let i = 0; i < numStems; i++) {
            const h = 1.0 + Math.random() * 0.9;
            const lMat = i % 2 === 0 ? leafMat : leafMat2;
            const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.22, h, 8), lMat);
            const a = (i / numStems) * Math.PI * 2 + Math.random() * 0.6;
            const r = 0.12 + Math.random() * 0.12;
            leaf.position.set(Math.cos(a) * r, 0.68 + h / 2, Math.sin(a) * r);
            leaf.rotation.set((Math.random() - .5) * 0.45, 0, (Math.random() - .5) * 0.45);
            leaf.castShadow = true; 
            g.add(leaf);
        }
        
        g.position.set(x, 0, z);
        scene.add(g);
    });
    
    // Desk plants - small modern planters
    const deskPotMat = mat(0xf5f7fa, 0.7, { metalness: 0.1 });
    const smallLeafMat = mat(0x4d8a5e, 0.85, { metalness: 0.05 });
    
    // Add small plants near some desks
    [[8, 8], [-8, -8], [8, -8], [-8, 8], [0, 0]].forEach(([x, z]) => {
        const g = new THREE.Group();
        
        const smallPot = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.15, 16), deskPotMat);
        smallPot.position.y = 0.075;
        smallPot.castShadow = true;
        g.add(smallPot);
        
        // Succulent-style leaves
        for (let i = 0; i < 6; i++) {
            const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), smallLeafMat);
            const a = (i / 6) * Math.PI * 2;
            leaf.position.set(Math.cos(a) * 0.05, 0.15, Math.sin(a) * 0.05);
            leaf.scale.set(1, 0.6, 1.2);
            leaf.castShadow = true;
            g.add(leaf);
        }
        
        g.position.set(x, 0.8, z + 0.5);
        scene.add(g);
    });
    
    // Hanging plants from ceiling
    const hangPotMat = mat(0xd4c4b0, 0.75, { metalness: 0.12 });
    const vineLeafMat = mat(0x5a9d6e, 0.82, { metalness: 0.06 });
    
    [[-10, -10], [10, -10], [-10, 10], [10, 10]].forEach(([x, z]) => {
        const g = new THREE.Group();
        
        // Hanging pot
        const hangPot = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), hangPotMat);
        hangPot.position.y = 5.2;
        hangPot.castShadow = true;
        g.add(hangPot);
        
        // Rope/chain
        const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.8, 8), mat(0x4a4640, 0.8, { metalness: 0.1 }));
        rope.position.y = 5.6;
        g.add(rope);
        
        // Trailing vines
        for (let i = 0; i < 5; i++) {
            const vineLength = 0.8 + Math.random() * 0.6;
            const segments = 6;
            for (let j = 0; j < segments; j++) {
                const vineLeaf = new THREE.Mesh(new THREE.SphereGeometry(0.06 - j * 0.008, 8, 6), vineLeafMat);
                const a = (i / 5) * Math.PI * 2 + Math.random() * 0.3;
                const offset = j * 0.12;
                vineLeaf.position.set(
                    Math.cos(a) * 0.15 + Math.random() * 0.05,
                    5.2 - offset,
                    Math.sin(a) * 0.15 + Math.random() * 0.05
                );
                vineLeaf.scale.set(1.2, 0.8, 1);
                vineLeaf.castShadow = true;
                g.add(vineLeaf);
            }
        }
        
        g.position.set(x, 0, z);
        scene.add(g);
    });
}

// ---------- subtle sun dust ----------
function initDust() {
    const N = 120;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
        pos[i * 3] = (Math.random() - .5) * 26;
        pos[i * 3 + 1] = Math.random() * 5 + 0.3;
        pos[i * 3 + 2] = (Math.random() - .5) * 26;
        dustVel.push((Math.random() - .5) * 0.05);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    dustPts = new THREE.Points(geo, new THREE.PointsMaterial({
        color: 0xffe9c4, size: 0.045, transparent: true, opacity: 0.2, depthWrite: false
    }));
    scene.add(dustPts);
}

// ---------- agent: proportional human ~1.7m ----------
class Agent3D {
    constructor(data) {
        this.id = data.id;
        this.name = data.name;
        this.role = data.role || 'Developer';
        this.task = data.task || '';
        this.status = data.status || 'idle';
        this.progress = data.progress || 0;
        this.logs = data.logs || [];
        this.output = data.output || '';

        const rc = ROLE_CONFIG[this.role] || ROLE_CONFIG.Developer;
        this.skin = SKINS[this.id % SKINS.length];
        this.hairC = HAIRS[(this.id >> 2) % HAIRS.length];

        this.group = new THREE.Group();
        this.group.userData.agentId = this.id;
        this.buildModel(rc.color);
        this.group.traverse(o => { o.userData.agentId = this.id; });
        // body variety: height 0.93-1.07, shoulder width 0.96-1.04
        this.group.scale.set(0.96 + (this.id % 3) * 0.04, 0.93 + (this.id % 5) * 0.035, 1);
        scene.add(this.group);

        const desk = desks.find(d => !d.occupant) || desks[this.id % desks.length];
        this.desk = desk;
        desk.occupant = this;
        this.queue = [];
        this.idleT = 2;
        this.wave = 0;
        this.meeting = false;
        this.meetLine = '';
        this.seatIdx = -1;
        // enter through the door, walk the aisles to the seat
        this.group.position.set(10, 0, 13);
        this.target = new THREE.Vector3(desk.x, 0, desk.z + 1.15);
        this.walkLane(desk.x, desk.z + 1.15);
        this.faceTowards(desk.x, desk.z);
        this.phase = Math.random() * Math.PI * 2;
    }

    limb(r1, r2, len, m) {
        const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, len, 16), m);
        mesh.castShadow = true;
        return mesh;
    }

    buildModel(shirtColor) {
        const g = this.group;
        const shirt = new THREE.MeshStandardMaterial({ 
            color: shirtColor, 
            roughness: 0.75, 
            metalness: 0.05,
            envMapIntensity: 0.4
        });
        this.shirtMat = shirt;
        const skinM = new THREE.MeshStandardMaterial({ 
            color: this.skin, 
            roughness: 0.55, 
            metalness: 0.01,
            envMapIntensity: 0.3 
        });
        const pantsM = new THREE.MeshStandardMaterial({ 
            color: TROUSER, 
            roughness: 0.7, 
            metalness: 0.02,
            envMapIntensity: 0.3
        });
        const hairM = new THREE.MeshStandardMaterial({ 
            color: this.hairC, 
            roughness: 0.6, 
            metalness: 0.12,
            envMapIntensity: 0.5
        });

        // Hip pivots: rotate at hip (y=0.85), mesh hangs below. Fixes
        // old bug where leg cylinder rotated around its middle.
        const mkLeg = side => {
            const hip = new THREE.Group();
            hip.position.set(0.13 * side, 0.85, 0);
            const leg = this.limb(0.08, 0.07, 0.85, pantsM);
            leg.position.y = -0.425;
            hip.add(leg);
            g.add(hip);
            return { hip, leg };
        };
        const legL = mkLeg(-1), legR = mkLeg(1);
        this.hipL = legL.hip; this.legL = legL.leg;
        this.hipR = legR.hip; this.legR = legR.leg;
        
        const shoeColors = [0x1a1612, 0x26211c, 0x3a2f28, 0x4a3c2e];
        const shoeColor = shoeColors[this.id % shoeColors.length];
        const shoeM = new THREE.MeshStandardMaterial({ 
            color: shoeColor, 
            roughness: 0.4, 
            metalness: 0.15,
            envMapIntensity: 0.6
        });
        this.shoes = [];
        [[this.hipL, -1], [this.hipR, 1]].forEach(([hip]) => {
            const toe = new THREE.Mesh(new THREE.SphereGeometry(0.068, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2), shoeM);
            toe.position.set(0, -0.782, 0.1);
            toe.rotation.x = Math.PI / 2;
            toe.castShadow = true;
            hip.add(toe);
            const base = new THREE.Mesh(new THREE.BoxGeometry(0.135, 0.068, 0.24), shoeM);
            base.position.set(0, -0.816, 0.02);
            base.castShadow = true;
            hip.add(base);
            this.shoes.push({ m: toe, by: -0.782, bz: 0.1 }, { m: base, by: -0.816, bz: 0.02 });
        });

        const torsoGeo = new THREE.CylinderGeometry(0.22, 0.26, 0.62, 20);
        const torso = new THREE.Mesh(torsoGeo, shirt);
        torso.position.y = 1.12; 
        torso.castShadow = true; 
        g.add(torso);
        this.torso = torso;

        const neckGeo = new THREE.CylinderGeometry(0.065, 0.075, 0.12, 12);
        const neck = new THREE.Mesh(neckGeo, skinM);
        neck.position.y = 1.49;
        neck.castShadow = true;
        g.add(neck);

        const mkArm = side => {
            const pivot = new THREE.Group();
            pivot.position.set(0.28 * side, 1.35, 0);
            const upper = this.limb(0.065, 0.058, 0.35, shirt);
            upper.position.y = -0.175; 
            pivot.add(upper);
            const forearm = this.limb(0.055, 0.05, 0.32, skinM);
            forearm.position.y = -0.51;
            pivot.add(forearm);
            const handGeo = new THREE.SphereGeometry(0.062, 14, 12);
            const hand = new THREE.Mesh(handGeo, skinM);
            hand.position.y = -0.68; 
            hand.scale.set(1, 1.15, 0.85);
            hand.castShadow = true; 
            pivot.add(hand);
            pivot.rotation.z = side * 0.1;
            g.add(pivot);
            return pivot;
        };
        this.armL = mkArm(-1); 
        this.armR = mkArm(1);

        // Head group: skull + face in ONE pivot so nod/look never
        // tears the face apart (old bug: only skull rotated).
        const headG = new THREE.Group();
        headG.position.y = 1.62;
        g.add(headG);
        this.headG = headG;
        const headGeo = new THREE.SphereGeometry(0.145, 28, 24);
        this.head = new THREE.Mesh(headGeo, skinM);
        this.head.scale.set(1, 1.1, 0.95);
        this.head.castShadow = true; 
        headG.add(this.head);

        const noseGeo = new THREE.SphereGeometry(0.022, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2);
        const nose = new THREE.Mesh(noseGeo, skinM);
        nose.position.set(0, -0.015, 0.135);
        nose.rotation.x = -Math.PI / 2;
        nose.scale.set(0.9, 1.2, 1);
        headG.add(nose);

        const earGeo = new THREE.SphereGeometry(0.032, 10, 8);
        [-1, 1].forEach(side => {
            const ear = new THREE.Mesh(earGeo, skinM);
            ear.position.set(0.145 * side, 0, 0.02);
            ear.scale.set(0.6, 1, 0.8);
            ear.castShadow = true;
            headG.add(ear);
        });

        // Cap (one style for all, no hair): crown + brim + button
        const capM = new THREE.MeshStandardMaterial({
            color: 0x2e3a4d,
            roughness: 0.85,
            metalness: 0.02
        });
        const crown = new THREE.Mesh(new THREE.SphereGeometry(0.156, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.55), capM);
        crown.position.y = 0.02;
        crown.scale.set(1, 0.9, 1);
        crown.castShadow = true;
        headG.add(crown);
        const brim = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.022, 0.13), capM);
        brim.position.set(0, 0.045, 0.2);
        brim.castShadow = true;
        headG.add(brim);
        const capBtn = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), capM);
        capBtn.position.set(0, 0.163, -0.01);
        headG.add(capBtn);

        const eyeWhiteGeo = new THREE.SphereGeometry(0.028, 12, 10);
        const eyeWhiteM = new THREE.MeshStandardMaterial({ color: 0xf8f8f8, roughness: 0.3, metalness: 0.05 });
        const irisM = new THREE.MeshStandardMaterial({ color: 0x4a3728, roughness: 0.4, metalness: 0.1 });
        const pupilM = new THREE.MeshBasicMaterial({ color: 0x0a0a0a });

        this.eyes = [];
        [-0.055, 0.055].forEach(ex => {
            const eyeWhite = new THREE.Mesh(eyeWhiteGeo, eyeWhiteM);
            eyeWhite.position.set(ex, 0.015, 0.125);
            eyeWhite.scale.set(0.85, 1, 0.6);
            headG.add(eyeWhite);

            const iris = new THREE.Mesh(new THREE.CircleGeometry(0.016, 16), irisM);
            iris.position.set(ex, 0.015, 0.145);
            headG.add(iris);

            const pupil = new THREE.Mesh(new THREE.CircleGeometry(0.008, 12), pupilM);
            pupil.position.set(ex, 0.015, 0.147);
            headG.add(pupil);

            const eyeData = { white: eyeWhite, iris, pupil, bx: ex };
            eyeData.white.userData.bx = ex;
            this.eyes.push(eyeData);
        });

        const browM = new THREE.MeshStandardMaterial({ color: 0x2b2118, roughness: 0.8 });
        [-0.055, 0.055].forEach(ex => {
            const brow = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.012, 0.008), browM);
            brow.position.set(ex, 0.06, 0.135);
            brow.rotation.z = ex > 0 ? -0.1 : 0.1;
            headG.add(brow);
        });

        const mouthCurve = new THREE.Shape();
        mouthCurve.moveTo(-0.03, 0);
        mouthCurve.quadraticCurveTo(0, -0.008, 0.03, 0);
        const mouthGeo = new THREE.ShapeGeometry(mouthCurve);
        const mouthM = new THREE.MeshBasicMaterial({ color: 0x8a5a44, side: THREE.DoubleSide });
        const mouth = new THREE.Mesh(mouthGeo, mouthM);
        mouth.position.set(0, -0.06, 0.138);
        headG.add(mouth);

        this.blinkT = 1.5 + Math.random() * 3; 
        this.blinkPhase = 0; 
        this.lookK = 0;

        if (this.id % 10 < 3) {
            const glassMat = mat(0x2a2a2a, 0.25, { metalness: 0.7, envMapIntensity: 0.8 });
            const lensM = new THREE.MeshStandardMaterial({ 
                color: 0x8ba5b8, 
                roughness: 0.1, 
                metalness: 0.05, 
                transparent: true, 
                opacity: 0.3,
                envMapIntensity: 1.0
            });
            [-0.055, 0.055].forEach(ex => {
                const frame = new THREE.Mesh(new THREE.TorusGeometry(0.048, 0.01, 8, 16), glassMat);
                frame.position.set(ex, 0.015, 0.125);
                frame.rotation.y = Math.PI / 2;
                frame.castShadow = true;
                headG.add(frame);
                const lens = new THREE.Mesh(new THREE.CircleGeometry(0.046, 20), lensM);
                lens.position.set(ex, 0.015, 0.126);
                headG.add(lens);
            });
            const bridge = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.09, 10), glassMat);
            bridge.position.set(0, 0.015, 0.125);
            bridge.rotation.z = Math.PI / 2;
            headG.add(bridge);
        }

        const lanyardMat = mat(0x4a6fa5, 0.65, { metalness: 0.1 });
        const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.3, 10), lanyardMat);
        cord.position.set(0, 1.27, 0.05); 
        g.add(cord);
        const card = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.09, 0.012), mat(0xf8f9fa, 0.7, { metalness: 0.05 }));
        card.position.set(0, 1.1, 0.08); 
        card.castShadow = true; 
        g.add(card);

        const pinGeo = new THREE.CircleGeometry(0.038, 18);
        this.pin = new THREE.Mesh(pinGeo, new THREE.MeshBasicMaterial({ 
            color: STATUS_COLOR[this.status] || 0x9ca3af,
            transparent: true,
            opacity: 0.9
        }));
        this.pin.position.set(0.12, 1.25, 0.235); 
        g.add(this.pin);

        // Name sprite (neutral dark, no neon)
        const cv = document.createElement('canvas');
        cv.width = 256; cv.height = 64;
        const ctx = cv.getContext('2d');
        ctx.fillStyle = 'rgba(17,24,39,0.88)';
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(4, 4, 248, 56, 12); else ctx.rect(4, 4, 248, 56);
        ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = 'bold 24px system-ui, sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(String(this.name).slice(0, 16), 128, 32);
        ctx.fillStyle = '#cbd5e1'; ctx.font = '16px system-ui, sans-serif';
        ctx.fillText(this.role, 128, 52);
        const tex = new THREE.CanvasTexture(cv);
        tex.encoding = THREE.sRGBEncoding;
        this.tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
        this.tag.scale.set(1.25, 0.31, 1);
        this.tag.position.y = 2.0;
        g.add(this.tag);

        // Progress ring sprite above head
        this.ringCanvas = document.createElement('canvas');
        this.ringCanvas.width = this.ringCanvas.height = 128;
        const rtex = new THREE.CanvasTexture(this.ringCanvas);
        rtex.encoding = THREE.sRGBEncoding;
        this.ring = new THREE.Sprite(new THREE.SpriteMaterial({ map: rtex, transparent: true, depthTest: false }));
        this.ring.scale.set(0.34, 0.34, 1);
        this.ring.position.y = 1.86;
        g.add(this.ring);
        this.drawRing();

        // Chat bubble sprite above name tag
        this.bubbleCanvas = document.createElement('canvas');
        this.bubbleCanvas.width = 512;
        this.bubbleCanvas.height = 128;
        const btex = new THREE.CanvasTexture(this.bubbleCanvas);
        btex.encoding = THREE.sRGBEncoding;
        this.bubble = new THREE.Sprite(new THREE.SpriteMaterial({ map: btex, transparent: true, depthTest: false }));
        this.bubble.scale.set(2.0, 0.5, 1);
        this.bubble.position.y = 2.42;
        this.bubble.visible = false;
        g.add(this.bubble);
        this.bubbleText = '';
        this.bubbleReveal = 0;
        this.bubbleDotPhase = 0;
    }

    drawRing() {
        const ctx = this.ringCanvas.getContext('2d');
        ctx.clearRect(0, 0, 128, 128);
        ctx.lineWidth = 10;
        ctx.strokeStyle = 'rgba(255,255,255,0.75)';
        ctx.beginPath(); ctx.arc(64, 64, 48, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = STATUS_CSS[this.status] || '#9ca3af';
        ctx.beginPath(); ctx.arc(64, 64, 48, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (this.progress / 100)); ctx.stroke();
        this.ring.material.map.needsUpdate = true;
        this.pin.material.color.setHex(STATUS_COLOR[this.status] || 0x9ca3af);
    }

    drawBubble() {
        const ctx = this.bubbleCanvas.getContext('2d');
        ctx.clearRect(0, 0, 512, 128);

        let snippet = null;
        if (this.meeting && this.meetLine) snippet = String(this.meetLine).slice(0, 64);
        else if (this.status === 'working' && this.task) snippet = String(this.task).slice(0, 64);
        else { this.bubble.visible = false; return; }

        this.bubble.visible = true;
        const taskSnippet = snippet;
        const revealed = Math.floor(this.bubbleReveal);
        const text = taskSnippet.slice(0, revealed);
        const dots = '.'.repeat(Math.floor(this.bubbleDotPhase % 4));

        // Bubble background with tail
        const w = 480, h = 96, r = 20, pad = 16;
        ctx.fillStyle = 'rgba(26,29,35,0.92)';
        ctx.strokeStyle = 'rgba(217,164,65,0.4)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        if (ctx.roundRect) {
            ctx.roundRect(pad, pad, w, h, r);
        } else {
            ctx.rect(pad, pad, w, h);
        }
        ctx.fill();
        ctx.stroke();

        // Tail pointing down
        ctx.fillStyle = 'rgba(26,29,35,0.92)';
        ctx.beginPath();
        ctx.moveTo(256, pad + h);
        ctx.lineTo(246, pad + h + 12);
        ctx.lineTo(266, pad + h);
        ctx.closePath();
        ctx.fill();

        // Text with typewriter
        ctx.fillStyle = '#e8eaed';
        ctx.font = '18px system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        const lines = this.wrapText(ctx, text + dots, w - 32);
        lines.slice(0, 2).forEach((line, i) => {
            ctx.fillText(line, pad + 16, pad + 16 + i * 26);
        });

        this.bubble.material.map.needsUpdate = true;
    }

    wrapText(ctx, txt, maxW) {
        const words = txt.split(' ');
        const lines = [];
        let line = '';
        for (const w of words) {
            const test = line + (line ? ' ' : '') + w;
            if (ctx.measureText(test).width > maxW && line) {
                lines.push(line);
                line = w;
            } else {
                line = test;
            }
        }
        if (line) lines.push(line);
        return lines;
    }

    faceTowards(x, z, dt, rate = 8) {
        const want = Math.atan2(x - this.group.position.x, z - this.group.position.z);
        let d = want - this.group.rotation.y;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        // smooth turn (no snap at lane corners); instant only when dt missing
        this.group.rotation.y += dt ? d * Math.min(1, dt * rate) : d;
    }
    walkTo(x, z) { this.target.set(x, 0, z); }

    // Manhattan walk along aisles so agents never cut through desks
    walkLane(tx, tz) {
        const cx = this.group.position.x, cz = this.group.position.z;
        const laneZ = nearLane(LANE_Z, cz), laneX = nearLane(LANE_X, tx);
        const legs = [{ x: cx, z: laneZ }, { x: laneX, z: laneZ }, { x: laneX, z: tz }, { x: tx, z: tz }];
        const first = legs.shift();
        this.target.set(first.x, 0, first.z);
        legs.forEach(p => this.queue.push(p));
    }

    updateFace(dt) {
        this.blinkT -= dt;
        if (this.blinkT <= 0) { 
            this.blinkT = 2 + Math.random() * 3; 
            this.blinkPhase = 0.15; 
        }
        if (this.blinkPhase > 0) this.blinkPhase -= dt * 8;
        const shut = this.blinkPhase > 0 ? Math.max(0.05, 1 - this.blinkPhase * 8) : 1;
        const want = (typeof hovered !== 'undefined' && hovered === this) ? 1 : 0;
        this.lookK += (want - this.lookK) * Math.min(dt * 6, 1);
        
        this.eyes.forEach(eyeData => {
            eyeData.white.scale.y = shut;
            const offsetX = pointer.x * 0.015 * this.lookK;
            const offsetY = pointer.y * 0.008 * this.lookK;
            eyeData.iris.position.x = eyeData.white.userData.bx + offsetX;
            eyeData.iris.position.y = 0.015 + offsetY;
            eyeData.pupil.position.x = eyeData.white.userData.bx + offsetX;
            eyeData.pupil.position.y = 0.015 + offsetY;
        });
        this.headG.rotation.y = pointer.x * 0.3 * this.lookK;
        this.headG.rotation.x = pointer.y * 0.12 * this.lookK;
        this.torso.position.x = Math.sin(this.phase * 0.5) * 0.018;
    }

    setStatus(status, progress) {
        const prev = this.status;
        this.status = status;
        if (progress !== undefined && progress !== null) this.progress = progress;
        this.drawRing();
        if (status !== 'working') this.idleT = 1;
        if (status === 'completed' && prev !== 'completed') { this.bounce = 0.6; playComplete(); }
        if (status === 'working' && prev !== 'working') {
            this.bubbleReveal = 0; // reset typewriter
        }
        this.drawBubble();
    }

    update(dt, t) {
        const pos = this.group.position;
        if (Math.hypot(this.target.x - pos.x, this.target.z - pos.z) <= 0.12 && this.queue.length) {
            const n = this.queue.shift();
            this.target.set(n.x, 0, n.z);
        }
        const dx = this.target.x - pos.x, dz = this.target.z - pos.z;
        const dist = Math.hypot(dx, dz);
        this.walking = dist > 0.12;

        // Bubble typewriter + animated dots
        const chatSrc = this.meeting ? this.meetLine : (this.status === 'working' ? this.task : null);
        if (chatSrc) {
            const taskLen = Math.min(String(chatSrc).length, 64);
            if (this.bubbleReveal < taskLen) {
                this.bubbleReveal += dt * 18; // ~18 chars/sec
            }
            this.bubbleDotPhase += dt * 2;
            if (Math.floor(this.bubbleDotPhase) % 8 === 0 || this.bubbleReveal >= taskLen - 1) {
                this.drawBubble();
            }
        }

        if (this.walking) {
            const base = this.status === 'working' ? 2.2 : 1.25;
            // ease-out near waypoint: no abrupt stop
            const slow = Math.max(0.35, Math.min(1, dist / 1.2));
            const speed = base * slow;
            pos.x += (dx / dist) * speed * dt;
            pos.z += (dz / dist) * speed * dt;
            this.faceTowards(this.target.x, this.target.z, dt, 6);
            this.phase += dt * (4 + speed * 2.6);
            // double-frequency low bob (no hopping) + lean + sway
            pos.y = Math.abs(Math.cos(this.phase)) * 0.028;
            const sw = Math.sin(this.phase) * 0.45;
            this.hipL.rotation.x = sw; this.hipR.rotation.x = -sw;
            this.armL.rotation.x = -sw * 0.55; this.armR.rotation.x = sw * 0.55;
            this.armL.rotation.z += (-0.1 - this.armL.rotation.z) * Math.min(dt * 6, 1);
            this.armR.rotation.z += (0.1 - this.armR.rotation.z) * Math.min(dt * 6, 1);
            this.torso.rotation.x = 0.05;
            this.torso.rotation.z = Math.sin(this.phase) * 0.02;
            (this.shoes || []).forEach(s => {
                s.m.position.y += (s.by - s.m.position.y) * Math.min(dt * 6, 1);
                s.m.position.z += (s.bz - s.m.position.z) * Math.min(dt * 6, 1);
            });
        } else {
            this.phase += dt * 2;
            pos.y *= 0.8;
            this.torso.rotation.x *= 0.9;
            this.torso.rotation.z *= 0.9;
            this.updateFace(dt);
            // breathing: torso scale
            const br = 1 + Math.sin(this.phase) * 0.012;
            this.torso.scale.set(br, 1, br);
            this.hipL.rotation.x *= 0.8; this.hipR.rotation.x *= 0.8;

            if (this.wave > 0) {
                this.wave -= dt;
                this.armR.rotation.set(Math.sin(t * 14) * 0.5, 0, -2.1);
                this.armL.rotation.z = -0.12;
                this.headG.rotation.x = -0.05;
            } else if (this.meeting) {
                this.faceTowards(MEET_CX, MEET_CZ, dt, 4);
                const ch = (this.seatIdx >= 0 && this.seatIdx < 6 && MEET_CHAIRS[this.seatIdx]) ? MEET_CHAIRS[this.seatIdx] : null;
                if (ch) {
                    // sit on assigned chair
                    const k = Math.min(dt * 4, 1), lk = Math.min(dt * 5, 1);
                    pos.x += (ch.x - pos.x) * k;
                    pos.z += (ch.z - pos.z) * k;
                    pos.y += (-0.30 - pos.y) * k;
                    this.hipL.rotation.x += (-1.35 - this.hipL.rotation.x) * lk;
                    this.hipR.rotation.x += (-1.35 - this.hipR.rotation.x) * lk;
                    (this.shoes || []).forEach(s => {
                        s.m.position.y += ((s.by + 0.30) - s.m.position.y) * lk;
                        s.m.position.z += ((s.bz + 0.40) - s.m.position.z) * lk;
                    });
                    this.armL.rotation.x += (-0.4 - this.armL.rotation.x) * lk;
                    this.armR.rotation.x += (-0.4 - this.armR.rotation.x) * lk;
                    this.headG.rotation.x *= 0.9;
                } else {
                    // overflow: stand around the table
                    const ty = Math.sin(t * 6 + this.phase) * 0.12;
                    this.armL.rotation.x = -0.25 + ty;
                    this.armR.rotation.x = -0.25 - ty;
                    this.headG.rotation.x = 0.02 + Math.sin(t * 2) * 0.02;
                }
            } else if (this.status === 'working') {
                this.faceTowards(this.desk.x, this.desk.z, dt, 5);
                // both hands forward to keyboard, small independent taps.
                // old bug: antisymmetric swing read as one arm pumping back.
                const tapL = Math.sin(t * 7 + this.phase) * 0.025 + Math.sin(t * 13 + this.phase * 2) * 0.012;
                const tapR = Math.sin(t * 7.7 + this.phase + 1.3) * 0.025 + Math.sin(t * 11 + this.phase) * 0.012;
                this.armL.rotation.x = -0.82 + tapL;
                this.armR.rotation.x = -0.82 + tapR;
                this.armL.rotation.z = 0.28;
                this.armR.rotation.z = -0.28;
                this.headG.rotation.x = 0.14 + Math.sin(t * 3) * 0.02;
            } else {
                this.armL.rotation.x *= 0.9; this.armR.rotation.x *= 0.9;
                this.armL.rotation.z += (-0.1 - this.armL.rotation.z) * 0.1;
                this.armR.rotation.z += (0.1 - this.armR.rotation.z) * 0.1;
                this.headG.rotation.x *= 0.9;
            }
            if (this.bounce > 0) {
                this.bounce -= dt;
                pos.y = Math.abs(Math.sin(this.bounce * 10)) * 0.12;
            }
            // non-working agents stroll the aisles (not while in a meeting)
            if (this.status !== 'working' && !this.meeting) {
                this.idleT -= dt;
                if (this.idleT <= 0) {
                    this.idleT = 2.5 + Math.random() * 4;
                    this.walkLane(
                        LANE_X[Math.floor(Math.random() * LANE_X.length)],
                        LANE_Z[Math.floor(Math.random() * LANE_Z.length)]
                    );
                }
            }
        }
        // tag faces camera automatically (sprite)
    }

    dispose() {
        if (this.desk) this.desk.occupant = null;
        scene.remove(this.group);
        this.group.traverse(o => {
            if (o.geometry) o.geometry.dispose();
            if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (m.map) m.map.dispose(); m.dispose(); });
        });
    }
}

// ---------- hover + click focus ----------
function agentAt(e) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects([...agents.values()].map(a => a.group), true);
    if (!hits.length) return null;
    const id = hits[0].object.userData.agentId;
    return agents.get(id) || null;
}

function doHover() {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((lastClient.x - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((lastClient.y - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects([...agents.values()].map(a => a.group), true);
    const tip = document.getElementById('tooltip');
    const cont = document.getElementById('canvas-container').getBoundingClientRect();

    if (hovered && (!hits.length || hits[0].object.userData.agentId !== hovered.id)) {
        hovered.shirtMat.emissive.setHex(0x000000);
        hovered = null;
    }
    if (hits.length) {
        const a = agents.get(hits[0].object.userData.agentId);
        if (a) {
            if (hovered !== a) {
                hovered = a;
                a.shirtMat.emissive.setHex(0x2a1f0a);
                playClick();
            }
            tip.style.display = 'block';
            tip.style.left = (lastClient.x - cont.left + 16) + 'px';
            tip.style.top = (lastClient.y - cont.top + 12) + 'px';
            tip.innerHTML = `<b>${a.name}</b> Â· ${a.role}\n${a.status} Â· ${Math.round(a.progress)}%\n${String(a.task).slice(0, 90)}`;
            renderer.domElement.style.cursor = 'pointer';
            return;
        }
    }
    tip.style.display = 'none';
    renderer.domElement.style.cursor = 'grab';
}

function handleClick(e) {
    const a = agentAt(e);
    if (a) { focusAgent(a); openModal(a); playClick(); }
    else clearFocus();
}

function focusAgent(a) {
    focused = a;
    a.wave = 1.2;
    document.getElementById('focus-bar').classList.add('active');
    document.getElementById('focus-label').textContent = `Fokus: ${a.name} â€” ${a.role}`;
    const p = a.group.position;
    flyTo(new THREE.Vector3(p.x + 2.6, 2.4, p.z + 2.6), new THREE.Vector3(p.x, 1.3, p.z));
    controls.autoRotate = false;
    document.getElementById('btn-rotate').classList.remove('on');
}

function clearFocus() {
    if (!focused) return;
    focused = null;
    document.getElementById('focus-bar').classList.remove('active');
}

function flyTo(toPos, toTg, dur = 0.9) {
    camTween = {
        t: 0, dur,
        fromPos: camera.position.clone(), toPos,
        fromTg: controls.target.clone(), toTg
    };
}

// ---------- loop ----------
function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;

    if (hoverDirty) { hoverDirty = false; doHover(); }

    if (camTween) {
        camTween.t += dt;
        const k = Math.min(camTween.t / camTween.dur, 1);
        const e = 1 - Math.pow(1 - k, 3);
        camera.position.lerpVectors(camTween.fromPos, camTween.toPos, e);
        controls.target.lerpVectors(camTween.fromTg, camTween.toTg, e);
        if (k >= 1) camTween = null;
    }

    agents.forEach(a => a.update(dt, t));

    if (dustPts) {
        const arr = dustPts.geometry.attributes.position.array;
        for (let i = 0; i < dustVel.length; i++) {
            arr[i * 3 + 1] += dustVel[i] * dt * 2;
            if (arr[i * 3 + 1] > 5.5) arr[i * 3 + 1] = 0.3;
        }
        dustPts.geometry.attributes.position.needsUpdate = true;
    }

    // follow focused agent if it walks
    if (focused && !camTween) {
        const p = focused.group.position;
        controls.target.lerp(new THREE.Vector3(p.x, 1.3, p.z), 0.06);
    }

    controls.update();
    renderer.render(scene, camera);
}

function onResize() {
    const c = document.getElementById('canvas-container');
    camera.aspect = c.clientWidth / c.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(c.clientWidth, c.clientHeight);
}

// ---------- camera buttons ----------
function resetCamera() {
    clearFocus();
    controls.autoRotate = false;
    document.getElementById('btn-rotate').classList.remove('on');
    flyTo(new THREE.Vector3(9.5, 8, 9.5), new THREE.Vector3(0, 1, 0));
    playClick();
}
function toggleAutoRotate() {
    controls.autoRotate = !controls.autoRotate;
    controls.autoRotateSpeed = 1.2;
    document.getElementById('btn-rotate').classList.toggle('on', controls.autoRotate);
    playClick();
}
function toggleTopView() {
    flyTo(new THREE.Vector3(0.01, 24, 0.01), new THREE.Vector3(0, 0, 0));
    playClick();
}
function toggleFullscreen() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen();
    else document.exitFullscreen();
    playClick();
}

// ---------- meeting: gather, converse, disperse ----------
function meetSpot(i) {
    if (i < 6 && MEET_CHAIRS[i]) return { x: MEET_CHAIRS[i].x, z: MEET_CHAIRS[i].z };
    if (i < 6) {
        const a = (i / 6) * Math.PI * 2;
        return { x: MEET_CX + Math.cos(a) * 3.3, z: MEET_CZ + Math.sin(a) * 2.6 };
    }
    const a = ((i - 6) / 8) * Math.PI * 2 + 0.4;
    return { x: MEET_CX + Math.cos(a) * 4.6, z: MEET_CZ + Math.sin(a) * 3.8 };
}

function toggleMeeting() {
    if (meeting.active) endMeeting();
    else startMeeting();
    playClick();
}

function startMeeting() {
    if (!agents.size) { addGlobalLog('Belum ada agen untuk rapat.'); return; }
    meeting.active = true;
    meeting.speaker = 0;
    let i = 0;
    agents.forEach(a => {
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

function speakNext() {
    if (!meeting.active) return;
    const gathered = [...agents.values()].filter(a => a.meeting && !a.walking);
    if (!gathered.length) return;
    meeting.speaker = (meeting.speaker + 1) % gathered.length;
    const a = gathered[meeting.speaker];
    a.meetLine = MEET_LINES[Math.floor(Math.random() * MEET_LINES.length)];
    a.bubbleReveal = 0;
    a.bubbleDotPhase = 0;
    a.drawBubble();
    a.wave = 0.8;
}

function endMeeting() {
    meeting.active = false;
    if (meeting.timer) { clearInterval(meeting.timer); meeting.timer = null; }
    agents.forEach(a => {
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

// ---------- websocket ----------
function connectWS() {
    const wsProto = location.protocol === 'https:' ? 'wss' : 'ws';
    const sock = new WebSocket(`${wsProto}://${WS_URL}`);
    ws = sock;
    sock.onopen = () => setConn(true);
    sock.onclose = () => { setConn(false); setTimeout(connectWS, 3000); };
    sock.onerror = () => {};
    sock.onmessage = ev => {
        let data; try { data = JSON.parse(ev.data); } catch { return; }
        handleWS(data);
    };
}

function setConn(ok) {
    const el = document.getElementById('connection-status');
    el.className = ok ? 'connected' : 'disconnected';
    el.querySelector('span').textContent = ok ? 'Terhubung' : 'Terputus';
}

function handleWS({ type, agent, agentId, agents: list }) {
    switch (type) {
        case 'init': (list || []).forEach(a => addAgent(a)); break;
        case 'agent_spawn':
            addAgent(agent); playSpawn();
            addGlobalLog(`${agent.name} mulai â€” "${agent.task}"`);
            break;
        case 'agent_update': updateAgent(agent); break;
        case 'agent_complete':
            updateAgent(agent);
            if (agent.status === 'completed') {
                stats.completed++;
                addGlobalLog(`${agent.name} selesai (${agent.duration ?? '?'} dtk)`);
                showToast(agent, 'completed');
            } else if (agent.status === 'error') {
                addGlobalLog(`${agent.name} gagal`);
                showToast(agent, 'error');
            }
            break;
        case 'agent_removed': {
            const a = agents.get(agentId);
            if (a) {
                if (focused === a) clearFocus();
                if (hovered === a) hovered = null;
                addGlobalLog(`${a.name} keluar kantor`);
                a.dispose(); agents.delete(agentId); renderAgents();
            }
            break;
        }
    }
    updateStats();
}

function addAgent(data) {
    if (agents.has(data.id)) { updateAgent(data); return; }
    const a = new Agent3D(data);
    agents.set(data.id, a);
    a.setStatus(data.status, data.progress);
    if (data.status === 'working') {
        const free = desks.filter(d => !d.occupant || d.occupant === a);
        const spot = free.length ? free[0] : desks[Math.floor(Math.random() * desks.length)];
        a.queue.length = 0;
        a.walkLane(spot.x, spot.z + 1.15);
    }
    renderAgents();
}

function updateAgent(data) {
    const a = agents.get(data.id);
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

// ---------- UI ----------
function initials(name) {
    return String(name).split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function switchTab(name) {
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.textContent.toLowerCase().includes(name === 'agents' ? 'agen' : name)));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.getElementById(`tab-${name}`).classList.add('active');
    playClick();
}

function updateStats() {
    let active = 0;
    agents.forEach(a => { if (a.status === 'working') active++; });
    stats.active = active;
    document.getElementById('stat-active').textContent = active;
    document.getElementById('stat-completed').textContent = stats.completed;
    document.getElementById('stat-total').textContent = stats.total;
}

function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function addGlobalLog(msg) {
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

function toggleSidebar() {
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
function toggleMiniLog() {
    document.getElementById('mini-log').classList.toggle('minimized');
    playClick();
}
function syncMiniLog() {
    const src = document.getElementById('global-logs');
    const dst = document.getElementById('mini-log-body');
    if (!src || !dst) return;
    dst.innerHTML = '';
    for (let i = 0; i < Math.min(5, src.children.length); i++) dst.appendChild(src.children[i].cloneNode(true));
}

function renderAgents() {
    const list = document.getElementById('agent-list');
    if (!agents.size) {
        list.innerHTML = '<div class="empty-state">Belum ada agen.<br>Deploy agen pertama untuk mulai.</div>';
        return;
    }
    list.innerHTML = '';
    agents.forEach(a => {
        const rc = ROLE_CONFIG[a.role] || ROLE_CONFIG.Developer;
        const card = document.createElement('div');
        card.className = `agent-card ${a.status}`;
        card.onclick = () => { focusAgent(a); openModal(a); playClick(); };
        card.innerHTML =
            `<div class="agent-header"><div class="agent-avatar" style="background:${rc.css}">${esc(initials(a.name))}</div>` +
            `<div><div class="agent-name">${esc(a.name)}</div><div class="agent-role">${esc(a.role)}</div></div></div>` +
            `<div class="agent-task">${esc(a.task)}</div>` +
            `<div class="agent-footer"><span class="agent-status status-${a.status}">${esc(a.status)}</span>` +
            `<span>${Math.round(a.progress)}%</span></div>` +
            `<div class="agent-progress"><div class="agent-progress-bar" style="width:${a.progress}%"></div></div>`;
        list.appendChild(card);
    });
    updateStats();
}

function openModal(agent) {
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
function showToast(agent, kind) {
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
    el.onclick = () => { const a = agents.get(agent.id); if (a) { focusAgent(a); openModal(a); } el.remove(); playClick(); };
    box.appendChild(el);
    setTimeout(() => { if (el.parentNode) el.remove(); }, 12000);
    while (box.children.length > 3) box.removeChild(box.firstChild);
}
function closeModal() { document.getElementById('modal').classList.remove('active'); }
document.getElementById('modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });

// ---------- spawn ----------
async function spawnCustomAgent() {
    const name = document.getElementById('agent-name').value.trim() || `Agent-${Math.floor(Math.random() * 900 + 100)}`;
    const role = document.getElementById('agent-role').value;
    const task = document.getElementById('agent-task').value.trim();
    if (!task) { alert('Deskripsi tugas wajib diisi.'); return; }
    await spawn({ name, role, task });
    document.getElementById('agent-task').value = '';
}

async function spawnQuick(name, task) {
    const role = /review/i.test(name) ? 'Developer'
        : /bug|test/i.test(name) ? 'QA'
        : /doc/i.test(name) ? 'Manager' : 'DevOps';
    await spawn({ name, role, task });
}

async function spawnDemoOffice() {
    try {
        const r = await fetch(`${API_URL}/api/demo`, { method: 'POST' });
        const j = await r.json();
        if (j.success) { stats.total += 6; updateStats(); switchTab('agents'); }
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
        if (j.success) { stats.total++; updateStats(); switchTab('agents'); }
        else alert('Spawn gagal: ' + (j.error || 'unknown'));
    } catch (e) { alert('Backend tidak terjangkau â€” jalankan `npm start`.'); }
}

// ---------- boot ----------
function bootError(msg) {
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
