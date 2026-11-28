// Zento Técnico — app instalable (PWA) para ejecutar las órdenes de trabajo que crea el CRM.
// Mismo login (Firebase Auth) y mismos datos (zRedes / zCotizaciones) que el CRM.
import { useCallback, useEffect, useRef, useState } from "react";
import type { User as FbUser } from "firebase/auth";
import {
  onAuthChange, signInEmail, signOutFb, getUserProfile, fetchCloud, persist, getFbUrl,
} from "@/app/cloudSync";
import { subirDataUrl, urlDe, dataUrlDe, crearSolicitudFirma, estadoFirmas, urlEnlaceFirma, borrarArchivo, firmaAutorizada } from "@/app/r2";
import { EquipoEditor } from "@/app/EquipoEditor";
import { SignaturePad } from "@/app/SignaturePad";
import { descargarPdfServicioRed } from "@/app/pdfServicioRed";
import type { ServicioRed, EquipoRed, ArchivoRed, HistorialRed, Cotizacion, UbicacionRed } from "@/app/App";
import {
  type EstadoOrden, type BorradorOrden, type BitacoraOrden, ORDEN_LABEL, pasosDeOrden, ORDEN_PERMITE_BITACORA,
  buildDescTecnica, equipoCompleto, equipoIncompleto, cerrarEquipo, mezclarRedes,
  capturarUbicacion, mapaUrl, comoLlegarUrl, telDigitos, waUrl, comprimirImagen,
} from "@/app/redesCatalogo";

// ─── Utilidades ──────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const fmtQ = (n: number) => "Q " + Number(n || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const hoyLocal = () => new Date().toLocaleDateString("sv-SE");

function lsGet<T>(k: string, def: T): T {
  try { const r = localStorage.getItem(k); return r ? (JSON.parse(r) as T) : def; } catch { return def; }
}
function lsSet(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* cuota llena */ } }

const arr = <T,>(v: unknown): T[] => Array.isArray(v) ? v as T[] : (v && typeof v === "object" ? Object.values(v as object) as T[] : []);

// Firebase elimina arrays vacíos: se restauran los campos que la app espera
function normalizar(list: unknown): ServicioRed[] {
  return arr<ServicioRed>(list).filter(Boolean).map(r => ({
    ...r,
    clienteNombre: r.clienteNombre || "", clienteTelefono: r.clienteTelefono || "", codigoCliente: r.codigoCliente || "",
    equipos: arr<EquipoRed>(r.equipos),
    bitacora: arr<BitacoraOrden>(r.bitacora),
    historial: arr<HistorialRed>(r.historial).map(h => ({ ...h, fotos: arr<ArchivoRed>(h.fotos), documentos: arr<ArchivoRed>(h.documentos) })),
    borrador: r.borrador ? {
      ...r.borrador,
      equipos: arr<EquipoRed>(r.borrador.equipos), fotosEquipos: arr<ArchivoRed>(r.borrador.fotosEquipos),
      fotosPrueba: arr<ArchivoRed>(r.borrador.fotosPrueba), fotosCierre: arr<ArchivoRed>(r.borrador.fotosCierre),
    } : undefined,
  }));
}
// Estilos por estado (tema claro)
const ESTADO_PILL: Record<EstadoOrden, string> = {
  asignada: "bg-violet-100 text-violet-700", reasignada: "bg-orange-100 text-orange-700", en_camino: "bg-sky-100 text-sky-700", en_espera: "bg-amber-100 text-amber-700",
  en_proceso: "bg-indigo-100 text-indigo-700", terminada: "bg-teal-100 text-teal-700", firmada: "bg-emerald-100 text-emerald-700",
};
const NAVY = "#1f2a7a";

// ─── Piezas de interfaz ──────────────────────────────────────────────────────
function Pill({ e }: { e: EstadoOrden }) {
  return <span className={`inline-block px-2.5 py-0.5 rounded-md text-[11px] font-semibold ${ESTADO_PILL[e]}`}>{ORDEN_LABEL[e]}</span>;
}

function useArchivoUrl(a: { data?: string; key?: string } | null | undefined): string {
  const [url, setUrl] = useState(a?.key ? "" : a?.data || "");
  useEffect(() => {
    let vivo = true;
    if (!a) { setUrl(""); return; }
    if (a.key) { setUrl(""); urlDe(a.key).then(u => vivo && setUrl(u)).catch(() => vivo && setUrl("")); }
    else setUrl(a.data || "");
    return () => { vivo = false; };
  }, [a?.key, a?.data]);
  return url;
}
function Foto({ a, className = "" }: { a: ArchivoRed; className?: string }) {
  const url = useArchivoUrl(a);
  return url
    ? <img src={url} alt={a.nombre} className={`object-cover ${className}`} />
    : <div className={`bg-slate-200 animate-pulse ${className}`} />;
}

function Stepper({ estado }: { estado: EstadoOrden }) {
  const { labels, actual: idx } = pasosDeOrden(estado);
  const reas = estado === "reasignada";
  const color = (i: number) => (reas && i === 1 ? "#ea8a0c" : NAVY);
  return (
    <div className="flex items-start px-1 pt-3 pb-2">
      {labels.map((label, i) => (
        <div key={label} className="flex-1 flex flex-col items-center relative min-w-0">
          {i > 0 && <div className="absolute top-[13px] right-1/2 w-full h-[2px]" style={{ background: i <= idx ? color(i) : "#dfe2ee" }} />}
          <div className="relative z-10 w-[27px] h-[27px] rounded-full flex items-center justify-center text-[12px] font-bold border-2"
            style={i <= idx ? { background: color(i), borderColor: color(i), color: "#fff" } : { background: "#eceef6", borderColor: "#eceef6", color: "#a4abc4" }}>
            {i < idx ? "✓" : i + 1}
          </div>
          <div className={`mt-1 text-[10px] leading-tight text-center px-0.5 ${i === idx ? "font-bold text-[#1f2a7a]" : "text-slate-500"}`}>{label}</div>
        </div>
      ))}
    </div>
  );
}

const card = "bg-white rounded-xl border border-[#e6e8f0] p-4";
const btnPrimary = "w-full py-3.5 rounded-full text-white font-bold text-base disabled:opacity-40 active:scale-[.99] transition";
const inputCls = "w-full bg-[#f6f7fb] border border-[#e1e4ef] rounded-lg px-3 py-3 text-base text-[#1c2340] focus:outline-none focus:border-[#1f2a7a]";
const labelCls = "block text-sm text-slate-600 mb-1";

