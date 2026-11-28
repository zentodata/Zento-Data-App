// Catálogo y utilidades compartidas entre el CRM (App.tsx) y la app de técnicos (/tecnico).
import type { ArchivoRed, EquipoRed, UbicacionRed } from "@/app/App";

export type EstadoOrden = "asignada" | "reasignada" | "en_camino" | "en_espera" | "en_proceso" | "terminada" | "firmada";
/** Flujo normal (sin «reasignada», que es un paso opcional) */
export const ORDEN_ESTADOS: EstadoOrden[] = ["asignada", "en_camino", "en_espera", "en_proceso", "terminada", "firmada"];
export const ORDEN_ESTADOS_TODOS: EstadoOrden[] = ["asignada", "reasignada", "en_camino", "en_espera", "en_proceso", "terminada", "firmada"];
export const ORDEN_LABEL: Record<EstadoOrden, string> = {
  asignada: "Asignada", reasignada: "Reasignada", en_camino: "En camino", en_espera: "En espera", en_proceso: "En proceso", terminada: "Terminada", firmada: "Firmada",
};
export const ORDEN_PASOS = ["Asignado", "En Camino", "En espera", "En Proceso", "Terminado", "Firmado"];
/** Estados en los que aún no se ejecuta el trabajo */
export const ORDEN_SIN_EJECUTAR: EstadoOrden[] = ["asignada", "reasignada", "en_camino", "en_espera"];
/** La bitácora de observaciones está activa desde «en espera» */
export const ORDEN_PERMITE_BITACORA: EstadoOrden[] = ["en_espera", "en_proceso", "terminada", "firmada"];
/** Pasos para mostrar en la barra: si la orden fue reasignada se inserta «Reasignado» tras «Asignado» */
export function pasosDeOrden(estado: EstadoOrden): { labels: string[]; actual: number } {
  if (estado === "reasignada") {
    const labels = ["Asignado", "Reasignado", ...ORDEN_PASOS.slice(1)];
    return { labels, actual: 1 };
  }
  return { labels: ORDEN_PASOS, actual: ORDEN_ESTADOS.indexOf(estado) };
}
/** Nota de la bitácora (observaciones, incidencias o cambios con el propietario) */
export type BitacoraOrden = { id: string; fecha: string; texto: string; autor?: string; tipo?: "nota" | "reasignacion" | "estado" };

export type MarcaTiempo = { fecha: string; ubicacion?: UbicacionRed };
export type TiemposOrden = Partial<Record<"camino" | "llegada" | "inicio" | "fin", MarcaTiempo>>;

/** Avance guardado del asistente de 4 procesos (sobrevive si se cierra la app) */
export type BorradorOrden = {
  paso: number; // 0..3
  fachada?: ArchivoRed; referencia: string;
  equipos: EquipoRed[]; fotosEquipos: ArchivoRed[];
  conforme: boolean; observaciones: string; fotosPrueba: ArchivoRed[];
  firma?: string; firmante: string; fotosCierre: ArchivoRed[];
  firmaTecnicoAutorizada?: boolean; firmaTecnico?: string;
};

// ─── Categorías de equipo («¿Qué se instaló?») ───────────────────────────────
export type CategoriaEquipo = "redes" | "camaras" | "cableado" | "acceso" | "alarmas" | "energia" | "software" | "otro";

export type DefCategoria = {
  icono: string; label: string; labelLargo: string;
  tipoLabel: string; tipos: string[]; marcas: string[];
  marca: "requerida" | "opcional" | "oculta";
  modelo: "requerido" | "opcional";
  modeloLabel: string; modeloPlaceholder: string;
  cantLabel?: string;
};

export const CATEGORIAS_ORDEN: CategoriaEquipo[] = ["redes", "camaras", "cableado", "acceso", "alarmas", "energia", "software", "otro"];

