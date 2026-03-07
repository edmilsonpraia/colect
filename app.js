// ============================================================
// COPIA COLECT - App principal
// ============================================================

// Service Worker (PWA)
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
}

// ============================================================
// PROJETOS
// ============================================================
function loadProjects() {
    return JSON.parse(localStorage.getItem('cc-projects') || '["Projeto 1"]');
}
function saveProjects(projects) {
    localStorage.setItem('cc-projects', JSON.stringify(projects));
}
function getActiveProject() {
    return localStorage.getItem('cc-active-project') || loadProjects()[0];
}
function setActiveProject(name) {
    localStorage.setItem('cc-active-project', name);
}
function getProjectKey(name) {
    return `cc-points-${name}`;
}

let projects = loadProjects();
let activeProject = getActiveProject();
if (!projects.includes(activeProject)) { activeProject = projects[0]; setActiveProject(activeProject); }

// ============================================================
// ESTADO
// ============================================================
const state = {
    points: JSON.parse(localStorage.getItem(getProjectKey(activeProject)) || '[]'),
    tracking: false,
    watchId: null,
    currentLat: null,
    currentLng: null,
    measureMode: false,
    measurePoints: [],
};

// ============================================================
// MAPA
// ============================================================
const map = L.map('map').setView([-12.5, 18.5], 6); // Angola

const tileDark = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap', maxZoom: 19,
});
tileDark.addTo(map);

const markersLayer = L.layerGroup().addTo(map);
const pathLayer = L.layerGroup().addTo(map);
const measureLayer = L.layerGroup().addTo(map);

// ============================================================
// DOM ELEMENTS
// ============================================================
const $ = (id) => document.getElementById(id);
const latDisplay = $('lat-display'), lngDisplay = $('lng-display');
const btnLocate = $('btn-locate'), btnAdd = $('btn-add'), btnTrack = $('btn-track');
const btnClear = $('btn-clear'), btnExport = $('btn-export'), btnImport = $('btn-import');
const btnMeasure = $('btn-measure'), btnTheme = $('btn-theme'), btnShare = $('btn-share');
const fileImport = $('file-import');
const pointsContainer = $('points-container'), pointsCount = $('points-count');
const totalDistance = $('total-distance'), totalArea = $('total-area'), totalPoints = $('total-points');
const elevCanvas = $('elev-canvas'), elevTooltip = $('elev-tooltip');
const elevEmpty = $('elev-empty'), elevChart = $('elevation-chart');
const elevMin = $('elev-min'), elevMax = $('elev-max'), elevGain = $('elev-gain');
const modalOverlay = $('modal-overlay'), inputLabel = $('input-label');
const modalCoords = $('modal-coords'), modalCancel = $('modal-cancel'), modalConfirm = $('modal-confirm');
const modalTitle = $('modal-title');
const inputCategory = $('input-category'), colorPicker = $('color-picker');
const photoInput = $('photo-input'), photoPreview = $('photo-preview');
const btnTakePhoto = $('btn-take-photo'), btnRemovePhoto = $('btn-remove-photo');
const projectSelect = $('project-select');
const btnNewProject = $('btn-new-project'), btnRenameProject = $('btn-rename-project'), btnDeleteProject = $('btn-delete-project');
const searchInput = $('search-input'), searchResults = $('search-results');
const measureBar = $('measure-bar'), measureText = $('measure-text'), btnMeasureCancel = $('btn-measure-cancel');
const exportOverlay = $('export-overlay'), exportCancel = $('export-cancel');

// ============================================================
// TEMA
// ============================================================
const savedTheme = localStorage.getItem('cc-theme') || 'dark';
document.body.dataset.theme = savedTheme;

btnTheme.addEventListener('click', () => {
    const next = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
    document.body.dataset.theme = next;
    localStorage.setItem('cc-theme', next);
    // Re-render elevation chart with new colors
    renderElevationChart();
});

// ============================================================
// PROJETOS UI
// ============================================================
function renderProjectSelect() {
    projectSelect.innerHTML = '';
    projects.forEach((p) => {
        const opt = document.createElement('option');
        opt.value = p; opt.textContent = p;
        if (p === activeProject) opt.selected = true;
        projectSelect.appendChild(opt);
    });
}

projectSelect.addEventListener('change', () => {
    activeProject = projectSelect.value;
    setActiveProject(activeProject);
    state.points = JSON.parse(localStorage.getItem(getProjectKey(activeProject)) || '[]');
    elevationCache = {};
    elevationData = [];
    renderAll();
    fitBounds();
});

btnNewProject.addEventListener('click', () => {
    const name = prompt('Nome do novo projeto:');
    if (!name || !name.trim()) return;
    const trimmed = name.trim();
    if (projects.includes(trimmed)) { alert('Projeto ja existe.'); return; }
    projects.push(trimmed);
    saveProjects(projects);
    activeProject = trimmed;
    setActiveProject(activeProject);
    state.points = [];
    savePoints();
    elevationCache = {};
    elevationData = [];
    renderProjectSelect();
    renderAll();
});

