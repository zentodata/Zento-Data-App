// Bitácora del sistema (Logs): errores y movimientos de CRM y app de técnicos.
// Se guarda en este dispositivo y se sincroniza con Firebase (clave zLogs); solo el admin la ve en el CRM.
import { persist, fetchCloud } from "@/app/cloudSync";

export type LogNivel = "cambio" | "info" | "advertencia" | "error";
export type LogEntry = {
  id: string; fecha: string; nivel: LogNivel; modulo: string; accion: string;
  detalle?: string; usuario?: string; origen: "crm" | "tecnico";
};

const KEY = "zLogs";
const MAX = 800;
let origen: LogEntry["origen"] = "crm";
let usuarioActual = "";
let pendientes: LogEntry[] = [];
let timer: number | undefined;
let escuchas: (() => void)[] = [];

const rid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const leer = (): LogEntry[] => { try { const a = JSON.parse(localStorage.getItem(KEY) || "[]"); return Array.isArray(a) ? a : []; } catch { return []; } };
const fusionar = (...listas: LogEntry[][]): LogEntry[] => {
  const m = new Map<string, LogEntry>();
  listas.flat().forEach(l => l && l.id && m.set(l.id, l));
  return [...m.values()].sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, MAX);
};
const avisar = () => escuchas.forEach(f => f());
export const onLogsChange = (f: () => void) => { escuchas.push(f); return () => { escuchas = escuchas.filter(x => x !== f); }; };
export const logsLocales = leer;
export const setLogUsuario = (n: string) => { usuarioActual = n; };

async function subir() {
  timer = undefined;
  const lote = pendientes; pendientes = [];
  if (!lote.length) return;
  try {
    const nube = await fetchCloud<unknown>("zLogs");
    const lista = Array.isArray(nube) ? (nube as LogEntry[]) : nube && typeof nube === "object" ? Object.values(nube as object) as LogEntry[] : [];
    const todo = fusionar(lista, leer(), lote);
    try { localStorage.setItem(KEY, JSON.stringify(todo)); } catch { /* */ }
    persist(KEY, todo);
    avisar();
  } catch { pendientes = [...lote, ...pendientes]; }
}

export function logEvento(nivel: LogNivel, modulo: string, accion: string, detalle?: string) {
  const e: LogEntry = { id: rid(), fecha: new Date().toISOString(), nivel, modulo, accion, detalle: detalle?.slice(0, 600), usuario: usuarioActual || undefined, origen };
  try { localStorage.setItem(KEY, JSON.stringify(fusionar(leer(), [e]))); } catch { /* */ }
  pendientes.push(e);
  avisar();
  if (timer === undefined) timer = window.setTimeout(subir, 4000);
}

/** Trae los logs de la nube (otros dispositivos / app de técnicos) y los une con los locales */
export async function refrescarLogs(): Promise<LogEntry[]> {
  const nube = await fetchCloud<unknown>("zLogs");
  const lista = Array.isArray(nube) ? (nube as LogEntry[]) : nube && typeof nube === "object" ? Object.values(nube as object) as LogEntry[] : [];
  const todo = fusionar(lista, leer());
  try { localStorage.setItem(KEY, JSON.stringify(todo)); } catch { /* */ }
  avisar();
  return todo;
}

export function vaciarLogs() {
  try { localStorage.setItem(KEY, "[]"); } catch { /* */ }
  pendientes = [];
  persist(KEY, []);
  avisar();
}

/** Captura errores no controlados de la página (se llama una vez al arrancar) */
let iniciado = false;
export function iniciarLogger(o: LogEntry["origen"]) {
  origen = o;
  if (iniciado) return;
  iniciado = true;
  window.addEventListener("error", ev => {
    if (/ResizeObserver/.test(ev.message || "")) return;
    logEvento("error", "sistema", "Error de JavaScript", `${ev.message || ""} ${ev.filename ? `(${ev.filename.split("/").pop()}:${ev.lineno})` : ""}`.trim());
  });
  window.addEventListener("unhandledrejection", ev => {
    const r = ev.reason as { message?: string } | string | undefined;
    logEvento("error", "sistema", "Promesa rechazada", typeof r === "string" ? r : r?.message || "sin detalle");
  });
}