export const CATEGORIAS: Record<CategoriaEquipo, DefCategoria> = {
  redes: {
    icono: "🌐", label: "Redes", labelLargo: "Redes y comunicaciones",
    tipoLabel: "Equipo de red",
    tipos: ["Router", "Switch administrable", "Switch no administrable", "Access Point", "Mesh (Deco / nodo)", "Firewall", "Repetidor", "Antena / Enlace", "Otro"],
    marcas: ["TP-Link", "Ubiquiti", "MikroTik", "Cisco", "D-Link", "Huawei", "Netgear", "ASUS", "Tenda", "Mercusys"],
    marca: "requerida", modelo: "requerido", modeloLabel: "Modelo", modeloPlaceholder: "Ej. Deco S7, ER605",
  },
  camaras: {
    icono: "📹", label: "Cámaras", labelLargo: "Videovigilancia (CCTV)",
    tipoLabel: "Tipo de equipo",
    tipos: ["Cámara bala", "Cámara domo", "Cámara PTZ", "Cámara WiFi", "DVR / XVR", "NVR", "Disco duro (HDD)", "Otro"],
    marcas: ["Hikvision", "Dahua", "Uniview", "EZVIZ", "Imou", "TP-Link (Tapo/VIGI)", "Reolink", "Axis", "Hanwha", "Ubiquiti"],
    marca: "requerida", modelo: "requerido", modeloLabel: "Modelo", modeloPlaceholder: "Ej. DS-2CD1023G0E-I",
  },
  cableado: {
    icono: "🔌", label: "Cableado", labelLargo: "Cableado estructurado y canalización",
    tipoLabel: "Tipo de cableado",
    tipos: ["Punto de red Cat5e", "Punto de red Cat6", "Cable UTP (metros)", "Cable coaxial (metros)", "Fibra óptica", "Patch panel", "Rack / gabinete", "Canalización / tubería", "Conectores / balun / fuentes", "Otro"],
    marcas: ["Panduit", "Belden", "Nexxt", "Siemon", "CommScope", "Legrand", "Linkbasic", "Furukawa"],
    marca: "opcional", modelo: "opcional", modeloLabel: "Referencia / detalle (opcional)", modeloPlaceholder: "Ej. Cat6 CMR, 305 m",
    cantLabel: "Cant. / m",
  },
  acceso: {
    icono: "🖐️", label: "Biométrico", labelLargo: "Control de acceso y biométricos",
    tipoLabel: "Equipo de acceso",
    tipos: ["Biométrico (huella / facial)", "Lector de tarjeta / RFID", "Panel de control de acceso", "Cerradura electromagnética", "Botón de salida", "Videoportero / intercomunicador", "Otro"],
    marcas: ["ZKTeco", "Hikvision", "Dahua", "Suprema", "Anviz", "Uniview", "Virdi", "Akuvox", "Hanwha", "Ubiquiti"],
    marca: "requerida", modelo: "requerido", modeloLabel: "Modelo", modeloPlaceholder: "Ej. SpeedFace-V5L",
  },
  alarmas: {
    icono: "🚨", label: "Alarmas", labelLargo: "Alarmas y sensores",
    tipoLabel: "Equipo de alarma",
    tipos: ["Panel de alarma", "Teclado", "Sensor de movimiento", "Sensor magnético (puerta / ventana)", "Sirena", "Detector de humo", "Cerca eléctrica", "Otro"],
    marcas: ["DSC", "Paradox", "Honeywell", "Ajax", "Bosch", "Risco", "Hikvision (AX Pro)", "Dahua", "Texecom", "Pima"],
    marca: "requerida", modelo: "requerido", modeloLabel: "Modelo", modeloPlaceholder: "Ej. PC1832",
  },
  energia: {
    icono: "🔋", label: "Energía", labelLargo: "Energía y respaldo",
    tipoLabel: "Equipo de energía",
    tipos: ["UPS / No-break", "Batería", "Regulador / supresor de picos", "Fuente de poder", "Inyector / switch PoE", "Otro"],
    marcas: ["APC", "Forza", "CyberPower", "Eaton", "Tripp Lite", "Vertiv", "Ubiquiti", "TP-Link", "Mean Well", "Steren"],
    marca: "requerida", modelo: "requerido", modeloLabel: "Modelo", modeloPlaceholder: "Ej. BX1500M",
  },
  software: {
    icono: "💻", label: "Software", labelLargo: "Software y licencias",
    tipoLabel: "Tipo de software",
    tipos: ["Sistema operativo", "Antivirus / seguridad", "Ofimática (Office)", "Software de videovigilancia", "Control de asistencia / acceso", "Respaldo / nube", "Otro"],
    marcas: ["Microsoft", "Kaspersky", "ESET", "Bitdefender", "Hikvision (iVMS)", "Dahua (SmartPSS)", "ZKTeco (ZKBio)", "Google", "Adobe", "Acronis"],
    marca: "opcional", modelo: "requerido", modeloLabel: "Nombre y versión", modeloPlaceholder: "Ej. Windows 11 Pro",
    cantLabel: "Licencias",
  },
  otro: {
    icono: "🧰", label: "Otro", labelLargo: "Otro equipo o servicio",
    tipoLabel: "Tipo",
    tipos: ["Computadora / laptop", "Impresora", "Monitor / TV", "Otro"],
    marcas: [],
    marca: "oculta", modelo: "requerido", modeloLabel: "Descripción del equipo", modeloPlaceholder: "Ej. Laptop Dell Inspiron 15",
  },
};

