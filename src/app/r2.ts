// Cliente para el almacenamiento de archivos en Cloudflare R2 (vía /api/r2).
import { getCurrentAuthUser } from "@/app/cloudSync";

export type ArchivoR2 = { key?: string; data?: string; nombre?: string };

async function api<T>(body: unknown): Promise<T> {
  const user = getCurrentAuthUser();
  if (!user) throw new Error("Sin sesión");
  const token = await user.getIdToken();
  const r = await fetch("/api/r2", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`R2 ${r.status}`);
  return r.json() as Promise<T>;
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [head, b64] = dataUrl.split(",");
  const mime = /data:([^;]+)/.exec(head)?.[1] || "application/octet-stream";
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

/** Sube un archivo/Blob a R2 y devuelve su ruta (key) */
export async function subirArchivo(blob: Blob, nombre: string, carpeta = "redes/adjuntos"): Promise<string> {
  const { key, url } = await api<{ key: string; url: string }>({ action: "put", folder: carpeta, filename: nombre, contentType: blob.type });
  const r = await fetch(url, { method: "PUT", headers: { "Content-Type": blob.type }, body: blob });
  if (!r.ok) throw new Error(`Subida falló (${r.status})`);
  return key;
}

export const subirDataUrl = (dataUrl: string, nombre: string, carpeta?: string) =>
  subirArchivo(dataUrlToBlob(dataUrl), nombre, carpeta);

// URLs firmadas de lectura (duran 1 h; se cachean 50 min)
const cache = new Map<string, { url: string; exp: number }>();
const pendientes = new Map<string, Promise<string>>();

export async function urlDe(key: string): Promise<string> {
  const c = cache.get(key);
  if (c && c.exp > Date.now()) return c.url;
  let p = pendientes.get(key);
  if (!p) {
    p = api<{ urls: Record<string, string> }>({ action: "get", keys: [key] })
      .then(({ urls }) => {
        const url = urls[key];
        if (!url) throw new Error("sin url");
        cache.set(key, { url, exp: Date.now() + 50 * 60 * 1000 });
        return url;
      })
      .finally(() => pendientes.delete(key));
    pendientes.set(key, p);
  }
  return p;
}

/** Devuelve el archivo como data URL (para incrustarlo en PDFs) */
export async function dataUrlDe(a: ArchivoR2): Promise<string> {
  if (!a.key) return a.data || "";
  try {
    const blob = await (await fetch(await urlDe(a.key))).blob();
    return await new Promise<string>((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result as string); fr.onerror = rej; fr.readAsDataURL(blob); });
  } catch { return a.data || ""; }
}

export async function borrarArchivo(key: string): Promise<void> {
  try { await api({ action: "delete", key }); } catch { /* best-effort */ }
}
