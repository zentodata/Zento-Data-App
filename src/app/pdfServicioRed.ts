import jsPDF from "jspdf";
import logoImg from "@/imports/PERFIL-Photoroom_-_copia.png";

// ─── Tipos mínimos (coinciden con los definidos en App.tsx) ──────────────────
type ArchivoRedPDF = { id: string; nombre: string; data: string };
type EquipoRedPDF = {
  id: string; modelo: string; marca?: string; serial?: string; mac?: string;
  ip?: string; puerto?: string; ubicacion?: string; estado?: string; fechaInstalacion?: string; garantia?: string;
};
type HistorialRedPDF = {
  id: string; fecha: string;
  tipo: "instalacion" | "modificacion" | "reemplazo" | "mantenimiento" | "incidencia" | "baja";
  tecnico: string; descripcion: string;
  motivo?: string; equipoAfectado?: string;
  costo?: number; precioCobrado?: number;
  fotos?: ArchivoRedPDF[]; documentos?: ArchivoRedPDF[];
  resultado?: string; equiposRevisados?: string[];
};
export type ServicioRedPDF = {
  id: string; codigoCliente: string; clienteNombre: string; clienteTelefono: string;
  clienteEmail?: string; clienteDireccion?: string; clienteObservaciones?: string;
  tipoServicio: string; proveedor: string; plan: string;
  estado: "activo" | "pendiente" | "programado" | "mantenimiento" | "incidencia" | "suspendido" | "baja";
  equipos: EquipoRedPDF[];
  historial: HistorialRedPDF[];
  fechaInstalacion: string; ultimaModificacion: string;
  fechaUltimoMant?: string; fechaProximoMant?: string;
};

const HIST_TIPO_LABELS: Record<HistorialRedPDF["tipo"], string> = {
  instalacion: "Instalación", modificacion: "Modificación", reemplazo: "Reemplazo",
  mantenimiento: "Mantenimiento", incidencia: "Incidencia", baja: "Baja",
};
const ESTADO_LABELS: Record<ServicioRedPDF["estado"], string> = {
  activo: "Activo", pendiente: "Pendiente", programado: "Programado",
  mantenimiento: "En Mantenimiento", incidencia: "Incidencia", suspendido: "Suspendido", baja: "Baja",
};
const ESTADO_RGB: Record<ServicioRedPDF["estado"], [number, number, number]> = {
  activo: [16, 185, 129], pendiente: [234, 179, 8], programado: [14, 165, 200],
  mantenimiento: [245, 158, 11], incidencia: [239, 68, 68], suspendido: [128, 144, 168], baja: [128, 144, 168],
};

const fmtQ = (n: number) => "Q " + Number(n || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

let cachedLogoDataUrl: string | null = null;
async function getLogoDataUrl(): Promise<string | null> {
  if (cachedLogoDataUrl) return cachedLogoDataUrl;
  try {
    const res = await fetch(logoImg);
    const blob = await res.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    cachedLogoDataUrl = dataUrl;
    return dataUrl;
  } catch {
    return null;
  }
}

function nombreArchivo(s: ServicioRedPDF) {
  const clienteLimpio = (s.clienteNombre || "Cliente")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s-]/g, "").trim().replace(/\s+/g, "_");
  return `${s.codigoCliente}_${clienteLimpio}_${s.tipoServicio.replace(/\s+/g, "_")}.pdf`;
}

