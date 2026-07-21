// ============================================================
// SUPABASE CLIENT
// ============================================================
// Inicializa o cliente Supabase e expoe helpers de autenticacao
// no namespace global window.cc.auth

(function () {
    const SUPABASE_URL = 'https://jqwmzenfszxchdovvlhk.supabase.co';
    const SUPABASE_KEY = 'sb_publishable_0BmzXF7A6-0X3vmVkfd5dg_FhlH_OO5';

    if (!window.supabase || typeof window.supabase.createClient !== 'function') {
        console.error('[cc] Supabase SDK nao carregou. Verifique a tag <script> no index.html.');
        return;
    }

    const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            storage: window.localStorage,
            storageKey: 'cc-supabase-auth',
        },
    });

    const listeners = new Set();
    let currentSession = null;

    function isExpiringSoon(session) {
        if (!session?.expires_at) return false;
        // Buffer de 60s: nao usa tokens prestes a expirar
        return (session.expires_at * 1000) < (Date.now() + 60000);
    }

    async function init() {
        let session = null;
        try {
            const { data, error } = await client.auth.getSession();
            if (error) throw error;
            session = data.session;
        } catch (err) {
            console.warn('[cc.auth] getSession falhou:', err.message);
        }

        // Se sessao esta expirada/expirando, tenta refresh; se falhar, limpa
        if (session && isExpiringSoon(session)) {
            console.log('[cc.auth] sessao expirando, tentando refresh...');
            try {
                const { data: r, error: rErr } = await client.auth.refreshSession();
                if (rErr || !r?.session) throw rErr || new Error('sem sessao apos refresh');
                session = r.session;
                console.log('[cc.auth] refresh OK');
            } catch (err) {
                console.warn('[cc.auth] refresh falhou, limpando sessao:', err.message);
                try { await client.auth.signOut({ scope: 'local' }); } catch (_) {}
                session = null;
            }
        }

        currentSession = session;

        client.auth.onAuthStateChange((_event, s) => {
            currentSession = s;
            listeners.forEach((cb) => {
                try { cb(s); } catch (e) { console.error(e); }
            });
        });
        return currentSession;
    }

    function onAuthChange(cb) {
        listeners.add(cb);
        return () => listeners.delete(cb);
    }

    function getSession() { return currentSession; }
    function getUser() { return currentSession?.user || null; }

    async function signUp(email, password, displayName) {
        const { data, error } = await client.auth.signUp({
            email: email.trim().toLowerCase(),
            password,
            options: {
                data: { display_name: (displayName || '').trim() || undefined },
            },
        });
        if (error) throw error;
        return data;
    }

    async function signIn(email, password) {
        const { data, error } = await client.auth.signInWithPassword({
            email: email.trim().toLowerCase(),
            password,
        });
        if (error) throw error;
        return data;
    }

    async function signOut() {
        const { error } = await client.auth.signOut();
        if (error) throw error;
    }

    async function resetPassword(email) {
        const { error } = await client.auth.resetPasswordForEmail(email.trim().toLowerCase());
        if (error) throw error;
    }

    window.cc = window.cc || {};
    window.cc.supabase = client;
    window.cc.auth = {
        init,
        onAuthChange,
        getSession,
        getUser,
        signUp,
        signIn,
        signOut,
        resetPassword,
    };
})();
