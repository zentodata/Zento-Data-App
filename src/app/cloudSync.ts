// ─── SINCRONIZACIÓN CON FIREBASE (todos los módulos) ─────────────────────────
// Usa Firebase Realtime Database vía REST + Firebase Authentication real
// (email/contraseña — YA NO se usa inicio de sesión anónimo). Cada colección
// de negocio se guarda en localStorage al instante y además se sube a la
// nube (con un pequeño debounce) adjuntando el token de la sesión real de
// Firebase Auth, para que las reglas puedan exigir que el usuario esté
// autenticado y activo, distinguiéndolo de una sesión anónima.
//
// Los PERFILES de usuario (nombre, rol, permisos, activo) viven en un nodo
// separado "/users/{uid}", indexados por el UID real de Firebase Auth — ya
// no se guardan contraseñas en la base de datos. Firebase administra las
// contraseñas de forma segura.

import { initializeApp, getApps, deleteApp, type FirebaseApp } from "firebase/app";
import {
  getAuth, onAuthStateChanged, signOut,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail,
  type Auth, type User as FirebaseAuthUser,
} from "firebase/auth";
import { getEnvFirebaseConfig } from "./firebaseConfig";

const FB_PATH = "zentodata";
const USERS_PATH = "users";

/** Colecciones de datos de negocio que se sincronizan bajo /zentodata */
export const CLOUD_KEYS = [
  "zentocat", "zCotizaciones", "zVentas", "zInventario",
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
  const envConfig = getEnvFirebaseConfig();
  if (envConfig) return envConfig;
  try {
    const raw = localStorage.getItem("fb_config");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function isFbConfigFromEnv(): boolean {
  return !!getEnvFirebaseConfig();
}

export function getFbUrl(): string {
  const cfg = getFbConfig();
  if (cfg?.databaseURL) return cfg.databaseURL.replace(/\/$/, "");
  try {
    const raw = localStorage.getItem("fb_url");
    return raw ? JSON.parse(raw) : "";
  } catch {
    return "";
  }
}

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
  resetMainApp();
  setStatus("idle");
}

export function clearFbConfig() {
  localStorage.removeItem("fb_config");
  localStorage.removeItem("fb_url");
  resetMainApp();
  setStatus("idle");
}

function resetMainApp() {
  const existing = getApps().find(a => a.name === "[DEFAULT]");
  if (existing) deleteApp(existing).catch(() => {});
  app = null; auth = null;
}

// ── App / Auth principal (sesión real del usuario que usa la app) ─────────

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

function getMainAuth(): Auth | null {
  const config = getFbConfig();
  if (!config) return null;
  if (!app) app = getApps().find(a => a.name === "[DEFAULT]") || initializeApp(config as Record<string, unknown>);
  if (!auth) auth = getAuth(app);
  return auth;
}

/** Se dispara cada vez que cambia la sesión de Firebase Auth (login/logout) */
export function onAuthChange(cb: (user: FirebaseAuthUser | null) => void): () => void {
  const a = getMainAuth();
  if (!a) { cb(null); return () => {}; }
  return onAuthStateChanged(a, cb);
}

export function getCurrentAuthUser(): FirebaseAuthUser | null {
  return getMainAuth()?.currentUser || null;
}

/** Inicia sesión con email y contraseña. Lanza el error de Firebase tal cual (código en err.code). */
export async function signInEmail(email: string, password: string): Promise<FirebaseAuthUser> {
  const a = getMainAuth();
  if (!a) throw new Error("Firebase no está configurado");
  const cred = await signInWithEmailAndPassword(a, email, password);
  return cred.user;
}

export async function signOutFb(): Promise<void> {
  const a = getMainAuth();
  if (a) await signOut(a);
}

export async function sendPasswordReset(email: string): Promise<void> {
  const a = getMainAuth();
  if (!a) throw new Error("Firebase no está configurado");
  await sendPasswordResetEmail(a, email);
}

/**
 * Crea un nuevo usuario de Firebase Authentication SIN cerrar la sesión del
 * administrador actual. El SDK de Firebase, si se usa la instancia principal,
 * inicia sesión automáticamente como el usuario recién creado — por eso esta
 * función usa una instancia secundaria y temporal de Firebase solo para la
 * creación, y la descarta enseguida.
 */
export async function createUserEmail(email: string, password: string): Promise<string> {
  const config = getFbConfig();
  if (!config) throw new Error("Firebase no está configurado");
  const tempName = `user-creation-${Date.now()}`;
  const tempApp = initializeApp(config as Record<string, unknown>, tempName);
  try {
    const tempAuth = getAuth(tempApp);
    const cred = await createUserWithEmailAndPassword(tempAuth, email, password);
    const newUid = cred.user.uid;
    await signOut(tempAuth);
    return newUid;
  } finally {
    await deleteApp(tempApp).catch(() => {});
  }
}

async function authQueryParam(): Promise<string> {
  const user = getCurrentAuthUser();
  if (!user) return "";
  try {
    const token = await user.getIdToken();
    return `?auth=${token}`;
  } catch {
    return "";
  }
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

// ── Lectura / escritura de datos de negocio (/zentodata) ──────────────────

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

// ── Perfiles de usuario (/users/{uid}) — separados de los datos de negocio ──

export async function getUserProfile<T>(uidValue: string): Promise<T | null> {
  const fbUrl = getFbUrl();
  if (!fbUrl) return null;
  try {
    const authParam = await authQueryParam();
    const r = await fetch(`${fbUrl}/${USERS_PATH}/${uidValue}.json${authParam}`);
    if (!r.ok) return null;
    const d = await r.json();
    return d === null || d === undefined ? null : (d as T);
  } catch {
    return null;
  }
}

export async function setUserProfile(uidValue: string, profile: unknown): Promise<boolean> {
  const fbUrl = getFbUrl();
  if (!fbUrl) return false;
  try {
    const authParam = await authQueryParam();
    const r = await fetch(`${fbUrl}/${USERS_PATH}/${uidValue}.json${authParam}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    });
    return r.ok;
  } catch {
    return false;
  }
}

/** Solo funciona si el usuario autenticado tiene rol admin (lo exigen las reglas de Firebase) */
export async function fetchAllUserProfiles<T>(): Promise<Record<string, T> | null> {
  const fbUrl = getFbUrl();
  if (!fbUrl) return null;
  try {
    const authParam = await authQueryParam();
    const r = await fetch(`${fbUrl}/${USERS_PATH}.json${authParam}`);
    if (!r.ok) return null;
    const d = await r.json();
    return d === null || d === undefined ? null : (d as Record<string, T>);
  } catch {
    return null;
  }
}
