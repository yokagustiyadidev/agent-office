// hermes-bridge.js — shell hook target for Hermes (CLI + gateway).
// stdin: hook JSON {hook_event_name, session_id, profile, extra:{...}}.
// Maps: pre_llm_call (first turn) -> office spawn/mirror,
//       post_llm_call -> office result (completion report).
// Always prints {} so hook return is ignored. Never blocks: 3s cap.
const http = require('http');
const fs = require('fs');
const path = require('path');

// Load .env dari folder project (jika ada) — kamu isi sendiri setelah clone.
// Variabel env yang sudah di-set di shell tetap menang atas isi .env.
try {
    const envFile = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
    for (const line of envFile.split(/\r?\n/)) {
        const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
        if (m && process.env[m[1]] === undefined) {
            process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
        }
    }
} catch { /* tanpa .env: pakai bawaan */ }

const OFFICE = process.env.OFFICE_URL || 'http://localhost:3000';
const SECRET = process.env.OFFICE_WEBHOOK_SECRET || '';

function post(path, body) {
    return new Promise((resolve) => {
        let done = false;
        const finish = () => { if (!done) { done = true; resolve(); } };
        try {
            const data = JSON.stringify(body);
            const u = new URL(OFFICE + path);
            const req = http.request({
                hostname: u.hostname, port: u.port || 80, path: u.pathname,
                method: 'POST', headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(data),
                    ...(SECRET ? { 'x-office-secret': SECRET } : {})
                },
                timeout: 3000
            }, (res) => { res.resume(); res.on('end', finish); });
            req.on('timeout', () => { req.destroy(); finish(); });
            req.on('error', finish);
            req.write(data);
            req.end();
        } catch { finish(); }
    });
}

async function main(raw) {
    try {
        const p = JSON.parse(raw || '{}');
        const event = p.hook_event_name;
        const sessionId = p.session_id;
        const extra = p.extra || {};
        if (!sessionId) return;
        if (event === 'pre_llm_call' && extra.is_first_turn && extra.user_message) {
            await post('/webhook/hermes-event', {
                event: 'spawn', session_id: sessionId,
                platform: extra.platform || 'hermes',
                text: String(extra.user_message).slice(0, 500)
            });
        } else if (event === 'post_llm_call' && extra.assistant_response) {
            await post('/webhook/hermes-event', {
                event: 'result', session_id: sessionId,
                platform: extra.platform || 'hermes',
                text: String(extra.assistant_response).slice(0, 4000)
            });
        }
    } catch { /* never fail the hook */ }
}

let raw = '';
let fired = false;
async function fire() {
    if (fired) return;
    fired = true;
    await main(raw);
    process.stdout.write('{}\n');
}
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => { raw += c; });
process.stdin.on('end', fire);
setTimeout(fire, 4000);
