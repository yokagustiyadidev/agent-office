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
                    agent: { id: agentId, name: a.name, status: 'completed', progress: 100, logs: a.logs, duration: a.duration }
                });
                setTimeout(() => {
                    agents.delete(agentId);
                    broadcast({ type: 'agent_removed', agentId });
                }, 45000);
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
                duration: agent.duration
            }
        });
        
        // Auto-cleanup after 30 seconds
        setTimeout(() => {
            agents.delete(agentId);
            broadcast({
                type: 'agent_removed',
                agentId
            });
        }, 30000);
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

// Webhook endpoint for Hermes integration
app.post('/webhook/telegram-agent', (req, res) => {
    const { name, role, task } = req.body;
    
    console.log(`📨 Webhook received: ${name} - ${task}`);
    
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
    console.log(`   POST /webhook/telegram-agent - Telegram webhook\n`);
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
