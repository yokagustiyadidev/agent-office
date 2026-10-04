// js/room.js — ruangan, meja, area rapat, lampu, tanaman, whiteboard, TV wall
import { state, DESK_ROWS, DESK_COLS, DESK_GAP, MEET_CX, MEET_CZ, MEET_CHAIRS, STATUS_CSS } from './config.js';
import { mat } from './scene.js';
import { addGlobalLog } from './ui.js';
import { playClick } from './effects.js';

// ---------- PREMIUM OFFICE ROOM ----------
export function buildRoom() {
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
    state.scene.add(floor);

    // Premium carpet zones with geometric pattern
    const carpetMain = mat(0x556270, 0.95, { metalness: 0.03 });
    const carpetAccent = mat(0x3d4a58, 0.98, { metalness: 0.02 });
    
    // Main work area carpet
    const mainCarpet = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), carpetMain);
    mainCarpet.rotation.x = -Math.PI / 2;
    mainCarpet.position.y = 0.02;
    mainCarpet.receiveShadow = true;
    state.scene.add(mainCarpet);

    // Accent stripes
    for (let i = -2; i <= 2; i++) {
        const stripe = new THREE.Mesh(new THREE.PlaneGeometry(20, 0.3), carpetAccent);
        stripe.rotation.x = -Math.PI / 2;
        stripe.position.set(0, 0.034, i * 4);
        stripe.receiveShadow = true;
        state.scene.add(stripe);
    }

    // Entrance area - marble tile (outside carpet zone, no overlap)
    const marbleMat = mat(0xd4d8dd, 0.15, { metalness: 0.5 });
    const entrance = new THREE.Mesh(new THREE.PlaneGeometry(8, 10), marbleMat);
    entrance.rotation.x = -Math.PI / 2;
    entrance.position.set(0, 0.03, 15.5);
    entrance.receiveShadow = true;
    state.scene.add(entrance);

    // Premium walls with texture and accent colors
    const wallBase = mat(0x4a4e56, 0.82, { metalness: 0.08 });
    const wallAccent = mat(0x2c3e50, 0.78, { metalness: 0.12 });
    const wallLight = mat(0x5a6370, 0.85, { metalness: 0.05 });
    
    const mkWall = (w, h, x, y, z, ry, m = wallBase) => {
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
        mesh.position.set(x, y, z); mesh.rotation.y = ry; mesh.receiveShadow = true;
        state.scene.add(mesh);
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
    state.scene.add(ceiling);
    
    // Decorative wall panels on back wall
    const panelMat = mat(0x1a2332, 0.65, { metalness: 0.25 });
    for (let i = -3; i <= 3; i++) {
        if (i === 0) continue; // skip center for window
        const panel = new THREE.Mesh(new THREE.BoxGeometry(4.5, 4.8, 0.15), panelMat);
        panel.position.set(i * 5.5, 2.9, -17.92);
        panel.castShadow = true;
        state.scene.add(panel);
        
        // Panel frame
        const frameMat = mat(0xc9a961, 0.4, { metalness: 0.6 });
        const frame = new THREE.Mesh(new THREE.BoxGeometry(4.6, 4.9, 0.08), frameMat);
        frame.position.set(i * 5.5, 2.9, -17.88);
        state.scene.add(frame);
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
    state.windowGlassMat = winGlassMat;
    
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
    state.scene.add(centerWin);

    // Baseboards - premium trim
    const baseMat = mat(0x2a2e35, 0.6, { metalness: 0.4 });
    [[0, -17.94, 0], [-17.94, 0, 1], [17.94, 0, 1]].forEach(([x, z, rot]) => {
        const b = new THREE.Mesh(new THREE.BoxGeometry(rot ? 0.12 : 42, 0.3, rot ? 42 : 0.12), baseMat);
        b.position.set(x, 0.15, z);
        b.castShadow = true;
        state.scene.add(b);
    });
    
    // Crown molding
    const crownMat = mat(0xf0f2f5, 0.7, { metalness: 0.15 });
    [[0, -17.94, 0], [-17.94, 0, 1], [17.94, 0, 1]].forEach(([x, z, rot]) => {
        const crown = new THREE.Mesh(new THREE.BoxGeometry(rot ? 0.2 : 42, 0.25, rot ? 42 : 0.2), crownMat);
        crown.position.set(x, 5.875, z);
        crown.castShadow = true;
        state.scene.add(crown);
    });

    // Reception desk - premium marble counter
    const recepBase = new THREE.Mesh(new THREE.BoxGeometry(4, 1.1, 2), mat(0x1a1e24, 0.5, { metalness: 0.5 }));
    recepBase.position.set(0, 0.55, 13);
    recepBase.castShadow = recepBase.receiveShadow = true;
    state.scene.add(recepBase);
    
    const recepTop = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.12, 2.1), mat(0xd4d8dd, 0.2, { metalness: 0.6 }));
    recepTop.position.set(0, 1.16, 13);
    recepTop.castShadow = true;
    state.scene.add(recepTop);
    
    // Company logo panel behind reception
    const logoPanel = new THREE.Mesh(new THREE.BoxGeometry(3, 1.2, 0.1), mat(0x2563eb, 0.3, { metalness: 0.4 }));
    logoPanel.position.set(0, 2, 11.8);
    logoPanel.castShadow = true;
    state.scene.add(logoPanel);
    
    const logoText = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.6, 0.08), mat(0xffffff, 0.8, { metalness: 0.1 }));
    logoText.position.set(0, 2, 11.75);
    state.scene.add(logoText);
    // Premium coffee bar area (right side)
    const coffeeBarBase = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1.05, 0.8), mat(0x1a1e24, 0.45, { metalness: 0.6 }));
    coffeeBarBase.position.set(15, 0.525, 8);
    coffeeBarBase.castShadow = coffeeBarBase.receiveShadow = true;
    state.scene.add(coffeeBarBase);
    
    const coffeeCounter = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.08, 0.85), mat(0xd4d8dd, 0.25, { metalness: 0.55 }));
    coffeeCounter.position.set(15, 1.09, 8);
    coffeeCounter.castShadow = true;
    state.scene.add(coffeeCounter);
    
    // Coffee machine
    const coffeeMachine = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.55, 0.35), mat(0x2a2e35, 0.35, { metalness: 0.7 }));
    coffeeMachine.position.set(15.6, 1.4, 8);
    coffeeMachine.castShadow = true;
    state.scene.add(coffeeMachine);
    
    // Coffee machine display
    const machineDisplay = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 0.15), new THREE.MeshBasicMaterial({ color: 0x2563eb, toneMapped: false }));
    machineDisplay.position.set(15.6, 1.5, 8.18);
    state.scene.add(machineDisplay);
    
    // Cups on counter
    for (let i = 0; i < 3; i++) {
        const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.09, 16), mat(0xf5f7fa, 0.6, { metalness: 0.1 }));
        cup.position.set(14.5 + i * 0.15, 1.175, 7.8);
        cup.castShadow = true;
        state.scene.add(cup);
    }
    
    // Lounge seating area (left side)
    const loungeChairMat = mat(0x4a5a6a, 0.8, { metalness: 0.08 });
    const loungeFrameMat = mat(0x1a1e24, 0.4, { metalness: 0.6 });
    
    // Armchair
    const chairSeat = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.15, 0.85), loungeChairMat);
    chairSeat.position.set(-15, 0.35, 8);
    chairSeat.castShadow = true;
    state.scene.add(chairSeat);
    
    const chairBack = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.8, 0.15), loungeChairMat);
    chairBack.position.set(-15, 0.75, 8.35);
    chairBack.castShadow = true;
    state.scene.add(chairBack);
    
    // Armrests
    [-0.45, 0.45].forEach(offset => {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 0.7), loungeFrameMat);
        arm.position.set(-15 + offset, 0.6, 8);
        arm.castShadow = true;
        state.scene.add(arm);
    });
    
    // Coffee table
    const coffeeTable = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.08, 24), mat(0xd4d8dd, 0.2, { metalness: 0.5 }));
    coffeeTable.position.set(-15, 0.45, 6.5);
    coffeeTable.castShadow = coffeeTable.receiveShadow = true;
    state.scene.add(coffeeTable);
    
    const tableBase = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, 0.4, 16), mat(0x2a2e35, 0.4, { metalness: 0.6 }));
    tableBase.position.set(-15, 0.2, 6.5);
    tableBase.castShadow = true;
    state.scene.add(tableBase);
    
    // Wall art gallery (left wall)
    const artFrameMat = mat(0x1a1e24, 0.5, { metalness: 0.5 });
    const artColors = [0x2563eb, 0x10b981, 0xf59e0b, 0xef4444, 0x8b5cf6];
    
    for (let i = 0; i < 5; i++) {
        const artCanvas = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.2, 1.2), mat(artColors[i], 0.7, { metalness: 0.15 }));
        artCanvas.position.set(-17.92, 2.5, -8 + i * 3.5);
        artCanvas.rotation.y = Math.PI / 2;
        artCanvas.castShadow = true;
        state.scene.add(artCanvas);
        
        const artFrame = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.3, 1.3), artFrameMat);
        artFrame.position.set(-17.88, 2.5, -8 + i * 3.5);
        artFrame.rotation.y = Math.PI / 2;
        state.scene.add(artFrame);
    }
    
    // Digital screen on right wall
    const screenFrame = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.5, 3.5), mat(0x1a1e24, 0.35, { metalness: 0.7 }));
    screenFrame.position.set(17.92, 2.8, -5);
    screenFrame.rotation.y = -Math.PI / 2;
    screenFrame.castShadow = true;
    state.scene.add(screenFrame);
    
    const screenDisplay = new THREE.Mesh(new THREE.PlaneGeometry(3.3, 2.3), new THREE.MeshBasicMaterial({ color: 0x0a0e14, toneMapped: false }));
    screenDisplay.position.set(17.88, 2.8, -5);
    screenDisplay.rotation.y = -Math.PI / 2;
    state.scene.add(screenDisplay);
    
    // Screen content - metrics display
    const metricsBar = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 0.3), new THREE.MeshBasicMaterial({ color: 0x10b981, toneMapped: false }));
    metricsBar.position.set(17.86, 2.5, -5);
    metricsBar.rotation.y = -Math.PI / 2;
    state.scene.add(metricsBar);

    // Modern wall state.clock
    const clockOuter = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.08, 32), mat(0x1a1e24, 0.4, { metalness: 0.6 }));
    clockOuter.rotation.x = Math.PI / 2;
    clockOuter.position.set(0, 4.5, -17.85);
    clockOuter.castShadow = true;
    state.scene.add(clockOuter);
    
    const clockFace = new THREE.Mesh(new THREE.CircleGeometry(0.28, 32), mat(0xf5f7fa, 0.85, { metalness: 0.05 }));
    clockFace.position.set(0, 4.5, -17.82);
    state.scene.add(clockFace);
    
    // Clock hands
    const hourHand = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.15, 0.02), mat(0x1a1e24, 0.5, { metalness: 0.5 }));
    hourHand.position.set(0, 4.5, -17.8);
    state.scene.add(hourHand);
    
    const minuteHand = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.22, 0.02), mat(0x1a1e24, 0.5, { metalness: 0.5 }));
    minuteHand.position.set(0, 4.5, -17.79);
    state.scene.add(minuteHand);


}