// Galería de evidencia (cámara / galería) — sube a R2 al elegir cada foto
function Galeria({ items, onChange, max = 6, requerida = false, titulo = "Galería de evidencia", aviso }: {
  items: ArchivoRed[]; onChange: (v: ArchivoRed[]) => void; max?: number; requerida?: boolean; titulo?: string; aviso: (m: string) => void;
}) {
  const [ocupado, setOcupado] = useState(false);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  async function agregar(files: FileList | null) {
    if (!files || !files.length) return;
    if (itemsRef.current.length + files.length > max) { aviso(`Máximo ${max} fotos aquí`); return; }
    setOcupado(true);
    try {
      for (const f of Array.from(files)) {
        if (!f.type.startsWith("image/")) continue;
        const data = await comprimirImagen(f);
        let nuevo: ArchivoRed;
        try { nuevo = { id: uid(), nombre: f.name, data: "", key: await subirDataUrl(data, f.name.replace(/\.\w+$/, "") + ".jpg", `redes/adjuntos/${hoyLocal().slice(0, 7)}`) }; }
        catch { nuevo = { id: uid(), nombre: f.name, data }; aviso("Sin conexión al almacenamiento: la foto se guardó en este dispositivo"); }
        itemsRef.current = [...itemsRef.current, nuevo];
        onChange(itemsRef.current);
      }
    } finally { setOcupado(false); }
  }
  function quitar(a: ArchivoRed) {
    itemsRef.current = itemsRef.current.filter(x => x.id !== a.id);
    onChange(itemsRef.current);
    if (a.key) borrarArchivo(a.key);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-base text-[#1c2340]">{titulo} {requerida && <span className="text-red-500">*</span>}</span>
        <span className="text-sm text-slate-400">{items.length}/{max}</span>
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        {items.map(a => (
          <div key={a.id} className="relative aspect-square">
            <Foto a={a} className="w-full h-full rounded-xl border border-[#e1e4ef]" />
            <button onClick={() => quitar(a)} aria-label="Quitar foto"
              className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-white border border-slate-300 text-slate-600 text-sm leading-none shadow">×</button>
          </div>
        ))}
        {items.length < max && (
          <div className="aspect-square rounded-xl border-2 border-dashed flex overflow-hidden" style={{ borderColor: NAVY }}>
            <label className="flex-1 flex items-center justify-center text-2xl cursor-pointer active:bg-slate-100" title="Tomar foto">
              📷<input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => { agregar(e.target.files); e.target.value = ""; }} />
            </label>
            <div className="w-px bg-slate-200 my-4" />
            <label className="flex-1 flex items-center justify-center text-2xl cursor-pointer active:bg-slate-100" title="Elegir de la galería">
              🖼️<input type="file" accept="image/*" multiple className="hidden" onChange={e => { agregar(e.target.files); e.target.value = ""; }} />
            </label>
          </div>
        )}
      </div>
      {ocupado && <p className="text-xs text-slate-500 mt-1.5">Subiendo foto...</p>}
      {requerida && items.length === 0 && <p className="text-xs text-slate-400 mt-1.5">Agrega al menos una foto</p>}
    </div>
  );
}

// ─── Asistente de ejecución (4 procesos) ─────────────────────────────────────
const borradorVacio = (sv: ServicioRed): BorradorOrden => ({
  paso: 0, referencia: "", equipos: [{ id: uid(), modelo: "", cantidad: 1 }], fotosEquipos: [],
  conforme: true, observaciones: "", fotosPrueba: [], firmante: sv.clienteNombre, fotosCierre: [],
  firmaTecnicoAutorizada: (() => { try { return localStorage.getItem("zFirmaAut") === "1"; } catch { return false; } })(),
});

function FirmaAutPrev() {
  const [src, setSrc] = useState<string | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => { let a = true; firmaAutorizada().then(d => a && setSrc(d)).catch(() => a && setErr(true)); return () => { a = false; }; }, []);
  return (
    <div className="rounded-xl border border-[#e1e4ef] bg-white h-28 flex items-center justify-center">
      {src ? <img src={src} alt="Firma autorizada" className="max-h-[76px] max-w-full object-contain" />
        : <span className="text-sm text-slate-400">{err ? "No se pudo cargar la firma (¿sin conexión?)" : "Cargando firma..."}</span>}
    </div>
  );
}

