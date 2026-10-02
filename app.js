// Agent Office Dashboard - Main Application

class Agent {
    constructor(id, name, role, avatar, color) {
        this.id = id;
        this.name = name;
        this.role = role;
        this.avatar = avatar;
        this.color = color;
        this.status = 'idle';
        this.task = 'Menunggu task...';
        this.progress = 0;
        this.x = 0;
        this.y = 0;
        this.targetX = 0;
        this.targetY = 0;
        this.speed = 2;
        this.logs = [];
        this.deskIndex = id;
    }

    moveTo(x, y) {
        this.targetX = x;
        this.targetY = y;
    }

    update() {
        // Smooth movement towards target
        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 1) {
            this.x += (dx / distance) * this.speed;
            this.y += (dy / distance) * this.speed;
        }
    }

    addLog(message) {
        const timestamp = new Date().toLocaleTimeString('id-ID');
        this.logs.push({ timestamp, message });
        if (this.logs.length > 100) this.logs.shift();
    }

    setTask(task) {
        this.task = task;
        this.status = 'working';
        this.progress = 0;
        this.addLog(`🚀 Mulai task: ${task}`);
    }

    completeTask() {
        this.status = 'completed';
        this.progress = 100;
        this.addLog(`✅ Task selesai: ${this.task}`);
        setTimeout(() => {
            this.status = 'idle';
            this.task = 'Menunggu task...';
            this.progress = 0;
        }, 3000);
    }
}