// ---------- state.desks: wood top, black legs, monitor with code, chair, mug ----------
export function codeTexture(seed) {
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

export function buildDesks() {
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
            state.scene.add(group);
            state.desks.push({ x, z, occupant: null, group, top });
        }
    }
}

// ---------- meeting area: oval conference table + 6 chairs ----------
export function buildMeetingArea() {
    const woodMat = mat(0x8a6d4f, 0.45, { metalness: 0.12 });
    const legMat = mat(0x2a2e35, 0.35, { metalness: 0.65 });
    const accentMat = mat(0xc9a961, 0.5, { metalness: 0.5 });

    // round rug under meeting zone
    const rug = new THREE.Mesh(new THREE.CircleGeometry(4.8, 40), mat(0x46536a, 0.96, { metalness: 0.03 }));
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(MEET_CX, 0.028, MEET_CZ);
    rug.receiveShadow = true;
    state.scene.add(rug);

    // oval tabletop
    const top = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.0, 0.12, 40), woodMat);
    top.scale.set(1.3, 1, 0.9);
    top.position.set(MEET_CX, 0.75, MEET_CZ);
    top.castShadow = top.receiveShadow = true;
    state.scene.add(top);

    // gold trim ring
    const trim = new THREE.Mesh(new THREE.TorusGeometry(2.0, 0.025, 10, 48), accentMat);
    trim.rotation.x = Math.PI / 2;
    trim.scale.set(1.3, 0.9, 1);
    trim.position.set(MEET_CX, 0.81, MEET_CZ);
    state.scene.add(trim);

    // pedestal base
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 0.7, 20), legMat);
    ped.position.set(MEET_CX, 0.35, MEET_CZ);
    ped.castShadow = true;
    state.scene.add(ped);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.2, 0.06, 28), legMat);
    disc.position.set(MEET_CX, 0.03, MEET_CZ);
    disc.castShadow = true;
    state.scene.add(disc);

    // centerpiece: planter + paper stacks
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.13, 0.2, 16), mat(0xf5f7fa, 0.7, { metalness: 0.1 }));
    pot.position.set(MEET_CX, 0.91, MEET_CZ);
    pot.castShadow = true;
    state.scene.add(pot);
    const bush = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 10), mat(0x4d8a5e, 0.85));
    bush.position.set(MEET_CX, 1.1, MEET_CZ);
    bush.castShadow = true;
    state.scene.add(bush);
    for (let i = 0; i < 3; i++) {
        const paper = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.012, 0.4), mat(0xf5f7fa, 0.9));
        const pa = (i / 3) * Math.PI * 2;
        paper.position.set(MEET_CX + Math.cos(pa) * 1.2, 0.82 + i * 0.005, MEET_CZ + Math.sin(pa) * 0.8);
        paper.rotation.y = pa;
        state.scene.add(paper);
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
        state.scene.add(g);
        MEET_CHAIRS.push({ x, z });
    }

    // pendant lamp above the table (light only, no shadow)
    const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.0, 8), legMat);
    wire.position.set(MEET_CX, 5.5, MEET_CZ);
    state.scene.add(wire);
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.55, 0.5, 20, 1, true), mat(0x1a1e24, 0.4, { metalness: 0.7 }));
    shade.position.set(MEET_CX, 4.75, MEET_CZ);
    state.scene.add(shade);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 12), new THREE.MeshBasicMaterial({ color: 0xffefc4, toneMapped: false }));
    glow.position.set(MEET_CX, 4.7, MEET_CZ);
    state.scene.add(glow);
    const pl = new THREE.PointLight(0xffefc4, 1.3, 10, 2);
    pl.position.set(MEET_CX, 4.6, MEET_CZ);
    pl.castShadow = false;
    state.scene.add(pl);
}