function Asistente({ sv, perfilNombre, guardar, aviso, onTerminado }: {
  sv: ServicioRed; perfilNombre: string; guardar: (s: ServicioRed) => Promise<ServicioRed>; aviso: (m: string) => void;
  onTerminado: (s: ServicioRed, enlace?: string) => void;
}) {
  const [d, setD] = useState<BorradorOrden>(() => sv.borrador || borradorVacio(sv));
  const [ocupado, setOcupado] = useState(false);
  const dRef = useRef(d);
  dRef.current = d;
  const upd = (p: Partial<BorradorOrden>) => setD(prev => ({ ...prev, ...p }));

  const equiposValidos = d.equipos.filter(equipoCompleto);
  const hayIncompletos = d.equipos.some(equipoIncompleto);
  const razon = [
    () => (!d.fachada ? "Toma la foto de fachada o punto" : ""),
    () => (equiposValidos.length === 0 ? "Registra al menos un equipo con tipo, marca y modelo" : hayIncompletos ? "Hay un equipo a medias: complétalo o quítalo" : d.fotosEquipos.length === 0 ? "Agrega al menos una foto de los equipos" : ""),
    () => (d.fotosPrueba.length === 0 ? "Agrega al menos una foto de la prueba de funcionamiento" : ""),
    () => "",
  ][d.paso]();

  async function guardarAvance(siguiente: number) {
    const nuevo = { ...dRef.current, paso: siguiente };
    setD(nuevo);
    await guardar({ ...sv, borrador: nuevo });
  }

  async function finalizar(modo: "firma" | "enlace") {
    if (modo === "firma" && !d.firma) { aviso("Falta la firma del cliente"); return; }
    setOcupado(true);
    try {
      const ahora = new Date().toISOString();
      const ub = await capturarUbicacion(8000);
      const eqs: EquipoRed[] = equiposValidos.map(cerrarEquipo);
      const fotos = [...(d.fachada ? [d.fachada] : []), ...d.fotosEquipos, ...d.fotosPrueba, ...d.fotosCierre];
      let desc = buildDescTecnica(eqs, sv.ot || sv.id) || `Instalación de ${sv.tipoServicio}.`;
      if (d.referencia.trim()) desc += `\nReferencia del punto: ${d.referencia.trim()}`;
      if (d.observaciones.trim()) desc += `\n\nObservaciones: ${d.observaciones.trim()}`;
      if (!d.conforme) desc += `\n\nNota: el cliente indicó que NO quedó conforme.`;

      let firmaKey: string | undefined; let firmaB64: string | undefined;
      if (modo === "firma" && d.firma) {
        try { firmaKey = await subirDataUrl(d.firma, `firma-${sv.ot || sv.codigoCliente}.png`, `redes/${sv.codigoCliente}`); }
        catch { firmaB64 = d.firma; aviso("La firma se guardó en este dispositivo (sin conexión al almacenamiento)"); }
      }
      let firmaTecnicoKey: string | undefined; let firmaTecnicoB64: string | undefined;
      if (!d.firmaTecnicoAutorizada && d.firmaTecnico) {
        try { firmaTecnicoKey = await subirDataUrl(d.firmaTecnico, `firma-tecnico-${sv.ot || sv.codigoCliente}.png`, `redes/${sv.codigoCliente}`); }
        catch { firmaTecnicoB64 = d.firmaTecnico; }
      }
      const entry: HistorialRed = {
        id: uid(), fecha: hoyLocal(), tipo: "instalacion", tecnico: perfilNombre, descripcion: desc,
        ...(fotos.length ? { fotos } : {}),
        ...((ub || sv.tiempos?.llegada?.ubicacion) ? { ubicacion: ub || sv.tiempos?.llegada?.ubicacion } : {}),
        ...(modo === "firma" ? { ...(firmaKey ? { firmaKey } : { firma: firmaB64 }), firmante: d.firmante.trim() || sv.clienteNombre } : {}),
      };

      let enlace: string | undefined;
      if (modo === "enlace") {
        const { token, expiraEn } = await crearSolicitudFirma({
          codigo: sv.codigoCliente, ot: sv.ot, servicioId: sv.id, histId: entry.id, cliente: sv.clienteNombre, descripcion: desc,
          equipos: eqs.map(e => `${(e.cantidad || 1) > 1 ? e.cantidad + "x " : ""}${e.tipoEquipo && e.tipoEquipo !== "Otro" ? e.tipoEquipo + " " : ""}${e.marca} ${e.modelo}`),
          fotos: fotos.map(f => f.key).filter((k): k is string => !!k),
        });
        entry.firmaToken = token; entry.firmaTokenExp = expiraEn;
        enlace = urlEnlaceFirma(token);
      }

      const final: ServicioRed = {
        ...sv, equipos: eqs, historial: [...sv.historial, entry], estado: "activo", fechaInstalacion: hoyLocal(),
        tiempos: { ...sv.tiempos, fin: { fecha: ahora, ubicacion: ub || undefined } },
        estadoOrden: modo === "firma" ? "firmada" : "terminada", borrador: undefined,
        firmaTecnicoAut: d.firmaTecnicoAutorizada ? true : undefined,
        firmaTecnicoKey, firmaTecnico: firmaTecnicoB64,
      };
      const guardado = await guardar(final);
      onTerminado(guardado, enlace);
    } catch {
      aviso("No se pudo cerrar la orden. Revisa tu conexión e inténtalo de nuevo.");
    } finally { setOcupado(false); }
  }

  const NOMBRES = ["Verificación del punto", "Equipos instalados", "Prueba y conformidad", "Cierre y firma"];
  return (
    <div className={`${card} space-y-4`}>
      <div>
        <div className="text-xs font-bold tracking-wider" style={{ color: NAVY }}>PROCESO {d.paso + 1} DE 4</div>
        <div className="text-xl font-bold text-[#1c2340]">{NOMBRES[d.paso]}</div>
        <div className="flex gap-1.5 mt-2">{NOMBRES.map((_, i) => <div key={i} className="h-1.5 flex-1 rounded-full" style={{ background: i <= d.paso ? NAVY : "#e4e6f2" }} />)}</div>
      </div>

      {d.paso === 0 && (
        <>
          <Galeria titulo="Foto de fachada o punto" requerida max={1} aviso={aviso}
            items={d.fachada ? [d.fachada] : []} onChange={v => upd({ fachada: v[0] })} />
          <div>
            <label className={labelCls}>Ubicación o referencia</label>
            <input className={inputCls} value={d.referencia} onChange={e => upd({ referencia: e.target.value })} placeholder="Ej. casa esquina, portón negro" />
          </div>
        </>
      )}

      {d.paso === 1 && (
        <>
          {d.equipos.map(eq => (
            <EquipoEditor key={eq.id} tema="claro" eq={eq} puedeBorrar={d.equipos.length > 1}
              onChange={n => upd({ equipos: d.equipos.map(x => x.id === eq.id ? n : x) })}
              onDelete={() => upd({ equipos: d.equipos.filter(x => x.id !== eq.id) })} />
          ))}
          <button onClick={() => upd({ equipos: [...d.equipos, { id: uid(), modelo: "", cantidad: 1 }] })}
            className="w-full py-2.5 border-2 border-dashed rounded-xl font-semibold" style={{ borderColor: NAVY, color: NAVY }}>+ Agregar otro equipo</button>
          <Galeria requerida aviso={aviso} items={d.fotosEquipos} onChange={v => upd({ fotosEquipos: v })} />
        </>
      )}

      {d.paso === 2 && (
        <>
          <label className="flex items-center justify-between rounded-xl border border-[#e1e4ef] bg-[#f6f7fb] px-4 py-3.5 cursor-pointer">
            <span className="text-base text-[#1c2340]">¿Conforme? <span className="text-red-500">*</span></span>
            <input type="checkbox" checked={d.conforme} onChange={e => upd({ conforme: e.target.checked })} className="w-6 h-6" style={{ accentColor: NAVY }} />
          </label>
          <div>
            <label className={labelCls}>Observaciones</label>
            <textarea className={inputCls} rows={3} maxLength={500} value={d.observaciones} onChange={e => upd({ observaciones: e.target.value })} placeholder="Ej. Todo ok, se probó la grabación" />
            <div className="text-right text-xs text-slate-400">{d.observaciones.length}/500</div>
          </div>
          <Galeria titulo="Prueba de video / funcionamiento" requerida aviso={aviso} items={d.fotosPrueba} onChange={v => upd({ fotosPrueba: v })} />
        </>
      )}

      {d.paso === 3 && (
        <>
          <div>
            <label className={labelCls}>Nombre de quien recibe</label>
            <input className={inputCls} value={d.firmante} onChange={e => upd({ firmante: e.target.value })} />
          </div>
          <div>
            <div className="text-base text-[#1c2340] mb-1.5">Firma de conformidad <span className="text-red-500">*</span></div>
            <SignaturePad value={d.firma || null} onChange={v => upd({ firma: v || undefined })} />
          </div>
          <div>
            <div className="text-base text-[#1c2340] mb-1.5">Firma del técnico</div>
            <label className="flex items-center justify-between rounded-xl border border-[#e1e4ef] bg-[#f6f7fb] px-4 py-3 cursor-pointer mb-2">
              <span className="text-base text-[#1c2340]">Firma autorizada <span className="text-xs text-slate-400">(usar mi firma registrada)</span></span>
              <input type="checkbox" checked={!!d.firmaTecnicoAutorizada} onChange={e => { upd({ firmaTecnicoAutorizada: e.target.checked }); try { localStorage.setItem("zFirmaAut", e.target.checked ? "1" : "0"); } catch { /* */ } }} className="w-6 h-6" style={{ accentColor: NAVY }} />
            </label>
            {d.firmaTecnicoAutorizada
              ? <FirmaAutPrev />
              : <SignaturePad value={d.firmaTecnico || null} onChange={v => upd({ firmaTecnico: v || undefined })} />}
          </div>
          <Galeria titulo="Fotos del cierre (opcional)" aviso={aviso} items={d.fotosCierre} onChange={v => upd({ fotosCierre: v })} />
        </>
      )}

      {razon && <p className="text-sm text-slate-500 text-center">{razon}</p>}

      {d.paso < 3 ? (
        <div className="flex items-center gap-3 pt-1">
          <button disabled={d.paso === 0 || ocupado} onClick={() => guardarAvance(d.paso - 1)} className="px-4 py-3 font-semibold text-sky-600 disabled:text-slate-300">Atrás</button>
          <button disabled={!!razon || ocupado} onClick={() => guardarAvance(d.paso + 1)} className={btnPrimary} style={{ background: NAVY }}>Siguiente</button>
        </div>
      ) : (
        <div className="space-y-2.5 pt-1">
          <button disabled={ocupado || !d.firma} onClick={() => finalizar("firma")} className={btnPrimary} style={{ background: "#2f9e5b" }}>
            {ocupado ? "Cerrando orden..." : "Terminar y firmar"}
          </button>
          <button disabled={ocupado} onClick={() => finalizar("enlace")}
            className="w-full py-3 rounded-full font-semibold border-2 disabled:opacity-40" style={{ borderColor: NAVY, color: NAVY }}>
            📲 El cliente no está: enviar enlace de firma
          </button>
          <button disabled={ocupado} onClick={() => guardarAvance(2)} className="w-full py-2 font-semibold text-sky-600">Atrás</button>
        </div>
      )}
    </div>
  );
}

