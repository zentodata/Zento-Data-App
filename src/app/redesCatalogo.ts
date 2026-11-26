// Catálogo y utilidades compartidas entre el CRM (App.tsx) y la app de técnicos (/tecnico).
import type { ArchivoRed, EquipoRed, UbicacionRed } from "@/app/App";

export type EstadoOrden = "asignada" | "en_camino" | "en_espera" | "en_proceso" | "terminada" | "firmada";
export const ORDEN_ESTADOS: EstadoOrden[] = ["asignada", "en_camino", "en_espera", "en_proceso", "terminada", "firmada"];
export const ORDEN_LABEL: Record<EstadoOrden, string> = {
  asignada: "Asignada", en_camino: "En camino", en_espera: "En espera", en_proceso: "En proceso", terminada: "Terminada", firmada: "Firmada",
};
export const ORDEN_PASOS = ["Asignado", "En Camino", "En espera", "En Proceso", "Terminado", "Firmado"];

export type MarcaTiempo = { fecha: string; ubicacion?: UbicacionRed };
export type TiemposOrden = Partial<Record<"camino" | "llegada" | "inicio" | "fin", MarcaTiempo>>;

/** Avance guardado del asistente de 4 procesos (sobrevive si se cierra la app) */
export type BorradorOrden = {
  paso: number; // 0..3
  fachada?: ArchivoRed; referencia: string;
  equipos: EquipoRed[]; fotosEquipos: ArchivoRed[];
  conforme: boolean; observaciones: string; fotosPrueba: ArchivoRed[];
  firma?: string; firmante: string; fotosCierre: ArchivoRed[];
};

export const MARCAS_REDES = ["TP-Link", "Ubiquiti", "MikroTik", "Cisco", "D-Link", "Huawei", "Netgear", "ASUS", "Tenda", "Mercusys"];
export const MARCAS_CAMARAS = ["Hikvision", "Dahua", "Uniview", "EZVIZ", "Imou", "TP-Link (Tapo/VIGI)", "Reolink", "Axis", "Hanwha", "Ubiquiti"];
export const TIPOS_EQUIPO_REDES = ["Router", "Switch", "Access Point", "Mesh (Deco / nodo)", "Firewall", "Repetidor", "Antena / Enlace", "Otro"];
export const TIPOS_EQUIPO_CAMARAS = ["Cámara bala", "Cámara domo", "Cámara PTZ", "Cámara WiFi", "DVR / XVR", "NVR", "Otro"];

export const marcaFinal = (e: EquipoRed) => (e.marca === "Otra" ? (e.marcaOtra || "").trim() : e.marca || "");

export function buildDescAuto(equipos: EquipoRed[]): string {
  const items = equipos.filter(e => e.categoria && (e.modelo.trim() || e.marca)).map(e => {
    const q = (e.cantidad || 1) > 1 ? `${e.cantidad} ` : "";
    const t = (e.tipoEquipo && e.tipoEquipo !== "Otro" ? e.tipoEquipo : e.categoria === "camaras" ? "cámara" : "equipo").toLowerCase();
    return `${q}${t} ${marcaFinal(e)} ${e.modelo.trim()}`.replace(/\s+/g, " ").trim() + (e.ubicacion ? ` (${e.ubicacion})` : "");
  });
  if (!items.length) return "";
  const hayCam = equipos.some(e => e.categoria === "camaras");
  return `Instalación de ${items.join(", ")}. Se configuró${items.length > 1 ? "n los equipos" : " el equipo"} y se realizaron pruebas de ${hayCam ? "video y " : ""}funcionamiento. Entrega conforme al cliente.`;
}

export const capturarUbicacion = (timeout = 10000): Promise<UbicacionRed | null> => new Promise(resolve => {
  if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(null);
  navigator.geolocation.getCurrentPosition(
    p => resolve({ lat: +p.coords.latitude.toFixed(6), lng: +p.coords.longitude.toFixed(6), precision: Math.round(p.coords.accuracy), fecha: new Date().toISOString() }),
    () => resolve(null),
    { enableHighAccuracy: true, timeout, maximumAge: 60000 },
  );
});
export const mapaUrl = (u: { lat: number; lng: number }) => `https://www.google.com/maps?q=${u.lat},${u.lng}`;
/** Botón «Cómo llegar»: abre Google Maps con la ruta desde donde esté el técnico */
export const comoLlegarUrl = (direccion: string, u?: { lat: number; lng: number }) =>
  `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(u ? `${u.lat},${u.lng}` : direccion)}`;

/** Normaliza un teléfono guatemalteco (8 dígitos → +502) para enlaces */
export const telDigitos = (t: string) => {
  let d = (t || "").replace(/\D/g, "");
  if (d.length === 8) d = "502" + d;
  return d;
};
export const waUrl = (t: string, texto = "") => `https://wa.me/${telDigitos(t)}${texto ? `?text=${encodeURIComponent(texto)}` : ""}`;

export function comprimirImagen(file: File, max = 1280, calidad = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", calidad));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("img")); };
    img.src = url;
  });
}
