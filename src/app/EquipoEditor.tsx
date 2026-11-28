// Editor de «¿Qué se instaló?» compartido por el CRM (tema oscuro) y la app de técnicos (tema claro).
import { useState } from "react";
import type { EquipoRed } from "@/app/App";
import { CATEGORIAS, CATEGORIAS_ORDEN, requiereAcceso, tieneWifi, type CategoriaEquipo } from "@/app/redesCatalogo";

type Tema = "claro" | "oscuro";

const T = {
  claro: {
    caja: "rounded-xl border border-[#e1e4ef] p-3 space-y-3 bg-[#fafbfe]",
    titulo: "text-sm font-semibold text-slate-600",
    quitar: "text-red-500 text-sm",
    btnOn: "text-white border-[#0b1f4d] bg-[#0b1f4d]", btnOff: "bg-white text-slate-600 border-[#e1e4ef]",
    btn: "py-2.5 rounded-lg text-sm font-semibold border-2 flex flex-col items-center leading-tight",
    label: "block text-xs font-semibold text-slate-500 mb-1",
    input: "w-full rounded-lg border border-[#e1e4ef] bg-white px-3 py-2.5 text-base text-slate-800 focus:outline-none focus:border-[#0b1f4d] min-w-0",
    acceso: "rounded-lg border border-amber-300 bg-amber-50 p-2.5 space-y-2",
    accesoTit: "text-xs font-semibold text-amber-800",
    nota: "text-[11px] text-amber-700",
  },
  oscuro: {
    caja: "rounded-xl border border-[#1a2235] bg-[#080b16] p-3 space-y-2.5",
    titulo: "text-[11px] font-semibold text-[#8090a8] uppercase tracking-wider",
    quitar: "text-red-400 text-xs hover:bg-red-500/10 rounded px-1.5 py-1",
    btnOn: "bg-[#0ea5c8]/15 border-[#0ea5c8] text-[#0ea5c8]", btnOff: "bg-[#060810] border-[#1a2235] text-[#8090a8] hover:text-white",
    btn: "py-2 rounded-lg text-xs font-semibold border flex flex-col items-center leading-tight transition-all",
    label: "text-[10px] text-[#8090a8] font-semibold uppercase tracking-wider block mb-1",
    input: "w-full bg-[#060810] border border-[#1a2235] rounded-lg px-2.5 py-2 text-sm text-[#e8e8f0] focus:outline-none focus:border-[#0ea5c8] min-w-0",
    acceso: "rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5 space-y-2",
    accesoTit: "text-[11px] font-semibold text-amber-400 uppercase tracking-wider",
    nota: "text-[10px] text-amber-500/80",
  },
} as const;

