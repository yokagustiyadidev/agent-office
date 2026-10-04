// js/agents.js — class Agent3D (model manusia, animasi, meeting, coffee break)
import { state, ROLE_CONFIG, SKINS, HAIRS, TROUSER, STATUS_COLOR, STATUS_CSS, LANE_X, LANE_Z, nearLane, MEET_CX, MEET_CZ, MEET_CHAIRS } from './config.js';
import { playComplete, spawnConfetti, scheduleExit, exitBubbleText } from './effects.js';
import { addGlobalLog, openModal } from './ui.js';
import { flyTo } from './hover.js';
import { mat } from './scene.js';

// ---------- agent: proportional human ~1.7m ----------
export class Agent3D {
    constructor(data) {
        this.id = data.id;
        this.name = data.name;
        this.role = data.role || 'Developer';
        this.task = data.task || '';
        this.status = data.status || 'idle';
        this.progress = data.progress || 0;
        this.logs = data.logs || [];
        this.output = data.output || '';
        this.exitPending = false;
        this.exitWalk = false;
        this.exitWatchdog = null;

        const rc = ROLE_CONFIG[this.role] || ROLE_CONFIG.Developer;
        this.skin = SKINS[this.id % SKINS.length];
        this.hairC = HAIRS[(this.id >> 2) % HAIRS.length];

        this.group = new THREE.Group();
        this.group.userData.agentId = this.id;
        this.buildModel(rc.color);
        this.group.traverse(o => { o.userData.agentId = this.id; });
        // body variety: height 0.93-1.07, shoulder width 0.96-1.04
        this.group.scale.set(0.96 + (this.id % 3) * 0.04, 0.93 + (this.id % 5) * 0.035, 1);
        state.scene.add(this.group);

        const desk = state.desks.find(d => !d.occupant) || state.desks[this.id % state.desks.length];
        this.desk = desk;
        desk.occupant = this;
        this.queue = [];
        this.idleT = 2;
        this.disposed = false;
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

        // ---- Fase 3: gelas kopi di tangan kanan (visible saat bawa kopi) ----
        const cupM = new THREE.MeshStandardMaterial({ color: 0xf5f7fa, roughness: 0.5, metalness: 0.08 });
        const coffeeM = new THREE.MeshStandardMaterial({ color: 0x4a2c1a, roughness: 0.3, metalness: 0.1 });
        const cup = new THREE.Group();
        const cupBody = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.038, 0.09, 14), cupM);
        cupBody.castShadow = true;
        cup.add(cupBody);
        const coffee = new THREE.Mesh(new THREE.CircleGeometry(0.04, 14), coffeeM);
        coffee.rotation.x = -Math.PI / 2;
        coffee.position.y = 0.045;
        cup.add(coffee);
        // handle kecil
        const handle = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.007, 8, 14), cupM);
        handle.rotation.y = Math.PI / 2;
        handle.position.x = 0.05;
        cup.add(handle);
        cup.position.set(0, -0.72, 0.02);  // di posisi tangan kanan
        cup.rotation.x = -0.35;
        this.cup = cup;
        this.armR.add(cup);
        this.carrying = false;      // bawa kopi?
        this.cupVisible = false;
        this.cup.visible = false;
        this.coffeeBreakT = 8 + Math.random() * 14;   // waktu sampai ngopi berikutnya
        this.coffeeBreak = null;    // {phase: 'walk'|'drink'|'back'}
        this.nodT = 0;              // Fase 3: angguk saat bicara di meeting
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

    // Manhattan walk along aisles so state.agents never cut through state.desks
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
        const want = (typeof state.hovered !== 'undefined' && state.hovered === this) ? 1 : 0;
        this.lookK += (want - this.lookK) * Math.min(dt * 6, 1);
        
        this.eyes.forEach(eyeData => {
            eyeData.white.scale.y = shut;
            const offsetX = state.pointer.x * 0.015 * this.lookK;
            const offsetY = state.pointer.y * 0.008 * this.lookK;
            eyeData.iris.position.x = eyeData.white.userData.bx + offsetX;
            eyeData.iris.position.y = 0.015 + offsetY;
            eyeData.pupil.position.x = eyeData.white.userData.bx + offsetX;
            eyeData.pupil.position.y = 0.015 + offsetY;
        });
        this.headG.rotation.y = state.pointer.x * 0.3 * this.lookK;
        this.headG.rotation.x = state.pointer.y * 0.12 * this.lookK;
        this.torso.position.x = Math.sin(this.phase * 0.5) * 0.018;
    }

    setStatus(status, progress) {
        const prev = this.status;
        this.status = status;
        if (progress !== undefined && progress !== null) this.progress = progress;
        this.drawRing();
        if (status !== 'working') this.idleT = 1;
        if (status === 'completed' && prev !== 'completed') {
            this.bounce = 0.6; playComplete(); scheduleExit(this.id);
            // Fase 4: konfeti di posisi agen
            if (this.group && typeof spawnConfetti === 'function') spawnConfetti(this.group.position);
        }
        if (status === 'working' && prev !== 'working') {
            this.bubbleReveal = 0; // reset typewriter
        }
        this.drawBubble();
    }

    update(dt, t) {
        if (this.disposed) return;
        const pos = this.group.position;
        if (Math.hypot(this.target.x - pos.x, this.target.z - pos.z) <= 0.12 && this.queue.length) {
            const n = this.queue.shift();
            this.target.set(n.x, 0, n.z);
        }
        const dx = this.target.x - pos.x, dz = this.target.z - pos.z;
        const dist = Math.hypot(dx, dz);
        this.walking = dist > 0.12;

        // Bubble typewriter + animated dots
        const chatSrc = this.meeting ? this.meetLine : exitBubbleText(this);
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
            // agen yang keluar berjalan santai, agen kerja cepat, sisanya santai
            const base = this.exitWalk ? 1.35 : (this.status === 'working' ? 2.2 : 1.25);
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
                    // Fase 3: nod saat jadi speaker
                    if (this.nodT > 0) {
                        this.nodT -= dt;
                        this.headG.rotation.x = Math.sin(t * 8) * 0.14;
                    }
                } else {
                    // overflow: stand around the table, angkat gelas saat bicara
                    const ty = Math.sin(t * 6 + this.phase) * 0.12;
                    this.armL.rotation.x = -0.25 + ty;
                    if (this.meetLine && this.bubbleReveal < String(this.meetLine).length) {
                        // bicara: angkat gelas ke arah meja
                        this.armR.rotation.x = -1.8 + Math.sin(t * 4) * 0.08;
                        this.armR.rotation.z = -0.45;
                    } else {
                        this.armR.rotation.x = -0.25 - ty;
                        this.armR.rotation.z += (0.1 - this.armR.rotation.z) * 0.1;
                    }
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

            // ---- Fase 3: coffee break berkala (hanya agen working, bukan meeting/exit) ----
            if (this.coffeeBreak) {
                const cb = this.coffeeBreak;
                if (cb.phase === 'walk') {
                    // sampai di coffee bar? berhenti & minum
                    const d = Math.hypot(14.6 - pos.x, 7.2 - pos.z);
                    if (d < 0.5) {
                        cb.phase = 'drink';
                        cb.t = 2.5 + Math.random() * 2.5;
                    }
                } else if (cb.phase === 'drink') {
                    cb.t -= dt;
                    // pose minum: tangan kanan ke mulut
                    this.armR.rotation.x = -2.2 + Math.sin(t * 3) * 0.06;
                    this.armR.rotation.z = -0.5;
                    this.headG.rotation.x = -0.12;
                    if (cb.t <= 0) {
                        cb.phase = 'back';
                        this.carrying = false;
                        this.walkLane(this.desk.x, this.desk.z + 1.15);
                        this.faceTowards(this.desk.x, this.desk.z, dt, 8);
                    }
                } else if (cb.phase === 'back') {
                    if (!this.walking) {
                        this.coffeeBreak = null;
                        this.coffeeBreakT = 20 + Math.random() * 25;
                        this.cup.visible = false;
                    }
                }
            } else if (this.status === 'working' && !this.walking) {
                this.coffeeBreakT -= dt;
                if (this.coffeeBreakT <= 0) {
                    // mulai ngopi: jalan ke coffee bar bawa gelas
                    this.coffeeBreak = { phase: 'walk' };
                    this.carrying = true;
                    this.cup.visible = true;
                    this.walkLane(14.6, 7.2);
                    this.faceTowards(15.6, 8, dt, 8);
                }
            }

            // cup ikut tangan (naik-turun halus saat jalan)
            if (this.cup && this.cup.visible) {
                this.cup.rotation.z = Math.sin(this.phase) * 0.08;
            }

            // non-working state.agents stroll the aisles (not while in a meeting)
            if (this.status !== 'working' && this.status !== 'completed' && this.status !== 'error' && !this.meeting) {
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
        // agen yang keluar: setelah benar-benar melewati pintu, mesh-nya dibuang
        if (this.exitWalk && pos.z >= EXIT_OUT_Z) { finishExit(this.id); return; }
        // tag faces state.camera automatically (sprite)
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        if (this.desk) this.desk.occupant = null;
        state.scene.remove(this.group);
        this.group.traverse(o => {
            if (o.geometry) o.geometry.dispose();
            if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (m.map) m.map.dispose(); m.dispose(); });
        });
    }
}
