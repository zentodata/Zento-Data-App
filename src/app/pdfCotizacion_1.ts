import jsPDF from "jspdf";
import logoImg from "@/imports/PERFIL-Photoroom_-_copia.png";

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

// ── Teléfonos de contacto (se muestran en encabezado y pie de página) ──
const TEL_PRINCIPAL = "+502 4204-3583";
const TEL_EMERGENCIAS = "+502 5697-0851";

/** Genera un nombre de archivo seguro a partir del cliente y el número de cotización */
export function nombreArchivoCotizacion(cot: { id: string; cliente: string }) {
  const clienteLimpio = (cot.cliente || "Cliente")
    .normalize("NFD").replace(/[̀-ͯ]/g, "") // quita acentos
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "_");
  return `Cotizacion_${cot.id}_${clienteLimpio}.pdf`;
}

// ── Logo embebido (se descarga y cachea una sola vez en base64) ──
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

/** Construye el documento jsPDF de una cotización */
async function buildPdf(cot: CotizacionPDF): Promise<jsPDF> {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 40;
  let y = 0;

  // ── Barra de marca superior (navy + franja celeste) ──
  const HEADER_H = 104;
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageW, HEADER_H, "F");
  doc.setFillColor(14, 165, 200);
  doc.rect(0, HEADER_H, pageW, 4, "F");

  const logo = await getLogoDataUrl();
  const headerCenterY = 34;
  let textX = marginX;
  if (logo) {
    try {
      doc.addImage(logo, "PNG", marginX, headerCenterY - 18, 40, 40);
      textX = marginX + 50;
    } catch { /* noop */ }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(21);
  doc.setTextColor(255, 255, 255);
  doc.text("Zento", textX, headerCenterY + 6);
  doc.setTextColor(14, 165, 200);
  doc.text("Data", textX + doc.getTextWidth("Zento") + 3, headerCenterY + 6);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(180, 196, 214);
  doc.text("Seguridad Electrónica · Redes · Soporte Técnico", textX, headerCenterY + 20);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(14, 165, 200);
  doc.text(`Tel: ${TEL_PRINCIPAL}`, textX, headerCenterY + 34);
  doc.setTextColor(239, 160, 90);
  doc.text(`Emergencias: ${TEL_EMERGENCIAS}`, textX, headerCenterY + 47);
  doc.setFont("helvetica", "normal");

  // ── Insignia "COTIZACIÓN" (píldora redondeada) ──
  doc.setFillColor(14, 165, 200);
  const badgeW = 120, badgeH = 22;
  doc.roundedRect(pageW - marginX - badgeW, 16, badgeW, badgeH, 11, 11, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(6, 8, 16);
  doc.text("COTIZACIÓN", pageW - marginX - badgeW / 2, 16 + badgeH / 2 + 3.5, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text(cot.id, pageW - marginX, 56, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(180, 196, 214);
  doc.text(`Fecha: ${cot.fecha}`, pageW - marginX, 69, { align: "right" });
  doc.text(`Validez: ${cot.validez || "-"}`, pageW - marginX, 81, { align: "right" });

  y = HEADER_H + 28;

  // ── Datos del cliente (tarjeta con barra de acento) ──
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(50, 56, 70);
  const clienteLines: string[] = [];
  clienteLines.push(`Cliente: ${cot.cliente || "-"}`);
  if (cot.proyecto) clienteLines.push(`Proyecto: ${cot.proyecto}`);
  if (cot.email) clienteLines.push(`Email: ${cot.email}`);
  if (cot.whatsapp) clienteLines.push(`WhatsApp: ${cot.whatsapp}`);
  if (cot.ubicacion) clienteLines.push(`Ubicación: ${cot.ubicacion}`);

  const wrappedLines = clienteLines.map(l => doc.splitTextToSize(l, pageW - marginX * 2 - 24));
  const totalLineCount = wrappedLines.reduce((a, w) => a + w.length, 0);
  const cardH = 16 + totalLineCount * 14 + 10;

  doc.setFillColor(248, 250, 252);
  doc.roundedRect(marginX, y, pageW - marginX * 2, cardH, 8, 8, "F");
  doc.setFillColor(14, 165, 200);
  doc.rect(marginX, y, 4, cardH, "F");

  let cy = y + 20;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text("DATOS DEL CLIENTE", marginX + 16, cy);
  cy += 16;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(50, 56, 70);
  wrappedLines.forEach(wrapped => {
    doc.text(wrapped, marginX + 16, cy);
    cy += 14 * wrapped.length;
  });

  y += cardH + 22;

  // ── Tabla de productos/servicios ──
  const colX = { cant: marginX + 10, prod: marginX + 54, punit: pageW - marginX - 150, total: pageW - marginX };
  doc.setFillColor(15, 23, 42);
  doc.rect(marginX, y, pageW - marginX * 2, 22, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text("CANT.", colX.cant, y + 15);
  doc.text("PRODUCTO / SERVICIO", colX.prod, y + 15);
  doc.text("P. UNIT.", colX.punit, y + 15, { align: "right" });
  doc.text("TOTAL", colX.total, y + 15, { align: "right" });
  y += 22;

  doc.setFont("helvetica", "normal");
  doc.setTextColor(30, 34, 44);

  cot.items.forEach((item, idx) => {
    const nombre = item.nombre || "(sin nombre)";
    const desc = item.desc || "";
    const nombreLines = doc.splitTextToSize(nombre, pageW - marginX * 2 - 210);
    const descLines = desc ? doc.splitTextToSize(desc, pageW - marginX * 2 - 210) : [];
    const rowLines = Math.max(1, nombreLines.length + descLines.length);
    const rowH = rowLines * 12 + 10;

    if (y + rowH > pageH - 110) {
      doc.addPage();
      y = 50;
    }

    if (idx % 2 === 0) {
      doc.setFillColor(236, 248, 252);
    } else {
      doc.setFillColor(255, 255, 255);
    }
    doc.rect(marginX, y, pageW - marginX * 2, rowH, "F");

    doc.setFontSize(9);
    doc.setTextColor(14, 165, 200);
    doc.setFont("helvetica", "bold");
    doc.text(String(item.qty), colX.cant, y + 14);

    doc.setTextColor(30, 34, 44);
    doc.text(nombreLines, colX.prod, y + 14);
    let localY = y + 14 + nombreLines.length * 12;
    if (descLines.length) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(100, 108, 124);
      doc.text(descLines, colX.prod, localY);
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(30, 34, 44);
    doc.text(fmtQ(item.precio), colX.punit, y + 14, { align: "right" });
    doc.setFont("helvetica", "bold");
    doc.setTextColor(14, 165, 200);
    doc.text(fmtQ(item.qty * item.precio), colX.total, y + 14, { align: "right" });
    doc.setFont("helvetica", "normal");

    y += rowH;
  });

  doc.setDrawColor(14, 165, 200);
  doc.setLineWidth(1.4);
  doc.line(marginX, y, pageW - marginX, y);
  y += 20;

  // ── Totales (tarjeta con acento) ──
  const boxW = 230;
  const boxX = pageW - marginX - boxW;
  const linesCount = 1 + (cot.aplicaDescuento && cot.descuentoMonto ? 1 : 0) + (cot.aplicaIva ? 1 : 0);
  const boxH = linesCount * 20 + 46;

  if (y + boxH > pageH - 70) { doc.addPage(); y = 50; }

  doc.setFillColor(248, 250, 252);
  doc.roundedRect(boxX, y, boxW, boxH, 8, 8, "F");

  const totalsLabelX = boxX + 16;
  const totalsValueX = boxX + boxW - 16;
  let ty = y + 22;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90, 100, 120);
  doc.text("Subtotal", totalsLabelX, ty);
  doc.setTextColor(30, 34, 44);
  doc.text(fmtQ(cot.subtotal), totalsValueX, ty, { align: "right" });
  ty += 20;

  if (cot.aplicaDescuento && cot.descuentoMonto) {
    doc.setTextColor(217, 119, 6);
    const label = cot.descuentoTipo === "porcentaje" ? `Descuento (${cot.descuentoValor}%)` : "Descuento";
    doc.text(label, totalsLabelX, ty);
    doc.text(`– ${fmtQ(cot.descuentoMonto)}`, totalsValueX, ty, { align: "right" });
    ty += 20;
  }

  if (cot.aplicaIva) {
    doc.setTextColor(90, 100, 120);
    doc.text(`IVA (${cot.ivaPct}%)`, totalsLabelX, ty);
    doc.setTextColor(30, 34, 44);
    doc.text(fmtQ(cot.ivaMonto || 0), totalsValueX, ty, { align: "right" });
    ty += 20;
  }

  // Barra TOTAL destacada
  const totalBarY = y + boxH - 32;
  doc.setFillColor(15, 23, 42);
  doc.rect(boxX, totalBarY, boxW, 32, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12.5);
  doc.setTextColor(255, 255, 255);
  doc.text("TOTAL", totalsLabelX, totalBarY + 21);
  doc.setTextColor(14, 165, 200);
  doc.text(fmtQ(cot.total), totalsValueX, totalBarY + 21, { align: "right" });

  // ── Pie de página ──
  doc.setDrawColor(230, 233, 239);
  doc.setLineWidth(0.6);
  doc.line(marginX, pageH - 44, pageW - marginX, pageH - 44);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(140, 148, 164);
  doc.text(
    `Zento Data · Seguridad Electrónica y Soporte Técnico · Guatemala · ${TEL_PRINCIPAL}`,
    pageW / 2,
    pageH - 28,
    { align: "center" }
  );
  doc.setTextColor(239, 160, 90);
  doc.text(`Emergencias 24/7: ${TEL_EMERGENCIAS}`, pageW / 2, pageH - 16, { align: "center" });

  return doc;
}

/** Descarga el PDF con nombre = cliente + número de cotización */
export async function descargarPdfCotizacion(cot: CotizacionPDF) {
  const doc = await buildPdf(cot);
  doc.save(nombreArchivoCotizacion(cot));
}

/** Abre el PDF en una nueva pestaña listo para imprimir */
export async function imprimirPdfCotizacion(cot: CotizacionPDF) {
  const doc = await buildPdf(cot);
  const blobUrl = doc.output("bloburl");
  const win = window.open(blobUrl as unknown as string, "_blank");
  if (win) {
    win.onload = () => {
      try { win.focus(); win.print(); } catch { /* noop */ }
    };
  }
}