btnRenameProject.addEventListener('click', () => {
    const name = prompt('Novo nome:', activeProject);
    if (!name || !name.trim() || name.trim() === activeProject) return;
    const trimmed = name.trim();
    if (projects.includes(trimmed)) { alert('Nome ja existe.'); return; }
    const oldKey = getProjectKey(activeProject);
    const data = localStorage.getItem(oldKey);
    const idx = projects.indexOf(activeProject);
    projects[idx] = trimmed;
    saveProjects(projects);
    localStorage.removeItem(oldKey);
    activeProject = trimmed;
    setActiveProject(activeProject);
    localStorage.setItem(getProjectKey(activeProject), data || '[]');
    renderProjectSelect();
});

btnDeleteProject.addEventListener('click', () => {
    if (projects.length <= 1) { alert('Deve haver pelo menos 1 projeto.'); return; }
    if (!confirm(`Excluir projeto "${activeProject}" e todos os seus pontos?`)) return;
    localStorage.removeItem(getProjectKey(activeProject));
    projects = projects.filter((p) => p !== activeProject);
    saveProjects(projects);
    activeProject = projects[0];
    setActiveProject(activeProject);
    state.points = JSON.parse(localStorage.getItem(getProjectKey(activeProject)) || '[]');
    elevationCache = {};
    elevationData = [];
    renderProjectSelect();
    renderAll();
    fitBounds();
});

renderProjectSelect();

// ============================================================
// COORDENADAS DISPLAY
// ============================================================
function updateCoordsDisplay(lat, lng) {
    state.currentLat = lat;
    state.currentLng = lng;
    latDisplay.textContent = `Lat: ${lat.toFixed(6)}`;
    lngDisplay.textContent = `Lng: ${lng.toFixed(6)}`;
}

// ============================================================
// ICONES DO MAPA
// ============================================================
function createIcon(index, color) {
    const c = color || '#4ec9b0';
    return L.divIcon({
        className: 'custom-marker',
        html: `<div style="background:${c};color:#fff;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:11px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.4);text-shadow:0 1px 2px rgba(0,0,0,0.3)">${index + 1}</div>`,
        iconSize: [24, 24], iconAnchor: [12, 12],
    });
}

const currentPosIcon = L.divIcon({
    className: 'current-pos-marker',
    html: '<div style="background:#0e639c;width:14px;height:14px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 10px rgba(14,99,156,0.6)"></div>',
    iconSize: [14, 14], iconAnchor: [7, 7],
});

let currentPosMarker = null;

// ============================================================
// GEOLOCALIZACAO
// ============================================================
let locateWatchId = null;