export function buildLights() {
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
            state.scene.add(frameBox);

            // Light panel
            const panel = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.8), panelMat);
            panel.position.set(x, 5.88, z);
            panel.rotation.x = -Math.PI / 2;
            state.scene.add(panel);

            // Point light for illumination (no shadow: sun is the only shadow caster)
            if (Math.abs(row) === 2 && Math.abs(col) === 2) {
                const pt = new THREE.PointLight(0xfff5e0, 1.4, 18, 2);
                pt.position.set(x, 5.7, z);
                pt.castShadow = false;
                state.scene.add(pt);
            }
        }
    }
    
    // Accent strip lighting on ceiling
    const stripMat = new THREE.MeshBasicMaterial({ color: 0x4a8fff, toneMapped: false });
    
    // LED strips along walls
    [[-17.5, 0], [17.5, 0]].forEach(([x, z]) => {
        const strip = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 36), stripMat);
        strip.position.set(x, 5.95, z);
        state.scene.add(strip);
        
        const stripLight = new THREE.PointLight(0x6a9fff, 0.6, 12, 2);
        stripLight.position.set(x, 5.8, z);
        state.scene.add(stripLight);
    });
    
    [[0, -17.5]].forEach(([x, z]) => {
        const strip = new THREE.Mesh(new THREE.BoxGeometry(36, 0.05, 0.3), stripMat);
        strip.position.set(x, 5.95, z);
        state.scene.add(strip);
        
        const stripLight = new THREE.PointLight(0x6a9fff, 0.6, 12, 2);
        stripLight.position.set(x, 5.8, z);
        state.scene.add(stripLight);
    });
    
    // Pendant lights over lounge area
    const pendantMat = mat(0x1a1e24, 0.4, { metalness: 0.7 });
    const pendantGlassMat = mat(0xfff5d6, 0.3, { metalness: 0.1 });
    
    [[-15, 6.5], [15, 8]].forEach(([x, z]) => {
        // Pendant wire
        const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.2, 8), mat(0x1a1e24, 0.5, { metalness: 0.5 }));
        wire.position.set(x, 5.4, z);
        state.scene.add(wire);
        
        // Pendant shade
        const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 0.4, 16, 1, true), pendantMat);
        shade.position.set(x, 4.6, z);
        state.scene.add(shade);

        // Inner glow
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 12), pendantGlassMat);
        bulb.position.set(x, 4.6, z);
        state.scene.add(bulb);

        const bulbLight = new THREE.PointLight(0xffefc4, 1.2, 8, 2);
        bulbLight.position.set(x, 4.6, z);
        bulbLight.castShadow = false;
        state.scene.add(bulbLight);
    });
}


