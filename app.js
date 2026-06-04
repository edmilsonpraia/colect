// ============================================================
// COPIA COLECT - App principal
// ============================================================

// Service Worker (PWA)
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
}

// ============================================================
// PWA INSTALL PROMPT
// ============================================================
let deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;

    // Show install button in header
    const btnInstall = document.getElementById('btn-install');
    if (btnInstall) btnInstall.classList.remove('hidden');

    // Show install banner after 3 seconds (only once per session)
    if (!sessionStorage.getItem('cc-install-dismissed')) {
        setTimeout(() => {
            const banner = document.getElementById('install-banner');
            if (banner && deferredInstallPrompt) banner.classList.remove('hidden');
        }, 3000);
    }
});

window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    const btnInstall = document.getElementById('btn-install');
    if (btnInstall) btnInstall.classList.add('hidden');
    const banner = document.getElementById('install-banner');
    if (banner) banner.classList.add('hidden');
});

// Install button click (header)
document.addEventListener('DOMContentLoaded', () => {
    const btnInstall = document.getElementById('btn-install');
    const banner = document.getElementById('install-banner');
    const bannerBtn = document.getElementById('install-banner-btn');
    const bannerClose = document.getElementById('install-banner-close');

    function triggerInstall() {
        if (!deferredInstallPrompt) return;
        deferredInstallPrompt.prompt();
        deferredInstallPrompt.userChoice.then(() => {
            deferredInstallPrompt = null;
            if (btnInstall) btnInstall.classList.add('hidden');
            if (banner) banner.classList.add('hidden');
        });
    }

    if (btnInstall) btnInstall.addEventListener('click', triggerInstall);
    if (bannerBtn) bannerBtn.addEventListener('click', triggerInstall);
    if (bannerClose) bannerClose.addEventListener('click', () => {
        if (banner) banner.classList.add('hidden');
        sessionStorage.setItem('cc-install-dismissed', '1');
    });

    // iOS: show visual install guide
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    const iosOverlay = document.getElementById('ios-install-overlay');
    const iosClose = document.getElementById('ios-install-close');

    function showIOSGuide() {
        if (iosOverlay) iosOverlay.classList.remove('hidden');
    }

    if (iosClose) iosClose.addEventListener('click', () => {
        if (iosOverlay) iosOverlay.classList.add('hidden');
    });
    if (iosOverlay) iosOverlay.addEventListener('click', (e) => {
        if (e.target === iosOverlay) iosOverlay.classList.add('hidden');
    });

    if (isIOS && !isStandalone) {
        // Show install button for iOS
        if (btnInstall) {
            btnInstall.classList.remove('hidden');
            btnInstall.addEventListener('click', showIOSGuide);
        }

        // Show iOS banner after 3s (once per session)
        if (!sessionStorage.getItem('cc-install-dismissed')) {
            setTimeout(() => {
                if (banner && !deferredInstallPrompt) {
                    // Reuse install banner but change button to show iOS guide
                    banner.classList.remove('hidden');
                    if (bannerBtn) {
                        bannerBtn.onclick = () => {
                            banner.classList.add('hidden');
                            showIOSGuide();
                        };
                    }
                }
            }, 3000);
        }
    }
});

// ============================================================
// AUTH BOOTSTRAP
// ============================================================
// Esconde o app ate a sessao Supabase ser resolvida.
(function () {
    function hideAppShowAuth() {
        const app = document.getElementById('app');
        const auth = document.getElementById('auth-screen');
        if (app) app.classList.add('hidden');
        if (auth) auth.classList.remove('hidden');
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', hideAppShowAuth);
    } else {
        hideAppShowAuth();
    }
})();

document.addEventListener('DOMContentLoaded', async () => {
    const appEl = document.getElementById('app');
    const authScreen = document.getElementById('auth-screen');
    const userPill = document.getElementById('user-pill');
    const userPillName = document.getElementById('user-pill-name');
    const btnLogout = document.getElementById('btn-logout');

    const tabSignin = document.querySelector('.auth-tab[data-tab="signin"]');
    const tabSignup = document.querySelector('.auth-tab[data-tab="signup"]');
    const formSignin = document.getElementById('auth-form-signin');
    const formSignup = document.getElementById('auth-form-signup');
    const loadingEl = document.getElementById('auth-loading');

    const btnSignin = document.getElementById('btn-signin');
    const btnSignup = document.getElementById('btn-signup');
    const btnForgot = document.getElementById('btn-forgot');
    const signinError = document.getElementById('signin-error');
    const signupError = document.getElementById('signup-error');
    const signupInfo = document.getElementById('signup-info');

    function showError(el, msg) {
        if (!el) return;
        el.textContent = msg || '';
        el.classList.toggle('visible', !!msg);
    }
    function showInfo(el, msg) {
        if (!el) return;
        el.textContent = msg || '';
        el.classList.toggle('visible', !!msg);
    }
    function setLoading(on) {
        loadingEl?.classList.toggle('hidden', !on);
        [btnSignin, btnSignup].forEach((b) => b && (b.disabled = on));
    }
    function switchTab(name) {
        tabSignin?.classList.toggle('active', name === 'signin');
        tabSignup?.classList.toggle('active', name === 'signup');
        formSignin?.classList.toggle('hidden', name !== 'signin');
        formSignup?.classList.toggle('hidden', name !== 'signup');
        showError(signinError, '');
        showError(signupError, '');
        showInfo(signupInfo, '');
    }
    tabSignin?.addEventListener('click', () => switchTab('signin'));
    tabSignup?.addEventListener('click', () => switchTab('signup'));

    formSignin?.addEventListener('submit', async (e) => {
        e.preventDefault();
        showError(signinError, '');
        const email = document.getElementById('signin-email').value;
        const password = document.getElementById('signin-password').value;
        setLoading(true);
        try {
            await window.cc.auth.signIn(email, password);
        } catch (err) {
            const msg = (err?.message || '').toLowerCase();
            if (msg.includes('invalid login')) showError(signinError, 'Email ou senha incorretos.');
            else if (msg.includes('not confirmed')) showError(signinError, 'Confirme seu email antes de entrar.');
            else showError(signinError, err.message || 'Falha no login');
        } finally {
            setLoading(false);
        }
    });

    formSignup?.addEventListener('submit', async (e) => {
        e.preventDefault();
        showError(signupError, '');
        showInfo(signupInfo, '');
        const name = document.getElementById('signup-name').value;
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        setLoading(true);
        try {
            const result = await window.cc.auth.signUp(email, password, name);
            if (!result.session) {
                showInfo(signupInfo, 'Conta criada. Verifique seu email para confirmar antes de entrar.');
                switchTab('signin');
            }
        } catch (err) {
            const msg = (err?.message || '').toLowerCase();
            if (msg.includes('already registered') || msg.includes('already been registered')) {
                showError(signupError, 'Este email ja esta cadastrado. Tente entrar.');
            } else {
                showError(signupError, err.message || 'Falha no cadastro');
            }
        } finally {
            setLoading(false);
        }
    });

    btnForgot?.addEventListener('click', async () => {
        const email = document.getElementById('signin-email').value;
        if (!email) {
            showError(signinError, 'Digite seu email primeiro para recuperar a senha.');
            return;
        }
        setLoading(true);
        try {
            await window.cc.auth.resetPassword(email);
            alert('Se o email existir, voce recebera instrucoes para redefinir sua senha.');
        } catch (err) {
            showError(signinError, err.message || 'Falha ao enviar email');
        } finally {
            setLoading(false);
        }
    });

    btnLogout?.addEventListener('click', async () => {
        if (!confirm('Sair da sua conta?')) return;
        try {
            await window.cc.auth.signOut();
        } catch (err) {
            alert('Falha ao sair: ' + (err.message || err));
        }
    });

    function applyAuthState(session) {
        if (session) {
            authScreen?.classList.add('hidden');
            appEl?.classList.remove('hidden');
            userPill?.classList.remove('hidden');
            const u = session.user;
            const name = u.user_metadata?.display_name || u.email || 'Usuario';
            if (userPillName) userPillName.textContent = name;
            // Leaflet pode ter sido criado com container oculto
            setTimeout(() => {
                if (window.cc?.map?.invalidateSize) window.cc.map.invalidateSize();
            }, 100);
            window.dispatchEvent(new CustomEvent('cc:authed', { detail: { user: u } }));
        } else {
            appEl?.classList.add('hidden');
            authScreen?.classList.remove('hidden');
            userPill?.classList.add('hidden');
            switchTab('signin');
            formSignin?.reset();
            formSignup?.reset();
            window.dispatchEvent(new CustomEvent('cc:signedout'));
        }
    }

    if (!window.cc?.auth) {
        console.error('[cc] Supabase nao inicializou. Verifique conexao e a tag do SDK.');
        return;
    }
    const session = await window.cc.auth.init();
    window.cc.auth.onAuthChange(applyAuthState);
    applyAuthState(session);
});