function getLocation() {
    if (!navigator.geolocation) { alert('Geolocalizacao nao suportada.'); return; }

    // Aviso se abrir via file://
    if (location.protocol === 'file:') {
        alert('Para GPS preciso, abra o app via servidor (http/https).\nVia file:// o navegador usa localizacao por IP (imprecisa).\n\nDica: use "npx serve" ou Live Server no VS Code.');
    }

    btnLocate.innerHTML = '<i class="codicon codicon-loading codicon-modifier-spin"></i><span>Buscando GPS...</span>';
    btnLocate.disabled = true;

    // Cancelar busca anterior se houver
    if (locateWatchId) { navigator.geolocation.clearWatch(locateWatchId); locateWatchId = null; }

    let bestAccuracy = Infinity;
    let attempts = 0;
    const maxAttempts = 5;
    const timeoutLimit = 15000;
    const startTime = Date.now();

    // Usar watchPosition para pegar sinal GPS real (mais preciso que getCurrentPosition)
    locateWatchId = navigator.geolocation.watchPosition(
        (pos) => {
            const { latitude, longitude, accuracy } = pos.coords;
            attempts++;

            updateCoordsDisplay(latitude, longitude);

            // Atualizar marcador
            if (currentPosMarker) {
                currentPosMarker.setLatLng([latitude, longitude]);
                currentPosMarker.setPopupContent(`Voce esta aqui<br><small>Precisao: ${accuracy.toFixed(0)} m</small>`);
            } else {
                currentPosMarker = L.marker([latitude, longitude], { icon: currentPosIcon })
                    .addTo(map)
                    .bindPopup(`Voce esta aqui<br><small>Precisao: ${accuracy.toFixed(0)} m</small>`);

                // Circulo de precisao
                currentPosMarker._accuracyCircle = L.circle([latitude, longitude], {
                    radius: accuracy, color: '#0e639c', fillColor: '#0e639c',
                    fillOpacity: 0.08, weight: 1, dashArray: '4,4',
                }).addTo(map);
            }

            if (currentPosMarker._accuracyCircle) {
                currentPosMarker._accuracyCircle.setLatLng([latitude, longitude]);
                currentPosMarker._accuracyCircle.setRadius(accuracy);
            }

            map.setView([latitude, longitude], accuracy < 50 ? 18 : accuracy < 200 ? 16 : 14);

            btnLocate.innerHTML = `<i class="codicon codicon-loading codicon-modifier-spin"></i><span>${accuracy.toFixed(0)}m</span>`;

            // Parar quando tiver boa precisao ou atingir limite
            if (accuracy < bestAccuracy) bestAccuracy = accuracy;
            const elapsed = Date.now() - startTime;

            if (accuracy <= 20 || attempts >= maxAttempts || elapsed >= timeoutLimit) {
                navigator.geolocation.clearWatch(locateWatchId);
                locateWatchId = null;
                btnLocate.innerHTML = '<i class="codicon codicon-compass"></i><span>Localizar</span>';
                btnLocate.disabled = false;

                // Remover circulo apos 5s
                if (currentPosMarker?._accuracyCircle) {
                    setTimeout(() => {
                        if (currentPosMarker?._accuracyCircle) {
                            map.removeLayer(currentPosMarker._accuracyCircle);
                            currentPosMarker._accuracyCircle = null;
                        }
                    }, 5000);
                }
            }
        },
        (err) => {
            if (locateWatchId) { navigator.geolocation.clearWatch(locateWatchId); locateWatchId = null; }
            alert(`Erro GPS: ${err.message}\n\nVerifique se o GPS esta ativado e se deu permissao de localizacao.`);
            btnLocate.innerHTML = '<i class="codicon codicon-compass"></i><span>Localizar</span>';
            btnLocate.disabled = false;
        },
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
}

// ============================================================
// MODAL (legenda + cor + categoria + foto)
// ============================================================
let pendingPoint = null;
let currentPhoto = '';
let selectedColor = '#4ec9b0';

colorPicker.addEventListener('click', (e) => {
    const dot = e.target.closest('.color-dot');
    if (!dot) return;
    colorPicker.querySelectorAll('.color-dot').forEach((d) => d.classList.remove('selected'));
    dot.classList.add('selected');
    selectedColor = dot.dataset.color;
});

btnTakePhoto.addEventListener('click', () => photoInput.click());

photoInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        // Resize to max 400px for storage
        const img = new Image();
        img.onload = () => {
            const max = 400;
            let w = img.width, h = img.height;
            if (w > max || h > max) {
                if (w > h) { h = Math.round(h * max / w); w = max; }
                else { w = Math.round(w * max / h); h = max; }
            }
            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            currentPhoto = canvas.toDataURL('image/jpeg', 0.7);
            photoPreview.src = currentPhoto;
            photoPreview.classList.remove('hidden');
            btnRemovePhoto.classList.remove('hidden');
        };
        img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
});

btnRemovePhoto.addEventListener('click', () => {
    currentPhoto = '';
    photoPreview.classList.add('hidden');
    btnRemovePhoto.classList.add('hidden');
});

function openLabelModal(lat, lng, callback, editData) {
    pendingPoint = { lat, lng, callback };
    inputLabel.value = editData?.label || '';
    inputCategory.value = editData?.category || '';
    selectedColor = editData?.color || '#4ec9b0';
    currentPhoto = editData?.photo || '';
    modalTitle.textContent = editData ? 'Editar Ponto' : 'Adicionar Ponto';
    modalCoords.textContent = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;

    colorPicker.querySelectorAll('.color-dot').forEach((d) => {
        d.classList.toggle('selected', d.dataset.color === selectedColor);
    });

    if (currentPhoto) {
        photoPreview.src = currentPhoto;
        photoPreview.classList.remove('hidden');
        btnRemovePhoto.classList.remove('hidden');
    } else {
        photoPreview.classList.add('hidden');
        btnRemovePhoto.classList.add('hidden');
    }

    modalOverlay.classList.remove('hidden');
    setTimeout(() => inputLabel.focus(), 50);
}

function closeLabelModal() {
    modalOverlay.classList.add('hidden');
    pendingPoint = null;
}

modalCancel.addEventListener('click', closeLabelModal);
modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeLabelModal(); });

modalConfirm.addEventListener('click', () => {
    if (!pendingPoint) return;
    pendingPoint.callback({
        label: inputLabel.value.trim(),
        category: inputCategory.value,
        color: selectedColor,
        photo: currentPhoto,
    });
    closeLabelModal();
});

inputLabel.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); modalConfirm.click(); }
    if (e.key === 'Escape') closeLabelModal();
});

// ============================================================
// PONTOS CRUD
// ============================================================
function addPoint(lat, lng, meta) {
    state.points.push({
        lat, lng,
        label: meta?.label || '',
        category: meta?.category || '',
        color: meta?.color || '#4ec9b0',
        photo: meta?.photo || '',
        timestamp: new Date().toISOString(),
    });
    savePoints();
    renderAll();
}

function addPointWithLabel(lat, lng) {
    openLabelModal(lat, lng, (meta) => addPoint(lat, lng, meta));
}

