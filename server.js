const express = require('express');
const WebSocket = require('ws');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// HTTP server (shared with WebSocket upgrade)
const server = require('http').createServer(app);

// WebSocket server — same port as HTTP, via upgrade
const wss = new WebSocket.Server({ noServer: true });
server.on('upgrade', (req, socket, head) => {
    wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
    });
});

// Agent state
const agents = new Map();
let nextAgentId = 0;

// Mirror map: hermes session_id -> office agentId (gateway runs the agent,
// office only mirrors — no duplicate subprocess).
const sessionToAgent = new Map();

// Webhook secret: set OFFICE_WEBHOOK_SECRET to require it.
// Empty = localhost only (mature default for local dashboard).
const WEBHOOK_SECRET = process.env.OFFICE_WEBHOOK_SECRET || '';
function checkWebhook(req, res) {
    if (WEBHOOK_SECRET) {
        const got = req.headers['x-office-secret'] || req.body.secret;
        if (got !== WEBHOOK_SECRET) return res.status(401).json({ error: 'bad secret' }), false;
        return true;
    }
    const ip = req.ip || req.socket.remoteAddress || '';
    if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') return true;
    return res.status(403).json({ error: 'webhook localhost-only (set OFFICE_WEBHOOK_SECRET to open)' }), false;
}

// Keep completed agents as readable reports; cap memory.
function pruneAgents() {
    const done = [...agents.values()].filter(a => a.status !== 'working')
        .sort((x, y) => (x.endTime || 0) - (y.endTime || 0));
    while (done.length > 50) {
        const old = done.shift();
        agents.delete(old.id);
        if (old.sessionId) sessionToAgent.delete(old.sessionId);
        broadcast({ type: 'agent_removed', agentId: old.id });
    }
}
const lastChars = (s, n) => String(s || '').slice(-n);

// Broadcast to all connected clients
function broadcast(data) {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
}