function Bitacora({ sv, perfilNombre, guardar }: { sv: ServicioRed; perfilNombre: string; guardar: (s: ServicioRed) => Promise<ServicioRed> }) {
  const [t, setT] = useState("");
  const [busy, setBusy] = useState(false);
  const notas = sv.bitacora || [];
  async function agregar() {
    const texto = t.trim();
    if (!texto) return;
    setBusy(true);
    try {
      await guardar({ ...sv, bitacora: [...notas, { id: uid(), fecha: new Date().toISOString(), texto, autor: perfilNombre, tipo: "nota" }] });
      setT("");
    } finally { setBusy(false); }
  }
  return (
    <div className={`${card} space-y-2.5`}>
      <div className="font-bold text-[#1c2340]">📝 Observaciones de la orden</div>
      <p className="text-xs text-slate-500">Anota cualquier inconveniente o cambio con el propietario. Se guarda con fecha y hora.</p>
      {notas.map(n => (
        <div key={n.id} className="border-l-2 border-[#d8dcec] pl-2.5">
          <div className="text-[11px] text-slate-400">{new Date(n.fecha).toLocaleString("es-GT", { dateStyle: "short", timeStyle: "short" })}{n.autor ? ` · ${n.autor}` : ""}{n.tipo && n.tipo !== "nota" ? ` · ${n.tipo === "reasignacion" ? "reasignación" : "estado"}` : ""}</div>
          <div className="text-[15px] text-[#1c2340] whitespace-pre-wrap">{n.texto}</div>
        </div>
      ))}
      <textarea className={inputCls} rows={2} maxLength={500} value={t} onChange={e => setT(e.target.value)} placeholder="Ej. El propietario pidió mover las cámaras a otro punto" />
      <button disabled={busy || !t.trim()} onClick={agregar} className={btnPrimary} style={{ background: NAVY }}>{busy ? "Guardando..." : "Agregar observación"}</button>
    </div>
  );
}

// ─── Detalle de la orden ─────────────────────────────────────────────────────
function Acciones({ icono, label, href, color }: { icono: string; label: string; href: string; color: string }) {
  return (
    <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer" aria-label={label} title={label}
      className="w-12 h-12 rounded-xl flex items-center justify-center text-xl text-white shadow-sm active:scale-95" style={{ background: color }}>{icono}</a>
  );
}