class OfficeApp {
    constructor() {
        this.canvas = document.getElementById('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.agents = [];
        this.desks = [];
        this.selectedAgent = null;

        this.init();
        this.setupAgents();
        this.animate();
    }

    init() {
        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));
    }

    resize() {
        const container = document.getElementById('office-canvas');
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
        this.setupDesks();
    }

    setupDesks() {
        this.desks = [];
        const cols = 3;
        const rows = 2;
        const spacing = 150;
        const offsetX = (this.canvas.width - (cols - 1) * spacing) / 2;
        const offsetY = (this.canvas.height - (rows - 1) * spacing) / 2;

        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                this.desks.push({
                    x: offsetX + col * spacing,
                    y: offsetY + row * spacing
                });
            }
        }
    }

    setupAgents() {
        const agentConfigs = [
            { name: 'Kiro Dev', role: 'Developer', avatar: '👨‍💻', color: '#3498db' },
            { name: 'Luna Design', role: 'Designer', avatar: '👩‍🎨', color: '#e91e63' },
            { name: 'Max Manager', role: 'Manager', avatar: '👨‍💼', color: '#f39c12' },
            { name: 'Neko Support', role: 'Support', avatar: '🐱', color: '#2ecc71' },
            { name: 'Ryu QA', role: 'QA Tester', avatar: '🐉', color: '#9b59b6' }
        ];

        agentConfigs.forEach((config, i) => {
            const agent = new Agent(i, config.name, config.role, config.avatar, config.color);
            const desk = this.desks[i % this.desks.length];
            agent.x = desk.x;
            agent.y = desk.y;
            agent.targetX = desk.x;
            agent.targetY = desk.y;
            this.agents.push(agent);
        });

        this.renderSidebar();
    }

    renderSidebar() {
        const listEl = document.getElementById('agent-list');
        listEl.innerHTML = '';

        this.agents.forEach(agent => {
            const card = document.createElement('div');
            card.className = `agent-card ${agent.status}`;
            card.onclick = () => this.showAgentModal(agent);

            card.innerHTML = `
                <div class="agent-header">
                    <div class="agent-avatar" style="background: ${agent.color}20; color: ${agent.color}">
                        ${agent.avatar}
                    </div>
                    <div class="agent-info">
                        <div class="agent-name">${agent.name}</div>
                        <div class="agent-role">${agent.role}</div>
                    </div>
                </div>
                <div class="agent-task">${agent.task}</div>
                <span class="agent-status status-${agent.status}">${this.getStatusText(agent.status)}</span>
                ${agent.status === 'working' ? `
                    <div class="agent-progress">
                        <div class="agent-progress-bar" style="width: ${agent.progress}%"></div>
                    </div>
                ` : ''}
            `;

            listEl.appendChild(card);
        });
    }

    getStatusText(status) {
        const map = {
            idle: 'Siap',
            working: 'Kerja',
            completed: 'Selesai',
            error: 'Error'
        };
        return map[status] || status;
    }

    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw floor grid
        this.drawGrid();

        // Draw desks
        this.desks.forEach(desk => this.drawDesk(desk.x, desk.y));

        // Update and draw agents
        this.agents.forEach(agent => {
            agent.update();
            this.drawAgent(agent);
        });

        this.renderSidebar();
        requestAnimationFrame(() => this.animate());
    }

    drawGrid() {
        this.ctx.strokeStyle = '#ddd';
        this.ctx.lineWidth = 1;
        const gridSize = 50;

        for (let x = 0; x < this.canvas.width; x += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }

        for (let y = 0; y < this.canvas.height; y += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }
    }

    drawDesk(x, y) {
        // Desk shadow
        this.ctx.fillStyle = 'rgba(0,0,0,0.2)';
        this.ctx.fillRect(x - 38, y - 28, 76, 76);

        // Desk body
        this.ctx.fillStyle = '#34495e';
        this.ctx.fillRect(x - 40, y - 30, 80, 60);

        // Monitor
        this.ctx.fillStyle = '#2c3e50';
        this.ctx.fillRect(x - 20, y - 45, 40, 30);
        this.ctx.fillStyle = '#3498db';
        this.ctx.fillRect(x - 18, y - 43, 36, 26);
    }

    drawAgent(agent) {
        const x = agent.x;
        const y = agent.y;

        // Shadow
        this.ctx.fillStyle = 'rgba(0,0,0,0.2)';
        this.ctx.beginPath();
        this.ctx.ellipse(x, y + 35, 20, 8, 0, 0, Math.PI * 2);
        this.ctx.fill();

        // Body (chibi style - big head, small body)
        const bodyColor = agent.color;
        
        // Head
        this.ctx.fillStyle = '#ffd1a3';
        this.ctx.beginPath();
        this.ctx.arc(x, y, 20, 0, Math.PI * 2);
        this.ctx.fill();

        // Body
        this.ctx.fillStyle = bodyColor;
        this.ctx.beginPath();
        this.ctx.ellipse(x, y + 25, 15, 18, 0, 0, Math.PI * 2);
        this.ctx.fill();

        // Arms
        this.ctx.strokeStyle = bodyColor;
        this.ctx.lineWidth = 6;
        this.ctx.lineCap = 'round';
        
        // Left arm
        this.ctx.beginPath();
        this.ctx.moveTo(x - 10, y + 15);
        this.ctx.lineTo(x - 18, y + 25);
        this.ctx.stroke();
        
        // Right arm
        this.ctx.beginPath();
        this.ctx.moveTo(x + 10, y + 15);
        this.ctx.lineTo(x + 18, y + 25);
        this.ctx.stroke();

        // Legs
        this.ctx.strokeStyle = '#2c3e50';
        this.ctx.lineWidth = 5;
        
        // Left leg
        this.ctx.beginPath();
        this.ctx.moveTo(x - 8, y + 40);
        this.ctx.lineTo(x - 8, y + 55);
        this.ctx.stroke();
        
        // Right leg
        this.ctx.beginPath();
        this.ctx.moveTo(x + 8, y + 40);
        this.ctx.lineTo(x + 8, y + 55);
        this.ctx.stroke();

        // Face - eyes
        this.ctx.fillStyle = '#000';
        this.ctx.beginPath();
        this.ctx.arc(x - 8, y - 2, 3, 0, Math.PI * 2);
        this.ctx.arc(x + 8, y - 2, 3, 0, Math.PI * 2);
        this.ctx.fill();

        // Sparkle in eyes
        this.ctx.fillStyle = '#fff';
        this.ctx.beginPath();
        this.ctx.arc(x - 7, y - 3, 1.5, 0, Math.PI * 2);
        this.ctx.arc(x + 9, y - 3, 1.5, 0, Math.PI * 2);
        this.ctx.fill();

        // Mouth
        this.ctx.strokeStyle = '#000';
        this.ctx.lineWidth = 1.5;
        this.ctx.beginPath();
        this.ctx.arc(x, y + 5, 6, 0.2, Math.PI - 0.2);
        this.ctx.stroke();

        // Avatar emoji on top
        this.ctx.font = '24px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(agent.avatar, x, y - 35);

        // Status indicator
        let statusColor = '#95a5a6';
        if (agent.status === 'working') statusColor = '#3498db';
        if (agent.status === 'completed') statusColor = '#2ecc71';
        if (agent.status === 'error') statusColor = '#e74c3c';

        this.ctx.fillStyle = statusColor;
        this.ctx.beginPath();
        this.ctx.arc(x + 18, y - 15, 5, 0, Math.PI * 2);
        this.ctx.fill();

        // Status pulse animation for working
        if (agent.status === 'working') {
            const pulse = Math.sin(Date.now() / 300) * 0.3 + 0.7;
            this.ctx.fillStyle = `rgba(52, 152, 219, ${pulse * 0.3})`;
            this.ctx.beginPath();
            this.ctx.arc(x + 18, y - 15, 8, 0, Math.PI * 2);
            this.ctx.fill();
        }

        // Name tag
        this.ctx.fillStyle = 'rgba(0,0,0,0.7)';
        this.ctx.fillRect(x - 40, y + 60, 80, 20);
        this.ctx.fillStyle = '#fff';
        this.ctx.font = 'bold 11px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(agent.name, x, y + 70);
    }

    handleCanvasClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;

        // Check if clicked on agent
        this.agents.forEach(agent => {
            const distance = Math.sqrt(
                Math.pow(clickX - agent.x, 2) + 
                Math.pow(clickY - agent.y, 2)
            );

            if (distance < 40) {
                this.showAgentModal(agent);
            }
        });
    }

    showAgentModal(agent) {
        const modal = document.getElementById('modal');
        const title = document.getElementById('modal-title');
        const logs = document.getElementById('modal-logs');

        title.textContent = `${agent.avatar} ${agent.name} - ${agent.role}`;
        
        logs.innerHTML = agent.logs.length > 0 
            ? agent.logs.map(log => `
                <div class="log-line">
                    <span class="log-timestamp">[${log.timestamp}]</span>
                    <span>${log.message}</span>
                </div>
            `).join('')
            : '<div class="log-line">📝 Belum ada aktivitas.</div>';

        modal.classList.add('active');
    }

    assignRandomTask(agent) {
        const tasks = [
            'Implementasi fitur login',
            'Design mockup dashboard',
            'Code review PR #142',
            'Bug fix responsive layout',
            'Update dokumentasi API',
            'Testing modul payment',
            'Refactor database schema',
            'Deploy ke staging server'
        ];

        const task = tasks[Math.floor(Math.random() * tasks.length)];
        agent.setTask(task);

        // Random walk to another desk
        const targetDesk = this.desks[Math.floor(Math.random() * this.desks.length)];
        agent.moveTo(targetDesk.x, targetDesk.y);

        // Simulate progress
        let progress = 0;
        const interval = setInterval(() => {
            progress += Math.random() * 15;
            agent.progress = Math.min(progress, 100);

            if (progress >= 100) {
                clearInterval(interval);
                agent.completeTask();

                // Return to original desk
                const homeDesk = this.desks[agent.deskIndex % this.desks.length];
                agent.moveTo(homeDesk.x, homeDesk.y);

                // Assign new task after delay
                setTimeout(() => {
                    if (Math.random() > 0.3) {
                        this.assignRandomTask(agent);
                    }
                }, 2000);
            } else {
                agent.addLog(`⚙️ Progress: ${Math.floor(agent.progress)}%`);
            }
        }, 1000);
    }

    startSimulation() {
        // Start random tasks for all agents with staggered start
        this.agents.forEach((agent, i) => {
            setTimeout(() => {
                this.assignRandomTask(agent);
            }, i * 2000);
        });
    }
}

function closeModal() {
    document.getElementById('modal').classList.remove('active');
}

// Initialize app
let app;
window.addEventListener('DOMContentLoaded', () => {
    app = new OfficeApp();
    
    // Auto-start simulation after 1 second
    setTimeout(() => {
        app.startSimulation();
    }, 1000);
});

// Global controls (can be called from console)
window.assignTask = (agentId, task) => {
    const agent = app.agents[agentId];
    if (agent) {
        agent.setTask(task);
        app.assignRandomTask(agent);
    }
};

window.stopAll = () => {
    app.agents.forEach(agent => {
        agent.status = 'idle';
        agent.task = 'Menunggu task...';
        agent.progress = 0;
    });
};
