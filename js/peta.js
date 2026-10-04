// js/peta.js — Peta Kota Bandung (lazy init saat tab dibuka)
// ---------- Peta Kota Bandung (lazy init saat tab dibuka) ----------
    export const BDG_AREAS = [
        { name: 'Kantor Pusat', kec: 'Alun-alun', lat: -6.9218, lng: 107.6026, desc: 'HQ operasional — semua agen di-deploy dari sini.', status: 'Pusat komando' },
        { name: 'Coblong', kec: 'Dago', lat: -6.8850, lng: 107.6150, desc: 'Area kampus & startup — cocok untuk agen Developer.', status: 'Aktif' },
        { name: 'Bandung Wetan', kec: 'Gedung Sate', lat: -6.9050, lng: 107.6200, desc: 'Kawasan bisnis & pemerintahan — fokus agen Manager.', status: 'Aktif' },
        { name: 'Cibeunying Kidul', kec: 'Pahlawan', lat: -6.8950, lng: 107.6350, desc: 'Area residensial padat — cakupan agen QA lapangan.', status: 'Aktif' },
        { name: 'Lengkong', kec: 'Buah Batu', lat: -6.9350, lng: 107.6250, desc: 'Koridor komersial — patroli agen Security.', status: 'Aktif' },
        { name: 'Bojongloa Kaler', kec: 'Kopo', lat: -6.9400, lng: 107.5950, desc: 'Gerbang barat kota — pos agen DevOps & logistik.', status: 'Aktif' },
        { name: 'Sukasari', kec: 'Setiabudi', lat: -6.8750, lng: 107.6000, desc: 'Area hijau & edukasi — basis agen Designer.', status: 'Aktif' }
    ];
    let bdgMap = null, bdgMarkers = [];
    function showBdgArea(i) {
        const a = BDG_AREAS[i];
        if (!a) return;
        document.getElementById('dist-info').innerHTML =
            '<b>' + a.name + '</b> &middot; ' + a.kec + '<br>' + a.desc +
            '<br><span class="dist-status">' + a.status + '</span>';
        if (bdgMap) bdgMap.flyTo([a.lat, a.lng], 14, { duration: 0.8 });
    }
    function initBdgMap() {
        if (bdgMap) { setTimeout(() => bdgMap.invalidateSize(), 60); return; }
        if (typeof L === 'undefined') {
            document.getElementById('dist-info').innerHTML = '<b>Peta gagal dimuat.</b><br>Cek koneksi ke CDN Leaflet lalu buka tab ini lagi.';
            return;
        }
        bdgMap = L.map('bdg-map', { scrollWheelZoom: false }).setView([-6.9175, 107.6191], 12);
        bdgMap.on('click', () => bdgMap.scrollWheelZoom.enable());
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            maxZoom: 19,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        }).addTo(bdgMap);
        BDG_AREAS.forEach((a, i) => {
            const m = L.marker([a.lat, a.lng]).addTo(bdgMap);
            m.bindTooltip('<b>' + a.name + '</b>');
            m.on('click', () => showBdgArea(i));
            bdgMarkers.push(m);
        });
        document.getElementById('dist-grid').innerHTML = BDG_AREAS.map((a, i) =>
            '<div class="dist-chip" onclick="showBdgArea(' + i + ')">' + a.name + '<small>' + a.kec + '</small></div>'
        ).join('');
        setTimeout(() => bdgMap.invalidateSize(), 60);
    }

// expose untuk onclick di HTML
Object.assign(window, { showBdgArea, initBdgMap });