export function EquipoEditor({ eq, onChange, onDelete, puedeBorrar, tema, titulo }: {
  eq: EquipoRed; onChange: (e: EquipoRed) => void; onDelete: () => void; puedeBorrar: boolean; tema: Tema; titulo?: string;
}) {
  const t = T[tema];
  const cat = eq.categoria;
  const def = cat ? CATEGORIAS[cat] : undefined;
  const set = (p: Partial<EquipoRed>) => onChange({ ...eq, ...p });
  const [verClave, setVerClave] = useState(false);
  const acceso = requiereAcceso(eq);
  const wifi = tieneWifi(eq);
  const inputClave = verClave ? "text" : "password";
  const listo = !!eq.tipoEquipo && (def?.marca === "oculta" || def?.marca === "opcional" || !!eq.marca);

  return (
    <div className={t.caja}>
      <div className="flex items-center justify-between">
        <span className={t.titulo}>{titulo || "¿Qué se instaló?"}</span>
        {puedeBorrar && <button type="button" onClick={onDelete} className={t.quitar}>Quitar</button>}
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {CATEGORIAS_ORDEN.map(k => (
          <button key={k} type="button" title={CATEGORIAS[k].labelLargo}
            onClick={() => cat !== k && onChange({ id: eq.id, modelo: "", categoria: k as CategoriaEquipo, tipoEquipo: "", marca: "", marcaOtra: "", cantidad: 1 })}
            className={`${t.btn} ${cat === k ? t.btnOn : t.btnOff}`}>
            <span className="text-base">{CATEGORIAS[k].icono}</span><span className="text-[11px]">{CATEGORIAS[k].label}</span>
          </button>
        ))}
      </div>
      {cat && def && (
        <>
          <div className={def.marca === "oculta" ? "" : "grid grid-cols-2 gap-2"}>
            <div>
              <label className={t.label}>{def.tipoLabel}</label>
              <select className={t.input} value={eq.tipoEquipo || ""} onChange={e => set({ tipoEquipo: e.target.value })}>
                <option value="">Seleccionar...</option>{def.tipos.map(x => <option key={x}>{x}</option>)}
              </select>
            </div>
            {def.marca !== "oculta" && (
              <div>
                <label className={t.label}>Marca{def.marca === "opcional" ? " (opcional)" : ""}</label>
                <select className={t.input} value={eq.marca || ""} onChange={e => set({ marca: e.target.value })}>
                  <option value="">Seleccionar...</option>{def.marcas.map(m => <option key={m}>{m}</option>)}<option value="Otra">Otra...</option>
                </select>
              </div>
            )}
          </div>
          {eq.marca === "Otra" && <input className={t.input} placeholder="Escribe la marca" value={eq.marcaOtra || ""} onChange={e => set({ marcaOtra: e.target.value })} />}
          {listo && (
            <>
              <div className="grid grid-cols-[1fr_84px] gap-2">
                <div>
                  <label className={t.label}>{def.modeloLabel}{def.modelo === "requerido" ? " *" : ""}</label>
                  <input className={t.input} value={eq.modelo} onChange={e => set({ modelo: e.target.value })} placeholder={def.modeloPlaceholder} />
                </div>
                <div>
                  <label className={t.label}>{def.cantLabel || "Cant."}</label>
                  <input className={t.input} type="number" min={1} inputMode="numeric" value={eq.cantidad || 1} onChange={e => set({ cantidad: Math.max(1, parseInt(e.target.value, 10) || 1) })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={t.label}>Ubicación</label>
                  <input className={t.input} value={eq.ubicacion || ""} onChange={e => set({ ubicacion: e.target.value })} placeholder="Ej. entrada, rack" />
                </div>
                <div>
                  <label className={t.label}>{(eq.cantidad || 1) > 1 ? "Seriales (coma)" : "Serial (opc.)"}</label>
                  <input className={t.input} value={eq.serial || ""} onChange={e => set({ serial: e.target.value })} />
                </div>
              </div>
              {acceso && (
                <div className={t.acceso}>
                  <div className="flex items-center justify-between">
                    <span className={t.accesoTit}>🔑 Acceso administrativo</span>
                    <button type="button" onClick={() => setVerClave(v => !v)} className={t.nota + " underline"}>{verClave ? "Ocultar" : "Mostrar"}</button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={t.label}>Usuario admin</label>
                      <input className={t.input} autoCapitalize="none" autoCorrect="off" value={eq.usuario || ""} onChange={e => set({ usuario: e.target.value })} placeholder="admin" />
                    </div>
                    <div>
                      <label className={t.label}>Contraseña</label>
                      <input className={t.input} type={inputClave} autoComplete="new-password" value={eq.clave || ""} onChange={e => set({ clave: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <label className={t.label}>IP / dirección de acceso (opc.)</label>
                    <input className={t.input} inputMode="decimal" autoCapitalize="none" value={eq.ip || ""} onChange={e => set({ ip: e.target.value })} placeholder="192.168.1.1" />
                  </div>
                  {wifi && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className={t.label}>Red Wi-Fi (SSID)</label>
                        <input className={t.input} autoCapitalize="none" value={eq.ssid || ""} onChange={e => set({ ssid: e.target.value })} />
                      </div>
                      <div>
                        <label className={t.label}>Clave Wi-Fi</label>
                        <input className={t.input} type={inputClave} autoComplete="new-password" value={eq.claveWifi || ""} onChange={e => set({ claveWifi: e.target.value })} />
                      </div>
                    </div>
                  )}
                  <p className={t.nota}>Se guarda solo para uso interno y se entrega al cliente en el acta impresa; no aparece en el enlace de firma.</p>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