// Compatibilidad con código anterior
export const MARCAS_REDES = CATEGORIAS.redes.marcas;
export const MARCAS_CAMARAS = CATEGORIAS.camaras.marcas;
export const TIPOS_EQUIPO_REDES = CATEGORIAS.redes.tipos;
export const TIPOS_EQUIPO_CAMARAS = CATEGORIAS.camaras.tipos;

export const marcaFinal = (e: EquipoRed) => (e.marca === "Otra" ? (e.marcaOtra || "").trim() : e.marca || "");

/** ¿Está completo el equipo para guardarse? (categoría + tipo + marca/modelo según la categoría) */
export function equipoCompleto(e: EquipoRed): boolean {
  const d = e.categoria ? CATEGORIAS[e.categoria] : undefined;
  if (!d || !e.tipoEquipo) return false;
  if (d.marca === "requerida" && !marcaFinal(e)) return false;
  if (d.modelo === "requerido" && !(e.modelo || "").trim()) return false;
  return true;
}
/** ¿Empezó a llenarse pero no está completo? */
export const equipoIncompleto = (e: EquipoRed) => !!e.categoria && !equipoCompleto(e) && !!(e.tipoEquipo || marcaFinal(e) || (e.modelo || "").trim());

/** Deja el equipo listo para guardar (marca final, modelo por defecto, credenciales vacías fuera) */
export function cerrarEquipo(e: EquipoRed): EquipoRed {
  const limpio = (v?: string) => (v || "").trim() || undefined;
  return {
    ...e, marca: marcaFinal(e) || undefined, marcaOtra: undefined,
    modelo: (e.modelo || "").trim() || e.tipoEquipo || "",
    usuario: limpio(e.usuario), clave: limpio(e.clave), ssid: limpio(e.ssid), claveWifi: limpio(e.claveWifi), ip: limpio(e.ip),
  };
}

// ─── Accesos administrativos (usuario / contraseña) según el tipo de equipo ──
const TIPOS_CON_ACCESO = new Set([
  "Router", "Switch", "Switch administrable", "Access Point", "Mesh (Deco / nodo)", "Firewall", "Repetidor", "Antena / Enlace",
  "Cámara WiFi", "DVR / XVR", "NVR",
  "Biométrico (huella / facial)", "Panel de control de acceso", "Videoportero / intercomunicador",
  "Panel de alarma",
]);
const TIPOS_CON_WIFI = new Set(["Router", "Mesh (Deco / nodo)", "Access Point", "Repetidor"]);
export const requiereAcceso = (e: EquipoRed) => !!e.tipoEquipo && TIPOS_CON_ACCESO.has(e.tipoEquipo);
export const tieneWifi = (e: EquipoRed) => !!e.tipoEquipo && TIPOS_CON_WIFI.has(e.tipoEquipo);
export const tieneCredenciales = (e: EquipoRed) => !!(e.usuario || e.clave || e.ssid || e.claveWifi);