function editPoint(index) {
    const p = state.points[index];
    openLabelModal(p.lat, p.lng, (meta) => {
        Object.assign(state.points[index], meta);
        savePoints();
        renderAll();
    }, p);
}

function removePoint(index) {
    state.points.splice(index, 1);
    savePoints();
    renderAll();
}

function savePoints() {
    localStorage.setItem(getProjectKey(activeProject), JSON.stringify(state.points));
}

// ============================================================
// CALULOS
// ============================================================
function haversine(lat1, lng1, lat2, lng2) {
    const R = 6371000, toRad = (x) => (x * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calcTotalDistance() {
    let t = 0;
    for (let i = 1; i < state.points.length; i++) {
        t += haversine(state.points[i-1].lat, state.points[i-1].lng, state.points[i].lat, state.points[i].lng);
    }
    return t;
}

function formatDistance(m) { return m >= 1000 ? `${(m/1000).toFixed(2)} km` : `${m.toFixed(0)} m`; }

function calcArea() {
    if (state.points.length < 3) return 0;
    const toRad = (x) => (x * Math.PI) / 180, R = 6371000;
    let area = 0; const pts = state.points;
    for (let i = 0; i < pts.length; i++) {
        const j = (i + 1) % pts.length;
        area += toRad(pts[j].lng - pts[i].lng) * (2 + Math.sin(toRad(pts[i].lat)) + Math.sin(toRad(pts[j].lat)));
    }
    return Math.abs((area * R * R) / 2);
}

function formatArea(m2) {
    if (m2 === 0) return '--';
    if (m2 >= 1e6) return `${(m2/1e6).toFixed(2)} km²`;
    if (m2 >= 1e4) return `${(m2/1e4).toFixed(2)} ha`;
    return `${m2.toFixed(0)} m²`;
}

// ============================================================
// ELEVACAO
// ============================================================
let elevationCache = {}, elevationData = [];

async function fetchElevation() {
    if (state.points.length === 0) { elevationData = []; renderElevationChart(); return; }
    const uncached = state.points.filter((p) => elevationCache[`${p.lat.toFixed(4)},${p.lng.toFixed(4)}`] === undefined);
    if (uncached.length > 0) {
        elevEmpty.textContent = 'Buscando elevacao...'; elevEmpty.className = 'elev-loading';
        elevEmpty.style.display = ''; elevChart.style.display = 'none';
        try {
            const res = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${uncached.map(p=>p.lat.toFixed(4)).join(',')}&longitude=${uncached.map(p=>p.lng.toFixed(4)).join(',')}`);
            const data = await res.json();
            const elev = Array.isArray(data.elevation) ? data.elevation : [data.elevation];
            uncached.forEach((p, i) => { elevationCache[`${p.lat.toFixed(4)},${p.lng.toFixed(4)}`] = elev[i] ?? null; });
        } catch { uncached.forEach((p) => { elevationCache[`${p.lat.toFixed(4)},${p.lng.toFixed(4)}`] = null; }); }
    }
    elevationData = state.points.map((p) => elevationCache[`${p.lat.toFixed(4)},${p.lng.toFixed(4)}`]);
    renderElevationChart();
}

function cumulativeDistances() {
    const d = [0];
    for (let i = 1; i < state.points.length; i++)
        d.push(d[i-1] + haversine(state.points[i-1].lat, state.points[i-1].lng, state.points[i].lat, state.points[i].lng));
    return d;
}

function renderElevationChart() {
    const valid = elevationData.filter((e) => e != null);
    if (valid.length < 2) {
        elevChart.style.display = 'none'; elevEmpty.style.display = '';
        elevEmpty.className = 'elev-empty'; elevEmpty.textContent = 'Adicione pontos para ver o perfil de elevacao';
        elevMin.textContent = '--'; elevMax.textContent = '--'; elevGain.textContent = '--';
        return;
    }
    elevChart.style.display = ''; elevEmpty.style.display = 'none';
    const canvas = elevCanvas, dpr = window.devicePixelRatio || 1;
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width * dpr; canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + 'px'; canvas.style.height = rect.height + 'px';
    const ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr);
    const W = rect.width, H = rect.height, pad = { top: 14, right: 10, bottom: 24, left: 40 };
    ctx.clearRect(0, 0, W, H);
    const dists = cumulativeDistances(), totalDist = dists[dists.length-1] || 1;
    const minE = Math.min(...valid), maxE = Math.max(...valid), rangeE = maxE - minE || 1;
    const isDark = document.body.dataset.theme === 'dark';
    const textColor = isDark ? '#555' : '#999';
    const lineColor = isDark ? '#4ec9b0' : '#16825d';

    elevMin.textContent = `${minE.toFixed(0)} m`; elevMax.textContent = `${maxE.toFixed(0)} m`;
    let gain = 0;
    for (let i = 1; i < elevationData.length; i++) {
        if (elevationData[i] != null && elevationData[i-1] != null && elevationData[i] > elevationData[i-1])
            gain += elevationData[i] - elevationData[i-1];
    }
    elevGain.textContent = `${gain.toFixed(0)} m`;
    const cW = W - pad.left - pad.right, cH = H - pad.top - pad.bottom;
    const toX = (d) => pad.left + (d / totalDist) * cW;
    const toY = (e) => pad.top + cH - ((e - minE) / rangeE) * cH;

    ctx.strokeStyle = isDark ? '#ffffff08' : '#00000008'; ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) { const y = pad.top + (i/4)*cH; ctx.beginPath(); ctx.moveTo(pad.left,y); ctx.lineTo(W-pad.right,y); ctx.stroke(); }
    ctx.fillStyle = textColor; ctx.font = '10px Consolas'; ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) { ctx.fillText(`${(maxE - (i/4)*rangeE).toFixed(0)}m`, pad.left-4, pad.top+(i/4)*cH+3); }
    ctx.textAlign = 'center';
    for (let i = 0; i <= 4; i++) { const d = (i/4)*totalDist; ctx.fillText(d>=1000?`${(d/1000).toFixed(1)}km`:`${d.toFixed(0)}m`, toX(d), H-4); }

    const pts = [];
    for (let i = 0; i < elevationData.length; i++) { if (elevationData[i] != null) pts.push({ x: toX(dists[i]), y: toY(elevationData[i]), idx: i }); }
    if (pts.length < 2) return;

    const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top+cH);
    grad.addColorStop(0, isDark ? 'rgba(78,201,176,0.25)' : 'rgba(22,130,93,0.2)');
    grad.addColorStop(1, isDark ? 'rgba(78,201,176,0.02)' : 'rgba(22,130,93,0.02)');
    ctx.beginPath(); ctx.moveTo(pts[0].x, pad.top+cH); pts.forEach((p) => ctx.lineTo(p.x, p.y));
    ctx.lineTo(pts[pts.length-1].x, pad.top+cH); ctx.closePath(); ctx.fillStyle = grad; ctx.fill();
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.strokeStyle = lineColor; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke();
    pts.forEach((p) => {
        ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI*2);
        ctx.fillStyle = lineColor; ctx.fill();
        ctx.strokeStyle = isDark ? '#1e1e1e' : '#f3f3f3'; ctx.lineWidth = 1.5; ctx.stroke();
    });
    canvas._pts = pts; canvas._dists = dists;
}

elevCanvas.addEventListener('mousemove', (e) => {
    const pts = elevCanvas._pts; if (!pts?.length) return;
    const rect = elevCanvas.getBoundingClientRect(), mx = e.clientX - rect.left;
    let closest = pts[0], minD = Infinity;
    pts.forEach((p) => { const d = Math.abs(p.x - mx); if (d < minD) { minD = d; closest = p; } });
    if (minD > 30) { elevTooltip.classList.add('hidden'); return; }
    const pt = state.points[closest.idx], el = elevationData[closest.idx];
    const dist = elevCanvas._dists[closest.idx];
    const dStr = dist >= 1000 ? `${(dist/1000).toFixed(2)} km` : `${dist.toFixed(0)} m`;
    elevTooltip.innerHTML = `${pt.label ? `<b>${pt.label}</b><br>` : ''}Elev: ${el.toFixed(0)} m<br>Dist: ${dStr}`;
    elevTooltip.classList.remove('hidden');
    let tx = closest.x + 10, ty = closest.y - 40;
    if (tx + 100 > rect.width) tx = closest.x - 110;
    if (ty < 0) ty = closest.y + 10;
    elevTooltip.style.left = tx + 'px'; elevTooltip.style.top = ty + 'px';
});
elevCanvas.addEventListener('mouseleave', () => elevTooltip.classList.add('hidden'));

// ============================================================
// RENDERIZACAO MAPA
// ============================================================
function renderMap() {
    markersLayer.clearLayers(); pathLayer.clearLayers();
    if (state.points.length === 0) return;

    state.points.forEach((point, i) => {
        const labelText = point.label || `Ponto ${i + 1}`;
        const elev = elevationData[i];
        const elevStr = elev != null ? `<br><span style="color:#569cd6;font-size:12px">Elev: ${elev.toFixed(0)} m</span>` : '';
        const photoStr = point.photo ? `<br><img src="${point.photo}" style="width:120px;border-radius:4px;margin-top:4px">` : '';
        const catStr = point.category ? `<br><span style="color:#888;font-size:11px">${point.category}</span>` : '';
        const marker = L.marker([point.lat, point.lng], { icon: createIcon(i, point.color) })
            .bindPopup(
                `<b style="color:${point.color || '#4ec9b0'};font-size:14px">${labelText}</b>${catStr}<br>` +
                `<span style="color:#999;font-size:12px">${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}</span>` +
                elevStr + photoStr + `<br><small style="color:#666">${new Date(point.timestamp).toLocaleString('pt-BR')}</small>`
            );
        if (point.label) marker.bindTooltip(point.label, { permanent: true, direction: 'top', offset: [0, -14], className: 'label-tooltip' });
        markersLayer.addLayer(marker);
    });

    if (state.points.length >= 2) {
        pathLayer.addLayer(L.polyline(state.points.map((p) => [p.lat, p.lng]), {
            color: '#4ec9b0', weight: 3, opacity: 0.8, dashArray: '8, 6',
        }));
    }
    if (state.points.length >= 3) {
        pathLayer.addLayer(L.polygon(state.points.map((p) => [p.lat, p.lng]), {
            color: '#4ec9b033', fillColor: '#4ec9b0', fillOpacity: 0.06, weight: 1, dashArray: '4, 4',
        }));
    }
}

// ============================================================
// RENDERIZACAO LISTA
// ============================================================
function renderPointsList() {
    pointsContainer.innerHTML = '';
    state.points.forEach((point, i) => {
        const time = new Date(point.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const lbl = point.label
            ? `<span class="point-label" title="${point.label}">${point.label}</span>`
            : `<span class="point-label" style="color:var(--text-dim2);font-style:italic">--</span>`;
        const elev = elevationData[i];
        const elevD = elev != null ? `<span class="point-elev">${elev.toFixed(0)}m</span>` : '';
        const photoIcon = point.photo ? '<i class="codicon codicon-device-camera point-photo-icon"></i>' : '';
        const div = document.createElement('div');
        div.className = 'point-item';
        div.innerHTML = `
            <span class="point-color-dot" style="background:${point.color || '#4ec9b0'}"></span>
            <span class="point-index">#${i + 1}</span>
            ${lbl}
            <span class="point-coords">${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}</span>
            ${elevD} ${photoIcon}
            <span class="point-time">${time}</span>
            <button class="point-label-edit" onclick="editPoint(${i})" title="Editar"><i class="codicon codicon-edit"></i></button>
            <button class="btn-focus" onclick="focusPoint(${i})" title="Focar"><i class="codicon codicon-eye"></i></button>
            <button class="btn-remove" onclick="removePoint(${i})" title="Remover"><i class="codicon codicon-close"></i></button>
        `;
        pointsContainer.appendChild(div);
    });
}

function renderStats() {
    totalDistance.textContent = formatDistance(calcTotalDistance());
    totalArea.textContent = formatArea(calcArea());
    totalPoints.textContent = state.points.length;
    pointsCount.textContent = state.points.length;
}

function renderAll() { renderMap(); renderPointsList(); renderStats(); fetchElevation(); }

function focusPoint(index) { map.setView([state.points[index].lat, state.points[index].lng], 17); }

function fitBounds() {
    if (state.points.length > 0) {
        map.fitBounds(L.latLngBounds(state.points.map((p) => [p.lat, p.lng])), { padding: [30, 30] });
    }
}

// ============================================================
// RASTREAMENTO
// ============================================================
function toggleTracking() {
    if (state.tracking) {
        navigator.geolocation.clearWatch(state.watchId);
        state.tracking = false; state.watchId = null;
        btnTrack.innerHTML = '<i class="codicon codicon-record"></i><span>Rastreio</span>';
        btnTrack.classList.remove('tracking');
    } else {
        if (!navigator.geolocation) { alert('Geolocalizacao nao suportada.'); return; }
        state.tracking = true;
        btnTrack.innerHTML = '<i class="codicon codicon-debug-stop"></i><span>Parar</span>';
        btnTrack.classList.add('tracking');
        state.watchId = navigator.geolocation.watchPosition(
            (pos) => {
                const { latitude, longitude } = pos.coords;
                updateCoordsDisplay(latitude, longitude);
                if (state.points.length === 0) { addPoint(latitude, longitude, {}); map.setView([latitude, longitude], 16); }
                else {
                    const last = state.points[state.points.length - 1];
                    if (haversine(last.lat, last.lng, latitude, longitude) >= 5) {
                        addPoint(latitude, longitude, {}); map.setView([latitude, longitude], 16);
                    }
                }
                if (currentPosMarker) currentPosMarker.setLatLng([latitude, longitude]);
                else currentPosMarker = L.marker([latitude, longitude], { icon: currentPosIcon }).addTo(map);
            },
            (err) => { alert(`Erro: ${err.message}`); toggleTracking(); },
            { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
        );
    }
}

// ============================================================
// MEDICAO PONTO-A-PONTO
// ============================================================
function toggleMeasure() {
    state.measureMode = !state.measureMode;
    state.measurePoints = [];
    measureLayer.clearLayers();
    btnMeasure.classList.toggle('active', state.measureMode);
    measureBar.classList.toggle('hidden', !state.measureMode);
    measureText.textContent = 'Clique em 2 pontos no mapa para medir';
}

btnMeasure.addEventListener('click', toggleMeasure);
btnMeasureCancel.addEventListener('click', toggleMeasure);

map.on('click', (e) => {
    updateCoordsDisplay(e.latlng.lat, e.latlng.lng);

    if (state.measureMode) {
        state.measurePoints.push(e.latlng);
        measureLayer.addLayer(L.circleMarker(e.latlng, { radius: 5, color: '#569cd6', fillColor: '#569cd6', fillOpacity: 1 }));

        if (state.measurePoints.length === 2) {
            const [p1, p2] = state.measurePoints;
            const dist = haversine(p1.lat, p1.lng, p2.lat, p2.lng);
            measureLayer.addLayer(L.polyline([p1, p2], { color: '#569cd6', weight: 2, dashArray: '6,4' }));
            measureText.textContent = `Distancia: ${formatDistance(dist)}`;
            state.measurePoints = [];
            setTimeout(() => {
                measureLayer.clearLayers();
                measureText.textContent = 'Clique em 2 pontos para medir novamente';
            }, 5000);
        } else {
            measureText.textContent = 'Clique no segundo ponto...';
        }
    }
});

// ============================================================
// BUSCA POR ENDERECO (Nominatim)
// ============================================================
let searchTimeout = null;

searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    const q = searchInput.value.trim();
    if (q.length < 3) { searchResults.classList.add('hidden'); return; }
    searchTimeout = setTimeout(async () => {
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(q)}`);
            const data = await res.json();
            searchResults.innerHTML = '';
            if (data.length === 0) { searchResults.classList.add('hidden'); return; }
            data.forEach((r) => {
                const div = document.createElement('div');
                div.className = 'search-item';
                div.textContent = r.display_name;
                div.addEventListener('click', () => {
                    const lat = parseFloat(r.lat), lng = parseFloat(r.lon);
                    map.setView([lat, lng], 16);
                    updateCoordsDisplay(lat, lng);
                    searchResults.classList.add('hidden');
                    searchInput.value = '';
                });
                searchResults.appendChild(div);
            });
            searchResults.classList.remove('hidden');
        } catch { searchResults.classList.add('hidden'); }
    }, 400);
});