async function buildPdf(s: ServicioRedPDF): Promise<jsPDF> {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 42;
  const bottomLimit = pageH - 52;
  let y = 48;

  const ensureSpace = (needed: number) => {
    if (y + needed > bottomLimit) { doc.addPage(); y = 48; }
  };

  // ── Encabezado con logo ──
  const logo = await getLogoDataUrl();
  if (logo) {
    try { doc.addImage(logo, "PNG", marginX, y - 6, 34, 34); } catch { /* noop */ }
  }
  const textX = logo ? marginX + 44 : marginX;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(19);
  doc.setTextColor(15, 23, 42);
  doc.text("Zento", textX, y + 14);
  doc.setTextColor(14, 165, 200);
  doc.text("Data", textX + doc.getTextWidth("Zento") + 3, y + 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(90, 100, 120);
  doc.text("Seguridad Electrónica · Redes · Soporte Técnico", textX, y + 26);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(14, 165, 200);
  doc.text("RESUMEN DE SERVICIO DE RED", pageW - marginX, y, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(90, 100, 120);
  doc.text(`Generado: ${new Date().toLocaleDateString("es-GT")}`, pageW - marginX, y + 14, { align: "right" });
  doc.text(`Código: ${s.codigoCliente}`, pageW - marginX, y + 26, { align: "right" });

  y += 46;
  doc.setDrawColor(220, 224, 232);
  doc.setLineWidth(1);
  doc.line(marginX, y, pageW - marginX, y);
  y += 22;

  // ── Cliente + estado ──
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(15, 23, 42);
  doc.text(s.clienteNombre, marginX, y);

  const estadoLabel = ESTADO_LABELS[s.estado];
  const [er, eg, eb] = ESTADO_RGB[s.estado];
  doc.setFontSize(9);
  const badgeW = doc.getTextWidth(estadoLabel) + 18;
  doc.setFillColor(er, eg, eb);
  doc.roundedRect(pageW - marginX - badgeW, y - 13, badgeW, 18, 9, 9, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.text(estadoLabel, pageW - marginX - badgeW / 2, y - 1, { align: "center" });

  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(90, 100, 120);
  const contacto = [s.clienteTelefono, s.clienteEmail].filter(Boolean).join(" · ");
  if (contacto) { y += 14; doc.text(contacto, marginX, y); }
  if (s.clienteDireccion) { y += 13; doc.text(s.clienteDireccion, marginX, y); }
  y += 22;

  // ── Datos del servicio ──
  doc.setFillColor(246, 248, 251);
  doc.roundedRect(marginX, y, pageW - marginX * 2, 66, 6, 6, "F");
  const col1 = marginX + 14, col2 = marginX + (pageW - marginX * 2) / 2 + 6;
  const rows: [string, string, string, string][] = [
    ["Tipo de servicio", s.tipoServicio, "Proveedor", s.proveedor || "-"],
    ["Plan", s.plan || "-", "Fecha de instalación", s.fechaInstalacion || "-"],
    ["Último mantenimiento", s.fechaUltimoMant || "-", "Próximo mantenimiento", s.fechaProximoMant || "-"],
  ];
  let ry = y + 18;
  rows.forEach(([l1, v1, l2, v2]) => {
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(90, 100, 120);
    doc.text(l1.toUpperCase(), col1, ry - 8); doc.text(l2.toUpperCase(), col2, ry - 8);
    doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); doc.setTextColor(30, 34, 44);
    doc.text(v1, col1, ry + 3); doc.text(v2, col2, ry + 3);
    ry += 17;
  });
  y += 78;

  // ── Equipos ──
  if (s.equipos.length > 0) {
    ensureSpace(30);
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(15, 23, 42);
    doc.text(`EQUIPOS INSTALADOS (${s.equipos.length})`, marginX, y);
    y += 14;
    const w = pageW - marginX * 2;
    const cW = [w * 0.28, w * 0.18, w * 0.22, w * 0.16, w * 0.16];
    doc.setFillColor(15, 23, 42);
    doc.rect(marginX, y, w, 18, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); doc.setTextColor(255, 255, 255);
    let cx = marginX + 4;
    ["MODELO", "MARCA", "UBICACIÓN", "SERIAL", "MAC"].forEach((h, i) => { doc.text(h, cx, y + 12); cx += cW[i]; });
    y += 18;
    doc.setFont("helvetica", "normal"); doc.setTextColor(30, 34, 44);
    s.equipos.forEach((e, idx) => {
      ensureSpace(16);
      if (idx % 2 === 0) { doc.setFillColor(246, 248, 251); doc.rect(marginX, y, w, 16, "F"); }
      doc.setFontSize(8.5);
      let cx2 = marginX + 4;
      const vals = [e.modelo || "-", e.marca || "-", e.ubicacion || "-", e.serial || "-", e.mac || "-"];
      vals.forEach((v, i) => { doc.text(v, cx2, y + 11); cx2 += cW[i]; });
      y += 16;
    });
    y += 16;
  }

  // ── Historial ──
  ensureSpace(24);
  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(15, 23, 42);
  doc.text("HISTORIAL DEL SERVICIO", marginX, y);
  y += 16;

  const historialOrdenado = s.historial.slice().sort((a, b) => a.fecha.localeCompare(b.fecha));
  historialOrdenado.forEach(h => {
    const descLines = doc.splitTextToSize(h.descripcion, pageW - marginX * 2 - 10);
    const extras: string[] = [];
    if (h.motivo) extras.push(`Motivo: ${h.motivo}`);
    if (h.equipoAfectado) extras.push(`Equipo: ${h.equipoAfectado}`);
    if (h.resultado) extras.push(`Resultado: ${h.resultado}`);
    if (h.equiposRevisados?.length) extras.push(`Revisados: ${h.equiposRevisados.join(", ")}`);
    if (h.costo || h.precioCobrado) extras.push([h.costo ? `Costo: ${fmtQ(h.costo)}` : "", h.precioCobrado ? `Cobrado: ${fmtQ(h.precioCobrado)}` : ""].filter(Boolean).join("  ·  "));
    const extraLines = extras.flatMap(e => doc.splitTextToSize(e, pageW - marginX * 2 - 10));

    const blockH = 22 + descLines.length * 11 + extraLines.length * 10 + 14;
    ensureSpace(blockH);

    doc.setFillColor(250, 251, 252);
    doc.setDrawColor(226, 230, 238);
    doc.roundedRect(marginX, y, pageW - marginX * 2, blockH - 6, 4, 4, "FD");

    doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.setTextColor(14, 165, 200);
    doc.text(HIST_TIPO_LABELS[h.tipo].toUpperCase(), marginX + 10, y + 14);
    doc.setFont("helvetica", "normal"); doc.setTextColor(90, 100, 120);
    doc.text(`${new Date(h.fecha).toLocaleDateString("es-GT")}  ·  ${h.tecnico}`, pageW - marginX - 10, y + 14, { align: "right" });

    let ly = y + 28;
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(50, 56, 70);
    doc.text(descLines, marginX + 10, ly);
    ly += descLines.length * 11 + 2;

    if (extraLines.length) {
      doc.setFontSize(8); doc.setTextColor(90, 100, 120);
      doc.text(extraLines, marginX + 10, ly);
      ly += extraLines.length * 10;
    }

    y += blockH + 8;
  });

  // ── Firmas de cierre ──
  ensureSpace(70);
  y += 20;
  const sigW = (pageW - marginX * 2 - 30) / 2;
  doc.setDrawColor(150, 156, 168);
  doc.line(marginX, y, marginX + sigW, y);
  doc.line(marginX + sigW + 30, y, marginX + sigW * 2 + 30, y);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(90, 100, 120);
  doc.text("Firma del Cliente", marginX, y + 14);
  doc.text("Firma de Zento Data", marginX + sigW + 30, y + 14);

  // ── Pie de página en todas las hojas ──
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(150, 156, 168);
    doc.text("Zento Data · Seguridad Electrónica y Soporte Técnico · Guatemala", pageW / 2, pageH - 22, { align: "center" });
    doc.text(`Página ${p} de ${total}`, pageW - marginX, pageH - 22, { align: "right" });
    doc.text(s.codigoCliente, marginX, pageH - 22);
  }

  return doc;
}

export async function descargarPdfServicioRed(s: ServicioRedPDF): Promise<void> {
  const doc = await buildPdf(s);
  doc.save(nombreArchivo(s));
}

export async function imprimirPdfServicioRed(s: ServicioRedPDF): Promise<void> {
  const doc = await buildPdf(s);
  const blobUrl = doc.output("bloburl");
  const win = window.open(blobUrl as unknown as string, "_blank");
  if (win) { win.onload = () => { try { win.focus(); win.print(); } catch { /* noop */ } }; }
}
