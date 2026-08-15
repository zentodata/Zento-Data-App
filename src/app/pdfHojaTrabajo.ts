import jsPDF from "jspdf";

export type HojaPDF = {
  id: string;
  nombre: string;
  direccion: string;
  telefono: string;
  email: string;
  orden: string;
  fecha: string;
  tecnico: string;
  servicios: string[];
  desc: string;
  obs: string;
  equipos: { desc: string; marca: string; spec: string }[];
  patron: number[];
};

// ── Términos y condiciones según el servicio realizado ────────────────────
const HT_TERMINOS: Record<string, string[]> = {
  "Instalación CCTV": [
    "La garantía de instalación cubre mano de obra por 30 días naturales a partir de la fecha de este servicio.",
    "Los equipos instalados cuentan con la garantía del fabricante o proveedor correspondiente, sujeta a sus políticas.",
    "El cliente es responsable de mantener conexión eléctrica estable y acceso a internet para el correcto funcionamiento del sistema.",
  ],
  "Redes/Cableado": [
    "El cableado instalado fue probado para garantizar continuidad de señal al momento de la entrega.",
    "Daños al cableado por terceros, roedores, humedad o remodelaciones posteriores no están cubiertos por esta garantía.",
  ],
  "Configuración NVR/DVR": [
    "Se recomienda cambiar las contraseñas por defecto del equipo inmediatamente después de esta configuración.",
    "Zento Data no se hace responsable por accesos no autorizados derivados del uso de contraseñas débiles o compartidas por el cliente.",
  ],
  "Soporte Técnico": [
    "Si la falla reportada reincide por causas ajenas al servicio prestado (mal uso, cortes de energía, manipulación por terceros), la visita de retorno podría generar un cargo adicional.",
  ],
  "Mantenimiento": [
    "Se recomienda dar mantenimiento preventivo cada 3 a 6 meses para asegurar el óptimo funcionamiento del sistema.",
  ],
  "Reparación": [
    "La reparación realizada cuenta con garantía de 30 días sobre el componente reparado o reemplazado, no así sobre fallas nuevas o no relacionadas.",
  ],
  "Biométrico": [
    "El cliente es responsable de la administración y respaldo de las plantillas biométricas registradas en el equipo.",
  ],
  "Control de Acceso": [
    "La gestión de usuarios, tarjetas y credenciales de acceso posterior a esta instalación es responsabilidad del cliente.",
  ],
};

const HT_TERMINOS_GENERALES = [
  "Este documento certifica que el trabajo descrito fue realizado en la fecha indicada y aceptado por el cliente o su representante.",
  "Cualquier trabajo adicional no incluido en esta hoja de servicio será cotizado por separado.",
  "Zento Data no se hace responsable por daños preexistentes no reportados antes del inicio del servicio.",
];

