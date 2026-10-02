# 🏢 Agent Office 3D - Real Hermes Backend

Multi-agent orchestration dashboard dengan 3D visualization powered by Three.js + real Hermes agent spawning.

## ✨ Features

- **3D Office Environment** — chibi characters, desks, lighting, shadows
- **Real Hermes Integration** — spawn actual `hermes chat -q` processes
- **WebSocket Live Updates** — real-time status, progress, logs
- **Interactive Controls** — click & drag to rotate, scroll to zoom
- **Custom & Quick Tasks** — spawn agents dengan task apapun

## 🎮 Controls

- **Mouse Drag** — rotate camera
- **Mouse Wheel** — zoom in/out
- **Click Agent Card** — lihat full logs
- **Sidebar Controls** — spawn custom atau quick tasks

## 🚀 Installation

### 1. Install Node.js dependencies
```bash
cd C:/laragon/www/agent
npm install
```

### 2. Start Backend Server
```bash
npm start
```

Backend akan running di:
- **HTTP:** http://localhost:3000
- **WebSocket:** ws://localhost:3001

### 3. Buka Dashboard
```
http://localhost:3000/index3d.html
```

Atau via Laragon (jika Apache running):
```
http://localhost/agent/index3d.html
```

## 📡 Backend API

### POST /api/spawn
Spawn Hermes agent baru
```json
{
  "name": "Kiro Dev",
  "role": "Developer",
  "task": "Buat REST API untuk user management"
}
```

### GET /api/agents
List semua active agents

### GET /api/agent/:id
Detail agent + full logs

### POST /api/stop/:id
Stop agent process

## 🔧 Architecture

```
┌─────────────────┐
│   Frontend 3D   │  Three.js rendering + WebSocket client
│   (Browser)     │
└────────┬────────┘
         │ WebSocket
         ↓
┌─────────────────┐
│  Node.js Server │  Express + WS + process spawning
│   (Backend)     │
└────────┬────────┘
         │ spawn
         ↓
┌─────────────────┐
│  Hermes Agent   │  hermes chat -q "task"
│   (Subprocess)  │
└─────────────────┘
```

## 🎨 Agent Roles

| Role | Color | Avatar |
|------|-------|--------|
| Developer | Blue | 👨‍💻 |
| Designer | Pink | 👩‍🎨 |
| Manager | Orange | 👨‍💼 |
| QA | Purple | 🔍 |
| DevOps | Green | ⚙️ |

## 📝 Example Tasks

**Quick Tasks** (pre-built buttons):
- 📝 Code Review — "Review PR terakhir di repo"
- 🐛 Bug Fix — "Fix bug responsive di dashboard"
- 📚 Update Docs — "Update README.md dengan install guide"

**Custom Tasks** (input form):
```
"Buat FastAPI auth service dengan JWT"
"Design landing page untuk startup"
"Setup CI/CD pipeline dengan GitHub Actions"
"Test payment integration di staging"
```

## 🔮 Next Enhancements

### 1. **Persistent Task Queue**
Save task history + results ke database

### 2. **Multi-Agent Coordination**
Agent A pass context ke Agent B via shared state

### 3. **Custom Sprites**
Replace geometric models dengan actual sprite sheets

### 4. **Voice Commands**
Spawn agents via speech recognition

### 5. **Dashboard Analytics**
Task completion rate, avg duration, error tracking

## 🐛 Troubleshooting

### Backend tidak start
```bash
# Check Node.js installed
node --version

# Install dependencies
npm install

# Check port not in use
netstat -ano | findstr :3000
```

### WebSocket disconnected
- Pastikan backend running
- Check console untuk error messages
- Restart backend server

### Agent tidak spawn
- Check Hermes installed: `hermes --version`
- Check terminal output di backend console
- Verify task syntax valid

## 📂 File Structure

```
agent/
├── index3d.html       # 3D dashboard UI
├── app3d.js           # Three.js rendering + WebSocket
├── server.js          # Node.js backend + Hermes spawning
├── package.json       # Dependencies
├── index.html         # 2D version (original)
├── app.js             # 2D simulation
└── README.md          # This file
```

## 🔐 Security Notes

Backend spawns subprocess — **jangan expose ke public internet** tanpa auth!

Production checklist:
- [ ] Add authentication (JWT/OAuth)
- [ ] Rate limiting per user
- [ ] Input sanitization
- [ ] CORS whitelist
- [ ] Process resource limits

## 📄 License

MIT

---

**Created:** 2026-10-01  
**Tech Stack:** Node.js, Express, WebSocket, Three.js, Hermes Agent  
**Author:** Yoka Gustiyadi