// ---------- day/night (Fase 1) ----------
// ---------- day/night cycle: collect interior lamps + apply time (Fase 1) ----------
export function collectInterior() {
    if (state.INTERIOR) return state.INTERIOR;
    state.INTERIOR = [];
    state.scene.traverse(o => {
        if (o.isPointLight && o !== state.sunLight && o !== state.fillLight && o !== state.rimLight) state.INTERIOR.push(o);
    });
    return state.INTERIOR;
}

export function skyGradient(hour) {
    // Returns [top, bottom] colors for the sky at a given hour
    const stops = {
        0:  [0x0a0e1a, 0x141a26],
        5:  [0x1a2340, 0x3d3a55],
        6:  [0x4a5f8a, 0xd98a5f],
        8:  [0x7aa8d9, 0xcfe3f2],
        12: [0x6fa8dc, 0xcfe8f5],
        17: [0x5f88b8, 0xf2c98a],
        19: [0x2d3555, 0xc06a4a],
        20: [0x141c30, 0x2a2438],
        24: [0x0a0e14, 0x141a26]
    };
    const keys = Object.keys(stops).map(Number).sort((a, b) => a - b);
    let a = keys[0], b = keys[keys.length - 1];
    for (let i = 0; i < keys.length - 1; i++) {
        if (hour >= keys[i] && hour <= keys[i + 1]) { a = keys[i]; b = keys[i + 1]; break; }
    }
    const k = (hour - a) / Math.max(b - a, 0.001);
    const mix = (c1, c2) => {
        const ca = new THREE.Color(c1), cb = new THREE.Color(c2);
        return ca.lerp(cb, Math.max(0, Math.min(1, k)));
    };
    const top = mix(stops[a][0], stops[b][0]);
    const bottom = mix(stops[a][1], stops[b][1]);
    return [top, bottom];
}