function Detalle({ sv, cot, perfilNombre, guardar, aviso, onBack, hidratar }: {
  sv: ServicioRed; cot?: Cotizacion; perfilNombre: string; guardar: (s: ServicioRed) => Promise<ServicioRed>; aviso: (m: string) => void;
  onBack: () => void; hidratar: (s: ServicioRed) => Promise<ServicioRed>;
}) {
  const estado = sv.estadoOrden as EstadoOrden;
  const [busy, setBusy] = useState(false);
  const [enlace, setEnlace] = useState<string | null>(null);
  const [verDetalles, setVerDetalles] = useState(true);
  const wa = sv.clienteWhatsapp || sv.clienteTelefono;
  const tel = sv.clienteTelefono || sv.clienteWhatsapp;
  const entradaFinal = [...sv.historial].reverse().find(h => h.tipo === "instalacion");

  async function avanzar(sig: EstadoOrden, clave: "camino" | "llegada" | "inicio") {
    setBusy(true);
    try {
      const ub = await capturarUbicacion(8000);
      if (!ub) aviso("No se obtuvo la ubicación (revisa el permiso). Se registró la hora.");
      await guardar({
        ...sv, estadoOrden: sig,
        tiempos: { ...sv.tiempos, [clave]: { fecha: new Date().toISOString(), ubicacion: ub || undefined } },
        ...(sig === "en_proceso" ? { borrador: sv.borrador || borradorVacio(sv) } : {}),
      });
    } finally { setBusy(false); }
  }

  async function pedirEnlace() {
    if (!entradaFinal) return;
    setBusy(true);
    try {
      const { token, expiraEn } = await crearSolicitudFirma({
        codigo: sv.codigoCliente, ot: sv.ot, servicioId: sv.id, histId: entradaFinal.id, cliente: sv.clienteNombre, descripcion: entradaFinal.descripcion,
        equipos: sv.equipos.map(e => `${(e.cantidad || 1) > 1 ? e.cantidad + "x " : ""}${e.marca || ""} ${e.modelo}`.trim()),
        fotos: (entradaFinal.fotos || []).map(f => f.key).filter((k): k is string => !!k),
      });
      await guardar({ ...sv, historial: sv.historial.map(h => h.id === entradaFinal.id ? { ...h, firmaToken: token, firmaTokenExp: expiraEn } : h) });
      setEnlace(urlEnlaceFirma(token));
    } catch { aviso("No se pudo crear el enlace. Revisa tu conexión."); }
    finally { setBusy(false); }
  }

  async function pdf() {
    setBusy(true);
    try { await descargarPdfServicioRed(await hidratar(sv)); } catch { aviso("No se pudo generar el PDF"); }
    finally { setBusy(false); }
  }

  const tokenVigente = entradaFinal?.firmaToken && entradaFinal.firmaTokenExp && new Date(entradaFinal.firmaTokenExp).getTime() > Date.now();
  const fecha = sv.fechaProgramada ? new Date(sv.fechaProgramada).toLocaleString("es-GT", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : sv.fechaInstalacion;

  return (
    <div className="space-y-3 pb-28">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="md:hidden w-9 h-9 flex items-center justify-center text-2xl text-[#1f2a7a]" aria-label="Volver">‹</button>
        <div className="font-bold text-[#1c2340] text-lg">Orden <span className="text-[#2f9e5b]">OT-{sv.ot}</span></div>
      </div>

      <div className={card}><Stepper estado={estado} /></div>

      {/* Acción principal según el estado */}
      {(estado === "asignada" || estado === "reasignada") && <button disabled={busy} onClick={() => avanzar("en_camino", "camino")} className={btnPrimary} style={{ background: NAVY }}>{busy ? "Obteniendo ubicación..." : "🚗 Voy en camino"}</button>}
      {estado === "en_camino" && <button disabled={busy} onClick={() => avanzar("en_espera", "llegada")} className={btnPrimary} style={{ background: NAVY }}>{busy ? "Obteniendo ubicación..." : "📍 Llegué al sitio"}</button>}
      {estado === "en_espera" && <button disabled={busy} onClick={() => avanzar("en_proceso", "inicio")} className={btnPrimary} style={{ background: "#2f9e5b" }}>{busy ? "Iniciando..." : "▶ Iniciar trabajo"}</button>}
      {estado === "en_proceso" && <Asistente sv={sv} perfilNombre={perfilNombre} guardar={guardar} aviso={aviso} onTerminado={(_s, e) => { if (e) setEnlace(e); }} />}

      {estado === "terminada" && (
        <div className={`${card} space-y-3`}>
          <div className="font-bold text-[#1c2340]">⏳ Esperando la firma del cliente</div>
          <p className="text-sm text-slate-600">El trabajo quedó registrado. Cuando el cliente firme desde el enlace, la orden pasa a «Firmada» sola.</p>
          {tokenVigente
            ? <button onClick={() => setEnlace(urlEnlaceFirma(entradaFinal!.firmaToken!))} className={btnPrimary} style={{ background: NAVY }}>Ver / compartir enlace de firma</button>
            : <button disabled={busy} onClick={pedirEnlace} className={btnPrimary} style={{ background: NAVY }}>📲 Crear enlace de firma</button>}
        </div>
      )}

      {estado === "firmada" && entradaFinal && (
        <div className={`${card} space-y-3`}>
          <div className="font-bold text-emerald-700">✅ Orden cerrada y firmada</div>
          {entradaFinal.firmante && <p className="text-sm text-slate-600">Recibió: {entradaFinal.firmante}</p>}
          {(entradaFinal.fotos || []).length > 0 && (
            <div className="grid grid-cols-4 gap-2">{(entradaFinal.fotos || []).slice(0, 8).map(f => <Foto key={f.id} a={f} className="aspect-square w-full rounded-lg" />)}</div>
          )}
          <button disabled={busy} onClick={pdf} className={btnPrimary} style={{ background: NAVY }}>{busy ? "Generando..." : "⬇ Descargar PDF"}</button>
        </div>
      )}
      {ORDEN_PERMITE_BITACORA.includes(estado) && <Bitacora sv={sv} perfilNombre={perfilNombre} guardar={guardar} />}

      {estado === "terminada" && entradaFinal && (
        <button disabled={busy} onClick={pdf} className="w-full py-3 rounded-full font-semibold border-2" style={{ borderColor: NAVY, color: NAVY }}>⬇ Descargar PDF (sin firma)</button>
      )}

      <button onClick={() => setVerDetalles(v => !v)} className="w-full text-left text-sm font-semibold text-slate-500 px-1">
        {verDetalles ? "▾" : "▸"} Detalles de la orden
      </button>

      {verDetalles && (
        <>
          <div className={card}>
            <div className="text-sm font-bold text-[#1c2340] mb-2">Dirección del servicio</div>
            <div className="flex items-start justify-between gap-3">
              <div className="text-[15px] text-[#1c2340]">{sv.direccion || "Sin dirección registrada"}</div>
              {sv.direccion && (
                <a href={comoLlegarUrl(sv.direccion)} target="_blank" rel="noopener noreferrer"
                  className="shrink-0 px-3.5 py-2 rounded-full text-white text-sm font-semibold" style={{ background: NAVY }}>🧭 Cómo llegar</a>
              )}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-y-1 text-sm">
              <span className="text-slate-500">Tipo de orden</span><span className="text-right text-[#1c2340]">{sv.tipoServicio}</span>
              <span className="text-slate-500">Fecha y hora</span><span className="text-right text-[#1c2340]">{fecha}</span>
              <span className="text-slate-500">Estado</span><span className="text-right"><Pill e={estado} /></span>
            </div>
            {sv.notasOrden && <div className="mt-3 text-sm bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-amber-900">📝 {sv.notasOrden}</div>}
          </div>

          <div className={card}>
            <div className="text-sm font-bold text-[#1c2340] mb-2">Cliente</div>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold text-[#1c2340] truncate">{sv.clienteNombre}</div>
                <div className="text-sm text-slate-500">{sv.clienteTelefono}{sv.clienteWhatsapp && sv.clienteWhatsapp !== sv.clienteTelefono ? ` · WhatsApp ${sv.clienteWhatsapp}` : ""}</div>
              </div>
              <div className="flex gap-2 shrink-0">
                {wa && telDigitos(wa) && <Acciones icono="💬" label="WhatsApp" color="#25a244" href={waUrl(wa, `Hola ${sv.clienteNombre}, le escribe su técnico de Zento Data sobre la orden OT-${sv.ot}.`)} />}
                {tel && telDigitos(tel) && <Acciones icono="✉️" label="Mensaje SMS" color="#3b6fe0" href={`sms:+${telDigitos(tel)}`} />}
                {tel && telDigitos(tel) && <Acciones icono="📞" label="Llamar" color="#25a244" href={`tel:+${telDigitos(tel)}`} />}
              </div>
            </div>
          </div>

          <div className={card}>
            <div className="text-sm font-bold text-[#1c2340] mb-1">Técnico asignado</div>
            <div className="text-[15px] text-[#1c2340]">{sv.tecnicoAsignado || perfilNombre}</div>
          </div>

          <div className={card}>
            <div className="text-sm font-bold text-[#1c2340] mb-2">Servicios y productos {cot && <span className="font-mono font-normal text-slate-400">· {cot.id}</span>}</div>
            {!cot ? <p className="text-sm text-slate-400">Esta orden no tiene una cotización vinculada.</p> : (
              <div className="space-y-2.5">
                {cot.items.map(it => (
                  <div key={it.id} className="flex items-start justify-between gap-3 border-b border-[#f0f1f7] pb-2 last:border-0">
                    <div className="min-w-0">
                      <div className="text-[15px] font-medium text-[#1c2340]">{it.nombre}</div>
                      <div className="text-xs text-slate-500">{it.qty} srv. x {fmtQ(it.precio)}</div>
                      {it.desc && <div className="text-xs text-slate-400 whitespace-pre-line">{it.desc}</div>}
                    </div>
                    <div className="text-[15px] text-[#1c2340] shrink-0">{fmtQ(it.qty * it.precio)}</div>
                  </div>
                ))}
                <div className="flex justify-between text-sm text-slate-600"><span>Sub Total</span><span>{fmtQ(cot.subtotal)}</span></div>
                {!!cot.descuentoMonto && <div className="flex justify-between text-sm text-slate-600"><span>Descuento</span><span>- {fmtQ(cot.descuentoMonto)}</span></div>}
                {!!cot.ivaMonto && <div className="flex justify-between text-sm text-slate-600"><span>IVA</span><span>{fmtQ(cot.ivaMonto)}</span></div>}
                <div className="flex justify-between font-bold text-[#1c2340]"><span>Total</span><span>{fmtQ(cot.total)}</span></div>
              </div>
            )}
          </div>

          {sv.tiempos && (
            <div className={card}>
              <div className="text-sm font-bold text-[#1c2340] mb-2">Registro de tiempos</div>
              <div className="space-y-1 text-sm">
                {(["camino", "llegada", "inicio", "fin"] as const).filter(k => sv.tiempos?.[k]).map(k => {
                  const t = sv.tiempos![k]!;
                  return (
                    <div key={k} className="flex justify-between">
                      <span className="text-slate-500">{{ camino: "Salió", llegada: "Llegó", inicio: "Inició", fin: "Terminó" }[k]}</span>
                      <span className="text-[#1c2340]">{new Date(t.fecha).toLocaleString("es-GT", { dateStyle: "short", timeStyle: "short" })}
                        {t.ubicacion && <> · <a className="text-sky-600" href={mapaUrl(t.ubicacion)} target="_blank" rel="noopener noreferrer">📍</a></>}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {enlace && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end md:items-center justify-center p-3" onClick={e => e.target === e.currentTarget && setEnlace(null)}>
          <div className="w-full max-w-md bg-white rounded-2xl p-5 space-y-3">
            <div className="font-bold text-lg text-[#1c2340]">Enlace de firma del cliente</div>
            <p className="text-sm text-slate-600">Envíalo a {sv.clienteNombre}. Al firmar desde su celular, la firma se agrega sola a la orden. Válido 7 días, de un solo uso.</p>
            <input readOnly value={enlace} onFocus={e => e.currentTarget.select()} className="w-full bg-[#f6f7fb] border border-[#e1e4ef] rounded-lg px-3 py-2 text-xs font-mono" />
            <div className="grid grid-cols-2 gap-2">
              <button className="py-3 rounded-xl font-semibold text-white" style={{ background: NAVY }}
                onClick={async () => { try { await navigator.clipboard.writeText(enlace); aviso("Enlace copiado"); } catch { aviso("Selecciona el enlace y cópialo"); } }}>📋 Copiar</button>
              <a className="py-3 rounded-xl font-semibold text-white text-center bg-[#25a244]" target="_blank" rel="noopener noreferrer"
                href={waUrl(wa || "", `Hola ${sv.clienteNombre}, por favor firma el acta de entrega de tu servicio (OT-${sv.ot}) aquí: ${enlace}`)}>💬 WhatsApp</a>
            </div>
            <button onClick={() => setEnlace(null)} className="w-full py-2 text-slate-500 font-semibold">Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Panel principal (sesión iniciada) ───────────────────────────────────────
export function Panel({ perfilNombre, onLogout, offlineDemo = false }: { perfilNombre: string; onLogout: () => void; offlineDemo?: boolean }) {
  const [redes, setRedes] = useState<ServicioRed[]>(() => normalizar(lsGet("zRedes", [])));
  const [cots, setCots] = useState<Cotizacion[]>(() => arr<Cotizacion>(lsGet("zCotizaciones", [])));
  const [sel, setSel] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState<"pendientes" | "finalizadas" | "todas">("pendientes");
  const [tab, setTab] = useState<"ordenes" | "cuenta">("ordenes");
  const [toast, setToast] = useState("");
  const [instalable, setInstalable] = useState<{ prompt: () => Promise<void> } | null>(null);
  const redesRef = useRef(redes);
  redesRef.current = redes;

  const aviso = useCallback((m: string) => { setToast(m); setTimeout(() => setToast(""), 3500); }, []);

  useEffect(() => {
    const h = (e: Event) => { e.preventDefault(); setInstalable({ prompt: async () => { await (e as unknown as { prompt: () => Promise<void> }).prompt(); } }); };
    window.addEventListener("beforeinstallprompt", h);
    return () => window.removeEventListener("beforeinstallprompt", h);
  }, []);

  // Trae lo último de la nube (cada 30 s)
  useEffect(() => {
    if (offlineDemo) return;
    let activo = true;
    const refrescar = async () => {
      try {
        const c = await fetchCloud<ServicioRed[]>("zRedes");
        if (activo && c) { const next = mezclarRedes(redesRef.current, normalizar(c), { soloNube: true }); setRedes(next); lsSet("zRedes", next); }
        const cc = await fetchCloud<Cotizacion[]>("zCotizaciones");
        if (activo && cc) { const lista = arr<Cotizacion>(cc); setCots(lista); lsSet("zCotizaciones", lista); }
      } catch { /* sin conexión */ }
    };
    refrescar();
    const t = setInterval(refrescar, 30000);
    return () => { activo = false; clearInterval(t); };
  }, [offlineDemo]);

  // Cuando el cliente firma desde el enlace, pasa la firma a la orden
  useEffect(() => {
    if (offlineDemo) return;
    const pend = redes.flatMap(r => r.historial.filter(h => h.firmaToken && !h.firmaKey && !h.firma).map(h => h.firmaToken as string));
    if (!pend.length) return;
    let activo = true;
    const revisar = async () => {
      try {
        const { estados } = await estadoFirmas(pend);
        if (!activo || !Object.values(estados).some(e => e.firmado && e.firmaKey)) return;
        const next = redesRef.current.map(r => {
          const historial = r.historial.map(h => {
            const e = h.firmaToken ? estados[h.firmaToken] : undefined;
            if (!e?.firmado || !e.firmaKey || h.firmaKey) return h;
            return { ...h, firmaKey: e.firmaKey, firmante: e.firmante || r.clienteNombre, firmaToken: undefined, firmaTokenExp: undefined };
          });
          if (!historial.some((h, i) => h !== r.historial[i])) return r;
          return { ...r, historial, ultimaModificacion: new Date().toISOString(), ...(r.estadoOrden === "terminada" ? { estadoOrden: "firmada" as EstadoOrden } : {}) };
        });
        setRedes(next); lsSet("zRedes", next); persist("zRedes", next);
        aviso("✅ El cliente firmó el acta");
      } catch { /* se reintenta */ }
    };
    revisar();
    const t = setInterval(revisar, 20000);
    return () => { activo = false; clearInterval(t); };
  }, [redes, offlineDemo, aviso]);

  // Guarda un servicio sin pisar lo que se haya cambiado en otro dispositivo
  const guardar = useCallback(async (upd: ServicioRed): Promise<ServicioRed> => {
    const nuevo = { ...upd, ultimaModificacion: new Date().toISOString() };
    let base = redesRef.current;
    if (!offlineDemo) { try { const c = await fetchCloud<ServicioRed[]>("zRedes"); if (c) base = mezclarRedes(base, normalizar(c), { soloNube: true, conservar: nuevo.id }); } catch { /* usa lo local */ } }
    const next = base.some(r => r.id === nuevo.id) ? base.map(r => r.id === nuevo.id ? nuevo : r) : [nuevo, ...base];
    setRedes(next); redesRef.current = next; lsSet("zRedes", next);
    if (!offlineDemo) persist("zRedes", next);
    return nuevo;
  }, [offlineDemo]);

  const hidratar = useCallback(async (s: ServicioRed): Promise<ServicioRed> => ({
    ...s,
    historial: await Promise.all(s.historial.map(async h => ({
      ...h,
      fotos: await Promise.all((h.fotos || []).map(async f => ({ ...f, data: await dataUrlDe(f) }))),
      firma: h.firmaKey ? await dataUrlDe({ key: h.firmaKey }) : h.firma,
    }))),
    firmaTecnico: s.firmaTecnicoAut ? await firmaAutorizada().catch(() => undefined)
      : s.firmaTecnicoKey ? await dataUrlDe({ key: s.firmaTecnicoKey }).catch(() => undefined) : s.firmaTecnico,
  }), []);

  const ordenes = redes.filter(r => r.estadoOrden)
    .filter(r => filtro === "todas" || (filtro === "pendientes" ? r.estadoOrden !== "firmada" : r.estadoOrden === "firmada"))
    .filter(r => !q || `${r.ot} ${r.clienteNombre} ${r.tipoServicio}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (b.fechaProgramada || b.fechaInstalacion || "").localeCompare(a.fechaProgramada || a.fechaInstalacion || ""));

  const mesActual = new Date().toISOString().slice(0, 7);
  const grupos: { titulo: string; items: ServicioRed[] }[] = [];
  for (const o of ordenes) {
    const f = (o.fechaProgramada || o.fechaInstalacion || "").slice(0, 7);
    const titulo = f === mesActual ? "Este mes" : f ? new Date(f + "-15").toLocaleDateString("es-GT", { month: "long", year: "numeric" }) : "Sin fecha";
    const g = grupos.find(x => x.titulo === titulo);
    if (g) g.items.push(o); else grupos.push({ titulo, items: [o] });
  }

  const actual = sel ? redes.find(r => r.id === sel) : undefined;
  const cotActual = actual?.cotizacionId ? cots.find(c => c.id === actual.cotizacionId) : undefined;
  const pendientes = redes.filter(r => r.estadoOrden && r.estadoOrden !== "firmada").length;

  const lista = (
    <div className="space-y-3">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {([["pendientes", "Pendientes"], ["finalizadas", "Finalizadas"], ["todas", "Todas"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setFiltro(k)} className={`px-3.5 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap border ${filtro === k ? "text-white border-transparent" : "bg-white text-slate-600 border-[#e1e4ef]"}`}
            style={filtro === k ? { background: NAVY } : undefined}>{l}</button>
        ))}
      </div>
      {grupos.length === 0 && (
        <div className={`${card} text-center text-slate-500 text-sm py-10`}>
          {redes.some(r => r.estadoOrden) ? "No hay órdenes en este filtro." : "Aún no tienes órdenes. Las crea el CRM con «Nueva orden»."}
        </div>
      )}
      {grupos.map(g => (
        <div key={g.titulo}>
          <div className="text-sm font-bold text-[#1c2340] mb-1.5 capitalize">{g.titulo}</div>
          <div className="space-y-2.5">
            {g.items.map(o => (
              <button key={o.id} onClick={() => setSel(o.id)}
                className={`w-full text-left bg-white rounded-xl border p-3.5 shadow-sm active:scale-[.99] ${sel === o.id ? "border-[#1f2a7a]" : "border-[#e6e8f0]"}`}>
                <div className="font-bold text-[#2f9e5b] mb-1">OT-{o.ot}</div>
                <div className="grid grid-cols-[110px_1fr] gap-y-1 text-[13px]">
                  <span className="text-slate-500">Estado</span><span><Pill e={o.estadoOrden as EstadoOrden} /></span>
                  <span className="text-slate-500">Tipo de orden</span><span className="text-[#1c2340]">{o.tipoServicio}</span>
                  <span className="text-slate-500">Fecha y hora</span>
                  <span className="text-[#1c2340]">{o.fechaProgramada ? new Date(o.fechaProgramada).toLocaleString("es-GT", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : o.fechaInstalacion}</span>
                  <span className="text-slate-500">Cliente</span><span className="text-[#1c2340] truncate">{o.clienteNombre}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  const cuenta = (
    <div className="space-y-3">
      <div className={card}>
        <div className="text-sm text-slate-500">Sesión</div>
        <div className="font-bold text-[#1c2340] text-lg">{perfilNombre}</div>
      </div>
      {instalable && <button onClick={() => instalable.prompt()} className={btnPrimary} style={{ background: NAVY }}>⬇ Instalar Zento Técnico</button>}
      <div className={`${card} text-sm text-slate-600`}>
        <b>Instalar en el celular:</b> en Chrome (Android) usa el menú ⋮ → «Instalar app». En iPhone (Safari): Compartir → «Agregar a pantalla de inicio».
      </div>
      <button onClick={onLogout} className="w-full py-3 rounded-full font-semibold border-2 border-red-300 text-red-600">Cerrar sesión</button>
    </div>
  );

  return (
    <div className="min-h-full bg-[#f2f3f8] text-[#1c2340]" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      <header className="sticky top-0 z-30 bg-white border-b border-[#e6e8f0]">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="font-bold text-lg" style={{ color: NAVY }}>{tab === "cuenta" ? "Cuenta" : sel && !actual ? "Órdenes" : "Órdenes"}
            {pendientes > 0 && <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 align-middle">{pendientes} pendiente{pendientes > 1 ? "s" : ""}</span>}</div>
          <div className="hidden md:flex items-center gap-3 text-sm text-slate-500">{perfilNombre}
            <button onClick={onLogout} className="text-red-500 font-semibold">Salir</button></div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-3">
        {tab === "cuenta" ? cuenta : (
          <div className="md:grid md:grid-cols-[360px_1fr] md:gap-5">
            <div className={`${actual ? "hidden md:block" : ""}`}>
              <div className="relative mb-3">
                <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar órdenes..." className="w-full bg-white border border-[#e1e4ef] rounded-xl pl-9 pr-3 py-2.5 text-[15px] focus:outline-none focus:border-[#1f2a7a]" />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
              </div>
              {lista}
            </div>
            <div className={`${actual ? "" : "hidden md:block"}`}>
              {actual && actual.estadoOrden
                ? <Detalle key={actual.id} sv={actual} cot={cotActual} perfilNombre={perfilNombre} guardar={guardar} aviso={aviso} onBack={() => setSel(null)} hidratar={hidratar} />
                : <div className="hidden md:flex items-center justify-center text-slate-400 text-sm h-64">Selecciona una orden para ver el detalle</div>}
            </div>
          </div>
        )}
      </main>

      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-[#e6e8f0] grid grid-cols-2" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        {([["ordenes", "📋", "Órdenes"], ["cuenta", "👤", "Cuenta"]] as const).map(([k, i, l]) => (
          <button key={k} onClick={() => { setTab(k); if (k === "ordenes") setSel(null); }} className={`py-2.5 flex flex-col items-center text-[11px] font-semibold ${tab === k ? "text-[#2f9e5b]" : "text-slate-400"}`}>
            <span className="text-xl leading-none">{i}</span>{l}
          </button>
        ))}
      </nav>
      <button className="hidden md:block fixed bottom-4 right-4" onClick={() => setTab(tab === "cuenta" ? "ordenes" : "cuenta")}>
        <span className="px-3 py-1.5 rounded-full bg-white border border-[#e1e4ef] text-xs text-slate-500">{tab === "cuenta" ? "Volver a órdenes" : "Cuenta"}</span>
      </button>

      {toast && <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#1c2340] text-white text-sm px-4 py-2.5 rounded-xl shadow-lg max-w-[90vw] text-center">{toast}</div>}
    </div>
  );
}

// ─── Entrada: inicio de sesión ───────────────────────────────────────────────
export default function TecnicoApp() {
  const [user, setUser] = useState<FbUser | null>(null);
  const [perfil, setPerfil] = useState<{ nombre: string } | null>(null);
  const [revisando, setRevisando] = useState(true);
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [entrando, setEntrando] = useState(false);
  const configurado = !!getFbUrl();

  useEffect(() => {
    if (!configurado) { setRevisando(false); return; }
    return onAuthChange(async u => {
      if (!u) { setUser(null); setPerfil(null); setRevisando(false); return; }
      const p = await getUserProfile<{ nombre: string; activo: boolean }>(u.uid);
      if (!p || !p.activo) { setErr("Tu usuario no está activo. Contacta al administrador."); await signOutFb().catch(() => {}); setRevisando(false); return; }
      setUser(u); setPerfil({ nombre: p.nombre }); setRevisando(false);
    });
  }, [configurado]);

  async function entrar(e: React.FormEvent) {
    e.preventDefault(); setErr(""); setEntrando(true);
    try { await signInEmail(email.trim(), pass); }
    catch (x) {
      const code = (x as { code?: string }).code || "";
      setErr(code.includes("invalid") || code.includes("wrong") || code.includes("user-not-found") ? "Correo o contraseña incorrectos." : "No se pudo iniciar sesión. Revisa tu conexión.");
    } finally { setEntrando(false); }
  }

  if (user && perfil) return <Panel perfilNombre={perfil.nombre} onLogout={() => signOutFb()} />;

  return (
    <div className="min-h-full flex items-center justify-center p-5 bg-[#f2f3f8]" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      <div className="w-full max-w-sm bg-white rounded-2xl border border-[#e6e8f0] p-6 space-y-4 shadow-sm">
        <div className="text-center">
          <img src="/icons/web-app-manifest-192x192.png" alt="" className="w-16 h-16 rounded-2xl mx-auto mb-2" />
          <div className="text-xl font-bold" style={{ color: NAVY }}>Zento Técnico</div>
          <div className="text-sm text-slate-500">Órdenes de trabajo</div>
        </div>
        {!configurado ? (
          <p className="text-sm text-slate-600 text-center">Esta app comparte la conexión del sistema principal. Abre primero <a className="text-sky-600 underline" href="/">el CRM</a> en este dispositivo, inicia sesión una vez y vuelve aquí.</p>
        ) : revisando ? <p className="text-center text-slate-500 text-sm">Comprobando sesión...</p> : (
          <form onSubmit={entrar} className="space-y-3">
            <div><label className={labelCls}>Correo</label><input className={inputCls} type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required /></div>
            <div><label className={labelCls}>Contraseña</label><input className={inputCls} type="password" autoComplete="current-password" value={pass} onChange={e => setPass(e.target.value)} required /></div>
            {err && <p className="text-sm text-red-600">{err}</p>}
            <button disabled={entrando} className={btnPrimary} style={{ background: NAVY }}>{entrando ? "Entrando..." : "Iniciar sesión"}</button>
          </form>
        )}
      </div>
    </div>
  );
}

export type { UbicacionRed };