// ============================================================
// ESTADO
// ============================================================
// state.projects e state.project sao carregados apos auth (cc:authed).
const state = {
    points: [],
    polygons: [],       // poligonos importados (shapefile, geojson, kml)
    project: null,      // { id, name, owner_id, ... }
    projects: [],       // [{ id, name, ... }]
    myRole: null,       // 'admin' | 'collaborator' | 'viewer'
    tracking: false,
    watchId: null,
    currentLat: null,
    currentLng: null,
    measureMode: false,
    measurePoints: [],
};

function currentProjectName() {
    return state.project?.name || 'projeto';
}

// ============================================================
// MAPA
// ============================================================
const map = L.map('map').setView([-12.5, 18.5], 6); // Angola
window.cc = window.cc || {};
window.cc.map = map;

const tileDark = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap', maxZoom: 19,
});
tileDark.addTo(map);

// Ordem importa: polygonsLayer adicionado primeiro fica embaixo
const polygonsLayer = L.layerGroup().addTo(map);
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
const polygonsListEl = $('polygons-list'), polygonsContainer = $('polygons-container');
const polygonsCount = $('polygons-count'), btnClearPolygons = $('btn-clear-polygons');

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
// PROJETOS UI (Supabase-backed)
// ============================================================
function renderProjectSelect() {
    projectSelect.innerHTML = '';
    if (!state.projects.length) {
        const opt = document.createElement('option');
        opt.value = ''; opt.textContent = '(sem projetos)';
        projectSelect.appendChild(opt);
        return;
    }
    state.projects.forEach((p) => {
        const opt = document.createElement('option');
        opt.value = p.id; opt.textContent = p.name;
        if (state.project && p.id === state.project.id) opt.selected = true;
        projectSelect.appendChild(opt);
    });
}

async function switchToProject(projectId, opts = {}) {
    const proj = state.projects.find((p) => p.id === projectId);
    if (!proj) return;
    state.project = proj;
    window.cc.store.setActiveProjectId(proj.id);
    elevationCache = {};
    elevationData = [];
    const [pts, polys, role] = await Promise.all([
        window.cc.store.listPoints(proj.id),
        window.cc.store.listPolygons(proj.id),
        window.cc.store.getMyRole(proj.id),
    ]);
    state.points = pts;
    state.polygons = polys;
    state.myRole = role;
    updateRoleUI();
    renderProjectSelect();
    renderAll();
    if (opts.fit !== false) fitBounds();
}

async function refreshProjectsList() {
    state.projects = await window.cc.store.listProjects();
    renderProjectSelect();
}

projectSelect.addEventListener('change', async () => {
    const id = projectSelect.value;
    if (!id) return;
    await switchToProject(id);
});

btnNewProject.addEventListener('click', async () => {
    const name = prompt('Nome do novo projeto:');
    if (!name || !name.trim()) return;
    const trimmed = name.trim();
    if (state.projects.some((p) => p.name.toLowerCase() === trimmed.toLowerCase())) {
        alert('Projeto ja existe.');
        return;
    }
    try {
        const proj = await window.cc.store.createProject(trimmed);
        state.projects.push(proj);
        await switchToProject(proj.id, { fit: false });
    } catch (err) {
        alert('Erro ao criar projeto: ' + (err.message || err));
    }
});

btnRenameProject.addEventListener('click', async () => {
    if (!state.project) return;
    if (state.myRole && state.myRole !== 'admin') {
        alert('Apenas administradores podem renomear o projeto.');
        return;
    }
    const newName = prompt('Novo nome:', state.project.name);
    if (!newName || !newName.trim() || newName.trim() === state.project.name) return;
    const trimmed = newName.trim();
    if (state.projects.some((p) => p.id !== state.project.id && p.name.toLowerCase() === trimmed.toLowerCase())) {
        alert('Ja existe outro projeto com esse nome.');
        return;
    }
    try {
        await window.cc.store.renameProject(state.project.id, trimmed);
        state.project.name = trimmed;
        const inList = state.projects.find((p) => p.id === state.project.id);
        if (inList) inList.name = trimmed;
        renderProjectSelect();
    } catch (err) {
        alert('Erro ao renomear: ' + (err.message || err));
    }
});

btnDeleteProject.addEventListener('click', async () => {
    if (!state.project) return;
    if (state.myRole && state.myRole !== 'admin') {
        alert('Apenas administradores podem excluir o projeto.');
        return;
    }
    if (state.projects.length <= 1) { alert('Deve haver pelo menos 1 projeto.'); return; }
    if (!confirm(`Excluir projeto "${state.project.name}" e todos os seus pontos?`)) return;
    try {
        const idToDelete = state.project.id;
        await window.cc.store.deleteProject(idToDelete);
        state.projects = state.projects.filter((p) => p.id !== idToDelete);
        const next = state.projects[0];
        if (next) await switchToProject(next.id);
        else { state.project = null; state.points = []; renderProjectSelect(); renderAll(); }
    } catch (err) {
        alert('Erro ao excluir: ' + (err.message || err));
    }
});

function updateRoleUI() {
    const isAdmin = state.myRole === 'admin';
    const canEdit = state.myRole === 'admin' || state.myRole === 'collaborator';
    // Botoes de admin
    btnRenameProject.style.display = isAdmin ? '' : 'none';
    btnDeleteProject.style.display = isAdmin ? '' : 'none';
    // Botoes de edicao (collaborator e acima)
    btnAdd.disabled = !canEdit;
    btnTrack.disabled = !canEdit;
    btnClear.disabled = !canEdit;
    btnImport.disabled = !canEdit;
}

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
// PONTOS CRUD (via store)
// ============================================================
async function addPoint(lat, lng, meta) {
    if (!state.project) { alert('Crie ou selecione um projeto primeiro.'); return; }
    if (state.myRole === 'viewer') { alert('Voce e visualizador neste projeto, nao pode adicionar pontos.'); return; }
    try {
        const newPoint = await window.cc.store.createPoint(state.project.id, {
            lat, lng,
            label: meta?.label || '',
            category: meta?.category || '',
            color: meta?.color || '#4ec9b0',
            photo: meta?.photo || '',
        }, state.points.length);
        state.points.push(newPoint);
        renderAll();
    } catch (err) {
        alert('Erro ao salvar ponto: ' + (err.message || err));
    }
}

function addPointWithLabel(lat, lng) {
    openLabelModal(lat, lng, (meta) => addPoint(lat, lng, meta));
}

async function editPoint(index) {
    const p = state.points[index];
    if (!p) return;
    openLabelModal(p.lat, p.lng, async (meta) => {
        try {
            await window.cc.store.updatePoint(p.id, state.project.id, meta);
            Object.assign(state.points[index], meta);
            renderAll();
        } catch (err) {
            alert('Erro ao atualizar ponto: ' + (err.message || err));
        }
    }, p);
}