searchInput.addEventListener('blur', () => { setTimeout(() => searchResults.classList.add('hidden'), 200); });

searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { searchResults.classList.add('hidden'); searchInput.blur(); }
});

// ============================================================
// EXPORTAR (JSON / GPX / KML)
// ============================================================
function clearPoints() {
    if (state.points.length === 0) return;
    if (!confirm('Limpar todos os pontos do projeto atual?')) return;
    state.points = []; savePoints(); renderAll();
}

btnExport.addEventListener('click', () => {
    if (state.points.length === 0) { alert('Nenhum ponto para exportar.'); return; }
    exportOverlay.classList.remove('hidden');
});

exportCancel.addEventListener('click', () => exportOverlay.classList.add('hidden'));
exportOverlay.addEventListener('click', (e) => { if (e.target === exportOverlay) exportOverlay.classList.add('hidden'); });

document.querySelectorAll('.export-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
        const fmt = btn.dataset.format;
        const prefix = `copia-colect-${activeProject.replace(/\s+/g,'-')}-${new Date().toISOString().slice(0,10)}`;
        let content, mime, ext;

        if (fmt === 'json') {
            content = JSON.stringify(state.points, null, 2);
            mime = 'application/json'; ext = 'json';
        } else if (fmt === 'gpx') {
            const wpts = state.points.map((p, i) => {
                const name = p.label || `Ponto ${i+1}`;
                const el = elevationData[i];
                return `  <wpt lat="${p.lat}" lon="${p.lng}">${el != null ? `\n    <ele>${el}</ele>` : ''}\n    <name>${escXml(name)}</name>\n    <time>${p.timestamp}</time>\n  </wpt>`;
            }).join('\n');
            const trkpts = state.points.map((p) => {
                const el = elevationData[state.points.indexOf(p)];
                return `      <trkpt lat="${p.lat}" lon="${p.lng}">${el != null ? `<ele>${el}</ele>` : ''}</trkpt>`;
            }).join('\n');
            content = `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="CopiaColect">\n${wpts}\n  <trk>\n    <name>${escXml(activeProject)}</name>\n    <trkseg>\n${trkpts}\n    </trkseg>\n  </trk>\n</gpx>`;
            mime = 'application/gpx+xml'; ext = 'gpx';
        } else if (fmt === 'kml') {
            const pms = state.points.map((p, i) => {
                const name = p.label || `Ponto ${i+1}`;
                const el = elevationData[i];
                return `    <Placemark>\n      <name>${escXml(name)}</name>\n      <Point><coordinates>${p.lng},${p.lat}${el != null ? `,${el}` : ''}</coordinates></Point>\n    </Placemark>`;
            }).join('\n');
            const coords = state.points.map((p) => `${p.lng},${p.lat},0`).join(' ');
            content = `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2">\n  <Document>\n    <name>${escXml(activeProject)}</name>\n${pms}\n    <Placemark>\n      <name>Trajeto</name>\n      <LineString><coordinates>${coords}</coordinates></LineString>\n    </Placemark>\n  </Document>\n</kml>`;
            mime = 'application/vnd.google-earth.kml+xml'; ext = 'kml';
        }

        downloadFile(content, `${prefix}.${ext}`, mime);
        exportOverlay.classList.add('hidden');
    });
});