// Spawn Hermes agent
function spawnAgent(agentId, name, role, task, demo = false) {
    console.log(`[Agent ${agentId}] Spawning: ${name} - ${task}${demo ? ' (DEMO)' : ''}`);
    
    const agent = {
        id: agentId,
        name,
        role,
        task,
        status: 'working',
        progress: 0,
        logs: [],
        output: '',
        startTime: Date.now()
    };

    agents.set(agentId, agent);

    broadcast({
        type: 'agent_spawn',
        agent: {
            id: agentId,
            name: agent.name,
            role: agent.role,
            task: agent.task,
            status: 'working',
            progress: 0
        }
    });

    // ---- DEMO MODE: simulated agent, no subprocess ----
    if (demo) {
        const steps = [
            'Membaca konteks proyek…',
            'Menyusun rencana kerja…',
            'Menganalisis file terkait…',
            'Menulis implementasi…',
            'Menjalankan pengujian…',
            'Merapikan hasil akhir…',
            'Verifikasi selesai ✅'
        ];
        let i = 0;
        const timer = setInterval(() => {
            const a = agents.get(agentId);
            if (!a) { clearInterval(timer); return; }
            a.progress = Math.min(Math.round(((i + 1) / steps.length) * 100), 100);
            a.logs.push({ timestamp: new Date().toLocaleTimeString('id-ID'), message: steps[i] });
            broadcast({
                type: 'agent_update',
                agent: { id: agentId, name: a.name, status: 'working', progress: a.progress, logs: a.logs.slice(-5) }
            });
            i++;
            if (i >= steps.length) {
                clearInterval(timer);
                a.status = 'completed';
                a.progress = 100;
                a.duration = Math.round((Date.now() - a.startTime) / 1000);
                a.logs.push({ timestamp: new Date().toLocaleTimeString('id-ID'), message: `✅ Task selesai dalam ${a.duration}s` });
                broadcast({
                    type: 'agent_complete',
                    agent: { id: agentId, name: a.name, status: 'completed', progress: 100, logs: a.logs, duration: a.duration, output: lastChars(a.output, 4000) }
                });
                a.endTime = Date.now();
                pruneAgents(); // report stays, no auto-delete
            }
        }, 2600);
        agent.timer = timer;
        return agent;
    }

    // Spawn hermes process with one-shot mode
    const hermesProcess = spawn('hermes', [
        'chat',
        '-q',
        task
    ], {
        shell: false,  // Changed: don't use shell to avoid arg splitting
        cwd: process.cwd()
    });

    agent.process = hermesProcess;

    // Capture stdout
    hermesProcess.stdout.on('data', (data) => {
        const output = data.toString();
        agent.output += output;
        
        const logEntry = {
            timestamp: new Date().toLocaleTimeString('id-ID'),
            message: output.trim()
        };
        
        agent.logs.push(logEntry);
        
        // Update progress based on output keywords
        if (output.includes('read_file') || output.includes('search')) {
            agent.progress = Math.min(agent.progress + 10, 30);
        } else if (output.includes('write_file') || output.includes('patch')) {
            agent.progress = Math.min(agent.progress + 20, 70);
        } else if (output.includes('terminal')) {
            agent.progress = Math.min(agent.progress + 15, 85);
        }
        
        broadcast({
            type: 'agent_update',
            agent: {
                id: agentId,
                name: agent.name,
                status: agent.status,
                progress: agent.progress,
                logs: agent.logs.slice(-5) // Last 5 logs
            }
        });
    });

    // Capture stderr
    hermesProcess.stderr.on('data', (data) => {
        const error = data.toString();
        console.error(`[Agent ${agentId}] Error:`, error);
        
        agent.logs.push({
            timestamp: new Date().toLocaleTimeString('id-ID'),
            message: `⚠️ ${error.trim()}`
        });
    });

    // Handle completion
    hermesProcess.on('close', (code) => {
        console.log(`[Agent ${agentId}] Completed with code ${code}`);
        
        agent.status = code === 0 ? 'completed' : 'error';
        agent.progress = code === 0 ? 100 : agent.progress;
        agent.endTime = Date.now();
        agent.duration = Math.round((agent.endTime - agent.startTime) / 1000);
        
        agent.logs.push({
            timestamp: new Date().toLocaleTimeString('id-ID'),
            message: code === 0 
                ? `✅ Task selesai dalam ${agent.duration}s`
                : `❌ Task gagal (exit code ${code})`
        });
        
        broadcast({
            type: 'agent_complete',
            agent: {
                id: agentId,
                name: agent.name,
                status: agent.status,
                progress: agent.progress,
                logs: agent.logs,
                duration: agent.duration,
                output: lastChars(agent.output, 4000)
            }
        });
        agent.endTime = Date.now();
        pruneAgents(); // report stays readable, no auto-delete
    });

    return agent;
}

// REST API endpoints
app.post('/api/spawn', (req, res) => {
    const { name, role, task, avatar, demo } = req.body;
    
    if (!name || !task) {
        return res.status(400).json({ error: 'name and task required' });
    }
    
    const agentId = nextAgentId++;
    const agent = spawnAgent(agentId, name, role || 'Developer', task, !!demo);
    
    res.json({
        success: true,
        agentId,
        name: agent.name,
        task: agent.task
    });
});

app.get('/api/agents', (req, res) => {
    const agentList = Array.from(agents.values()).map(a => ({
        id: a.id,
        name: a.name,
        role: a.role,
        task: a.task,
        status: a.status,
        progress: a.progress,
        logs: a.logs.slice(-10)
    }));
    
    res.json({ agents: agentList });
});