// ─── Redacción técnica automática del trabajo realizado ──────────────────────
function hash(s: string) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }
const unir = (xs: string[]) => (xs.length <= 1 ? xs.join("") : xs.slice(0, -1).join(", ") + " y " + xs[xs.length - 1]);
const minus = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);

function plural(tipo: string, n: number): string {
  const t = tipo.toLowerCase();
  const sing: Record<string, string> = { "dvr / xvr": "DVR/XVR", "nvr": "NVR", "cámara ptz": "cámara PTZ", "cámara wifi": "cámara WiFi", "ups / no-break": "UPS / no-break",
    "punto de red cat5e": "punto de red Cat5e", "punto de red cat6": "punto de red Cat6", "disco duro (hdd)": "disco duro (HDD)", "biométrico (huella / facial)": "biométrico",
    "lector de tarjeta / rfid": "lector RFID", "sistema operativo": "sistema operativo", "access point": "access point" };
  const plu: Record<string, string> = {
    "cámara bala": "cámaras bala", "cámara domo": "cámaras domo", "cámara ptz": "cámaras PTZ", "cámara wifi": "cámaras WiFi",
    "router": "routers", "switch administrable": "switches administrables", "switch no administrable": "switches no administrables", "switch": "switches",
    "access point": "access points", "mesh (deco / nodo)": "nodos mesh", "repetidor": "repetidores", "antena / enlace": "antenas / enlaces",
    "disco duro (hdd)": "discos duros (HDD)", "dvr / xvr": "DVR/XVR", "nvr": "NVR",
    "punto de red cat5e": "puntos de red Cat5e", "punto de red cat6": "puntos de red Cat6", "biométrico (huella / facial)": "biométricos",
    "lector de tarjeta / rfid": "lectores RFID", "ups / no-break": "UPS / no-breaks", "batería": "baterías", "sensor de movimiento": "sensores de movimiento",
    "sirena": "sirenas", "teclado": "teclados", "patch panel": "patch panels",
  };
  if (n <= 1) return sing[t] || t;
  return plu[t] || (t.endsWith("s") ? t : t + "s");
}

/** Ej.: «4 cámaras bala Hikvision DS-2CD1023G0E-I (entrada, patio)» */
export function itemEquipo(e: EquipoRed): string {
  const n = e.cantidad || 1;
  const tipo = e.tipoEquipo && e.tipoEquipo !== "Otro" ? plural(e.tipoEquipo, n) : "";
  const modelo = (e.modelo || "").trim();
  const modeloUtil = modelo && modelo !== e.tipoEquipo ? modelo : "";
  const base = [n > 1 ? String(n) : "", tipo, marcaFinal(e), modeloUtil].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  return base + (e.ubicacion?.trim() ? ` (${e.ubicacion.trim()})` : "");
}

const ES_GRABADOR = (e: EquipoRed) => ["DVR / XVR", "NVR"].includes(e.tipoEquipo || "");
const ES_CAMARA = (e: EquipoRed) => ["Cámara bala", "Cámara domo", "Cámara PTZ", "Cámara WiFi"].includes(e.tipoEquipo || "");

/**
 * Texto técnico del trabajo realizado, armado con lo que el técnico registró.
 * Varía la redacción según el tipo de equipo; `semilla` mantiene la misma variante entre renders.
 * No incluye contraseñas (este texto puede viajar por el enlace de firma del cliente).
 */
