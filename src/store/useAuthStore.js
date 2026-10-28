import { create } from 'zustand';

const AUTH_KEY = 'nexa.auth';
const API_BASE = 'http://localhost:5000';

/* ------------------------------------------------------------------ */
/* localStorage helpers                                                */
/* ------------------------------------------------------------------ */
function readJSON(key) {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJSON(key, value) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full / private mode — ignore */
  }
}

/* ------------------------------------------------------------------ */
/* Server <-> client user mapping                                      */
/* ------------------------------------------------------------------ */
const ROLE_LABELS = {
  admin: 'Directeur / Head Office Manager',
  employee: "Chef d'Agence / Guichetier",
};

// The API stores the avatar as `profileImage`; the UI reads `photo`.
function fromServer(user) {
  if (!user) return null;
  const role = user.role === 'admin' ? 'admin' : 'employee';
  const employeeId = user.employeeId || user.matricule || '';
  const agencyLocation = user.agencyLocation || user.location || '';

  return {
    id: user.id,
    fullName: user.fullName || '',
    email: user.email || '',
    role,
    roleLabel: user.roleLabel || ROLE_LABELS[role],
    position: user.position || ROLE_LABELS[role],
    employeeId,
    matricule: employeeId,
    agencyLocation,
    location: agencyLocation,
    department: user.department || '',
    phone: user.phone || '',
    bio: user.bio || '',
    isVerified: Boolean(user.isVerified),
    joinedAt: user.joinedAt || user.createdAt || new Date().toISOString(),
    photo: user.profileImage || user.photo || null,
  };
}

/* ------------------------------------------------------------------ */
/* Fetch helpers                                                       */
/* ------------------------------------------------------------------ */
async function apiFetch(path, { method = 'GET', token, body } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    return { ok: response.ok, status: response.status, payload };
  } finally {
    clearTimeout(timer);
  }
}

function apiError(payload, fallback) {
  const error = new Error(payload?.error || fallback);
  error.reason = 'request-failed';
  return error;
}

const persisted = readJSON(AUTH_KEY);

export const useAuthStore = create((set, get) => {
  const persist = (user, token) => {
    writeJSON(AUTH_KEY, { user, token, isAuthenticated: Boolean(user && token) });
  };

  return {
    user: persisted?.user ?? null,
    token: persisted?.token ?? null,
    isAuthenticated: Boolean(persisted?.token && persisted?.user),
    isHydrating: false,

    // Accepts either { user, token } (new API) or a bare user object (legacy).
    login: (arg) =>
      set((state) => {
        const user = fromServer(arg?.user ?? arg);
        const token = arg?.token ?? state.token ?? null;
        persist(user, token);
        return { user, token, isAuthenticated: Boolean(user && token) };
      }),

    register: (arg) =>
      set((state) => {
        const user = fromServer(arg?.user ?? arg);
        const token = arg?.token ?? state.token ?? null;
        persist(user, token);
        return { user, token, isAuthenticated: Boolean(user && token) };
      }),

    // Optimistic local update (used for instant avatar reflection).
    updateUser: (patch) =>
      set((state) => {
        if (!state.user) return state;
        const next = typeof patch === 'function' ? patch(state.user) : patch;
        const user = { ...state.user, ...next };
        persist(user, state.token);
        return { user };
      }),

    // GET /api/profile — refresh the active session from the server.
    fetchProfile: async () => {
      const token = get().token;
      if (!token) return null;
      set({ isHydrating: true });
      try {
        const { ok, status, payload } = await apiFetch('/api/profile', { token });
        if (status === 401) {
          get().logout();
          return null;
        }
        if (ok && payload?.user) {
          const user = fromServer(payload.user);
          persist(user, token);
          set({ user, isAuthenticated: true });
          return user;
        }
        return null;
      } catch {
        return null; // network error — keep the persisted session
      } finally {
        set({ isHydrating: false });
      }
    },

    // POST /api/profile/update — persist profile changes to the server.
    saveProfile: async (patch) => {
      const token = get().token;
      if (!token) {
        const error = new Error('NO_TOKEN');
        error.reason = 'no-token';
        throw error;
      }
      const { ok, status, payload } = await apiFetch('/api/profile/update', {
        method: 'POST',
        token,
        body: patch,
      });
      if (status === 401) {
        get().logout();
        const error = new Error('UNAUTHORIZED');
        error.reason = 'unauthorized';
        throw error;
      }
      if (!ok) {
        const error = new Error(payload?.error || 'UPDATE_FAILED');
        error.reason = 'update-failed';
        throw error;
      }
      const user = fromServer(payload.user);
      persist(user, token);
      set({ user });
      return user;
    },

    /* ---------------------- Wafacash admin APIs ---------------------- */
    fetchEmployees: async () => {
      const token = get().token;
      if (!token) return { employees: [], positions: {} };
      const { ok, status, payload } = await apiFetch('/api/admin/employees', { token });
      if (status === 401) {
        get().logout();
        throw apiError(payload, 'UNAUTHORIZED');
      }
      if (!ok) throw apiError(payload, 'EMPLOYEES_LOAD_FAILED');
      return {
        employees: (payload.employees || []).map(fromServer),
        positions: payload.positions || {},
      };
    },

    updateEmployee: async (id, patch) => {
      const token = get().token;
      if (!token) throw apiError(null, 'NO_TOKEN');
      const { ok, status, payload } = await apiFetch(`/api/admin/employees/${id}`, {
        method: 'POST',
        token,
        body: patch,
      });
      if (status === 401) {
        get().logout();
        throw apiError(payload, 'UNAUTHORIZED');
      }
      if (!ok) throw apiError(payload, 'EMPLOYEE_UPDATE_FAILED');
      const updated = fromServer(payload.user);
      if (get().user?.id === updated.id) {
        persist(updated, token);
        set({ user: updated });
      }
      return updated;
    },

    fetchAdminStats: async () => {
      const token = get().token;
      if (!token) return null;
      const { ok, status, payload } = await apiFetch('/api/admin/stats', { token });
      if (status === 401) {
        get().logout();
        throw apiError(payload, 'UNAUTHORIZED');
      }
      if (!ok) throw apiError(payload, 'STATS_LOAD_FAILED');
      return payload.stats;
    },

    fetchSystemLogs: async (limit = 100) => {
      const token = get().token;
      if (!token) return [];
      const { ok, status, payload } = await apiFetch(`/api/admin/logs?limit=${limit}`, { token });
      if (status === 401) {
        get().logout();
        throw apiError(payload, 'UNAUTHORIZED');
      }
      if (!ok) throw apiError(payload, 'LOGS_LOAD_FAILED');
      return payload.logs || [];
    },

    fetchTransactions: async (limit = 80) => {
      const token = get().token;
      if (!token) return { agency: '', transactions: [] };
      const { ok, status, payload } = await apiFetch(`/api/transactions?limit=${limit}`, { token });
      if (status === 401) {
        get().logout();
        throw apiError(payload, 'UNAUTHORIZED');
      }
      if (!ok) throw apiError(payload, 'TRANSACTIONS_LOAD_FAILED');
      return { agency: payload.agency || '', transactions: payload.transactions || [] };
    },

    logout: () =>
      set(() => {
        writeJSON(AUTH_KEY, null);
        return { user: null, token: null, isAuthenticated: false, isHydrating: false };
      }),
  };
});
