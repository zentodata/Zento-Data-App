// ─── SINCRONIZACIÓN CON FIREBASE (todos los módulos) ─────────────────────────
// Usa Firebase Realtime Database vía REST + Firebase Authentication (inicio de
// sesión anónimo automático). Cada "key" local (zCotizaciones, zentocat, etc.)
// se guarda siempre en localStorage al instante, y además se sube a la nube
// (con un pequeño debounce) adjuntando el token de sesión de Firebase Auth,
// para que las reglas de la base de datos puedan exigir "auth != null" y así
// bloquear a cualquiera que solo tenga la URL de la base de datos.

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged, type Auth, type User as FirebaseAuthUser } from "firebase/auth";

const FB_PATH = "zentodata";

/** Todas las colecciones que se sincronizan con la nube */
export const CLOUD_KEYS = [
  "zUsers", "zentocat", "zCotizaciones", "zVentas", "zInventario",
  "zGastos", "zPagos", "zMant", "zNotifs", "zHojas",
] as const;

export type FirebaseWebConfig = {
  apiKey: string;
  authDomain: string;
  databaseURL: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
};

// ── Configuración ──────────────────────────────────────────────────────────

export function getFbConfig(): FirebaseWebConfig | null {
  try {
    const raw = localStorage.getItem("fb_config");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function getFbUrl(): string {
  const cfg = getFbConfig();
  if (cfg?.databaseURL) return cfg.databaseURL.replace(/\/$/, "");
  // Compatibilidad con configuraciones antiguas (solo URL, sin Auth)
  try {
    const raw = localStorage.getItem("fb_url");
    return raw ? JSON.parse(raw) : "";
  } catch {
    return "";
  }
}

/** Intenta interpretar el objeto de configuración que se copia desde la Consola de Firebase */
export function parseFirebaseConfigText(text: string): FirebaseWebConfig | null {
  const get = (key: string) => {
    const m = text.match(new RegExp(`${key}\\s*:\\s*["']([^"']*)["']`));
    return m ? m[1] : "";
  };
  const apiKey = get("apiKey");
  const authDomain = get("authDomain");
  const databaseURL = get("databaseURL");
  const projectId = get("projectId");
  if (!apiKey || !databaseURL || !projectId) return null;
  return {
    apiKey, authDomain, databaseURL, projectId,
    storageBucket: get("storageBucket") || undefined,
    messagingSenderId: get("messagingSenderId") || undefined,
    appId: get("appId") || undefined,
  };
}

export function saveFbConfig(config: FirebaseWebConfig) {
  localStorage.setItem("fb_config", JSON.stringify(config));
  localStorage.setItem("fb_url", JSON.stringify(config.databaseURL.replace(/\/$/, "")));
  // Fuerza reinicialización de Firebase Auth con la nueva configuración
  app = null; auth = null; authReadyPromise = null;
  setStatus("idle");
}

export function clearFbConfig() {
  localStorage.removeItem("fb_config");
  localStorage.removeItem("fb_url");
  app = null; auth = null; authReadyPromise = null;
  setStatus("idle");
}

// ── Autenticación anónima ────────────────────────────────────────────────

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let authReadyPromise: Promise<FirebaseAuthUser | null> | null = null;

function ensureAuth(): Promise<FirebaseAuthUser | null> {
  const config = getFbConfig();
  if (!config) return Promise.resolve(null);
  if (authReadyPromise) return authReadyPromise;

  authReadyPromise = new Promise((resolve) => {
    try {
      app = getApps().length ? getApps()[0] : initializeApp(config as Record<string, unknown>);
      auth = getAuth(app);
      let resolved = false;
      onAuthStateChanged(auth, (user) => {
        if (user && !resolved) { resolved = true; resolve(user); }
      });
      signInAnonymously(auth).catch(() => {
        setStatus("error");
        if (!resolved) { resolved = true; resolve(null); }
      });
    } catch {
      setStatus("error");
      resolve(null);
    }
  });
  return authReadyPromise;
}

async function authQueryParam(): Promise<string> {
  const user = await ensureAuth();
  if (!user) return "";
  try {
    const token = await user.getIdToken();
    return `?auth=${token}`;
  } catch {
    return "";
  }
}

/** true si hay una sesión anónima de Firebase Auth activa (uso informativo en la UI) */
export function isFbAuthReady(): boolean {
  return !!auth?.currentUser;
}

// ── Estado de sincronización (para indicador visual) ────────────────────────

type SyncStatus = "idle" | "syncing" | "synced" | "offline" | "error";
let statusListeners: ((s: SyncStatus) => void)[] = [];
let currentStatus: SyncStatus = "idle";
function setStatus(s: SyncStatus) {
  currentStatus = s;
  statusListeners.forEach(l => l(s));
}
export function onSyncStatusChange(cb: (s: SyncStatus) => void) {
  statusListeners.push(cb);
  cb(currentStatus);
  return () => { statusListeners = statusListeners.filter(l => l !== cb); };
}

// ── Lectura / escritura ──────────────────────────────────────────────────

const pendingTimers: Record<string, number> = {};
const DEBOUNCE_MS = 700;

/** Guarda en localStorage al instante y sube a Firebase (debounced, autenticado) si está configurado */
export function persist(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* noop */ }

  const fbUrl = getFbUrl();
  if (!fbUrl) return;

  if (pendingTimers[key]) window.clearTimeout(pendingTimers[key]);
  setStatus("syncing");
  pendingTimers[key] = window.setTimeout(async () => {
    try {
      const authParam = await authQueryParam();
      const r = await fetch(`${fbUrl}/${FB_PATH}/${key}.json${authParam}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(value),
      });
      setStatus(r.ok ? "synced" : "error");
    } catch {
      setStatus("offline");
    }
  }, DEBOUNCE_MS);
}

/** Descarga una colección desde Firebase (null si no existe o no hay conexión) */
export async function fetchCloud<T>(key: string): Promise<T | null> {
  const fbUrl = getFbUrl();
  if (!fbUrl) return null;
  try {
    const authParam = await authQueryParam();
    const r = await fetch(`${fbUrl}/${FB_PATH}/${key}.json${authParam}`);
    if (!r.ok) return null;
    const d = await r.json();
    return d === null || d === undefined ? null : (d as T);
  } catch {
    return null;
  }
}

/** Descarga todas las colecciones de la nube de una vez (para sincronizar al iniciar sesión) */
export async function fetchAllCloud(): Promise<Partial<Record<typeof CLOUD_KEYS[number], unknown>>> {
  const fbUrl = getFbUrl();
  if (!fbUrl) return {};
  const entries = await Promise.all(
    CLOUD_KEYS.map(async k => [k, await fetchCloud(k)] as const)
  );
  const out: Partial<Record<typeof CLOUD_KEYS[number], unknown>> = {};
  entries.forEach(([k, v]) => { if (v !== null) out[k] = v; });
  return out;
}