function escXml(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function downloadFile(content, name, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
}

// ============================================================
// IMPORTAR
// ============================================================
function importFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const text = e.target.result;
        const ext = file.name.split('.').pop().toLowerCase();
        try {
            if (ext === 'json') {
                const data = JSON.parse(text);
                if (!Array.isArray(data)) throw new Error('Invalid');
                data.forEach((p) => {
                    if (typeof p.lat === 'number' && typeof p.lng === 'number') {
                        state.points.push({ lat: p.lat, lng: p.lng, label: p.label||'', category: p.category||'', color: p.color||'#4ec9b0', photo: p.photo||'', timestamp: p.timestamp || new Date().toISOString() });
                    }
                });
            } else if (ext === 'gpx') {
                const parser = new DOMParser(), doc = parser.parseFromString(text, 'text/xml');
                doc.querySelectorAll('wpt, trkpt, rtept').forEach((el) => {
                    const lat = parseFloat(el.getAttribute('lat')), lng = parseFloat(el.getAttribute('lon'));
                    const name = el.querySelector('name')?.textContent || '';
                    if (!isNaN(lat) && !isNaN(lng)) {
                        state.points.push({ lat, lng, label: name, category: '', color: '#4ec9b0', photo: '', timestamp: new Date().toISOString() });
                    }
                });
            } else if (ext === 'kml') {
                const parser = new DOMParser(), doc = parser.parseFromString(text, 'text/xml');
                doc.querySelectorAll('Placemark').forEach((pm) => {
                    const coords = pm.querySelector('Point coordinates')?.textContent?.trim();
                    if (coords) {
                        const [lng, lat] = coords.split(',').map(Number);
                        const name = pm.querySelector('name')?.textContent || '';
                        if (!isNaN(lat) && !isNaN(lng)) {
                            state.points.push({ lat, lng, label: name, category: '', color: '#4ec9b0', photo: '', timestamp: new Date().toISOString() });
                        }
                    }
                });
            }
            savePoints(); renderAll(); fitBounds();
            alert('Importacao concluida!');
        } catch { alert('Erro ao importar arquivo.'); }
    };
    reader.readAsText(file);
}

