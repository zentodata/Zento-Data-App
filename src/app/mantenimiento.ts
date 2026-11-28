// Lógica de la agenda de mantenimientos y garantías (se alimenta sola de los servicios de Redes).
import type { ServicioRed, Mant } from "@/app/App";

export const GARANTIA_DEFAULT_MESES = 12;
export const FRECUENCIA_DEFAULT_DIAS = 180;

const aFecha = (d: Date) => d.toISOString().slice(0, 10);
export const hoyStr = () => new Date().toLocaleDateString("sv-SE");
/** Días enteros desde hoy (negativo = vencido), comparando solo fechas (sin horas) */
export function diasHasta(fecha: string): number {
  const a = new Date(hoyStr() + "T00:00:00Z").getTime(), b = new Date(fecha.slice(0, 10) + "T00:00:00Z").getTime();
  return Math.round((b - a) / 86400000);
}
export function sumarDias(fecha: string, dias: number): string { const d = new Date(fecha.slice(0, 10) + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + dias); return aFecha(d); }
export function sumarMeses(fecha: string, meses: number): string {
  const d = new Date(fecha.slice(0, 10) + "T00:00:00Z"); const dia = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + meses); if (d.getUTCDate() !== dia) d.setUTCDate(0);
  return aFecha(d);
}

export type GrupoAgenda = "vencido" | "semana" | "mes" | "despues" | "sin_programar";
export const GRUPOS: { id: GrupoAgenda; label: string; cls: string }[] = [
  { id: "vencido", label: "🔴 Vencidos", cls: "text-red-300" },
  { id: "semana", label: "🟠 Esta semana (7 días)", cls: "text-amber-300" },
  { id: "mes", label: "🟡 Este mes (30 días)", cls: "text-yellow-200" },
  { id: "despues", label: "🟢 Más adelante", cls: "text-emerald-300" },
  { id: "sin_programar", label: "⚪ Sin mantenimiento programado", cls: "text-[#8090a8]" },
];
export const grupoDe = (dias: number): GrupoAgenda => (dias < 0 ? "vencido" : dias <= 7 ? "semana" : dias <= 30 ? "mes" : "despues");

export type ItemAgenda = {
  key: string; origen: "red" | "manual"; cliente: string; titulo: string; detalle?: string;
  fecha: string | null; dias: number | null; grupo: GrupoAgenda; telefono?: string;
  sv?: ServicioRed; mant?: Mant; sugerida?: string; // sugerida: fecha propuesta para «Programar»
};

export function agendaItems(redes: ServicioRed[], mants: Mant[]): ItemAgenda[] {
  const out: ItemAgenda[] = [];
  redes.filter(r => r.estado !== "baja").forEach(r => {
    if (r.fechaProximoMant) {
      const dias = diasHasta(r.fechaProximoMant);
      out.push({ key: "r" + r.id, origen: "red", cliente: r.clienteNombre, titulo: r.tipoServicio, detalle: resumen(r), fecha: r.fechaProximoMant, dias, grupo: grupoDe(dias), telefono: r.clienteWhatsapp || r.clienteTelefono, sv: r });
    } else if (r.equipos.length && r.estado !== "suspendido" && (!r.estadoOrden || r.estadoOrden === "firmada")) {
      const base = r.fechaUltimoMant || r.fechaInstalacion || hoyStr();
      const frec = r.frecuenciaMantDias || FRECUENCIA_DEFAULT_DIAS;
      out.push({ key: "r" + r.id, origen: "red", cliente: r.clienteNombre, titulo: r.tipoServicio, detalle: resumen(r), fecha: null, dias: null, grupo: "sin_programar", telefono: r.clienteWhatsapp || r.clienteTelefono, sv: r, sugerida: sumarDias(base, frec) });
    }
  });
  mants.filter(m => !m.completado).forEach(m => {
    const dias = diasHasta(m.fechaProxima);
    out.push({ key: "m" + m.id, origen: "manual", cliente: m.cliente || m.equipo, titulo: `${m.tipo}${m.cliente ? " · " + m.equipo : ""}`, detalle: m.notas, fecha: m.fechaProxima, dias, grupo: grupoDe(dias), telefono: m.telefono, mant: m });
  });
  return out.sort((a, b) => (a.dias ?? 99999) - (b.dias ?? 99999));
}
const resumen = (r: ServicioRed) => r.equipos.map(e => `${(e.cantidad || 1) > 1 ? e.cantidad + "× " : ""}${[e.tipoEquipo, e.marca].filter(Boolean).join(" ")}`).filter(Boolean).slice(0, 3).join(", ");

export type EstadoGarantia = "vigente" | "por_vencer" | "vencida" | "sin";
export type Garantia = { sv: ServicioRed; meses: number; inicio: string; fin: string; dias: number; estado: EstadoGarantia };
export function garantias(redes: ServicioRed[]): Garantia[] {
  return redes.filter(r => r.equipos.length && r.fechaInstalacion && r.estado !== "baja").map(r => {
    const meses = r.garantiaMeses ?? GARANTIA_DEFAULT_MESES;
    const fin = sumarMeses(r.fechaInstalacion, meses);
    const dias = diasHasta(fin);
    return { sv: r, meses, inicio: r.fechaInstalacion, fin, dias, estado: meses === 0 ? "sin" : dias < 0 ? "vencida" : dias <= 30 ? "por_vencer" : "vigente" } as Garantia;
  }).sort((a, b) => (a.estado === "sin" ? 1 : 0) - (b.estado === "sin" ? 1 : 0) || a.dias - b.dias);
}

export function mensajeMant(it: ItemAgenda, quien = "Zento Data"): string {
  const cli = (it.cliente || "").split(" ")[0];
  const cuando = it.fecha ? (it.dias! < 0 ? `venció el ${it.fecha}` : it.dias === 0 ? "es hoy" : `le corresponde el ${it.fecha}`) : "le toca pronto";
  return `Hola ${cli}, le saluda ${quien}. Le recordamos que el mantenimiento preventivo de su ${it.titulo.toLowerCase()} ${cuando}. Un mantenimiento a tiempo alarga la vida del equipo y evita fallas. ¿Le agendamos una visita esta semana?\n\nZento Data 🔒 Seguridad Electrónica y Soporte Técnico`;
}
export function mensajeGarantia(g: Garantia): string {
  const cli = (g.sv.clienteNombre || "").split(" ")[0];
  return `Hola ${cli}, le saluda Zento Data. La garantía de su instalación (${g.sv.tipoServicio}) ${g.dias < 0 ? `venció el ${g.fin}` : `vence el ${g.fin}`}. Le ofrecemos una revisión de sus equipos y un plan de mantenimiento para mantener todo protegido. ¿Le interesa?\n\nZento Data 🔒`;
}