export function drawSky(hour) {
    if (!state.skyCanvas) return;
    const ctx = state.skyCanvas.getContext('2d');
    const [top, bottom] = skyGradient(hour);
    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#' + top.getHexString());
    grad.addColorStop(1, '#' + bottom.getHexString());
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 16, 256);
    // Stars at night
    if (hour < 6 || hour > 19) {
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        let seed = 42;
        const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
        for (let i = 0; i < 40; i++) {
            const x = Math.floor(rnd() * 16), y = Math.floor(rnd() * 120);
            ctx.globalAlpha = 0.3 + rnd() * 0.7;
            ctx.fillRect(x, y, 1, 1);
        }
        ctx.globalAlpha = 1;
    }
    state.skyTex.needsUpdate = true;
}

// 0..1 how "dark" it is outside (0=full day, 1=midnight)
export function darknessAt(hour) {
    // dark 19:00–05:30, bright 07:00–17:00, smooth transitions
    if (hour >= 7 && hour < 17) return 0;
    if (hour >= 19 || hour < 5) return 1;
    if (hour >= 17 && hour < 19) return (hour - 17) / 2;
    return 1 - (hour - 5) / 2; // 5..7
}

export function applyTimeOfDay() {
    if (!state.scene || !state.sunLight) return;
    const h = state.timeOfDay % 24;
    const dark = darknessAt(h);
    const sunK = Math.max(0, Math.sin(((h - 6) / 12) * Math.PI)); // 0 at 6/18h, 1 at noon

    // Sun position arcs across the sky
    const ang = ((h - 6) / 12) * Math.PI;
    state.sunLight.position.set(Math.cos(ang) * 20, Math.max(2, Math.sin(ang) * 22), 8);

    // Exterior lights fade out at night; interior lamps fade in
    state.sunLight.intensity = 0.85 * sunK;
    state.sunLight.color.setHSL(0.09, 0.35, 0.5 + sunK * 0.3);
    state.fillLight.intensity = 0.4 * (1 - dark * 0.7);
    state.rimLight.intensity = 0.25 * (1 - dark);
    state.ambLight.intensity = 0.65 - 0.35 * dark;
    state.ambLight.color.setHex(dark > 0.5 ? 0x8a93a8 : 0xc9d8e6);
    state.hemiLight.intensity = 0.4 * (1 - dark);

    // Interior lamps: brighten as it gets dark
    const interior = collectInterior();
    const lampBoost = 0.35 + dark * 1.15;
    interior.forEach(p => {
        if (p.userData.baseIntensity === undefined) p.userData.baseIntensity = p.intensity;
        p.intensity = p.userData.baseIntensity * lampBoost;
    });

    // Sky + background/fog follow
    drawSky(h);
    const skyTop = new THREE.Color(0x0a0e14).lerp(new THREE.Color(0x202429), 1 - dark);
    state.scene.background = skyTop;
    state.scene.fog.color.copy(skyTop);

    // Window glass tint: bluish by day, dark mirror at night
    if (state.windowGlassMat) {
        state.windowGlassMat.color.setHex(dark > 0.5 ? 0x1a2433 : 0x8cb4d9);
        state.windowGlassMat.opacity = dark > 0.5 ? 0.72 : 0.5;
    }
}