async function removePoint(index) {
    const p = state.points[index];
    if (!p) return;
    state.points.splice(index, 1);
    renderAll();
    try {
        await window.cc.store.deletePoint(p.id, state.project.id);
    } catch (err) {
        alert('Erro ao remover ponto: ' + (err.message || err));
    }
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

function renderPolygonsMap() {
    polygonsLayer.clearLayers();
    state.polygons.forEach((p) => {
        if (!Array.isArray(p.vertices) || p.vertices.length < 2) return;
        const latlngs = p.vertices.map((v) => [v.lat, v.lng]);
        const fill = p.fill_color || p.color || '#569cd6';
        const isClosed = latlngs.length >= 3;
        const layer = isClosed
            ? L.polygon(latlngs, {
                color: p.color || '#569cd6', weight: 2,
                fillColor: fill, fillOpacity: p.fill_opacity ?? 0.2,
              })
            : L.polyline(latlngs, {
                color: p.color || '#569cd6', weight: 2,
              });
        layer.bindPopup(
            `<b>${p.name || 'Poligono'}</b><br>` +
            `<span style="color:#999;font-size:12px">${p.vertices.length} vertices</span>` +
            (p.source ? `<br><small style="color:#666">Fonte: ${p.source}</small>` : '')
        );
        polygonsLayer.addLayer(layer);
    });
}

function renderPolygonsList() {
    if (!state.polygons.length) {
        polygonsListEl.classList.add('hidden');
        polygonsCount.textContent = '0';
        return;
    }
    polygonsListEl.classList.remove('hidden');
    polygonsCount.textContent = state.polygons.length;
    polygonsContainer.innerHTML = '';
    state.polygons.forEach((p, i) => {
        const div = document.createElement('div');
        div.className = 'polygon-item';
        const vcount = Array.isArray(p.vertices) ? p.vertices.length : 0;
        div.innerHTML = `
            <span class="polygon-color-dot" style="background:${p.color || '#569cd6'}"></span>
            <span class="polygon-name" title="${p.name || ''}">${p.name || `Poligono ${i+1}`}</span>
            <span class="polygon-vcount">${vcount}v</span>
            <span class="polygon-source">${p.source || 'manual'}</span>
            <button class="btn-focus" onclick="focusPolygon(${i})" title="Focar"><i class="codicon codicon-eye"></i></button>
            <button class="btn-remove" onclick="removePolygon(${i})" title="Excluir"><i class="codicon codicon-close"></i></button>
        `;
        polygonsContainer.appendChild(div);
    });
}

function focusPolygon(index) {
    const p = state.polygons[index];
    if (!p || !p.vertices?.length) return;
    const bounds = L.latLngBounds(p.vertices.map((v) => [v.lat, v.lng]));
    map.fitBounds(bounds, { padding: [30, 30] });
}

async function removePolygon(index) {
    const p = state.polygons[index];
    if (!p) return;
    if (!confirm(`Excluir poligono "${p.name || 'sem nome'}"?`)) return;
    state.polygons.splice(index, 1);
    renderPolygonsMap();
    renderPolygonsList();
    try {
        await window.cc.store.deletePolygon(p.id, state.project.id);
    } catch (err) {
        alert('Erro ao excluir poligono: ' + (err.message || err));
    }
}

btnClearPolygons?.addEventListener('click', async () => {
    if (!state.polygons.length || !state.project) return;
    if (!confirm(`Apagar todos os ${state.polygons.length} poligonos do projeto?`)) return;
    state.polygons = [];
    renderPolygonsMap();
    renderPolygonsList();
    try {
        await window.cc.store.clearPolygons(state.project.id);
    } catch (err) {
        alert('Erro ao limpar poligonos: ' + (err.message || err));
    }
});

function renderAll() { renderMap(); renderPolygonsMap(); renderPointsList(); renderPolygonsList(); renderStats(); fetchElevation(); }

function focusPoint(index) { map.setView([state.points[index].lat, state.points[index].lng], 17); }

function fitBounds() {
    const coords = [];
    state.points.forEach((p) => coords.push([p.lat, p.lng]));
    state.polygons.forEach((poly) => {
        if (Array.isArray(poly.vertices)) {
            poly.vertices.forEach((v) => coords.push([v.lat, v.lng]));
        }
    });
    if (coords.length > 0) {
        map.fitBounds(L.latLngBounds(coords), { padding: [30, 30] });
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
async function clearPoints() {
    if (state.points.length === 0) return;
    if (!state.project) return;
    if (state.myRole === 'viewer') { alert('Voce e visualizador, nao pode limpar pontos.'); return; }
    if (!confirm('Limpar todos os pontos do projeto atual?')) return;
    state.points = []; renderAll();
    try {
        await window.cc.store.clearPoints(state.project.id);
    } catch (err) {
        alert('Erro ao limpar pontos: ' + (err.message || err));
    }
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
        const prefix = `copia-colect-${currentProjectName().replace(/\s+/g,'-')}-${new Date().toISOString().slice(0,10)}`;
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
            content = `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="CopiaColect">\n${wpts}\n  <trk>\n    <name>${escXml(currentProjectName())}</name>\n    <trkseg>\n${trkpts}\n    </trkseg>\n  </trk>\n</gpx>`;
            mime = 'application/gpx+xml'; ext = 'gpx';
        } else if (fmt === 'kml') {
            const pms = state.points.map((p, i) => {
                const name = p.label || `Ponto ${i+1}`;
                const el = elevationData[i];
                return `    <Placemark>\n      <name>${escXml(name)}</name>\n      <Point><coordinates>${p.lng},${p.lat}${el != null ? `,${el}` : ''}</coordinates></Point>\n    </Placemark>`;
            }).join('\n');
            const coords = state.points.map((p) => `${p.lng},${p.lat},0`).join(' ');
            content = `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2">\n  <Document>\n    <name>${escXml(currentProjectName())}</name>\n${pms}\n    <Placemark>\n      <name>Trajeto</name>\n      <LineString><coordinates>${coords}</coordinates></LineString>\n    </Placemark>\n  </Document>\n</kml>`;
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
function parseKmlCoordsString(s) {
    return s.trim().split(/\s+/).map((t) => {
        const [lng, lat] = t.split(',').map(Number);
        return { lat, lng };
    }).filter((v) => isFinite(v.lat) && isFinite(v.lng));
}

function extractFromGeoJSON(geojson) {
    const features = geojson?.type === 'FeatureCollection'
        ? (geojson.features || [])
        : (geojson?.type === 'Feature' ? [geojson] : []);
    const pts = [], polys = [];
    features.forEach((feat) => {
        const g = feat.geometry; if (!g) return;
        const props = feat.properties || {};
        const name = props.name || props.NAME || props.Name || props.label || props.LABEL || '';
        const pushPoly = (coords, baseName) => {
            const verts = (coords || []).map(([lng, lat]) => ({ lat, lng })).filter((v) => isFinite(v.lat) && isFinite(v.lng));
            if (verts.length >= 2) polys.push({ name: baseName || `Poligono ${polys.length + 1}`, vertices: verts });
        };
        switch (g.type) {
            case 'Point': {
                const [lng, lat] = g.coordinates;
                if (isFinite(lat) && isFinite(lng)) pts.push({ lat, lng, label: name });
                break;
            }
            case 'MultiPoint':
                (g.coordinates || []).forEach(([lng, lat]) => {
                    if (isFinite(lat) && isFinite(lng)) pts.push({ lat, lng, label: name });
                });
                break;
            case 'LineString':
                pushPoly(g.coordinates, name || `Linha ${polys.length + 1}`);
                break;
            case 'MultiLineString':
                (g.coordinates || []).forEach((line, i) => pushPoly(line, name ? `${name} ${i + 1}` : `Linha ${polys.length + 1}`));
                break;
            case 'Polygon':
                // primeiro anel = anel externo
                pushPoly((g.coordinates || [])[0], name || `Poligono ${polys.length + 1}`);
                break;
            case 'MultiPolygon':
                (g.coordinates || []).forEach((poly, i) => pushPoly(poly[0], name ? `${name} ${i + 1}` : `Poligono ${polys.length + 1}`));
                break;
            default:
                console.warn('GeoJSON tipo nao suportado:', g.type);
        }
    });
    return { pts, polys };
}

function extractFromKML(text) {
    const doc = new DOMParser().parseFromString(text, 'text/xml');
    const pts = [], polys = [];
    doc.querySelectorAll('Placemark').forEach((pm) => {
        const name = pm.querySelector(':scope > name')?.textContent?.trim() || '';
        // Point
        const ptCoords = pm.querySelector('Point coordinates')?.textContent;
        if (ptCoords) {
            const v = parseKmlCoordsString(ptCoords)[0];
            if (v) pts.push({ lat: v.lat, lng: v.lng, label: name });
        }
        // LineString
        const lnCoords = pm.querySelector('LineString coordinates')?.textContent;
        if (lnCoords) {
            const verts = parseKmlCoordsString(lnCoords);
            if (verts.length >= 2) polys.push({ name: name || `Linha ${polys.length + 1}`, vertices: verts });
        }
        // Polygon (anel externo)
        const polyCoords = pm.querySelector('Polygon outerBoundaryIs LinearRing coordinates')?.textContent;
        if (polyCoords) {
            const verts = parseKmlCoordsString(polyCoords);
            if (verts.length >= 3) polys.push({ name: name || `Poligono ${polys.length + 1}`, vertices: verts });
        }
        // MultiGeometry > Polygon
        pm.querySelectorAll('MultiGeometry Polygon outerBoundaryIs LinearRing coordinates').forEach((el, i) => {
            const verts = parseKmlCoordsString(el.textContent || '');
            if (verts.length >= 3) polys.push({ name: name ? `${name} ${i + 1}` : `Poligono ${polys.length + 1}`, vertices: verts });
        });
    });
    return { pts, polys };
}

async function importFile(file) {
    if (!state.project) { alert('Selecione um projeto primeiro.'); return; }
    if (state.myRole === 'viewer') { alert('Voce e visualizador, nao pode importar.'); return; }
    const ext = file.name.split('.').pop().toLowerCase();
    let pts = [], polys = [], sourceLbl = ext;

    try {
        if (ext === 'zip') {
            // Shapefile compactado
            if (typeof window.shp !== 'function') {
                alert('Biblioteca shpjs nao carregou. Verifique conexao.');
                return;
            }
            const buf = await file.arrayBuffer();
            const geojson = await window.shp(buf);
            // shpjs pode retornar array (multiplos shp dentro do zip)
            const layers = Array.isArray(geojson) ? geojson : [geojson];
            layers.forEach((layer) => {
                const r = extractFromGeoJSON(layer);
                pts.push(...r.pts); polys.push(...r.polys);
            });
            sourceLbl = 'shapefile';
        } else if (ext === 'geojson' || ext === 'json') {
            const text = await file.text();
            const data = JSON.parse(text);
            if (data?.type === 'FeatureCollection' || data?.type === 'Feature') {
                const r = extractFromGeoJSON(data);
                pts = r.pts; polys = r.polys;
                sourceLbl = 'geojson';
            } else if (Array.isArray(data)) {
                // formato legado: array de pontos
                data.forEach((p) => {
                    if (typeof p.lat === 'number' && typeof p.lng === 'number') {
                        pts.push({ lat: p.lat, lng: p.lng, label: p.label || '', category: p.category || '', color: p.color || '#4ec9b0', photo: p.photo || '' });
                    }
                });
                sourceLbl = 'json';
            } else {
                alert('JSON nao reconhecido. Esperado FeatureCollection (GeoJSON) ou array de pontos.');
                return;
            }
        } else if (ext === 'kml') {
            const text = await file.text();
            const r = extractFromKML(text);
            pts = r.pts; polys = r.polys;
            sourceLbl = 'kml';
        } else if (ext === 'kmz') {
            alert('KMZ ainda nao suportado neste MVP. Descompacte e importe o .kml interno.');
            return;
        } else if (ext === 'gpx') {
            const text = await file.text();
            const doc = new DOMParser().parseFromString(text, 'text/xml');
            doc.querySelectorAll('wpt, trkpt, rtept').forEach((el) => {
                const lat = parseFloat(el.getAttribute('lat')), lng = parseFloat(el.getAttribute('lon'));
                const name = el.querySelector('name')?.textContent || '';
                if (!isNaN(lat) && !isNaN(lng)) pts.push({ lat, lng, label: name });
            });
            // GPX trk como linha
            doc.querySelectorAll('trk').forEach((trk, ti) => {
                const tname = trk.querySelector(':scope > name')?.textContent || `Trajeto ${ti + 1}`;
                const verts = [];
                trk.querySelectorAll('trkpt').forEach((p) => {
                    const lat = parseFloat(p.getAttribute('lat'));
                    const lng = parseFloat(p.getAttribute('lon'));
                    if (isFinite(lat) && isFinite(lng)) verts.push({ lat, lng });
                });
                if (verts.length >= 2) polys.push({ name: tname, vertices: verts });
            });
            sourceLbl = 'gpx';
        } else {
            alert('Formato nao suportado. Use: .zip (shapefile), .geojson, .json, .kml, .gpx');
            return;
        }

        if (!pts.length && !polys.length) { alert('Nenhum dado valido encontrado no arquivo.'); return; }

        polys.forEach((p) => { p.source = sourceLbl; });
        const createdPts = pts.length
            ? await window.cc.store.bulkCreatePoints(state.project.id, pts, state.points.length)
            : [];
        const createdPolys = polys.length
            ? await window.cc.store.bulkCreatePolygons(state.project.id, polys)
            : [];
        state.points.push(...createdPts);
        state.polygons.push(...createdPolys);
        renderAll(); fitBounds();
        alert(`Importacao: ${createdPts.length} pontos, ${createdPolys.length} poligonos.`);
    } catch (err) {
        console.error('Erro import:', err);
        alert('Erro ao importar: ' + (err.message || err));
    }
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
        navigator.share({ title: `Copia Colect - ${currentProjectName()}`, url }).catch(() => {});
    } else if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(() => alert('Link copiado!')).catch(() => alert('Nao foi possivel copiar.'));
    } else {
        prompt('Copie o link:', url);
    }
});

// Load shared data from URL hash
async function loadFromHash() {
    const hash = location.hash;
    if (!hash.startsWith('#share=')) return;
    if (!state.project) return;
    if (state.myRole === 'viewer') return;
    try {
        const decoded = new TextDecoder().decode(Uint8Array.from(atob(hash.slice(7)), (c) => c.charCodeAt(0)));
        const entries = decoded.split(';');
        const incoming = [];
        entries.forEach((entry) => {
            const parts = entry.split(',');
            const lat = parseFloat(parts[0]), lng = parseFloat(parts[1]);
            const label = parts.slice(2).join(',') || '';
            if (!isNaN(lat) && !isNaN(lng)) incoming.push({ lat, lng, label });
        });
        if (!incoming.length) { location.hash = ''; return; }
        const created = await window.cc.store.bulkCreatePoints(state.project.id, incoming, state.points.length);
        state.points.push(...created);
        renderAll(); fitBounds();
        location.hash = '';
    } catch (e) { console.warn('loadFromHash failed', e); }
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
// ONLINE / OFFLINE + SYNC INDICATOR + TOASTS
// ============================================================
const syncIndicator = $('sync-indicator');
const syncCount = $('sync-count');
const offlineBanner = $('offline-banner');
const toastContainer = $('toast-container');

function showToast(message, kind = 'info', duration = 3000) {
    if (!toastContainer) return;
    const icon = kind === 'success' ? 'codicon-check'
              : kind === 'error'   ? 'codicon-error'
              : 'codicon-info';
    const div = document.createElement('div');
    div.className = `toast toast-${kind}`;
    div.innerHTML = `<i class="codicon ${icon}"></i><span>${message}</span>`;
    toastContainer.appendChild(div);
    setTimeout(() => {
        div.classList.add('fade-out');
        setTimeout(() => div.remove(), 220);
    }, duration);
}

function updateOnlineStatus() {
    const online = navigator.onLine;
    if (online) {
        offlineBanner?.classList.add('hidden');
        document.body.classList.remove('has-offline-banner');
    } else {
        offlineBanner?.classList.remove('hidden');
        document.body.classList.add('has-offline-banner');
        if (window.cc?.map?.invalidateSize) {
            setTimeout(() => window.cc.map.invalidateSize(), 50);
        }
    }
}

function updateSyncIndicator() {
    const n = window.cc.store.pendingCount();
    if (n > 0) {
        syncIndicator?.classList.remove('hidden');
        if (syncCount) syncCount.textContent = String(n);
    } else {
        syncIndicator?.classList.add('hidden');
    }
}

async function manualSync() {
    if (!navigator.onLine) {
        showToast('Voce esta offline. Conecte-se primeiro.', 'error');
        return;
    }
    if (window.cc.store.pendingCount() === 0) {
        showToast('Tudo sincronizado.', 'success', 2000);
        return;
    }
    syncIndicator.disabled = true;
    try {
        await window.cc.store.syncPending();
    } finally {
        syncIndicator.disabled = false;
    }
}

syncIndicator?.addEventListener('click', manualSync);

window.cc.store.onChange((e) => {
    if (e.type === 'pending') {
        updateSyncIndicator();
        if (!navigator.onLine) {
            // Toast discreto so quando ja estamos offline
            // (evita spam quando ainda online e a chamada falhou por outro motivo)
        }
    }
    if (e.type === 'sync-start') {
        syncIndicator?.classList.add('syncing');
    }
    if (e.type === 'sync-end') {
        syncIndicator?.classList.remove('syncing');
        updateSyncIndicator();
        const { synced = 0, failed = 0, remaining = 0 } = e.detail || {};
        if (synced > 0 && failed === 0 && remaining === 0) {
            showToast(`${synced} ${synced === 1 ? 'alteracao sincronizada' : 'alteracoes sincronizadas'}.`, 'success');
        } else if (failed > 0) {
            showToast(`${failed} ${failed === 1 ? 'alteracao falhou' : 'alteracoes falharam'} apos varias tentativas.`, 'error', 5000);
        } else if (synced > 0 && remaining > 0) {
            showToast(`${synced} sincronizadas, ${remaining} pendentes.`, 'info');
        }
        // Recarrega projeto atual apos sync para refletir IDs reais
        if (synced > 0 && state.project) {
            window.cc.store.listPoints(state.project.id).then((pts) => {
                state.points = pts;
                renderAll();
            }).catch(() => {});
        }
    }
});

window.addEventListener('online', () => {
    updateOnlineStatus();
    showToast('Conectado novamente', 'success', 2000);
    window.cc.store.syncPending().catch(() => {});
});

window.addEventListener('offline', () => {
    updateOnlineStatus();
    showToast('Sem conexao - trabalhando offline', 'info', 2500);
});

// Estado inicial
updateOnlineStatus();

// ============================================================
// DASHBOARD (membros + estatisticas + convites)
// ============================================================
const dashboardOverlay = $('dashboard-overlay');
const btnDashboard = $('btn-dashboard');
const btnDashboardClose = $('dashboard-close');
const dashProjectName = $('dashboard-project-name');
const dashMyRole = $('dashboard-my-role');
const dashTotalPoints = $('dash-total-points');
const dashContributors = $('dash-contributors');
const dashMembersCount = $('dash-members-count');
const dashLastPoint = $('dash-last-point');
const dashMembersList = $('dashboard-members-list');
const dashInviteSection = $('dashboard-invite-section');
const inviteForm = $('invite-form');
const inviteEmail = $('invite-email');
const inviteRole = $('invite-role');
const inviteFeedback = $('invite-feedback');

const ROLE_LABEL = { admin: 'Administrador', collaborator: 'Colaborador', viewer: 'Visualizador' };

function roleBadge(role) {
    return `<span class="role-badge role-${role}">${ROLE_LABEL[role] || role}</span>`;
}

function formatRelative(iso) {
    if (!iso) return 'Nunca';
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'Agora';
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} h`;
    const dd = Math.floor(h / 24);
    if (dd < 30) return `${dd} d`;
    return d.toLocaleDateString('pt-BR');
}

// ===== TABS =====
const dashboardModal = dashboardOverlay?.querySelector('.dashboard-modal');
const dashboardTabs = dashboardOverlay?.querySelectorAll('.dashboard-tab') || [];
const dashboardPanels = dashboardOverlay?.querySelectorAll('.dashboard-tab-panel') || [];

function switchDashboardTab(name) {
    dashboardTabs.forEach((t) => t.classList.toggle('active', t.dataset.dashTab === name));
    dashboardPanels.forEach((p) => p.classList.toggle('active', p.dataset.dashPanel === name));
    if (name === 'gallery') loadGallery();
    if (name === 'activity') loadActivity();
}
dashboardTabs.forEach((tab) => {
    tab.addEventListener('click', () => switchDashboardTab(tab.dataset.dashTab));
});

// ===== GALERIA =====
const galleryGrid = $('gallery-grid');
const galleryCount = $('gallery-count');
let galleryCache = [];

async function loadGallery() {
    if (!state.project) return;
    galleryGrid.innerHTML = '<div class="gallery-empty">Carregando...</div>';
    galleryCount.textContent = '...';
    try {
        const photos = await window.cc.store.listProjectPhotos(state.project.id);
        galleryCache = photos;
        galleryCount.textContent = String(photos.length);
        if (!photos.length) {
            galleryGrid.innerHTML = '<div class="gallery-empty">Nenhuma foto ainda neste projeto.</div>';
            return;
        }
        galleryGrid.innerHTML = '';
        photos.forEach((p, i) => {
            const item = document.createElement('div');
            item.className = 'gallery-item';
            item.dataset.idx = i;
            const author = p.author?.display_name || p.author?.email || 'Desconhecido';
            const when = formatRelative(p.created_at);
            item.innerHTML = `
                <img src="${p.photo}" alt="${p.label || 'foto'}" loading="lazy" />
                <div class="gallery-item-overlay">
                    <div class="gallery-item-author">${author}</div>
                    <div class="gallery-item-date">${when}</div>
                </div>
            `;
            item.addEventListener('click', () => openLightbox(i));
            galleryGrid.appendChild(item);
        });
    } catch (err) {
        galleryGrid.innerHTML = `<div class="gallery-empty">Erro: ${err.message || err}</div>`;
    }
}

// ===== LIGHTBOX =====
const photoLightbox = $('photo-lightbox');
const lightboxImg = $('lightbox-img');
const lightboxMeta = $('lightbox-meta');
const lightboxClose = $('lightbox-close');

function openLightbox(idx) {
    const p = galleryCache[idx];
    if (!p) return;
    lightboxImg.src = p.photo;
    const author = p.author?.display_name || p.author?.email || 'Desconhecido';
    const when = new Date(p.created_at).toLocaleString('pt-BR');
    lightboxMeta.innerHTML = `
        ${p.label ? `<div class="meta-row"><b>${p.label}</b></div>` : ''}
        <div class="meta-row">Por <b>${author}</b></div>
        <div class="meta-row">${when}</div>
        <div class="meta-row">${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}</div>
    `;
    photoLightbox.classList.remove('hidden');
}
function closeLightbox() {
    photoLightbox.classList.add('hidden');
    lightboxImg.src = '';
}
lightboxClose?.addEventListener('click', closeLightbox);
photoLightbox?.addEventListener('click', (e) => {
    if (e.target === photoLightbox) closeLightbox();
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !photoLightbox.classList.contains('hidden')) closeLightbox();
});

// ===== TIMELINE DE ATIVIDADES =====
const activityList = $('activity-list');
const activityFilterType = $('activity-filter-type');
let activityCache = [];

const ACTION_META = {
    'point.create':       { icon: 'codicon-add', kind: 'create' },
    'point.update':       { icon: 'codicon-edit', kind: 'update' },
    'point.delete':       { icon: 'codicon-trash', kind: 'delete' },
    'polygon.create':     { icon: 'codicon-symbol-misc', kind: 'create' },
    'polygon.update':     { icon: 'codicon-edit', kind: 'update' },
    'polygon.delete':     { icon: 'codicon-trash', kind: 'delete' },
    'member.added':       { icon: 'codicon-person-add', kind: 'member' },
    'member.removed':     { icon: 'codicon-close', kind: 'delete' },
    'member.role_changed':{ icon: 'codicon-shield', kind: 'member' },
    'project.created':    { icon: 'codicon-folder', kind: 'project' },
    'project.renamed':    { icon: 'codicon-edit', kind: 'project' },
};

function describeActivity(log) {
    const actor = log.actor?.display_name || log.actor?.email || 'Alguem';
    const meta = log.metadata || {};
    const affected = log.affected_member?.display_name || log.affected_member?.email || 'um membro';
    const roleLbl = (r) => ROLE_LABEL[r] || r;
    switch (log.action) {
        case 'point.create':
            return `<b>${actor}</b> adicionou ponto ${meta.label ? `<em>${meta.label}</em>` : ''}${meta.has_photo ? ' com foto' : ''}`;
        case 'point.update':
            return `<b>${actor}</b> editou ponto ${meta.label ? `<em>${meta.label}</em>` : ''}`;
        case 'point.delete':
            return `<b>${actor}</b> removeu ponto ${meta.label ? `<em>${meta.label}</em>` : ''}`;
        case 'polygon.create':
            return `<b>${actor}</b> importou poligono <em>${meta.name || ''}</em> (${meta.vertices_count || 0} vertices${meta.source ? `, ${meta.source}` : ''})`;
        case 'polygon.update':
            return `<b>${actor}</b> editou poligono <em>${meta.name || ''}</em>`;
        case 'polygon.delete':
            return `<b>${actor}</b> removeu poligono <em>${meta.name || ''}</em>`;
        case 'member.added':
            return `<b>${actor}</b> adicionou <b>${affected}</b> como <em>${roleLbl(meta.role)}</em>`;
        case 'member.removed':
            return `<b>${actor}</b> removeu <b>${affected}</b>`;
        case 'member.role_changed':
            return `<b>${actor}</b> mudou papel de <b>${affected}</b> de <em>${roleLbl(meta.old_role)}</em> para <em>${roleLbl(meta.new_role)}</em>`;
        case 'project.created':
            return `<b>${actor}</b> criou o projeto <em>${meta.name || ''}</em>`;
        case 'project.renamed':
            return `<b>${actor}</b> renomeou de <em>${meta.old_name || ''}</em> para <em>${meta.new_name || ''}</em>`;
        default:
            return `<b>${actor}</b> ${log.action}`;
    }
}

function renderActivityList() {
    const filter = activityFilterType?.value || '';
    const filtered = filter
        ? activityCache.filter((l) => l.action.startsWith(filter + '.'))
        : activityCache;
    if (!filtered.length) {
        activityList.innerHTML = '<div class="activity-empty">Nenhuma atividade encontrada.</div>';
        return;
    }
    activityList.innerHTML = '';
    filtered.forEach((log) => {
        const m = ACTION_META[log.action] || { icon: 'codicon-circle-small', kind: 'update' };
        const clickable = log.entity_type === 'point' && log.action === 'point.create';
        const div = document.createElement('div');
        div.className = `activity-item${clickable ? ' clickable' : ''}`;
        div.innerHTML = `
            <div class="activity-icon act-${m.kind}"><i class="codicon ${m.icon}"></i></div>
            <div class="activity-body">
                <div class="activity-text">${describeActivity(log)}</div>
                <div class="activity-time" title="${new Date(log.created_at).toLocaleString('pt-BR')}">${formatRelative(log.created_at)}</div>
            </div>
        `;
        if (clickable && log.metadata?.lat && log.metadata?.lng) {
            div.addEventListener('click', () => {
                closeDashboard();
                map.setView([log.metadata.lat, log.metadata.lng], 17);
            });
        }
        activityList.appendChild(div);
    });
}

activityFilterType?.addEventListener('change', renderActivityList);

async function loadActivity() {
    if (!state.project) return;
    activityList.innerHTML = '<div class="activity-empty">Carregando...</div>';
    try {
        activityCache = await window.cc.store.getActivities(state.project.id, 200);
        renderActivityList();
    } catch (err) {
        activityList.innerHTML = `<div class="activity-empty">Erro: ${err.message || err}</div>`;
    }
}

async function openDashboard() {
    if (!state.project) { alert('Selecione um projeto primeiro.'); return; }
    dashProjectName.textContent = state.project.name;
    dashMyRole.outerHTML = `<span id="dashboard-my-role" class="role-badge role-${state.myRole || 'viewer'}">${ROLE_LABEL[state.myRole] || '...'}</span>`;
    dashTotalPoints.textContent = '--';
    dashContributors.textContent = '--';
    dashMembersCount.textContent = '--';
    dashLastPoint.textContent = '--';
    dashMembersList.innerHTML = '<div class="members-empty">Carregando...</div>';
    inviteFeedback.textContent = '';
    inviteFeedback.className = 'invite-feedback';

    const isAdmin = state.myRole === 'admin';
    dashboardModal?.classList.toggle('is-admin', isAdmin);
    dashInviteSection.classList.toggle('hidden', !isAdmin);
    switchDashboardTab('overview');
    dashboardOverlay.classList.remove('hidden');

    try {
        const [stats, members] = await Promise.all([
            window.cc.store.getDashboard(state.project.id),
            window.cc.store.listMembers(state.project.id),
        ]);
        if (stats) {
            dashTotalPoints.textContent = stats.total_points ?? 0;
            dashContributors.textContent = stats.contributors_count ?? 0;
            dashMembersCount.textContent = stats.members_count ?? 0;
            dashLastPoint.textContent = formatRelative(stats.last_point_at);
        }
        renderMembers(members);
    } catch (err) {
        dashMembersList.innerHTML = `<div class="members-empty">Erro: ${err.message || err}</div>`;
    }
}

function closeDashboard() {
    dashboardOverlay.classList.add('hidden');
    closeLightbox();
}

function renderMembers(members) {
    if (!members.length) {
        dashMembersList.innerHTML = '<div class="members-empty">Nenhum membro.</div>';
        return;
    }
    const myUserId = window.cc.auth.getUser()?.id;
    const isAdmin = state.myRole === 'admin';
    dashMembersList.innerHTML = '';
    members.forEach((m) => {
        const div = document.createElement('div');
        div.className = 'member-item';
        const name = m.profile.display_name || m.profile.email || '?';
        const email = m.profile.email || '';
        const isMe = m.user_id === myUserId;
        let actions = '';
        if (isAdmin && !isMe) {
            actions = `
                <select class="member-role-select" data-user-id="${m.user_id}">
                    <option value="admin"${m.role === 'admin' ? ' selected' : ''}>Admin</option>
                    <option value="collaborator"${m.role === 'collaborator' ? ' selected' : ''}>Colaborador</option>
                    <option value="viewer"${m.role === 'viewer' ? ' selected' : ''}>Visualizador</option>
                </select>
                <button class="btn-remove-member" data-user-id="${m.user_id}" title="Remover do projeto"><i class="codicon codicon-trash"></i></button>
            `;
        } else {
            actions = roleBadge(m.role);
            if (isMe) actions += ' <span style="color:var(--text-dim);font-size:11px">(voce)</span>';
        }
        div.innerHTML = `
            <i class="codicon codicon-account" style="color:var(--text-dim);font-size:18px"></i>
            <div class="member-info">
                <div class="member-name">${name}${isMe ? '' : ''}</div>
                <div class="member-email">${email}</div>
            </div>
            <div class="member-actions">${actions}</div>
        `;
        dashMembersList.appendChild(div);
    });

    dashMembersList.querySelectorAll('.member-role-select').forEach((sel) => {
        sel.addEventListener('change', async () => {
            const userId = sel.dataset.userId;
            const newRole = sel.value;
            try {
                await window.cc.store.updateMemberRole(state.project.id, userId, newRole);
            } catch (err) {
                alert('Erro: ' + (err.message || err));
                openDashboard();
            }
        });
    });
    dashMembersList.querySelectorAll('.btn-remove-member').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const userId = btn.dataset.userId;
            if (!confirm('Remover este membro do projeto?')) return;
            try {
                await window.cc.store.removeMember(state.project.id, userId);
                openDashboard();
            } catch (err) {
                alert('Erro: ' + (err.message || err));
            }
        });
    });
}

btnDashboard?.addEventListener('click', openDashboard);
btnDashboardClose?.addEventListener('click', closeDashboard);
dashboardOverlay?.addEventListener('click', (e) => {
    if (e.target === dashboardOverlay) closeDashboard();
});

inviteForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    inviteFeedback.textContent = '';
    inviteFeedback.className = 'invite-feedback';
    const email = inviteEmail.value.trim();
    const role = inviteRole.value;
    if (!email) return;
    try {
        await window.cc.store.inviteMember(state.project.id, email, role);
        inviteFeedback.textContent = `Convite enviado para ${email} como ${ROLE_LABEL[role]}.`;
        inviteFeedback.classList.add('success');
        inviteEmail.value = '';
        // Recarrega lista
        const members = await window.cc.store.listMembers(state.project.id);
        renderMembers(members);
    } catch (err) {
        const msg = err.message || String(err);
        inviteFeedback.textContent = msg.includes('nao encontrado')
            ? 'Esta pessoa ainda nao tem conta. Peca para se cadastrar primeiro.'
            : msg;
        inviteFeedback.classList.add('error');
    }
});

// ============================================================
// CAMERA MEASURE (medir tamanho real com foto + referencia)
// ============================================================
const cmOverlay = $('cmeasure-overlay');
const cmCloseBtn = $('cmeasure-close');
const btnCameraMeasure = $('btn-camera-measure');
const cmStepSource = $('cmeasure-step-source');
const cmStepMark = $('cmeasure-step-mark');
const cmTakeBtn = $('cmeasure-take');
const cmPhotoInput = $('cmeasure-photo-input');
const cmCanvas = $('cmeasure-canvas');
const cmRefType = $('cmeasure-ref-type');
const cmCustomLabel = document.querySelector('.cmeasure-custom');
const cmCustomMm = $('cmeasure-custom-mm');
const cmInstrText = $('cmeasure-instr-text');
const cmInstructions = $('cmeasure-instructions');
const cmResults = $('cmeasure-results');
const cmUndoBtn = $('cmeasure-undo');
const cmResetBtn = $('cmeasure-reset');
const cmNewPhotoBtn = $('cmeasure-new-photo');

const cmv = {
    w: $('cmv-w'), h: $('cmv-h'), d: $('cmv-d'),
    unit: $('cmv-unit'), result: $('cmv-result'),
    fromMeasure: $('cmv-from-measure'),
};

const cmState = {
    img: null,
    refPoints: [],       // [{x,y}, {x,y}] - 2 pontos da referencia
    measurePoints: [],   // pontos a medir
    mode: 'ref',         // 'ref' | 'measure'
    refMm: 210,          // valor real da referencia em mm
    lastMeasurementMm: null,
};

function cmRefLabel() {
    const opt = cmRefType.options[cmRefType.selectedIndex];
    return (opt?.textContent || '').split(' (')[0];
}

function cmRefMmFromUI() {
    if (cmRefType.value === 'custom') {
        const v = parseFloat(cmCustomMm.value);
        return isFinite(v) && v > 0 ? v : null;
    }
    return parseFloat(cmRefType.value);
}

function cmDist(p1, p2) {
    return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
}

function cmMmPerPx() {
    if (cmState.refPoints.length !== 2) return null;
    const px = cmDist(cmState.refPoints[0], cmState.refPoints[1]);
    if (px === 0) return null;
    return cmState.refMm / px;
}

function cmFormatLength(mm) {
    if (!isFinite(mm)) return '--';
    if (mm < 10) return mm.toFixed(1) + ' mm';
    if (mm < 1000) return (mm / 10).toFixed(2) + ' cm';
    return (mm / 1000).toFixed(3) + ' m';
}

function cmFormatArea(mm2) {
    if (!isFinite(mm2)) return '--';
    if (mm2 < 100) return mm2.toFixed(1) + ' mm²';
    if (mm2 < 1e6) return (mm2 / 100).toFixed(2) + ' cm²';
    if (mm2 < 1e10) return (mm2 / 1e6).toFixed(3) + ' m²';
    return (mm2 / 1e10).toFixed(3) + ' ha';
}

function cmPolygonAreaPx(pts) {
    if (pts.length < 3) return 0;
    let a = 0;
    for (let i = 0; i < pts.length; i++) {
        const j = (i + 1) % pts.length;
        a += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
    }
    return Math.abs(a / 2);
}

function cmUpdateInstructions() {
    if (cmState.mode === 'ref') {
        cmInstructions.classList.remove('ready');
        cmInstrText.textContent = `Toque nos 2 extremos da ${cmRefLabel()}. ${cmState.refPoints.length}/2`;
    } else {
        cmInstructions.classList.add('ready');
        const n = cmState.measurePoints.length;
        cmInstrText.textContent = n === 0
            ? 'Calibrado. Agora toque no 1o ponto a medir.'
            : n === 1
                ? 'Toque no 2o ponto (mais pontos = poligono).'
                : `Calibrado. ${n} pontos marcados.`;
    }
}

function cmResetAll() {
    cmState.refPoints = [];
    cmState.measurePoints = [];
    cmState.mode = 'ref';
    cmState.lastMeasurementMm = null;
    cmUpdateInstructions();
    cmRender();
    cmUpdateResults();
}

function loadImageFromFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

cmRefType.addEventListener('change', () => {
    cmCustomLabel.classList.toggle('hidden', cmRefType.value !== 'custom');
    const v = cmRefMmFromUI();
    if (v) cmState.refMm = v;
    cmUpdateInstructions();
    cmUpdateResults();
    cmRender();
});
cmCustomMm.addEventListener('input', () => {
    const v = cmRefMmFromUI();
    if (v) { cmState.refMm = v; cmUpdateResults(); cmRender(); }
});

cmTakeBtn.addEventListener('click', () => cmPhotoInput.click());
cmNewPhotoBtn.addEventListener('click', () => cmPhotoInput.click());

cmPhotoInput.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    try {
        const img = await loadImageFromFile(file);
        cmState.img = img;
        // Limita canvas a 2000px no maior lado para performance em mobile
        const maxSide = 2000;
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        cmCanvas.width = Math.round(img.width * scale);
        cmCanvas.height = Math.round(img.height * scale);
        cmResetAll();
        cmStepSource.classList.add('hidden');
        cmStepMark.classList.remove('hidden');
    } catch (err) {
        alert('Erro ao carregar foto: ' + (err.message || err));
    }
});

function cmCanvasCoords(evt) {
    const rect = cmCanvas.getBoundingClientRect();
    return {
        x: (evt.clientX - rect.left) * (cmCanvas.width / rect.width),
        y: (evt.clientY - rect.top) * (cmCanvas.height / rect.height),
    };
}

function cmHandleTap(evt) {
    if (!cmState.img) return;
    evt.preventDefault();
    const p = cmCanvasCoords(evt);
    if (cmState.mode === 'ref') {
        if (cmState.refPoints.length < 2) {
            cmState.refPoints.push(p);
            if (cmState.refPoints.length === 2) cmState.mode = 'measure';
        }
    } else {
        cmState.measurePoints.push(p);
    }
    cmUpdateInstructions();
    cmRender();
    cmUpdateResults();
}

// pointerdown cobre mouse + touch + caneta sem disparar duas vezes
cmCanvas.addEventListener('pointerdown', cmHandleTap);

cmUndoBtn.addEventListener('click', () => {
    if (cmState.measurePoints.length > 0) {
        cmState.measurePoints.pop();
    } else if (cmState.refPoints.length > 0) {
        cmState.refPoints.pop();
        cmState.mode = 'ref';
    }
    cmUpdateInstructions();
    cmRender();
    cmUpdateResults();
});

cmResetBtn.addEventListener('click', cmResetAll);

function cmRender() {
    const ctx = cmCanvas.getContext('2d');
    if (!cmState.img) { ctx.clearRect(0, 0, cmCanvas.width, cmCanvas.height); return; }
    ctx.drawImage(cmState.img, 0, 0, cmCanvas.width, cmCanvas.height);

    const dotR = Math.max(8, cmCanvas.width / 180);
    const lineW = Math.max(3, cmCanvas.width / 400);
    const fontSize = Math.max(20, cmCanvas.width / 45);

    // Referencia (vermelho)
    if (cmState.refPoints.length > 0) {
        ctx.strokeStyle = '#f44747';
        ctx.fillStyle = '#f44747';
        ctx.lineWidth = lineW;
        if (cmState.refPoints.length === 2) {
            ctx.beginPath();
            ctx.moveTo(cmState.refPoints[0].x, cmState.refPoints[0].y);
            ctx.lineTo(cmState.refPoints[1].x, cmState.refPoints[1].y);
            ctx.stroke();
            // Label da referencia
            const mid = {
                x: (cmState.refPoints[0].x + cmState.refPoints[1].x) / 2,
                y: (cmState.refPoints[0].y + cmState.refPoints[1].y) / 2,
            };
            const label = `REF ${cmFormatLength(cmState.refMm)}`;
            ctx.font = `bold ${fontSize}px Consolas`;
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = Math.max(4, lineW * 1.5);
            ctx.strokeText(label, mid.x + 12, mid.y + fontSize + 4);
            ctx.fillStyle = '#f44747';
            ctx.fillText(label, mid.x + 12, mid.y + fontSize + 4);
            ctx.lineWidth = lineW;
            ctx.strokeStyle = '#f44747';
        }
        cmState.refPoints.forEach((p) => {
            ctx.beginPath();
            ctx.fillStyle = '#fff';
            ctx.arc(p.x, p.y, dotR + 2, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#f44747';
            ctx.beginPath();
            ctx.arc(p.x, p.y, dotR, 0, Math.PI * 2); ctx.fill();
        });
    }

    // Medicoes (verde)
    if (cmState.measurePoints.length > 0 && cmState.refPoints.length === 2) {
        const mmPerPx = cmMmPerPx();
        ctx.strokeStyle = '#4ec9b0';
        ctx.fillStyle = '#4ec9b0';
        ctx.lineWidth = lineW;
        ctx.beginPath();
        cmState.measurePoints.forEach((p, i) => {
            if (i === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
        });
        ctx.stroke();
        cmState.measurePoints.forEach((p, i) => {
            ctx.beginPath();
            ctx.fillStyle = '#fff';
            ctx.arc(p.x, p.y, dotR + 2, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#4ec9b0';
            ctx.beginPath();
            ctx.arc(p.x, p.y, dotR, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.font = `bold ${fontSize * 0.7}px Consolas`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(String(i + 1), p.x, p.y);
            ctx.textAlign = 'left';
            ctx.textBaseline = 'alphabetic';
        });
        // Labels nos segmentos
        ctx.font = `bold ${fontSize}px Consolas`;
        for (let i = 1; i < cmState.measurePoints.length; i++) {
            const p1 = cmState.measurePoints[i - 1];
            const p2 = cmState.measurePoints[i];
            const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
            const label = cmFormatLength(cmDist(p1, p2) * mmPerPx);
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = Math.max(4, lineW * 1.5);
            ctx.strokeText(label, mid.x + 12, mid.y - 8);
            ctx.fillStyle = '#4ec9b0';
            ctx.fillText(label, mid.x + 12, mid.y - 8);
        }
    }
}

function cmUpdateResults() {
    if (cmState.refPoints.length !== 2 || cmState.measurePoints.length < 2) {
        cmResults.className = 'cmeasure-results empty';
        cmResults.textContent = cmState.refPoints.length < 2
            ? 'Marque a referencia (vermelho) e depois os pontos a medir.'
            : 'Marque ao menos 2 pontos para ver as medidas.';
        return;
    }
    const mmPerPx = cmMmPerPx();
    if (!mmPerPx) {
        cmResults.className = 'cmeasure-results empty';
        cmResults.textContent = 'Referencia invalida. Digite um valor positivo em mm.';
        return;
    }
    cmResults.className = 'cmeasure-results';
    cmResults.innerHTML = '';
    let total = 0;
    for (let i = 1; i < cmState.measurePoints.length; i++) {
        const d = cmDist(cmState.measurePoints[i - 1], cmState.measurePoints[i]) * mmPerPx;
        total += d;
        const row = document.createElement('div');
        row.className = 'cmeasure-result-row';
        row.innerHTML = `<span class="seg-label">Segmento ${i} (${i}->${i+1})</span><span class="seg-value">${cmFormatLength(d)}</span>`;
        cmResults.appendChild(row);
    }
    cmState.lastMeasurementMm = total;

    const isClosed = cmState.measurePoints.length >= 3;
    const totalRow = document.createElement('div');
    totalRow.className = 'cmeasure-result-row total';
    totalRow.innerHTML = `<span>${isClosed ? 'Perimetro aberto' : 'Distancia total'}</span><span class="seg-value">${cmFormatLength(total)}</span>`;
    cmResults.appendChild(totalRow);

    if (isClosed) {
        // Adiciona segmento de fechamento (do ultimo ao primeiro) ao perimetro fechado
        const closingSeg = cmDist(
            cmState.measurePoints[cmState.measurePoints.length - 1],
            cmState.measurePoints[0]
        ) * mmPerPx;
        const closedPerim = total + closingSeg;
        const cpRow = document.createElement('div');
        cpRow.className = 'cmeasure-result-row total';
        cpRow.innerHTML = `<span>Perimetro fechado</span><span class="seg-value">${cmFormatLength(closedPerim)}</span>`;
        cmResults.appendChild(cpRow);

        const areaPx = cmPolygonAreaPx(cmState.measurePoints);
        const areaMm2 = areaPx * mmPerPx * mmPerPx;
        const areaRow = document.createElement('div');
        areaRow.className = 'cmeasure-result-row total';
        areaRow.innerHTML = `<span>Area (poligono)</span><span class="seg-value">${cmFormatArea(areaMm2)}</span>`;
        cmResults.appendChild(areaRow);
    }
}

// VOLUME
function cmComputeVolume() {
    const w = parseFloat(cmv.w.value);
    const h = parseFloat(cmv.h.value);
    const d = parseFloat(cmv.d.value);
    const unit = cmv.unit.value;
    if (![w, h, d].every((v) => isFinite(v) && v > 0)) {
        cmv.result.textContent = '--';
        return;
    }
    const vol = w * h * d; // volume na unidade selecionada
    // Converte para mm³ pra normalizar
    const factor = unit === 'mm' ? 1 : unit === 'cm' ? 1000 : 1e9;
    const mm3 = vol * factor;
    let label;
    if (mm3 < 1000) label = `${mm3.toFixed(1)} mm³`;
    else if (mm3 < 1e6) label = `${(mm3 / 1000).toFixed(2)} cm³`;
    else if (mm3 < 1e9) label = `${(mm3 / 1e6).toFixed(2)} dm³ (${(mm3 / 1e6).toFixed(2)} L)`;
    else label = `${(mm3 / 1e9).toFixed(3)} m³`;
    cmv.result.textContent = label;
}
[cmv.w, cmv.h, cmv.d, cmv.unit].forEach((el) => el.addEventListener('input', cmComputeVolume));
cmv.unit.addEventListener('change', cmComputeVolume);

cmv.fromMeasure.addEventListener('click', () => {
    if (!cmState.lastMeasurementMm) { alert('Nenhuma medida disponivel ainda.'); return; }
    const mm = cmState.lastMeasurementMm;
    const unit = cmv.unit.value;
    const v = unit === 'mm' ? mm : unit === 'cm' ? mm / 10 : mm / 1000;
    const target = [cmv.w, cmv.h, cmv.d].find((el) => !el.value);
    if (target) {
        target.value = v.toFixed(unit === 'mm' ? 1 : unit === 'cm' ? 2 : 3);
        cmComputeVolume();
        target.focus();
    } else {
        alert('Os 3 campos ja estao preenchidos. Limpe um pra adicionar.');
    }
});

// MODAL
btnCameraMeasure.addEventListener('click', () => {
    cmOverlay.classList.remove('hidden');
    cmStepSource.classList.remove('hidden');
    cmStepMark.classList.add('hidden');
});
cmCloseBtn.addEventListener('click', () => cmOverlay.classList.add('hidden'));
cmOverlay.addEventListener('click', (e) => {
    if (e.target === cmOverlay) cmOverlay.classList.add('hidden');
});

// ============================================================
// INICIALIZACAO (apos auth)
// ============================================================
async function bootstrapApp() {
    try {
        state.projects = await window.cc.store.listProjects();

        // Primeiro acesso: cria projeto inicial
        if (!state.projects.length) {
            const first = await window.cc.store.createProject('Meu Projeto');
            state.projects = [first];
        }

        // Escolhe projeto ativo
        const savedId = window.cc.store.getActiveProjectId();
        const proj = state.projects.find((p) => p.id === savedId) || state.projects[0];
        await switchToProject(proj.id, { fit: false });

        updateSyncIndicator();
        // Sync inicial caso haja ops pendentes de sessoes anteriores
        if (navigator.onLine) window.cc.store.syncPending().catch(() => {});

        await loadFromHash();
        fitBounds();
    } catch (err) {
        console.error('[cc] bootstrap falhou', err);
        alert('Erro ao carregar projetos: ' + (err.message || err));
    }
}

window.addEventListener('cc:authed', bootstrapApp);

window.addEventListener('cc:signedout', () => {
    state.project = null;
    state.projects = [];
    state.points = [];
    state.polygons = [];
    state.myRole = null;
    elevationCache = {};
    elevationData = [];
    renderProjectSelect();
    renderAll();
    updateSyncIndicator();
    dashboardOverlay?.classList.add('hidden');
});