// ============================================================
// COMPARTILHAR
// ============================================================
btnShare.addEventListener('click', () => {
    if (state.points.length === 0) { alert('Adicione pontos primeiro.'); return; }
    // Encode points as compact hash
    const data = state.points.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}${p.label ? `,${p.label}` : ''}`).join(';');
    const encoded = btoa(new TextEncoder().encode(data).reduce((s, b) => s + String.fromCharCode(b), ''));
    const url = `${location.origin}${location.pathname}#share=${encoded}`;

    if (navigator.share) {
        navigator.share({ title: `Copia Colect - ${activeProject}`, url }).catch(() => {});
    } else if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(() => alert('Link copiado!')).catch(() => alert('Nao foi possivel copiar.'));
    } else {
        prompt('Copie o link:', url);
    }
});

// Load shared data from URL hash
function loadFromHash() {
    const hash = location.hash;
    if (!hash.startsWith('#share=')) return;
    try {
        const decoded = new TextDecoder().decode(Uint8Array.from(atob(hash.slice(7)), (c) => c.charCodeAt(0)));
        const entries = decoded.split(';');
        entries.forEach((entry) => {
            const parts = entry.split(',');
            const lat = parseFloat(parts[0]), lng = parseFloat(parts[1]);
            const label = parts.slice(2).join(',') || '';
            if (!isNaN(lat) && !isNaN(lng)) {
                state.points.push({ lat, lng, label, category: '', color: '#4ec9b0', photo: '', timestamp: new Date().toISOString() });
            }
        });
        savePoints(); renderAll(); fitBounds();
        location.hash = '';
    } catch {}
}

// ============================================================
// EVENT LISTENERS
// ============================================================
btnLocate.addEventListener('click', getLocation);
btnAdd.addEventListener('click', () => {
    if (state.currentLat !== null && state.currentLng !== null) addPointWithLabel(state.currentLat, state.currentLng);
    else alert('Primeiro obtenha sua localizacao ou clique no mapa.');
});
btnTrack.addEventListener('click', toggleTracking);
btnClear.addEventListener('click', clearPoints);
btnImport.addEventListener('click', () => fileImport.click());
fileImport.addEventListener('change', (e) => { if (e.target.files[0]) { importFile(e.target.files[0]); e.target.value = ''; } });

// ============================================================
// INICIALIZACAO
// ============================================================
loadFromHash();
renderAll();
fitBounds();