export function setTimeOfDay(h) {
    state.timeOfDay = Math.max(0, Math.min(24, h));
    state.autoTime = false;
    applyTimeOfDay();
    const label = document.getElementById('time-label');
    if (label) label.textContent = String(Math.floor(state.timeOfDay)).padStart(2, '0') + ':00';
    const btn = document.getElementById('btn-daynight');
    if (btn) btn.classList.remove('on');
}

export function toggleAutoTime() {
    state.autoTime = !state.autoTime;
    const btn = document.getElementById('btn-daynight');
    if (btn) btn.classList.toggle('on', state.autoTime);
    playClick();
    addGlobalLog(state.autoTime ? 'Waktu otomatis: kantor menyambangi malam & siang.' : 'Waktu otomatis dimatikan.');
}


// ---------- whiteboard + TV wall + steam (Fase 2) ----------
// ---------- Fase 2: detail ruang (whiteboard, TV wall status agen, steam kopi) ----------
let tvCanvas = null, tvTex = null, tvMesh = null;
let steamPts = null;
export const TV_STATUS = { working: '#3b82f6', completed: '#10b981', error: '#ef4444', idle: '#9ca3af' };

export function buildWhiteboard() {
    // Whiteboard di dinding belakang, samping jendela
    const g = new THREE.Group();
    const boardMat = new THREE.MeshStandardMaterial({ color: 0xf5f6f8, roughness: 0.35, metalness: 0.05 });
    const board = new THREE.Mesh(new THREE.BoxGeometry(4.6, 1.7, 0.06), boardMat);
    board.position.set(0, 3.0, -17.8);
    board.castShadow = true;
    g.add(board);

    // Frame aluminium
    const frameM = mat(0x9aa2ad, 0.3, { metalness: 0.7 });
    [[0, 0.88], [0, -0.88]].forEach(([x, y]) => {
        const h = new THREE.Mesh(new THREE.BoxGeometry(4.7, 0.06, 0.07), frameM);
        h.position.set(0, 3.0 + y, -17.78);
        g.add(h);
    });
    [[-2.32], [2.32]].forEach(([x]) => {
        const v = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.76, 0.06), frameM);
        v.position.set(x, 3.0, -17.78);
        g.add(v);
    });

    // Coretan (scribbles) via canvas texture — terlihat seperti diagram sprint
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 192;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#f4f6f8';
    ctx.fillRect(0, 0, 512, 512);
    ctx.strokeStyle = '#3b6ea5'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    // garis sprint timeline
    ctx.beginPath(); ctx.moveTo(40, 60); ctx.lineTo(470, 60); ctx.stroke();
    // kotak-kotak task
    ctx.strokeStyle = '#5f8a6e';
    [[60,90],[150,90],[240,90],[330,90]].forEach(([x, y]) => { ctx.strokeRect(x, y, 60, 36); });
    // checkmark di dua kotak pertama
    ctx.strokeStyle = '#2e7d4f'; ctx.lineWidth = 5;
    [[60,90],[150,90]].forEach(([x, y]) => {
        ctx.beginPath(); ctx.moveTo(x+14, y+18); ctx.lineTo(x+26, y+30); ctx.lineTo(x+46, y-4); ctx.stroke();
    });
    // teks ala tulisan tangan
    ctx.fillStyle = '#374151'; ctx.font = 'bold 22px "Comic Sans MS", "Segoe Print", cursive, sans-serif';
    ctx.fillText('Sprint 24 — deploy', 52, 45);
    ctx.font = '17px "Comic Sans MS", "Segoe Print", cursive, sans-serif';
    ctx.fillStyle = '#6b7280';
    ctx.fillText('auth ✓  API ✓  UI ⏳  test ⏳', 90, 160);
    // magnet merah & biru
    ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(30, 40, 7, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#3b82f6'; ctx.beginPath(); ctx.arc(482, 150, 7, 0, Math.PI*2); ctx.fill();

    const scribbleTex = new THREE.CanvasTexture(cv);
    scribbleTex.encoding = THREE.sRGBEncoding;
    const boardFace = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.5), new THREE.MeshStandardMaterial({ map: scribbleTex, roughness: 0.6 }));
    boardFace.position.set(0, 3.0, -17.76);
    boardFace.name = 'whiteboard-face';
    g.add(boardFace);

    // Tray spidol
    const tray = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.05, 0.12), frameM);
    tray.position.set(0, 2.1, -17.72);
    g.add(tray);
    ['#ef4444', '#3b82f6', '#111827'].forEach((c, i) => {
        const marker = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.24, 8), new THREE.MeshStandardMaterial({ color: new THREE.Color(c), roughness: 0.5 }));
        marker.rotation.z = Math.PI / 2;
        marker.position.set(-1.2 + i * 0.35, 2.14, -17.72);
        g.add(marker);
    });

    g.position.set(-8.5, 0, 0.02);
    state.scene.add(g);
}

