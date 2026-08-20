import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Bell, X, Menu, Plus, Trash2, Edit2, Copy, Search, LogOut, Users, Shield,
  AlertTriangle, CheckCircle2, Upload, Download, FileText, Package,
  TrendingUp, Wallet, DollarSign, Wrench, ClipboardList, Eye, EyeOff,
  RefreshCw, Info, Wifi
} from "lucide-react";
import { ImageWithFallback } from "@/app/components/figma/ImageWithFallback";
import logoImg from "@/imports/PERFIL-Photoroom_-_copia.png";
import { descargarPdfCotizacion, imprimirPdfCotizacion } from "@/app/pdfCotizacion";
import { descargarPdfServicioRed, imprimirPdfServicioRed } from "@/app/pdfServicioRed";
import {
  persist, fetchAllCloud, fetchCloud, onSyncStatusChange, getFbUrl, getFbConfig, saveFbConfig, clearFbConfig,
  parseFirebaseConfigText, isFbConfigFromEnv, type FirebaseWebConfig,
  onAuthChange, getCurrentAuthUser, signInEmail, signOutFb, sendPasswordReset, createUserEmail,
  getUserProfile, setUserProfile, fetchAllUserProfiles,
} from "@/app/cloudSync";
import { requestNotifPermission, notifyBrowser } from "@/app/browserNotify";
import {
  BarChart as ReBarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from "recharts";

// ─── TYPES ───────────────────────────────────────────────────────────────────

type Role = "admin" | "tecnico" | "vendedor" | "visor";
type Permisos = {
  cotizador: boolean; seguimiento: boolean; catalogo: boolean; ventas: boolean;
  inventario: boolean; gastos: boolean; pagos: boolean; hojatrabajo: boolean;
  mantenimiento: boolean; usuarios: boolean; redes: boolean;
};
type User = {
  uid: string; nombre: string; email: string; rol: Role;
  permisos: Permisos; activo: boolean; creado: string; ultimoAcceso: string;
};
type Notif = {
  id: string; tipo: "info" | "warning" | "success" | "error";
  titulo: string; mensaje: string; fecha: string; leida: boolean; modulo: string;
};
type Producto = {
  id: string; nombre: string; marca: string; desc: string; precio: number;
  inversion: number; materiales: number; manoObra: number; sinFactura: boolean;
  proveedor: string; cat: string; unidad: string; gratis: boolean;
};
type CotItem = { id: string; qty: number; nombre: string; desc: string; precio: number };
type Cotizacion = {
  id: string; num: number; fecha: string; cliente: string; proyecto: string;
  email: string; whatsapp: string; ubicacion: string; validez: string;
  servicio: string; items: CotItem[]; subtotal: number;
  aplicaDescuento?: boolean; descuentoTipo?: "monto" | "porcentaje"; descuentoValor?: number; descuentoMonto?: number;
  aplicaIva?: boolean; ivaPct?: number; ivaMonto?: number;
  total: number;
  estado: "pendiente" | "enviada" | "aprobada" | "rechazada";
};
type Venta = {
  id: string; fecha: string; cliente: string; total: number; inversion: number; conFactura: boolean;
  facturaPdf?: string; facturaNombre?: string;
};
type ItemInv = { id: string; nombre: string; stock: number; minimo: number; precio: number };
type Gasto = { id: string; fecha: string; categoria: string; monto: number; descripcion: string };
type Pago = { id: string; cliente: string; total: number; recibido: number; tipo: "cobrar" | "pagar" };
type Mant = {
  id: string; equipo: string; tipo: string; fechaProxima: string;
  proveedor: string; notas: string; frecuenciaDias: number; completado: boolean;
};

// ── Redes ──
type EquipoRed = {
  id: string; modelo: string; marca?: string; serial?: string; mac?: string;
  ip?: string; puerto?: string; ubicacion?: string; estado?: string; fechaInstalacion?: string;
  garantia?: string;
};
type ArchivoRed = { id: string; nombre: string; data: string };
type HistorialRed = {
  id: string; fecha: string;
  tipo: "instalacion" | "modificacion" | "reemplazo" | "mantenimiento" | "incidencia" | "baja";
  tecnico: string; descripcion: string;
  motivo?: string;
  equipoAfectado?: string;
  antes?: string; despues?: string;
  costo?: number; precioCobrado?: number;
  fotos?: ArchivoRed[];
  documentos?: ArchivoRed[];
  resultado?: string;
  equiposRevisados?: string[];
};
type EstadoRed = "activo" | "pendiente" | "programado" | "mantenimiento" | "incidencia" | "suspendido" | "baja";
type ServicioRed = {
  id: string; codigoCliente: string; clienteNombre: string; clienteTelefono: string;
  clienteEmail?: string; clienteDireccion?: string; clienteObservaciones?: string;
  tipoServicio: string; proveedor: string; plan: string;
  estado: EstadoRed;
  equipos: EquipoRed[];
  historial: HistorialRed[];
  fechaInstalacion: string; ultimaModificacion: string;
  fechaUltimoMant?: string; fechaProximoMant?: string;
};

// ─── UTILS ───────────────────────────────────────────────────────────────────

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const fmt = (n: number) => "Q " + Number(n || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const ls = <T,>(k: string, def: T): T => { try { const d = localStorage.getItem(k); return d ? JSON.parse(d) : def; } catch { return def; } };
const lsSet = (k: string, v: unknown) => localStorage.setItem(k, JSON.stringify(v));
const today = () => new Date().toISOString().split("T")[0];
const diasHasta = (fecha: string) => Math.ceil((new Date(fecha).getTime() - Date.now()) / 86400000);

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

// Los permisos por defecto para la primera cuenta administradora se definen
// más abajo (ROLE_DEFAULT_PERMISOS.admin) — ya no existe una contraseña de
// fábrica escrita en el código. La primera cuenta se crea con Firebase
// Authentication (ver LoginScreen / bootstrap de administrador).

const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrador", tecnico: "Técnico", vendedor: "Vendedor", visor: "Solo Vista",
};
const ROLE_DEFAULT_PERMISOS: Record<Role, Partial<Permisos>> = {
  admin: { cotizador: true, seguimiento: true, catalogo: true, ventas: true, inventario: true, redes: true, gastos: true, pagos: true, hojatrabajo: true, mantenimiento: true, usuarios: true },
  tecnico: { hojatrabajo: true, mantenimiento: true, inventario: true, redes: true, catalogo: false, ventas: false, gastos: false, pagos: false, cotizador: false, seguimiento: false, usuarios: false },
  vendedor: { cotizador: true, seguimiento: true, catalogo: true, ventas: true, pagos: true, inventario: false, redes: false, gastos: false, hojatrabajo: false, mantenimiento: false, usuarios: false },
  visor: { cotizador: false, seguimiento: true, catalogo: true, ventas: true, inventario: true, redes: true, gastos: false, pagos: false, hojatrabajo: false, mantenimiento: true, usuarios: false },
};

const MODULOS: { id: keyof Permisos; label: string; icon: React.ReactNode }[] = [
  { id: "cotizador", label: "Cotizador", icon: <FileText size={14} /> },
  { id: "seguimiento", label: "Seguimiento", icon: <TrendingUp size={14} /> },
  { id: "catalogo", label: "Catálogo", icon: <Package size={14} /> },
  { id: "ventas", label: "Ventas", icon: <TrendingUp size={14} /> },
  { id: "inventario", label: "Inventario", icon: <Wallet size={14} /> },
  { id: "redes", label: "Redes", icon: <Wifi size={14} /> },
  { id: "gastos", label: "Gastos", icon: <DollarSign size={14} /> },
  { id: "pagos", label: "Pagos", icon: <DollarSign size={14} /> },
  { id: "hojatrabajo", label: "Hoja de Trabajo", icon: <ClipboardList size={14} /> },
  { id: "mantenimiento", label: "Mantenimiento", icon: <Wrench size={14} /> },
  { id: "usuarios", label: "Usuarios", icon: <Users size={14} /> },
];

const TABS = [
  { id: "cotizador", label: "Cotizador", icon: "📋" },
  { id: "seguimiento", label: "Seguimiento", icon: "📊" },
  { id: "catalogo", label: "Catálogo", icon: "📦" },
  { id: "ventas", label: "Ventas", icon: "💹" },
  { id: "inventario", label: "Inventario", icon: "🏦" },
  { id: "redes", label: "Redes", icon: "🌐" },
  { id: "gastos", label: "Gastos", icon: "💰" },
  { id: "pagos", label: "Pagos", icon: "💳" },
  { id: "hojatrabajo", label: "Hoja de Trabajo", icon: "📄" },
  { id: "mantenimiento", label: "Mantenimiento", icon: "🔧" },
  { id: "usuarios", label: "Usuarios", icon: "👥" },
];

const ESTADO_RED_LABELS: Record<EstadoRed, string> = {
  activo: "Activo", pendiente: "Pendiente", programado: "Programado",
  mantenimiento: "En Mantenimiento", incidencia: "Incidencia", suspendido: "Suspendido", baja: "Baja",
};
const ESTADO_RED_COLORS: Record<EstadoRed, string> = {
  activo: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  pendiente: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
  programado: "text-[#0ea5c8] bg-[#0ea5c8]/10 border-[#0ea5c8]/20",
  mantenimiento: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  incidencia: "text-red-400 bg-red-400/10 border-red-400/20",
  suspendido: "text-[#8090a8] bg-[#8090a8]/10 border-[#8090a8]/20",
  baja: "text-[#8090a8] bg-[#8090a8]/10 border-[#8090a8]/20",
};
const TIPOS_SERVICIO_RED = [
  "WiFi Mesh", "Cableado estructurado", "Router", "Switch", "Access Point",
  "Enlace inalámbrico", "VPN", "Red empresarial", "Administración remota",
  "Mantenimiento de red", "Cámaras IP", "NVR", "Otros servicios de infraestructura",
];
const HIST_TIPO_LABELS: Record<HistorialRed["tipo"], string> = {
  instalacion: "Instalación", modificacion: "Modificación", reemplazo: "Reemplazo",
  mantenimiento: "Mantenimiento", incidencia: "Incidencia", baja: "Baja",
};

const SERVICES = [
  { id: "inst_cam", ico: "📹", lbl: "Instalación Cámaras" },
  { id: "mant_cam", ico: "🔧", lbl: "Mantenimiento Cámaras" },
  { id: "mant_pc", ico: "💻", lbl: "Mantenimiento PC" },
  { id: "inst_bio", ico: "🔐", lbl: "Biométrico" },
  { id: "inst_sw", ico: "⚙️", lbl: "Instalación Software" },
  { id: "venta_sw", ico: "🪟", lbl: "Venta de Licencias" },
  { id: "mant_dvr", ico: "🖥️", lbl: "Mantenimiento DVR/NVR" },
  { id: "cam_adicional", ico: "➕", lbl: "Cámara Adicional" },
  { id: "cable_estr", ico: "🔌", lbl: "Cableado Estructurado" },
  { id: "cambio_dvr", ico: "🔄", lbl: "Cambio de Grabador" },
];

const CATS = ["Combos","CCTV y Videovigilancia","Hikvision","Dahua","ZKTeco","IP","Análogo","Control de Acceso","Redes","Redes y Cableado","Soporte Informático","Software y Licencias","Mano de Obra","Accesorios"];
const GAS_CATS = ["Gasolina","Herramientas","Repuestos","Transporte","Alimentación","Material","Otro"];
const PROVEEDORES = ["Smart Tec","Tech Corner","Box Security","Conectividad","Giganet","Viva Original","3S Simple Smart Solutions","Interno"];
const MARCAS = ["Hikvision","Dahua","ZKTeco","HiLook","WD (Western Digital)","Seagate","Samsung","Kingston","ESET","Kaspersky","SpryWire"];
const MANT_TIPOS = ["Limpieza de lentes","Cambio de batería","Actualización firmware","Revisión de cables","Cambio de HDD","Inspección física","Limpieza general","Otro"];
const ESTADO_COLORS: Record<string, string> = {
  pendiente: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
  enviada: "text-[#0ea5c8] bg-[#0ea5c8]/10 border-[#0ea5c8]/20",
  aprobada: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  rechazada: "text-red-400 bg-red-400/10 border-red-400/20",
};

const DEFAULT_CATALOG: Producto[] = [
  { id: uid(), nombre: "Combo Kit Dahua 4 Cámaras 2MP", marca: "Dahua", desc: "Sistema completo XVR 4 canales, disco duro, fuentes y 4 cámaras Bullet 2MP Full HD Smart Dual Light 25m.", precio: 1850, inversion: 1200, materiales: 150, manoObra: 300, sinFactura: false, proveedor: "Smart Tec", cat: "Combos", unidad: "combo", gratis: false },
  { id: uid(), nombre: "Combo Kit Dahua 8 Cámaras 2MP", marca: "Dahua", desc: "Sistema XVR 8 canales, disco 1TB, fuentes y 8 cámaras Bullet 2MP Full HD.", precio: 3200, inversion: 2100, materiales: 250, manoObra: 500, sinFactura: false, proveedor: "Smart Tec", cat: "Combos", unidad: "combo", gratis: false },
  { id: uid(), nombre: "Cámara Bullet 2MP Dahua/HiLook", marca: "Dahua", desc: "Cámara exterior Bullet Full HD 2MP, Smart Dual Light, 30m, IP67.", precio: 350, inversion: 220, materiales: 0, manoObra: 0, sinFactura: false, proveedor: "Smart Tec", cat: "CCTV y Videovigilancia", unidad: "unidad", gratis: false },
  { id: uid(), nombre: "Cámara Domo 2MP Dahua/HiLook", marca: "Dahua", desc: "Cámara interior/exterior tipo Domo 2MP Full HD, IR 20m, IP67.", precio: 320, inversion: 200, materiales: 0, manoObra: 0, sinFactura: false, proveedor: "Smart Tec", cat: "CCTV y Videovigilancia", unidad: "unidad", gratis: false },
  { id: uid(), nombre: "Grabador XVR 4 Canales Dahua", marca: "Dahua", desc: "Grabador XVR 4 canales compatible HDCVI/HDTVI/AHD. App remota.", precio: 600, inversion: 380, materiales: 0, manoObra: 0, sinFactura: false, proveedor: "Smart Tec", cat: "CCTV y Videovigilancia", unidad: "unidad", gratis: false },
  { id: uid(), nombre: "Grabador XVR 8 Canales Dahua", marca: "Dahua", desc: "Grabador XVR 8 canales, compatible analógico e IP. App DMSS.", precio: 850, inversion: 540, materiales: 0, manoObra: 0, sinFactura: false, proveedor: "Smart Tec", cat: "CCTV y Videovigilancia", unidad: "unidad", gratis: false },
  { id: uid(), nombre: "Disco Duro 1TB WD Purple", marca: "WD", desc: "Disco de vigilancia 1TB, grabación 24/7, compatible XVR/NVR.", precio: 450, inversion: 300, materiales: 0, manoObra: 0, sinFactura: false, proveedor: "Tech Corner", cat: "CCTV y Videovigilancia", unidad: "unidad", gratis: false },
  { id: uid(), nombre: "Biométrico ZKTeco Control Acceso", marca: "ZKTeco", desc: "Control de acceso biométrico, huella + RFID, 3000 huellas.", precio: 850, inversion: 520, materiales: 50, manoObra: 150, sinFactura: false, proveedor: "Box Security", cat: "Control de Acceso", unidad: "unidad", gratis: false },
  { id: uid(), nombre: "Licencia Windows 11 Home Original", marca: "", desc: "Licencia digital original Windows 11 Home, activación en línea.", precio: 400, inversion: 250, materiales: 0, manoObra: 50, sinFactura: false, proveedor: "", cat: "Software y Licencias", unidad: "licencia", gratis: false },
  { id: uid(), nombre: "Antivirus ESET 1 año", marca: "ESET", desc: "Licencia ESET NOD32 1 año, 1 dispositivo.", precio: 180, inversion: 100, materiales: 0, manoObra: 0, sinFactura: false, proveedor: "", cat: "Software y Licencias", unidad: "licencia", gratis: false },
  { id: uid(), nombre: "Mantenimiento Preventivo PC/Laptop", marca: "", desc: "Limpieza interna, cambio pasta térmica, verificación de componentes.", precio: 150, inversion: 20, materiales: 30, manoObra: 100, sinFactura: false, proveedor: "", cat: "Soporte Informático", unidad: "equipo", gratis: false },
  { id: uid(), nombre: "Instalación y Puesta en Marcha", marca: "", desc: "Mano de obra: montaje, configuración de red, vinculación de app móvil.", precio: 0, inversion: 0, materiales: 0, manoObra: 0, sinFactura: false, proveedor: "", cat: "Mano de Obra", unidad: "servicio", gratis: true },
];

const ZONAS_RIESGO: [string, number][] = [
  ["zona 18", 10], ["zona 3", 9], ["mixco zona 5", 8], ["villa hermosa", 8], ["petapa", 8],
  ["villa nueva", 7], ["mixco", 5], ["zona 6", 8], ["zona 17", 8], ["zona 21", 8],
  ["san juan sacatepéquez", 8], ["chinautla", 7], ["zona 1", 6], ["zona 12", 6],
];

function evaluarZona(dir: string): { riesgo: number; msg: string } | null {
  if (!dir.trim()) return null;
  const d = dir.toLowerCase();
  for (const [z, r] of ZONAS_RIESGO) {
    if (d.includes(z)) return {
      riesgo: r,
      msg: r >= 6 ? `⚠️ ZONA DE RIESGO ALTO: ${z.toUpperCase()} (Nivel ${r}/10)` : `✅ ${z} (Riesgo bajo ${r}/10)`
    };
  }
  return { riesgo: 0, msg: "✅ Zona verificada sin alertas de riesgo" };
}

// ─── SHARED COMPONENTS ───────────────────────────────────────────────────────

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-[#0b0e1a] border border-[#1a2235] rounded-xl p-5 mb-4 ${className}`}>
      {children}
    </div>
  );
}

