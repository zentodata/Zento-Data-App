// ─── RESUMEN PARA ZENTO HUB ──────────────────────────────────────────────────
// El Hub no lee las colecciones del CRM directamente. En su lugar, el CRM
// calcula un resumen pequeño y lo publica en /hub/summary (Realtime Database).
// El Hub solo lee ese nodo. Así el Hub no depende de la estructura interna del
// CRM ni de sus pestañas.

/* eslint-disable @typescript-eslint/no-explicit-any */

export type HubSummary = {
  updatedAt: string;
  currency: "GTQ";
  clientes: number;
  cotizaciones: { total: number; pendientes: number; aprobadas: number; montoPendiente: number };
  ventas: { total: number; delMes: number; montoMes: number };
  redes: { total: number; activos: number; incidencias: number };
  inventario: { items: number; stockBajo: number };
  pagos: { porCobrar: number; porPagar: number };
  gastos: { delMes: number };
  mantenimiento: { pendientes: number; proximos7dias: number };
  notifs: {
    noLeidas: number;
    recientes: { id: string; tipo: string; titulo: string; mensaje: string; fecha: string; modulo: string; leida: boolean }[];
  };
};

type Inputs = {
  cotizaciones: any[]; ventas: any[]; inventario: any[]; gastos: any[];
  pagos: any[]; mantenimientos: any[]; redes: any[]; notifs: any[];
};

const num = (n: unknown) => (Number.isFinite(Number(n)) ? Number(n) : 0);
const norm = (s: unknown) => String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
const inMonth = (fecha: unknown, ym: string) => String(fecha ?? "").slice(0, 7) === ym;
const daysUntil = (fecha: string) => Math.ceil((new Date(fecha).getTime() - Date.now()) / 86400000);

export function buildHubSummary(d: Inputs): HubSummary {
  const ym = currentMonth();

  // Clientes únicos a partir de todos los módulos que guardan un nombre de cliente
  const nombres = new Set<string>();
  d.cotizaciones.forEach(x => nombres.add(norm(x.cliente)));
  d.ventas.forEach(x => nombres.add(norm(x.cliente)));
  d.pagos.filter(x => (x.tipo ?? "cobrar") === "cobrar").forEach(x => nombres.add(norm(x.cliente)));
  d.redes.forEach(x => nombres.add(norm(x.clienteNombre)));
  nombres.delete("");

  const cotPend = d.cotizaciones.filter(c => c.estado === "pendiente" || c.estado === "enviada");
  const ventasMes = d.ventas.filter(v => inMonth(v.fecha, ym));
  const mantPend = d.mantenimientos.filter(m => !m.completado);

  const recientes = [...d.notifs]
    .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)))
    .slice(0, 15)
    .map(n => ({
      id: String(n.id ?? ""), tipo: String(n.tipo ?? "info"), titulo: String(n.titulo ?? ""),
      mensaje: String(n.mensaje ?? ""), fecha: String(n.fecha ?? ""), modulo: String(n.modulo ?? ""),
      leida: !!n.leida,
    }));

  return {
    updatedAt: new Date().toISOString(),
    currency: "GTQ",
    clientes: nombres.size,
    cotizaciones: {
      total: d.cotizaciones.length,
      pendientes: cotPend.length,
      aprobadas: d.cotizaciones.filter(c => c.estado === "aprobada").length,
      montoPendiente: cotPend.reduce((s, c) => s + num(c.total), 0),
    },
    ventas: {
      total: d.ventas.length,
      delMes: ventasMes.length,
      montoMes: ventasMes.reduce((s, v) => s + num(v.total), 0),
    },
    redes: {
      total: d.redes.length,
      activos: d.redes.filter(r => r.estado === "activo").length,
      incidencias: d.redes.filter(r => r.estado === "incidencia").length,
    },
    inventario: {
      items: d.inventario.length,
      stockBajo: d.inventario.filter(i => num(i.stock) <= num(i.minimo)).length,
    },
    pagos: {
      porCobrar: d.pagos.filter(p => (p.tipo ?? "cobrar") === "cobrar").reduce((s, p) => s + Math.max(0, num(p.total) - num(p.recibido)), 0),
      porPagar: d.pagos.filter(p => p.tipo === "pagar").reduce((s, p) => s + Math.max(0, num(p.total) - num(p.recibido)), 0),
    },
    gastos: { delMes: d.gastos.filter(g => inMonth(g.fecha, ym)).reduce((s, g) => s + num(g.monto), 0) },
    mantenimiento: {
      pendientes: mantPend.length,
      proximos7dias: mantPend.filter(m => m.fechaProxima && daysUntil(m.fechaProxima) <= 7).length,
    },
    notifs: { noLeidas: d.notifs.filter(n => !n.leida).length, recientes },
  };
}