export function buildDescTecnica(equipos: EquipoRed[], semilla = ""): string {
  const validos = equipos.filter(e => e.categoria && (equipoCompleto(e) || (e.modelo || "").trim() || e.tipoEquipo));
  if (!validos.length) return "";
  const v = (clave: string, opts: string[]) => opts[hash(semilla + clave) % opts.length];
  const bloques: string[] = [];
  const cat = (c: CategoriaEquipo) => validos.filter(e => e.categoria === c);
  const items = (xs: EquipoRed[]) => unir(xs.map(itemEquipo));

  // — Videovigilancia —
  const cc = cat("camaras");
  if (cc.length) {
    const cams = cc.filter(ES_CAMARA), grab = cc.filter(ES_GRABADOR), otros = cc.filter(e => !ES_CAMARA(e) && !ES_GRABADOR(e));
    const l: string[] = [];
    if (cams.length) l.push(`${v("c1", ["Montaje, orientación y ajuste del campo visual de", "Instalación, fijación y encuadre de", "Instalación y alineación del campo de visión de"])} ${items(cams)}.`);
    if (grab.length) l.push(`${v("c2", ["Configuración de", "Puesta en marcha y configuración de", "Programación de"])} ${items(grab)}: alta de canales, parámetros de grabación y sincronización de fecha y hora.`);
    if (otros.length) l.push(`Instalación de ${items(otros)}.`);
    l.push(v("c3", ["Verificación de imagen en vivo y de la reproducción de lo grabado.", "Pruebas de visualización en vivo y reproducción de grabaciones.", "Comprobación de calidad de imagen y de la grabación."]));
    bloques.push(`Videovigilancia (CCTV):\n` + l.map(x => `• ${x}`).join("\n"));
  }

  // — Redes —
  const rr = cat("redes");
  if (rr.length) {
    const wifi = rr.filter(tieneWifi), sw = rr.filter(e => (e.tipoEquipo || "").startsWith("Switch")), otros = rr.filter(e => !tieneWifi(e) && !(e.tipoEquipo || "").startsWith("Switch"));
    const l: string[] = [];
    if (wifi.length) l.push(`${v("r1", ["Instalación y configuración de", "Puesta en marcha de", "Despliegue y configuración de"])} ${items(wifi)}: parámetros de red (LAN/WAN), red inalámbrica con seguridad y asignación de direccionamiento IP.`);
    if (sw.length) l.push(`${v("r2", ["Instalación y conexión de", "Montaje y configuración de"])} ${items(sw)}, con verificación de enlaces y puertos activos.`);
    if (otros.length) l.push(`Instalación y configuración de ${items(otros)}.`);
    l.push(v("r3", ["Pruebas de conectividad, cobertura y velocidad en sitio.", "Verificación de conectividad y de cobertura en las áreas atendidas.", "Comprobación de navegación, estabilidad del enlace y cobertura."]));
    bloques.push(`Redes y comunicaciones:\n` + l.map(x => `• ${x}`).join("\n"));
  }

  // — Cableado —
  const cb = cat("cableado");
  if (cb.length) {
    bloques.push(`Cableado estructurado:\n• ${v("b1", ["Tendido, canalización y conectorización de", "Instalación y terminación de", "Canalización, cableado y conectorización de"])} ${items(cb)}.\n• ${v("b2", ["Identificación de cada punto y verificación de continuidad y conectividad.", "Comprobación de continuidad y conectividad en cada punto."])}`);
  }

  // — Acceso / biométricos —
  const ac = cat("acceso");
  if (ac.length) {
    bloques.push(`Control de acceso:\n• ${v("a1", ["Instalación y configuración de", "Montaje y puesta en marcha de"])} ${items(ac)}.\n• ${v("a2", ["Registro de usuarios, sincronización de fecha y hora y pruebas de funcionamiento.", "Alta de usuarios, ajuste de fecha y hora y pruebas de acceso."])}`);
  }

  // — Alarmas —
  const al = cat("alarmas");
  if (al.length) bloques.push(`Alarmas y sensores:\n• ${v("m1", ["Instalación, programación y prueba de", "Montaje, configuración y verificación de"])} ${items(al)}.`);

  // — Energía —
  const en = cat("energia");
  if (en.length) bloques.push(`Energía y respaldo:\n• ${v("e1", ["Instalación y verificación de", "Conexión y prueba de"])} ${items(en)}.`);

  // — Software —
  const sf = cat("software");
  if (sf.length) bloques.push(`Software y licencias:\n• ${v("s1", ["Instalación, activación y configuración de", "Instalación y licenciamiento de"])} ${items(sf)}.`);

  // — Otros —
  const ot = cat("otro");
  if (ot.length) bloques.push(`Otros trabajos:\n• ${v("o1", ["Instalación y configuración de", "Puesta en marcha de"])} ${items(ot)}.`);

  const cierre: string[] = [v("z1", [
    "Los equipos quedaron operando correctamente y se hizo la entrega y explicación de uso al cliente.",
    "Se dejó el sistema en operación, con pruebas finales satisfactorias y explicación de uso al cliente.",
    "Instalación finalizada y probada; se realizó la entrega del sistema y la inducción de uso al cliente.",
  ])];
  if (validos.some(tieneCredenciales)) cierre.push("Se entregó al cliente la información de acceso administrativo de los equipos (ver sección de accesos).");
  return `${bloques.join("\n\n")}\n\n${cierre.join(" ")}`;
}