function CardTitle({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] font-bold text-[#0ea5c8] uppercase tracking-[2px] mb-4">{children}</div>;
}

function Btn({ children, onClick, variant = "primary", size = "md", className = "", type = "button" }: {
  children: React.ReactNode; onClick?: () => void; variant?: "primary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md"; className?: string; type?: "button" | "submit";
}) {
  const base = "inline-flex items-center gap-1.5 font-semibold cursor-pointer rounded-lg border transition-all duration-150";
  const sizes = { sm: "px-3 py-1.5 text-xs", md: "px-4 py-2 text-sm" };
  const variants = {
    primary: "text-white border-transparent",
    ghost: "bg-[#060810] border-[#1a2235] text-[#c8d8e8] hover:border-[#0ea5c8] hover:text-white",
    danger: "bg-transparent border-red-500/40 text-red-400 hover:bg-red-500 hover:text-white",
    outline: "bg-transparent border-[#0ea5c8]/40 text-[#0ea5c8] hover:bg-[#0ea5c8]/10",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      style={variant === "primary" ? { background: "linear-gradient(135deg,#1a4fa8,#0ea5c8)" } : {}}
    >
      {children}
    </button>
  );
}

function Input({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  return (
    <div className={label ? "flex flex-col gap-1" : ""}>
      {label && <label className="text-[11px] text-[#8090a8] font-semibold uppercase tracking-wider">{label}</label>}
      <input
        {...props}
        className={`w-full bg-[#060810] border border-[#1a2235] rounded-lg px-3 py-2 text-[#e8e8f0] text-sm focus:outline-none focus:border-[#0ea5c8] transition-colors placeholder:text-[#3a4a5a] ${props.className || ""}`}
      />
    </div>
  );
}

function Select({ label, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  return (
    <div className={label ? "flex flex-col gap-1" : ""}>
      {label && <label className="text-[11px] text-[#8090a8] font-semibold uppercase tracking-wider">{label}</label>}
      <select
        {...props}
        className={`w-full bg-[#060810] border border-[#1a2235] rounded-lg px-3 py-2 text-[#e8e8f0] text-sm focus:outline-none focus:border-[#0ea5c8] transition-colors ${props.className || ""}`}
      >
        {children}
      </select>
    </div>
  );
}

function Textarea({ label, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }) {
  return (
    <div className={label ? "flex flex-col gap-1" : ""}>
      {label && <label className="text-[11px] text-[#8090a8] font-semibold uppercase tracking-wider">{label}</label>}
      <textarea
        {...props}
        className={`w-full bg-[#060810] border border-[#1a2235] rounded-lg px-3 py-2 text-[#e8e8f0] text-sm focus:outline-none focus:border-[#0ea5c8] transition-colors placeholder:text-[#3a4a5a] resize-y min-h-[70px] ${props.className || ""}`}
      />
    </div>
  );
}

function Modal({ open, onClose, title, children, width = "max-w-lg" }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode; width?: string;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={e => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            className={`bg-[#0b0e1a] border border-[#1a2235] rounded-2xl w-full ${width} max-h-[90vh] overflow-y-auto`}
            initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#1a2235]">
              <h3 className="text-base font-bold text-white">{title}</h3>
              <button onClick={onClose} className="text-[#8090a8] hover:text-white transition-colors"><X size={18} /></button>
            </div>
            <div className="p-6">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${className}`}>{children}</span>;
}

function StatCard({ label, value, color = "#0ea5c8" }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="bg-[#060810] rounded-xl p-4 text-center border border-[#1a2235]">
      <div className="text-2xl font-black mb-1" style={{ color }}>{value}</div>
      <div className="text-[11px] text-[#8090a8]">{label}</div>
    </div>
  );
}

function EmptyState({ icon = "📭", msg }: { icon?: string; msg: string }) {
  return (
    <div className="text-center py-12 text-[#8090a8]">
      <div className="text-4xl mb-3">{icon}</div>
      <p className="text-sm">{msg}</p>
    </div>
  );
}

// ─── SPLASH SCREEN ───────────────────────────────────────────────────────────

function SplashScreen({ onDone }: { onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 2400); return () => clearTimeout(t); }, [onDone]);
  return (
    <motion.div
      className="fixed inset-0 flex flex-col items-center justify-center bg-[#07090f] z-[999]"
      exit={{ opacity: 0 }} transition={{ duration: 0.5 }}
    >
      <motion.div
        className="flex flex-col items-center gap-5"
        initial={{ opacity: 0, scale: 0.8, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
      >
        <div className="w-28 h-28 drop-shadow-[0_0_30px_rgba(14,165,200,0.4)]">
          <ImageWithFallback src={logoImg} alt="Zento Data" className="w-full h-full object-contain" />
        </div>
        <div className="text-center">
          <div className="text-3xl font-black text-white tracking-tight">
            Zento<span className="text-[#0ea5c8]">Data</span>
          </div>
          <div className="text-[#8090a8] text-xs mt-1.5 tracking-[3px] uppercase font-medium">Sistema de Gestión</div>
        </div>
        <motion.div className="flex gap-1.5 mt-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}>
          {[0, 1, 2].map(i => (
            <motion.div key={i} className="w-2 h-2 rounded-full bg-[#0ea5c8]"
              animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.25 }} />
          ))}
        </motion.div>
      </motion.div>
      <motion.div
        className="absolute bottom-8 text-[10px] text-[#2a3a4a] tracking-widest uppercase"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}
      >
        Seguridad Electrónica · Guatemala
      </motion.div>
    </motion.div>
  );
}

// ─── LOGIN SCREEN ────────────────────────────────────────────────────────────

function LoginScreen({ onLogin, fbReady }: { onLogin: (email: string, password: string) => Promise<void>; fbReady: boolean }) {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!fbReady) { setErr("Firebase todavía no está configurado en este entorno. Contacta al administrador."); return; }
    setErr(""); setLoading(true);
    try {
      await onLogin(email, pw);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || "";
      const mensajes: Record<string, string> = {
        "auth/invalid-credential": "Email o contraseña incorrectos.",
        "auth/wrong-password": "Email o contraseña incorrectos.",
        "auth/user-not-found": "No existe una cuenta con ese email.",
        "auth/invalid-email": "El email no es válido.",
        "auth/user-disabled": "Esta cuenta fue deshabilitada.",
        "auth/too-many-requests": "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.",
        "auth/network-request-failed": "Sin conexión a internet.",
      };
      setErr(mensajes[code] || "No se pudo iniciar sesión. Verifica tus credenciales.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[#07090f] px-4">
      <motion.div className="w-full max-w-sm" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 mb-4 drop-shadow-[0_0_20px_rgba(14,165,200,0.3)]">
            <ImageWithFallback src={logoImg} alt="Zento Data" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-2xl font-black text-white">Zento<span className="text-[#0ea5c8]">Data</span></h1>
          <p className="text-[#8090a8] text-xs mt-1 tracking-widest uppercase">Ingresa tus credenciales</p>
        </div>
        <form onSubmit={submit} className="bg-[#0b0e1a] border border-[#1a2235] rounded-2xl p-6 space-y-4">
          <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="correo@empresa.com" required />
          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-[#8090a8] font-semibold uppercase tracking-wider">Contraseña</label>
            <div className="relative">
              <input type={showPw ? "text" : "password"} value={pw} onChange={e => setPw(e.target.value)}
                className="w-full bg-[#060810] border border-[#1a2235] rounded-lg px-3 py-2 text-[#e8e8f0] text-sm focus:outline-none focus:border-[#0ea5c8] transition-colors pr-10"
                placeholder="••••••••" required />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8090a8] hover:text-white">
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>
          {err && <p className="text-red-400 text-xs">{err}</p>}
          <button type="submit" disabled={loading} className="w-full py-2.5 rounded-xl font-bold text-white text-sm transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ background: "linear-gradient(135deg,#1a4fa8,#0ea5c8)" }}>
            {loading ? "Ingresando..." : "Ingresar al sistema"}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

// ─── (Ya no existe pantalla de cambio de contraseña de fábrica: Firebase
// Authentication administra las contraseñas de forma segura, y las cuentas
// nuevas se crean directamente con la contraseña que el administrador elige.) ──

// ─── NOTIFICATION PANEL ───────────────────────────────────────────────────────

function NotifIcon({ tipo }: { tipo: Notif["tipo"] }) {
  if (tipo === "warning") return <AlertTriangle size={14} className="text-yellow-400" />;
  if (tipo === "error") return <AlertTriangle size={14} className="text-red-400" />;
  if (tipo === "success") return <CheckCircle2 size={14} className="text-emerald-400" />;
  return <Info size={14} className="text-[#0ea5c8]" />;
}

function NotifPanel({ notifs, onMarkAll, onMarkOne, onClear, onClose }: {
  notifs: Notif[]; onMarkAll: () => void; onMarkOne: (id: string) => void; onClear: () => void; onClose: () => void;
}) {
  const unread = notifs.filter(n => !n.leida).length;
  return (
    <motion.div
      className="absolute right-0 top-full mt-2 w-80 bg-[#0b0e1a] border border-[#1a2235] rounded-2xl shadow-2xl z-50 overflow-hidden"
      initial={{ opacity: 0, y: -8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.97 }} transition={{ duration: 0.15 }}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a2235]">
        <div className="flex items-center gap-2">
          <Bell size={14} className="text-[#0ea5c8]" />
          <span className="text-sm font-bold text-white">Notificaciones</span>
          {unread > 0 && <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#0ea5c8] text-white">{unread}</span>}
        </div>
        <div className="flex items-center gap-2">
          {unread > 0 && <button onClick={onMarkAll} className="text-[10px] text-[#0ea5c8] hover:underline">Leer todo</button>}
          {notifs.length > 0 && <button onClick={onClear} className="text-[10px] text-[#8090a8] hover:text-red-400">Limpiar</button>}
          <button onClick={onClose} className="text-[#8090a8] hover:text-white"><X size={14} /></button>
        </div>
      </div>
      <div className="overflow-y-auto max-h-80">
        {notifs.length === 0 ? (
          <div className="py-10 text-center text-[#8090a8] text-xs">Sin notificaciones</div>
        ) : notifs.slice(0, 20).map(n => (
          <div key={n.id} onClick={() => onMarkOne(n.id)}
            className={`px-4 py-3 border-b border-[#0f1220] cursor-pointer hover:bg-[#0f1422] transition-colors ${!n.leida ? "bg-[#0f1828]" : ""}`}>
            <div className="flex items-start gap-2">
              <div className="mt-0.5"><NotifIcon tipo={n.tipo} /></div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-white truncate">{n.titulo}</div>
                <div className="text-[11px] text-[#8090a8] mt-0.5 leading-snug">{n.mensaje}</div>
                <div className="text-[10px] text-[#3a4a5a] mt-1">{new Date(n.fecha).toLocaleString("es-GT")}</div>
              </div>
              {!n.leida && <div className="w-1.5 h-1.5 rounded-full bg-[#0ea5c8] mt-1.5 flex-shrink-0" />}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ─── TOP NAV ─────────────────────────────────────────────────────────────────

function TopNav({ user, activeTab, setActiveTab, notifs, onMarkAll, onMarkOne, onClearNotifs, onLogout, onToggleSidebar, syncStatus, fbConfigured }: {
  user: User; activeTab: string; setActiveTab: (t: string) => void; notifs: Notif[];
  onMarkAll: () => void; onMarkOne: (id: string) => void; onClearNotifs: () => void;
  onLogout: () => void; onToggleSidebar: () => void;
  syncStatus: "idle" | "syncing" | "synced" | "offline" | "error"; fbConfigured: boolean;
}) {
  const [showNotifs, setShowNotifs] = useState(false);
  const unread = notifs.filter(n => !n.leida).length;
  const visibleTabs = TABS.filter(t => user.permisos[t.id as keyof Permisos]);

  return (
    <header className="bg-[#05060e] border-b border-[#1a2235] sticky top-0 z-40">
      <div className="flex items-center gap-0 h-12 px-4">
        <button onClick={onToggleSidebar} className="md:hidden mr-3 text-[#8090a8] hover:text-white">
          <Menu size={20} />
        </button>
        <div className="text-base font-black text-white mr-6 whitespace-nowrap flex items-center gap-2">
          <span className="w-6 h-6 inline-block">
            <ImageWithFallback src={logoImg} alt="" className="w-full h-full object-contain" />
          </span>
          Zento<span className="text-[#0ea5c8]">Data</span>
        </div>
        <nav className="hidden md:flex items-center overflow-x-auto flex-1">
          {visibleTabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`px-3.5 py-3 text-[13px] font-semibold whitespace-nowrap border-b-2 transition-all
                ${activeTab === t.id ? "text-white border-[#0ea5c8]" : "text-[#8090a8] border-transparent hover:text-[#c8d8e8]"}`}>
              {t.icon} {t.label}
            </button>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {fbConfigured && (
            <div title={syncStatus === "syncing" ? "Sincronizando con la nube..." : syncStatus === "offline" ? "Sin conexión — se sincronizará al reconectar" : syncStatus === "error" ? "Error al sincronizar" : "Sincronizado con la nube"}
              className="hidden sm:flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full border"
              style={{
                color: syncStatus === "syncing" ? "#f59e0b" : syncStatus === "offline" || syncStatus === "error" ? "#ef4444" : "#10b981",
                borderColor: syncStatus === "syncing" ? "#f59e0b33" : syncStatus === "offline" || syncStatus === "error" ? "#ef444433" : "#10b98133",
                backgroundColor: syncStatus === "syncing" ? "#f59e0b0d" : syncStatus === "offline" || syncStatus === "error" ? "#ef44440d" : "#10b9810d",
              }}>
              <span>{syncStatus === "syncing" ? "☁️" : syncStatus === "offline" || syncStatus === "error" ? "⚠️" : "☁️"}</span>
              {syncStatus === "syncing" ? "Sincronizando" : syncStatus === "offline" ? "Sin conexión" : syncStatus === "error" ? "Error" : "Sincronizado"}
            </div>
          )}
          <div className="relative">
            <button onClick={() => setShowNotifs(!showNotifs)}
              className="relative p-2 text-[#8090a8] hover:text-white transition-colors rounded-lg hover:bg-[#0f1422]">
              <Bell size={18} />
              {unread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#0ea5c8] text-white text-[9px] font-bold flex items-center justify-center">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </button>
            <AnimatePresence>
              {showNotifs && (
                <NotifPanel notifs={notifs} onMarkAll={onMarkAll} onMarkOne={onMarkOne} onClear={onClearNotifs}
                  onClose={() => setShowNotifs(false)} />
              )}
            </AnimatePresence>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs text-[#8090a8] px-2 border-l border-[#1a2235]">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#1a4fa8] to-[#0ea5c8] flex items-center justify-center text-white font-bold text-[10px]">
              {user.nombre.charAt(0).toUpperCase()}
            </div>
            <span className="text-[#c8d8e8] font-medium">{user.nombre.split(" ")[0]}</span>
          </div>
          <button onClick={onLogout} className="p-2 text-[#8090a8] hover:text-red-400 transition-colors rounded-lg hover:bg-[#0f1422]" title="Salir">
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </header>
  );
}

// ─── SIDEBAR MOBILE ───────────────────────────────────────────────────────────

function Sidebar({ open, onClose, user, activeTab, setActiveTab }: {
  open: boolean; onClose: () => void; user: User; activeTab: string; setActiveTab: (t: string) => void;
}) {
  const visibleTabs = TABS.filter(t => user.permisos[t.id as keyof Permisos]);
  return (
    <>
      <AnimatePresence>
        {open && <motion.div className="fixed inset-0 bg-black/50 z-[35]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />}
      </AnimatePresence>
      <motion.aside
        className="fixed left-0 top-0 h-full w-72 bg-[#0b0e1a] border-r border-[#1a2235] z-40 flex flex-col pt-14 overflow-y-auto"
        initial={{ x: -288 }} animate={{ x: open ? 0 : -288 }} transition={{ type: "spring", damping: 30, stiffness: 300 }}
      >
        <div className="px-4 py-3 border-b border-[#1a2235] flex items-center justify-between">
          <span className="text-[11px] text-[#0ea5c8] font-bold uppercase tracking-[2px]">Menú Principal</span>
          <button onClick={onClose} className="text-[#8090a8] hover:text-white"><X size={16} /></button>
        </div>
        <nav className="flex-1 py-2">
          {visibleTabs.map(t => (
            <button key={t.id} onClick={() => { setActiveTab(t.id); onClose(); }}
              className={`w-full text-left px-5 py-3 text-sm font-medium transition-all border-l-2
                ${activeTab === t.id ? "bg-[#0ea5c8]/10 text-white border-[#0ea5c8]" : "text-[#c8d8e8] border-transparent hover:bg-[#0f1422] hover:text-white"}`}>
              {t.icon} {t.label}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-[#1a2235]">
          <div className="text-xs text-[#8090a8]">
            <div className="font-semibold text-[#c8d8e8]">{user.nombre}</div>
            <div className="mt-0.5 capitalize">{ROLE_LABELS[user.rol]}</div>
          </div>
        </div>
      </motion.aside>
    </>
  );
}

// ─── TOAST HOOK ──────────────────────────────────────────────────────────────

function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  const show = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 3000); };
  return { msg, show };
}

// ─── TOAST ────────────────────────────────────────────────────────────────────

function Toast({ msg }: { msg: string | null }) {
  return (
    <AnimatePresence>
      {msg && (
        <motion.div
          className="fixed bottom-5 right-5 left-5 sm:left-auto sm:max-w-xs bg-[#0ea5c8] text-white px-4 py-2.5 rounded-xl text-sm font-semibold z-[999] shadow-xl"
          initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          {msg}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── PAGE: COTIZADOR ──────────────────────────────────────────────────────────

function CotizadorPage({ catalog, cotizaciones, setCotizaciones, showToast, addNotif, fbUrl, onFbConfigSaved, onFbDisconnect }: {
  catalog: Producto[]; cotizaciones: Cotizacion[]; setCotizaciones: (c: Cotizacion[]) => void;
  showToast: (m: string) => void; addNotif: (n: Omit<Notif, "id" | "fecha" | "leida">) => void;
  fbUrl: string; onFbConfigSaved: (config: FirebaseWebConfig) => void; onFbDisconnect: () => void;
}) {
  const [svc, setSvc] = useState<string | null>(null);
  const [items, setItems] = useState<CotItem[]>([{ id: uid(), qty: 1, nombre: "", desc: "", precio: 0 }]);
  const [form, setForm] = useState({ cliente: "", proyecto: "", email: "", whatsapp: "", ubicacion: "", fecha: today(), validez: "15 días calendario" });
  const [zonaAlert, setZonaAlert] = useState<{ riesgo: number; msg: string } | null>(null);
  const [showHist, setShowHist] = useState(false);
  const [fbConfigText, setFbConfigText] = useState("");
  const [fbConfigErr, setFbConfigErr] = useState("");
  const [showFb, setShowFb] = useState(!getFbConfig());
  const [pdfCot, setPdfCot] = useState<Cotizacion | null>(null);
  const [aplicaDescuento, setAplicaDescuento] = useState(false);
  const [descuentoTipo, setDescuentoTipo] = useState<"monto" | "porcentaje">("porcentaje");
  const [descuentoValor, setDescuentoValor] = useState(0);
  const [aplicaIva, setAplicaIva] = useState(false);
  const [ivaPct, setIvaPct] = useState(5);

  const subtotal = items.reduce((a, i) => a + (i.qty * i.precio), 0);
  const descuentoMonto = aplicaDescuento ? Math.min(descuentoTipo === "porcentaje" ? subtotal * (descuentoValor / 100) : descuentoValor, subtotal) : 0;
  const baseGravable = Math.max(subtotal - descuentoMonto, 0);
  const ivaMonto = aplicaIva ? baseGravable * (ivaPct / 100) : 0;
  const total = baseGravable + ivaMonto;

  function addItem() { setItems([...items, { id: uid(), qty: 1, nombre: "", desc: "", precio: 0 }]); }
  function delItem(id: string) { setItems(items.filter(i => i.id !== id)); }
  function updItem(id: string, k: keyof CotItem, v: string | number) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, [k]: v } : i));
  }
  function fromCatalog(id: string, itemId: string) {
    const p = catalog.find(x => x.id === id);
    if (!p) return;
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, nombre: p.nombre, desc: p.desc, precio: p.precio } : i));
  }

  function guardar() {
    if (!form.cliente) { showToast("⚠️ El cliente es requerido"); return; }
    const num = cotizaciones.length + 1;
    const cot: Cotizacion = {
      id: `COT-${String(num).padStart(4,"0")}`,
      num, ...form, servicio: svc || "", items, subtotal,
      aplicaDescuento, descuentoTipo, descuentoValor, descuentoMonto,
      aplicaIva, ivaPct, ivaMonto,
      total,
      estado: "pendiente",
    };
    const next = [cot, ...cotizaciones];
    setCotizaciones(next);
    persist("zCotizaciones", next);
    addNotif({ tipo: "success", titulo: "Nueva cotización creada", mensaje: `${cot.id} — ${form.cliente} por ${fmt(total)}`, modulo: "cotizador" });
    showToast("✅ Cotización guardada en el historial");
    setPdfCot(cot);
  }

  function checkZona(v: string) {
    setForm(f => ({ ...f, ubicacion: v }));
    setZonaAlert(evaluarZona(v));
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-black text-white">Generar Cotización</h2>
          <p className="text-sm text-[#8090a8] mt-0.5">Completa los campos para generar tu cotización</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Btn onClick={guardar}>💾 Guardar</Btn>
          <Btn variant="ghost" onClick={() => setShowHist(true)}>📋 Historial</Btn>
        </div>
      </div>

      {isFbConfigFromEnv() ? (
        <div className="bg-[#0a1f14] border border-emerald-800/50 rounded-xl p-3 mb-4 text-xs text-emerald-300 flex items-center gap-2">
          ☁️ Firebase configurado globalmente desde Vercel (variables de entorno) — todos los dispositivos que entren a la app usan la misma base de datos automáticamente. No necesitas configurar nada aquí.
        </div>
      ) : (
        <>
          {showFb && (
            <div className="bg-[#091520] border border-[#1a4fa8] rounded-xl p-4 mb-4 text-sm text-[#c8d8e8]">
              <strong className="text-white">☁️ Configuración Firebase (con autenticación)</strong>
              <p className="text-xs text-amber-400/90 mt-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                ⚠️ Esta configuración solo se guarda en <strong>este navegador</strong>. Si abres la app desde otro celular o computadora, tendrás que repetirla ahí también — y si difiere, verás usuarios/datos distintos. Para que todos los dispositivos compartan automáticamente la misma base, pide que se configuren las variables <code>VITE_FIREBASE_*</code> en Vercel (ver guía).
              </p>
              <p className="text-xs text-[#8090a8] mt-2">
                1. Ve a la <strong>Consola de Firebase</strong> → tu proyecto → ⚙️ Configuración del proyecto → "Tus apps" → copia el objeto <code className="text-[#0ea5c8]">firebaseConfig</code>.<br />
                2. En <strong>Authentication → Sign-in method</strong>, habilita el proveedor <strong>"Anónimo"</strong>.<br />
                3. Pega aquí abajo el objeto completo (tal cual, con las llaves {"{ }"} incluidas):
              </p>
              <textarea value={fbConfigText} onChange={e => setFbConfigText(e.target.value)} rows={6}
                placeholder={'const firebaseConfig = {\n  apiKey: "...",\n  authDomain: "tu-proyecto.firebaseapp.com",\n  databaseURL: "https://tu-proyecto-default-rtdb.firebaseio.com",\n  projectId: "tu-proyecto",\n  ...\n};'}
                className="w-full mt-2 bg-[#060810] border border-[#1a2235] rounded-lg px-3 py-2 text-xs text-[#e8e8f0] font-mono focus:outline-none focus:border-[#0ea5c8]" />
              {fbConfigErr && <p className="text-red-400 text-xs mt-1">{fbConfigErr}</p>}
              <div className="flex gap-2 mt-2">
                <Btn onClick={() => {
                  const parsed = parseFirebaseConfigText(fbConfigText);
                  if (!parsed) { setFbConfigErr("⚠️ No se encontraron apiKey, databaseURL y projectId. Verifica que hayas pegado el objeto completo."); return; }
                  setFbConfigErr("");
                  onFbConfigSaved(parsed);
                  setShowFb(false);
                  showToast("✅ Firebase configurado con autenticación — sincronizando todos los módulos");
                }}>Guardar y conectar</Btn>
                {fbUrl && <Btn variant="ghost" onClick={() => setShowFb(false)}>Cancelar</Btn>}
              </div>
              <p className="text-[10px] text-[#5a6a80] mt-2">
                No olvides actualizar las reglas de tu Realtime Database a <code>"auth != null"</code> una vez que confirmes que la sincronización funciona.
              </p>
            </div>
          )}
          {!showFb && fbUrl && (
            <div className="flex items-center gap-3 mb-3">
              <button onClick={() => setShowFb(true)} className="text-xs text-[#0ea5c8] hover:text-white flex items-center gap-1">
                ☁️ Firebase conectado (con autenticación) — cambiar configuración
              </button>
              <button onClick={() => { if (confirm("¿Desconectar Firebase? Los datos dejarán de sincronizarse con la nube (seguirán en este dispositivo).")) { clearFbConfig(); onFbDisconnect(); showToast("☁️ Firebase desconectado"); } }}
                className="text-xs text-red-400 hover:text-red-300">
                Desconectar
              </button>
            </div>
          )}
        </>
      )}

      <Card>
        <CardTitle>1. Tipo de Servicio</CardTitle>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {SERVICES.map(s => (
            <button key={s.id} onClick={() => setSvc(svc === s.id ? null : s.id)}
              className={`flex items-center gap-2 p-3 rounded-xl text-left text-sm font-medium border-2 transition-all
                ${svc === s.id ? "border-[#0ea5c8] bg-[#091520] text-white" : "border-[#1a2235] bg-[#060810] text-[#c8d8e8] hover:border-[#2a3a5a]"}`}>
              <span className="text-lg">{s.ico}</span><span className="leading-tight text-xs">{s.lbl}</span>
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <CardTitle>2. Datos del Cliente</CardTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input label="Cliente *" value={form.cliente} onChange={e => setForm(f => ({ ...f, cliente: e.target.value }))} placeholder="Nombre completo" />
          <Input label="Proyecto" value={form.proyecto} onChange={e => setForm(f => ({ ...f, proyecto: e.target.value }))} placeholder="Descripción breve" />
          <Input label="Email" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@ejemplo.com" />
          <Input label="WhatsApp" value={form.whatsapp} onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))} placeholder="+502 XXXX-XXXX" />
          <div className="sm:col-span-2">
            <Input label="Ubicación" value={form.ubicacion} onChange={e => checkZona(e.target.value)} placeholder="Dirección completa" />
            {zonaAlert && (
              <div className={`mt-2 rounded-lg p-2.5 text-xs flex items-start gap-2 ${zonaAlert.riesgo >= 6 ? "bg-red-500/10 border border-red-500/20 text-red-300" : "bg-emerald-500/10 border border-emerald-500/20 text-emerald-300"}`}>
                <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" />
                <span>{zonaAlert.msg}</span>
              </div>
            )}
          </div>
          <Input label="Fecha" type="date" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} />
          <Input label="Validez" value={form.validez} onChange={e => setForm(f => ({ ...f, validez: e.target.value }))} />
        </div>
      </Card>

      <Card>
        <CardTitle>3. Productos / Servicios</CardTitle>
        <div className="grid grid-cols-[50px_1fr_100px_90px_30px] gap-1.5 mb-1 px-0.5">
          {["Cant.", "Producto / Servicio", "P. Unit.", "Total", ""].map((h, i) => (
            <div key={i} className={`text-[10px] font-bold text-[#8090a8] uppercase ${i >= 2 ? "text-right" : ""}`}>{h}</div>
          ))}
        </div>
        {items.map(item => (
          <div key={item.id} className="grid grid-cols-[50px_1fr_100px_90px_30px] gap-1.5 items-start py-2 border-b border-[#0f1220] min-w-0">
            <input type="number" min="1" value={item.qty} onChange={e => updItem(item.id, "qty", +e.target.value)}
              className="bg-[#060810] border border-[#1a2235] rounded-lg px-2 py-1.5 text-sm text-[#e8e8f0] text-center focus:outline-none focus:border-[#0ea5c8] w-full min-w-0" />
            <div className="flex flex-col gap-1 min-w-0">
              <select
                value={catalog.find(p => p.nombre === item.nombre)?.id || ""}
                onChange={e => {
                  if (e.target.value) {
                    fromCatalog(e.target.value, item.id);
                  } else {
                    updItem(item.id, "nombre", "");
                    updItem(item.id, "desc", "");
                    updItem(item.id, "precio", 0);
                  }
                }}
                className="bg-[#060810] border border-[#1a2235] rounded-lg px-2 py-1.5 text-sm text-[#e8e8f0] focus:outline-none focus:border-[#0ea5c8] w-full min-w-0"
              >
                <option value="">— Seleccionar producto del catálogo —</option>
                {catalog.map(p => (
                  <option key={p.id} value={p.id}>{p.nombre}{p.marca ? ` · ${p.marca}` : ""}</option>
                ))}
              </select>
              <input value={item.desc} onChange={e => updItem(item.id, "desc", e.target.value)} placeholder="Descripción (opcional)"
                className="bg-[#060810] border border-[#1a2235] rounded-lg px-2 py-1.5 text-xs text-[#8090a8] focus:outline-none focus:border-[#0ea5c8] w-full min-w-0" />
            </div>
            <input type="number" min="0" step="0.01" value={item.precio} onChange={e => updItem(item.id, "precio", +e.target.value)}
              className="bg-[#060810] border border-[#1a2235] rounded-lg px-2 py-1.5 text-sm text-[#e8e8f0] text-right focus:outline-none focus:border-[#0ea5c8] w-full min-w-0" />
            <div className="text-right text-sm font-bold text-white pt-1.5 truncate">{fmt(item.qty * item.precio)}</div>
            <button onClick={() => delItem(item.id)} className="text-red-400 hover:text-red-300 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-500/10 mt-1">
              <X size={14} />
            </button>
          </div>
        ))}
        <button onClick={addItem} className="w-full mt-3 py-2 border border-dashed border-[#1a2235] rounded-xl text-[#0ea5c8] text-sm font-semibold hover:border-[#0ea5c8] transition-colors">
          + Agregar ítem
        </button>

        <div className="flex flex-wrap gap-2 mt-4">
          <button type="button" onClick={() => setAplicaDescuento(v => !v)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all
              ${aplicaDescuento ? "bg-amber-500/10 border-amber-500 text-amber-400" : "bg-[#060810] border-[#1a2235] text-[#8090a8] hover:text-white"}`}>
            🏷️ Descuento
          </button>
          <button type="button" onClick={() => setAplicaIva(v => !v)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all
              ${aplicaIva ? "bg-[#0ea5c8]/10 border-[#0ea5c8] text-[#0ea5c8]" : "bg-[#060810] border-[#1a2235] text-[#8090a8] hover:text-white"}`}>
            🧾 IVA
          </button>
        </div>

        {aplicaDescuento && (
          <div className="flex items-end gap-2 mt-3 flex-wrap">
            <div>
              <label className="text-xs font-semibold text-[#8090a8] mb-1.5 block">Tipo</label>
              <select value={descuentoTipo} onChange={e => setDescuentoTipo(e.target.value as "monto" | "porcentaje")}
                className="bg-[#060810] border border-[#1a2235] rounded-lg px-2 py-1.5 text-sm text-[#e8e8f0] h-[38px] focus:outline-none focus:border-[#0ea5c8]">
                <option value="porcentaje">Porcentaje (%)</option>
                <option value="monto">Monto (Q)</option>
              </select>
            </div>
            <div className="w-32">
              <Input label={descuentoTipo === "monto" ? "Descuento (Q)" : "Descuento (%)"} type="number" min="0" step="0.01"
                value={descuentoValor || ""} onChange={e => setDescuentoValor(+e.target.value)} />
            </div>
          </div>
        )}

        {aplicaIva && (
          <div className="w-32 mt-3">
            <Input label="IVA — Peq. Contribuyente (%)" type="number" min="0" step="0.01" value={ivaPct} onChange={e => setIvaPct(+e.target.value)} />
          </div>
        )}

        <div className="flex justify-end mt-4">
          <div className="bg-[#060810] border border-[#1a2235] rounded-xl px-5 py-3 min-w-48">
            <div className="flex justify-between text-sm py-1 gap-8"><span className="text-[#8090a8]">Subtotal</span><span className="text-[#0ea5c8]">{fmt(subtotal)}</span></div>
            {aplicaDescuento && descuentoMonto > 0 && (
              <div className="flex justify-between text-sm py-1 gap-8">
                <span className="text-amber-400">Descuento{descuentoTipo === "porcentaje" ? ` (${descuentoValor}%)` : ""}</span>
                <span className="text-amber-400">– {fmt(descuentoMonto)}</span>
              </div>
            )}
            {aplicaIva && (
              <div className="flex justify-between text-sm py-1 gap-8">
                <span className="text-[#8090a8]">IVA — Peq. Contribuyente ({ivaPct}%)</span>
                <span className="text-[#0ea5c8]">{fmt(ivaMonto)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-black py-1 border-t border-[#1a2235] mt-1 pt-2 gap-8"><span className="text-white">TOTAL</span><span className="text-[#0ea5c8]">{fmt(total)}</span></div>
          </div>
        </div>
      </Card>

      <Modal open={showHist} onClose={() => setShowHist(false)} title="Historial de Cotizaciones" width="max-w-2xl">
        {cotizaciones.length === 0 ? <EmptyState msg="Sin cotizaciones guardadas" /> : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {cotizaciones.map(c => (
              <div key={c.id} className="flex items-center justify-between p-3 bg-[#060810] rounded-xl border border-[#1a2235] gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white truncate">{c.id} — {c.cliente}</div>
                  <div className="text-xs text-[#8090a8] mt-0.5">{c.fecha} · {fmt(c.total)}</div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge className={ESTADO_COLORS[c.estado]}>{c.estado}</Badge>
                  <button title="Descargar PDF" onClick={() => descargarPdfCotizacion(c)}
                    className="text-[#0ea5c8] hover:text-white w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#0ea5c8]/10">
                    <Download size={14} />
                  </button>
                  <button title="Imprimir" onClick={() => imprimirPdfCotizacion(c)}
                    className="text-[#0ea5c8] hover:text-white w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#0ea5c8]/10">
                    <FileText size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>

      <Modal open={!!pdfCot} onClose={() => setPdfCot(null)} title="Cotización guardada" width="max-w-md">
        {pdfCot && (
          <div className="text-center py-2">
            <div className="w-14 h-14 rounded-full bg-[#0ea5c8]/10 flex items-center justify-center mx-auto mb-3">
              <FileText size={26} className="text-[#0ea5c8]" />
            </div>
            <div className="text-white font-bold text-lg">{pdfCot.id}</div>
            <div className="text-sm text-[#8090a8] mt-1 mb-5">{pdfCot.cliente} · {fmt(pdfCot.total)}</div>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Btn onClick={() => { descargarPdfCotizacion(pdfCot); }}>
                <Download size={14} /> Descargar PDF
              </Btn>
              <Btn variant="ghost" onClick={() => { imprimirPdfCotizacion(pdfCot); }}>
                🖨️ Imprimir
              </Btn>
            </div>
            <button onClick={() => setPdfCot(null)} className="text-xs text-[#8090a8] hover:text-white mt-4">
              Cerrar
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ─── PAGE: SEGUIMIENTO ────────────────────────────────────────────────────────

function SeguimientoPage({ cotizaciones, setCotizaciones, showToast, addNotif }: {
  cotizaciones: Cotizacion[]; setCotizaciones: (c: Cotizacion[]) => void; showToast: (m: string) => void;
  addNotif: (n: Omit<Notif, "id" | "fecha" | "leida">) => void;
}) {
  const [filter, setFilter] = useState("todas");
  const filtered = filter === "todas" ? cotizaciones : cotizaciones.filter(c => c.estado === filter);

  function changeEstado(id: string, estado: Cotizacion["estado"]) {
    const next = cotizaciones.map(c => c.id === id ? { ...c, estado } : c);
    setCotizaciones(next); persist("zCotizaciones", next); showToast("✅ Estado actualizado");
    const c = cotizaciones.find(x => x.id === id);
    if (c) addNotif({ tipo: "info", titulo: "Estado de cotización actualizado", mensaje: `${c.id} — ${c.cliente} ahora está ${estado}`, modulo: "seguimiento" });
  }

  function eliminarCotizacion(id: string) {
    const c = cotizaciones.find(x => x.id === id);
    if (!confirm(`¿Eliminar la cotización ${c?.id}? Esta acción no se puede deshacer.`)) return;
    const next = cotizaciones.filter(x => x.id !== id);
    setCotizaciones(next); persist("zCotizaciones", next); showToast("🗑️ Cotización eliminada");
    addNotif({ tipo: "warning", titulo: "Cotización eliminada", mensaje: `${c?.id} — ${c?.cliente}`, modulo: "seguimiento" });
  }

  const stats = { total: cotizaciones.length, pendiente: cotizaciones.filter(c => c.estado === "pendiente").length, enviada: cotizaciones.filter(c => c.estado === "enviada").length, aprobada: cotizaciones.filter(c => c.estado === "aprobada").length };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-black text-white">Seguimiento de Cotizaciones</h2>
          <p className="text-sm text-[#8090a8] mt-0.5">Gestiona el estado de tus cotizaciones</p>
        </div>
      </div>
      <Card>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Total" value={stats.total} />
          <StatCard label="Pendientes" value={stats.pendiente} color="#f59e0b" />
          <StatCard label="Enviadas" value={stats.enviada} color="#0ea5c8" />
          <StatCard label="Aprobadas" value={stats.aprobada} color="#10b981" />
        </div>
      </Card>
      <Card>
        <div className="flex gap-2 flex-wrap mb-4">
          {["todas","pendiente","enviada","aprobada","rechazada"].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize border transition-all
                ${filter === f ? "bg-[#0ea5c8]/10 border-[#0ea5c8] text-[#0ea5c8]" : "bg-[#060810] border-[#1a2235] text-[#8090a8] hover:text-white"}`}>
              {f}
            </button>
          ))}
        </div>
        {filtered.length === 0 ? <EmptyState msg="Sin cotizaciones" /> : (
          <div className="space-y-2">
            {filtered.map(c => (
              <div key={c.id} className="p-3.5 bg-[#060810] rounded-xl border border-[#1a2235]">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-white">{c.id}</span>
                      <Badge className={ESTADO_COLORS[c.estado]}>{c.estado}</Badge>
                    </div>
                    <div className="text-xs text-[#c8d8e8] mt-1">{c.cliente} · {c.proyecto}</div>
                    <div className="text-xs text-[#8090a8] mt-0.5">{c.fecha} · <span className="text-[#0ea5c8] font-semibold">{fmt(c.total)}</span></div>
                  </div>
                  <div className="flex items-center gap-2">
                    <select value={c.estado} onChange={e => changeEstado(c.id, e.target.value as Cotizacion["estado"])}
                      className="bg-[#0b0e1a] border border-[#1a2235] rounded-lg px-2 py-1 text-xs text-[#e8e8f0] focus:outline-none focus:border-[#0ea5c8]">
                      {["pendiente","enviada","aprobada","rechazada"].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <button onClick={() => eliminarCotizacion(c.id)} title="Eliminar cotización"
                      className="p-1.5 text-red-400 hover:bg-red-500/10 rounded"><Trash2 size={13} /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── PAGE: CATÁLOGO ───────────────────────────────────────────────────────────

function CatalogoPage({ catalog, setCatalog, showToast, addNotif, fbUrl }: {
  catalog: Producto[]; setCatalog: (c: Producto[]) => void; showToast: (m: string) => void;
  addNotif: (n: Omit<Notif, "id" | "fecha" | "leida">) => void; fbUrl: string;
}) {
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Producto | null>(null);
  const [form, setForm] = useState<Partial<Producto>>({});
  const [marcaOtro, setMarcaOtro] = useState(false);

  const filtered = catalog.filter(p =>
    (!search || (p.nombre + p.desc + p.cat + p.marca).toLowerCase().includes(search.toLowerCase())) &&
    (!catFilter || p.cat === catFilter)
  );

  function openModal(p?: Producto) {
    setEditing(p || null);
    const initial = p ? { ...p } : { nombre: "", marca: "", desc: "", precio: 0, inversion: 0, materiales: 0, manoObra: 0, sinFactura: false, proveedor: "", cat: "CCTV y Videovigilancia", unidad: "unidad", gratis: false };
    setForm(initial);
    setMarcaOtro(!!initial.marca && !MARCAS.includes(initial.marca));
    setModal(true);
  }

  function save() {
    if (!form.nombre) { showToast("⚠️ El nombre es requerido"); return; }
    const prod: Producto = { id: editing?.id || uid(), nombre: form.nombre!, marca: form.marca || "", desc: form.desc || "", precio: form.precio || 0, inversion: form.inversion || 0, materiales: form.materiales || 0, manoObra: form.manoObra || 0, sinFactura: form.sinFactura || false, proveedor: form.proveedor || "", cat: form.cat || "CCTV y Videovigilancia", unidad: form.unidad || "unidad", gratis: form.gratis || false };
    const next = editing ? catalog.map(p => p.id === editing.id ? prod : p) : [prod, ...catalog];
    setCatalog(next); persist("zentocat", next); setModal(false);
    showToast(editing ? "✅ Producto actualizado" : "✅ Producto agregado");
    addNotif({ tipo: "success", titulo: editing ? "Producto actualizado" : "Nuevo producto en catálogo", mensaje: prod.nombre, modulo: "catalogo" });
  }

  function del(id: string) {
    if (!confirm("¿Eliminar este producto?")) return;
    const p = catalog.find(x => x.id === id);
    const next = catalog.filter(p => p.id !== id);
    setCatalog(next); persist("zentocat", next); showToast("🗑️ Eliminado");
    addNotif({ tipo: "info", titulo: "Producto eliminado", mensaje: p?.nombre || id, modulo: "catalogo" });
  }
  function dup(id: string) { const p = catalog.find(x => x.id === id); if (!p) return; const next = [{ ...p, id: uid(), nombre: p.nombre + " (copia)" }, ...catalog]; setCatalog(next); persist("zentocat", next); showToast("📋 Duplicado"); }

  async function syncUp() {
    if (!fbUrl) { showToast("⚠️ Configura Firebase primero"); return; }
    persist("zentocat", catalog);
    showToast("⏳ Subiendo catálogo a Firebase...");
  }
  async function syncDown() {
    if (!fbUrl) { showToast("⚠️ Configura Firebase primero"); return; }
    try {
      showToast("⏳ Descargando...");
      const d = await fetchCloud<Producto[]>("zentocat");
      if (Array.isArray(d)) { setCatalog(d); persist("zentocat", d); showToast("✅ Catálogo descargado"); }
      else { showToast("⚠️ No hay catálogo en la nube todavía"); }
    } catch { showToast("⚠️ Error de conexión"); }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-black text-white">Mi Catálogo</h2>
          <p className="text-sm text-[#8090a8] mt-0.5">Administra productos, servicios y combos</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Btn variant="ghost" size="sm" onClick={syncDown}><Download size={13} /> Descargar</Btn>
          <Btn variant="ghost" size="sm" onClick={syncUp}><Upload size={13} /> Subir</Btn>
          <Btn onClick={() => openModal()}><Plus size={14} /> Agregar</Btn>
        </div>
      </div>
      <Card>
        <div className="flex gap-2 flex-wrap mb-4">
          <div className="relative flex-1 min-w-36">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8090a8]" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar productos..."
              className="w-full bg-[#060810] border border-[#1a2235] rounded-lg pl-8 pr-3 py-2 text-sm text-[#e8e8f0] focus:outline-none focus:border-[#0ea5c8]" />
          </div>
          <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
            className="bg-[#060810] border border-[#1a2235] rounded-lg px-3 py-2 text-sm text-[#e8e8f0] focus:outline-none focus:border-[#0ea5c8]">
            <option value="">Todas las categorías</option>
            {CATS.map(c => <option key={c}>{c}</option>)}
          </select>
          <span className="text-xs text-[#8090a8] self-center">{filtered.length} productos</span>
        </div>
        {filtered.length === 0 ? <EmptyState icon="📦" msg="Sin productos" /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="border-b border-[#1a2235]">
                  {["Producto","P. Venta","Margen","Categoría",""].map(h => (
                    <th key={h} className="text-left py-2 px-2 text-[10px] font-bold text-[#8090a8] uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                  const gk = p.precio - (p.inversion + p.materiales + (p.sinFactura ? 0 : p.precio * 0.05));
                  const margen = p.precio > 0 ? ((p.manoObra + gk) / p.precio * 100) : 0;
                  return (
                    <tr key={p.id} className="border-b border-[#0f1220] hover:bg-[#0a0d1a] group">
                      <td className="py-2.5 px-2">
                        <div className="font-semibold text-white text-sm leading-tight">{p.nombre}</div>
                        {p.marca && <div className="text-[11px] text-[#8090a8]">{p.marca}</div>}
                      </td>
                      <td className="py-2.5 px-2 font-bold text-[#0ea5c8] text-sm whitespace-nowrap">{p.gratis ? "Gratis" : fmt(p.precio)}</td>
                      <td className="py-2.5 px-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${margen >= 50 ? "bg-emerald-500/15 text-emerald-400" : margen >= 25 ? "bg-yellow-500/15 text-yellow-400" : "bg-red-500/15 text-red-400"}`}>
                          {margen.toFixed(0)}%
                        </span>
                      </td>
                      <td className="py-2.5 px-2"><Badge className="text-[#0ea5c8] bg-[#0ea5c8]/10 border-[#0ea5c8]/20">{p.cat}</Badge></td>
                      <td className="py-2.5 px-2 text-right">
                        <div className="flex items-center gap-1 justify-end opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openModal(p)} className="p-1.5 text-[#8090a8] hover:text-white rounded hover:bg-[#1a2235]"><Edit2 size={13} /></button>
                          <button onClick={() => dup(p.id)} className="p-1.5 text-[#8090a8] hover:text-white rounded hover:bg-[#1a2235]"><Copy size={13} /></button>
                          <button onClick={() => del(p.id)} className="p-1.5 text-[#8090a8] hover:text-red-400 rounded hover:bg-red-500/10"><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? "Editar Producto" : "Agregar Producto"}>
        <div className="space-y-3">
          <Input label="Nombre *" value={form.nombre || ""} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Marca" value={marcaOtro ? "Otro" : (form.marca || "")} onChange={e => {
              if (e.target.value === "Otro") { setMarcaOtro(true); setForm(f => ({ ...f, marca: "" })); }
              else { setMarcaOtro(false); setForm(f => ({ ...f, marca: e.target.value })); }
            }}>
              <option value="">— Seleccionar —</option>
              {MARCAS.map(m => <option key={m}>{m}</option>)}
              <option value="Otro">Otro...</option>
            </Select>
            <Select label="Proveedor" value={form.proveedor || ""} onChange={e => setForm(f => ({ ...f, proveedor: e.target.value }))}>
              <option value="">— Seleccionar —</option>
              {PROVEEDORES.map(p => <option key={p}>{p}</option>)}
            </Select>
          </div>
          {marcaOtro && (
            <Input label="Nueva marca *" placeholder="Escribe el nombre de la marca" value={form.marca || ""} onChange={e => setForm(f => ({ ...f, marca: e.target.value }))} />
          )}
          <Textarea label="Descripción técnica" value={form.desc || ""} onChange={e => setForm(f => ({ ...f, desc: e.target.value }))} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Precio Venta (Q) *" type="number" min="0" step="0.01" value={form.precio || ""} onChange={e => setForm(f => ({ ...f, precio: +e.target.value }))} />
            <Input label="Inversión Real (Q)" type="number" min="0" step="0.01" value={form.inversion || ""} onChange={e => setForm(f => ({ ...f, inversion: +e.target.value }))} />
            <Input label="Materiales (Q)" type="number" min="0" step="0.01" value={form.materiales || ""} onChange={e => setForm(f => ({ ...f, materiales: +e.target.value }))} />
            <Input label="Mano de Obra (Q)" type="number" min="0" step="0.01" value={form.manoObra || ""} onChange={e => setForm(f => ({ ...f, manoObra: +e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Categoría" value={form.cat || ""} onChange={e => setForm(f => ({ ...f, cat: e.target.value }))}>
              {CATS.map(c => <option key={c}>{c}</option>)}
            </Select>
            <Input label="Unidad" value={form.unidad || ""} onChange={e => setForm(f => ({ ...f, unidad: e.target.value }))} />
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-[#c8d8e8]">
              <input type="checkbox" checked={form.sinFactura || false} onChange={e => setForm(f => ({ ...f, sinFactura: e.target.checked }))} className="accent-[#0ea5c8]" />
              Sin Factura (excluir IVA)
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm text-[#c8d8e8]">
              <input type="checkbox" checked={form.gratis || false} onChange={e => setForm(f => ({ ...f, gratis: e.target.checked }))} className="accent-[#0ea5c8]" />
              Sin costo
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Btn variant="ghost" onClick={() => setModal(false)}>Cancelar</Btn>
            <Btn onClick={save}>💾 Guardar</Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─── PAGE: VENTAS ─────────────────────────────────────────────────────────────

function VentasPage({ ventas, setVentas, showToast, addNotif }: {
  ventas: Venta[]; setVentas: (v: Venta[]) => void; showToast: (m: string) => void;
  addNotif: (n: Omit<Notif, "id" | "fecha" | "leida">) => void;
}) {
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ fecha: today(), cliente: "", total: 0, inversion: 0, conFactura: true });

  const totalVentas = ventas.reduce((a, v) => a + v.total, 0);
  const totalGanancia = ventas.reduce((a, v) => a + (v.total - v.inversion - (v.conFactura ? v.total * 0.05 : 0)), 0);
  const totalIva = ventas.filter(v => v.conFactura).reduce((a, v) => a + v.total * 0.05, 0);

  function save() {
    if (!form.cliente) { showToast("⚠️ El cliente es requerido"); return; }
    const v: Venta = { id: uid(), ...form };
    const next = [v, ...ventas];
    setVentas(next); persist("zVentas", next); setModal(false);
    addNotif({ tipo: "success", titulo: "Nueva venta registrada", mensaje: `${form.cliente} — ${fmt(form.total)}`, modulo: "ventas" });
    showToast("✅ Venta registrada");
  }

  const chartData = (() => {
    const byMonth: Record<string, number> = {};
    ventas.forEach(v => {
      const m = v.fecha.substring(0, 7);
      byMonth[m] = (byMonth[m] || 0) + v.total;
    });
    return Object.entries(byMonth).slice(-6).map(([m, v]) => ({ mes: m.substring(5), total: v }));
  })();

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div><h2 className="text-xl font-black text-white">Ventas & Rentabilidad</h2></div>
        <Btn onClick={() => setModal(true)}><Plus size={14} /> Nueva Venta</Btn>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <StatCard label="Total Ventas" value={ventas.length} />
        <StatCard label="Facturado" value={`Q ${(totalVentas / 1000).toFixed(1)}k`} />
        <StatCard label="Ganancia" value={`Q ${(totalGanancia / 1000).toFixed(1)}k`} color="#10b981" />
        <StatCard label="IVA (5%)" value={fmt(totalIva).replace("Q ", "Q")} color="#f59e0b" />
      </div>
      {chartData.length > 0 && (
        <Card>
          <CardTitle>Ventas Mensuales</CardTitle>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <ReBarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a2235" />
                <XAxis dataKey="mes" tick={{ fill: "#8090a8", fontSize: 11 }} />
                <YAxis tick={{ fill: "#8090a8", fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "#0b0e1a", border: "1px solid #1a2235", borderRadius: 8, color: "#e8e8f0" }} />
                <Bar dataKey="total" fill="#0ea5c8" radius={[4, 4, 0, 0]} />
              </ReBarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}
      <Card>
        <CardTitle>Historial de Ventas</CardTitle>
        {ventas.length === 0 ? <EmptyState icon="💹" msg="Sin ventas registradas" /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px]">
              <thead><tr className="border-b border-[#1a2235]">
                {["Fecha","Cliente","Total","Inversión","Ganancia","IVA",""].map(h => (
                  <th key={h} className="text-left py-2 px-2 text-[10px] font-bold text-[#8090a8] uppercase">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {ventas.map(v => {
                  const gan = v.total - v.inversion - (v.conFactura ? v.total * 0.05 : 0);
                  return (
                    <tr key={v.id} className="border-b border-[#0f1220] hover:bg-[#0a0d1a] group">
                      <td className="py-2.5 px-2 text-xs text-[#8090a8]">{v.fecha}</td>
                      <td className="py-2.5 px-2 text-sm font-medium text-white">{v.cliente}</td>
                      <td className="py-2.5 px-2 text-sm font-bold text-[#0ea5c8]">{fmt(v.total)}</td>
                      <td className="py-2.5 px-2 text-xs text-[#8090a8]">{fmt(v.inversion)}</td>
                      <td className="py-2.5 px-2 text-sm font-bold text-emerald-400">{fmt(gan)}</td>
                      <td className="py-2.5 px-2 text-xs text-yellow-400">{v.conFactura ? fmt(v.total * 0.05) : "—"}</td>
                      <td className="py-2.5 px-2 text-right">
                        <button onClick={() => { if (confirm("¿Eliminar?")) { const n = ventas.filter(x => x.id !== v.id); setVentas(n); persist("zVentas", n); showToast("🗑️ Eliminada"); } }}
                          className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 p-1 text-red-400 hover:bg-red-500/10 rounded"><Trash2 size={12} /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Modal open={modal} onClose={() => setModal(false)} title="Registrar Venta">
        <div className="space-y-3">
          <Input label="Fecha" type="date" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} />
          <Input label="Cliente" value={form.cliente} onChange={e => setForm(f => ({ ...f, cliente: e.target.value }))} placeholder="Nombre del cliente" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Total Venta (Q)" type="number" step="0.01" value={form.total || ""} onChange={e => setForm(f => ({ ...f, total: +e.target.value }))} />
            <Input label="Inversión (Q)" type="number" step="0.01" value={form.inversion || ""} onChange={e => setForm(f => ({ ...f, inversion: +e.target.value }))} />
          </div>
          <label className="flex items-center gap-2 cursor-pointer text-sm text-[#c8d8e8]">
            <input type="checkbox" checked={form.conFactura} onChange={e => setForm(f => ({ ...f, conFactura: e.target.checked }))} className="accent-[#0ea5c8]" />
            Con Factura (IVA 5%)
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Btn variant="ghost" onClick={() => setModal(false)}>Cancelar</Btn>
            <Btn onClick={save}>Guardar</Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─── PAGE: INVENTARIO ─────────────────────────────────────────────────────────

function InventarioPage({ inventario, setInventario, showToast, addNotif }: {
  inventario: ItemInv[]; setInventario: (i: ItemInv[]) => void; showToast: (m: string) => void;
  addNotif: (n: Omit<Notif, "id" | "fecha" | "leida">) => void;
}) {
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ nombre: "", stock: 0, minimo: 5, precio: 0 });

  function save() {
    if (!form.nombre) { showToast("⚠️ El nombre es requerido"); return; }
    const item: ItemInv = { id: uid(), ...form };
    const next = [item, ...inventario];
    setInventario(next); persist("zInventario", next); setModal(false);
    if (item.stock <= item.minimo) addNotif({ tipo: "warning", titulo: "Stock bajo en nuevo item", mensaje: `${item.nombre}: ${item.stock} unidades (mín. ${item.minimo})`, modulo: "inventario" });
    showToast("✅ Equipo agregado");
  }

  const bajo = inventario.filter(i => i.stock <= i.minimo).length;
  const valorTotal = inventario.reduce((a, i) => a + (i.stock * i.precio), 0);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div><h2 className="text-xl font-black text-white">Inventario</h2></div>
        <Btn onClick={() => setModal(true)}><Plus size={14} /> Agregar Equipo</Btn>
      </div>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <StatCard label="Equipos" value={inventario.length} />
        <StatCard label="Stock Bajo" value={bajo} color={bajo > 0 ? "#ef4444" : "#10b981"} />
        <StatCard label="Valor Total" value={`Q ${(valorTotal / 1000).toFixed(1)}k`} />
      </div>
      <Card>
        {inventario.length === 0 ? <EmptyState icon="🏦" msg="Sin equipos en inventario" /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px]">
              <thead><tr className="border-b border-[#1a2235]">
                {["Equipo","Stock","Mínimo","Precio","Total","Estado",""].map(h => (
                  <th key={h} className="text-left py-2 px-2 text-[10px] font-bold text-[#8090a8] uppercase">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {inventario.map(item => {
                  const critico = item.stock === 0;
                  const bajo = item.stock <= item.minimo;
                  return (
                    <tr key={item.id} className="border-b border-[#0f1220] hover:bg-[#0a0d1a] group">
                      <td className="py-2.5 px-2 text-sm font-medium text-white">{item.nombre}</td>
                      <td className="py-2.5 px-2">
                        <div className="flex items-center gap-1">
                          <button onClick={() => { const n = inventario.map(i => i.id === item.id ? { ...i, stock: Math.max(0, i.stock - 1) } : i); setInventario(n); persist("zInventario", n); }}
                            className="w-5 h-5 rounded bg-[#1a2235] text-[#8090a8] hover:text-white flex items-center justify-center text-xs">−</button>
                          <span className={`text-sm font-bold px-1 ${critico ? "text-red-400" : bajo ? "text-yellow-400" : "text-white"}`}>{item.stock}</span>
                          <button onClick={() => { const n = inventario.map(i => i.id === item.id ? { ...i, stock: i.stock + 1 } : i); setInventario(n); persist("zInventario", n); }}
                            className="w-5 h-5 rounded bg-[#1a2235] text-[#8090a8] hover:text-white flex items-center justify-center text-xs">+</button>
                        </div>
                      </td>
                      <td className="py-2.5 px-2 text-xs text-[#8090a8]">{item.minimo}</td>
                      <td className="py-2.5 px-2 text-xs text-[#8090a8]">{fmt(item.precio)}</td>
                      <td className="py-2.5 px-2 text-sm font-semibold text-[#0ea5c8]">{fmt(item.stock * item.precio)}</td>
                      <td className="py-2.5 px-2">
                        <Badge className={critico ? "text-red-400 bg-red-400/10 border-red-400/20" : bajo ? "text-yellow-400 bg-yellow-400/10 border-yellow-400/20" : "text-emerald-400 bg-emerald-400/10 border-emerald-400/20"}>
                          {critico ? "Sin stock" : bajo ? "Bajo" : "OK"}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-2 text-right">
                        <button onClick={() => { if (confirm("¿Eliminar?")) { const n = inventario.filter(x => x.id !== item.id); setInventario(n); persist("zInventario", n); showToast("🗑️ Eliminado"); } }}
                          className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 p-1 text-red-400 hover:bg-red-500/10 rounded"><Trash2 size={12} /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Modal open={modal} onClose={() => setModal(false)} title="Nuevo Equipo">
        <div className="space-y-3">
          <Input label="Nombre del Equipo *" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
          <div className="grid grid-cols-3 gap-3">
            <Input label="Stock Inicial" type="number" min="0" value={form.stock} onChange={e => setForm(f => ({ ...f, stock: +e.target.value }))} />
            <Input label="Stock Mínimo" type="number" min="0" value={form.minimo} onChange={e => setForm(f => ({ ...f, minimo: +e.target.value }))} />
            <Input label="Precio (Q)" type="number" step="0.01" value={form.precio} onChange={e => setForm(f => ({ ...f, precio: +e.target.value }))} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Btn variant="ghost" onClick={() => setModal(false)}>Cancelar</Btn>
            <Btn onClick={save}>Guardar</Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─── PAGE: GASTOS ─────────────────────────────────────────────────────────────

function GastosPage({ gastos, setGastos, showToast, addNotif }: {
  gastos: Gasto[]; setGastos: (g: Gasto[]) => void; showToast: (m: string) => void;
  addNotif: (n: Omit<Notif, "id" | "fecha" | "leida">) => void;
}) {
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ fecha: today(), categoria: "Gasolina", monto: 0, descripcion: "" });

  function save() {
    const g: Gasto = { id: uid(), ...form };
    const next = [g, ...gastos];
    setGastos(next); persist("zGastos", next); setModal(false); showToast("✅ Gasto registrado");
    addNotif({ tipo: "info", titulo: "Nuevo gasto registrado", mensaje: `${g.categoria} — ${fmt(g.monto)}`, modulo: "gastos" });
  }

  const total = gastos.reduce((a, g) => a + g.monto, 0);
  const bycat = GAS_CATS.map(cat => ({ cat, total: gastos.filter(g => g.categoria === cat).reduce((a, g) => a + g.monto, 0) })).filter(x => x.total > 0);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div><h2 className="text-xl font-black text-white">Gastos Operativos</h2></div>
        <Btn onClick={() => setModal(true)}><Plus size={14} /> Agregar Gasto</Btn>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
        <StatCard label="Total Gastos" value={gastos.length} />
        <StatCard label="Total (Q)" value={fmt(total)} color="#ef4444" />
        <StatCard label="Este mes" value={fmt(gastos.filter(g => g.fecha.startsWith(today().substring(0, 7))).reduce((a, g) => a + g.monto, 0))} color="#f59e0b" />
      </div>
      {bycat.length > 0 && (
        <Card>
          <CardTitle>Por Categoría</CardTitle>
          <div className="space-y-2">
            {bycat.sort((a, b) => b.total - a.total).map(x => (
              <div key={x.cat} className="flex items-center gap-3">
                <div className="text-xs text-[#c8d8e8] w-28 truncate">{x.cat}</div>
                <div className="flex-1 h-1.5 bg-[#1a2235] rounded-full overflow-hidden">
                  <div className="h-full bg-[#0ea5c8] rounded-full" style={{ width: `${(x.total / total * 100).toFixed(0)}%` }} />
                </div>
                <div className="text-xs text-[#0ea5c8] font-semibold w-20 text-right">{fmt(x.total)}</div>
              </div>
            ))}
          </div>
        </Card>
      )}
      <Card>
        {gastos.length === 0 ? <EmptyState icon="💰" msg="Sin gastos registrados" /> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-[#1a2235]">
                {["Fecha","Categoría","Monto","Descripción",""].map(h => (
                  <th key={h} className="text-left py-2 px-2 text-[10px] font-bold text-[#8090a8] uppercase">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {gastos.map(g => (
                  <tr key={g.id} className="border-b border-[#0f1220] hover:bg-[#0a0d1a] group">
                    <td className="py-2.5 px-2 text-xs text-[#8090a8]">{g.fecha}</td>
                    <td className="py-2.5 px-2"><Badge className="text-[#0ea5c8] bg-[#0ea5c8]/10 border-[#0ea5c8]/20">{g.categoria}</Badge></td>
                    <td className="py-2.5 px-2 text-sm font-bold text-red-400">{fmt(g.monto)}</td>
                    <td className="py-2.5 px-2 text-xs text-[#8090a8] max-w-[150px] truncate">{g.descripcion || "—"}</td>
                    <td className="py-2.5 px-2 text-right">
                      <button onClick={() => { if (confirm("¿Eliminar?")) { const n = gastos.filter(x => x.id !== g.id); setGastos(n); persist("zGastos", n); showToast("🗑️ Eliminado"); } }}
                        className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 p-1 text-red-400 hover:bg-red-500/10 rounded"><Trash2 size={12} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Modal open={modal} onClose={() => setModal(false)} title="Nuevo Gasto">
        <div className="space-y-3">
          <Input label="Fecha" type="date" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} />
          <Select label="Categoría" value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}>
            {GAS_CATS.map(c => <option key={c}>{c}</option>)}
          </Select>
          <Input label="Monto (Q) *" type="number" step="0.01" value={form.monto || ""} onChange={e => setForm(f => ({ ...f, monto: +e.target.value }))} />
          <Textarea label="Descripción" value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} />
          <div className="flex justify-end gap-2 pt-2">
            <Btn variant="ghost" onClick={() => setModal(false)}>Cancelar</Btn>
            <Btn onClick={save}>Guardar</Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─── PAGE: PAGOS ──────────────────────────────────────────────────────────────

function PagosPage({ pagos, setPagos, showToast, addNotif }: {
  pagos: Pago[]; setPagos: (p: Pago[]) => void; showToast: (m: string) => void;
  addNotif: (n: Omit<Notif, "id" | "fecha" | "leida">) => void;
}) {
  const [modal, setModal] = useState(false);
  const [modalPago, setModalPago] = useState<Pago | null>(null);
  const [form, setForm] = useState<{ cliente: string; total: number; tipo: "cobrar" | "pagar" }>({ cliente: "", total: 0, tipo: "cobrar" });
  const [abonoMonto, setAbonoMonto] = useState(0);
  const [filter, setFilter] = useState<"todas" | "cobrar" | "pagar">("todas");

  function save() {
    if (!form.cliente) { showToast("⚠️ El cliente/proveedor es requerido"); return; }
    const p: Pago = { id: uid(), cliente: form.cliente, total: form.total, recibido: 0, tipo: form.tipo };
    const next = [p, ...pagos];
    setPagos(next); persist("zPagos", next); setModal(false);
    showToast(form.tipo === "cobrar" ? "✅ Cuenta por cobrar creada" : "✅ Cuenta por pagar creada");
    addNotif({ tipo: "success", titulo: form.tipo === "cobrar" ? "Nueva cuenta por cobrar" : "Nueva cuenta por pagar", mensaje: `${p.cliente} — ${fmt(p.total)}`, modulo: "pagos" });
  }

  function abonar() {
    if (!modalPago || abonoMonto <= 0) return;
    const next = pagos.map(p => p.id === modalPago.id ? { ...p, recibido: Math.min(p.recibido + abonoMonto, p.total) } : p);
    setPagos(next); persist("zPagos", next); setModalPago(null); showToast("✅ Abono registrado");
    addNotif({ tipo: "success", titulo: modalPago.tipo === "cobrar" ? "Abono recibido" : "Pago realizado", mensaje: `${modalPago.cliente} — ${fmt(abonoMonto)}`, modulo: "pagos" });
  }

  const cuentasCobrar = pagos.filter(p => p.tipo !== "pagar");
  const cuentasPagar = pagos.filter(p => p.tipo === "pagar");
  const totalPorCobrar = cuentasCobrar.reduce((a, p) => a + (p.total - p.recibido), 0);
  const totalPorPagar = cuentasPagar.reduce((a, p) => a + (p.total - p.recibido), 0);
  const filtered = filter === "todas" ? pagos : pagos.filter(p => p.tipo === filter);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div><h2 className="text-xl font-black text-white">Pagos & Cuentas por Cobrar</h2></div>
        <Btn onClick={() => { setForm({ cliente: "", total: 0, tipo: "cobrar" }); setModal(true); }}><Plus size={14} /> Nueva Cuenta</Btn>
      </div>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <StatCard label="Cuentas" value={pagos.length} />
        <StatCard label="Por Cobrar" value={fmt(totalPorCobrar)} color="#ef4444" />
        <StatCard label="Por Pagar" value={fmt(totalPorPagar)} color="#f59e0b" />
      </div>
      <div className="flex gap-2 flex-wrap mb-3">
        {(["todas", "cobrar", "pagar"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize border transition-all
              ${filter === f ? "bg-[#0ea5c8]/10 border-[#0ea5c8] text-[#0ea5c8]" : "bg-[#060810] border-[#1a2235] text-[#8090a8] hover:text-white"}`}>
            {f === "todas" ? "Todas" : f === "cobrar" ? "Por Cobrar" : "Por Pagar"}
          </button>
        ))}
      </div>
      <Card>
        {filtered.length === 0 ? <EmptyState icon="💳" msg="Sin cuentas registradas" /> : (
          <div className="space-y-2">
            {filtered.map(p => {
              const saldo = p.total - p.recibido;
              const pct = p.total > 0 ? (p.recibido / p.total * 100) : 0;
              const esPagar = p.tipo === "pagar";
              return (
                <div key={p.id} className="p-3.5 bg-[#060810] rounded-xl border border-[#1a2235]">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">{p.cliente}</span>
                        <Badge className={esPagar ? "bg-amber-500/10 text-amber-400 border-amber-500/20" : "bg-red-500/10 text-red-400 border-red-500/20"}>
                          {esPagar ? "Por pagar" : "Por cobrar"}
                        </Badge>
                      </div>
                      <div className="text-xs text-[#8090a8]">Total: {fmt(p.total)} · {esPagar ? "Pagado" : "Recibido"}: {fmt(p.recibido)} · Saldo: <span className={saldo > 0 ? "text-red-400 font-semibold" : "text-emerald-400 font-semibold"}>{fmt(saldo)}</span></div>
                    </div>
                    <div className="flex items-center gap-2">
                      {saldo > 0 && <Btn size="sm" onClick={() => { setModalPago(p); setAbonoMonto(0); }}>{esPagar ? "Pagar" : "Abonar"}</Btn>}
                      <button onClick={() => { if (confirm("¿Eliminar?")) { const n = pagos.filter(x => x.id !== p.id); setPagos(n); persist("zPagos", n); showToast("🗑️ Eliminado"); addNotif({ tipo: "info", titulo: "Cuenta eliminada", mensaje: p.cliente, modulo: "pagos" }); } }}
                        className="p-1.5 text-red-400 hover:bg-red-500/10 rounded"><Trash2 size={13} /></button>
                    </div>
                  </div>
                  <div className="h-1.5 bg-[#1a2235] rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-[#1a4fa8] to-[#0ea5c8] rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex justify-between text-[10px] text-[#8090a8] mt-1"><span>0%</span><span className="font-semibold text-[#0ea5c8]">{pct.toFixed(0)}% {esPagar ? "pagado" : "cobrado"}</span><span>100%</span></div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Modal open={modal} onClose={() => setModal(false)} title="Nueva Cuenta">
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-[#8090a8] mb-1.5 block">Tipo de cuenta *</label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setForm(f => ({ ...f, tipo: "cobrar" }))}
                className={`py-2.5 rounded-lg text-sm font-semibold border transition-all ${form.tipo === "cobrar" ? "bg-red-500/10 border-red-500 text-red-400" : "bg-[#060810] border-[#1a2235] text-[#8090a8]"}`}>
                💰 Por Cobrar
              </button>
              <button type="button" onClick={() => setForm(f => ({ ...f, tipo: "pagar" }))}
                className={`py-2.5 rounded-lg text-sm font-semibold border transition-all ${form.tipo === "pagar" ? "bg-amber-500/10 border-amber-500 text-amber-400" : "bg-[#060810] border-[#1a2235] text-[#8090a8]"}`}>
                📤 Por Pagar
              </button>
            </div>
          </div>
          <Input label={form.tipo === "cobrar" ? "Cliente *" : "Proveedor / Acreedor *"} value={form.cliente} onChange={e => setForm(f => ({ ...f, cliente: e.target.value }))} />
          <Input label={form.tipo === "cobrar" ? "Total a Cobrar (Q) *" : "Total a Pagar (Q) *"} type="number" step="0.01" value={form.total || ""} onChange={e => setForm(f => ({ ...f, total: +e.target.value }))} />
          <div className="flex justify-end gap-2 pt-2">
            <Btn variant="ghost" onClick={() => setModal(false)}>Cancelar</Btn>
            <Btn onClick={save}>Guardar</Btn>
          </div>
        </div>
      </Modal>

      <Modal open={!!modalPago} onClose={() => setModalPago(null)} title={`${modalPago?.tipo === "pagar" ? "Registrar Pago" : "Registrar Abono"} — ${modalPago?.cliente}`}>
        <div className="space-y-3">
          <div className="p-3 bg-[#060810] rounded-xl border border-[#1a2235] text-sm">
            <div className="flex justify-between"><span className="text-[#8090a8]">Total:</span><span className="text-white font-bold">{fmt(modalPago?.total || 0)}</span></div>
            <div className="flex justify-between mt-1"><span className="text-[#8090a8]">Recibido:</span><span className="text-emerald-400 font-bold">{fmt(modalPago?.recibido || 0)}</span></div>
            <div className="flex justify-between mt-1"><span className="text-[#8090a8]">Saldo:</span><span className="text-red-400 font-bold">{fmt((modalPago?.total || 0) - (modalPago?.recibido || 0))}</span></div>
          </div>
          <Input label="Monto del Abono (Q)" type="number" step="0.01" value={abonoMonto || ""} onChange={e => setAbonoMonto(+e.target.value)} />
          <div className="flex justify-end gap-2 pt-2">
            <Btn variant="ghost" onClick={() => setModalPago(null)}>Cancelar</Btn>
            <Btn onClick={abonar}>Registrar Abono</Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─── PAGE: HOJA DE TRABAJO ────────────────────────────────────────────────────

const HT_SERVICIOS = ["Instalación CCTV","Redes/Cableado","Configuración NVR/DVR","Soporte Técnico","Mantenimiento","Reparación","Biométrico","Control de Acceso"];

function HojaTrabajoPage({ cotizaciones, showToast, addNotif }: {
  cotizaciones: Cotizacion[]; showToast: (m: string) => void;
  addNotif: (n: Omit<Notif, "id" | "fecha" | "leida">) => void;
}) {
  const [f, setF] = useState({ nombre: "", direccion: "", telefono: "", email: "", orden: "", fecha: today(), tecnico: "" });
  const [servicios, setServicios] = useState<string[]>([]);
  const [desc, setDesc] = useState("");
  const [obs, setObs] = useState("");
  const [equipos, setEquipos] = useState<{ id: string; desc: string; marca: string; spec: string }[]>([]);
  const [patron, setPatron] = useState<number[]>([]);
  const [saved, setSaved] = useState<(typeof f & { servicios: string[]; desc: string; obs: string; id: string })[]>(ls("zHojas", []));

  function buscarCot(val: string) {
    setF(x => ({ ...x, orden: val }));
    const cot = cotizaciones.find(c => c.whatsapp?.replace(/\D/g, "").includes(val.replace(/\D/g, "")) || c.id.toLowerCase().includes(val.toLowerCase()) || c.cliente.toLowerCase().includes(val.toLowerCase()));
    if (cot) { setF(x => ({ ...x, nombre: cot.cliente, telefono: cot.whatsapp, direccion: cot.ubicacion })); showToast("✅ Datos cargados desde cotización"); }
  }

  function toggleSvc(s: string) { setServicios(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]); }
  function addEquipo() { setEquipos([...equipos, { id: uid(), desc: "", marca: "", spec: "" }]); }
  function updEquipo(id: string, k: string, v: string) { setEquipos(equipos.map(e => e.id === id ? { ...e, [k]: v } : e)); }
  function togglePatron(n: number) { setPatron(prev => prev.includes(n) ? prev.filter(x => x !== n) : [...prev, n]); }

  function guardar() {
    if (!f.nombre) { showToast("⚠️ El cliente es requerido"); return; }
    const hoja = { ...f, servicios, desc, obs, id: uid() };
    const next = [hoja, ...saved];
    setSaved(next); persist("zHojas", next); showToast("✅ Hoja guardada");
    addNotif({ tipo: "success", titulo: "Hoja de trabajo guardada", mensaje: `${hoja.nombre} — ${hoja.fecha}`, modulo: "hojatrabajo" });
  }

  function limpiar() { setF({ nombre: "", direccion: "", telefono: "", email: "", orden: "", fecha: today(), tecnico: "" }); setServicios([]); setDesc(""); setObs(""); setEquipos([]); setPatron([]); }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div><h2 className="text-xl font-black text-white">Hoja de Trabajo / Servicio</h2><p className="text-sm text-[#8090a8] mt-0.5">Genera hojas de servicio técnico</p></div>
        <div className="flex gap-2">
          <Btn onClick={guardar}>💾 Guardar</Btn>
          <Btn variant="ghost" onClick={limpiar}><RefreshCw size={13} /> Limpiar</Btn>
          <Btn variant="ghost" onClick={() => window.print()}>🖨️ Imprimir</Btn>
        </div>
      </div>

      <Card>
        <CardTitle>Datos del Cliente</CardTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Input label="Buscar por Teléfono o N° Cotización" value={f.orden} onChange={e => buscarCot(e.target.value)} placeholder="Tel. o COT-0001" />
            <div className="text-[10px] text-[#8090a8] mt-1">Busca y carga datos de una cotización existente</div>
          </div>
          <Input label="Fecha" type="date" value={f.fecha} onChange={e => setF(x => ({ ...x, fecha: e.target.value }))} />
          <Input label="Nombre Cliente *" value={f.nombre} onChange={e => setF(x => ({ ...x, nombre: e.target.value }))} />
          <Input label="Teléfono" value={f.telefono} onChange={e => setF(x => ({ ...x, telefono: e.target.value }))} />
          <Input label="Dirección" value={f.direccion} onChange={e => setF(x => ({ ...x, direccion: e.target.value }))} />
          <Input label="Técnico" value={f.tecnico} onChange={e => setF(x => ({ ...x, tecnico: e.target.value }))} />
        </div>
      </Card>

      <Card>
        <CardTitle>Servicios Realizados</CardTitle>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {HT_SERVICIOS.map(s => (
            <label key={s} className={`flex items-center gap-2 p-2.5 rounded-xl cursor-pointer border transition-all text-sm
              ${servicios.includes(s) ? "border-[#0ea5c8] bg-[#0ea5c8]/10 text-white" : "border-[#1a2235] bg-[#060810] text-[#c8d8e8]"}`}>
              <input type="checkbox" checked={servicios.includes(s)} onChange={() => toggleSvc(s)} className="accent-[#0ea5c8]" />
              <span className="text-xs leading-tight">{s}</span>
            </label>
          ))}
        </div>
      </Card>

      <Card>
        <CardTitle>Descripción del Trabajo</CardTitle>
        <Textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="Describe detalladamente el trabajo realizado..." className="min-h-[90px]" />
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-3">
          <CardTitle>Equipos Instalados</CardTitle>
          <Btn size="sm" onClick={addEquipo}><Plus size={12} /> Equipo</Btn>
        </div>
        {equipos.length === 0 ? <p className="text-xs text-[#8090a8]">Sin equipos agregados</p> : (
          <div className="space-y-2">
            {equipos.map(e => (
              <div key={e.id} className="grid grid-cols-[1fr_1fr_1fr_28px] gap-2 items-center">
                <input value={e.desc} onChange={ev => updEquipo(e.id, "desc", ev.target.value)} placeholder="Descripción"
                  className="bg-[#060810] border border-[#1a2235] rounded-lg px-2 py-1.5 text-xs text-[#e8e8f0] focus:outline-none focus:border-[#0ea5c8]" />
                <input value={e.marca} onChange={ev => updEquipo(e.id, "marca", ev.target.value)} placeholder="Marca"
                  className="bg-[#060810] border border-[#1a2235] rounded-lg px-2 py-1.5 text-xs text-[#e8e8f0] focus:outline-none focus:border-[#0ea5c8]" />
                <input value={e.spec} onChange={ev => updEquipo(e.id, "spec", ev.target.value)} placeholder="Especificación"
                  className="bg-[#060810] border border-[#1a2235] rounded-lg px-2 py-1.5 text-xs text-[#e8e8f0] focus:outline-none focus:border-[#0ea5c8]" />
                <button onClick={() => setEquipos(equipos.filter(x => x.id !== e.id))} className="text-red-400 hover:bg-red-500/10 rounded w-7 h-7 flex items-center justify-center"><X size={12} /></button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <CardTitle>Patrón de Desbloqueo (Opcional)</CardTitle>
        <div className="flex gap-8 flex-wrap">
          <div>
            <p className="text-xs text-[#8090a8] mb-3">Selecciona en orden:</p>
            <div className="grid grid-cols-3 gap-2">
              {[1,2,3,4,5,6,7,8,9].map(n => (
                <button key={n} onClick={() => togglePatron(n)}
                  className={`w-12 h-12 rounded-xl text-base font-black border-2 transition-all
                    ${patron.includes(n) ? "border-[#0ea5c8] bg-[#0ea5c8]/20 text-white" : "border-[#1a2235] bg-[#060810] text-[#8090a8]"}`}>
                  {patron.includes(n) ? <span className="text-[#0ea5c8]">{patron.indexOf(n) + 1}</span> : n}
                </button>
              ))}
            </div>
            <button onClick={() => setPatron([])} className="mt-2 w-full text-xs text-[#8090a8] py-1 hover:text-white transition-colors">↺ Limpiar patrón</button>
          </div>
          <div>
            <p className="text-xs text-[#8090a8] mb-3">Vista previa:</p>
            <div className="grid grid-cols-3 gap-1.5 bg-[#060810] p-3 rounded-xl border border-[#1a2235]">
              {[1,2,3,4,5,6,7,8,9].map(n => (
                <div key={n} className={`w-9 h-9 rounded-full border flex items-center justify-center text-[10px] font-bold
                  ${patron.includes(n) ? "border-[#0ea5c8] bg-[#0ea5c8]/20 text-[#0ea5c8]" : "border-[#1a2235] text-[#3a4a5a]"}`}>
                  {patron.includes(n) ? patron.indexOf(n) + 1 : n}
                </div>
              ))}
            </div>
            {patron.length > 0 && <div className="text-xs text-[#8090a8] mt-2">Secuencia: <span className="text-[#0ea5c8] font-bold">{patron.join(" → ")}</span></div>}
          </div>
        </div>
      </Card>

      <Card>
        <CardTitle>Observaciones y Cláusulas</CardTitle>
        <Textarea value={obs} onChange={e => setObs(e.target.value)} placeholder="Garantía, términos técnicos, observaciones especiales..." className="min-h-[80px]" />
      </Card>

      {saved.length > 0 && (
        <Card>
          <CardTitle>Hojas Guardadas</CardTitle>
          <div className="space-y-2">
            {saved.slice(0, 5).map(h => (
              <div key={h.id} className="flex items-center justify-between p-3 bg-[#060810] rounded-xl border border-[#1a2235]">
                <div>
                  <div className="text-sm font-semibold text-white">{h.nombre}</div>
                  <div className="text-xs text-[#8090a8]">{h.fecha} · {h.servicios.join(", ") || "Sin servicios"}</div>
                </div>
                <button onClick={() => { const n = saved.filter(x => x.id !== h.id); setSaved(n); persist("zHojas", n); showToast("🗑️ Eliminada"); }}
                  className="text-red-400 hover:bg-red-500/10 p-1.5 rounded"><Trash2 size={13} /></button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── PAGE: MANTENIMIENTO ──────────────────────────────────────────────────────

function MantenimientoPage({ mantenimientos, setMantenimientos, showToast, addNotif }: {
  mantenimientos: Mant[]; setMantenimientos: (m: Mant[]) => void; showToast: (m: string) => void;
  addNotif: (n: Omit<Notif, "id" | "fecha" | "leida">) => void;
}) {
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ equipo: "", tipo: MANT_TIPOS[0], fechaProxima: today(), proveedor: "", notas: "", frecuenciaDias: 30, completado: false });

  function save() {
    if (!form.equipo) { showToast("⚠️ El equipo es requerido"); return; }
    const m: Mant = { id: uid(), ...form };
    const next = [m, ...mantenimientos];
    setMantenimientos(next); persist("zMant", next); setModal(false);
    const dias = Math.ceil((new Date(m.fechaProxima).getTime() - Date.now()) / 86400000);
    if (dias <= 7) addNotif({ tipo: "warning", titulo: "Mantenimiento próximo", mensaje: `${m.equipo} — ${m.tipo} en ${dias} día(s)`, modulo: "mantenimiento" });
    showToast("✅ Recordatorio guardado");
  }

  const hoy = new Date();
  const proximos = mantenimientos.filter(m => !m.completado && new Date(m.fechaProxima) <= new Date(hoy.getTime() + 7 * 86400000));

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div><h2 className="text-xl font-black text-white">Mantenimiento</h2><p className="text-sm text-[#8090a8] mt-0.5">Recordatorios de mantenimiento de equipos</p></div>
        <Btn onClick={() => setModal(true)}><Plus size={14} /> Nuevo Recordatorio</Btn>
      </div>

      {proximos.length > 0 && (
        <div className="mb-4 p-4 bg-yellow-400/10 border border-yellow-400/20 rounded-xl flex gap-3 items-start">
          <AlertTriangle size={16} className="text-yellow-400 mt-0.5 flex-shrink-0" />
          <div>
            <div className="text-sm font-bold text-yellow-300">{proximos.length} mantenimiento(s) próximo(s) esta semana</div>
            <div className="text-xs text-yellow-400/70 mt-1">{proximos.map(m => m.equipo).join(" · ")}</div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3 mb-4">
        <StatCard label="Total" value={mantenimientos.length} />
        <StatCard label="Pendientes" value={mantenimientos.filter(m => !m.completado).length} color="#f59e0b" />
        <StatCard label="Completados" value={mantenimientos.filter(m => m.completado).length} color="#10b981" />
      </div>

      <Card>
        {mantenimientos.length === 0 ? <EmptyState icon="🔧" msg="Sin recordatorios de mantenimiento" /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead><tr className="border-b border-[#1a2235]">
                {["Equipo","Tipo","Próximo","Proveedor","Notas","Estado",""].map(h => (
                  <th key={h} className="text-left py-2 px-2 text-[10px] font-bold text-[#8090a8] uppercase">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {mantenimientos.map(m => {
                  const dias = Math.ceil((new Date(m.fechaProxima).getTime() - Date.now()) / 86400000);
                  const urgente = !m.completado && dias <= 7;
                  return (
                    <tr key={m.id} className={`border-b border-[#0f1220] hover:bg-[#0a0d1a] group ${urgente ? "bg-yellow-400/5" : ""}`}>
                      <td className="py-2.5 px-2 text-sm font-medium text-white">{m.equipo}</td>
                      <td className="py-2.5 px-2 text-xs text-[#c8d8e8]">{m.tipo}</td>
                      <td className="py-2.5 px-2">
                        <div className="text-xs text-white">{m.fechaProxima}</div>
                        {!m.completado && <div className={`text-[10px] ${dias <= 0 ? "text-red-400" : dias <= 7 ? "text-yellow-400" : "text-[#8090a8]"}`}>{dias <= 0 ? "Vencido" : `en ${dias}d`}</div>}
                      </td>
                      <td className="py-2.5 px-2 text-xs text-[#8090a8]">{m.proveedor || "—"}</td>
                      <td className="py-2.5 px-2 text-xs text-[#8090a8] max-w-[100px] truncate">{m.notas || "—"}</td>
                      <td className="py-2.5 px-2">
                        <button onClick={() => { const next = mantenimientos.map(x => x.id === m.id ? { ...x, completado: !x.completado } : x); setMantenimientos(next); persist("zMant", next); }}>
                          <Badge className={m.completado ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/20 cursor-pointer" : "text-yellow-400 bg-yellow-400/10 border-yellow-400/20 cursor-pointer"}>
                            {m.completado ? "Completado" : "Pendiente"}
                          </Badge>
                        </button>
                      </td>
                      <td className="py-2.5 px-2 text-right">
                        <button onClick={() => { if (confirm("¿Eliminar?")) { const n = mantenimientos.filter(x => x.id !== m.id); setMantenimientos(n); persist("zMant", n); showToast("🗑️ Eliminado"); } }}
                          className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 p-1 text-red-400 hover:bg-red-500/10 rounded"><Trash2 size={12} /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={modal} onClose={() => setModal(false)} title="Nuevo Recordatorio">
        <div className="space-y-3">
          <Input label="Cámara / Equipo *" value={form.equipo} onChange={e => setForm(f => ({ ...f, equipo: e.target.value }))} />
          <Select label="Tipo de Mantenimiento" value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
            {MANT_TIPOS.map(t => <option key={t}>{t}</option>)}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Próximo Mantenimiento" type="date" value={form.fechaProxima} onChange={e => setForm(f => ({ ...f, fechaProxima: e.target.value }))} />
            <Select label="Proveedor" value={form.proveedor} onChange={e => setForm(f => ({ ...f, proveedor: e.target.value }))}>
              <option value="">— Seleccionar —</option>
              {PROVEEDORES.map(p => <option key={p}>{p}</option>)}
            </Select>
          </div>
          <Input label="Frecuencia (días)" type="number" min="1" value={form.frecuenciaDias} onChange={e => setForm(f => ({ ...f, frecuenciaDias: +e.target.value }))} />
          <Textarea label="Notas" value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} />
          <div className="flex justify-end gap-2 pt-2">
            <Btn variant="ghost" onClick={() => setModal(false)}>Cancelar</Btn>
            <Btn onClick={save}>💾 Guardar</Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─── PAGE: REDES (Parte 1 — dashboard + tabla, formularios en la siguiente parte) ──

function RedesPage({ redes, setRedes, cotizaciones, ventas, currentUser, showToast, addNotif }: {
  redes: ServicioRed[]; setRedes: (r: ServicioRed[]) => void; cotizaciones: Cotizacion[]; ventas: Venta[];
  currentUser: User; showToast: (m: string) => void; addNotif: (n: Omit<Notif, "id" | "fecha" | "leida">) => void;
}) {
  const [search, setSearch] = useState("");
  const [filtro, setFiltro] = useState<"todos" | EstadoRed>("todos");
  const [modal, setModal] = useState(false);
  const [detalle, setDetalle] = useState<ServicioRed | null>(null);
  const [tipoOtro, setTipoOtro] = useState(false);
  const [modModal, setModModal] = useState(false);
  const [modUploading, setModUploading] = useState(false);
  const [vista, setVista] = useState<"servicios" | "clientes">("servicios");
  const [expedienteCodigo, setExpedienteCodigo] = useState<string | null>(null);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [editandoCliente, setEditandoCliente] = useState(false);
  const [clienteForm, setClienteForm] = useState({ telefono: "", email: "", direccion: "", observaciones: "" });

  const emptyForm = {
    clienteNombre: "", clienteTelefono: "", tipoServicio: "WiFi Mesh", proveedor: "", plan: "",
    estado: "activo" as EstadoRed, fechaInstalacion: today(), descripcion: "",
  };
  const [form, setForm] = useState(emptyForm);
  const [equipos, setEquipos] = useState<EquipoRed[]>([{ id: uid(), modelo: "", marca: "", serial: "", mac: "", ubicacion: "" }]);
  const [clienteSugerencias, setClienteSugerencias] = useState(false);

  // Clientes que ya existen en Cotizador/Ventas — alimentan el buscador del
  // formulario, para no tener que crear clientes por separado en Redes.
  const clientesConocidos = Array.from(
    new Map(
      [
        ...cotizaciones.map(c => [c.cliente.toLowerCase(), { nombre: c.cliente, telefono: c.whatsapp }] as const),
        ...ventas.map(v => [v.cliente.toLowerCase(), { nombre: v.cliente, telefono: "" }] as const),
        ...redes.map(r => [r.clienteNombre.toLowerCase(), { nombre: r.clienteNombre, telefono: r.clienteTelefono }] as const),
      ]
    ).values()
  );
  const sugerenciasFiltradas = form.clienteNombre.length > 0
    ? clientesConocidos.filter(c => c.nombre.toLowerCase().includes(form.clienteNombre.toLowerCase())).slice(0, 6)
    : [];

  const filtered = redes.filter(r =>
    (filtro === "todos" || r.estado === filtro) &&
    (!search || (r.clienteNombre + r.codigoCliente + r.tipoServicio + r.equipos.map(e => e.modelo).join(" ")).toLowerCase().includes(search.toLowerCase()))
  );

  const activos = redes.filter(r => r.estado === "activo").length;
  const pendientes = redes.filter(r => r.estado === "pendiente" || r.estado === "programado").length;
  const incidencias = redes.filter(r => r.estado === "incidencia").length;
  const enMantenimiento = redes.filter(r => r.estado === "mantenimiento").length;
  const proximosMant = redes
    .filter(r => r.fechaProximoMant)
    .map(r => ({ r, dias: diasHasta(r.fechaProximoMant!) }))
    .filter(x => x.dias <= 30)
    .sort((a, b) => a.dias - b.dias);

  // ── Expediente por cliente (punto 17): agrupa todos los servicios de un
  // mismo código ZD-XXXX, y conecta con sus cotizaciones/ventas existentes ──
  type ExpedienteCliente = {
    codigo: string; nombre: string; telefono: string; email?: string; direccion?: string; observaciones?: string;
    servicios: ServicioRed[];
  };
  const expedientes: ExpedienteCliente[] = Array.from(
    redes.reduce((map, r) => {
      const key = r.codigoCliente;
      const arr = map.get(key) || [];
      arr.push(r);
      map.set(key, arr);
      return map;
    }, new Map<string, ServicioRed[]>())
  ).map(([codigo, servicios]) => {
    const ultimo = servicios.slice().sort((a, b) => b.ultimaModificacion.localeCompare(a.ultimaModificacion))[0];
    return {
      codigo, nombre: ultimo.clienteNombre, telefono: ultimo.clienteTelefono,
      email: ultimo.clienteEmail, direccion: ultimo.clienteDireccion, observaciones: ultimo.clienteObservaciones,
      servicios,
    };
  });
  const expedientesFiltrados = expedientes.filter(e =>
    !search || (e.nombre + e.codigo + e.servicios.map(s => s.tipoServicio).join(" ")).toLowerCase().includes(search.toLowerCase())
  );
  const expediente = expedienteCodigo ? expedientes.find(e => e.codigo === expedienteCodigo) || null : null;
  const cotizacionesCliente = expediente ? cotizaciones.filter(c => c.cliente.toLowerCase() === expediente.nombre.toLowerCase()) : [];
  const ventasCliente = expediente ? ventas.filter(v => v.cliente.toLowerCase() === expediente.nombre.toLowerCase()) : [];
  const equiposCliente = expediente ? expediente.servicios.flatMap(s => s.equipos.map(e => ({ ...e, servicio: s.tipoServicio }))) : [];
  const historialCliente = expediente
    ? expediente.servicios.flatMap(s => s.historial.map(h => ({ ...h, servicio: s.tipoServicio, codigoServicio: s.id }))).sort((a, b) => b.fecha.localeCompare(a.fecha))
    : [];
  const documentosCliente = expediente
    ? historialCliente.flatMap(h => [...(h.fotos || []).map(f => ({ ...f, tipo: "foto" as const })), ...(h.documentos || []).map(d => ({ ...d, tipo: "doc" as const }))])
    : [];

  function abrirExpediente(codigo: string) {
    const e = expedientes.find(x => x.codigo === codigo);
    if (!e) return;
    setExpedienteCodigo(codigo);
    setClienteForm({ telefono: e.telefono || "", email: e.email || "", direccion: e.direccion || "", observaciones: e.observaciones || "" });
    setEditandoCliente(false);
  }

  function guardarDatosCliente() {
    if (!expediente) return;
    const next = redes.map(r => r.codigoCliente === expediente.codigo
      ? { ...r, clienteTelefono: clienteForm.telefono, clienteEmail: clienteForm.email, clienteDireccion: clienteForm.direccion, clienteObservaciones: clienteForm.observaciones }
      : r);
    setRedes(next); persist("zRedes", next);
    setEditandoCliente(false);
    showToast("✅ Datos del cliente actualizados");
  }

  function nextCodigoCliente(nombre: string): string {
    const existente = redes.find(r => r.clienteNombre.toLowerCase() === nombre.toLowerCase());
    if (existente) return existente.codigoCliente;
    const nums = redes.map(r => parseInt(r.codigoCliente.replace("ZD-", ""), 10)).filter(n => !isNaN(n));
    const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
    return `ZD-${String(next).padStart(4, "0")}`;
  }

  function abrirNuevo() {
    setForm(emptyForm);
    setEquipos([{ id: uid(), modelo: "", marca: "", serial: "", mac: "", ubicacion: "" }]);
    setTipoOtro(false);
    setModal(true);
  }

  function addEquipo() { setEquipos([...equipos, { id: uid(), modelo: "", marca: "", serial: "", mac: "", ubicacion: "" }]); }
  function delEquipo(id: string) { setEquipos(equipos.filter(e => e.id !== id)); }
  function updEquipo(id: string, k: keyof EquipoRed, v: string) { setEquipos(equipos.map(e => e.id === id ? { ...e, [k]: v } : e)); }

  function guardar() {
    if (!form.clienteNombre) { showToast("⚠️ El cliente es requerido"); return; }
    if (!form.tipoServicio) { showToast("⚠️ El tipo de servicio es requerido"); return; }
    const codigo = nextCodigoCliente(form.clienteNombre);
    const ahora = new Date().toISOString();
    const equiposValidos = equipos.filter(e => e.modelo.trim());
    const nuevo: ServicioRed = {
      id: uid(),
      codigoCliente: codigo,
      clienteNombre: form.clienteNombre,
      clienteTelefono: form.clienteTelefono,
      tipoServicio: form.tipoServicio,
      proveedor: form.proveedor,
      plan: form.plan,
      estado: form.estado,
      equipos: equiposValidos,
      historial: [{
        id: uid(), fecha: form.fechaInstalacion, tipo: "instalacion",
        tecnico: currentUser.nombre,
        descripcion: form.descripcion || `Instalación de ${form.tipoServicio}${equiposValidos.length ? ` — ${equiposValidos.map(e => e.modelo).join(", ")}` : ""}.`,
      }],
      fechaInstalacion: form.fechaInstalacion,
      ultimaModificacion: ahora,
    };
    const next = [nuevo, ...redes];
    setRedes(next); persist("zRedes", next); setModal(false);
    addNotif({ tipo: "success", titulo: "Nueva instalación de red", mensaje: `${codigo} — ${nuevo.clienteNombre} (${nuevo.tipoServicio})`, modulo: "redes" });
    showToast("✅ Instalación registrada");
  }

  // ── Registro de modificaciones (punto 8) ──
  const emptyModForm = {
    tipo: "modificacion" as HistorialRed["tipo"],
    equipoAfectado: "", equipoNuevo: "",
    descripcion: "", motivo: "", observaciones: "", resultado: "",
    tecnico: currentUser.nombre, fecha: today(),
    costo: 0, precioCobrado: 0,
    nuevoEstado: "" as EstadoRed | "",
    proximoMant: "", equiposRevisados: [] as string[],
  };
  const [modForm, setModForm] = useState(emptyModForm);
  const [modFotos, setModFotos] = useState<ArchivoRed[]>([]);
  const [modDocs, setModDocs] = useState<ArchivoRed[]>([]);
  const [editingHistId, setEditingHistId] = useState<string | null>(null);

  function abrirModificacion(tipoInicial: HistorialRed["tipo"] = "modificacion") {
    setEditingHistId(null);
    setModForm({ ...emptyModForm, tecnico: currentUser.nombre, tipo: tipoInicial });
    setModFotos([]); setModDocs([]);
    setModModal(true);
  }

  function abrirEdicionHistorial(h: HistorialRed) {
    setEditingHistId(h.id);
    setModForm({
      tipo: h.tipo,
      equipoAfectado: h.equipoAfectado || "", equipoNuevo: "",
      descripcion: h.descripcion, motivo: h.motivo || "", observaciones: "", resultado: h.resultado || "",
      tecnico: h.tecnico, fecha: h.fecha,
      costo: h.costo || 0, precioCobrado: h.precioCobrado || 0,
      nuevoEstado: "",
      proximoMant: detalle?.fechaProximoMant || "", equiposRevisados: h.equiposRevisados || [],
    });
    setModFotos(h.fotos || []); setModDocs(h.documentos || []);
    setModModal(true);
  }

  function toggleEquipoRevisado(modelo: string) {
    setModForm(f => ({ ...f, equiposRevisados: f.equiposRevisados.includes(modelo) ? f.equiposRevisados.filter(x => x !== modelo) : [...f.equiposRevisados, modelo] }));
  }

  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handleFotos(files: FileList | null) {
    if (!files || files.length === 0) return;
    if (modFotos.length + files.length > 5) { showToast("⚠️ Máximo 5 fotos por modificación"); return; }
    setModUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) { showToast(`⚠️ "${file.name}" no es una imagen`); continue; }
        if (file.size > 2 * 1024 * 1024) { showToast(`⚠️ "${file.name}" pesa más de 2 MB`); continue; }
        const data = await fileToBase64(file);
        setModFotos(prev => [...prev, { id: uid(), nombre: file.name, data }]);
      }
    } finally {
      setModUploading(false);
    }
  }

  async function handleDocs(files: FileList | null) {
    if (!files || files.length === 0) return;
    if (modDocs.length + files.length > 3) { showToast("⚠️ Máximo 3 documentos por modificación"); return; }
    setModUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (file.size > 3 * 1024 * 1024) { showToast(`⚠️ "${file.name}" pesa más de 3 MB`); continue; }
        const data = await fileToBase64(file);
        setModDocs(prev => [...prev, { id: uid(), nombre: file.name, data }]);
      }
    } finally {
      setModUploading(false);
    }
  }

  function guardarModificacion() {
    if (!detalle) return;
    if (!modForm.descripcion) { showToast("⚠️ La descripción es requerida"); return; }
    const esMantenimiento = modForm.tipo === "mantenimiento";
    const equipoTexto = modForm.equipoNuevo.trim() || modForm.equipoAfectado || "";
    const histEntry: HistorialRed = {
      id: editingHistId || uid(), fecha: modForm.fecha, tipo: modForm.tipo, tecnico: modForm.tecnico || currentUser.nombre,
      descripcion: modForm.observaciones ? `${modForm.descripcion}\n\nObservaciones: ${modForm.observaciones}` : modForm.descripcion,
      motivo: modForm.motivo || undefined,
      equipoAfectado: equipoTexto || undefined,
      costo: modForm.costo || undefined,
      precioCobrado: modForm.precioCobrado || undefined,
      fotos: modFotos.length ? modFotos : undefined,
      documentos: modDocs.length ? modDocs : undefined,
      resultado: esMantenimiento && modForm.resultado ? modForm.resultado : undefined,
      equiposRevisados: esMantenimiento && modForm.equiposRevisados.length ? modForm.equiposRevisados : undefined,
    };

    let equiposActualizados = detalle.equipos;
    if (modForm.equipoNuevo.trim()) {
      equiposActualizados = [...detalle.equipos, { id: uid(), modelo: modForm.equipoNuevo.trim() }];
    }

    const nuevoHistorial = editingHistId
      ? detalle.historial.map(h => h.id === editingHistId ? histEntry : h)
      : [...detalle.historial, histEntry];

    const actualizado: ServicioRed = {
      ...detalle,
      equipos: equiposActualizados,
      historial: nuevoHistorial,
      estado: modForm.nuevoEstado || detalle.estado,
      ultimaModificacion: new Date().toISOString(),
      ...(esMantenimiento ? {
        fechaUltimoMant: modForm.fecha,
        fechaProximoMant: modForm.proximoMant || detalle.fechaProximoMant,
      } : {}),
    };

    const next = redes.map(r => r.id === detalle.id ? actualizado : r);
    setRedes(next); persist("zRedes", next);
    setDetalle(actualizado);
    setModModal(false);
    if (editingHistId) {
      addNotif({ tipo: "info", titulo: "Registro de historial editado", mensaje: `${detalle.codigoCliente} — ${detalle.clienteNombre}`, modulo: "redes" });
      showToast("✅ Registro actualizado");
    } else {
      addNotif({ tipo: "info", titulo: `${HIST_TIPO_LABELS[modForm.tipo]} registrada`, mensaje: `${detalle.codigoCliente} — ${detalle.clienteNombre}`, modulo: "redes" });
      showToast("✅ Registrado en el historial");
    }
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-black text-white">🌐 Servicios de Red</h2>
          <p className="text-sm text-[#8090a8] mt-0.5">Instalaciones, equipos e infraestructura de red de tus clientes</p>
        </div>
        <div className="flex gap-2 items-center">
          <div className="flex bg-[#0b0e1a] border border-[#1a2235] rounded-lg p-0.5">
            <button onClick={() => setVista("servicios")} className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${vista === "servicios" ? "bg-[#0ea5c8]/10 text-[#0ea5c8]" : "text-[#8090a8]"}`}>Servicios</button>
            <button onClick={() => setVista("clientes")} className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${vista === "clientes" ? "bg-[#0ea5c8]/10 text-[#0ea5c8]" : "text-[#8090a8]"}`}>Clientes</button>
          </div>
          <Btn onClick={abrirNuevo}><Plus size={14} /> Nueva instalación</Btn>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
        <StatCard label="Activos" value={activos} color="#10b981" />
        <StatCard label="Pendientes" value={pendientes} color="#eab308" />
        <StatCard label="En Mantenimiento" value={enMantenimiento} color="#f59e0b" />
        <StatCard label="Incidencias" value={incidencias} color="#ef4444" />
        <StatCard label="Mant. Próximos (30d)" value={proximosMant.length} color="#0ea5c8" />
      </div>

      {proximosMant.length > 0 && (
        <Card className="mb-4">
          <CardTitle>🔧 Próximos Mantenimientos</CardTitle>
          <div className="space-y-1.5">
            {proximosMant.slice(0, 6).map(({ r, dias }) => (
              <button key={r.id} onClick={() => setDetalle(r)}
                className="w-full flex items-center justify-between text-left px-3 py-2 bg-[#060810] border border-[#1a2235] rounded-lg hover:border-[#0ea5c8]/40">
                <div>
                  <span className="text-xs text-[#0ea5c8] font-mono mr-2">{r.codigoCliente}</span>
                  <span className="text-sm text-white font-medium">{r.clienteNombre}</span>
                  <span className="text-xs text-[#8090a8]"> — {r.tipoServicio}</span>
                </div>
                <span className={`text-xs font-semibold ${dias < 0 ? "text-red-400" : dias <= 7 ? "text-amber-400" : "text-[#8090a8]"}`}>
                  {dias < 0 ? `Vencido hace ${Math.abs(dias)}d` : dias === 0 ? "Hoy" : `En ${dias}d`}
                </span>
              </button>
            ))}
          </div>
        </Card>
      )}

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8090a8]" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar cliente, código, servicio, equipo..."
            className="w-full bg-[#0b0e1a] border border-[#1a2235] rounded-xl pl-9 pr-3 py-2.5 text-sm text-[#e8e8f0] focus:outline-none focus:border-[#0ea5c8]" />
        </div>
      </div>

      {vista === "servicios" && (
        <div className="flex gap-2 flex-wrap mb-3">
          {(["todos", "activo", "pendiente", "mantenimiento", "incidencia"] as const).map(f => (
            <button key={f} onClick={() => setFiltro(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all
                ${filtro === f ? "bg-[#0ea5c8]/10 border-[#0ea5c8] text-[#0ea5c8]" : "bg-[#060810] border-[#1a2235] text-[#8090a8] hover:text-white"}`}>
              {f === "todos" ? "Todos" : ESTADO_RED_LABELS[f]}
            </button>
          ))}
        </div>
      )}

      {vista === "servicios" ? (
        <Card>
          {filtered.length === 0 ? (
            <EmptyState icon="🌐"
              msg={redes.length === 0
                ? "Sin servicios de red registrados todavía. Usa \"+ Nueva instalación\" para agregar el primero."
                : "Ningún servicio coincide con la búsqueda o el filtro."} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead><tr className="border-b border-[#1a2235]">
                  {["Código","Cliente","Servicio","Equipo","Estado","Última modificación"].map(h => (
                    <th key={h} className="text-left py-2.5 px-3 text-[10px] font-bold text-[#8090a8] uppercase tracking-wider">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {filtered.map(r => (
                    <tr key={r.id} onClick={() => setDetalle(r)} className="border-b border-[#0f1220] hover:bg-[#0a0d1a] cursor-pointer">
                      <td className="py-2.5 px-3 text-xs text-[#0ea5c8] font-mono">{r.codigoCliente}</td>
                      <td className="py-2.5 px-3 text-sm font-medium text-white">{r.clienteNombre}</td>
                      <td className="py-2.5 px-3 text-xs text-[#c8d8e8]">{r.tipoServicio}</td>
                      <td className="py-2.5 px-3 text-xs text-[#8090a8]">{r.equipos.map(e => e.modelo).join(", ") || "—"}</td>
                      <td className="py-2.5 px-3"><Badge className={ESTADO_RED_COLORS[r.estado]}>{ESTADO_RED_LABELS[r.estado]}</Badge></td>
                      <td className="py-2.5 px-3 text-xs text-[#8090a8]">{r.ultimaModificacion ? new Date(r.ultimaModificacion).toLocaleDateString("es-GT") : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ) : (
        <Card>
          {expedientesFiltrados.length === 0 ? (
            <EmptyState icon="🗂️" msg={expedientes.length === 0 ? "Sin clientes registrados en Redes todavía." : "Ningún cliente coincide con la búsqueda."} />
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {expedientesFiltrados.map(e => {
                const totalEquipos = e.servicios.reduce((a, s) => a + s.equipos.length, 0);
                return (
                  <button key={e.codigo} onClick={() => abrirExpediente(e.codigo)}
                    className="text-left p-3.5 bg-[#060810] border border-[#1a2235] rounded-xl hover:border-[#0ea5c8]/40 transition-colors">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-[#0ea5c8] font-mono">{e.codigo}</span>
                      <span className="text-[10px] text-[#5a6a80]">{e.servicios.length} servicio(s)</span>
                    </div>
                    <div className="text-sm font-bold text-white">{e.nombre}</div>
                    {e.telefono && <div className="text-xs text-[#8090a8] mb-2">{e.telefono}</div>}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {e.servicios.slice(0, 4).map(s => (
                        <Badge key={s.id} className={ESTADO_RED_COLORS[s.estado]}>{s.tipoServicio}</Badge>
                      ))}
                    </div>
                    <div className="text-[10px] text-[#5a6a80] mt-2">{totalEquipos} equipo(s) instalado(s)</div>
                  </button>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {/* ── Modal: Nueva instalación ── */}
      <Modal open={modal} onClose={() => setModal(false)} title="Nueva Instalación de Red" width="max-w-xl">
        <div className="space-y-4">
          <div className="relative">
            <Input label="Cliente *" value={form.clienteNombre}
              onChange={e => { setForm(f => ({ ...f, clienteNombre: e.target.value })); setClienteSugerencias(true); }}
              onFocus={() => setClienteSugerencias(true)}
              onBlur={() => setTimeout(() => setClienteSugerencias(false), 150)}
              placeholder="Escribe para buscar un cliente existente..." />
            {clienteSugerencias && sugerenciasFiltradas.length > 0 && (
              <div className="absolute z-10 left-0 right-0 mt-1 bg-[#0b0e1a] border border-[#1a2235] rounded-lg shadow-xl overflow-hidden">
                {sugerenciasFiltradas.map(c => (
                  <button key={c.nombre} type="button"
                    onClick={() => { setForm(f => ({ ...f, clienteNombre: c.nombre, clienteTelefono: c.telefono || f.clienteTelefono })); setClienteSugerencias(false); }}
                    className="w-full text-left px-3 py-2 text-sm text-[#e8e8f0] hover:bg-[#0ea5c8]/10 border-b border-[#1a2235] last:border-0">
                    {c.nombre} {c.telefono && <span className="text-xs text-[#8090a8]">· {c.telefono}</span>}
                  </button>
                ))}
              </div>
            )}
            <p className="text-[10px] text-[#5a6a80] mt-1">Se buscan clientes ya existentes en Cotizador y Ventas. Si es nuevo, solo escribe su nombre.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input label="Teléfono" value={form.clienteTelefono} onChange={e => setForm(f => ({ ...f, clienteTelefono: e.target.value }))} />
            <Input label="Fecha de instalación" type="date" value={form.fechaInstalacion} onChange={e => setForm(f => ({ ...f, fechaInstalacion: e.target.value }))} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Select label="Tipo de servicio *" value={tipoOtro ? "Otro" : form.tipoServicio} onChange={e => {
              if (e.target.value === "Otro") { setTipoOtro(true); setForm(f => ({ ...f, tipoServicio: "" })); }
              else { setTipoOtro(false); setForm(f => ({ ...f, tipoServicio: e.target.value })); }
            }}>
              {TIPOS_SERVICIO_RED.map(t => <option key={t}>{t}</option>)}
              <option value="Otro">Otro...</option>
            </Select>
            <Select label="Estado inicial" value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value as EstadoRed }))}>
              {(Object.keys(ESTADO_RED_LABELS) as EstadoRed[]).map(s => <option key={s} value={s}>{ESTADO_RED_LABELS[s]}</option>)}
            </Select>
          </div>
          {tipoOtro && (
            <Input label="Nuevo tipo de servicio *" placeholder="Escribe el tipo de servicio" value={form.tipoServicio} onChange={e => setForm(f => ({ ...f, tipoServicio: e.target.value }))} />
          )}

          <div className="grid grid-cols-2 gap-3">
            <Input label="Proveedor" placeholder="Ej. Tigo, Claro..." value={form.proveedor} onChange={e => setForm(f => ({ ...f, proveedor: e.target.value }))} />
            <Input label="Plan / Velocidad" placeholder="Ej. 300 Mbps" value={form.plan} onChange={e => setForm(f => ({ ...f, plan: e.target.value }))} />
          </div>

          <div>
            <label className="text-[11px] text-[#8090a8] font-semibold uppercase tracking-wider block mb-2">Equipos instalados</label>
            <div className="space-y-2">
              {equipos.map(eq => (
                <div key={eq.id} className="grid grid-cols-[1fr_1fr_1fr_30px] gap-1.5 items-center">
                  <input value={eq.modelo} onChange={e => updEquipo(eq.id, "modelo", e.target.value)} placeholder="Modelo (ej. Deco S7)"
                    className="bg-[#060810] border border-[#1a2235] rounded-lg px-2 py-1.5 text-xs text-[#e8e8f0] focus:outline-none focus:border-[#0ea5c8] min-w-0" />
                  <input value={eq.ubicacion || ""} onChange={e => updEquipo(eq.id, "ubicacion", e.target.value)} placeholder="Ubicación"
                    className="bg-[#060810] border border-[#1a2235] rounded-lg px-2 py-1.5 text-xs text-[#e8e8f0] focus:outline-none focus:border-[#0ea5c8] min-w-0" />
                  <input value={eq.serial || ""} onChange={e => updEquipo(eq.id, "serial", e.target.value)} placeholder="Serial (opc.)"
                    className="bg-[#060810] border border-[#1a2235] rounded-lg px-2 py-1.5 text-xs text-[#e8e8f0] focus:outline-none focus:border-[#0ea5c8] min-w-0" />
                  <button onClick={() => delEquipo(eq.id)} className="text-red-400 hover:bg-red-500/10 rounded p-1.5"><X size={13} /></button>
                </div>
              ))}
            </div>
            <button onClick={addEquipo} className="w-full mt-2 py-1.5 border border-dashed border-[#1a2235] rounded-lg text-[#0ea5c8] text-xs font-semibold hover:border-[#0ea5c8] transition-colors">
              + Agregar equipo
            </button>
          </div>

          <div>
            <label className="text-[11px] text-[#8090a8] font-semibold uppercase tracking-wider block mb-1">Descripción del trabajo</label>
            <textarea value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} rows={3}
              placeholder="Se instalaron 3 Deco S7, se configuró la red Mesh, se realizaron pruebas de cobertura..."
              className="w-full bg-[#060810] border border-[#1a2235] rounded-lg px-3 py-2 text-sm text-[#e8e8f0] focus:outline-none focus:border-[#0ea5c8]" />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Btn variant="ghost" onClick={() => setModal(false)}>Cancelar</Btn>
            <Btn onClick={guardar}>💾 Guardar Instalación</Btn>
          </div>
        </div>
      </Modal>

      {/* ── Modal: Ficha del servicio ── */}
      <Modal open={!!detalle} onClose={() => setDetalle(null)} title={detalle ? `${detalle.codigoCliente} — ${detalle.tipoServicio}` : ""} width="max-w-lg">
        {detalle && (
          <div className="space-y-4 text-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-white font-bold text-base">{detalle.clienteNombre}</div>
                {detalle.clienteTelefono && <div className="text-xs text-[#8090a8]">{detalle.clienteTelefono}</div>}
              </div>
              <div className="flex items-center gap-2">
                <Badge className={ESTADO_RED_COLORS[detalle.estado]}>{ESTADO_RED_LABELS[detalle.estado]}</Badge>
                <button title="Descargar PDF" disabled={pdfGenerating}
                  onClick={async () => { setPdfGenerating(true); try { await descargarPdfServicioRed(detalle); } finally { setPdfGenerating(false); } }}
                  className="text-[#0ea5c8] hover:text-white w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#0ea5c8]/10 disabled:opacity-50">
                  {pdfGenerating ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs bg-[#060810] border border-[#1a2235] rounded-lg p-3">
              <div><span className="text-[#8090a8]">Proveedor:</span> <span className="text-white">{detalle.proveedor || "-"}</span></div>
              <div><span className="text-[#8090a8]">Plan:</span> <span className="text-white">{detalle.plan || "-"}</span></div>
              <div><span className="text-[#8090a8]">Instalación:</span> <span className="text-white">{detalle.fechaInstalacion}</span></div>
              <div><span className="text-[#8090a8]">Código:</span> <span className="text-[#0ea5c8] font-mono">{detalle.codigoCliente}</span></div>
              <div><span className="text-[#8090a8]">Último mant.:</span> <span className="text-white">{detalle.fechaUltimoMant || "-"}</span></div>
              <div>
                <span className="text-[#8090a8]">Próximo mant.:</span>{" "}
                {detalle.fechaProximoMant ? (
                  <span className={diasHasta(detalle.fechaProximoMant) < 0 ? "text-red-400 font-semibold" : diasHasta(detalle.fechaProximoMant) <= 7 ? "text-amber-400 font-semibold" : "text-white"}>
                    {detalle.fechaProximoMant} {diasHasta(detalle.fechaProximoMant) < 0 ? "(vencido)" : `(${diasHasta(detalle.fechaProximoMant)}d)`}
                  </span>
                ) : <span className="text-[#5a6a80]">-</span>}
              </div>
            </div>

            {detalle.equipos.length > 0 && (
              <div>
                <div className="text-xs font-bold text-[#8090a8] uppercase mb-1.5">Equipos ({detalle.equipos.length})</div>
                <div className="space-y-1.5">
                  {detalle.equipos.map(e => (
                    <div key={e.id} className="text-xs bg-[#060810] border border-[#1a2235] rounded-lg px-2.5 py-1.5">
                      <span className="text-white font-medium">{e.modelo}</span>
                      {e.ubicacion && <span className="text-[#8090a8]"> · {e.ubicacion}</span>}
                      {e.serial && <span className="text-[#5a6a80]"> · S/N {e.serial}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="text-xs font-bold text-[#8090a8] uppercase">Historial</div>
              <div className="flex gap-2">
                <Btn size="sm" variant="ghost" onClick={() => abrirModificacion("mantenimiento")}>🔧 Registrar mantenimiento</Btn>
                <Btn size="sm" onClick={() => abrirModificacion()}><Plus size={12} /> Nueva modificación</Btn>
              </div>
            </div>
            <div className="space-y-2 -mt-2">
              {detalle.historial.slice().reverse().map(h => (
                <div key={h.id} className="text-xs bg-[#060810] border border-[#1a2235] rounded-lg px-2.5 py-2">
                  <div className="flex items-center justify-between mb-1">
                    <Badge className="bg-[#0ea5c8]/10 text-[#0ea5c8] border-[#0ea5c8]/20">{HIST_TIPO_LABELS[h.tipo]}</Badge>
                    <div className="flex items-center gap-2">
                      <span className="text-[#5a6a80]">{new Date(h.fecha).toLocaleDateString("es-GT")}</span>
                      <button onClick={() => abrirEdicionHistorial(h)} title="Editar este registro" className="text-[#8090a8] hover:text-[#0ea5c8]"><Edit2 size={12} /></button>
                    </div>
                  </div>
                  <p className="text-[#c8d8e8] whitespace-pre-wrap">{h.descripcion}</p>
                  {h.motivo && <p className="text-[#8090a8] mt-1">Motivo: {h.motivo}</p>}
                  {h.equipoAfectado && <p className="text-[#8090a8]">Equipo: {h.equipoAfectado}</p>}
                  {h.resultado && <p className="text-[#8090a8]">Resultado: {h.resultado}</p>}
                  {h.equiposRevisados && h.equiposRevisados.length > 0 && <p className="text-[#8090a8]">Revisados: {h.equiposRevisados.join(", ")}</p>}
                  {(h.costo || h.precioCobrado) && (
                    <p className="text-[#8090a8]">
                      {h.costo ? `Costo: ${fmt(h.costo)}` : ""}{h.costo && h.precioCobrado ? " · " : ""}{h.precioCobrado ? `Cobrado: ${fmt(h.precioCobrado)}` : ""}
                    </p>
                  )}
                  {h.fotos && h.fotos.length > 0 && (
                    <div className="flex gap-1.5 mt-2 flex-wrap">
                      {h.fotos.map(f => (
                        <a key={f.id} href={f.data} target="_blank" rel="noopener noreferrer" title={f.nombre}>
                          <img src={f.data} alt={f.nombre} className="w-12 h-12 object-cover rounded border border-[#1a2235]" />
                        </a>
                      ))}
                    </div>
                  )}
                  {h.documentos && h.documentos.length > 0 && (
                    <div className="flex flex-col gap-1 mt-2">
                      {h.documentos.map(d => (
                        <a key={d.id} href={d.data} download={d.nombre} className="flex items-center gap-1.5 text-[#0ea5c8] hover:underline">
                          <FileText size={11} /> {d.nombre}
                        </a>
                      ))}
                    </div>
                  )}
                  <p className="text-[#5a6a80] mt-1.5">Técnico: {h.tecnico}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>

      {/* ── Modal: Nueva modificación ── */}
      <Modal open={modModal} onClose={() => { setModModal(false); setEditingHistId(null); }} title={detalle ? `${editingHistId ? "Editar registro" : "Nueva modificación"} — ${detalle.codigoCliente}` : ""} width="max-w-xl">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Select label="Tipo *" value={modForm.tipo} onChange={e => setModForm(f => ({ ...f, tipo: e.target.value as HistorialRed["tipo"] }))}>
              {(["modificacion", "reemplazo", "mantenimiento", "incidencia", "baja"] as const).map(t => (
                <option key={t} value={t}>{HIST_TIPO_LABELS[t]}</option>
              ))}
            </Select>
            <Input label="Fecha" type="date" value={modForm.fecha} onChange={e => setModForm(f => ({ ...f, fecha: e.target.value }))} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Select label="Equipo afectado" value={modForm.equipoAfectado} onChange={e => setModForm(f => ({ ...f, equipoAfectado: e.target.value, equipoNuevo: "" }))}>
              <option value="">— Ninguno en particular —</option>
              {(detalle?.equipos || []).map(e => <option key={e.id} value={e.modelo}>{e.modelo}{e.ubicacion ? ` · ${e.ubicacion}` : ""}</option>)}
            </Select>
            <Input label="O agregar equipo nuevo" placeholder="Ej. Deco S7 #4" value={modForm.equipoNuevo}
              onChange={e => setModForm(f => ({ ...f, equipoNuevo: e.target.value, equipoAfectado: "" }))} />
          </div>
          {modForm.equipoNuevo.trim() && (
            <p className="text-[10px] text-[#5a6a80] -mt-2">Este equipo se agregará a la lista de equipos del servicio al guardar.</p>
          )}

          <div>
            <label className="text-[11px] text-[#8090a8] font-semibold uppercase tracking-wider block mb-1">Descripción *</label>
            <textarea value={modForm.descripcion} onChange={e => setModForm(f => ({ ...f, descripcion: e.target.value }))} rows={3}
              placeholder="¿Qué se hizo?"
              className="w-full bg-[#060810] border border-[#1a2235] rounded-lg px-3 py-2 text-sm text-[#e8e8f0] focus:outline-none focus:border-[#0ea5c8]" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input label="Motivo" placeholder="¿Por qué se hizo?" value={modForm.motivo} onChange={e => setModForm(f => ({ ...f, motivo: e.target.value }))} />
            <Input label="Técnico" value={modForm.tecnico} onChange={e => setModForm(f => ({ ...f, tecnico: e.target.value }))} />
          </div>

          <div>
            <label className="text-[11px] text-[#8090a8] font-semibold uppercase tracking-wider block mb-1">Observaciones</label>
            <textarea value={modForm.observaciones} onChange={e => setModForm(f => ({ ...f, observaciones: e.target.value }))} rows={2}
              className="w-full bg-[#060810] border border-[#1a2235] rounded-lg px-3 py-2 text-sm text-[#e8e8f0] focus:outline-none focus:border-[#0ea5c8]" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input label="Costo (Q)" type="number" min="0" step="0.01" value={modForm.costo || ""} onChange={e => setModForm(f => ({ ...f, costo: +e.target.value }))} />
            <Input label="Precio cobrado (Q)" type="number" min="0" step="0.01" value={modForm.precioCobrado || ""} onChange={e => setModForm(f => ({ ...f, precioCobrado: +e.target.value }))} />
          </div>
          <p className="text-[10px] text-[#5a6a80] -mt-2">Solo informativo dentro de Redes — no afecta las estadísticas de Ventas.</p>

          {modForm.tipo === "mantenimiento" && (
            <div className="bg-[#091520] border border-[#1a4fa8]/40 rounded-xl p-3.5 space-y-3">
              <div className="text-xs font-bold text-[#0ea5c8] uppercase">🔧 Datos del mantenimiento</div>
              <div>
                <label className="text-[11px] text-[#8090a8] font-semibold uppercase tracking-wider block mb-1">Resultado</label>
                <textarea value={modForm.resultado} onChange={e => setModForm(f => ({ ...f, resultado: e.target.value }))} rows={2}
                  placeholder="Ej. Red funcionando correctamente, se optimizó ubicación de nodos..."
                  className="w-full bg-[#060810] border border-[#1a2235] rounded-lg px-3 py-2 text-sm text-[#e8e8f0] focus:outline-none focus:border-[#0ea5c8]" />
              </div>
              {(detalle?.equipos.length || 0) > 0 && (
                <div>
                  <label className="text-[11px] text-[#8090a8] font-semibold uppercase tracking-wider block mb-1.5">Equipos revisados</label>
                  <div className="flex flex-wrap gap-1.5">
                    {detalle!.equipos.map(e => (
                      <button key={e.id} type="button" onClick={() => toggleEquipoRevisado(e.modelo)}
                        className={`px-2.5 py-1 rounded-lg text-xs border transition-all
                          ${modForm.equiposRevisados.includes(e.modelo) ? "bg-[#0ea5c8]/10 border-[#0ea5c8] text-[#0ea5c8]" : "bg-[#060810] border-[#1a2235] text-[#8090a8]"}`}>
                        {e.modelo}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <label className="text-[11px] text-[#8090a8] font-semibold uppercase tracking-wider block mb-1">Próximo mantenimiento</label>
                <div className="flex gap-2 items-center flex-wrap">
                  <input type="date" value={modForm.proximoMant} onChange={e => setModForm(f => ({ ...f, proximoMant: e.target.value }))}
                    className="bg-[#060810] border border-[#1a2235] rounded-lg px-3 py-2 text-sm text-[#e8e8f0] focus:outline-none focus:border-[#0ea5c8]" />
                  {[30, 90, 180].map(dias => (
                    <button key={dias} type="button"
                      onClick={() => { const d = new Date(modForm.fecha || today()); d.setDate(d.getDate() + dias); setModForm(f => ({ ...f, proximoMant: d.toISOString().split("T")[0] })); }}
                      className="px-2.5 py-1.5 rounded-lg text-xs bg-[#060810] border border-[#1a2235] text-[#8090a8] hover:text-[#0ea5c8] hover:border-[#0ea5c8]">
                      +{dias}d
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <Select label="Actualizar estado del servicio a..." value={modForm.nuevoEstado} onChange={e => setModForm(f => ({ ...f, nuevoEstado: e.target.value as EstadoRed | "" }))}>
            <option value="">— Mantener estado actual ({detalle ? ESTADO_RED_LABELS[detalle.estado] : ""}) —</option>
            {(Object.keys(ESTADO_RED_LABELS) as EstadoRed[]).map(s => <option key={s} value={s}>{ESTADO_RED_LABELS[s]}</option>)}
          </Select>

          <div>
            <label className="text-[11px] text-[#8090a8] font-semibold uppercase tracking-wider block mb-1.5">Fotos (máx. 5, 2 MB c/u)</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {modFotos.map(f => (
                <div key={f.id} className="relative">
                  <img src={f.data} alt={f.nombre} className="w-14 h-14 object-cover rounded border border-[#1a2235]" />
                  <button onClick={() => setModFotos(modFotos.filter(x => x.id !== f.id))} className="absolute -top-1.5 -right-1.5 bg-red-500 rounded-full w-4 h-4 flex items-center justify-center text-white"><X size={10} /></button>
                </div>
              ))}
            </div>
            <label className="flex items-center justify-center gap-2 border border-dashed border-[#1a2235] rounded-lg py-2.5 text-xs text-[#8090a8] hover:border-[#0ea5c8] hover:text-[#0ea5c8] cursor-pointer transition-colors">
              <Upload size={13} /> {modUploading ? "Cargando..." : "Subir fotos"}
              <input type="file" accept="image/*" multiple className="hidden" onChange={e => handleFotos(e.target.files)} />
            </label>
          </div>

          <div>
            <label className="text-[11px] text-[#8090a8] font-semibold uppercase tracking-wider block mb-1.5">Documentos (máx. 3, 3 MB c/u)</label>
            <div className="space-y-1.5 mb-2">
              {modDocs.map(d => (
                <div key={d.id} className="flex items-center justify-between bg-[#060810] border border-[#1a2235] rounded-lg px-3 py-1.5">
                  <span className="text-xs text-[#c8d8e8] truncate flex items-center gap-1.5"><FileText size={12} className="text-[#0ea5c8]" /> {d.nombre}</span>
                  <button onClick={() => setModDocs(modDocs.filter(x => x.id !== d.id))} className="text-red-400 hover:bg-red-500/10 p-1 rounded flex-shrink-0"><X size={12} /></button>
                </div>
              ))}
            </div>
            <label className="flex items-center justify-center gap-2 border border-dashed border-[#1a2235] rounded-lg py-2.5 text-xs text-[#8090a8] hover:border-[#0ea5c8] hover:text-[#0ea5c8] cursor-pointer transition-colors">
              <Upload size={13} /> {modUploading ? "Cargando..." : "Subir documentos"}
              <input type="file" multiple className="hidden" onChange={e => handleDocs(e.target.files)} />
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Btn variant="ghost" onClick={() => { setModModal(false); setEditingHistId(null); }}>Cancelar</Btn>
            <Btn onClick={guardarModificacion}>💾 {editingHistId ? "Guardar cambios" : "Guardar"}</Btn>
          </div>
        </div>
      </Modal>

      {/* ── Modal: Expediente del cliente (punto 17) ── */}
      <Modal open={!!expediente} onClose={() => setExpedienteCodigo(null)} title={expediente ? `Expediente — ${expediente.codigo}` : ""} width="max-w-2xl">
        {expediente && (
          <div className="space-y-4 text-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-white font-bold text-lg">{expediente.nombre}</div>
                <div className="text-xs text-[#8090a8]">{expediente.servicios.length} servicio(s) · {equiposCliente.length} equipo(s)</div>
              </div>
              <Btn size="sm" variant="ghost" onClick={() => setEditandoCliente(v => !v)}><Edit2 size={12} /> {editandoCliente ? "Cancelar" : "Editar datos"}</Btn>
            </div>

            {editandoCliente ? (
              <div className="space-y-3 bg-[#060810] border border-[#1a2235] rounded-lg p-3">
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Teléfono" value={clienteForm.telefono} onChange={e => setClienteForm(f => ({ ...f, telefono: e.target.value }))} />
                  <Input label="Email" type="email" value={clienteForm.email} onChange={e => setClienteForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <Input label="Dirección" value={clienteForm.direccion} onChange={e => setClienteForm(f => ({ ...f, direccion: e.target.value }))} />
                <div>
                  <label className="text-[11px] text-[#8090a8] font-semibold uppercase tracking-wider block mb-1">Observaciones</label>
                  <textarea value={clienteForm.observaciones} onChange={e => setClienteForm(f => ({ ...f, observaciones: e.target.value }))} rows={2}
                    className="w-full bg-[#0b0e1a] border border-[#1a2235] rounded-lg px-3 py-2 text-sm text-[#e8e8f0] focus:outline-none focus:border-[#0ea5c8]" />
                </div>
                <div className="flex justify-end"><Btn size="sm" onClick={guardarDatosCliente}>💾 Guardar datos</Btn></div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 text-xs bg-[#060810] border border-[#1a2235] rounded-lg p-3">
                <div><span className="text-[#8090a8]">Teléfono:</span> <span className="text-white">{expediente.telefono || "-"}</span></div>
                <div><span className="text-[#8090a8]">Email:</span> <span className="text-white">{expediente.email || "-"}</span></div>
                <div className="col-span-2"><span className="text-[#8090a8]">Dirección:</span> <span className="text-white">{expediente.direccion || "-"}</span></div>
                {expediente.observaciones && <div className="col-span-2"><span className="text-[#8090a8]">Observaciones:</span> <span className="text-white">{expediente.observaciones}</span></div>}
              </div>
            )}

            <div>
              <div className="text-xs font-bold text-[#8090a8] uppercase mb-1.5">Servicios ({expediente.servicios.length})</div>
              <div className="space-y-1.5">
                {expediente.servicios.map(s => (
                  <button key={s.id} onClick={() => { setExpedienteCodigo(null); setDetalle(s); }}
                    className="w-full flex items-center justify-between text-left px-3 py-2 bg-[#060810] border border-[#1a2235] rounded-lg hover:border-[#0ea5c8]/40">
                    <span className="text-sm text-white">{s.tipoServicio}</span>
                    <Badge className={ESTADO_RED_COLORS[s.estado]}>{ESTADO_RED_LABELS[s.estado]}</Badge>
                  </button>
                ))}
              </div>
            </div>

            {equiposCliente.length > 0 && (
              <div>
                <div className="text-xs font-bold text-[#8090a8] uppercase mb-1.5">Equipos instalados ({equiposCliente.length})</div>
                <div className="flex flex-wrap gap-1.5">
                  {equiposCliente.map((e, i) => (
                    <span key={e.id + i} className="text-xs bg-[#060810] border border-[#1a2235] rounded-lg px-2.5 py-1 text-[#c8d8e8]">
                      {e.modelo} <span className="text-[#5a6a80]">· {e.servicio}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {(cotizacionesCliente.length > 0 || ventasCliente.length > 0) && (
              <div>
                <div className="text-xs font-bold text-[#8090a8] uppercase mb-1.5">Cotizaciones y Ventas</div>
                <div className="space-y-1.5">
                  {cotizacionesCliente.map(c => (
                    <div key={c.id} className="flex items-center justify-between text-xs bg-[#060810] border border-[#1a2235] rounded-lg px-3 py-1.5">
                      <span className="text-[#c8d8e8]">{c.id} · {fmt(c.total)}</span>
                      <button onClick={() => descargarPdfCotizacion(c)} className="text-[#0ea5c8] hover:text-white"><Download size={12} /></button>
                    </div>
                  ))}
                  {ventasCliente.map(v => (
                    <div key={v.id} className="flex items-center justify-between text-xs bg-[#060810] border border-[#1a2235] rounded-lg px-3 py-1.5">
                      <span className="text-[#c8d8e8]">Venta {v.fecha} · {fmt(v.total)}</span>
                      {v.facturaPdf && <a href={v.facturaPdf} download={v.facturaNombre || "factura.pdf"} className="text-[#0ea5c8] hover:text-white"><Download size={12} /></a>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {documentosCliente.length > 0 && (
              <div>
                <div className="text-xs font-bold text-[#8090a8] uppercase mb-1.5">Fotos y documentos ({documentosCliente.length})</div>
                <div className="flex flex-wrap gap-1.5">
                  {documentosCliente.map(d => d.tipo === "foto" ? (
                    <a key={d.id} href={d.data} target="_blank" rel="noopener noreferrer" title={d.nombre}>
                      <img src={d.data} alt={d.nombre} className="w-12 h-12 object-cover rounded border border-[#1a2235]" />
                    </a>
                  ) : (
                    <a key={d.id} href={d.data} download={d.nombre} className="flex items-center gap-1 text-xs text-[#0ea5c8] bg-[#060810] border border-[#1a2235] rounded-lg px-2 py-1.5 hover:underline">
                      <FileText size={11} /> {d.nombre}
                    </a>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div className="text-xs font-bold text-[#8090a8] uppercase mb-1.5">Historial combinado</div>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {historialCliente.slice(0, 15).map(h => (
                  <div key={h.id} className="text-xs bg-[#060810] border border-[#1a2235] rounded-lg px-2.5 py-2">
                    <div className="flex items-center justify-between mb-1">
                      <Badge className="bg-[#0ea5c8]/10 text-[#0ea5c8] border-[#0ea5c8]/20">{HIST_TIPO_LABELS[h.tipo]} · {h.servicio}</Badge>
                      <span className="text-[#5a6a80]">{new Date(h.fecha).toLocaleDateString("es-GT")}</span>
                    </div>
                    <p className="text-[#c8d8e8] whitespace-pre-wrap">{h.descripcion}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function UsuariosPage({ users, setUsers, currentUser, showToast, addNotif }: {
  users: User[]; setUsers: (u: User[]) => void; currentUser: User;
  showToast: (m: string) => void; addNotif: (n: Omit<Notif, "id" | "fecha" | "leida">) => void;
}) {
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState<Partial<User & { password: string; passwordConfirm: string }>>({});
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingList, setLoadingList] = useState(true);

  useEffect(() => {
    (async () => {
      setLoadingList(true);
      const profiles = await fetchAllUserProfiles<Omit<User, "uid">>();
      if (profiles) {
        setUsers(Object.entries(profiles).map(([uidKey, p]) => ({ ...p, uid: uidKey })));
      }
      setLoadingList(false);
    })();
  }, []);

  if (currentUser.rol !== "admin") {
    return (
      <div className="max-w-md mx-auto text-center py-20">
        <Shield size={40} className="text-[#8090a8] mx-auto mb-4" />
        <h3 className="text-lg font-bold text-white">Acceso Restringido</h3>
        <p className="text-[#8090a8] text-sm mt-2">Solo los administradores pueden gestionar usuarios.</p>
      </div>
    );
  }

  const adminsActivos = users.filter(u => u.rol === "admin" && u.activo);

  function openCreate() {
    setEditing(null);
    setForm({ nombre: "", email: "", password: "", passwordConfirm: "", rol: "vendedor", activo: true, permisos: { ...ROLE_DEFAULT_PERMISOS["vendedor"] } as Permisos });
    setModal(true);
  }

  function openEdit(u: User) {
    setEditing(u);
    setForm({ ...u, password: "", passwordConfirm: "" });
    setModal(true);
  }

  function onRoleChange(rol: Role) {
    setForm(f => ({ ...f, rol, permisos: { ...ROLE_DEFAULT_PERMISOS[rol] } as Permisos }));
  }

  function togglePermiso(k: keyof Permisos) {
    setForm(f => ({ ...f, permisos: { ...(f.permisos || {}), [k]: !(f.permisos as Permisos)[k] } as Permisos }));
  }

  async function save() {
    if (!form.nombre || !form.email) { showToast("⚠️ Nombre y email son requeridos"); return; }
    if (!editing) {
      if (!form.password || form.password.length < 6) { showToast("⚠️ La contraseña debe tener al menos 6 caracteres"); return; }
      if (form.password !== form.passwordConfirm) { showToast("⚠️ Las contraseñas no coinciden"); return; }
    }
    setLoading(true);
    try {
      if (editing) {
        const profile = {
          nombre: form.nombre!, email: editing.email, rol: form.rol as Role,
          permisos: form.permisos as Permisos, activo: form.activo !== false,
          creado: editing.creado, ultimoAcceso: editing.ultimoAcceso,
        };
        const ok = await setUserProfile(editing.uid, profile);
        if (!ok) { showToast("⚠️ No se pudo guardar (revisa la conexión con Firebase)"); setLoading(false); return; }
        const next = users.map(x => x.uid === editing.uid ? { ...profile, uid: editing.uid } : x);
        setUsers(next);
        showToast("✅ Usuario actualizado");
      } else {
        const newUid = await createUserEmail(form.email!, form.password!);
        const profile = {
          nombre: form.nombre!, email: form.email!, rol: form.rol as Role,
          permisos: form.permisos as Permisos, activo: form.activo !== false,
          creado: new Date().toISOString(), ultimoAcceso: "",
        };
        await setUserProfile(newUid, profile);
        const next = [...users, { ...profile, uid: newUid }];
        setUsers(next);
        addNotif({ tipo: "info", titulo: "Nuevo usuario creado", mensaje: `${profile.nombre} (${ROLE_LABELS[profile.rol]}) fue agregado al sistema`, modulo: "usuarios" });
        showToast("✅ Usuario creado");
      }
      setModal(false);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || "";
      const mensajes: Record<string, string> = {
        "auth/email-already-in-use": "Ese email ya tiene una cuenta en Firebase.",
        "auth/invalid-email": "El email no es válido.",
        "auth/weak-password": "La contraseña es demasiado débil (mínimo 6 caracteres).",
      };
      showToast("⚠️ " + (mensajes[code] || "No se pudo crear el usuario"));
    } finally {
      setLoading(false);
    }
  }

  async function toggleActivo(u: User) {
    if (u.rol === "admin" && u.activo && adminsActivos.length <= 1) { showToast("⚠️ No puedes desactivar al único administrador activo"); return; }
    const profile = { nombre: u.nombre, email: u.email, rol: u.rol, permisos: u.permisos, activo: !u.activo, creado: u.creado, ultimoAcceso: u.ultimoAcceso };
    const ok = await setUserProfile(u.uid, profile);
    if (!ok) { showToast("⚠️ No se pudo actualizar"); return; }
    const next = users.map(x => x.uid === u.uid ? { ...profile, uid: u.uid } : x);
    setUsers(next); showToast("✅ Estado actualizado");
  }

  async function enviarResetPassword(u: User) {
    try {
      await sendPasswordReset(u.email);
      showToast(`✅ Correo de restablecimiento enviado a ${u.email}`);
    } catch {
      showToast("⚠️ No se pudo enviar el correo de restablecimiento");
    }
  }

  async function del(u: User) {
    if (u.rol === "admin" && adminsActivos.length <= 1) { showToast("⚠️ No puedes eliminar al único administrador activo"); return; }
    if (!confirm(`¿Quitar el acceso de ${u.nombre}? Esto elimina su perfil de Zento Data — su cuenta de inicio de sesión en Firebase seguirá existiendo, pero ya no podrá usar la app. Para eliminar la cuenta por completo, hazlo desde Firebase Console → Authentication.`)) return;
    // No se puede borrar la cuenta de Firebase Auth de otro usuario desde el cliente
    // (requiere Admin SDK). Aquí solo se retira su perfil, lo que revoca el acceso
    // porque las reglas de la base exigen que exista un perfil activo.
    const ok = await setUserProfile(u.uid, null);
    if (!ok) { showToast("⚠️ No se pudo eliminar"); return; }
    const next = users.filter(x => x.uid !== u.uid);
    setUsers(next); showToast("🗑️ Acceso revocado");
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-black text-white">Panel de Usuarios</h2>
          <p className="text-sm text-[#8090a8] mt-0.5">Gestiona usuarios y permisos del sistema</p>
        </div>
        <Btn onClick={openCreate}><Users size={14} /> Crear Usuario</Btn>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <StatCard label="Total Usuarios" value={users.length} />
        <StatCard label="Activos" value={users.filter(u => u.activo).length} color="#10b981" />
        <StatCard label="Inactivos" value={users.filter(u => !u.activo).length} color="#ef4444" />
        <StatCard label="Admins" value={users.filter(u => u.rol === "admin").length} color="#0ea5c8" />
      </div>

      <Card>
        {loadingList ? (
          <div className="text-center py-10 text-sm text-[#8090a8]">Cargando usuarios...</div>
        ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead><tr className="border-b border-[#1a2235]">
              {["Usuario","Email","Rol","Módulos","Último Acceso","Estado",""].map(h => (
                <th key={h} className="text-left py-2.5 px-3 text-[10px] font-bold text-[#8090a8] uppercase tracking-wider">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {users.map(u => {
                const rolCss = u.rol === "admin" ? "text-[#0ea5c8] bg-[#0ea5c8]/10 border-[#0ea5c8]/20" : u.rol === "tecnico" ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/20" : u.rol === "vendedor" ? "text-yellow-400 bg-yellow-400/10 border-yellow-400/20" : "text-[#8090a8] bg-[#8090a8]/10 border-[#8090a8]/20";
                const modCount = Object.values(u.permisos).filter(Boolean).length;
                const esUnicoAdmin = u.rol === "admin" && adminsActivos.length <= 1;
                return (
                  <tr key={u.uid} className="border-b border-[#0f1220] hover:bg-[#0a0d1a] group">
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                          style={{ background: "linear-gradient(135deg,#1a4fa8,#0ea5c8)" }}>
                          {u.nombre.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-white">{u.nombre}</div>
                          {u.uid === currentUser.uid && <div className="text-[10px] text-[#0ea5c8]">← tú</div>}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-xs text-[#8090a8]">{u.email}</td>
                    <td className="py-3 px-3"><Badge className={rolCss}>{ROLE_LABELS[u.rol]}</Badge></td>
                    <td className="py-3 px-3">
                      <span className="text-xs text-[#8090a8]">{modCount} / {MODULOS.length} módulos</span>
                    </td>
                    <td className="py-3 px-3 text-xs text-[#8090a8]">
                      {u.ultimoAcceso ? new Date(u.ultimoAcceso).toLocaleDateString("es-GT") : "—"}
                    </td>
                    <td className="py-3 px-3">
                      <button onClick={() => toggleActivo(u)} disabled={esUnicoAdmin && u.activo}>
                        <Badge className={u.activo ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/20 cursor-pointer" : "text-red-400 bg-red-400/10 border-red-400/20 cursor-pointer"}>
                          {u.activo ? "Activo" : "Inactivo"}
                        </Badge>
                      </button>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center gap-1 justify-end opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <button onClick={() => enviarResetPassword(u)} title="Enviar restablecimiento de contraseña" className="p-1.5 text-[#8090a8] hover:text-white rounded hover:bg-[#1a2235]"><RefreshCw size={13} /></button>
                        <button onClick={() => openEdit(u)} title="Editar" className="p-1.5 text-[#8090a8] hover:text-white rounded hover:bg-[#1a2235]"><Edit2 size={13} /></button>
                        {!esUnicoAdmin && (
                          <button onClick={() => del(u)} title="Quitar acceso" className="p-1.5 text-[#8090a8] hover:text-red-400 rounded hover:bg-red-500/10"><Trash2 size={13} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        )}
      </Card>

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? "Editar Usuario" : "Crear Usuario"} width="max-w-xl">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Nombre completo *" value={form.nombre || ""} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
            <Input label="Email *" type="email" value={form.email || ""} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} disabled={!!editing} />
          </div>
          {editing ? (
            <p className="text-xs text-[#8090a8] bg-[#060810] border border-[#1a2235] rounded-lg px-3 py-2">
              La contraseña se administra desde Firebase — usa el botón <RefreshCw size={11} className="inline" /> en la tabla para enviarle un correo de restablecimiento a este usuario.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1 relative">
                <label className="text-[11px] text-[#8090a8] font-semibold uppercase tracking-wider">Contraseña *</label>
                <div className="relative">
                  <input type={showPw ? "text" : "password"} value={form.password || ""} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    className="w-full bg-[#060810] border border-[#1a2235] rounded-lg px-3 py-2 text-[#e8e8f0] text-sm focus:outline-none focus:border-[#0ea5c8] pr-10"
                    placeholder="Mínimo 6 caracteres" />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8090a8]">
                    {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
              <Input label="Confirmar contraseña" type={showPw ? "text" : "password"} value={form.passwordConfirm || ""} onChange={e => setForm(f => ({ ...f, passwordConfirm: e.target.value }))} placeholder="Repetir contraseña" />
            </div>
          )}

          <div>
            <label className="text-[11px] text-[#8090a8] font-semibold uppercase tracking-wider block mb-2">Rol del Usuario</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(["admin","tecnico","vendedor","visor"] as Role[]).map(r => (
                <button key={r} onClick={() => onRoleChange(r)}
                  className={`py-2 rounded-xl text-xs font-semibold border-2 transition-all
                    ${form.rol === r ? "border-[#0ea5c8] bg-[#0ea5c8]/10 text-white" : "border-[#1a2235] bg-[#060810] text-[#8090a8] hover:border-[#2a3a5a]"}`}>
                  {ROLE_LABELS[r]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[11px] text-[#8090a8] font-semibold uppercase tracking-wider block mb-2">Permisos de Módulos</label>
            <div className="grid grid-cols-2 gap-2">
              {MODULOS.map(m => {
                const hasPermiso = (form.permisos as Permisos)?.[m.id] || false;
                return (
                  <label key={m.id} className={`flex items-center gap-2.5 p-2.5 rounded-xl cursor-pointer border transition-all
                    ${hasPermiso ? "border-[#0ea5c8]/40 bg-[#0ea5c8]/5 text-white" : "border-[#1a2235] bg-[#060810] text-[#8090a8]"}`}>
                    <input type="checkbox" checked={hasPermiso} onChange={() => togglePermiso(m.id)} className="accent-[#0ea5c8]" />
                    <span className="flex items-center gap-1.5 text-xs font-medium">
                      {m.icon} {m.label}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-[#c8d8e8]">
              <input type="checkbox" checked={form.activo !== false} onChange={e => setForm(f => ({ ...f, activo: e.target.checked }))} className="accent-[#0ea5c8]" />
              Usuario activo
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-[#1a2235]">
            <Btn variant="ghost" onClick={() => setModal(false)}>Cancelar</Btn>
            <Btn onClick={save}>{loading ? "Guardando..." : editing ? "Actualizar" : "Crear Usuario"}</Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─── PWA SETUP ───────────────────────────────────────────────────────────────

function usePWA() {
  useEffect(() => {
    // Register service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    // Inject manifest link if missing
    if (!document.querySelector('link[rel="manifest"]')) {
      const link = document.createElement("link");
      link.rel = "manifest";
      link.href = "/manifest.json";
      document.head.appendChild(link);
    }
    // Set theme-color meta
    if (!document.querySelector('meta[name="theme-color"]')) {
      const meta = document.createElement("meta");
      meta.name = "theme-color";
      meta.content = "#0ea5c8";
      document.head.appendChild(meta);
    }
    // Apple PWA meta tags
    const appleCapable = document.createElement("meta");
    appleCapable.name = "apple-mobile-web-app-capable";
    appleCapable.content = "yes";
    if (!document.querySelector('meta[name="apple-mobile-web-app-capable"]'))
      document.head.appendChild(appleCapable);
    const appleTitle = document.createElement("meta");
    appleTitle.name = "apple-mobile-web-app-title";
    appleTitle.content = "ZentoData";
    if (!document.querySelector('meta[name="apple-mobile-web-app-title"]'))
      document.head.appendChild(appleTitle);
  }, []);
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────

export default function App() {
  usePWA();
  const [phase, setPhase] = useState<"splash" | "login" | "app">("splash");
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [profileIssue, setProfileIssue] = useState<{ type: "missing" | "disabled"; uid: string; email: string } | null>(null);
  const [activeTab, setActiveTab] = useState("cotizador");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { msg: toastMsg, show: showToast } = useToast();

  // Data state
  const [users, setUsers] = useState<User[]>([]);
  const [catalog, setCatalog] = useState<Producto[]>(() => ls("zentocat", null) ?? DEFAULT_CATALOG);
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>(() => ls("zCotizaciones", []));
  const [ventas, setVentas] = useState<Venta[]>(() => ls("zVentas", []));
  const [inventario, setInventario] = useState<ItemInv[]>(() => ls("zInventario", []));
  const [gastos, setGastos] = useState<Gasto[]>(() => ls("zGastos", []));
  const [pagos, setPagos] = useState<Pago[]>(() => ls("zPagos", []));
  const [mantenimientos, setMantenimientos] = useState<Mant[]>(() => ls("zMant", []));
  const [redes, setRedes] = useState<ServicioRed[]>(() => ls("zRedes", []));
  const [notifs, setNotifs] = useState<Notif[]>(() => ls("zNotifs", []));
  const [fbUrl, setFbUrlState] = useState(() => getFbUrl());
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "synced" | "offline" | "error">("idle");
  const [cloudLoaded, setCloudLoaded] = useState(false);

  function addNotif(n: Omit<Notif, "id" | "fecha" | "leida">) {
    const notif: Notif = { ...n, id: uid(), fecha: new Date().toISOString(), leida: false };
    setNotifs(prev => { const next = [notif, ...prev].slice(0, 50); persist("zNotifs", next); return next; });
    notifyBrowser(n.titulo, n.mensaje);
  }

  // Pide permiso de notificaciones del navegador al abrir la app
  useEffect(() => { requestNotifPermission(); }, []);

  // Escucha el estado de sincronización con la nube
  useEffect(() => onSyncStatusChange(setSyncStatus), []);

  // Escucha la sesión REAL de Firebase Authentication (email/contraseña).
  // Ya no existe inicio de sesión anónimo ni una lista local de usuarios con
  // contraseñas: el perfil (nombre, rol, permisos, activo) vive en
  // /users/{uid} en Firebase, indexado por el UID real de la cuenta.
  useEffect(() => {
    const unsub = onAuthChange(async (fbUser) => {
      if (!fbUser) {
        setCurrentUser(null);
        setProfileIssue(null);
        setAuthChecking(false);
        setPhase(p => (p === "app" ? "login" : p));
        return;
      }
      const profile = await getUserProfile<Omit<User, "uid">>(fbUser.uid);
      if (!profile) {
        setProfileIssue({ type: "missing", uid: fbUser.uid, email: fbUser.email || "" });
        setAuthChecking(false);
        return;
      }
      if (!profile.activo) {
        setProfileIssue({ type: "disabled", uid: fbUser.uid, email: fbUser.email || "" });
        setAuthChecking(false);
        await signOutFb().catch(() => {});
        return;
      }
      const ultimoAcceso = new Date().toISOString();
      const updated: User = { ...profile, uid: fbUser.uid, ultimoAcceso };
      setCurrentUser(updated);
      setProfileIssue(null);
      setUserProfile(fbUser.uid, { ...profile, ultimoAcceso }); // no bloqueante
      setAuthChecking(false);
      setPhase("app");
    });
    return unsub;
  }, []);

  // Una vez hay sesión, trae los datos de negocio guardados en la nube
  useEffect(() => {
    if (!currentUser || cloudLoaded) return;
    let cancelled = false;
    (async () => {
      try {
        if (fbUrl) {
          const cloud = await fetchAllCloud();
          if (cancelled) return;
          if (cloud.zentocat) { setCatalog(cloud.zentocat as Producto[]); lsSet("zentocat", cloud.zentocat); }
          if (cloud.zCotizaciones) { setCotizaciones(cloud.zCotizaciones as Cotizacion[]); lsSet("zCotizaciones", cloud.zCotizaciones); }
          if (cloud.zVentas) { setVentas(cloud.zVentas as Venta[]); lsSet("zVentas", cloud.zVentas); }
          if (cloud.zInventario) { setInventario(cloud.zInventario as ItemInv[]); lsSet("zInventario", cloud.zInventario); }
          if (cloud.zGastos) { setGastos(cloud.zGastos as Gasto[]); lsSet("zGastos", cloud.zGastos); }
          if (cloud.zPagos) { const p = (cloud.zPagos as Pago[]).map(x => ({ tipo: "cobrar" as const, ...x })); setPagos(p); lsSet("zPagos", p); }
          if (cloud.zMant) { setMantenimientos(cloud.zMant as Mant[]); lsSet("zMant", cloud.zMant); }
          if (cloud.zRedes) { setRedes(cloud.zRedes as ServicioRed[]); lsSet("zRedes", cloud.zRedes); }
          if (cloud.zNotifs) { setNotifs(cloud.zNotifs as Notif[]); lsSet("zNotifs", cloud.zNotifs); }
          if (cloud.zHojas) lsSet("zHojas", cloud.zHojas);
          if (Object.keys(cloud).length > 0) showToast("☁️ Datos sincronizados desde la nube");
        }
      } catch (e) {
        console.error("Error cargando datos de la nube:", e);
      } finally {
        if (!cancelled) setCloudLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [currentUser, fbUrl, cloudLoaded]);

  const alertedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!cloudLoaded) return; // espera a que los datos reales (nube o local) estén cargados
    const bajos = inventario.filter(i => i.stock <= i.minimo);
    const keyBajos = "inv-" + bajos.map(i => i.id).sort().join(",");
    if (bajos.length > 0 && !alertedRef.current.has(keyBajos)) {
      alertedRef.current.add(keyBajos);
      addNotif({ tipo: "warning", titulo: `${bajos.length} item(s) con stock bajo`, mensaje: bajos.slice(0, 3).map(i => i.nombre).join(", "), modulo: "inventario" });
    }

    const mantProx = mantenimientos.filter(m => !m.completado && diasHasta(m.fechaProxima) <= 7);
    const keyMant = "mant-" + mantProx.map(m => m.id).sort().join(",");
    if (mantProx.length > 0 && !alertedRef.current.has(keyMant)) {
      alertedRef.current.add(keyMant);
      addNotif({ tipo: "warning", titulo: `${mantProx.length} mantenimiento(s) esta semana`, mensaje: mantProx.slice(0, 3).map(m => m.equipo).join(", "), modulo: "mantenimiento" });
    }

    const redesProx = redes.filter(r => r.fechaProximoMant && diasHasta(r.fechaProximoMant) <= 7);
    redesProx.forEach(r => {
      const key = `red-mant-${r.id}-${r.fechaProximoMant}`;
      if (!alertedRef.current.has(key)) {
        alertedRef.current.add(key);
        const dias = diasHasta(r.fechaProximoMant!);
        addNotif({
          tipo: "warning", modulo: "redes",
          titulo: `Mantenimiento de red ${dias < 0 ? "vencido" : "próximo"} — ${r.codigoCliente}`,
          mensaje: `${r.clienteNombre} (${r.tipoServicio}) — ${dias < 0 ? `vencido hace ${Math.abs(dias)} día(s)` : dias === 0 ? "hoy" : `en ${dias} día(s)`}`,
        });
      }
    });
  }, [inventario, mantenimientos, redes, cloudLoaded]);

  async function handleLoginSubmit(email: string, password: string) {
    await signInEmail(email, password);
    addNotif({ tipo: "success", titulo: "Sesión iniciada", mensaje: `Bienvenido`, modulo: "sistema" });
  }

  function handleLogout() {
    signOutFb().catch(() => {});
    setCurrentUser(null);
    setUsers([]);
    setCloudLoaded(false);
    setPhase("login");
  }

  // Ensure user always has access to at least a first available tab
  useEffect(() => {
    if (!currentUser) return;
    const visible = TABS.filter(t => currentUser.permisos[t.id as keyof Permisos]);
    if (visible.length > 0 && !visible.find(t => t.id === activeTab)) setActiveTab(visible[0].id);
  }, [currentUser, activeTab]);

  function handleFbConfigSaved(config: FirebaseWebConfig) {
    saveFbConfig(config);
    setFbUrlState(config.databaseURL.replace(/\/$/, ""));
    setCloudLoaded(false); // fuerza una nueva sincronización con la nueva configuración
  }

  function handleFbDisconnect() {
    clearFbConfig();
    setFbUrlState("");
    setCloudLoaded(false);
  }

  const renderPage = () => {
    if (!currentUser) return null;
    const props = { showToast, addNotif };
    switch (activeTab) {
      case "cotizador": return <CotizadorPage catalog={catalog} cotizaciones={cotizaciones} setCotizaciones={setCotizaciones} fbUrl={fbUrl} onFbConfigSaved={handleFbConfigSaved} onFbDisconnect={handleFbDisconnect} {...props} />;
      case "seguimiento": return <SeguimientoPage cotizaciones={cotizaciones} setCotizaciones={setCotizaciones} {...props} />;
      case "catalogo": return <CatalogoPage catalog={catalog} setCatalog={setCatalog} fbUrl={fbUrl} {...props} />;
      case "ventas": return <VentasPage ventas={ventas} setVentas={setVentas} {...props} />;
      case "inventario": return <InventarioPage inventario={inventario} setInventario={setInventario} {...props} />;
      case "gastos": return <GastosPage gastos={gastos} setGastos={setGastos} {...props} />;
      case "pagos": return <PagosPage pagos={pagos} setPagos={setPagos} {...props} />;
      case "hojatrabajo": return <HojaTrabajoPage cotizaciones={cotizaciones} {...props} />;
      case "mantenimiento": return <MantenimientoPage mantenimientos={mantenimientos} setMantenimientos={setMantenimientos} {...props} />;
      case "redes": return <RedesPage redes={redes} setRedes={setRedes} cotizaciones={cotizaciones} ventas={ventas} currentUser={currentUser} {...props} />;
      case "usuarios": return <UsuariosPage users={users} setUsers={setUsers} currentUser={currentUser} {...props} />;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#07090f] text-[#e8e8f0]" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      <AnimatePresence>
        {phase === "splash" && <SplashScreen onDone={() => setPhase("login")} />}
      </AnimatePresence>

      {phase === "login" && (
        authChecking ? (
          <div className="fixed inset-0 flex items-center justify-center bg-[#07090f] px-4">
            <div className="text-center">
              <div className="w-10 h-10 border-2 border-[#1a2235] border-t-[#0ea5c8] rounded-full animate-spin mx-auto mb-4" />
              <div className="text-white font-bold mb-1 text-sm">Conectando con Zento Data...</div>
              <div className="text-[#8090a8] text-xs">Verificando tu sesión</div>
            </div>
          </div>
        ) : profileIssue ? (
          <div className="fixed inset-0 flex items-center justify-center bg-[#07090f] px-4">
            <div className="w-full max-w-sm bg-[#0b0e1a] border border-[#1a2235] rounded-2xl p-6 text-center">
              <div className="w-14 h-14 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={26} className="text-amber-400" />
              </div>
              {profileIssue.type === "missing" ? (
                <>
                  <h2 className="text-white font-bold mb-2">Tu cuenta no tiene perfil configurado</h2>
                  <p className="text-[#8090a8] text-xs mb-3 leading-relaxed">
                    Tu inicio de sesión de Firebase fue exitoso, pero no existe un perfil en <code className="text-[#0ea5c8]">/users</code> para esta cuenta. Pide a un administrador que te agregue desde el Panel de Usuarios, o si eres la primera cuenta del sistema, créala manualmente en Firebase Realtime Database bajo:
                  </p>
                  <div className="bg-[#060810] border border-[#1a2235] rounded-lg px-3 py-2 text-[10px] text-[#0ea5c8] font-mono break-all mb-3">
                    /users/{profileIssue.uid}
                  </div>
                </>
              ) : (
                <>
                  <h2 className="text-white font-bold mb-2">Cuenta desactivada</h2>
                  <p className="text-[#8090a8] text-xs mb-3">Tu cuenta ({profileIssue.email}) está marcada como inactiva. Contacta a un administrador.</p>
                </>
              )}
              <button onClick={() => { setProfileIssue(null); handleLogout(); }} className="text-xs text-[#0ea5c8] hover:text-white">Volver al login</button>
            </div>
          </div>
        ) : (
          <LoginScreen onLogin={handleLoginSubmit} fbReady={!!fbUrl} />
        )
      )}

      {phase === "app" && currentUser && (
        <motion.div className="flex flex-col h-screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
          <TopNav
            user={currentUser}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            notifs={notifs}
            onMarkAll={() => { const n = notifs.map(x => ({ ...x, leida: true })); setNotifs(n); persist("zNotifs", n); }}
            onMarkOne={(id) => { const n = notifs.map(x => x.id === id ? { ...x, leida: true } : x); setNotifs(n); persist("zNotifs", n); }}
            onClearNotifs={() => { setNotifs([]); persist("zNotifs", []); }}
            onLogout={handleLogout}
            onToggleSidebar={() => setSidebarOpen(true)}
            syncStatus={syncStatus}
            fbConfigured={!!fbUrl}
          />
          <Sidebar
            open={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            user={currentUser}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
          />
          <main className="flex-1 overflow-y-auto">
            <div className="px-4 py-6 sm:px-6">
              <AnimatePresence mode="wait">
                <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                  {renderPage()}
                </motion.div>
              </AnimatePresence>
            </div>
          </main>
        </motion.div>
      )}

      <Toast msg={toastMsg} />
    </div>
  );
}
