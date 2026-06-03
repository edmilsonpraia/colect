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
    state.points = await window.cc.store.listPoints(proj.id);
    state.myRole = await window.cc.store.getMyRole(proj.id);
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
function importFile(file) {
    if (!state.project) { alert('Selecione um projeto primeiro.'); return; }
    if (state.myRole === 'viewer') { alert('Voce e visualizador, nao pode importar.'); return; }
    const reader = new FileReader();
    reader.onload = async (e) => {
        const text = e.target.result;
        const ext = file.name.split('.').pop().toLowerCase();
        const incoming = [];
        try {
            if (ext === 'json') {
                const data = JSON.parse(text);
                if (!Array.isArray(data)) throw new Error('Invalid');
                data.forEach((p) => {
                    if (typeof p.lat === 'number' && typeof p.lng === 'number') {
                        incoming.push({ lat: p.lat, lng: p.lng, label: p.label||'', category: p.category||'', color: p.color||'#4ec9b0', photo: p.photo||'' });
                    }
                });
            } else if (ext === 'gpx') {
                const parser = new DOMParser(), doc = parser.parseFromString(text, 'text/xml');
                doc.querySelectorAll('wpt, trkpt, rtept').forEach((el) => {
                    const lat = parseFloat(el.getAttribute('lat')), lng = parseFloat(el.getAttribute('lon'));
                    const name = el.querySelector('name')?.textContent || '';
                    if (!isNaN(lat) && !isNaN(lng)) incoming.push({ lat, lng, label: name });
                });
            } else if (ext === 'kml') {
                const parser = new DOMParser(), doc = parser.parseFromString(text, 'text/xml');
                doc.querySelectorAll('Placemark').forEach((pm) => {
                    const coords = pm.querySelector('Point coordinates')?.textContent?.trim();
                    if (coords) {
                        const [lng, lat] = coords.split(',').map(Number);
                        const name = pm.querySelector('name')?.textContent || '';
                        if (!isNaN(lat) && !isNaN(lng)) incoming.push({ lat, lng, label: name });
                    }
                });
            }
            if (!incoming.length) { alert('Nenhum ponto valido no arquivo.'); return; }
            const created = await window.cc.store.bulkCreatePoints(state.project.id, incoming, state.points.length);
            state.points.push(...created);
            renderAll(); fitBounds();
            alert(`Importacao concluida: ${created.length} pontos.`);
        } catch (err) { alert('Erro ao importar: ' + (err.message || err)); }
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
// SYNC INDICATOR
// ============================================================
const syncIndicator = $('sync-indicator');
const syncCount = $('sync-count');

function updateSyncIndicator() {
    const n = window.cc.store.pendingCount();
    if (n > 0) {
        syncIndicator?.classList.remove('hidden');
        if (syncCount) syncCount.textContent = String(n);
    } else {
        syncIndicator?.classList.add('hidden');
    }
}

window.cc.store.onChange((e) => {
    if (e.type === 'pending' || e.type === 'sync-end') {
        updateSyncIndicator();
    }
    if (e.type === 'sync-start') {
        syncIndicator?.classList.add('syncing');
    }
    if (e.type === 'sync-end') {
        syncIndicator?.classList.remove('syncing');
        // Recarrega projeto atual apos sync para refletir IDs reais
        if (e.detail?.synced > 0 && state.project) {
            window.cc.store.listPoints(state.project.id).then((pts) => {
                state.points = pts;
                renderAll();
            }).catch(() => {});
        }
    }
});

window.addEventListener('online', () => {
    window.cc.store.syncPending().catch(() => {});
});

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

    dashInviteSection.classList.toggle('hidden', state.myRole !== 'admin');
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
    state.myRole = null;
    elevationCache = {};
    elevationData = [];
    renderProjectSelect();
    renderAll();
    updateSyncIndicator();
    dashboardOverlay?.classList.add('hidden');
});
