# Agent Office 3D

Dashboard kantor 3D (Three.js) + backend Node.js. Deploy agen dari dashboard,
atau tampilkan agen Hermes milikmu sendiri (CLI, Telegram, …) sebagai karakter
3D yang jalan ke meja, mengetik, lalu memberi laporan selesai.

![stack](https://img.shields.io/badge/node-18%2B-green) ![license](https://img.shields.io/badge/license-MIT-blue)

## Fitur

- **Kantor 3D** — suasana siang, manusia proporsional bertopi, meja kerja, meja
  rapat, tooltip saat hover + klik untuk fokus kamera (cuma butuh Three.js r128)
- **Mode mirror** — setiap prompt Hermes (CLI maupun gateway Telegram) muncul
  sebagai agen 3D lewat shell hook + `hermes-bridge.js`. Agen tetap jalan di
  Hermes, tidak dijalankan dua kali.
- **Laporan selesai** — agen yang selesai menyimpan seluruh hasilnya: notifikasi
  toast, blok 📄 Hasil di jendela detail, kartu agen menetap (max 50)
- **Update live** — WebSocket menyiarkan spawn / progres / selesai
- **Mode demo** — satu klik mengisi kantor dengan agen simulasi

## Cara pakai (cepat)

Butuh: Node.js 18+ dan CLI [Hermes Agent](https://github.com/anomalyco/hermes-agent)
(khusus untuk mode mirror).

```bash
git clone <repo-url> agent-office-3d
cd agent-office-3d
npm install
cp .env.example .env   # boleh lewati, bawaan sudah jalan di localhost
npm start
```

Buka **http://localhost:3000**. Deploy dari tab Spawn, atau klik
`Demo: isi satu kantor`.

## Mirror agen Hermes milikmu (Telegram / CLI → tampil 3D)

Setiap ada prompt dan jawaban, Hermes memanggil shell hook. Bridge meneruskan
kejadian itu ke kantor, lalu kantor **menampilkan** sesinya (agennya tetap
jalan di Hermes — tidak ada kerja ganda).

1. Buka config Hermes (`$HERMES_HOME/config.yaml`, biasanya
   `~/.hermes/config.yaml` atau `%LOCALAPPDATA%\hermes\config.yaml`).
   Ganti path dengan **lokasi clone milikmu**:
   ```yaml
   hooks:
     pre_llm_call:
       - command: "node /path/ke/agent-office-3d/hermes-bridge.js"
         timeout: 10
     post_llm_call:
       - command: "node /path/ke/agent-office-3d/hermes-bridge.js"
         timeout: 10
   ```
2. Setujui hook sekali saat Hermes pertama kali menanyakannya (keputusan
   diingat). Untuk gateway yang jalan tanpa layar, pasang
   `hooks_auto_accept: true` — baca dulu catatan keamanan di bawah.
3. Kalau gateway dan kantor beda mesin, beri tahu bridge alamat kantormu:
   ```bash
   export OFFICE_URL=https://kantor-milikmu.example.com
   export OFFICE_WEBHOOK_SECRET=<sama-dengan-di-server>  # kalau server pakai secret
   ```
4. Restart gateway (`hermes gateway restart`), lalu chat di Telegram.
   Agen bernama `TG <kata awal prompt>` jalan masuk ke kantor 3D; jawabannya
   mendarat sebagai laporan selesai.

## Pengaturan

| Variable                | Bawaan                  | Gunanya                               |
|-------------------------|-------------------------|---------------------------------------|
| `PORT`                  | `3000`                  | Port HTTP + WebSocket                 |
| `OFFICE_URL`            | `http://localhost:3000` | Alamat server yang dituju bridge      |
| `OFFICE_WEBHOOK_SECRET` | *(kosong)*              | Kata sandi untuk `/webhook/*`         |

Secret kosong = webhook hanya terima dari **localhost** (aman untuk coba-coba).
Kalau server bisa diakses dari LAN/internet, wajib isi secret acak yang
panjang, lalu kirim lewat header `x-office-secret`.

## Daftar API

| Cara | Alamat                   | Isi / catatan                                        |
|------|--------------------------|------------------------------------------------------|
| POST | `/api/spawn`             | `{name, role, task, demo?}` — kantor menjalankan `hermes chat -q` |
| GET  | `/api/agents`            | Agen kerja + yang selesai (laporan tersimpan)        |
| GET  | `/api/agent/:id`         | Detail + seluruh `output`                            |
| POST | `/api/stop/:id`          | Matikan subprocess yang jalan                        |
| POST | `/webhook/hermes-event`  | `{event: spawn\|result, session_id, platform?, text}` — mirror |
| POST | `/webhook/telegram-agent`| Lawas; jadi mirror kalau ada `session_id`           |

WebSocket (satu port dengan HTTP): `agent_spawn`, `agent_update`,
`agent_complete` (sudah termasuk `output`), `agent_removed`.

## Mau ubah-ubah (untuk developer)

```
agent-office-3d/
├── index.html         # seluruh tampilan + CSS (header, sidebar, toast, modal)
├── app3d.js           # scene Three.js, model/animasi Agent3D, client WS
├── server.js          # Express + WS + logika spawn/mirror + webhook
├── hermes-bridge.js   # penerus hook Hermes → kantor (tanpa dependensi)
├── package.json
└── .env.example
```

- Ubah tampilan: blok `<style>` di `index.html` (warna di `--bg --panel --accent …`)
- Ubah manusia: `Agent3D.buildModel` / `update` di `app3d.js` (poros pinggul,
  grup kepala `headG`, pose mengetik, siklus jalan)
- Ubah API/perilaku: `server.js` (`spawnAgent`, `mirrorSpawn`,
  `mirrorResult`, `pruneAgents`)
- Jalan permanen: `pm2 start server.js --name agent` (restart otomatis,
  ikut nyala via `pm2 save`)

## Catatan keamanan (wajib baca sebelum dibuka ke publik)

- Server menjalankan perintah OS (`hermes chat -q`). **Jangan dibuka tanpa
  kunci**: isi `OFFICE_WEBHOOK_SECRET`, idealnya tambah login di depan
  (reverse proxy / VPN / Tailscale).
- `hooks_auto_accept: true` menyetujui **semua** shell hook Hermes berikutnya
  tanpa bertanya. Lebih baik setujui manual sekali saja; auto-accept hanya
  untuk mesin yang kamu kuasai.
- Isi hook = teks prompt/jawaban asli. Jaga log baik-baik.

## Kalau ada masalah

| Gejala | Obatnya |
|--------|---------|
| Chat Telegram, agen 3D tak muncul | `hermes hooks list` harus centang ✓ allowed; `hermes gateway restart` sehabis ubah config; pastikan `OFFICE_URL` bisa dibuka dari mesin gateway |
| Port backend bentrok | `netstat -ano \| findstr :3000`, atau jadikan pm2 satu-satunya pemilik (`pm2 show agent`) |
| Selesai tanpa laporan | Update `server.js` dan hard-refresh browser (Ctrl+Shift+R) |
| Hook jalan tapi kantor kosong | Bridge timeout 3 detik — server harus jawab cepat; intip log server |

## Lisensi

MIT — agenmu, kantormu.
