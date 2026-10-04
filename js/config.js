// ============================================================
//  js/config.js — konstanta & shared state kantor 3D
//  Bugfix 2026-10-03: fallback '80' saat location.port kosong ->
//  wss://host:80 mustahil, koneksi putus. Port hanya ditempel bila ada.
// ============================================================

export const HOST = location.hostname || 'localhost';
export const PORT = location.port ? ':' + location.port : '';
export const WS_URL = HOST + PORT;
export const API_URL = `${location.protocol}//${HOST}${PORT}`;

// Muted shirt colors per role (real fabric tones, not neon)
export const ROLE_CONFIG = {
    Developer: { color: 0x4a6fa5, css: '#4a6fa5' },
    Designer:  { color: 0x9c7c8c, css: '#9c7c8c' },
    Manager:   { color: 0x8a7a5c, css: '#8a7a5c' },
    QA:        { color: 0x5f8a6e, css: '#5f8a6e' },
    DevOps:    { color: 0x5b7d8a, css: '#5b7d8a' },
    Security:  { color: 0x8a5f5b, css: '#8a5f5b' }
};
export const SKINS = [0xe8b88a, 0xd9a06f, 0xb07a4f, 0x8a5a35];
export const HAIRS = [0x2b2118, 0x3d2c1e, 0x555555, 0x1a1a1a];
export const TROUSER = 0x3a4356;
export const STATUS_COLOR = { working: 0x2563eb, completed: 0x15803d, error: 0xb91c1c, idle: 0x9ca3af };
export const STATUS_CSS = { working: '#2563eb', completed: '#15803d', error: '#b91c1c', idle: '#9ca3af' };

// Walk lanes (aisles between desks) + entrance door at (10, 13)
export const LANE_X = [-7, -2.4, 2.4, 7];
export const LANE_Z = [-7, -2.4, 2.4, 7];
export function nearLane(arr, v) { let b = arr[0]; for (const a of arr) if (Math.abs(a - v) < Math.abs(b - v)) b = a; return b; }

export const DESK_ROWS = 3;
export const DESK_COLS = 3;
export const DESK_GAP = 4.8;

// Meeting area (conference table) + conversation state
export const MEET_CX = 0;
export const MEET_CZ = -11;
export const MEET_LINES = [
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
export const meeting = { active: false, speaker: 0, timer: null };
export const MEET_CHAIRS = [];


// ---- shared mutable state (diakses lintas modul via objek state) ----
export const state = {
    scene: null, camera: null, renderer: null, controls: null, clock: null,
    raycaster: null, pointer: new THREE.Vector2(),
    downPos: null, hoverDirty: false, lastClient: { x: 0, y: 0 },
    agents: new Map(),
    desks: [],
    stats: { active: 0, completed: 0, total: 0 },
    ws: null,
    hovered: null, focused: null, camTween: null,
    dustPts: null, dustVel: [],
    ambLight: null, hemiLight: null, sunLight: null, fillLight: null, rimLight: null,
    INTERIOR: null,
    timeOfDay: 13, autoTime: false,
    skyMesh: null, skyCanvas: null, skyTex: null,
    windowGlassMat: null
};
