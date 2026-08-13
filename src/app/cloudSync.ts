// ─── SINCRONIZACIÓN CON FIREBASE (todos los módulos) ─────────────────────────
// Usa Firebase Realtime Database vía REST (mismo esquema que ya usaba el
// catálogo). Cada "key" local (zCotizaciones, zentocat, zVentas, etc.) se
// guarda siempre en localStorage al instante, y además se sube a la nube
// (con un pequeño debounce) cuando hay una URL de Firebase configurada.

const FB_PATH = "zentodata";

/** Todas las colecciones que se sincronizan con la nube */
export const CLOUD_KEYS = [
  "zUsers", "zentocat", "zCotizaciones", "zVentas", "zInventario",
  "zGastos", "zPagos", "zMant", "zNotifs", "zHojas",
] as const;

export function getFbUrl(): string {
  try {
    const raw = localStorage.getItem("fb_url");
    return raw ? JSON.parse(raw) : "";
  } catch {
    return "";
  }
}

const pendingTimers: Record<string, number> = {};
const DEBOUNCE_MS = 700;

/** Estado simple de sincronización para mostrar un indicador visual */
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

/** Guarda en localStorage al instante y sube a Firebase (debounced) si está configurado */
export function persist(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* noop */ }

  const fbUrl = getFbUrl();
  if (!fbUrl) return;

  if (pendingTimers[key]) window.clearTimeout(pendingTimers[key]);
  setStatus("syncing");
  pendingTimers[key] = window.setTimeout(async () => {
    try {
      const r = await fetch(`${fbUrl}/${FB_PATH}/${key}.json`, {
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
    const r = await fetch(`${fbUrl}/${FB_PATH}/${key}.json`);
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