/** @deprecated usa buildDescTecnica */
export const buildDescAuto = (equipos: EquipoRed[]) => buildDescTecnica(equipos);

// ─── Estados de la orden: cambios manuales desde el CRM ──────────────────────
type ConOrden = { estadoOrden?: EstadoOrden; tiempos?: TiemposOrden; borrador?: BorradorOrden };

/** Cambia el estado de la orden y limpia lo que ya no corresponde (tiempos posteriores y avance sin terminar) */
export function aplicarEstadoOrden<T extends ConOrden>(sv: T, nuevo: EstadoOrden): T {
  const t = { ...(sv.tiempos || {}) };
  const conservar: Record<EstadoOrden, (keyof TiemposOrden)[]> = {
    asignada: [], reasignada: [], en_camino: ["camino"], en_espera: ["camino", "llegada"],
    en_proceso: ["camino", "llegada", "inicio"], terminada: ["camino", "llegada", "inicio", "fin"], firmada: ["camino", "llegada", "inicio", "fin"],
  };
  (["camino", "llegada", "inicio", "fin"] as const).forEach(k => { if (!conservar[nuevo].includes(k)) delete t[k]; });
  const mantenerBorrador = nuevo === "en_proceso";
  return { ...sv, estadoOrden: nuevo, tiempos: Object.keys(t).length ? t : undefined, borrador: mantenerBorrador ? sv.borrador : undefined };
}

/** Mezcla la lista local con la de la nube: gana el registro más reciente de cada servicio. */
export function mezclarRedes<T extends { id: string; ultimaModificacion?: string }>(
  local: T[], nube: T[], opts: { ignorar?: Set<string>; soloNube?: boolean; conservar?: string } = {},
): T[] {
  const idsNube = new Set(nube.map(r => r.id));
  // soloNube: lo que ya no existe en la nube se borró desde otro dispositivo (no se vuelve a subir)
  const base = opts.soloNube ? local.filter(r => idsNube.has(r.id) || r.id === opts.conservar) : local;
  const porId = new Map(base.map(r => [r.id, r]));
  const nuevos: T[] = [];
  for (const c of nube) {
    if (opts.ignorar?.has(c.id)) continue;
    const l = porId.get(c.id);
    if (!l) nuevos.push(c);
    else if ((c.ultimaModificacion || "") > (l.ultimaModificacion || "")) porId.set(c.id, c);
  }
  return [...nuevos, ...base.map(r => porId.get(r.id) || r)];
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

/** Comprime la foto y, si se da `sello`, imprime una franja con fecha/OT/ubicación (evidencia ante reclamos). */
export function comprimirImagen(file: File, max = 1280, calidad = 0.7, sello?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      const g = c.getContext("2d")!;
      g.drawImage(img, 0, 0, c.width, c.height);
      if (sello) {
        const lineas = sello.split("\n").filter(Boolean);
        const fs = Math.max(12, Math.round(c.width / 52));
        const pad = Math.round(fs * 0.55), alto = lineas.length * (fs + 3) + pad * 2 - 3;
        g.fillStyle = "rgba(6,10,24,0.62)";
        g.fillRect(0, c.height - alto, c.width, alto);
        g.fillStyle = "#ffffff"; g.textBaseline = "top";
        lineas.forEach((l, i) => {
          g.font = `${i === 0 ? "bold " : ""}${fs}px system-ui, Arial, sans-serif`;
          g.fillText(l, pad, c.height - alto + pad + i * (fs + 3), c.width - pad * 2);
        });
      }
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", calidad));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("img")); };
    img.src = url;
  });
}