// Spawn a full office of demo agents at once
app.post('/api/demo', (req, res) => {
    const office = [
        { name: 'Kiro Dev',    role: 'Developer', task: 'Membangun REST API untuk manajemen user' },
        { name: 'Luna Design', role: 'Designer',  task: 'Membuat mockup dashboard analytics' },
        { name: 'Max Manager', role: 'Manager',   task: 'Menyusun roadmap sprint berikutnya' },
        { name: 'Neko QA',     role: 'QA',        task: 'Menjalankan test suite dan melaporkan bug' },
        { name: 'Ryu DevOps',  role: 'DevOps',    task: 'Menyiapkan pipeline CI/CD ke staging' },
        { name: 'Sora Sec',    role: 'Security',  task: 'Audit keamanan endpoint autentikasi' }
    ];
    const spawned = office.map((o, idx) => {
        const id = nextAgentId++;
        // stagger the start so they don't all move in lockstep
        setTimeout(() => spawnAgent(id, o.name, o.role, o.task, true), idx * 700);
        return { id, name: o.name, role: o.role };
    });
    res.json({ success: true, spawned });
});

// Fase 5: histogram aktivitas spawn agen per jam (24 jam terakhir)
app.get('/api/activity', (req, res) => {
    const hours = Array.from({ length: 24 }, (_, i) => {
        const d = new Date();
        d.setHours(d.getHours() - (23 - i), 0, 0, 0);
        return { hour: d.getHours(), label: String(d.getHours()).padStart(2, '0') + ':00', spawns: 0 };
    });
    agents.forEach(a => {
        const hoursAgo = a.startTime ? Math.floor((Date.now() - a.startTime) / 3600000) : -1;
        if (hoursAgo >= 0 && hoursAgo < 24) hours[23 - hoursAgo].spawns++;
    });
    res.json({ hours });
});

app.get('/api/agent/:id', (req, res) => {
    const agentId = parseInt(req.params.id);
    const agent = agents.get(agentId);
    
    if (!agent) {
        return res.status(404).json({ error: 'Agent not found' });
    }
    
    res.json({
        id: agent.id,
        name: agent.name,
        role: agent.role,
        task: agent.task,
        status: agent.status,
        progress: agent.progress,
        logs: agent.logs,
        output: agent.output
    });
});

app.post('/api/stop/:id', (req, res) => {
    const agentId = parseInt(req.params.id);
    const agent = agents.get(agentId);
    
    if (!agent) {
        return res.status(404).json({ error: 'Agent not found' });
    }
    
    if (agent.timer) {
        clearInterval(agent.timer);
    }
    
    if (agent.process) {
        agent.process.kill('SIGTERM');
        agent.status = 'stopped';
        
        broadcast({
            type: 'agent_update',
            agent: {
                id: agentId,
                name: agent.name,
                status: 'stopped'
            }
        });
    }
    
    res.json({ success: true });
});

// WebSocket connection handler
wss.on('connection', (ws) => {
    console.log('Client connected');
    
    // Send current agent states
    ws.send(JSON.stringify({
        type: 'init',
        agents: Array.from(agents.values()).map(a => ({
            id: a.id,
            name: a.name,
            role: a.role,
            task: a.task,
            status: a.status,
            progress: a.progress,
            logs: a.logs.slice(-5)
        }))
    }));
    
    ws.on('close', () => {
        console.log('Client disconnected');
    });
});

// ---- Mirror: agent runs in Hermes gateway, office only displays ----
function mirrorSpawn(sessionId, platform, text) {
    const label = platform === 'telegram' ? 'TG' : (platform || 'hermes');
    const existing = sessionToAgent.get(sessionId);
    if (existing !== undefined && agents.has(existing)) return agents.get(existing);
    const agentId = nextAgentId++;
    // Human name from prompt words ("buatkan laporan ...") not session hash.
    const words = String(text || '').replace(/\s+/g, ' ').trim().split(' ').slice(0, 3).join(' ');
    const short = words ? words.slice(0, 24) : sessionId.slice(-4);
    const agent = {
        id: agentId, sessionId, mirror: true,
        name: `${label} ${short}`,
        role: label === 'TG' ? 'Telegram' : 'Hermes',
        task: lastChars(text, 500) || '(prompt kosong)',
        status: 'working', progress: 10, logs: [{
            timestamp: new Date().toLocaleTimeString('id-ID'),
            message: `📨 Prompt masuk via ${label}`
        }],
        output: '', startTime: Date.now()
    };
    agents.set(agentId, agent);
    sessionToAgent.set(sessionId, agentId);
    broadcast({
        type: 'agent_spawn',
        agent: { id: agentId, name: agent.name, role: agent.role, task: agent.task, status: 'working', progress: 10 }
    });
    return agent;
}

