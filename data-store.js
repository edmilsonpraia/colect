// ============================================================
// DATA STORE
// ============================================================
// Camada de acesso a dados: Supabase como fonte da verdade,
// localStorage como cache offline + fila de operacoes pendentes.
//
// Exposto em window.cc.store.
//
// Modelo: id UUID gerado no cliente -> mesmo ID na DB,
// para que os mesmos registros funcionem online e offline.

(function () {
    const sb = window.cc?.supabase;
    if (!sb) { console.error('[cc.store] Supabase nao inicializado'); return; }

    // ====== LOCALSTORAGE KEYS ======
    const PENDING_KEY        = 'cc-pending-ops';
    const CACHE_PROJECTS_KEY = 'cc-cache-projects';
    const cachePointsKey     = (projectId) => `cc-cache-points-${projectId}`;
    const ACTIVE_PROJECT_KEY = 'cc-active-project-id';

    // ====== UUID ======
    function uuid() {
        if (window.crypto?.randomUUID) return crypto.randomUUID();
        // Fallback simples
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = Math.random() * 16 | 0;
            return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });
    }

    // ====== FILA DE OPERACOES PENDENTES ======
    function getPending() {
        try { return JSON.parse(localStorage.getItem(PENDING_KEY) || '[]'); }
        catch { return []; }
    }
    function setPending(ops) { localStorage.setItem(PENDING_KEY, JSON.stringify(ops)); }
    function enqueue(op) {
        const ops = getPending();
        ops.push({ id: uuid(), created_at: Date.now(), retries: 0, ...op });
        setPending(ops);
        notify('pending');
    }
    function pendingCount() { return getPending().length; }

    // ====== EVENTOS ======
    const listeners = new Set();
    function onChange(cb) { listeners.add(cb); return () => listeners.delete(cb); }
    function notify(type, detail) {
        listeners.forEach((cb) => { try { cb({ type, detail }); } catch (e) { console.error(e); } });
    }

    // ====== HELPERS DE CACHE ======
    function readCache(key, fallback) {
        try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
        catch { return fallback; }
    }
    function writeCache(key, value) {
        try { localStorage.setItem(key, JSON.stringify(value)); }
        catch (e) { console.warn('[cc.store] cache write falhou', e); }
    }

    // ====== MAPEAMENTO DB <-> APP ======
    // App espera campos: lat, lng, label, category, color, photo, timestamp
    // DB tem:           lat, lng, label, category, color, photo_url, created_at
    function dbToApp(p) {
        return {
            id: p.id,
            project_id: p.project_id,
            user_id: p.user_id,
            lat: p.lat,
            lng: p.lng,
            label: p.label || '',
            category: p.category || '',
            color: p.color || '#4ec9b0',
            photo: p.photo_url || '',
            position: p.position || 0,
            timestamp: p.created_at,
        };
    }

    // ====== PROJETOS ======
    async function listProjects() {
        try {
            const { data, error } = await sb.from('projects')
                .select('*').order('created_at', { ascending: true });
            if (error) throw error;
            writeCache(CACHE_PROJECTS_KEY, data);
            return data;
        } catch (err) {
            console.warn('[cc.store] listProjects fallback cache:', err.message);
            return readCache(CACHE_PROJECTS_KEY, []);
        }
    }

    async function createProject(name) {
        const user = window.cc.auth.getUser();
        if (!user) throw new Error('Nao autenticado');
        const id = uuid();
        const row = {
            id,
            name: name.trim(),
            owner_id: user.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };
        // Cache otimista
        const cached = readCache(CACHE_PROJECTS_KEY, []);
        cached.push(row);
        writeCache(CACHE_PROJECTS_KEY, cached);

        try {
            const { data, error } = await sb.from('projects')
                .insert({ id, name: row.name, owner_id: user.id })
                .select().single();
            if (error) throw error;
            return data;
        } catch (err) {
            enqueue({ type: 'project.create', payload: { id, name: row.name, owner_id: user.id } });
            return row;
        }
    }

    async function renameProject(id, newName) {
        const trimmed = newName.trim();
        const cached = readCache(CACHE_PROJECTS_KEY, []);
        const idx = cached.findIndex((p) => p.id === id);
        if (idx >= 0) { cached[idx].name = trimmed; writeCache(CACHE_PROJECTS_KEY, cached); }

        try {
            const { error } = await sb.from('projects')
                .update({ name: trimmed }).eq('id', id);
            if (error) throw error;
        } catch (err) {
            enqueue({ type: 'project.rename', payload: { id, name: trimmed } });
        }
    }

    async function deleteProject(id) {
        const cached = readCache(CACHE_PROJECTS_KEY, []).filter((p) => p.id !== id);
        writeCache(CACHE_PROJECTS_KEY, cached);
        localStorage.removeItem(cachePointsKey(id));

        try {
            const { error } = await sb.from('projects').delete().eq('id', id);
            if (error) throw error;
        } catch (err) {
            enqueue({ type: 'project.delete', payload: { id } });
        }
    }

    function getActiveProjectId() {
        return localStorage.getItem(ACTIVE_PROJECT_KEY);
    }
    function setActiveProjectId(id) {
        if (id) localStorage.setItem(ACTIVE_PROJECT_KEY, id);
        else localStorage.removeItem(ACTIVE_PROJECT_KEY);
    }

    // ====== PONTOS ======
    async function listPoints(projectId) {
        try {
            const { data, error } = await sb.from('points')
                .select('*').eq('project_id', projectId)
                .order('position', { ascending: true })
                .order('created_at', { ascending: true });
            if (error) throw error;
            const mapped = data.map(dbToApp);
            writeCache(cachePointsKey(projectId), mapped);
            return mapped;
        } catch (err) {
            console.warn('[cc.store] listPoints fallback cache:', err.message);
            return readCache(cachePointsKey(projectId), []);
        }
    }

    async function createPoint(projectId, point, position) {
        const user = window.cc.auth.getUser();
        if (!user) throw new Error('Nao autenticado');
        const id = uuid();
        const localRow = {
            id,
            project_id: projectId,
            user_id: user.id,
            lat: point.lat,
            lng: point.lng,
            label: point.label || '',
            category: point.category || '',
            color: point.color || '#4ec9b0',
            photo: point.photo || '',
            position: position ?? 0,
            timestamp: new Date().toISOString(),
        };
        const dbRow = {
            id,
            project_id: projectId,
            user_id: user.id,
            lat: point.lat,
            lng: point.lng,
            label: localRow.label,
            category: localRow.category,
            color: localRow.color,
            photo_url: localRow.photo,
            position: localRow.position,
        };

        // Cache otimista
        const cached = readCache(cachePointsKey(projectId), []);
        cached.push(localRow);
        writeCache(cachePointsKey(projectId), cached);

        try {
            const { data, error } = await sb.from('points').insert(dbRow).select().single();
            if (error) throw error;
            return dbToApp(data);
        } catch (err) {
            enqueue({ type: 'point.create', payload: dbRow });
            return localRow;
        }
    }

    async function updatePoint(id, projectId, patch) {
        const cached = readCache(cachePointsKey(projectId), []);
        const idx = cached.findIndex((p) => p.id === id);
        if (idx >= 0) {
            Object.assign(cached[idx], patch);
            writeCache(cachePointsKey(projectId), cached);
        }

        const dbPatch = {};
        if ('label' in patch)    dbPatch.label = patch.label;
        if ('category' in patch) dbPatch.category = patch.category;
        if ('color' in patch)    dbPatch.color = patch.color;
        if ('photo' in patch)    dbPatch.photo_url = patch.photo;
        if ('lat' in patch)      dbPatch.lat = patch.lat;
        if ('lng' in patch)      dbPatch.lng = patch.lng;
        if ('position' in patch) dbPatch.position = patch.position;

        try {
            const { error } = await sb.from('points').update(dbPatch).eq('id', id);
            if (error) throw error;
        } catch (err) {
            enqueue({ type: 'point.update', payload: { id, patch: dbPatch } });
        }
    }

    async function deletePoint(id, projectId) {
        const cached = readCache(cachePointsKey(projectId), []).filter((p) => p.id !== id);
        writeCache(cachePointsKey(projectId), cached);

        try {
            const { error } = await sb.from('points').delete().eq('id', id);
            if (error) throw error;
        } catch (err) {
            enqueue({ type: 'point.delete', payload: { id } });
        }
    }

    async function clearPoints(projectId) {
        writeCache(cachePointsKey(projectId), []);
        try {
            const { error } = await sb.from('points').delete().eq('project_id', projectId);
            if (error) throw error;
        } catch (err) {
            enqueue({ type: 'point.clear', payload: { projectId } });
        }
    }

    async function bulkCreatePoints(projectId, points, startPosition = 0) {
        const user = window.cc.auth.getUser();
        if (!user) throw new Error('Nao autenticado');
        const dbRows = [];
        const localRows = [];
        points.forEach((p, i) => {
            const id = uuid();
            const localRow = {
                id,
                project_id: projectId,
                user_id: user.id,
                lat: p.lat,
                lng: p.lng,
                label: p.label || '',
                category: p.category || '',
                color: p.color || '#4ec9b0',
                photo: p.photo || '',
                position: startPosition + i,
                timestamp: p.timestamp || new Date().toISOString(),
            };
            localRows.push(localRow);
            dbRows.push({
                id, project_id: projectId, user_id: user.id,
                lat: p.lat, lng: p.lng,
                label: localRow.label, category: localRow.category,
                color: localRow.color, photo_url: localRow.photo,
                position: localRow.position,
            });
        });

        const cached = readCache(cachePointsKey(projectId), []);
        cached.push(...localRows);
        writeCache(cachePointsKey(projectId), cached);

        try {
            const { error } = await sb.from('points').insert(dbRows);
            if (error) throw error;
        } catch (err) {
            dbRows.forEach((row) => enqueue({ type: 'point.create', payload: row }));
        }
        return localRows;
    }

    // ====== MEMBROS / DASHBOARD ======
    async function listMembers(projectId) {
        const { data: members, error } = await sb.from('project_members')
            .select('*').eq('project_id', projectId);
        if (error) throw error;
        if (!members.length) return [];
        const userIds = [...new Set(members.map((m) => m.user_id))];
        const { data: profiles, error: pErr } = await sb.from('profiles')
            .select('id, email, display_name').in('id', userIds);
        if (pErr) throw pErr;
        const profById = Object.fromEntries((profiles || []).map((p) => [p.id, p]));
        return members.map((m) => ({
            ...m,
            profile: profById[m.user_id] || { id: m.user_id, email: '?', display_name: '?' },
        }));
    }

    async function inviteMember(projectId, email, role = 'collaborator') {
        const { data, error } = await sb.rpc('invite_member', {
            _project_id: projectId, _email: email, _role: role,
        });
        if (error) throw error;
        return data;
    }

    async function updateMemberRole(projectId, userId, role) {
        const { error } = await sb.rpc('update_member_role', {
            _project_id: projectId, _user_id: userId, _new_role: role,
        });
        if (error) throw error;
    }

    async function removeMember(projectId, userId) {
        const { error } = await sb.rpc('remove_member', {
            _project_id: projectId, _user_id: userId,
        });
        if (error) throw error;
    }

    async function getDashboard(projectId) {
        const { data, error } = await sb.from('v_project_dashboard')
            .select('*').eq('project_id', projectId).maybeSingle();
        if (error) throw error;
        return data;
    }

    async function getActivities(projectId, limit = 200) {
        const { data: logs, error } = await sb.from('activity_log')
            .select('*').eq('project_id', projectId)
            .order('created_at', { ascending: false })
            .limit(limit);
        if (error) throw error;
        if (!logs || !logs.length) return [];
        // Coleta IDs envolvidos (actor + entity quando for member)
        const ids = new Set();
        logs.forEach((l) => {
            if (l.actor_id) ids.add(l.actor_id);
            if (l.entity_type === 'member' && l.entity_id) ids.add(l.entity_id);
        });
        let profById = {};
        if (ids.size) {
            const { data: profs } = await sb.from('profiles')
                .select('id, email, display_name').in('id', [...ids]);
            profById = Object.fromEntries((profs || []).map((p) => [p.id, p]));
        }
        return logs.map((l) => ({
            ...l,
            actor: profById[l.actor_id] || null,
            affected_member: l.entity_type === 'member' ? (profById[l.entity_id] || null) : null,
        }));
    }

    async function listProjectPhotos(projectId) {
        const { data, error } = await sb.from('points')
            .select('id, user_id, project_id, lat, lng, label, category, color, photo_url, created_at')
            .eq('project_id', projectId)
            .not('photo_url', 'is', null)
            .neq('photo_url', '')
            .order('created_at', { ascending: false });
        if (error) throw error;
        if (!data || !data.length) return [];
        const userIds = [...new Set(data.map((p) => p.user_id).filter(Boolean))];
        let profById = {};
        if (userIds.length) {
            const { data: profs } = await sb.from('profiles')
                .select('id, email, display_name').in('id', userIds);
            profById = Object.fromEntries((profs || []).map((p) => [p.id, p]));
        }
        return data.map((p) => ({
            id: p.id,
            project_id: p.project_id,
            lat: p.lat, lng: p.lng,
            label: p.label || '',
            category: p.category || '',
            color: p.color || '#4ec9b0',
            photo: p.photo_url,
            created_at: p.created_at,
            author: profById[p.user_id] || null,
        }));
    }

    async function getMyRole(projectId) {
        const user = window.cc.auth.getUser();
        if (!user) return null;
        const { data, error } = await sb.from('project_members')
            .select('role').eq('project_id', projectId).eq('user_id', user.id)
            .maybeSingle();
        if (error) { console.warn('[cc.store] getMyRole error', error); return null; }
        return data?.role || null;
    }

    // ====== SYNC ======
    let syncing = false;
    async function syncPending() {
        if (syncing) return { synced: 0, failed: 0, skipped: true };
        if (!navigator.onLine) return { synced: 0, failed: 0, offline: true };
        const ops = getPending();
        if (!ops.length) return { synced: 0, failed: 0 };

        syncing = true;
        notify('sync-start');
        const remaining = [];
        let synced = 0, failed = 0;

        for (const op of ops) {
            try {
                switch (op.type) {
                    case 'project.create':
                        // upsert: idempotente em retry
                        await sb.from('projects').upsert(op.payload).throwOnError();
                        break;
                    case 'project.rename':
                        await sb.from('projects').update({ name: op.payload.name })
                            .eq('id', op.payload.id).throwOnError();
                        break;
                    case 'project.delete':
                        await sb.from('projects').delete().eq('id', op.payload.id).throwOnError();
                        break;
                    case 'point.create':
                        await sb.from('points').upsert(op.payload).throwOnError();
                        break;
                    case 'point.update':
                        await sb.from('points').update(op.payload.patch)
                            .eq('id', op.payload.id).throwOnError();
                        break;
                    case 'point.delete':
                        await sb.from('points').delete().eq('id', op.payload.id).throwOnError();
                        break;
                    case 'point.clear':
                        await sb.from('points').delete()
                            .eq('project_id', op.payload.projectId).throwOnError();
                        break;
                    default:
                        console.warn('[cc.store] op desconhecida:', op.type);
                        remaining.push(op);
                        continue;
                }
                synced++;
            } catch (err) {
                console.warn('[cc.store] sync falhou para op', op.type, err.message);
                op.retries = (op.retries || 0) + 1;
                if (op.retries < 5) remaining.push(op);
                else failed++;
            }
        }

        setPending(remaining);
        syncing = false;
        notify('sync-end', { synced, failed, remaining: remaining.length });
        return { synced, failed, remaining: remaining.length };
    }

    window.addEventListener('online', () => { syncPending().catch(() => {}); });

    // ====== EXPORTACAO ======
    window.cc = window.cc || {};
    window.cc.store = {
        // projects
        listProjects, createProject, renameProject, deleteProject,
        getActiveProjectId, setActiveProjectId,
        // points
        listPoints, createPoint, updatePoint, deletePoint, clearPoints, bulkCreatePoints,
        // members / dashboard
        listMembers, inviteMember, updateMemberRole, removeMember,
        getDashboard, getMyRole,
        // reports
        getActivities, listProjectPhotos,
        // sync / events
        syncPending, pendingCount, onChange,
        // utils
        uuid,
    };
})();