export function buildTVWall() {
    // TV wall di dinding kanan: status agen live
    const bezel = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.9, 4.6), mat(0x0d0f13, 0.4, { metalness: 0.6 }));
    bezel.position.set(17.9, 3.0, 3);
    bezel.rotation.y = -Math.PI / 2;
    state.scene.add(bezel);

    tvCanvas = document.createElement('canvas');
    tvCanvas.width = 512; tvCanvas.height = 320;
    tvTex = new THREE.CanvasTexture(tvCanvas);
    tvTex.encoding = THREE.sRGBEncoding;
    const screen = new THREE.Mesh(
        new THREE.PlaneGeometry(4.35, 2.7),
        new THREE.MeshBasicMaterial({ map: tvTex, toneMapped: false })
    );
    screen.position.set(17.8, 3.0, 3);
    screen.rotation.y = -Math.PI / 2;
    screen.name = 'tv-wall';
    state.scene.add(screen);
    drawTVWall();
}

export function drawTVWall() {
    if (!tvCanvas) return;
    const ctx = tvCanvas.getContext('2d');
    ctx.fillStyle = '#0a0e14';
    ctx.fillRect(0, 0, 512, 320);
    ctx.fillStyle = '#e5e7eb';
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('AGENT STATUS', 24, 40);
    const now = new Date();
    ctx.fillStyle = '#6b7280';
    ctx.font = '14px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(now.toLocaleTimeString('id-ID'), 488, 40);
    ctx.fillText(now.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' }), 488, 60);

    // Rows: agen live (max 7)
    const list = [...state.agents.values()].filter(a => a.group || a.status).slice(0, 7);
    let y = 96;
    ctx.textAlign = 'left';
    if (!list.length) {
        ctx.fillStyle = '#4b5563';
        ctx.font = '18px system-ui, sans-serif';
        ctx.fillText('Tidak ada agen aktif…', 24, 130);
    }
    list.forEach(a => {
        const c = STATUS_CSS[a.status] || '#9ca3af';
        ctx.fillStyle = c;
        ctx.beginPath(); ctx.arc(34, y - 6, 6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#e5e7eb';
        ctx.font = '600 17px system-ui, sans-serif';
        ctx.fillText(String(a.name).slice(0, 14), 50, y);
        // progress bar
        ctx.fillStyle = '#1f2937';
        ctx.fillRect(250, y - 14, 180, 12);
        ctx.fillStyle = c;
        ctx.fillRect(250, y - 14, 180 * Math.min(1, (a.progress || 0) / 100), 12);
        ctx.fillStyle = '#9ca3af';
        ctx.font = '13px system-ui, sans-serif';
        ctx.fillText(Math.round(a.progress || 0) + '%', 442, y - 2);
        y += 32;
    });
    tvTex.needsUpdate = true;
}

// refresh TV wall tiap 3 detik + saat status berubah
setInterval(() => { if (typeof drawTVWall === 'function' && state.scene) drawTVWall(); }, 3000);


export function buildPlants() {
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
        state.scene.add(g);
    });
    
    // Desk plants - small modern planters
    const deskPotMat = mat(0xf5f7fa, 0.7, { metalness: 0.1 });
    const smallLeafMat = mat(0x4d8a5e, 0.85, { metalness: 0.05 });
    
    // Add small plants near some state.desks
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
        state.scene.add(g);
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
        state.scene.add(g);
    });
}