function mirrorResult(sessionId, response, status = 'completed') {
    const agentId = sessionToAgent.get(sessionId);
    if (agentId === undefined || !agents.has(agentId)) return null;
    const a = agents.get(agentId);
    a.status = status;
    a.progress = status === 'completed' ? 100 : a.progress;
    a.output = lastChars(response, 4000);
    a.endTime = Date.now();
    a.duration = Math.round((a.endTime - a.startTime) / 1000);
    a.logs.push({ timestamp: new Date().toLocaleTimeString('id-ID'), message: `✅ Respons diterima (${a.duration}s)` });
    broadcast({
        type: 'agent_complete',
        agent: { id: a.id, name: a.name, status: a.status, progress: a.progress, logs: a.logs, duration: a.duration, output: a.output }
    });
    pruneAgents();
    return a;
}

// Unified hermes event webhook (called by hermes-bridge.js via shell hooks)
app.post('/webhook/hermes-event', (req, res) => {
    if (!checkWebhook(req, res)) return;
    const { event, session_id, platform, text } = req.body || {};
    if (!event || !session_id) return res.status(400).json({ error: 'event and session_id required' });
    if (event === 'spawn') {
        const a = mirrorSpawn(session_id, platform, text);
        return res.json({ success: true, agentId: a.id, name: a.name });
    }
    if (event === 'result') {
        const a = mirrorResult(session_id, text);
        if (!a) return res.status(404).json({ error: 'session not mirrored' });
        return res.json({ success: true, agentId: a.id });
    }
    return res.status(400).json({ error: 'unknown event (spawn|result)' });
});

// Webhook endpoint for Hermes integration
app.post('/webhook/telegram-agent', (req, res) => {
    if (!checkWebhook(req, res)) return;
    const { name, role, task, session_id, platform } = req.body;
    
    console.log(`📨 Webhook received: ${name} - ${task}`);
    
    // session_id present = gateway already runs it → mirror only, no duplicate
    if (session_id) {
        const a = mirrorSpawn(session_id, platform || 'telegram', task);
        return res.json({ success: true, message: `✅ Agent ${a.name} muncul di 3D office!`, agentId: a.id, name: a.name, mirror: true });
    }
    
    if (!name || !task) {
        return res.status(400).json({ error: 'name and task required' });
    }
    
    const agentId = nextAgentId++;
    const agent = spawnAgent(agentId, name, role || 'Developer', task);
    
    res.json({
        success: true,
        message: `✅ Agent ${name} spawned di 3D office!`,
        agentId,
        name: agent.name,
        task: agent.task
    });
});

// Start server
server.listen(PORT, () => {
    console.log(`🚀 Agent Office Backend running on http://localhost:${PORT}`);
    console.log(`📡 WebSocket server on ws://localhost:${PORT} (same port, upgrade)`);
    console.log(`\n📝 API Endpoints:`);
    console.log(`   POST /api/spawn - Spawn new agent`);
    console.log(`   GET  /api/agents - List all agents`);
    console.log(`   GET  /api/agent/:id - Get agent details`);
    console.log(`   POST /api/stop/:id - Stop agent`);
    console.log(`   POST /webhook/telegram-agent - Telegram webhook`);
    console.log(`   POST /webhook/hermes-event - Hermes hook bridge (spawn|result)\n`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down...');
    
    agents.forEach((agent, id) => {
        if (agent.process) {
            agent.process.kill('SIGTERM');
        }
    });
    
    process.exit(0);
});