/** Texto del sello de una foto: Zento Data · OT · fecha y hora (+ cliente y GPS si se conocen) */
export function selloFoto(sv: { ot?: string; codigoCliente?: string; clienteNombre?: string; ubicacion?: UbicacionRed; tiempos?: TiemposOrden }, gps?: UbicacionRed | null): string {
  const f = new Date().toLocaleString("es-GT", { dateStyle: "short", timeStyle: "short" });
  const u = gps || sv.tiempos?.llegada?.ubicacion || sv.ubicacion;
  return [`Zento Data · ${sv.ot ? "OT-" + sv.ot : sv.codigoCliente || ""} · ${f}`,
    [sv.clienteNombre, u ? `GPS ${u.lat.toFixed(5)}, ${u.lng.toFixed(5)}` : ""].filter(Boolean).join(" · ")].filter(Boolean).join("\n");
}

// ─── Avisos al cliente por WhatsApp ──────────────────────────────────────────
export type TipoAviso = "cita" | "recordatorio" | "camino" | "llegada" | "terminado" | "reasignada";
export const AVISOS_WA: { id: TipoAviso; label: string }[] = [
  { id: "cita", label: "📅 Confirmar cita" }, { id: "recordatorio", label: "⏰ Recordatorio de visita" },
  { id: "camino", label: "🚗 Voy en camino" }, { id: "llegada", label: "📍 Ya llegué" },
  { id: "terminado", label: "✅ Servicio terminado" }, { id: "reasignada", label: "🔁 Nueva fecha de visita" },
];
/** Aviso sugerido según el estado de la orden */
export const avisoDeEstado = (e?: EstadoOrden): TipoAviso =>
  e === "en_camino" ? "camino" : e === "en_espera" ? "llegada" : e === "terminada" || e === "firmada" ? "terminado" : e === "reasignada" ? "reasignada" : "cita";

export function mensajeWhatsapp(sv: { clienteNombre: string; ot?: string; fechaProgramada?: string; tecnicoAsignado?: string; direccion?: string }, tipo: TipoAviso, tecnico?: string): string {
  const cli = (sv.clienteNombre || "").split(" ")[0] || "";
  const ot = sv.ot ? ` (OT-${sv.ot})` : "";
  const cuando = sv.fechaProgramada ? new Date(sv.fechaProgramada).toLocaleString("es-GT", { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" }).replace(/\.$/, "") : "";
  const tec = tecnico || sv.tecnicoAsignado || "su técnico";
  const firma = "\n\nZento Data 🔒 Seguridad Electrónica y Soporte Técnico";
  switch (tipo) {
    case "cita": return `Hola ${cli}, le saluda ${tec} de Zento Data. Le confirmo su servicio${ot}${cuando ? ` para el ${cuando}` : ""}${sv.direccion ? ` en ${sv.direccion}` : ""}. ¿Me confirma que habrá alguien para recibirnos? Gracias.${firma}`;
    case "recordatorio": return `Hola ${cli}, le recordamos su visita de servicio${ot}${cuando ? ` programada para el ${cuando}` : " programada"}. Si necesita cambiar la hora, avíseme por este medio.${firma}`;
    case "camino": return `Hola ${cli}, soy ${tec} de Zento Data. Ya voy en camino a su servicio${ot}. Le aviso al llegar.${firma}`;
    case "llegada": return `Hola ${cli}, ya llegué a su dirección${ot}. ¿Me permite el acceso para iniciar el trabajo?${firma}`;
    case "terminado": return `Hola ${cli}, hemos terminado su servicio${ot}. Gracias por confiar en Zento Data; cualquier duda o ajuste con gusto le atendemos. Su acta quedará disponible para firma.${firma}`;
    case "reasignada": return `Hola ${cli}, por ajustes de agenda su servicio${ot} se reprogramó${cuando ? ` para el ${cuando}` : ""}. ¿Le queda bien esa fecha? Gracias por su comprensión.${firma}`;
  }
}