function buildPdf(h: HojaPDF): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 40;
  const bottomLimit = pageH - 50;
  let y = 50;

  const ensureSpace = (needed: number) => {
    if (y + needed > bottomLimit) { doc.addPage(); y = 50; }
  };

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
  doc.setFontSize(13);
  doc.setTextColor(14, 165, 200);
  doc.text("HOJA DE TRABAJO / SERVICIO", pageW - marginX, y, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90, 100, 120);
  doc.text(`Fecha: ${h.fecha || "-"}`, pageW - marginX, y + 14, { align: "right" });
  if (h.orden) doc.text(`Ref: ${h.orden}`, pageW - marginX, y + 26, { align: "right" });

  y += 46;
  doc.setDrawColor(220, 224, 232);
  doc.line(marginX, y, pageW - marginX, y);
  y += 22;

  // ── Datos del cliente ──
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(30, 34, 44);
  doc.text("DATOS DEL CLIENTE", marginX, y);
  y += 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(50, 56, 70);
  const datosCliente = [
    `Cliente: ${h.nombre || "-"}`,
    h.telefono ? `Teléfono: ${h.telefono}` : "",
    h.direccion ? `Dirección: ${h.direccion}` : "",
    h.email ? `Email: ${h.email}` : "",
    h.tecnico ? `Técnico asignado: ${h.tecnico}` : "",
  ].filter(Boolean);
  datosCliente.forEach(line => {
    const wrapped = doc.splitTextToSize(line, pageW - marginX * 2);
    ensureSpace(14 * wrapped.length);
    doc.text(wrapped, marginX, y);
    y += 14 * wrapped.length;
  });
  y += 14;

  // ── Servicios realizados ──
  if (h.servicios.length > 0) {
    ensureSpace(20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(30, 34, 44);
    doc.text("SERVICIOS REALIZADOS", marginX, y);
    y += 16;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(50, 56, 70);
    h.servicios.forEach(s => {
      ensureSpace(15);
      doc.text(`✓  ${s}`, marginX, y);
      y += 15;
    });
    y += 10;
  }

  // ── Descripción del trabajo ──
  if (h.desc) {
    ensureSpace(20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(30, 34, 44);
    doc.text("DESCRIPCIÓN DEL TRABAJO", marginX, y);
    y += 16;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(50, 56, 70);
    const wrapped = doc.splitTextToSize(h.desc, pageW - marginX * 2);
    ensureSpace(14 * wrapped.length);
    doc.text(wrapped, marginX, y);
    y += 14 * wrapped.length + 10;
  }

  // ── Equipos instalados ──
  const equiposValidos = h.equipos.filter(e => e.desc || e.marca || e.spec);
  if (equiposValidos.length > 0) {
    ensureSpace(30);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(30, 34, 44);
    doc.text("EQUIPOS INSTALADOS", marginX, y);
    y += 14;
    const colW = [(pageW - marginX * 2) * 0.4, (pageW - marginX * 2) * 0.25, (pageW - marginX * 2) * 0.35];
    doc.setFillColor(15, 23, 42);
    doc.rect(marginX, y, pageW - marginX * 2, 18, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255);
    doc.text("DESCRIPCIÓN", marginX + 4, y + 12);
    doc.text("MARCA", marginX + colW[0] + 4, y + 12);
    doc.text("ESPECIFICACIÓN", marginX + colW[0] + colW[1] + 4, y + 12);
    y += 18;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 34, 44);
    equiposValidos.forEach((e, idx) => {
      ensureSpace(16);
      if (idx % 2 === 0) { doc.setFillColor(246, 248, 251); doc.rect(marginX, y, pageW - marginX * 2, 16, "F"); }
      doc.setFontSize(9);
      doc.text(e.desc || "-", marginX + 4, y + 11);
      doc.text(e.marca || "-", marginX + colW[0] + 4, y + 11);
      doc.text(e.spec || "-", marginX + colW[0] + colW[1] + 4, y + 11);
      y += 16;
    });
    y += 14;
  }

  // ── Patrón de desbloqueo (solo si el usuario definió alguno) ──
  if (h.patron.length > 0) {
    ensureSpace(130);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(30, 34, 44);
    doc.text("PATRÓN DE DESBLOQUEO", marginX, y);
    y += 18;

    const gridSize = 90;
    const cell = gridSize / 2;
    const startX = marginX;
    const startY = y;
    const pos = (n: number) => {
      const idx = n - 1;
      const col = idx % 3, row = Math.floor(idx / 3);
      return { x: startX + col * cell, y: startY + row * cell };
    };

    doc.setDrawColor(14, 165, 200);
    doc.setLineWidth(1.5);
    for (let i = 0; i < h.patron.length - 1; i++) {
      const a = pos(h.patron[i]); const b = pos(h.patron[i + 1]);
      doc.line(a.x, a.y, b.x, b.y);
    }
    for (let n = 1; n <= 9; n++) {
      const p = pos(n);
      const selected = h.patron.includes(n);
      doc.setFillColor(selected ? 14 : 240, selected ? 165 : 240, selected ? 200 : 244);
      doc.setDrawColor(selected ? 14 : 200, selected ? 165 : 205, selected ? 200 : 215);
      doc.circle(p.x, p.y, 6, "FD");
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(90, 100, 120);
    doc.text(`Secuencia: ${h.patron.join(" → ")}`, startX + gridSize + 20, startY + gridSize / 2);
    y = startY + gridSize + 20;
  }

  // ── Observaciones y cláusulas ──
  if (h.obs) {
    ensureSpace(20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(30, 34, 44);
    doc.text("OBSERVACIONES", marginX, y);
    y += 16;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(50, 56, 70);
    const wrapped = doc.splitTextToSize(h.obs, pageW - marginX * 2);
    ensureSpace(14 * wrapped.length);
    doc.text(wrapped, marginX, y);
    y += 14 * wrapped.length + 10;
  }

  // ── Términos y condiciones (según los servicios seleccionados) ──
  const terminos = [
    ...h.servicios.flatMap(s => HT_TERMINOS[s] || []),
    ...HT_TERMINOS_GENERALES,
  ];
  const terminosUnicos = Array.from(new Set(terminos));
  if (terminosUnicos.length > 0) {
    ensureSpace(24);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(30, 34, 44);
    doc.text("TÉRMINOS Y CONDICIONES", marginX, y);
    y += 15;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(90, 100, 120);
    terminosUnicos.forEach((t, i) => {
      const wrapped = doc.splitTextToSize(`${i + 1}. ${t}`, pageW - marginX * 2);
      ensureSpace(11 * wrapped.length);
      doc.text(wrapped, marginX, y);
      y += 11 * wrapped.length + 3;
    });
    y += 10;
  }

  // ── Firmas ──
  ensureSpace(70);
  y += 30;
  const sigW = (pageW - marginX * 2 - 30) / 2;
  doc.setDrawColor(150, 156, 168);
  doc.line(marginX, y, marginX + sigW, y);
  doc.line(marginX + sigW + 30, y, marginX + sigW * 2 + 30, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90, 100, 120);
  doc.text("Firma del Cliente", marginX, y + 14);
  doc.text("Firma del Técnico", marginX + sigW + 30, y + 14);

  // ── Pie de página en todas las páginas ──
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(140, 148, 164);
    doc.text("Zento Data · Seguridad Electrónica y Soporte Técnico · Guatemala", pageW / 2, pageH - 25, { align: "center" });
    if (totalPages > 1) doc.text(`Página ${p} de ${totalPages}`, pageW - marginX, pageH - 25, { align: "right" });
  }

  return doc;
}

function nombreArchivoHoja(h: HojaPDF) {
  const clienteLimpio = (h.nombre || "Cliente")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s-]/g, "").trim().replace(/\s+/g, "_");
  return `Hoja_Trabajo_${clienteLimpio}_${h.fecha || ""}.pdf`;
}

export function descargarPdfHoja(h: HojaPDF) {
  const doc = buildPdf(h);
  doc.save(nombreArchivoHoja(h));
}

export function imprimirPdfHoja(h: HojaPDF) {
  const doc = buildPdf(h);
  const blobUrl = doc.output("bloburl");
  const win = window.open(blobUrl as unknown as string, "_blank");
  if (win) {
    win.onload = () => { try { win.focus(); win.print(); } catch { /* noop */ } };
  }
}
