import jsPDF from "jspdf";

// Tipos mínimos (coinciden con los definidos en App.tsx)
type CotItem = { id: string; qty: number; nombre: string; desc: string; precio: number };
export type CotizacionPDF = {
  id: string;
  num: number;
  fecha: string;
  cliente: string;
  proyecto: string;
  email: string;
  whatsapp: string;
  ubicacion: string;
  validez: string;
  items: CotItem[];
  subtotal: number;
  aplicaDescuento?: boolean;
  descuentoTipo?: "monto" | "porcentaje";
  descuentoValor?: number;
  descuentoMonto?: number;
  aplicaIva?: boolean;
  ivaPct?: number;
  ivaMonto?: number;
  total: number;
};

const fmtQ = (n: number) =>
  "Q " + Number(n || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

/** Genera un nombre de archivo seguro a partir del cliente y el número de cotización */
export function nombreArchivoCotizacion(cot: { id: string; cliente: string }) {
  const clienteLimpio = (cot.cliente || "Cliente")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // quita acentos
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "_");
  return `Cotizacion_${cot.id}_${clienteLimpio}.pdf`;
}

/** Construye el documento jsPDF de una cotización */
function buildPdf(cot: CotizacionPDF): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const marginX = 40;
  let y = 50;

  // ── Encabezado ──
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(15, 23, 42);
  doc.text("ZENTO DATA", marginX, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90, 100, 120);
  doc.text("Seguridad Electrónica · Redes · Soporte Técnico", marginX, y + 14);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(14, 165, 200);
  doc.text(cot.id, pageW - marginX, y, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90, 100, 120);
  doc.text(`Fecha: ${cot.fecha}`, pageW - marginX, y + 14, { align: "right" });
  doc.text(`Validez: ${cot.validez || "-"}`, pageW - marginX, y + 26, { align: "right" });

  y += 46;
  doc.setDrawColor(220, 224, 232);
  doc.line(marginX, y, pageW - marginX, y);
  y += 24;

  // ── Datos del cliente ──
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(30, 34, 44);
  doc.text("DATOS DEL CLIENTE", marginX, y);
  y += 16;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(50, 56, 70);
  const clienteLines: string[] = [];
  clienteLines.push(`Cliente: ${cot.cliente || "-"}`);
  if (cot.proyecto) clienteLines.push(`Proyecto: ${cot.proyecto}`);
  if (cot.email) clienteLines.push(`Email: ${cot.email}`);
  if (cot.whatsapp) clienteLines.push(`WhatsApp: ${cot.whatsapp}`);
  if (cot.ubicacion) clienteLines.push(`Ubicación: ${cot.ubicacion}`);

  clienteLines.forEach(line => {
    const wrapped = doc.splitTextToSize(line, pageW - marginX * 2);
    doc.text(wrapped, marginX, y);
    y += 14 * wrapped.length;
  });

  y += 12;

  // ── Tabla de productos/servicios ──
  const colX = { cant: marginX, prod: marginX + 40, punit: pageW - marginX - 150, total: pageW - marginX };
  doc.setFillColor(15, 23, 42);
  doc.rect(marginX, y, pageW - marginX * 2, 20, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text("CANT.", colX.cant + 4, y + 14);
  doc.text("PRODUCTO / SERVICIO", colX.prod, y + 14);
  doc.text("P. UNIT.", colX.punit, y + 14, { align: "right" });
  doc.text("TOTAL", colX.total, y + 14, { align: "right" });
  y += 20;

  doc.setFont("helvetica", "normal");
  doc.setTextColor(30, 34, 44);

  cot.items.forEach((item, idx) => {
    const nombre = item.nombre || "(sin nombre)";
    const desc = item.desc || "";
    const nombreLines = doc.splitTextToSize(nombre, pageW - marginX * 2 - 200);
    const descLines = desc ? doc.splitTextToSize(desc, pageW - marginX * 2 - 200) : [];
    const rowLines = Math.max(1, nombreLines.length + descLines.length);
    const rowH = rowLines * 12 + 8;

    if (y + rowH > doc.internal.pageSize.getHeight() - 100) {
      doc.addPage();
      y = 50;
    }

    if (idx % 2 === 0) {
      doc.setFillColor(246, 248, 251);
      doc.rect(marginX, y, pageW - marginX * 2, rowH, "F");
    }

    doc.setFontSize(9);
    doc.setTextColor(30, 34, 44);
    doc.text(String(item.qty), colX.cant + 4, y + 12);

    doc.setFont("helvetica", "bold");
    doc.text(nombreLines, colX.prod, y + 12);
    let localY = y + 12 + nombreLines.length * 12;
    if (descLines.length) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(100, 108, 124);
      doc.text(descLines, colX.prod, localY);
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(30, 34, 44);
    doc.text(fmtQ(item.precio), colX.punit, y + 12, { align: "right" });
    doc.setFont("helvetica", "bold");
    doc.text(fmtQ(item.qty * item.precio), colX.total, y + 12, { align: "right" });
    doc.setFont("helvetica", "normal");

    y += rowH;
  });

  y += 10;
  doc.setDrawColor(220, 224, 232);
  doc.line(marginX, y, pageW - marginX, y);
  y += 20;

  // ── Totales ──
  const totalsX = pageW - marginX - 160;
  doc.setFontSize(10);
  doc.setTextColor(90, 100, 120);
  doc.text("Subtotal", totalsX, y);
  doc.setTextColor(14, 165, 200);
  doc.text(fmtQ(cot.subtotal), pageW - marginX, y, { align: "right" });
  y += 18;

  if (cot.aplicaDescuento && cot.descuentoMonto) {
    doc.setTextColor(217, 119, 6);
    const label = cot.descuentoTipo === "porcentaje" ? `Descuento (${cot.descuentoValor}%)` : "Descuento";
    doc.text(label, totalsX, y);
    doc.text(`– ${fmtQ(cot.descuentoMonto)}`, pageW - marginX, y, { align: "right" });
    y += 18;
  }

  if (cot.aplicaIva) {
    doc.setTextColor(90, 100, 120);
    doc.text(`IVA (${cot.ivaPct}%)`, totalsX, y);
    doc.setTextColor(14, 165, 200);
    doc.text(fmtQ(cot.ivaMonto || 0), pageW - marginX, y, { align: "right" });
    y += 18;
  }

  doc.setDrawColor(200, 205, 215);
  doc.line(totalsX, y - 12, pageW - marginX, y - 12);
  y += 8;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text("TOTAL", totalsX, y);
  doc.setTextColor(14, 165, 200);
  doc.text(fmtQ(cot.total), pageW - marginX, y, { align: "right" });

  // ── Pie de página ──
  const pageH = doc.internal.pageSize.getHeight();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(140, 148, 164);
  doc.text(
    "Zento Data · Seguridad Electrónica y Soporte Técnico · Guatemala",
    pageW / 2,
    pageH - 30,
    { align: "center" }
  );

  return doc;
}

/** Descarga el PDF con nombre = cliente + número de cotización */
export function descargarPdfCotizacion(cot: CotizacionPDF) {
  const doc = buildPdf(cot);
  doc.save(nombreArchivoCotizacion(cot));
}

/** Abre el PDF en una nueva pestaña listo para imprimir */
export function imprimirPdfCotizacion(cot: CotizacionPDF) {
  const doc = buildPdf(cot);
  const blobUrl = doc.output("bloburl");
  const win = window.open(blobUrl as unknown as string, "_blank");
  if (win) {
    win.onload = () => {
      try { win.focus(); win.print(); } catch { /* noop */ }
    };
  }
}
